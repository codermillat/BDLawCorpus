# Implementation Plan: Legal Integrity Enhancement

## Overview

This implementation enhances the BDLawCorpus extension to meet research-grade legal corpus standards. The implementation follows a modular approach: first implementing the three-version content model, then adding protection mechanisms, and finally integrating with the export pipeline.

## Tasks

- [x] 1. Implement Three-Version Content Model
  - [x] 1.1 Create createThreeVersionContent(extractedText) function in bdlaw-extractor.js
    - Store content_raw as exact extracted text (never modify)
    - Create content_normalized using Unicode NFC normalization
    - Initialize content_corrected from content_normalized
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 1.2 Update computeContentHash() to use content_raw exclusively
    - Modify hash computation to always use content_raw
    - Add hash_source: "content_raw" to metadata
    - _Requirements: 1.5_

  - [x] 1.3 Write property test for content raw immutability
    - **Property 1: Content Raw Immutability**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 1.4 Write property test for content hash anchoring
    - **Property 2: Content Hash Anchoring**
    - **Validates: Requirements 1.5**

- [x] 2. Implement Transformation Audit System
  - [x] 2.1 Create transformation log structure and logging function
    - Define TRANSFORMATION_ENTRY schema
    - Implement logTransformation(log, entry) function
    - Include: transformation_type, original, corrected, position, risk_level, applied, timestamp
    - _Requirements: 2.1, 2.5_

  - [x] 2.2 Implement risk level classification
    - Define RISK_CLASSIFICATION mapping
    - Classify encoding fixes as "non-semantic"
    - Classify OCR corrections as "potential-semantic"
    - _Requirements: 2.2, 2.3_

  - [x] 2.3 Implement flag-only mode for potential-semantic transformations
    - If risk_level = "potential-semantic", set applied = false
    - Do not modify content_corrected for potential-semantic
    - _Requirements: 2.4_

  - [x] 2.4 Write property test for transformation audit completeness
    - **Property 4: Transformation Audit Completeness**
    - **Validates: Requirements 2.1, 2.5**

  - [x] 2.5 Write property test for risk level classification
    - **Property 5: Risk Level Classification**
    - **Validates: Requirements 2.2, 2.3**

  - [x] 2.6 Write property test for flag-only mode
    - **Property 6: Potential-Semantic Flag-Only Mode**
    - **Validates: Requirements 2.4**

- [x] 3. Checkpoint - Core Content Model Complete
  - Ensure three-version content model works correctly
  - Ensure transformation logging captures all changes
  - Ensure risk classification is accurate
  - Ask the user if questions arise

- [x] 4. Implement Numeric Region Protection
  - [x] 4.1 Create detectNumericRegions(content) function
    - Detect currency patterns (৳, টাকা, Tk, $)
    - Detect percentage patterns (%, শতাংশ)
    - Detect rate patterns (per annum, হার)
    - Detect table/schedule markers
    - Return array of {start, end, type, numeric_integrity_sensitive: true}
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 Implement isInNumericRegion(position, regions) function
    - Check if position falls within any numeric region
    - _Requirements: 3.6_

  - [x] 4.3 Update cleaning functions to skip numeric regions
    - Modify applyEncodingRepairRules to check numeric regions
    - Modify applyOcrCorrectionRules to check numeric regions
    - Modify applyFormattingRules to check numeric regions
    - Only allow Unicode normalization in numeric regions
    - _Requirements: 3.6, 3.7_

  - [x] 4.4 Write property test for numeric region protection
    - **Property 7: Numeric Region Protection**
    - **Validates: Requirements 3.5, 3.6, 3.7**

- [x] 5. Implement Protected Section Detection
  - [x] 5.1 Create detectProtectedSections(content) function
    - Detect definition sections (সংজ্ঞা, "definition", "means")
    - Detect proviso sections (তবে শর্ত, "Provided that")
    - Detect explanation sections (ব্যাখ্যা, "Explanation")
    - Return {protected_sections: [], regions: []}
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 5.2 Implement isInProtectedSection(position, regions) function
    - Check if position falls within any protected section
    - _Requirements: 17.5_

  - [x] 5.3 Update OCR correction to skip protected sections
    - Modify applyOcrCorrectionRules to check protected sections
    - Flag but do not correct OCR artifacts in protected sections
    - _Requirements: 17.5, 17.6, 17.7_

  - [x] 5.4 Write property test for protected section enforcement
    - **Property 9: Protected Section Enforcement**
    - **Validates: Requirements 17.5, 17.6, 17.7**

- [x] 6. Checkpoint - Protection Mechanisms Complete
  - Ensure numeric regions are detected and protected
  - Ensure protected sections block OCR correction
  - Ensure transformations are logged correctly
  - Ask the user if questions arise

- [x] 7. Implement Negation-Aware Reference Classification
  - [x] 7.1 Create checkNegationContext(content, position, window) function
    - Check for Bengali negation words (না, নয়, নহে, নাই, নেই, ব্যতীত, ছাড়া)
    - Search within ±20 characters of position
    - Return {negation_present, negation_word, negation_position, negation_context}
    - _Requirements: 4.1, 4.2_

  - [x] 7.2 Update classifyReferenceType to classifyLexicalRelation
    - Rename function and field to lexical_relation_type
    - If negation present, force type to "mention"
    - Override all other keywords when negation detected
    - _Requirements: 4.3, 4.4, 5.1_

  - [x] 7.3 Add lexical relation disclaimer to exports
    - Include: "Detected via pattern matching. No legal force or applicability implied."
    - Set relationship_inference: "explicitly_prohibited"
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [x] 7.4 Write property test for negation override classification
    - **Property 8: Negation Override Classification**
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [x] 7.5 Write property test for lexical relation purity
    - **Property 10: Lexical Relation Purity**
    - **Validates: Requirements 5.1, 5.2**

- [x] 8. Implement Lexical Relation Confidence
  - [x] 8.1 Create assignLexicalConfidence(citation) function
    - Assign "high" for full citation (name + year + serial)
    - Assign "medium" for partial (year + serial)
    - Assign "low" for ambiguous patterns
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 8.2 Update detectCrossReferences to include confidence
    - Add lexical_relation_confidence to each reference
    - _Requirements: 16.1_

- [x] 9. Checkpoint - Reference Classification Complete
  - Ensure negation detection works correctly
  - Ensure lexical_relation_type is used everywhere
  - Ensure confidence levels are assigned
  - Ask the user if questions arise

- [x] 10. Implement Legal Status and Temporal Marking
  - [x] 10.1 Create detectLegalStatus(document) function
    - Detect if act is marked as repealed on source page
    - Return "active", "repealed", or "unknown"
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 10.2 Add temporal_status field to all exports
    - Set temporal_status: "historical_text" for all acts
    - Add temporal_disclaimer: "No inference of current legal force or applicability"
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 11. Implement Schedule HTML Preservation
  - [x] 11.1 Create extractScheduleHTML(document) function
    - Extract schedule/table HTML verbatim from DOM
    - Set representation: "raw_html"
    - Set extraction_method: "verbatim_dom_capture"
    - Set processed: false
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 11.2 Update schedule detection to preserve HTML
    - Do not flatten or clean schedule HTML
    - Flag missing schedules without inferring content
    - _Requirements: 8.5, 8.6_

  - [x] 11.3 Write property test for schedule HTML preservation
    - **Property 12: Schedule HTML Preservation**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

- [x] 12. Implement Enhanced Data Quality Object
  - [x] 12.1 Update data_quality schema
    - Add risks array
    - Add known_limitations array
    - Add safe_for_ml_training boolean
    - Add intended_ml_use array
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

  - [x] 12.2 Implement safe_for_ml_training logic
    - Set false if: numeric corruption risk, encoding ambiguity, missing schedules, heavy OCR correction
    - Set true only if none of the above apply
    - _Requirements: 9.5_

  - [x] 12.3 Update completeness semantics
    - Rename "partial" to "textual_partial"
    - Add completeness_disclaimer: "Website representation incomplete; legal completeness unknown"
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 12.4 Write property test for safe_for_ml_training logic
    - **Property 11: Safe For ML Training Logic**
    - **Validates: Requirements 9.5**

- [x] 13. Checkpoint - Status and Quality Complete
  - Ensure legal_status is detected correctly
  - Ensure temporal_status is always "historical_text"
  - Ensure safe_for_ml_training logic is correct
  - Ask the user if questions arise

- [x] 14. Implement Extraction Risk Detection
  - [x] 14.1 Create detectExtractionRisks(document) function
    - Detect pagination elements
    - Detect lazy-loaded content
    - Detect external schedule links
    - Detect hidden DOM elements
    - Return {possible_truncation, reason}
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 14.2 Add extraction_risk to all exports
    - Include possible_truncation and reason fields
    - _Requirements: 13.6_

- [x] 15. Implement Additional Recording Fields
  - [x] 15.1 Create detectNumericRepresentation(content) function
    - Detect Bengali digits (০-৯)
    - Detect English digits (0-9)
    - Return {numeric_representation: [], bn_digit_count, en_digit_count, is_mixed}
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 15.2 Create detectEditorialContent(content) function
    - Detect footnotes, marginal notes, editor annotations
    - Return {editorial_content_present, editorial_types}
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [x] 15.3 Create calculateLanguageDistribution(content) function
    - Calculate Bengali character ratio
    - Calculate English character ratio
    - Return {bn_ratio, en_ratio}
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 16. Implement Title Preservation
  - [x] 16.1 Update title extraction to store both versions
    - Store title_raw as exact extracted title
    - Store title_normalized with Unicode NFC only
    - Never "correct" titles
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 17. Implement Source Authority Declaration
  - [x] 17.1 Add source authority fields to all exports
    - Set source_authority: "bdlaws_html_only"
    - Set authority_rank: ["bdlaws_html"]
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 17.2 Add formatting_scope field
    - Set formatting_scope: "presentation_only" when formatting applied
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 18. Integrate with Export Pipeline
  - [x] 18.1 Update exportSingleAct() in sidepanel.js
    - Include three-version content model
    - Include transformation_log
    - Include all new metadata fields
    - _Requirements: All_

  - [x] 18.2 Update content.js extraction
    - Call all detection functions during extraction
    - Build complete integrity metadata
    - _Requirements: All_

  - [x] 18.3 Write property test for citation position round-trip
    - **Property 3: Citation Position Round-Trip**
    - **Validates: Requirements 1.6**

- [x] 19. Update UI for Legal Integrity
  - [x] 19.1 Add integrity indicators to captured acts list
    - Show safe_for_ml_training badge
    - Show extraction_risk warning if truncation possible
    - _Requirements: 9.5, 13.5_

  - [x] 19.2 Add transformation log viewer
    - Display all transformations with risk levels
    - Highlight potential-semantic (flagged but not applied)
    - _Requirements: 2.5_

  - [x] 19.3 Add protected section indicators
    - Show which sections are protected
    - Show flagged-but-not-corrected OCR artifacts
    - _Requirements: 17.4_

- [x] 20. Final Checkpoint - All Features Complete
  - Ensure all property tests pass (minimum 100 iterations each)
  - Ensure three-version content model is complete
  - Ensure all protection mechanisms work
  - Ensure export schema matches design
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property tests
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- The implementation extends existing BDLawCorpus functionality
- All changes maintain backward compatibility with existing exports
- The steering file `.kiro/steering/legal-integrity-rules.md` provides runtime guidance
- 12 property tests cover all critical integrity guarantees
