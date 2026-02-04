# Requirements Document: Durable Persistence Hardening

## Introduction

This feature addresses critical reliability and persistence failures observed during large-scale batch extraction in the BDLawCorpus Chrome extension. The current system experiences data loss due to Chrome extension lifecycle issues, storage quota limitations, and lack of crash-safe persistence mechanisms. This spec ensures extracted acts are durably persisted and recoverable after browser restarts, extension reloads, and side panel closures.

## Glossary

- **Durable_Persistence**: Storage mechanism that guarantees data survives browser restarts, extension reloads, and side panel closures
- **Append_Only_Log**: Write pattern where new data is appended rather than overwriting existing data, enabling recovery from partial writes
- **Checkpoint**: A known-good state marker that can be used to recover from failures
- **Storage_Quota**: Chrome's limit on chrome.storage.local (typically 10MB for extensions, 5MB for sync)
- **IndexedDB**: Browser database API with larger storage limits (typically 50% of disk space) suitable for large datasets
- **Extraction_Receipt**: Immutable record confirming an act was durably persisted before marking as "done". Canonical schema: `{ receipt_id: uuid, act_id: string, content_raw_sha256: hex, storage_backend: "indexeddb" | "chrome_storage" | "memory", persisted_at: ISO-8601, schema_version: string }`
- **Write_Ahead_Log**: Pattern where intent is logged before action, enabling recovery from interrupted operations
- **Atomic_Write**: Write operation that either fully succeeds or fully fails, with no partial state
- **Queue_Reconstruction**: Deriving queue state from authoritative extracted_act_ids rather than stored counters
- **Side_Panel_Lifecycle**: Chrome extension side panel can be closed/reopened, destroying JS context

## Requirements

### Requirement 1: Atomic Per-Act Persistence

**User Story:** As a corpus builder, I want each extracted act to be durably persisted immediately after extraction, so that no act is lost even if the browser crashes mid-batch.

#### Acceptance Criteria

1. WHEN an act is successfully extracted, THE System SHALL persist it to durable storage BEFORE marking it as "done" in the queue
2. THE System SHALL use atomic write operations that either fully succeed or fully fail
3. IF a write operation fails, THE System SHALL NOT mark the act as completed
4. THE System SHALL generate an extraction_receipt containing act_id, content_hash, and timestamp for each persisted act
5. THE System SHALL store extraction_receipts in a separate, append-only log
6. THE System SHALL verify write success by reading back the extraction_receipt before proceeding

### Requirement 2: Storage Quota Management

**User Story:** As a corpus builder extracting 1,500+ acts, I want the system to handle storage limits gracefully, so that extractions don't silently fail due to quota overflow.

#### Acceptance Criteria

1. THE System SHALL monitor chrome.storage.local usage before each write operation
2. WHEN storage usage exceeds 80% of quota, THE System SHALL display a warning to the user
3. WHEN storage usage exceeds 95% of quota, THE System SHALL pause queue processing and prompt user to export data
4. THE System SHALL provide a storage usage indicator in the UI showing current usage vs quota
5. THE System SHALL implement chunked storage for large datasets, splitting across multiple storage keys
6. IF a write fails due to quota exceeded, THE System SHALL NOT silently continue but SHALL display an error and pause processing

### Requirement 3: Durable Storage Backend for Large Corpora

**User Story:** As a corpus builder, I want the system to use a durable storage backend capable of handling large datasets, so that I can extract thousands of acts without hitting storage limits.

#### Acceptance Criteria

1. THE System SHALL support a durable storage backend capable of storing at least 50MB of corpus data
2. THE System SHALL use IndexedDB as the default storage backend implementation for captured acts
3. THE System SHALL migrate existing chrome.storage.local data to IndexedDB on first load
4. THE System SHALL continue using chrome.storage.local for small configuration data (queue state, settings)
5. THE System SHALL store each act as a separate record keyed by act_number
6. THE System SHALL implement proper transaction handling with error recovery
7. THE System SHALL provide a fallback storage backend if the primary backend is unavailable

### Requirement 4: Reconstructible Queue State

**User Story:** As a corpus builder, I want queue state derived from authoritative data, so that counters never become inconsistent with actual extracted acts.

#### Acceptance Criteria

1. THE System SHALL derive pending count as: total_queued_act_ids MINUS extracted_act_ids
2. THE System SHALL NOT store pending/done counters as authoritative state
3. WHEN side panel loads, THE System SHALL reconstruct queue state from extraction_receipts
4. THE System SHALL maintain a set of extracted_act_ids as the authoritative record of completed extractions
5. IF queue state and extraction_receipts disagree, THE System SHALL trust extraction_receipts
6. THE System SHALL log any state reconstruction discrepancies for debugging

### Requirement 5: Side Panel Lifecycle Safety

**User Story:** As a corpus builder, I want extraction progress preserved when the side panel closes, so that I don't lose work due to accidental closure.

#### Acceptance Criteria

1. WHEN side panel closes during processing, THE System SHALL save current processing state
2. WHEN side panel reopens, THE System SHALL detect interrupted processing and offer to resume
3. THE System SHALL NOT rely on in-memory state surviving side panel closure
4. THE System SHALL flush all pending writes before side panel unload event
5. THE System SHALL implement beforeunload handler to warn user if processing is active
6. THE System SHALL reset any items stuck in "processing" status back to "pending" on reload

### Requirement 6: Write-Ahead Logging

**User Story:** As a corpus builder, I want extraction intent logged before extraction, so that interrupted extractions can be identified and retried.

#### Acceptance Criteria

1. BEFORE starting extraction of an act, THE System SHALL log extraction_intent with act_id and timestamp
2. AFTER successful extraction, THE System SHALL log extraction_complete with act_id, content_hash, and timestamp
3. WHEN side panel loads, THE System SHALL identify acts with extraction_intent but no extraction_complete
4. THE System SHALL offer to retry acts with incomplete extraction_intent records
5. THE System SHALL prune extraction_intent records older than 24 hours with user confirmation
6. THE System SHALL store write-ahead log in IndexedDB for durability

### Requirement 7: Explicit Error Handling for Storage Operations

**User Story:** As a corpus builder, I want clear error messages when storage operations fail, so that I understand what went wrong and can take action.

#### Acceptance Criteria

1. WHEN chrome.storage.local.set fails, THE System SHALL catch the error and display a specific message
2. WHEN IndexedDB transaction fails, THE System SHALL catch the error and display a specific message
3. THE System SHALL distinguish between quota_exceeded, permission_denied, and unknown_error
4. THE System SHALL log all storage errors with full context for debugging
5. THE System SHALL NOT use silent try/catch blocks that swallow errors
6. THE System SHALL provide a "Retry Save" option when storage operations fail

### Requirement 8: Forced User Download Checkpoints

**User Story:** As a corpus builder, I want periodic prompts to download extracted data, so that I have local backups regardless of browser storage state.

#### Acceptance Criteria

1. THE System SHALL prompt user to export after N acts have been extracted since last export (default N=50, user-configurable)
2. THE System SHALL track last_export_timestamp and acts_since_export counter
3. THE System SHALL allow user to dismiss the prompt but SHALL re-prompt after another N acts
4. THE System SHALL provide a "Download All Now" button that exports current corpus immediately
5. THE System SHALL NOT block queue processing while waiting for user response to export prompt
6. THE System SHALL display acts_since_export count in the UI
7. THE System SHALL allow configuring the export checkpoint threshold between 10 and 200 acts

### Requirement 9: Extraction Audit Trail

**User Story:** As a researcher, I want a complete audit trail of all extraction operations, so that I can verify corpus integrity and debug issues.

#### Acceptance Criteria

1. THE System SHALL maintain an append-only extraction_audit_log
2. FOR EACH extraction attempt, THE System SHALL log: act_id, timestamp, outcome, content_hash, storage_location
3. THE System SHALL log all storage operations: write_attempt, write_success, write_failure, read_attempt
4. THE System SHALL allow exporting the audit log as JSON
5. THE System SHALL retain audit log entries for at least 30 days
6. THE System SHALL NOT modify or delete audit log entries (append-only)

### Requirement 10: Graceful Degradation

**User Story:** As a corpus builder, I want the system to continue working even if some storage mechanisms fail, so that I don't lose all functionality due to a single failure.

#### Acceptance Criteria

1. IF IndexedDB is unavailable, THE System SHALL fall back to chrome.storage.local with quota warnings
2. IF chrome.storage.local is unavailable, THE System SHALL fall back to in-memory storage with export prompts
3. THE System SHALL display current storage mode in the UI (IndexedDB, chrome.storage, memory-only)
4. THE System SHALL warn user when operating in degraded mode
5. THE System SHALL NOT attempt operations that are known to fail in current storage mode
6. THE System SHALL provide manual export as ultimate fallback regardless of storage mode
7. THE System SHALL attempt storage backends in order: IndexedDB → chrome.storage.local → memory

## Authoritative Data Precedence

The system maintains multiple data sources. In case of conflict, the following precedence order SHALL be used (highest to lowest authority):

1. **Extraction receipts** (append-only log) - The ultimate source of truth for what has been extracted
2. **Persisted act records** (IndexedDB/chrome.storage) - The actual content data
3. **Queue metadata** (chrome.storage) - Processing state and configuration
4. **UI counters** (in-memory) - Non-authoritative, derived from above sources

This hierarchy ensures that even if UI state becomes inconsistent, the system can always reconstruct correct state from authoritative sources.

## Design Principle

This system prioritizes **data durability over throughput**. It is acceptable to slow down extraction if doing so ensures no data loss. Manual single-act extraction is never blocked by storage issues; only automated queue processing may be paused.

### Requirement 11: Data Integrity Verification

**User Story:** As a researcher, I want the system to verify data integrity on load, so that I can trust the corpus hasn't been corrupted.

#### Acceptance Criteria

1. WHEN loading captured acts, THE System SHALL verify content_hash matches stored content
2. IF content_hash mismatch is detected, THE System SHALL flag the act as potentially_corrupted
3. THE System SHALL NOT silently serve corrupted data
4. THE System SHALL provide option to re-extract acts flagged as corrupted
5. THE System SHALL log all integrity check results
6. THE System SHALL display integrity status in the UI (verified, unverified, corrupted)

### Requirement 12: Batch Export Safety

**User Story:** As a corpus builder, I want batch exports to complete reliably, so that I don't end up with partial exports.

#### Acceptance Criteria

1. WHEN exporting multiple acts, THE System SHALL track export progress per act
2. IF export is interrupted, THE System SHALL allow resuming from last successful act
3. THE System SHALL NOT mark acts as exported until file download is confirmed
4. THE System SHALL provide export progress indicator showing current/total acts
5. THE System SHALL implement rate limiting for downloads to avoid browser throttling
6. THE System SHALL allow canceling export without losing already-downloaded files

## Non-Functional Requirements

### Performance

- Storage operations SHALL complete within 500ms for single act writes
- Queue reconstruction SHALL complete within 2 seconds for 1,500 acts
- IndexedDB queries SHALL use appropriate indexes for O(log n) lookups
- Storage quota checks SHALL NOT block the UI thread

### Reliability

- System SHALL survive browser restarts without data loss
- System SHALL survive extension updates without data loss
- System SHALL survive side panel close/reopen without data loss
- System SHALL handle concurrent write attempts gracefully

### Scalability

- System SHALL support at least 2,000 extracted acts
- System SHALL support at least 50MB of total corpus data
- System SHALL maintain responsive UI with large datasets

## Research Integrity Constraints

1. THE System SHALL NOT modify content_raw after initial extraction (immutability preserved)
2. THE System SHALL always store content_raw_sha256 with each act
3. THE System SHALL NOT mark extraction as "done" unless durably persisted
4. THE System SHALL maintain full audit trail for reproducibility
5. THE System SHALL NOT silently drop or skip acts due to storage issues

