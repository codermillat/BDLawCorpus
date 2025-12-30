# Implementation Plan: Cross-Reference Extraction & Corpus Management

## Overview

This implementation adds cross-reference detection, corpus deduplication, manifest management, and research standards compliance to the BDLawCorpus extension. The implementation follows a modular approach, building detection logic first, then integrating with corpus management.

## Tasks

- [x] 1. Implement Citation Pattern Detection
  - [x] 1.1 Add citation patterns to bdlaw-extractor.js
    - Add CITATION_PATTERNS constant with English patterns (ACT_FULL, ACT_SHORT, ORDINANCE)
    - Add Bengali patterns (BENGALI_ACT_FULL, BENGALI_ACT_SHORT, BENGALI_ORDINANCE)
    - Add PRESIDENTS_ORDER pattern for P.O. references
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

  - [x] 1.2 Implement detectCrossReferences(text) function
    - Iterate through text line by line tracking position
    - Apply each pattern and collect matches
    - Extract citation components based on pattern type
    - Return array of CrossReference objects
    - _Requirements: 1.4, 1.5, 2.4, 2.5_

  - [x] 1.3 Write property test for English citation detection
    - **Property 1: English Citation Pattern Detection**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 1.4 Write property test for Bengali citation detection
    - **Property 2: Bengali Citation Pattern Detection**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 2. Implement Reference Classification
  - [x] 2.1 Add REFERENCE_TYPE_KEYWORDS constant
    - Define keywords for: amendment, repeal, substitution, dependency, incorporation
    - Include both Bengali and English keywords
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Implement classifyReferenceType(contextText) function
    - Check context for classification keywords
    - Return appropriate type or 'mention' as default
    - _Requirements: 3.5_

  - [x] 2.3 Write property test for reference classification
    - **Property 4: Reference Type Classification**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 3. Implement Context Extraction
  - [x] 3.1 Implement extractContextBefore(text, position, length) function
    - Extract up to 50 characters before citation
    - Handle document boundary edge cases
    - _Requirements: 4.1, 4.3_

  - [x] 3.2 Implement extractContextAfter(text, position, length) function
    - Extract up to 50 characters after citation
    - Handle document boundary edge cases
    - _Requirements: 4.2, 4.3_

  - [x] 3.3 Write property test for context extraction
    - **Property 5: Context Extraction Bounds**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 3.4 Write property test for position accuracy
    - **Property 3: Position Accuracy Round-Trip**
    - **Validates: Requirements 1.5, 4.4**

- [x] 4. Checkpoint - Cross-Reference Detection Complete
  - Ensure all citation patterns are detected correctly
  - Ensure classification works for all reference types
  - Ensure context extraction handles edge cases
  - Ask the user if questions arise

- [x] 5. Integrate Cross-References into Export
  - [x] 5.1 Update exportSingleAct() in sidepanel.js
    - Call detectCrossReferences on act content
    - Add cross_references object to export schema
    - Include count, method, and references array
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.2 Update content.js to detect cross-references during extraction
    - Add bdlawDetectCrossReferences function
    - Call during extractBDLawActContent
    - Return cross_references in extraction result
    - _Requirements: 6.1_

  - [x] 5.3 Write property test for export schema completeness
    - **Property 6: Export Schema Completeness**
    - **Validates: Requirements 5.1, 5.3, 5.4**

  - [x] 5.4 Write property test for content preservation
    - **Property 7: Content Preservation**
    - **Validates: Requirements 6.1**

- [x] 6. Implement Corpus Manifest Manager
  - [x] 6.1 Create corpus manifest schema and storage
    - Define MANIFEST_SCHEMA constant
    - Implement loadCorpusManifest() from chrome.storage
    - Implement saveCorpusManifest() to chrome.storage
    - _Requirements: 8.1, 8.2_

  - [x] 6.2 Implement updateCorpusManifest(manifest, newAct) function
    - Add/update act entry with all required fields
    - Update corpus statistics
    - Update extraction date range
    - _Requirements: 8.2, 8.3_

  - [x] 6.3 Implement updateCrossReferenceCoverage(manifest) function
    - Collect all referenced act citations
    - Compare against manifest.acts keys
    - Populate referenced_acts_in_corpus and referenced_acts_missing
    - Calculate coverage_percentage
    - _Requirements: 8.4_

  - [x] 6.4 Write property test for manifest statistics
    - **Property 11: Manifest Statistics Accuracy**
    - **Validates: Requirements 8.3**

  - [x] 6.5 Write property test for cross-reference coverage
    - **Property 12: Cross-Reference Coverage Tracking**
    - **Validates: Requirements 8.4**

- [x] 7. Implement Deduplication Manager
  - [x] 7.1 Implement isDuplicateAct(manifest, internalId) function
    - Check if internal_id exists in manifest.acts
    - Return duplicate status with existing entry details
    - _Requirements: 7.1, 7.4_

  - [x] 7.2 Implement isDuplicateVolume(manifest, volumeNumber) function
    - Check if volume_number exists in manifest.volumes
    - Return duplicate status with warning message
    - _Requirements: 7.2_

  - [x] 7.3 Update captureCurrentAct() to check for duplicates
    - Load manifest before capture
    - Check isDuplicateAct
    - Show confirmation dialog if duplicate
    - _Requirements: 7.1, 7.4_

  - [x] 7.4 Implement forceReExtraction(manifest, internalId, newAct) function
    - Archive previous version to version_history
    - Update manifest with new extraction
    - _Requirements: 7.5_

  - [x] 7.5 Write property test for deduplication
    - **Property 9: Deduplication Enforcement**
    - **Validates: Requirements 7.1, 7.4**

- [x] 8. Checkpoint - Corpus Management Complete
  - Ensure manifest is created and updated correctly
  - Ensure deduplication prevents duplicate extractions
  - Ensure cross-reference coverage is tracked
  - Ask the user if questions arise

- [x] 9. Implement Content Hashing and Idempotency
  - [x] 9.1 Implement computeContentHash(content) function
    - Use crypto.subtle.digest for SHA-256
    - Return hash in format "sha256:hexstring"
    - _Requirements: 10.2_

  - [x] 9.2 Implement checkExtractionIdempotency(manifest, internalId, newContent) function
    - Compare new content hash with existing
    - Return isIdentical or source_changed flag
    - _Requirements: 10.1, 10.3_

  - [x] 9.3 Update captureCurrentAct() to compute and store content hash
    - Compute hash during capture
    - Store in manifest entry
    - Check idempotency if re-extracting
    - _Requirements: 10.2, 10.3_

  - [x] 9.4 Write property test for content hash consistency
    - **Property 10: Content Hash Consistency**
    - **Validates: Requirements 10.1, 10.2**

  - [x] 9.5 Write property test for idempotent extraction
    - **Property 13: Idempotent Extraction**
    - **Validates: Requirements 10.1**

- [x] 10. Implement Extraction Audit Log
  - [x] 10.1 Implement logExtractionOperation(operation) function
    - Create log entry with timestamp, operation type, result
    - Append to extraction log in localStorage
    - _Requirements: 10.5_

  - [x] 10.2 Add logging calls to capture and export functions
    - Log extract operations
    - Log export operations
    - Log duplicate detection
    - _Requirements: 10.5_

- [x] 11. Implement Research Standards Generators
  - [x] 11.1 Implement generateCitationCff(manifest) function
    - Generate CITATION.cff content
    - Include corpus statistics
    - _Requirements: 9.2_

  - [x] 11.2 Implement generateCorpusReadme(manifest) function
    - Generate README.md with methodology
    - Document provenance chain
    - List known limitations
    - _Requirements: 9.1, 9.3, 9.4_

  - [x] 11.3 Implement generateDataDictionary() function
    - Generate DATA_DICTIONARY.md
    - Document all schema fields
    - _Requirements: 9.5_

  - [x] 11.4 Add export buttons for research documents
    - Add "Export Corpus Manifest" button
    - Add "Export Research Documents" button (README, CITATION, DATA_DICTIONARY)
    - _Requirements: 8.5, 9.1, 9.2, 9.5_

- [x] 12. Update UI for Corpus Management
  - [x] 12.1 Add corpus statistics display to Export tab
    - Show total acts, volumes, characters
    - Show cross-reference coverage percentage
    - Show extraction date range
    - _Requirements: 8.3_

  - [x] 12.2 Add duplicate warning UI
    - Show warning when duplicate detected
    - Provide "Force Re-extract" option
    - Show previous extraction timestamp
    - _Requirements: 7.1, 7.4, 7.5_

  - [x] 12.3 Add manifest viewer
    - Display corpus manifest contents
    - Show missing referenced acts
    - _Requirements: 8.4_

- [x] 13. Final Checkpoint - All Features Complete
  - Ensure all property tests pass (minimum 100 iterations each)
  - Ensure cross-references are detected in Act 754
  - Ensure manifest tracks all extracted acts
  - Ensure research documents are generated correctly
  - Ask the user if questions arise

- [x] 14. Implement Language Detection
  - [x] 14.1 Implement detectContentLanguage(content) function
    - Check for Bengali Unicode characters (U+0980 to U+09FF)
    - Return 'bengali' if Bengali characters found, 'english' otherwise
    - _Requirements: 11.1_

  - [x] 14.2 Write property test for language detection
    - **Property 14: Language Detection Accuracy**
    - **Validates: Requirements 11.1**

- [x] 15. Implement Language-Aware Deduplication
  - [x] 15.1 Implement checkLanguageAwareDuplicate(manifest, internalId, newContentLanguage) function
    - If act doesn't exist: allow extraction
    - If existing is English, new is Bengali: allow and replace
    - If existing is Bengali, new is English: block extraction
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [x] 15.2 Update updateCorpusManifest to include content_language field
    - Add content_language to manifest act entry
    - _Requirements: 11.6_

  - [x] 15.3 Update captureCurrentAct() to use language-aware deduplication
    - Detect content language before duplicate check
    - Use checkLanguageAwareDuplicate instead of isDuplicateAct
    - Show language-specific warning messages
    - _Requirements: 11.4, 11.5, 11.7_

  - [x] 15.4 Write property test for Bengali preference
    - **Property 15: Language-Aware Deduplication - Bengali Preference**
    - **Validates: Requirements 11.5**

  - [x] 15.5 Write property test for English blocked
    - **Property 16: Language-Aware Deduplication - English Blocked**
    - **Validates: Requirements 11.4**

  - [x] 15.6 Write property test for language recording
    - **Property 17: Language Recording in Manifest**
    - **Validates: Requirements 11.6**

- [x] 16. Update UI for Language-Aware Deduplication
  - [x] 16.1 Update duplicate warning UI to show language information
    - Display existing version's language
    - Show appropriate message based on language comparison
    - _Requirements: 11.7_

  - [x] 16.2 Update manifest viewer to show content_language
    - Display language column in acts list
    - _Requirements: 11.6_

- [x] 17. Final Checkpoint - Language-Aware Deduplication Complete
  - Ensure language detection works for Bengali and English content
  - Ensure Bengali version replaces English version
  - Ensure English extraction is blocked when Bengali exists
  - Ensure manifest records content_language
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- The implementation extends existing BDLawCorpus functionality
- Cross-reference detection maintains methodological purity (pattern-based, not semantic)
- Corpus manifest enables research-grade data management
- Language-aware deduplication ensures Bengali versions are preferred over English
