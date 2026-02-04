# Storage API Documentation

## Overview

The BDLawCorpus Storage API provides durable persistence for extracted acts with crash-safe guarantees. It implements a multi-backend storage system with automatic fallback, extraction receipts for verification, and write-ahead logging for crash recovery.

## Architecture

```
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

## Core Components

### StorageManager

The main interface for all storage operations.

#### Initialization

```javascript
// Initialize storage with automatic backend selection
const result = await StorageManager.initialize();
// Returns: { backend: 'indexeddb', migrated: boolean, degraded: boolean }
```

#### Saving Acts

```javascript
// Save an act with atomic persistence and receipt generation
const receipt = await StorageManager.saveAct({
  act_number: '1514',
  content_raw: 'Full text content...',
  title: 'বাংলাদেশ শ্রম আইন, ২০০৬',
  url: 'http://bdlaws.minlaw.gov.bd/act-details-1514.html',
  volume_number: '56',
  capturedAt: new Date().toISOString()
});
// Returns: ExtractionReceipt
```

#### Loading Acts

```javascript
// Load an act by ID with integrity verification
const act = await StorageManager.loadActFromIndexedDB('1514');
// Returns: Act object with _persistence metadata

// Load all acts from IndexedDB
const allActs = await StorageManager.getAllActs();
// Returns: Array of all act objects
```

#### Write-Ahead Logging

```javascript
// Log extraction intent before starting
await StorageManager.logIntent('1514');

// Log completion after successful extraction
await StorageManager.logComplete('1514', contentHash);

// Get incomplete extractions for retry
const incomplete = await StorageManager.getIncompleteExtractions();
// Returns: [{ actId, timestamp, entryId }]
```

### ExtractionReceipt

Immutable proof of durable persistence.

```javascript
{
  receipt_id: 'uuid-v4',           // Unique receipt identifier
  act_id: 'string',                // The act_number
  content_raw_sha256: 'hex',       // SHA-256 hash of content_raw
  storage_backend: 'indexeddb',    // 'indexeddb' | 'chrome_storage' | 'memory'
  persisted_at: 'ISO-8601',        // Timestamp of successful persistence
  schema_version: '3.1'            // Schema version for forward compatibility
}
```

### QueueReconstructor

Derives queue state from authoritative receipts.

```javascript
// Reconstruct queue state from receipts
const result = QueueReconstructor.reconstructState(queueItems, receipts);
// Returns: { pending, completed, discrepancies, stats }

// Reset processing items to pending on reload
const resetResult = QueueReconstructor.resetProcessingStatus(queueItems);
// Returns: { items, resetCount, resetItems }

// Full reconstruction with reset
const fullResult = QueueReconstructor.fullReconstruction(queueItems, receipts);
```

## Error Handling

### StorageError Types

```javascript
const StorageErrorType = {
  QUOTA_EXCEEDED: 'quota_exceeded',
  PERMISSION_DENIED: 'permission_denied',
  BACKEND_UNAVAILABLE: 'backend_unavailable',
  TRANSACTION_FAILED: 'transaction_failed',
  INTEGRITY_ERROR: 'integrity_error',
  UNKNOWN_ERROR: 'unknown_error'
};
```

### Error Classification

```javascript
// Classify a raw error
const type = classifyStorageError(error);

// Create a StorageError with context
const storageError = createStorageError(error, {
  operation: 'saveAct',
  actNumber: '1514'
});
```

### Recovery Strategies

| Error Type | Action | Retryable |
|------------|--------|-----------|
| quota_exceeded | Pause and prompt export | No |
| permission_denied | Switch backend | No |
| backend_unavailable | Switch backend | No |
| transaction_failed | Retry with backoff | Yes (3 attempts) |
| integrity_error | Flag and warn | No |
| unknown_error | Log and pause | No |

## Storage Quota Management

### Thresholds

- **Warning**: 80% usage - Display warning to user
- **Critical**: 95% usage - Pause processing, prompt export

### Monitoring

```javascript
// Get current storage status
const status = await StorageManager.getStorageStatus();
// Returns: {
//   backend: 'indexeddb',
//   usageBytes: number,
//   quotaBytes: number,
//   usagePercent: number,
//   isWarning: boolean,
//   isCritical: boolean,
//   isHealthy: boolean
// }

// Check quota before write
const check = await StorageManager.checkQuotaBeforeWrite();
// Throws StorageError if critical threshold exceeded
```


## Migration

### Automatic Migration

Migration from chrome.storage.local to IndexedDB runs automatically on first load.

```javascript
// Check if migration is needed
const check = await MigrationManager.isMigrationNeeded();
// Returns: { needed: boolean, reason: string, actCount: number }

// Run migration manually
const result = await MigrationManager.migrateToIndexedDB();
// Returns: {
//   success: boolean,
//   migrated: number,
//   skipped: number,
//   failed: number,
//   total: number,
//   failedActs: Array<{actNumber, error}>,
//   error: string|null
// }
```

### Migration Process

1. Load all acts from chrome.storage.local
2. For each act:
   - Check if already migrated (receipt exists)
   - Save to IndexedDB with receipt generation
   - Verify migration integrity (hash comparison)
3. Log migration results to audit log

## Export Checkpoint System

### Configuration

```javascript
// Set export checkpoint threshold (10-200 acts)
await ExportCheckpointManager.setThreshold(50);

// Get current threshold
const threshold = await ExportCheckpointManager.getThreshold();
```

### Tracking

```javascript
// Record an extraction (increments counter)
const result = await ExportCheckpointManager.recordExtraction();
// Returns: { acts_since_export, threshold, should_prompt }

// Check if export prompt should show
const check = await ExportCheckpointManager.shouldPromptExport();

// Record export completion (resets counter)
await ExportCheckpointManager.recordExport();

// Dismiss prompt (resets counter for re-prompt)
await ExportCheckpointManager.dismissPrompt();
```

## Export Progress Tracking

### Starting an Export

```javascript
// Start batch export
const start = await ExportProgressTracker.startExport(['1001', '1002', '1003']);
// Returns: { export_id, total_acts, status }
```

### Recording Progress

```javascript
// Record successful export
const progress = await ExportProgressTracker.recordActExported('1001');
// Returns: { current_index, total_acts, progress_percent, status }

// Record failed export
await ExportProgressTracker.recordActFailed('1002', 'Download failed');
```

### Resume Capability

```javascript
// Check for interrupted export
const check = await ExportProgressTracker.checkForInterruptedExport();
// Returns: { can_resume, export_id, remaining_count, exported_count }

// Resume interrupted export
const resume = await ExportProgressTracker.resumeExport();
// Returns: { export_id, remaining_act_ids, current_index, total_acts }
```

### Rate Limiting

```javascript
// Set rate limit (100-5000ms)
await ExportProgressTracker.setRateLimit(500);

// Wait for rate limit
await ExportProgressTracker.waitForRateLimit();
```

## Audit Log

### Logging Operations

```javascript
// Log an audit entry
await StorageManager.logAuditEntry({
  operation: 'extraction_complete',
  actId: '1514',
  outcome: 'success',
  contentHash: 'abc123...',
  context: { source: 'queue_processing' }
});
```

### Valid Operations

- `write_attempt`, `write_success`, `write_failure`
- `read_attempt`, `read_success`, `read_failure`
- `extraction_start`, `extraction_complete`, `extraction_failure`
- `migration_start`, `migration_complete`, `migration_failure`
- `export_start`, `export_complete`, `export_failure`
- `integrity_check`, `integrity_failure`
- `quota_warning`, `quota_critical`
- `backend_switch`, `state_reconstruction`
- `queue_processing_started`, `queue_processing_resumed`, `queue_processing_paused`, `queue_processing_completed`

### Querying

```javascript
// Get all audit entries
const log = await StorageManager.getAuditLog();

// Filter by operation
const extractions = await StorageManager.getAuditLog({ 
  operation: 'extraction_complete' 
});

// Filter by date range
const recent = await StorageManager.getAuditLog({
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-31T23:59:59Z'
});

// Filter by act
const actLog = await StorageManager.getAuditLog({ actId: '1514' });
```

## IndexedDB Schema

### Object Stores

| Store | Key Path | Description |
|-------|----------|-------------|
| `acts` | `act_number` | Captured act records |
| `receipts` | `receipt_id` | Extraction receipts (append-only) |
| `wal` | `entry_id` | Write-ahead log entries |
| `audit_log` | `log_id` (auto) | Audit trail entries |

### Indexes

**acts:**
- `by_volume` - volume_number
- `by_captured_at` - capturedAt
- `by_content_hash` - content_raw_sha256

**receipts:**
- `by_act_id` - act_id
- `by_persisted_at` - persisted_at

**wal:**
- `by_act_id` - act_id
- `by_type` - entry_type
- `by_timestamp` - timestamp

**audit_log:**
- `by_timestamp` - timestamp
- `by_operation` - operation

## Fallback Chain

The storage system attempts backends in order:

1. **IndexedDB** (primary) - Large capacity, durable
2. **chrome.storage.local** (fallback) - Limited to ~10MB
3. **Memory** (ultimate fallback) - Volatile, warns user

### Degraded Mode Detection

```javascript
// Check if in degraded mode
const degraded = StorageManager.isDegradedMode();
// Returns true if not using IndexedDB

// Get active backend
const backend = StorageManager.getActiveBackend();
// Returns: 'indexeddb' | 'chrome_storage' | 'memory'
```

## Best Practices

### Extraction Workflow

```javascript
// 1. Initialize storage on load
await StorageManager.initialize();

// 2. Reconstruct queue state from receipts
const receipts = await StorageManager.getReceipts();
const state = QueueReconstructor.fullReconstruction(queueItems, receipts);

// 3. Check for incomplete extractions
const incomplete = await StorageManager.getIncompleteExtractions();

// 4. For each extraction:
await StorageManager.logIntent(actNumber);  // Before
const receipt = await StorageManager.saveAct(act);  // Atomic save
await StorageManager.logComplete(actNumber, receipt.content_raw_sha256);  // After

// 5. Track export checkpoints
await ExportCheckpointManager.recordExtraction();
```

### Error Handling

```javascript
try {
  const receipt = await StorageManager.saveAct(act);
} catch (error) {
  if (error instanceof StorageError) {
    if (error.isType(StorageErrorType.QUOTA_EXCEEDED)) {
      // Prompt user to export
    } else if (error.isType(StorageErrorType.TRANSACTION_FAILED)) {
      // Retry with backoff
    }
  }
  // Log to audit
  await StorageManager.logAuditEntry({
    operation: 'write_failure',
    actId: act.act_number,
    outcome: 'failure',
    context: { error: error.message }
  });
}
```

## Testing

Integration tests are available in `tests/integration/durable-persistence-flow.test.js`:

- Full extraction flow with 10+ acts
- Queue reconstruction from receipts
- Lifecycle recovery (side panel close/reopen)
- Fallback chain behavior
- Export checkpoint and progress tracking
- Error classification

Run tests:
```bash
npm test -- tests/integration/durable-persistence-flow.test.js
```
