# Design Document: Robust Queue Processing with Delay & Retry

## Overview

This design enhances the BDLawCorpus queue processing system to be resilient to temporary site downtime, network issues, and partial DOM loads. The system implements configurable delays, deterministic failure detection, automatic retry with exponential backoff, and comprehensive failure tracking while maintaining research integrity.

The design follows these non-negotiable principles:
- **No automated crawling**: Only process user-queued acts
- **No content inference**: Failed extractions remain failed, no auto-correction
- **Honest reporting**: Failures are tracked and exported, never hidden
- **textContent only**: DOM extraction method unchanged

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Robust Queue Processing Pipeline                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ Main Queue  │  │ DOM Readiness   │  │ Extraction                      │  │
│  │ Processing  │──▶│ Detection       │──▶│ Attempt                         │  │
│  └─────────────┘  └─────────────────┘  └─────────────────────────────────┘  │
│         │                │                           │                       │
│         │                │                           ▼                       │
│         │                │              ┌─────────────────────────────────┐  │
│         │                │              │ Failure Detection               │  │
│         │                │              │ - Container missing             │  │
│         │                │              │ - Content empty/short           │  │
│         │                │              │ - Timeout exceeded              │  │
│         │                │              │ - Network error                 │  │
│         │                │              └─────────────────────────────────┘  │
│         │                │                           │                       │
│         │                │              ┌────────────┴────────────┐          │
│         │                │              ▼                         ▼          │
│         │                │    ┌─────────────────┐    ┌─────────────────┐    │
│         │                │    │ Success         │    │ Failed          │    │
│         │                │    │ → Captured Acts │    │ → Retry Queue   │    │
│         │                │    └─────────────────┘    └─────────────────┘    │
│         │                │                                    │              │
│         ▼                ▼                                    ▼              │
│  ┌─────────────────────────────┐              ┌─────────────────────────┐   │
│  │ Configurable Delay          │              │ Retry Processing        │   │
│  │ (after DOM ready)           │              │ - Exponential backoff   │   │
│  └─────────────────────────────┘              │ - Max attempts limit    │   │
│                                               │ - Permanent failure     │   │
│                                               └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Queue Processing Configuration

```javascript
/**
 * Queue processing configuration with defaults
 * Requirements: 1.1, 1.4, 3.7, 10.1-10.4
 */
const QUEUE_CONFIG_DEFAULTS = {
  // Delay between extractions (ms)
  extraction_delay_ms: 3000,
  extraction_delay_min: 1000,
  extraction_delay_max: 30000,
  
  // DOM readiness timeout (ms)
  dom_readiness_timeout_ms: 30000,
  
  // Content validation
  minimum_content_threshold: 100,
  minimum_content_threshold_min: 50,
  minimum_content_threshold_max: 1000,
  
  // Retry settings
  max_retry_attempts: 3,
  max_retry_attempts_min: 1,
  max_retry_attempts_max: 5,
  retry_base_delay_ms: 5000,
  retry_base_delay_min: 2000,
  retry_base_delay_max: 30000
};

/**
 * Get queue processing configuration
 * Requirements: 1.1, 1.5, 10.5
 * 
 * @returns {Object} Current configuration with defaults applied
 */
function getQueueConfig() {
  const stored = localStorage.getItem('bdlaw_queue_config');
  const config = stored ? JSON.parse(stored) : {};
  
  return {
    extraction_delay_ms: clamp(
      config.extraction_delay_ms ?? QUEUE_CONFIG_DEFAULTS.extraction_delay_ms,
      QUEUE_CONFIG_DEFAULTS.extraction_delay_min,
      QUEUE_CONFIG_DEFAULTS.extraction_delay_max
    ),
    minimum_content_threshold: clamp(
      config.minimum_content_threshold ?? QUEUE_CONFIG_DEFAULTS.minimum_content_threshold,
      QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_min,
      QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_max
    ),
    max_retry_attempts: clamp(
      config.max_retry_attempts ?? QUEUE_CONFIG_DEFAULTS.max_retry_attempts,
      QUEUE_CONFIG_DEFAULTS.max_retry_attempts_min,
      QUEUE_CONFIG_DEFAULTS.max_retry_attempts_max
    ),
    retry_base_delay_ms: clamp(
      config.retry_base_delay_ms ?? QUEUE_CONFIG_DEFAULTS.retry_base_delay_ms,
      QUEUE_CONFIG_DEFAULTS.retry_base_delay_min,
      QUEUE_CONFIG_DEFAULTS.retry_base_delay_max
    ),
    dom_readiness_timeout_ms: QUEUE_CONFIG_DEFAULTS.dom_readiness_timeout_ms
  };
}

/**
 * Save queue processing configuration
 * Requirements: 1.5, 10.5
 */
function saveQueueConfig(config) {
  localStorage.setItem('bdlaw_queue_config', JSON.stringify(config));
}

/**
 * Clamp value to range
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
```

### 2. Failure Reason Constants

```javascript
/**
 * Failure reason constants for deterministic failure detection
 * Requirements: 3.1-3.9
 */
const FAILURE_REASONS = {
  CONTAINER_NOT_FOUND: 'container_not_found',
  CONTENT_EMPTY: 'content_empty',
  CONTENT_BELOW_THRESHOLD: 'content_below_threshold',
  CONTENT_SELECTOR_MISMATCH: 'content_selector_mismatch', // Page rendered but no legal content anchors detected
  DOM_TIMEOUT: 'dom_timeout',
  NETWORK_ERROR: 'network_error',
  NAVIGATION_ERROR: 'navigation_error',
  EXTRACTION_ERROR: 'extraction_error',
  UNKNOWN_ERROR: 'unknown_error'
};

/**
 * Extraction status constants
 * Requirements: 6.1
 */
const EXTRACTION_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
  PROCESSING: 'processing',
  RETRYING: 'retrying'
};
```

### 3. Extraction Readiness Detection

```javascript
/**
 * Legal content signal patterns for extraction readiness
 * Requirements: 2.2, 2.3, 2.8
 */
const LEGAL_CONTENT_SIGNALS = {
  // Act title patterns
  ACT_TITLE_SELECTORS: [
    '#act_title',
    '.act-title',
    'h1.act-name',
    '.act-header h1'
  ],
  
  // Enactment clause patterns (English and Bengali)
  ENACTMENT_PATTERNS: [
    /It is hereby enacted/i,
    /এতদ্দ্বারা প্রণীত/,
    /Be it enacted/i,
    /প্রণীত হইল/
  ],
  
  // First section patterns (English and Bengali)
  SECTION_PATTERNS: [
    /^\s*1\.\s/m,           // English: "1. "
    /^\s*১\.\s/m,           // Bengali: "১. "
    /^Section\s+1\b/im,     // "Section 1"
    /^ধারা\s+১\b/m          // Bengali: "ধারা ১"
  ]
};

/**
 * Check for legal content signals in page
 * Requirements: 2.2, 2.3, 2.8
 * 
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<Object>} { hasSignal: boolean, signalType?: string }
 */
async function checkLegalContentSignals(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Check for act title
        const titleSelectors = ['#act_title', '.act-title', 'h1.act-name', '.act-header h1'];
        for (const sel of titleSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent.trim().length > 0) {
            return { hasSignal: true, signalType: 'act_title' };
          }
        }
        
        // Get body text for pattern matching
        const bodyText = document.body?.textContent || '';
        
        // Check for enactment clause (English or Bengali)
        const enactmentPatterns = [
          /It is hereby enacted/i,
          /এতদ্দ্বারা প্রণীত/,
          /Be it enacted/i,
          /প্রণীত হইল/
        ];
        for (const pattern of enactmentPatterns) {
          if (pattern.test(bodyText)) {
            return { hasSignal: true, signalType: 'enactment_clause' };
          }
        }
        
        // Check for first numbered section (English or Bengali)
        const sectionPatterns = [
          /^\s*1\.\s/m,
          /^\s*১\.\s/m,
          /^Section\s+1\b/im,
          /^ধারা\s+১\b/m
        ];
        for (const pattern of sectionPatterns) {
          if (pattern.test(bodyText)) {
            return { hasSignal: true, signalType: 'first_section' };
          }
        }
        
        return { hasSignal: false };
      }
    });
    
    return result;
  } catch (e) {
    return { hasSignal: false, error: e.message };
  }
}

/**
 * Wait for extraction readiness with legal content signal verification
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 * 
 * @param {number} tabId - Chrome tab ID
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {number} minThreshold - Minimum content threshold
 * @returns {Promise<Object>} { ready: boolean, reason?: string, signalType?: string }
 */
async function waitForExtractionReadiness(tabId, timeoutMs = 30000, minThreshold = 100) {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const checkReadiness = async () => {
      // Check if timeout exceeded
      if (Date.now() - startTime > timeoutMs) {
        resolve({ ready: false, reason: FAILURE_REASONS.DOM_TIMEOUT });
        return;
      }
      
      try {
        // Step 1: Check document.readyState (prerequisite)
        const [{ result: readyState }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => document.readyState
        });
        
        if (readyState !== 'complete') {
          setTimeout(checkReadiness, 500);
          return;
        }
        
        // Step 2: Check for legal content signals
        const signalResult = await checkLegalContentSignals(tabId);
        
        if (signalResult.hasSignal) {
          resolve({ ready: true, signalType: signalResult.signalType });
          return;
        }
        
        // Step 3: Fallback - check minimum content threshold
        const [{ result: contentLength }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const selectors = ['#act_content', '.act-content', '#act-details', '.act-details', 'main', 'article'];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el) {
                return el.textContent.length;
              }
            }
            return document.body?.textContent?.length || 0;
          }
        });
        
        if (contentLength >= minThreshold) {
          resolve({ ready: true, signalType: 'content_threshold' });
          return;
        }
        
        // Page is rendered but no legal content signals detected
        // Keep waiting until timeout, then classify as selector mismatch
        if (Date.now() - startTime < timeoutMs) {
          setTimeout(checkReadiness, 500);
          return;
        }
        
        // Timeout reached with page rendered but no signals
        resolve({ ready: false, reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH });
        
      } catch (e) {
        resolve({ ready: false, reason: FAILURE_REASONS.NETWORK_ERROR });
      }
    };
    
    checkReadiness();
  });
}
```

### 4. Extraction Validation

```javascript
/**
 * Validate extraction result
 * Requirements: 3.1, 3.2, 3.3, 3.6, 3.8, 3.9
 * 
 * @param {Object} result - Extraction result from content script
 * @param {number} minThreshold - Minimum content length
 * @param {Object} readinessResult - Result from waitForExtractionReadiness
 * @returns {Object} { valid: boolean, reason?: string }
 */
function validateExtraction(result, minThreshold = 100, readinessResult = null) {
  // Check if extraction succeeded
  if (!result || !result.success) {
    return {
      valid: false,
      reason: result?.error || FAILURE_REASONS.EXTRACTION_ERROR
    };
  }
  
  // Check for content container
  if (!result.content && !result.content_raw) {
    // Distinguish between selector mismatch and container not found
    if (readinessResult && readinessResult.reason === FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH) {
      return {
        valid: false,
        reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH
      };
    }
    return {
      valid: false,
      reason: FAILURE_REASONS.CONTAINER_NOT_FOUND
    };
  }
  
  const content = result.content_raw || result.content || '';
  
  // Check for empty content
  if (content.length === 0) {
    return {
      valid: false,
      reason: FAILURE_REASONS.CONTENT_EMPTY
    };
  }
  
  // Check minimum threshold
  if (content.length < minThreshold) {
    return {
      valid: false,
      reason: FAILURE_REASONS.CONTENT_BELOW_THRESHOLD
    };
  }
  
  return { valid: true };
}
```

### 5. Failed Extraction Tracking

```javascript
/**
 * Failed extraction entry structure
 * Requirements: 4.1, 4.2
 */
const FAILED_EXTRACTION_ENTRY = {
  act_id: '',
  act_number: '',
  url: '',
  title: '',
  failure_reason: '',
  retry_count: 0,
  max_retries: 3,
  failed_at: '',
  attempts: []  // Array of { attempt_number, timestamp, reason, outcome }
};

/**
 * Add failed extraction to tracking
 * Requirements: 4.1, 4.2, 5.7
 * 
 * @param {Array} failedExtractions - Current failed extractions list
 * @param {Object} item - Queue item that failed
 * @param {string} reason - Failure reason
 * @param {number} attemptNumber - Current attempt number
 * @returns {Array} Updated failed extractions list
 */
function addFailedExtraction(failedExtractions, item, reason, attemptNumber = 1) {
  const existing = failedExtractions.find(f => f.act_id === item.id);
  
  const attemptEntry = {
    attempt_number: attemptNumber,
    timestamp: new Date().toISOString(),
    reason: reason,
    outcome: 'failed'
  };
  
  if (existing) {
    // Update existing entry
    existing.retry_count = attemptNumber;
    existing.failure_reason = reason;
    existing.failed_at = new Date().toISOString();
    existing.attempts.push(attemptEntry);
    return failedExtractions;
  }
  
  // Create new entry
  const newEntry = {
    act_id: item.id,
    act_number: item.actNumber,
    url: item.url,
    title: item.title,
    failure_reason: reason,
    retry_count: attemptNumber,
    max_retries: getQueueConfig().max_retry_attempts,
    failed_at: new Date().toISOString(),
    attempts: [attemptEntry]
  };
  
  return [...failedExtractions, newEntry];
}

/**
 * Check if extraction should be retried
 * Requirements: 5.2, 5.5
 * 
 * @param {Object} failedEntry - Failed extraction entry
 * @returns {boolean} True if retry is allowed
 */
function shouldRetry(failedEntry) {
  const config = getQueueConfig();
  return failedEntry.retry_count < config.max_retry_attempts;
}

/**
 * Calculate retry delay with exponential backoff
 * Requirements: 5.3
 * 
 * @param {number} retryCount - Current retry count (1-based)
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(retryCount) {
  const config = getQueueConfig();
  // Exponential backoff: base_delay * 2^(retry_count - 1)
  return config.retry_base_delay_ms * Math.pow(2, retryCount - 1);
}
```

### 6. Queue Processing State

```javascript
/**
 * Queue processing state structure
 * Requirements: 8.1-8.5
 */
const QUEUE_STATE = {
  isProcessing: false,
  isRetrying: false,
  currentItem: null,
  processedCount: 0,
  successCount: 0,
  failedCount: 0,
  retriedCount: 0,
  queue: [],
  failedExtractions: [],
  retryQueue: []
};

/**
 * Save queue state to storage
 * Requirements: 8.1, 8.2, 8.3
 */
async function saveQueueState(state) {
  await chrome.storage.local.set({
    bdlaw_queue: state.queue,
    bdlaw_failed_extractions: state.failedExtractions,
    bdlaw_queue_stats: {
      processedCount: state.processedCount,
      successCount: state.successCount,
      failedCount: state.failedCount,
      retriedCount: state.retriedCount
    }
  });
}

/**
 * Load queue state from storage
 * Requirements: 8.4
 */
async function loadQueueState() {
  const data = await chrome.storage.local.get([
    'bdlaw_queue',
    'bdlaw_failed_extractions',
    'bdlaw_queue_stats'
  ]);
  
  return {
    queue: data.bdlaw_queue || [],
    failedExtractions: data.bdlaw_failed_extractions || [],
    ...data.bdlaw_queue_stats
  };
}
```

### 7. Failed Act Export Format

```javascript
/**
 * Format failed act for export
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 * 
 * @param {Object} failedEntry - Failed extraction entry
 * @returns {Object} Export-ready failed act object
 */
function formatFailedActForExport(failedEntry) {
  return {
    act_number: failedEntry.act_number,
    title: failedEntry.title,
    url: failedEntry.url,
    
    // Extraction status - clearly marked as failed
    extraction_status: EXTRACTION_STATUS.FAILED,
    failure_reason: failedEntry.failure_reason,
    
    // Attempt tracking
    attempts: failedEntry.attempts.length,
    attempt_history: failedEntry.attempts,
    
    // No content - never infer or auto-correct
    content_raw: null,
    content_normalized: null,
    content_corrected: null,
    
    // Metadata
    _metadata: {
      first_attempt_at: failedEntry.attempts[0]?.timestamp,
      last_attempt_at: failedEntry.failed_at,
      total_attempts: failedEntry.attempts.length,
      max_retries_reached: failedEntry.retry_count >= failedEntry.max_retries,
      extraction_status: EXTRACTION_STATUS.FAILED,
      failure_reason: failedEntry.failure_reason
    }
  };
}
```

## Data Models

### Queue Item Schema (Enhanced)

```json
{
  "id": "1703849600000_78",
  "actNumber": "78",
  "title": "Some Act, 1990",
  "url": "http://bdlaws.minlaw.gov.bd/act-details-78.html",
  "volumeNumber": "28",
  "status": "pending | processing | completed | error | retrying",
  "addedAt": "2025-12-29T10:00:00Z",
  "retry_count": 0,
  "last_error": null
}
```

### Failed Extraction Schema

```json
{
  "act_id": "1703849600000_78",
  "act_number": "78",
  "url": "http://bdlaws.minlaw.gov.bd/act-details-78.html",
  "title": "Some Act, 1990",
  "failure_reason": "content_below_threshold",
  "retry_count": 3,
  "max_retries": 3,
  "failed_at": "2025-12-29T10:05:00Z",
  "attempts": [
    {
      "attempt_number": 1,
      "timestamp": "2025-12-29T10:00:00Z",
      "reason": "dom_timeout",
      "outcome": "failed"
    },
    {
      "attempt_number": 2,
      "timestamp": "2025-12-29T10:02:00Z",
      "reason": "content_empty",
      "outcome": "failed"
    },
    {
      "attempt_number": 3,
      "timestamp": "2025-12-29T10:05:00Z",
      "reason": "content_below_threshold",
      "outcome": "failed"
    }
  ]
}
```

### Queue Configuration Schema

```json
{
  "extraction_delay_ms": 3000,
  "minimum_content_threshold": 100,
  "max_retry_attempts": 3,
  "retry_base_delay_ms": 5000
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Configuration Persistence

*For any* queue configuration saved, loading the configuration SHALL return the same values. Configuration values SHALL be clamped to valid ranges.

**Validates: Requirements 1.1, 1.4, 1.5, 10.1-10.5**

### Property 2: Failure Detection Completeness

*For any* extraction attempt, if no legal content signals are detected, content is empty, content is below threshold, timeout is exceeded, or network error occurs, the extraction SHALL be marked as failed with the appropriate failure_reason. Selector mismatch failures SHALL NOT be classified as timeout failures.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9**

### Property 3: Failed Extraction Tracking

*For any* failed extraction, the failed_extractions list SHALL contain an entry with act_id, url, failure_reason, retry_count, and failed_at timestamp. Failed extractions SHALL persist until explicitly cleared.

**Validates: Requirements 4.1, 4.2, 4.3, 4.6**

### Property 4: Retry Mechanism Correctness

*For any* failed extraction with retry_count < max_retry_attempts, the system SHALL retry with exponential backoff delay (base_delay * 2^retry_count). Retry_count SHALL increment with each attempt. When retry_count >= max_retry_attempts, the act SHALL be marked as permanently failed.

**Validates: Requirements 5.2, 5.3, 5.4, 5.5**

### Property 5: Failed Act Export Format

*For any* permanently failed act, the export SHALL include extraction_status: "failed", failure_reason, total attempts count, and attempt timestamps. Content fields SHALL be null (no inference).

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

### Property 6: Extraction Delay Application

*For any* queue processing, the configured delay SHALL be applied AFTER DOM readiness confirmation, not just after navigation. The delay SHALL be between 1000ms and 30000ms.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 7: Extraction Readiness Enforcement

*For any* extraction attempt, the system SHALL NOT proceed until document.readyState === 'complete' AND at least one legal content signal is verified (act title, enactment clause in EN/BN, first numbered section in EN/BN, or content threshold met). If extraction readiness timeout (30s) is exceeded with page rendered but no signals, extraction SHALL fail with reason "content_selector_mismatch". If page did not render, extraction SHALL fail with reason "dom_timeout".

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

### Property 9: Failure Classification Accuracy

*For any* failed extraction on a fully-rendered page where legal content signals are not detected, the failure_reason SHALL be "content_selector_mismatch", NOT "dom_timeout" or "network_error". This ensures accurate failure classification for audit and methodology disclosure.

**Validates: Requirements 3.8, 3.9**

### Property 8: Research Integrity Preservation

*For any* extraction (successful or failed), the system SHALL use element.textContent exclusively. Failed extractions SHALL NOT have inferred or auto-corrected content.

**Validates: Requirements 9.4, 9.5, 6.6**

## Error Handling

| Error Condition | Handling |
|-----------------|----------|
| Network error during navigation | Mark as failed with NETWORK_ERROR, add to retry queue |
| DOM timeout exceeded (page did not render) | Mark as failed with DOM_TIMEOUT, add to retry queue |
| Content selector mismatch (page rendered, no anchors) | Mark as failed with CONTENT_SELECTOR_MISMATCH, add to retry queue with broader selectors |
| Content container not found | Mark as failed with CONTAINER_NOT_FOUND, add to retry queue |
| Empty content extracted | Mark as failed with CONTENT_EMPTY, add to retry queue |
| Content below threshold | Mark as failed with CONTENT_BELOW_THRESHOLD, add to retry queue |
| Max retries exceeded | Mark as permanently failed, include in export with failed status |
| Storage save failure | Log error, continue processing, retry save on next item |
| Configuration load failure | Use default configuration values |

### Failure Classification Hierarchy

The system distinguishes between failure types to preserve methodological clarity:

1. **Network/Infrastructure Failures**: Page did not load (NETWORK_ERROR, NAVIGATION_ERROR)
2. **Timeout Failures**: Page loading exceeded time limit (DOM_TIMEOUT)
3. **Selector Mismatch Failures**: Page rendered but legal content anchors not detected (CONTENT_SELECTOR_MISMATCH)
4. **Content Validation Failures**: Content extracted but invalid (CONTENT_EMPTY, CONTENT_BELOW_THRESHOLD)

This hierarchy ensures that fully-rendered pages with layout heterogeneity are not misclassified as timeout or network failures.

## Methodology Disclosure

Some extraction failures arise from layout heterogeneity across fully rendered act pages, where DOM structure diverges from assumed extraction anchors. The system explicitly distinguishes between:

- **Network/timeout failures**: Page did not render successfully
- **Selector mismatch failures**: Page rendered but legal content could not be reliably detected under allowed extraction rules

This distinction preserves research integrity by:
1. Refusing to infer content when extraction anchors are ambiguous
2. Accurately classifying failure causes for audit purposes
3. Enabling targeted retry strategies without compromising extraction constraints

## Testing Strategy

### Unit Tests
- Test configuration save/load with various values
- Test configuration clamping to valid ranges
- Test failure reason assignment for each failure type
- Test exponential backoff calculation
- Test failed extraction entry creation and update
- Test shouldRetry logic with various retry counts

### Property-Based Tests
- Generate random configurations and verify persistence round-trip
- Generate extraction results and verify failure detection
- Generate retry sequences and verify backoff calculation
- Generate failed acts and verify export format completeness

### Integration Tests
- Test full queue processing with simulated failures
- Test retry queue processing after main queue
- Test state persistence across simulated browser restarts
- Test UI updates during processing

### Test Configuration
- Minimum 100 iterations per property test
- Use fast-check for JavaScript property testing
- Tag format: **Feature: robust-queue-processing, Property {N}: {title}**
