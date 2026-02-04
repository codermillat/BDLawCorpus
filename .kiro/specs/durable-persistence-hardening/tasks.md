# Implementation Plan: Durable Persistence Hardening

## Overview

This implementation plan transforms the BDLawCorpus extension from an in-memory-first architecture to a durable-persistence-first architecture. The work is organized to deliver incremental value while maintaining system stability.

## Tasks

- [x] 1. Create Storage Abstraction Layer Foundation
  - [x] 1.1 Create `bdlaw-storage.js` module with StorageManager interface
    - Define StorageManager object with method stubs
    - Define StorageError class with error types
    - Define ExtractionReceipt schema
    - Export for both browser and Node.js environments
    - _Requirements: 1.2, 7.3_

  - [x] 1.2 Write property test for error classification accuracy
    - **Property 13: Error Classification Accuracy**
    - **Validates: Requirements 7.3, 7.4**

  - [x] 1.3 Implement IndexedDB backend initialization
    - Create `initIndexedDB()` function
    - Define database schema with 4 object stores (acts, receipts, wal, audit_log)
    - Implement version upgrade handling
    - Handle IndexedDB unavailability gracefully
    - _Requirements: 3.1, 3.2_

- [x] 2. Implement IndexedDB Act Storage
  - [x] 2.1 Implement `saveActToIndexedDB(act)` function
    - Use transaction with proper error handling
    - Generate content_raw_sha256 hash
    - Store act with persistence metadata
    - _Requirements: 1.2, 3.5, 3.6_

  - [x] 2.2 Implement `loadActFromIndexedDB(actId)` function
    - Retrieve act by act_number key
    - Verify content hash on load
    - Return null if not found
    - _Requirements: 3.5, 11.1_

  - [x] 2.3 Write property test for act lookup by key
    - **Property 8: Act Lookup by Key**
    - **Validates: Requirements 3.5**

  - [x] 2.4 Write property test for content hash verification
    - **Property 18: Content Hash Verification**
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [x] 3. Implement Extraction Receipt System
  - [x] 3.1 Implement `generateReceipt(act)` function
    - Generate UUID for receipt_id
    - Compute content_raw_sha256
    - Set storage_backend and schema_version
    - Set persisted_at timestamp
    - _Requirements: 1.4_

  - [x] 3.2 Implement `saveReceipt(receipt)` to IndexedDB
    - Append to receipts object store
    - Never modify existing receipts
    - _Requirements: 1.5_

  - [x] 3.3 Implement `getReceipts()` function
    - Return all receipts from IndexedDB
    - Support filtering by act_id
    - _Requirements: 1.5, 1.6_

  - [x] 3.4 Write property test for receipt completeness
    - **Property 3: Receipt Completeness**
    - **Validates: Requirements 1.4**

  - [x] 3.5 Write property test for receipts append-only
    - **Property 4: Receipts Append-Only**
    - **Validates: Requirements 1.5**

  - [x] 3.6 Write property test for receipt round-trip
    - **Property 5: Receipt Round-Trip**
    - **Validates: Requirements 1.6**

- [x] 4. Implement Atomic Save with Receipt Verification
  - [x] 4.1 Implement `saveAct(act)` in StorageManager
    - Save act to IndexedDB
    - Generate and save receipt
    - Read back receipt to verify
    - Return receipt on success, throw on failure
    - _Requirements: 1.1, 1.2, 1.6_

  - [x] 4.2 Write property test for persist-before-done invariant
    - **Property 1: Persist-Before-Done Invariant**
    - **Validates: Requirements 1.1, 1.3**

  - [x] 4.3 Write property test for atomic write consistency
    - **Property 2: Atomic Write Consistency**
    - **Validates: Requirements 1.2, 1.3**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Storage Quota Monitoring
  - [x] 6.1 Implement `getStorageStatus()` function
    - Get chrome.storage.local bytes in use
    - Calculate usage percentage
    - Return status object with thresholds
    - _Requirements: 2.1, 2.4_

  - [x] 6.2 Implement quota threshold checks
    - Check quota before each write
    - Set warning flag at 80%
    - Set critical flag at 95%
    - _Requirements: 2.2, 2.3_

  - [x] 6.3 Write property test for storage threshold behavior
    - **Property 6: Storage Threshold Behavior**
    - **Validates: Requirements 2.2, 2.3, 2.6**

- [-] 7. Implement Fallback Chain
  - [x] 7.1 Implement chrome.storage backend
    - Create `ChromeStorageBackend` with same interface as IndexedDB
    - Handle quota limitations
    - _Requirements: 10.1_

  - [x] 7.2 Implement memory backend
    - Create `MemoryBackend` for ultimate fallback
    - Warn user about data volatility
    - _Requirements: 10.2_

  - [x] 7.3 Implement backend selection in `initialize()`
    - Try IndexedDB first
    - Fall back to chrome.storage if unavailable
    - Fall back to memory if chrome.storage unavailable
    - _Requirements: 10.7_

  - [x] 7.4 Write property test for fallback chain order
    - **Property 9: Fallback Chain Order**
    - **Validates: Requirements 3.7, 10.1, 10.2, 10.7**

- [x] 8. Implement Queue State Reconstruction
  - [x] 8.1 Create `QueueReconstructor` module
    - Implement `reconstructState(queueItems, receipts)` function
    - Derive pending from total minus extracted
    - Detect and log discrepancies
    - _Requirements: 4.1, 4.4, 4.5, 4.6_

  - [x] 8.2 Implement processing status reset
    - Reset 'processing' items to 'pending' on load
    - Log reset actions
    - _Requirements: 5.6_

  - [x] 8.3 Write property test for queue reconstruction correctness
    - **Property 10: Queue Reconstruction Correctness**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.5, 4.6**

  - [x] 8.4 Write property test for processing status reset
    - **Property 11: Processing Status Reset on Reload**
    - **Validates: Requirements 5.6**

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Write-Ahead Logging
  - [x] 10.1 Implement `logIntent(actId)` function
    - Create WAL entry with type 'intent'
    - Store in IndexedDB wal object store
    - _Requirements: 6.1_

  - [x] 10.2 Implement `logComplete(actId, contentHash)` function
    - Create WAL entry with type 'complete'
    - Store in IndexedDB wal object store
    - _Requirements: 6.2_

  - [x] 10.3 Implement `getIncompleteExtractions()` function
    - Find intents without matching completes
    - Return list for retry prompt
    - _Requirements: 6.3_

  - [x] 10.4 Write property test for write-ahead log integrity
    - **Property 12: Write-Ahead Log Integrity**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 11. Implement Audit Log
  - [x] 11.1 Implement `logAuditEntry(entry)` function
    - Append to audit_log object store
    - Include timestamp, operation, context
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 11.2 Implement `getAuditLog(options)` function
    - Support filtering by operation type
    - Support date range filtering
    - _Requirements: 9.4_

  - [x] 11.3 Write property test for audit log append-only
    - **Property 16: Audit Log Append-Only**
    - **Validates: Requirements 9.1, 9.6**

  - [x] 11.4 Write property test for audit log entry completeness
    - **Property 17: Audit Log Entry Completeness**
    - **Validates: Requirements 9.2, 9.3**

- [x] 12. Implement Export Checkpoint System
  - [x] 12.1 Implement export tracking state
    - Track last_export_timestamp
    - Track acts_since_export counter
    - Persist to chrome.storage.local
    - _Requirements: 8.2_

  - [x] 12.2 Implement checkpoint threshold configuration
    - Default N=50, range 10-200
    - Persist setting
    - _Requirements: 8.7_

  - [x] 12.3 Implement checkpoint prompt logic
    - Trigger prompt when acts_since_export >= N
    - Reset counter on export or dismiss
    - Re-prompt after another N acts
    - _Requirements: 8.1, 8.3_

  - [x] 12.4 Write property test for export checkpoint triggering
    - **Property 14: Export Checkpoint Triggering**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x] 12.5 Write property test for export threshold configuration
    - **Property 15: Export Threshold Configuration**
    - **Validates: Requirements 8.7**

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement Export Progress Tracking
  - [x] 14.1 Implement per-act export progress tracking
    - Track current act index during export
    - Persist progress to storage
    - _Requirements: 12.1_

  - [x] 14.2 Implement export resume capability
    - Detect interrupted exports
    - Resume from last successful act
    - _Requirements: 12.2_

  - [x] 14.3 Implement export rate limiting
    - Add configurable delay between downloads
    - Default 500ms
    - _Requirements: 12.5_

  - [x] 14.4 Write property test for export progress tracking
    - **Property 19: Export Progress Tracking**
    - **Validates: Requirements 12.1, 12.2, 12.3**

  - [x] 14.5 Write property test for export rate limiting
    - **Property 20: Export Rate Limiting**
    - **Validates: Requirements 12.5**

- [x] 15. Implement Migration from chrome.storage.local
  - [x] 15.1 Implement `migrateToIndexedDB()` function
    - Load acts from chrome.storage.local
    - Save each to IndexedDB with receipt
    - Verify migration integrity
    - _Requirements: 3.3_

  - [x] 15.2 Implement migration trigger on first load
    - Detect if migration needed
    - Run migration automatically
    - Log migration results
    - _Requirements: 3.3_

  - [x] 15.3 Write property test for migration round-trip
    - **Property 7: Migration Round-Trip**
    - **Validates: Requirements 3.3**

- [x] 16. Integrate StorageManager into sidepanel.js
  - [x] 16.1 Replace `saveToStorage()` with StorageManager calls
    - Use `StorageManager.saveAct()` for act persistence
    - Use `StorageManager.logIntent()` before extraction
    - Use `StorageManager.logComplete()` after extraction
    - _Requirements: 1.1, 6.1, 6.2_

  - [x] 16.2 Replace `loadFromStorage()` with StorageManager calls
    - Use `StorageManager.initialize()` on load
    - Use `QueueReconstructor.reconstructState()` for queue
    - Use `StorageManager.getIncompleteExtractions()` for resume prompt
    - _Requirements: 4.3, 5.2, 6.3_

  - [x] 16.3 Update queue processing to use atomic saves
    - Call `saveAct()` before marking complete
    - Handle StorageError appropriately
    - Pause on quota exceeded
    - _Requirements: 1.1, 2.3, 2.6_

- [x] 17. Implement UI Updates
  - [x] 17.1 Add storage status indicator to UI
    - Show current backend (IndexedDB/chrome.storage/memory)
    - Show usage percentage
    - Show warning/critical state
    - _Requirements: 2.4, 10.3_

  - [x] 17.2 Add export checkpoint prompt UI
    - Show acts_since_export count
    - Show prompt when threshold reached
    - Add dismiss and export buttons
    - _Requirements: 8.1, 8.6_

  - [x] 17.3 Add integrity status indicator
    - Show verified/unverified/corrupted status
    - Add re-extract option for corrupted acts
    - _Requirements: 11.4, 11.6_

  - [x] 17.4 Add degraded mode warning
    - Show warning when not using IndexedDB
    - Explain data volatility risk
    - _Requirements: 10.4_

- [x] 18. Implement Side Panel Lifecycle Handlers
  - [x] 18.1 Implement beforeunload handler
    - Flush pending writes
    - Save processing state
    - Warn user if processing active
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 18.2 Implement resume prompt on load
    - Detect interrupted processing
    - Show resume prompt with details
    - Handle resume/dismiss actions
    - _Requirements: 5.2_

- [x] 19. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Integration Testing and Documentation
  - [x] 20.1 Run full extraction flow test
    - Extract 10+ acts
    - Verify all receipts generated
    - Verify queue reconstruction works
    - _Requirements: All_

  - [x] 20.2 Test lifecycle recovery
    - Simulate side panel close during processing
    - Verify state recovery on reopen
    - Verify no data loss
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 20.3 Test fallback chain
    - Disable IndexedDB
    - Verify chrome.storage fallback
    - Verify memory fallback
    - _Requirements: 10.1, 10.2, 10.7_

  - [x] 20.4 Update module documentation
    - Document StorageManager API
    - Document migration process
    - Document error handling
    - _Requirements: All_

## Notes

- All tasks are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation preserves all existing research integrity constraints