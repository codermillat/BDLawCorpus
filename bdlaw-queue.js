/**
 * BDLawCorpus Queue Management Module
 * 
 * Provides queue deduplication and management functionality.
 * Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 29.1, 29.2, 29.3, 29.5
 * 
 * Enhanced with robust queue processing:
 * - Configurable delays between extractions
 * - Deterministic failure detection
 * - Automatic retry with exponential backoff
 * - Failed extraction tracking
 */

// ============================================
// QUEUE CONFIGURATION DEFAULTS
// Requirements: 1.1, 1.4, 3.7, 10.1-10.4
// ============================================
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

// ============================================
// LEGAL CONTENT SIGNALS
// Requirements: 2.2, 2.3, 2.8
// ============================================
const LEGAL_CONTENT_SIGNALS = {
  // Act title selectors - common patterns for act title elements
  ACT_TITLE_SELECTORS: [
    '#act_title',
    '.act-title',
    'h1.act-name',
    '.act-header h1',
    '#actTitle',
    '.actTitle'
  ],
  
  // Enactment clause patterns (English and Bengali)
  // These indicate the beginning of legal act text
  ENACTMENT_PATTERNS: [
    /It is hereby enacted/i,           // English standard
    /Be it enacted/i,                  // English alternative
    /এতদ্দ্বারা প্রণীত/,                    // Bengali: "hereby enacted"
    /প্রণীত হইল/                         // Bengali: "is enacted"
  ],
  
  // First section patterns (English and Bengali)
  // Indicates numbered sections have begun
  SECTION_PATTERNS: [
    /^\s*1\.\s/m,                      // English: "1. " at line start
    /^\s*১\.\s/m,                      // Bengali: "১. " at line start
    /^Section\s+1\b/im,                // "Section 1"
    /^ধারা\s+১\b/m                      // Bengali: "ধারা ১" (Section 1)
  ]
};

// ============================================
// FAILURE REASON CONSTANTS
// Requirements: 3.1-3.9
// ============================================
const FAILURE_REASONS = {
  CONTAINER_NOT_FOUND: 'container_not_found',
  CONTENT_EMPTY: 'content_empty',
  CONTENT_BELOW_THRESHOLD: 'content_below_threshold',
  CONTENT_SELECTOR_MISMATCH: 'content_selector_mismatch', // Requirements: 3.8, 3.9 - Page rendered but no legal content anchors detected
  DOM_TIMEOUT: 'dom_timeout',           // Legacy - kept for backward compatibility
  DOM_NOT_READY: 'dom_not_ready',       // DOM never became interactive within timeout
  NETWORK_ERROR: 'network_error',
  NAVIGATION_ERROR: 'navigation_error',
  EXTRACTION_ERROR: 'extraction_error',
  UNKNOWN_ERROR: 'unknown_error'
};

// ============================================
// EXTRACTION STATUS CONSTANTS
// Requirements: 6.1
// ============================================
const EXTRACTION_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
  PROCESSING: 'processing',
  RETRYING: 'retrying'
};

const BDLawQueue = {
  // Expose constants for external access
  QUEUE_CONFIG_DEFAULTS,
  FAILURE_REASONS,
  EXTRACTION_STATUS,
  LEGAL_CONTENT_SIGNALS,
  /**
   * Extract volume number from URL
   * Requirements: 29.1, 29.2, 29.5
   * 
   * Parses the volume number from URLs matching the pattern /volume-{XX}.html
   * Returns "unknown" for non-volume URLs or invalid inputs.
   * 
   * @param {string} url - The URL to extract volume number from
   * @returns {string} The volume number or "unknown" if not found
   */
  extractVolumeNumber(url) {
    if (!url || typeof url !== 'string') return 'unknown';
    
    const match = url.match(/\/volume-(\d+)\.html/);
    return match ? match[1] : 'unknown';
  },

  /**
   * Check if an act with the given act_number already exists in the queue
   * Requirements: 27.1, 27.4 - Use act_number as unique identifier
   * 
   * @param {string} actNumber - The act number to check
   * @param {Array} queue - The queue array to check against
   * @returns {boolean} True if duplicate exists in queue, false otherwise
   */
  isDuplicateInQueue(actNumber, queue) {
    if (!actNumber || !Array.isArray(queue)) return false;
    return queue.some(q => q.actNumber === actNumber);
  },

  /**
   * Check if an act with the given act_number already exists in captured acts
   * 
   * @param {string} actNumber - The act number to check
   * @param {Array} capturedActs - The captured acts array to check against
   * @returns {boolean} True if already captured, false otherwise
   */
  isAlreadyCaptured(actNumber, capturedActs) {
    if (!actNumber || !Array.isArray(capturedActs)) return false;
    return capturedActs.some(c => c.actNumber === actNumber);
  },

  /**
   * Add acts from a volume to the queue with deduplication
   * Requirements: 27.1, 27.3, 27.5 - Skip duplicates and track count
   * 
   * @param {Array} acts - Array of acts to add
   * @param {Array} queue - Current queue array
   * @param {Array} capturedActs - Already captured acts array
   * @param {string} volumeNumber - Volume number for the acts
   * @returns {Object} Result with added acts, skipped counts, and updated queue
   */
  addActsToQueue(acts, queue, capturedActs, volumeNumber) {
    if (!Array.isArray(acts)) {
      return {
        added: 0,
        skippedInQueue: 0,
        skippedCaptured: 0,
        newQueue: queue || [],
        addedActs: []
      };
    }

    const newQueue = [...(queue || [])];
    const addedActs = [];
    let skippedInQueue = 0;
    let skippedCaptured = 0;

    for (const act of acts) {
      // Requirements: 27.1, 27.3 - Check for existing act_number before adding
      if (this.isDuplicateInQueue(act.actNumber, newQueue)) {
        skippedInQueue++;
        continue;
      }
      
      if (this.isAlreadyCaptured(act.actNumber, capturedActs)) {
        skippedCaptured++;
        continue;
      }

      const newItem = {
        id: Date.now() + '_' + act.actNumber,
        actNumber: act.actNumber,
        title: act.title,
        url: act.url,
        year: act.year,
        volumeNumber: volumeNumber,
        status: 'pending',
        addedAt: new Date().toISOString()
      };

      newQueue.push(newItem);
      addedActs.push(newItem);
    }

    return {
      added: addedActs.length,
      skippedInQueue,
      skippedCaptured,
      newQueue,
      addedActs
    };
  },

  /**
   * Add a single act to the queue with deduplication
   * Requirements: 27.1, 27.2 - Check for duplicates and return status
   * 
   * @param {Object} act - Act to add (must have actNumber)
   * @param {Array} queue - Current queue array
   * @param {Array} capturedActs - Already captured acts array
   * @returns {Object} Result with success status and reason if rejected
   */
  addSingleActToQueue(act, queue, capturedActs) {
    if (!act || !act.actNumber) {
      return {
        success: false,
        reason: 'invalid_act',
        message: 'Invalid act data'
      };
    }

    // Requirements: 27.1, 27.2 - Check for existing act_number before adding
    if (this.isDuplicateInQueue(act.actNumber, queue)) {
      return {
        success: false,
        reason: 'duplicate_in_queue',
        message: `Act ${act.actNumber} is already in the queue.`
      };
    }
    
    if (this.isAlreadyCaptured(act.actNumber, capturedActs)) {
      return {
        success: false,
        reason: 'already_captured',
        message: `Act ${act.actNumber} has already been captured.`
      };
    }

    const newItem = {
      id: Date.now() + '_' + act.actNumber,
      actNumber: act.actNumber,
      title: act.title || `Act ${act.actNumber}`,
      url: act.url,
      status: 'pending',
      addedAt: new Date().toISOString()
    };

    return {
      success: true,
      item: newItem,
      message: `Act ${act.actNumber} added to queue.`
    };
  },

  /**
   * Get unique act numbers from a queue
   * 
   * @param {Array} queue - The queue array
   * @returns {Array} Array of unique act numbers
   */
  getUniqueActNumbers(queue) {
    if (!Array.isArray(queue)) return [];
    return [...new Set(queue.map(q => q.actNumber).filter(Boolean))];
  },

  /**
   * Check if queue contains only unique act numbers
   * Requirements: 27.4 - Use act_number as unique identifier
   * 
   * @param {Array} queue - The queue array to check
   * @returns {boolean} True if all act numbers are unique
   */
  hasOnlyUniqueActNumbers(queue) {
    if (!Array.isArray(queue)) return true;
    const actNumbers = queue.map(q => q.actNumber).filter(Boolean);
    return actNumbers.length === new Set(actNumbers).size;
  },

  // ============================================
  // CORPUS EXPORT FORMATTING (DEPRECATED)
  // The combined corpus export is deprecated in favor of individual file exports.
  // These functions are kept for backward compatibility and testing.
  // 
  // METHODOLOGICAL PRINCIPLE: Corpus-stage extraction only.
  // - NO structured_sections (semantic interpretation)
  // - NO amendments classification (legal analysis)
  // - marker_frequency instead of sections_detected (honest naming)
  // ============================================

  /**
   * Format a single act for corpus export
   * METHODOLOGICAL PRINCIPLE: Corpus-stage extraction only.
   * 
   * @param {Object} act - The captured act object
   * @param {boolean} includeMetadata - Whether to include _metadata field
   * @returns {Object} Formatted act for corpus export
   */
  formatActForCorpusExport(act, includeMetadata = true) {
    if (!act || typeof act !== 'object') {
      return {
        act_number: '',
        title: '',
        content: '',
        url: '',
        volume_number: 'unknown',
        marker_frequency: { 'ধারা': 0, 'অধ্যায়': 0, 'তফসিল': 0 }
      };
    }

    const exportAct = {
      act_number: act.actNumber || act.act_number || '',
      title: act.title || '',
      content: act.content || '',
      url: act.url || '',
      // Requirements: 29.4 - volume_number SHALL never be null
      volume_number: act.volumeNumber || act.volume_number || 'unknown',
      // Renamed from sections_detected to marker_frequency
      // This is marker occurrence count, NOT structural section count
      marker_frequency: act.sections?.counts || act.marker_frequency || act.sections_detected || {
        'ধারা': 0,
        'অধ্যায়': 0,
        'তফসিল': 0
      }
      // REMOVED: structured_sections - semantic interpretation, not extraction
      // REMOVED: tables - requires structural inference
      // REMOVED: amendments - classification, not detection
      // These belong in Phase 2 post-processing, not corpus construction
    };

    if (includeMetadata && act.metadata) {
      // Add extracted_at timestamp if not present
      const metadata = { ...act.metadata };
      if (!metadata.extracted_at) {
        metadata.extracted_at = act.capturedAt || new Date().toISOString();
      }
      exportAct._metadata = metadata;
    }

    return exportAct;
  },

  /**
   * Format corpus export with all acts including failed extractions
   * METHODOLOGICAL PRINCIPLE: Corpus-stage extraction only.
   * Requirements: 6.5 - Do not skip or omit failed acts from exports
   * 
   * @param {Array} capturedActs - Array of captured act objects
   * @param {boolean} includeMetadata - Whether to include _metadata field for each act
   * @param {Array} failedExtractions - Array of failed extraction entries (optional)
   * @returns {Object} Complete corpus export object
   */
  formatCorpusExport(capturedActs, includeMetadata = true, failedExtractions = []) {
    const acts = Array.isArray(capturedActs) ? capturedActs : [];
    const failed = Array.isArray(failedExtractions) ? failedExtractions : [];

    // Format successful acts
    const successfulActs = acts.map(act => this.formatActForCorpusExport(act, includeMetadata));
    
    // Format failed acts - Requirements: 6.5 - Include failed acts in corpus export
    const failedActs = failed.map(failedEntry => this.formatFailedActForExport(failedEntry));

    // Combine all acts (successful + failed)
    const allActs = [...successfulActs, ...failedActs];

    return {
      _corpus_metadata: {
        name: 'BDLawCorpus Export',
        source: 'bdlaws.minlaw.gov.bd',
        exported_at: new Date().toISOString(),
        tool: 'BDLawCorpus Chrome Extension',
        total_acts: allActs.length,
        successful_acts: successfulActs.length,
        failed_acts: failedActs.length,
        research_purpose: 'academic legal corpus construction',
        disclaimer: 'This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed.',
        // Requirements: 6.5 - Honest reporting of failures
        failure_notice: failedActs.length > 0 
          ? `${failedActs.length} act(s) failed extraction after maximum retry attempts. These are included with extraction_status: "failed" and null content fields.`
          : null
      },
      acts: allActs
    };
  },

  /**
   * Validate corpus export structure
   * METHODOLOGICAL PRINCIPLE: Validates corpus-stage schema only.
   * Requirements: 6.5 - Validates both successful and failed acts
   * 
   * @param {Object} corpus - The corpus export object to validate
   * @returns {Object} Validation result with valid flag and errors array
   */
  validateCorpusExport(corpus) {
    const errors = [];

    if (!corpus || typeof corpus !== 'object') {
      return { valid: false, errors: ['Corpus is not an object'] };
    }

    if (!corpus._corpus_metadata) {
      errors.push('Missing _corpus_metadata');
    }

    if (!Array.isArray(corpus.acts)) {
      errors.push('acts is not an array');
      return { valid: false, errors };
    }

    corpus.acts.forEach((act, index) => {
      // Required fields for corpus-stage export
      if (typeof act.act_number !== 'string') {
        errors.push(`Act ${index}: act_number is not a string`);
      }

      if (typeof act.title !== 'string') {
        errors.push(`Act ${index}: title is not a string`);
      }

      // Check if this is a failed act (extraction_status: "failed")
      const isFailed = act.extraction_status === EXTRACTION_STATUS.FAILED;
      
      if (isFailed) {
        // Failed acts must have null content fields
        // Requirements: 6.6 - Failed acts SHALL NOT have inferred content
        if (act.content_raw !== null) {
          errors.push(`Act ${index}: failed act should have content_raw as null`);
        }
        
        // Failed acts must have failure_reason
        if (!act.failure_reason) {
          errors.push(`Act ${index}: failed act missing failure_reason`);
        }
        
        // Failed acts must have attempt tracking
        if (typeof act.attempts !== 'number') {
          errors.push(`Act ${index}: failed act missing attempts count`);
        }
      } else {
        // Successful acts must have content as string
        if (typeof act.content !== 'string') {
          errors.push(`Act ${index}: content is not a string`);
        }

        // marker_frequency must be an object for successful acts
        if (!act.marker_frequency || typeof act.marker_frequency !== 'object') {
          errors.push(`Act ${index}: marker_frequency is not an object`);
        }

        // Requirements: 29.4 - volume_number must not be null for successful acts
        if (act.volume_number === null || act.volume_number === undefined) {
          errors.push(`Act ${index}: volume_number is null or undefined`);
        }
      }
    });

    return { valid: errors.length === 0, errors };
  },

  // ============================================
  // QUEUE CONFIGURATION FUNCTIONS
  // Requirements: 1.1, 1.4, 1.5, 10.1-10.5
  // ============================================

  /**
   * Clamp value to range
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Get queue processing configuration
   * Requirements: 1.1, 1.5, 10.5
   * 
   * @param {Object} storage - Optional storage object (for testing), defaults to localStorage
   * @returns {Object} Current configuration with defaults applied
   */
  getQueueConfig(storage = null) {
    let stored = null;
    
    try {
      if (storage && typeof storage.getItem === 'function') {
        stored = storage.getItem('bdlaw_queue_config');
      } else if (typeof localStorage !== 'undefined') {
        stored = localStorage.getItem('bdlaw_queue_config');
      }
    } catch (e) {
      // localStorage not available (e.g., in Node.js tests)
      stored = null;
    }
    
    const config = stored ? JSON.parse(stored) : {};
    
    return {
      extraction_delay_ms: this.clamp(
        config.extraction_delay_ms ?? QUEUE_CONFIG_DEFAULTS.extraction_delay_ms,
        QUEUE_CONFIG_DEFAULTS.extraction_delay_min,
        QUEUE_CONFIG_DEFAULTS.extraction_delay_max
      ),
      minimum_content_threshold: this.clamp(
        config.minimum_content_threshold ?? QUEUE_CONFIG_DEFAULTS.minimum_content_threshold,
        QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_min,
        QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_max
      ),
      max_retry_attempts: this.clamp(
        config.max_retry_attempts ?? QUEUE_CONFIG_DEFAULTS.max_retry_attempts,
        QUEUE_CONFIG_DEFAULTS.max_retry_attempts_min,
        QUEUE_CONFIG_DEFAULTS.max_retry_attempts_max
      ),
      retry_base_delay_ms: this.clamp(
        config.retry_base_delay_ms ?? QUEUE_CONFIG_DEFAULTS.retry_base_delay_ms,
        QUEUE_CONFIG_DEFAULTS.retry_base_delay_min,
        QUEUE_CONFIG_DEFAULTS.retry_base_delay_max
      ),
      dom_readiness_timeout_ms: QUEUE_CONFIG_DEFAULTS.dom_readiness_timeout_ms
    };
  },

  /**
   * Save queue processing configuration
   * Requirements: 1.5, 10.5
   * 
   * @param {Object} config - Configuration to save
   * @param {Object} storage - Optional storage object (for testing), defaults to localStorage
   */
  saveQueueConfig(config, storage = null) {
    const configToSave = JSON.stringify(config);
    
    try {
      if (storage && typeof storage.setItem === 'function') {
        storage.setItem('bdlaw_queue_config', configToSave);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bdlaw_queue_config', configToSave);
      }
    } catch (e) {
      console.error('Failed to save queue config:', e);
    }
  },

  // ============================================
  // EXTRACTION VALIDATION
  // Requirements: 3.1, 3.2, 3.3, 3.6, 3.8, 3.9
  // ============================================

  /**
   * Validate extraction result
   * Requirements: 3.1, 3.2, 3.3, 3.6, 3.8, 3.9
   * 
   * @param {Object} result - Extraction result from content script
   * @param {number} minThreshold - Minimum content length (default: 100)
   * @param {Object} readinessResult - Result from waitForExtractionReadiness (optional)
   *   Used to distinguish CONTENT_SELECTOR_MISMATCH from CONTAINER_NOT_FOUND
   *   Requirements: 3.8, 3.9 - Distinguish selector mismatch from container not found
   * @returns {Object} { valid: boolean, reason?: string }
   */
  validateExtraction(result, minThreshold = 100, readinessResult = null) {
    // Check if extraction succeeded
    if (!result || !result.success) {
      return {
        valid: false,
        reason: result?.error || FAILURE_REASONS.EXTRACTION_ERROR
      };
    }
    
    // Check for content container - field must exist (even if empty string)
    const hasContentField = 'content' in result || 'content_raw' in result;
    if (!hasContentField) {
      // Requirements: 3.8, 3.9 - Distinguish between selector mismatch and container not found
      // If readinessResult indicates selector mismatch (page rendered but no legal content anchors),
      // use CONTENT_SELECTOR_MISMATCH instead of CONTAINER_NOT_FOUND
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
  },

  // ============================================
  // FAILED EXTRACTION TRACKING
  // Requirements: 4.1, 4.2, 5.2, 5.3, 5.5, 5.7
  // ============================================

  /**
   * Add failed extraction to tracking
   * Requirements: 4.1, 4.2, 5.7
   * 
   * @param {Array} failedExtractions - Current failed extractions list
   * @param {Object} item - Queue item that failed
   *   - id: Queue item ID
   *   - actNumber: Act number
   *   - url: Act URL
   *   - title: Act title
   *   - selector_strategy: (optional) Selector strategy used for this attempt (Requirements: 5.7)
   * @param {string} reason - Failure reason
   * @param {number} attemptNumber - Current attempt number (default: 1)
   * @param {number} maxRetries - Maximum retry attempts (default: 3)
   * @returns {Array} Updated failed extractions list
   */
  addFailedExtraction(failedExtractions, item, reason, attemptNumber = 1, maxRetries = 3) {
    const list = Array.isArray(failedExtractions) ? [...failedExtractions] : [];
    const existing = list.find(f => f.act_id === item.id);
    
    // Requirements: 5.7 - Record which selector set was used per attempt
    const attemptEntry = {
      attempt_number: attemptNumber,
      timestamp: new Date().toISOString(),
      reason: reason,
      outcome: 'failed',
      // Requirements: 5.7 - Include selector strategy in attempt history
      selector_strategy: item.selector_strategy || 'standard_selectors'
    };
    
    if (existing) {
      // Update existing entry
      existing.retry_count = attemptNumber;
      existing.failure_reason = reason;
      existing.failed_at = new Date().toISOString();
      existing.attempts.push(attemptEntry);
      return list;
    }
    
    // Create new entry
    const newEntry = {
      act_id: item.id,
      act_number: item.actNumber,
      url: item.url,
      title: item.title,
      failure_reason: reason,
      retry_count: attemptNumber,
      max_retries: maxRetries,
      failed_at: new Date().toISOString(),
      attempts: [attemptEntry]
    };
    
    return [...list, newEntry];
  },

  /**
   * Check if extraction should be retried
   * Requirements: 5.2, 5.5
   * 
   * RETRY POLICY:
   * - ONLY retry content_selector_mismatch (recoverable with broader selectors)
   * - Do NOT retry: network_error, dom_not_ready, dom_timeout, error pages
   * 
   * @param {Object} failedEntry - Failed extraction entry
   * @returns {boolean} True if retry is allowed
   */
  shouldRetry(failedEntry) {
    if (!failedEntry) return false;
    
    // Check retry count limit
    if (failedEntry.retry_count >= failedEntry.max_retries) return false;
    
    // ONLY retry content_selector_mismatch - other failures are not recoverable
    const retryableReasons = [
      FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
      FAILURE_REASONS.CONTAINER_NOT_FOUND  // Legacy - treat as selector mismatch
    ];
    
    return retryableReasons.includes(failedEntry.failure_reason);
  },

  /**
   * Calculate retry delay with exponential backoff
   * Requirements: 5.3
   * 
   * @param {number} retryCount - Current retry count (1-based)
   * @param {number} baseDelay - Base delay in milliseconds (default: 5000)
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(retryCount, baseDelay = 5000) {
    // Exponential backoff: base_delay * 2^(retry_count - 1)
    return baseDelay * Math.pow(2, Math.max(0, retryCount - 1));
  },

  // ============================================
  // FAILED ACT EXPORT FORMAT
  // Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
  // ============================================

  // ============================================
  // BROADER SELECTOR RETRY STRATEGY
  // Requirements: 5.7, 5.8, 5.9, 5.10
  // ============================================

  /**
   * Standard content selectors used for initial extraction attempts
   * These are the primary selectors that match the expected DOM structure
   */
  STANDARD_CONTENT_SELECTORS: [
    '.boxed-layout',           // Primary container for structured extraction
    '#lawContent',
    '.law-content',
    '.act-details',
    '.act-content',
    '.law-body',
    '.card-body',
    '.content-body',
    '#act-content',
    '.act-text',
    '.law-text'
  ],

  /**
   * Broader content selectors for retry attempts
   * Requirements: 5.8 - Return expanded selector set for retry attempts
   * 
   * These fallback selectors are used when standard selectors fail.
   * They include generic HTML5 semantic elements that may contain legal content
   * in heterogeneous DOM layouts.
   * 
   * INTEGRITY CONSTRAINTS (Requirements: 5.9, 5.10):
   * - Never infer missing text
   * - Never downgrade research integrity rules
   * - Only expand WHERE to look, not HOW to extract
   * 
   * @returns {Object} Object containing standard and broader selector arrays
   */
  getBroaderContentSelectors() {
    return {
      // Standard selectors (used for initial attempts)
      standard: this.STANDARD_CONTENT_SELECTORS,
      
      // Broader selectors (used for retry attempts)
      // Requirements: 5.8 - Include fallback selectors: main, article, body
      broader: [
        // First, try all standard selectors
        ...this.STANDARD_CONTENT_SELECTORS,
        
        // Then try generic semantic containers
        'article',
        '.article-content',
        'main',
        '.main-content',
        
        // Finally, try body as last resort
        // Note: body extraction still uses textContent only (Requirement 9.4)
        'body'
      ],
      
      // Metadata for logging
      _meta: {
        standard_count: this.STANDARD_CONTENT_SELECTORS.length,
        broader_count: this.STANDARD_CONTENT_SELECTORS.length + 4, // +4 for article, .article-content, main, .main-content, body
        fallback_selectors: ['article', '.article-content', 'main', '.main-content', 'body'],
        integrity_note: 'Broader selectors expand WHERE to look, not HOW to extract. textContent-only extraction is preserved.'
      }
    };
  },

  /**
   * Get selector strategy label for logging
   * Requirements: 5.7 - Record which selector set was used
   * 
   * @param {boolean} useBroader - Whether broader selectors were used
   * @returns {string} Strategy label for logging
   */
  getSelectorStrategyLabel(useBroader) {
    return useBroader ? 'broader_selectors' : 'standard_selectors';
  },

  /**
   * Format failed act for export
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 5.7
   * 
   * @param {Object} failedEntry - Failed extraction entry
   * @returns {Object} Export-ready failed act object
   */
  formatFailedActForExport(failedEntry) {
    if (!failedEntry) {
      return {
        act_number: '',
        title: '',
        url: '',
        extraction_status: EXTRACTION_STATUS.FAILED,
        failure_reason: FAILURE_REASONS.UNKNOWN_ERROR,
        attempts: 0,
        attempt_history: [],
        content_raw: null,
        content_normalized: null,
        content_corrected: null,
        _metadata: {}
      };
    }
    
    // Requirements: 5.7 - Extract selector strategies used across all attempts
    const selectorStrategiesUsed = (failedEntry.attempts || [])
      .map(a => a.selector_strategy)
      .filter(Boolean);
    const uniqueStrategies = [...new Set(selectorStrategiesUsed)];
    
    return {
      act_number: failedEntry.act_number || '',
      title: failedEntry.title || '',
      url: failedEntry.url || '',
      
      // Extraction status - clearly marked as failed
      extraction_status: EXTRACTION_STATUS.FAILED,
      failure_reason: failedEntry.failure_reason,
      
      // Attempt tracking
      // Requirements: 5.7 - Include selector strategy in attempt history
      attempts: failedEntry.attempts?.length || 0,
      attempt_history: failedEntry.attempts || [],
      
      // No content - never infer or auto-correct
      content_raw: null,
      content_normalized: null,
      content_corrected: null,
      
      // Metadata
      _metadata: {
        first_attempt_at: failedEntry.attempts?.[0]?.timestamp || null,
        last_attempt_at: failedEntry.failed_at,
        total_attempts: failedEntry.attempts?.length || 0,
        max_retries_reached: failedEntry.retry_count >= failedEntry.max_retries,
        extraction_status: EXTRACTION_STATUS.FAILED,
        failure_reason: failedEntry.failure_reason,
        // Requirements: 5.7 - Record selector strategies used
        selector_strategies_used: uniqueStrategies,
        used_broader_selectors: uniqueStrategies.includes('broader_selectors')
      }
    };
  }
};

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawQueue;
}
