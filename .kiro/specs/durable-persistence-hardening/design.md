# Design Document: Durable Persistence Hardening

## Overview

This design addresses critical data loss issues in the BDLawCorpus Chrome extension by implementing a robust, crash-safe persistence layer. The core insight is that the current system treats in-memory state as authoritative, leading to data loss when the side panel closes or the browser restarts.

The solution introduces:
1. **Storage Abstraction Layer** - Unified interface supporting IndexedDB, chrome.storage, and memory fallback
2. **Extraction Receipt System** - Append-only log proving each act was durably persisted
3. **Queue Reconstruction** - Deriving state from authoritative receipts, not counters
4. **Write-Ahead Logging** - Tracking extraction intent for crash recovery

### Design Principles

- **Durability over throughput**: Slower extraction is acceptable if it guarantees no data loss
- **Append-only for audit**: Receipts and logs are never modified, only appended
- **Fail-safe defaults**: If uncertain, pause and ask user rather than proceed and lose data
- **Reconstructible state**: Any state can be rebuilt from authoritative sources

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Side Panel UI                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Queue View  │  │ Export View │  │ Status Bar  │  │ Settings    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
└─────────┼────────────────┼────────────────┼────────────────┼────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Persistence Controller                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ Queue Manager   │  │ Export Manager  │  │ State Reconstructor │  │
│  │ - processQueue  │  │ - exportActs    │  │ - rebuildFromReceipts│ │
│  │ - markComplete  │  │ - trackProgress │  │ - resolveConflicts  │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
└───────────┼────────────────────┼─────────────────────┼──────────────┘
            │                    │                     │
            ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Storage Abstraction Layer                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    StorageManager                            │    │
│  │  - saveAct(act) → Promise<Receipt>                          │    │
│  │  - loadAct(actId) → Promise<Act>                            │    │
│  │  - getReceipts() → Promise<Receipt[]>                       │    │
│  │  - logIntent(actId) → Promise<void>                         │    │
│  │  - getStorageStatus() → { backend, usage, quota }           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                 │
│         ▼                    ▼                    ▼                 │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐         │
│  │ IndexedDB   │      │ Chrome      │      │ Memory      │         │
│  │ Backend     │      │ Storage     │      │ Backend     │         │
│  │ (primary)   │      │ Backend     │      │ (fallback)  │         │
│  └─────────────┘      └─────────────┘      └─────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. StorageManager (Core Abstraction)

The `StorageManager` provides a unified interface for all storage operations, abstracting away the underlying backend.

```javascript
/**
 * Storage Manager - Unified persistence interface
 * Handles backend selection, fallback, and atomic operations
 */
const StorageManager = {
  // Current active backend
  _activeBackend: null,  // 'indexeddb' | 'chrome_storage' | 'memory'
  
  // Backend priority order
  BACKEND_PRIORITY: ['indexeddb', 'chrome_storage', 'memory'],
  
  /**
   * Initialize storage manager, selecting best available backend
   * @returns {Promise<{backend: string, migrated: boolean}>}
   */
  async initialize() { /* ... */ },
  
  /**
   * Save an act with atomic write and receipt generation
   * @param {Object} act - The act to save
   * @returns {Promise<ExtractionReceipt>}
   * @throws {StorageError} if write fails
   */
  async saveAct(act) { /* ... */ },
  
  /**
   * Load an act by ID
   * @param {string} actId - The act_number
   * @returns {Promise<Object|null>}
   */
  async loadAct(actId) { /* ... */ },
  
  /**
   * Get all extraction receipts (append-only log)
   * @returns {Promise<ExtractionReceipt[]>}
   */
  async getReceipts() { /* ... */ },
  
  /**
   * Log extraction intent (write-ahead log)
   * @param {string} actId
   * @returns {Promise<void>}
   */
  async logIntent(actId) { /* ... */ },
  
  /**
   * Mark extraction complete (write-ahead log)
   * @param {string} actId
   * @param {string} contentHash
   * @returns {Promise<void>}
   */
  async logComplete(actId, contentHash) { /* ... */ },
  
  /**
   * Get current storage status
   * @returns {Promise<{backend: string, usageBytes: number, quotaBytes: number, usagePercent: number}>}
   */
  async getStorageStatus() { /* ... */ },
  
  /**
   * Get incomplete extractions (intent logged but not complete)
   * @returns {Promise<{actId: string, timestamp: string}[]>}
   */
  async getIncompleteExtractions() { /* ... */ }
};
```

### 2. ExtractionReceipt Schema

```javascript
/**
 * Extraction Receipt - Immutable proof of durable persistence
 * Canonical schema as defined in requirements glossary
 */
const ExtractionReceipt = {
  receipt_id: 'uuid-v4',           // Unique receipt identifier
  act_id: 'string',                // The act_number
  content_raw_sha256: 'hex',       // SHA-256 hash of content_raw
  storage_backend: 'indexeddb',    // 'indexeddb' | 'chrome_storage' | 'memory'
  persisted_at: 'ISO-8601',        // Timestamp of successful persistence
  schema_version: '3.1'            // Schema version for forward compatibility
};
```

### 3. IndexedDB Schema

```javascript
/**
 * IndexedDB Database Schema
 * Database name: 'BDLawCorpusDB'
 * Version: 1
 */
const IDB_SCHEMA = {
  // Object store for captured acts
  acts: {
    keyPath: 'act_number',
    indexes: [
      { name: 'by_volume', keyPath: 'volume_number' },
      { name: 'by_captured_at', keyPath: 'capturedAt' },
      { name: 'by_content_hash', keyPath: 'content_raw_sha256' }
    ]
  },
  
  // Object store for extraction receipts (append-only)
  receipts: {
    keyPath: 'receipt_id',
    indexes: [
      { name: 'by_act_id', keyPath: 'act_id' },
      { name: 'by_persisted_at', keyPath: 'persisted_at' }
    ]
  },
  
  // Object store for write-ahead log
  wal: {
    keyPath: 'entry_id',
    indexes: [
      { name: 'by_act_id', keyPath: 'act_id' },
      { name: 'by_type', keyPath: 'entry_type' },  // 'intent' | 'complete'
      { name: 'by_timestamp', keyPath: 'timestamp' }
    ]
  },
  
  // Object store for audit log
  audit_log: {
    keyPath: 'log_id',
    autoIncrement: true,
    indexes: [
      { name: 'by_timestamp', keyPath: 'timestamp' },
      { name: 'by_operation', keyPath: 'operation' }
    ]
  }
};
```

### 4. Queue State Reconstructor

```javascript
/**
 * Queue State Reconstructor
 * Derives queue state from authoritative sources (receipts)
 * Never trusts stored counters
 */
const QueueReconstructor = {
  /**
   * Reconstruct queue state from receipts and queue items
   * @param {Object[]} queueItems - Items added to queue
   * @param {ExtractionReceipt[]} receipts - Extraction receipts
   * @returns {{pending: Object[], completed: string[], discrepancies: Object[]}}
   */
  reconstructState(queueItems, receipts) {
    const extractedActIds = new Set(receipts.map(r => r.act_id));
    
    const pending = queueItems.filter(item => !extractedActIds.has(item.actNumber));
    const completed = Array.from(extractedActIds);
    
    // Detect discrepancies (items marked done but no receipt)
    const discrepancies = queueItems
      .filter(item => item.status === 'completed' && !extractedActIds.has(item.actNumber))
      .map(item => ({
        actNumber: item.actNumber,
        issue: 'marked_complete_no_receipt',
        resolution: 'reset_to_pending'
      }));
    
    return { pending, completed, discrepancies };
  }
};
```

### 5. Storage Error Types

```javascript
/**
 * Storage Error Classification
 * Enables specific error handling and user messaging
 */
const StorageErrorType = {
  QUOTA_EXCEEDED: 'quota_exceeded',
  PERMISSION_DENIED: 'permission_denied',
  BACKEND_UNAVAILABLE: 'backend_unavailable',
  TRANSACTION_FAILED: 'transaction_failed',
  INTEGRITY_ERROR: 'integrity_error',
  UNKNOWN_ERROR: 'unknown_error'
};

class StorageError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}
```

## Data Models

### Act Storage Record

```javascript
/**
 * Act record as stored in IndexedDB
 * Extends the extraction result with persistence metadata
 */
const ActStorageRecord = {
  // Primary key
  act_number: 'string',
  
  // Content (immutable after extraction)
  content_raw: 'string',
  content_raw_sha256: 'hex',
  title: 'string',
  
  // Provenance
  url: 'string',
  volume_number: 'string',
  capturedAt: 'ISO-8601',
  
  // Extraction metadata
  sections: { /* marker counts */ },
  structured_sections: [ /* ... */ ],
  tables: [ /* ... */ ],
  amendments: [ /* ... */ ],
  
  // Persistence metadata
  _persistence: {
    receipt_id: 'uuid',
    storage_backend: 'indexeddb',
    persisted_at: 'ISO-8601',
    schema_version: '3.1',
    integrity_verified: true,
    last_verified_at: 'ISO-8601'
  }
};
```

### Write-Ahead Log Entry

```javascript
/**
 * Write-Ahead Log Entry
 * Tracks extraction intent and completion for crash recovery
 */
const WALEntry = {
  entry_id: 'uuid',
  act_id: 'string',
  entry_type: 'intent' | 'complete',
  timestamp: 'ISO-8601',
  
  // Only for 'complete' entries
  content_hash: 'hex | null',
  
  // Metadata
  session_id: 'string',  // Identifies the extraction session
  pruned: false          // Marked true when safely pruned
};
```

### Storage Status

```javascript
/**
 * Storage Status for UI display and quota management
 */
const StorageStatus = {
  backend: 'indexeddb' | 'chrome_storage' | 'memory',
  usageBytes: 0,
  quotaBytes: 0,
  usagePercent: 0,
  
  // Thresholds
  warningThreshold: 80,   // Show warning at 80%
  criticalThreshold: 95,  // Pause processing at 95%
  
  // Counts
  actCount: 0,
  receiptCount: 0,
  walEntryCount: 0,
  
  // Health
  isHealthy: true,
  degradedMode: false,
  lastError: null
};
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified. These properties are universally quantified and will be validated using property-based testing.

### Property 1: Persist-Before-Done Invariant

*For any* act marked as "completed" in the queue, there SHALL exist a corresponding extraction_receipt with a `persisted_at` timestamp that is earlier than or equal to the time the act was marked complete.

**Validates: Requirements 1.1, 1.3**

### Property 2: Atomic Write Consistency

*For any* write operation that fails (throws an error or returns failure), the act SHALL NOT appear in the receipts log AND the act SHALL NOT be marked as "completed" in the queue.

**Validates: Requirements 1.2, 1.3**

### Property 3: Receipt Completeness

*For any* extraction_receipt in the receipts log, it SHALL contain all required fields: `receipt_id` (non-empty string), `act_id` (non-empty string), `content_raw_sha256` (valid hex string), `storage_backend` (one of 'indexeddb', 'chrome_storage', 'memory'), `persisted_at` (valid ISO-8601 timestamp), and `schema_version` (non-empty string).

**Validates: Requirements 1.4**

### Property 4: Receipts Append-Only

*For any* sequence of operations on the receipts log, the count of receipts SHALL only increase or stay the same, never decrease. Additionally, *for any* receipt that exists at time T, that same receipt (with identical fields) SHALL exist at all times T' > T.

**Validates: Requirements 1.5**

### Property 5: Receipt Round-Trip

*For any* act that is successfully saved via `saveAct()`, immediately reading back the receipt via `getReceipts()` SHALL return a receipt with matching `act_id` and `content_raw_sha256`.

**Validates: Requirements 1.6**

### Property 6: Storage Threshold Behavior

*For any* storage state where `usagePercent >= 80`, the system SHALL set `warningDisplayed = true`. *For any* storage state where `usagePercent >= 95`, the system SHALL set `processingPaused = true` AND `exportPromptDisplayed = true`.

**Validates: Requirements 2.2, 2.3, 2.6**

### Property 7: Migration Round-Trip

*For any* act stored in chrome.storage.local before migration, after calling `migrate()`, the act SHALL be retrievable from IndexedDB with identical `content_raw` and `content_raw_sha256`.

**Validates: Requirements 3.3**

### Property 8: Act Lookup by Key

*For any* act stored via `saveAct(act)`, calling `loadAct(act.act_number)` SHALL return an object with identical `content_raw`, `title`, and `act_number` fields.

**Validates: Requirements 3.5**

### Property 9: Fallback Chain Order

*For any* initialization sequence, the system SHALL attempt backends in order: IndexedDB first, then chrome.storage.local if IndexedDB fails, then memory if chrome.storage.local fails. The active backend SHALL be the first available backend in this order.

**Validates: Requirements 3.7, 10.1, 10.2, 10.7**

### Property 10: Queue Reconstruction Correctness

*For any* set of queue items Q and extraction receipts R, the reconstructed pending count SHALL equal `|Q| - |{q ∈ Q : q.actNumber ∈ R.act_ids}|`. Additionally, *for any* item marked "completed" in Q but not in R.act_ids, the reconstructor SHALL flag it as a discrepancy and reset it to "pending".

**Validates: Requirements 4.1, 4.3, 4.4, 4.5, 4.6**

### Property 11: Processing Status Reset on Reload

*For any* queue state loaded from storage, there SHALL be zero items with `status === 'processing'`. All such items SHALL have been reset to `status === 'pending'`.

**Validates: Requirements 5.6**

### Property 12: Write-Ahead Log Integrity

*For any* extraction that starts, an intent entry SHALL exist in the WAL before extraction begins. *For any* extraction that completes successfully, a complete entry SHALL exist in the WAL with matching `act_id` and `content_hash`. *For any* act with an intent entry but no complete entry, it SHALL be identified as an incomplete extraction.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 13: Error Classification Accuracy

*For any* storage error, the system SHALL classify it as exactly one of: `quota_exceeded`, `permission_denied`, `backend_unavailable`, `transaction_failed`, `integrity_error`, or `unknown_error`. The classification SHALL be logged with the error context.

**Validates: Requirements 7.3, 7.4**

### Property 14: Export Checkpoint Triggering

*For any* extraction sequence, when `acts_since_export >= N` (where N is the configured threshold), the system SHALL set `exportPromptDisplayed = true`. After user dismisses the prompt, the counter SHALL reset, and the prompt SHALL reappear after another N extractions.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 15: Export Threshold Configuration

*For any* attempt to set the export checkpoint threshold, values less than 10 SHALL be rejected (clamped to 10), and values greater than 200 SHALL be rejected (clamped to 200).

**Validates: Requirements 8.7**

### Property 16: Audit Log Append-Only

*For any* sequence of operations on the audit log, the count of entries SHALL only increase or stay the same, never decrease. Existing entries SHALL never be modified.

**Validates: Requirements 9.1, 9.6**

### Property 17: Audit Log Entry Completeness

*For any* entry in the audit log, it SHALL contain: `log_id`, `timestamp` (valid ISO-8601), `operation` (one of defined operation types), and appropriate context fields based on operation type.

**Validates: Requirements 9.2, 9.3**

### Property 18: Content Hash Verification

*For any* act loaded from storage, computing SHA-256 of `content_raw` SHALL equal the stored `content_raw_sha256`. If they differ, the act SHALL be flagged as `potentially_corrupted` and SHALL NOT be served without warning.

**Validates: Requirements 11.1, 11.2, 11.3**

### Property 19: Export Progress Tracking

*For any* batch export of N acts, the progress SHALL update N times (once per act). If export is interrupted at act K, resuming SHALL start from act K (not from the beginning).

**Validates: Requirements 12.1, 12.2, 12.3**

### Property 20: Export Rate Limiting

*For any* batch export, the time between consecutive file downloads SHALL be at least the configured rate limit delay (default: 500ms).

**Validates: Requirements 12.5**

## Error Handling

### Storage Error Recovery

```javascript
/**
 * Error handling strategy for storage operations
 */
const ErrorRecoveryStrategy = {
  quota_exceeded: {
    action: 'pause_and_prompt',
    message: 'Storage quota exceeded. Please export your data to free up space.',
    retryable: false,
    fallback: 'prompt_export'
  },
  
  permission_denied: {
    action: 'switch_backend',
    message: 'Storage permission denied. Switching to fallback storage.',
    retryable: false,
    fallback: 'next_backend'
  },
  
  backend_unavailable: {
    action: 'switch_backend',
    message: 'Primary storage unavailable. Using fallback storage.',
    retryable: false,
    fallback: 'next_backend'
  },
  
  transaction_failed: {
    action: 'retry_with_backoff',
    message: 'Storage transaction failed. Retrying...',
    retryable: true,
    maxRetries: 3,
    backoffMs: 1000
  },
  
  integrity_error: {
    action: 'flag_and_warn',
    message: 'Data integrity error detected. Act may be corrupted.',
    retryable: false,
    fallback: 'offer_re_extract'
  },
  
  unknown_error: {
    action: 'log_and_pause',
    message: 'Unknown storage error. Processing paused for safety.',
    retryable: false,
    fallback: 'manual_export'
  }
};
```

### Lifecycle Error Handling

```javascript
/**
 * Side panel lifecycle error handling
 */
const LifecycleErrorHandling = {
  // Before unload - attempt to save state
  beforeUnload: async () => {
    if (state.isProcessing) {
      // Flush pending writes
      await StorageManager.flushPendingWrites();
      // Save processing state
      await StorageManager.saveProcessingState({
        isProcessing: true,
        currentActId: state.currentActId,
        timestamp: new Date().toISOString()
      });
    }
  },
  
  // On load - detect and recover from interruption
  onLoad: async () => {
    const processingState = await StorageManager.loadProcessingState();
    if (processingState?.isProcessing) {
      // Offer to resume
      return {
        interrupted: true,
        lastActId: processingState.currentActId,
        timestamp: processingState.timestamp
      };
    }
    return { interrupted: false };
  }
};
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests:

1. **Unit Tests**: Verify specific examples, edge cases, and error conditions
2. **Property Tests**: Verify universal properties across all inputs using fast-check

### Property-Based Testing Configuration

- **Library**: fast-check (JavaScript property-based testing library)
- **Minimum iterations**: 100 per property test
- **Shrinking**: Enabled for counterexample minimization

### Test Organization

```
tests/
├── property/
│   ├── storage-atomicity.property.test.js      # Properties 1, 2
│   ├── receipt-integrity.property.test.js      # Properties 3, 4, 5
│   ├── storage-thresholds.property.test.js     # Property 6
│   ├── migration-roundtrip.property.test.js    # Property 7
│   ├── act-persistence.property.test.js        # Property 8
│   ├── fallback-chain.property.test.js         # Property 9
│   ├── queue-reconstruction.property.test.js   # Properties 10, 11
│   ├── wal-integrity.property.test.js          # Property 12
│   ├── error-classification.property.test.js   # Property 13
│   ├── export-checkpoint.property.test.js      # Properties 14, 15
│   ├── audit-log.property.test.js              # Properties 16, 17
│   ├── content-hash.property.test.js           # Property 18
│   └── export-progress.property.test.js        # Properties 19, 20
├── unit/
│   ├── storage-manager.test.js
│   ├── indexeddb-backend.test.js
│   ├── chrome-storage-backend.test.js
│   ├── queue-reconstructor.test.js
│   └── error-handler.test.js
└── integration/
    ├── lifecycle-recovery.test.js
    └── full-extraction-flow.test.js
```

### Generator Strategies

```javascript
// Act generator for property tests
const actGenerator = fc.record({
  act_number: fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 6 }),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  content_raw: fc.string({ minLength: 100, maxLength: 50000 }),
  url: fc.webUrl(),
  volume_number: fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 3 }),
  capturedAt: fc.date().map(d => d.toISOString())
});

// Receipt generator
const receiptGenerator = fc.record({
  receipt_id: fc.uuid(),
  act_id: fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 6 }),
  content_raw_sha256: fc.hexaString({ minLength: 64, maxLength: 64 }),
  storage_backend: fc.constantFrom('indexeddb', 'chrome_storage', 'memory'),
  persisted_at: fc.date().map(d => d.toISOString()),
  schema_version: fc.constant('3.1')
});

// Storage state generator for threshold tests
const storageStateGenerator = fc.record({
  usageBytes: fc.integer({ min: 0, max: 10 * 1024 * 1024 }),
  quotaBytes: fc.constant(10 * 1024 * 1024)
}).map(s => ({ ...s, usagePercent: (s.usageBytes / s.quotaBytes) * 100 }));
```

## Implementation Notes

### IndexedDB Transaction Patterns

```javascript
/**
 * Safe IndexedDB transaction wrapper
 * Ensures atomic operations with proper error handling
 */
async function withTransaction(storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], mode);
    const store = transaction.objectStore(storeName);
    
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(new StorageError(
      StorageErrorType.TRANSACTION_FAILED,
      `Transaction failed: ${transaction.error?.message}`,
      { storeName, mode }
    ));
    transaction.onabort = () => reject(new StorageError(
      StorageErrorType.TRANSACTION_FAILED,
      `Transaction aborted: ${transaction.error?.message}`,
      { storeName, mode }
    ));
    
    let result;
    try {
      result = operation(store);
    } catch (e) {
      transaction.abort();
      reject(e);
    }
  });
}
```

### Chrome Storage Quota Monitoring

```javascript
/**
 * Monitor chrome.storage.local quota
 * Returns usage information for threshold checks
 */
async function getStorageQuotaInfo() {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
      // chrome.storage.local quota is typically 10MB for extensions
      const quotaBytes = 10 * 1024 * 1024;
      resolve({
        usageBytes: bytesInUse,
        quotaBytes: quotaBytes,
        usagePercent: (bytesInUse / quotaBytes) * 100
      });
    });
  });
}
```

### Migration Strategy

```javascript
/**
 * Migration from chrome.storage.local to IndexedDB
 * Preserves all data with integrity verification
 */
async function migrateToIndexedDB() {
  // 1. Load all acts from chrome.storage.local
  const chromeData = await chrome.storage.local.get(['bdlaw_captured_acts']);
  const acts = chromeData.bdlaw_captured_acts || [];
  
  if (acts.length === 0) {
    return { migrated: 0, skipped: 0 };
  }
  
  // 2. Migrate each act to IndexedDB with receipt generation
  let migrated = 0;
  let skipped = 0;
  
  for (const act of acts) {
    try {
      // Check if already migrated (receipt exists)
      const existingReceipt = await getReceiptByActId(act.actNumber);
      if (existingReceipt) {
        skipped++;
        continue;
      }
      
      // Save to IndexedDB
      await saveActToIndexedDB(act);
      
      // Generate receipt
      const receipt = await generateReceipt(act);
      await saveReceipt(receipt);
      
      migrated++;
    } catch (e) {
      console.error(`Migration failed for act ${act.actNumber}:`, e);
      // Continue with other acts
    }
  }
  
  // 3. Verify migration
  const idbCount = await getActCountFromIndexedDB();
  if (idbCount >= migrated) {
    // Safe to clear chrome.storage.local acts (keep config)
    // But don't clear yet - keep as backup until user confirms
  }
  
  return { migrated, skipped };
}
```

