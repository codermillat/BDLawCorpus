# Implementation Plan: Robust Queue Processing with Delay & Retry

## Overview

This implementation enhances the BDLawCorpus queue processing system with configurable delays, deterministic failure detection, automatic retry with exponential backoff, and comprehensive failure tracking. The implementation follows a modular approach: first adding configuration, then failure detection, then retry mechanism, and finally UI updates.

## Tasks

- [x] 1. Implement Queue Configuration System
  - [x] 1.1 Add QUEUE_CONFIG_DEFAULTS constant to bdlaw-queue.js
    - Define extraction_delay_ms (default: 3000, range: 1000-30000)
    - Define minimum_content_threshold (default: 100, range: 50-1000)
    - Define max_retry_attempts (default: 3, range: 1-5)
    - Define retry_base_delay_ms (default: 5000, range: 2000-30000)
    - Define dom_readiness_timeout_ms (default: 30000)
    - _Requirements: 1.1, 1.4, 3.7, 10.1-10.4_

  - [x] 1.2 Implement getQueueConfig() and saveQueueConfig() functions
    - Load config from localStorage with defaults
    - Clamp values to valid ranges
    - Save config to localStorage
    - _Requirements: 1.5, 10.5_

  - [x] 1.3 Write property test for configuration persistence
    - **Property 1: Configuration Persistence**
    - **Validates: Requirements 1.1, 1.4, 1.5, 10.1-10.5**

- [x] 2. Implement Failure Reason Constants
  - [x] 2.1 Add FAILURE_REASONS constant to bdlaw-queue.js
    - CONTAINER_NOT_FOUND, CONTENT_EMPTY, CONTENT_BELOW_THRESHOLD
    - DOM_TIMEOUT, NETWORK_ERROR, NAVIGATION_ERROR
    - EXTRACTION_ERROR, UNKNOWN_ERROR
    - _Requirements: 3.1-3.6_

  - [x] 2.2 Add EXTRACTION_STATUS constant
    - SUCCESS, FAILED, PENDING, PROCESSING, RETRYING
    - _Requirements: 6.1_

- [x] 3. Checkpoint - Configuration Complete
  - Ensure configuration loads and saves correctly
  - Ensure values are clamped to valid ranges
  - Ask the user if questions arise

- [x] 4. Implement DOM Readiness Detection
  - [x] 4.1 Create waitForDOMReadiness(tabId, timeoutMs) function in sidepanel.js
    - Wait for document.readyState === 'complete'
    - Wait for act content container to be present
    - Implement 30-second timeout
    - Return { ready: boolean, reason?: string }
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.2 Write property test for DOM readiness enforcement
    - **Property 7: DOM Readiness Enforcement**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 17. Implement Content-Based Extraction Readiness
  - [x] 17.1 Add LEGAL_CONTENT_SIGNALS constant to bdlaw-queue.js
    - Define act title selectors
    - Define enactment clause patterns (English and Bengali)
    - Define first section patterns (English: "1." and Bengali: "১.")
    - _Requirements: 2.2, 2.3, 2.8_

  - [x] 17.2 Create checkLegalContentSignals(tabId) function in sidepanel.js
    - Check for act title presence
    - Check for enactment clause (EN: "It is hereby enacted", BN: "এতদ্দ্বারা প্রণীত")
    - Check for first numbered section (EN: "1." or BN: "১.")
    - Return { hasSignal: boolean, signalType?: string }
    - _Requirements: 2.2, 2.3, 2.8_

  - [x] 17.3 Update waitForDOMReadiness to waitForExtractionReadiness
    - Replace container-based check with legal content signal verification
    - Accept ANY ONE valid signal as extraction readiness
    - Support both English-only and Bengali-only layouts
    - _Requirements: 2.2, 2.3, 2.6, 2.7, 2.8_

  - [x] 17.4 Add CONTENT_SELECTOR_MISMATCH to FAILURE_REASONS
    - New failure reason for rendered pages with no legal content anchors
    - _Requirements: 3.1, 3.8, 3.9_

  - [x] 17.5 Update property test for extraction readiness enforcement
    - **Property 7: Extraction Readiness Enforcement**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

  - [x] 17.6 Write property test for failure classification accuracy
    - **Property 9: Failure Classification Accuracy**
    - **Validates: Requirements 3.8, 3.9**

- [x] 5. Implement Extraction Validation
  - [x] 5.1 Create validateExtraction(result, minThreshold) function in bdlaw-queue.js
    - Check for extraction success
    - Check for content container presence
    - Check for empty content
    - Check minimum content threshold
    - Return { valid: boolean, reason?: string }
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [x] 5.2 Write property test for failure detection completeness
    - **Property 2: Failure Detection Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

- [x] 18. Update Extraction Validation for Selector Mismatch
  - [x] 18.1 Update validateExtraction to accept readinessResult parameter
    - Pass extraction readiness result to validation
    - Distinguish CONTENT_SELECTOR_MISMATCH from CONTAINER_NOT_FOUND
    - _Requirements: 3.8, 3.9_

  - [x] 18.2 Update failure detection property test
    - **Property 2: Failure Detection Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9**

- [x] 6. Checkpoint - Failure Detection Complete
  - Ensure DOM readiness detection works
  - Ensure extraction validation catches all failure types
  - Ask the user if questions arise

- [x] 7. Implement Failed Extraction Tracking
  - [x] 7.1 Add failedExtractions array to state in sidepanel.js
    - Initialize from storage on load
    - Persist to storage on changes
    - _Requirements: 4.1, 4.3_

  - [x] 7.2 Create addFailedExtraction(failedExtractions, item, reason, attemptNumber) function
    - Create or update failed extraction entry
    - Record act_id, url, failure_reason, retry_count, failed_at
    - Track attempt history with timestamps
    - _Requirements: 4.2, 5.7_

  - [x] 7.3 Create shouldRetry(failedEntry) function
    - Check if retry_count < max_retry_attempts
    - _Requirements: 5.2, 5.5_

  - [x] 7.4 Create calculateRetryDelay(retryCount) function
    - Implement exponential backoff: base_delay * 2^(retry_count - 1)
    - _Requirements: 5.3_

  - [x] 7.5 Write property test for failed extraction tracking
    - **Property 3: Failed Extraction Tracking**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.6**

  - [x] 7.6 Write property test for retry mechanism correctness
    - **Property 4: Retry Mechanism Correctness**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

- [x] 8. Checkpoint - Tracking Complete
  - Ensure failed extractions are tracked correctly
  - Ensure retry logic works correctly
  - Ask the user if questions arise

- [x] 9. Update Queue Processing Logic
  - [x] 9.1 Update processQueue() to use DOM readiness detection
    - Call waitForDOMReadiness() before extraction
    - Handle DOM timeout as failure
    - _Requirements: 2.1-2.5_

  - [x] 9.2 Update processQueue() to validate extractions
    - Call validateExtraction() after extraction
    - Add failed extractions to tracking
    - _Requirements: 3.1-3.6_

  - [x] 9.3 Update processQueue() to apply configurable delay
    - Apply delay AFTER DOM readiness confirmation
    - Use extraction_delay_ms from config
    - _Requirements: 1.2, 1.3_

  - [x] 9.4 Write property test for extraction delay application
    - **Property 6: Extraction Delay Application**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 10. Implement Retry Queue Processing
  - [x] 10.1 Create processRetryQueue() function in sidepanel.js
    - Process failed extractions that can be retried
    - Apply exponential backoff delay
    - Increment retry_count for each attempt
    - _Requirements: 5.1, 5.3, 5.4_

  - [x] 10.2 Update processQueue() to call processRetryQueue() after main queue
    - Automatically process retry queue when main queue completes
    - _Requirements: 5.1_

  - [x] 10.3 Handle permanent failures
    - Mark as permanently failed when max retries exceeded
    - Keep in failed_extractions list
    - _Requirements: 5.5, 4.6_

- [x] 19. Implement Broader Selector Retry Strategy
  - [x] 19.1 Create getBroaderContentSelectors() function
    - Return expanded selector set for retry attempts
    - Include fallback selectors: main, article, body
    - _Requirements: 5.8_

  - [x] 19.2 Update processRetryQueue to use broader selectors
    - On retry, use expanded selector set
    - Never infer missing text
    - Never downgrade integrity rules
    - _Requirements: 5.8, 5.9, 5.10_

  - [x] 19.3 Log selector strategy used per attempt
    - Record which selector set was used
    - Include in attempt history
    - _Requirements: 5.7_

- [x] 11. Checkpoint - Retry Processing Complete
  - Ensure retry queue processes after main queue
  - Ensure exponential backoff is applied
  - Ensure permanent failures are tracked
  - Ask the user if questions arise

- [x] 12. Implement Failed Act Export Format
  - [x] 12.1 Create formatFailedActForExport(failedEntry) function in bdlaw-queue.js
    - Set extraction_status: "failed"
    - Include failure_reason
    - Include attempts count and history
    - Set content fields to null
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [x] 12.2 Update export functions to include failed acts
    - Include failed acts in corpus export
    - Do not skip or omit failed acts
    - _Requirements: 6.5_

  - [x] 12.3 Write property test for failed act export format
    - **Property 5: Failed Act Export Format**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

- [x] 13. Implement UI Updates
  - [x] 13.1 Add queue settings UI to sidepanel.html
    - Input for extraction_delay_ms
    - Input for minimum_content_threshold
    - Input for max_retry_attempts
    - Input for retry_base_delay_ms
    - _Requirements: 1.6, 10.6_

  - [x] 13.2 Add processing status counters to UI
    - Display successful count
    - Display failed count
    - Display retried count
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 13.3 Add retry indicator to progress display
    - Label retry attempts as "Retry #N"
    - Show delay countdown between extractions
    - Indicate when retry queue is processing
    - _Requirements: 7.4, 7.5, 7.6_

  - [x] 13.4 Add failed extractions viewer
    - Display failed extractions list
    - Show failure details for each
    - Allow clearing failed extractions
    - _Requirements: 4.4, 4.5, 4.6_

  - [x] 13.5 Update queue badge to show failures
    - Show warning indicator when failures exist
    - _Requirements: 7.7_

- [x] 14. Implement State Persistence
  - [x] 14.1 Update saveToStorage() to include failed_extractions
    - Save failed_extractions array
    - Save retry_count for queue items
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 14.2 Update loadFromStorage() to restore failed_extractions
    - Load failed_extractions array
    - Restore retry_count for queue items
    - _Requirements: 8.4_

  - [x] 14.3 Allow resuming interrupted queue processing
    - Detect interrupted processing on load
    - Offer to resume processing
    - _Requirements: 8.5_

- [x] 15. Ensure Research Integrity
  - [x] 15.1 Verify textContent-only extraction
    - Audit extraction code for textContent usage
    - Ensure no innerHTML or innerText usage
    - _Requirements: 9.4_

  - [x] 15.2 Verify no content inference for failures
    - Ensure failed acts have null content
    - Ensure no auto-correction of partial content
    - _Requirements: 9.5, 6.6_

  - [x] 15.3 Write property test for research integrity preservation
    - **Property 8: Research Integrity Preservation**
    - **Validates: Requirements 9.4, 9.5, 6.6**

- [x] 16. Final Checkpoint - All Features Complete
  - Ensure all property tests pass (minimum 100 iterations each)
  - Ensure queue processing with delays works
  - Ensure failure detection and retry mechanism work
  - Ensure failed acts are exported correctly
  - Ensure UI shows accurate status
  - Ask the user if questions arise

- [x] 20. Checkpoint - Content-Based Readiness Complete
  - Ensure legal content signal detection works for English and Bengali
  - Ensure CONTENT_SELECTOR_MISMATCH is correctly classified
  - Ensure broader selector retry strategy works
  - Ensure no content inference occurs
  - Ask the user if questions arise

- [x] 21. Final Validation - Updated Failure Model
  - Ensure all new property tests pass (minimum 100 iterations each)
  - Verify failure classification accuracy (selector mismatch vs timeout)
  - Verify retry with broader selectors maintains integrity
  - Verify methodology disclosure is accurate
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property tests
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- The implementation extends existing BDLawCorpus queue functionality
- All changes maintain backward compatibility with existing queue data
- Research integrity constraints are non-negotiable
- Tasks 17-21 address the newly identified failure class: content_selector_mismatch
- Methodology disclosure: "Some failures arose from heterogeneous DOM layouts in fully rendered pages, where legal content could not be reliably anchored without violating extraction constraints."
