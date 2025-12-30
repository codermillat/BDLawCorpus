# Implementation Plan: Textual Fidelity & Extraction Alignment

## Overview

This implementation plan addresses extraction gaps in the BDLawCorpus extension by implementing a hierarchical selector fallback system, Bengali-specific pattern detection, and comprehensive failure classification. The implementation follows the order: failure classification first (immediate fix), then fallback hierarchy, then pattern detection, then retry logic.

## Tasks

- [x] 1. Implement Failure Classification System
  - [x] 1.1 Add hasLegalSignal function to detect legal markers in content
    - Implement pattern matching for Bengali markers (ধারা, অধ্যায়, তফসিল, numeral+danda)
    - Implement pattern matching for English markers (Section, Chapter, Schedule)
    - Implement preamble/enactment pattern detection
    - _Requirements: 7.1, 7.4, 7.5_
  - [x] 1.2 Write property test for failure classification accuracy
    - **Property 8: Failure Reason Classification Accuracy**
    - **Validates: Requirements 4.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
  - [x] 1.3 Add classifyFailure function with all failure reason codes
    - Implement content_selector_mismatch classification
    - Implement empty_content classification
    - Implement dom_not_ready classification
    - Implement network_error classification
    - Add legal signal check to distinguish mismatch from empty
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 1.4 Add selectors_attempted array with attempt_order tracking
    - Record selector, matched, element_count, attempt_order for each attempt
    - _Requirements: 6.5, 7.3, 7.6_

- [x] 2. Checkpoint - Verify failure classification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Fallback Selector Hierarchy
  - [x] 3.1 Define SelectorHierarchy configuration object
    - Add primary selectors (existing)
    - Add fallback selectors for content, preamble, schedule
    - Add body fallback with exclusion blacklist
    - _Requirements: 6.1, 6.3, 11.1, 11.3, 11.4_
  - [x] 3.2 Write property test for fallback selector hierarchy and audit trail
    - **Property 7: Fallback Selector Hierarchy and Audit Trail**
    - **Validates: Requirements 4.1, 4.4, 4.6, 6.2, 6.5, 11.2, 11.7**
  - [x] 3.3 Implement _trySelectorsWithFallback function
    - Try primary selectors first
    - Fall back to fallback selectors in order
    - Record all attempts in selectors_attempted array
    - Set extraction_method and successful_selector on success
    - _Requirements: 4.1, 4.4, 4.6, 6.2, 11.2_
  - [x] 3.4 Implement body fallback with exclusion filtering
    - Remove excluded elements before textContent extraction
    - Validate extracted content has legal signal
    - Classify as content_selector_mismatch if no legal signal
    - _Requirements: 11.4, 11.5, 11.6_
  - [x] 3.5 Write property test for body fallback content filtering
    - **Property 9: Body Fallback Content Filtering**
    - **Validates: Requirements 11.5, 11.6**

- [x] 4. Checkpoint - Verify fallback hierarchy
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Preamble and Enactment Clause Detection
  - [x] 5.1 Add BengaliLegalPatterns configuration object
    - Define preamble patterns (যেহেতু, এবং যেহেতু, WHEREAS)
    - Define enactment patterns (সেহেতু এতদ্বারা আইন করা হইল, Be it enacted)
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3_
  - [x] 5.2 Write property test for preamble pattern detection accuracy
    - **Property 1: Preamble Pattern Detection Accuracy**
    - **Validates: Requirements 1.1, 1.2, 8.1, 8.2, 8.3, 8.4, 8.5**
  - [x] 5.3 Implement detectPreamble function
    - Detect Bengali and English preamble patterns
    - Record has_preamble, preamble_captured, preamble_start_position
    - Do NOT modify content_raw
    - _Requirements: 1.1, 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 5.4 Write property test for enactment clause pattern detection accuracy
    - **Property 2: Enactment Clause Pattern Detection Accuracy**
    - **Validates: Requirements 1.2, 9.1, 9.2, 9.3, 9.4, 9.5**
  - [x] 5.5 Implement detectEnactmentClause function
    - Detect Bengali and English enactment patterns
    - Record has_enactment_clause, enactment_clause_captured, enactment_clause_position
    - Do NOT modify content_raw
    - _Requirements: 1.2, 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 5.6 Write property test for content raw immutability
    - **Property 3: Content Raw Immutability After Pattern Detection**
    - **Validates: Requirements 1.7, 2.4, 2.5, 8.6, 9.6**
  - [x] 5.7 Write property test for pattern detection metadata completeness
    - **Property 12: Pattern Detection Metadata Completeness**
    - **Validates: Requirements 1.5, 1.6, 8.4, 9.4**

- [x] 6. Checkpoint - Verify preamble/enactment detection
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Bengali Section Marker Enhancement
  - [x] 7.1 Add Bengali numeral+danda pattern to section marker detection
    - Define regex for Bengali numerals (০-৯) followed by danda (৷)
    - Support multi-digit patterns (১০৷, ২৫৷, ১০০৷)
    - _Requirements: 2.1, 2.2, 10.1, 10.2_
  - [x] 7.2 Write property test for Bengali numeral+danda detection
    - **Property 4: Bengali Numeral+Danda Section Marker Detection**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.6, 10.1, 10.2, 10.3, 10.4**
  - [x] 7.3 Implement countBengaliSectionMarkers function
    - Count numeral+danda patterns separately from ধারা markers
    - Record dhara_count and numeral_danda_count in marker_frequency
    - Do NOT require ধারা for section marker detection
    - _Requirements: 2.3, 2.6, 10.3, 10.4, 10.5, 10.6_
  - [x] 7.4 Write property test for marker count separation
    - **Property 5: Marker Count Separation (Dhara vs Numeral+Danda)**
    - **Validates: Requirements 10.5, 10.6**

- [x] 8. Checkpoint - Verify section marker enhancement
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Schedule Reference vs Content Distinction
  - [x] 9.1 Add schedule reference detection separate from table DOM detection
    - Count text references to তফসিল/Schedule
    - Count actual table DOM elements
    - Record schedule_reference_count and schedule_table_count separately
    - _Requirements: 3.1, 3.5_
  - [x] 9.2 Write property test for schedule reference vs table DOM distinction
    - **Property 6: Schedule Reference vs Table DOM Distinction**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**
  - [x] 9.3 Update missing_schedule flag logic
    - Set missing_schedule: true only when reference exists but no table DOM
    - Do NOT classify text references as table_schedule numeric regions
    - _Requirements: 3.2, 3.3, 3.6_

- [x] 10. Checkpoint - Verify schedule distinction
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Retry Mechanism
  - [x] 11.1 Add retry configuration (max_retries default: 3)
    - Support configurable maximum retry attempts
    - _Requirements: 12.2_
  - [x] 11.2 Write property test for retry mechanism correctness
    - **Property 10: Retry Mechanism Correctness**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**
  - [x] 11.3 Implement automatic retry for content_selector_mismatch
    - Retry with fallback selectors only for selector mismatch failures
    - Do NOT retry for network_error, dom_not_ready, or other failures
    - Log each retry attempt with selector used
    - _Requirements: 12.1, 12.3, 12.6_
  - [x] 11.4 Record retry metadata on success/exhaustion
    - Record retry_count and successful_selector on success
    - Set all_selectors_exhausted: true when all retries fail
    - _Requirements: 12.4, 12.5_

- [x] 12. Implement Extraction Delay and DOM Readiness
  - [x] 12.1 Add extraction delay configuration
    - Support configurable delay (default: 0ms, max: 5000ms)
    - Record extraction_delay_ms in metadata
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 12.2 Write property test for extraction delay application
    - **Property 11: Extraction Delay Application**
    - **Validates: Requirements 5.2, 5.4, 5.6**
  - [x] 12.3 Add DOM readiness check
    - Verify DOM readiness before extraction
    - Record dom_readiness: "ready", "uncertain", or "not_ready"
    - _Requirements: 5.1, 5.5, 5.6_

- [x] 13. Integrate All Components into extractActContent
  - [x] 13.1 Update extractActContent to use new selector hierarchy
    - Use _trySelectorsWithFallback instead of _trySelectors
    - Include fallback and body fallback in extraction pipeline
    - _Requirements: 4.1, 6.2, 11.2_
  - [x] 13.2 Add pattern detection calls to extraction pipeline
    - Call detectPreamble and detectEnactmentClause
    - Call countBengaliSectionMarkers
    - Update schedule detection logic
    - _Requirements: 1.1, 1.2, 2.1, 3.1_
  - [x] 13.3 Add extraction metadata to result object
    - Include all new metadata fields in extraction result
    - Ensure backward compatibility with existing consumers
    - _Requirements: 1.5, 1.6, 4.4, 4.6, 5.4, 7.2_

- [x] 14. Final Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify extraction works on sample Bengali acts with preambles
  - Verify failure classification is accurate for selector mismatch scenarios

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Implementation order prioritizes immediate fixes (failure classification) before enhancements
