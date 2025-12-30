# Implementation Plan: Data Quality & Remediation

## Overview

This implementation adds data quality assessment, text cleaning, and completeness validation to the BDLawCorpus extension. The implementation follows a modular approach, building detection logic first, then cleaning rules, and finally integrating with the export pipeline.

## Tasks

- [x] 1. Implement Quality Configuration
  - [x] 1.1 Create bdlaw-quality.js module with QUALITY_CONFIG constant
    - Define schedulePatterns object with English and Bengali patterns
    - Define scheduleContentThreshold (500 characters)
    - Define encodingErrors array with pattern, description, replacement
    - Define ocrCorrections array with incorrect, correct, context
    - Define formattingRules object with enabled flags and patterns
    - _Requirements: 1.1, 2.5, 3.5, 8.4_

  - [x] 1.2 Implement helper functions
    - Implement escapeRegex(string) for safe pattern creation
    - Implement createEmptyAssessment() for default quality object
    - Implement deduplicateIssues(issues) to remove duplicate detections
    - _Requirements: 7.5_

- [x] 2. Implement Schedule Detection
  - [x] 2.1 Implement detectMissingSchedules(content, config) function
    - Iterate through all schedule patterns (English and Bengali)
    - For each match, check content length after reference
    - If content < threshold, create missing_schedule issue
    - Return array of schedule issues with type, position, description
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Write property test for schedule reference detection
    - **Property 1: Schedule Reference Detection**
    - **Validates: Requirements 1.1, 1.5**

  - [x] 2.3 Write property test for missing schedule flagging
    - **Property 2: Missing Schedule Flagging**
    - **Validates: Requirements 1.3, 1.4**

- [x] 3. Implement Encoding Error Detection
  - [x] 3.1 Implement detectEncodingErrors(content, config) function
    - Iterate through encodingErrors patterns
    - For each match, extract character, position, and context (±20 chars)
    - Return array of encoding issues
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Write property test for encoding error detection
    - **Property 3: Encoding Error Detection**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 4. Implement OCR Artifact Detection
  - [x] 4.1 Implement detectOcrArtifacts(content, config) function
    - Iterate through ocrCorrections dictionary
    - For each match, record incorrect, correct, position, context
    - Return array of OCR issues
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 4.2 Write property test for OCR artifact detection
    - **Property 4: OCR Artifact Detection**
    - **Validates: Requirements 3.1, 3.3, 3.4**

- [x] 5. Checkpoint - Detection Complete
  - Ensure all detection functions work correctly
  - Ensure issues are properly formatted with required fields
  - Ask the user if questions arise

- [x] 6. Implement Quality Validator
  - [x] 6.1 Implement validateContentQuality(content, config) function
    - Call detectMissingSchedules, detectEncodingErrors, detectOcrArtifacts
    - Collect all issues and build flags Set
    - Call determineCompleteness to assess overall quality
    - Return data_quality object with completeness, flags, issues
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.2 Implement determineCompleteness(flags, issues) function
    - Return "partial" if missing_schedule flag present
    - Return "complete" if no critical flags
    - Return "uncertain" for edge cases
    - _Requirements: 7.2_

  - [x] 6.3 Write property test for data quality schema completeness
    - **Property 8: Data Quality Schema Completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 7. Implement Encoding Repair Rules
  - [x] 7.1 Implement applyEncodingRepairRules(content, config, dryRun) function
    - Iterate through encodingErrors and apply replacements
    - Track transformations with type, rule, count, replacement
    - If dryRun, detect but don't modify content
    - Return { content, transformations }
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 7.2 Write property test for encoding repair application
    - **Property 5: Encoding Repair Application**
    - **Validates: Requirements 4.1, 4.2, 4.4**

- [x] 8. Implement OCR Correction Rules
  - [x] 8.1 Implement applyOcrCorrectionRules(content, config, dryRun) function
    - Iterate through ocrCorrections and apply replacements
    - Track transformations with type, incorrect, correct, count, context
    - If dryRun, detect but don't modify content
    - Return { content, transformations }
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.2 Write property test for OCR correction application
    - **Property 6: OCR Correction Application**
    - **Validates: Requirements 5.1, 5.5**

- [x] 9. Implement Formatting Rules
  - [x] 9.1 Implement applyFormattingRules(content, config, dryRun) function
    - Apply Bengali list separation if enabled
    - Apply English list separation if enabled
    - Track transformations with type, rule, count
    - If dryRun, detect but don't modify content
    - Return { content, transformations }
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 9.2 Write property test for formatting rule application
    - **Property 7: Formatting Rule Application**
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [x] 10. Checkpoint - Cleaning Rules Complete
  - Ensure all cleaning functions work correctly
  - Ensure transformations are properly logged
  - Ask the user if questions arise

- [x] 11. Implement Text Cleaner
  - [x] 11.1 Implement cleanContent(content, options) function
    - Accept options: applyEncodingRepairs, applyOcrCorrections, applyFormatting, dryRun, config
    - Preserve original content
    - Apply enabled rules in order
    - Collect all transformations
    - Return { original, cleaned, transformations, flags }
    - _Requirements: 4.4, 9.2, 9.3_

  - [x] 11.2 Write property test for configuration rule control
    - **Property 9: Configuration Rule Control**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x] 11.3 Write property test for content preservation
    - **Property 10: Content Preservation**
    - **Validates: Requirements 9.1, 9.4, 9.5**

- [x] 12. Integrate with Export Pipeline
  - [x] 12.1 Update exportSingleAct() in sidepanel.js
    - Call validateContentQuality on act content
    - Add data_quality object to export schema
    - _Requirements: 7.1_

  - [x] 12.2 Add quality assessment to content.js extraction
    - Call validateContentQuality during extraction
    - Return data_quality in extraction result
    - _Requirements: 7.1_

  - [x] 12.3 Add cleaning option to export UI
    - Add checkbox "Apply text cleaning" in Export tab
    - When enabled, call cleanContent before export
    - Show transformation summary in UI
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 13. Update UI for Data Quality
  - [x] 13.1 Add quality indicators to captured acts list
    - Show completeness badge (complete/partial/uncertain)
    - Show flag icons for detected issues
    - _Requirements: 7.2_

  - [x] 13.2 Add quality details panel
    - Display all detected issues with descriptions
    - Show suggested fixes for each issue type
    - _Requirements: 7.4_

  - [x] 13.3 Add cleaning preview
    - Show before/after comparison when cleaning is enabled
    - Display transformation count and types
    - _Requirements: 9.2, 9.3_

- [x] 14. Final Checkpoint - All Features Complete
  - Ensure all property tests pass (minimum 100 iterations each)
  - Ensure quality assessment appears in exported JSON
  - Ensure cleaning rules work correctly
  - Ensure UI shows quality indicators
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- The implementation extends existing BDLawCorpus functionality
- Quality assessment is non-destructive - original content is always preserved
- Cleaning is optional and configurable per export
- 10 property tests cover detection, cleaning, and configuration validation
