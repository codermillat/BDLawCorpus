# Implementation Plan: Legal Structure Derivation & Reference Anchoring

## Overview

This implementation plan adds derived structural representation and scope-anchored cross-reference detection to the BDLawCorpus extraction output. The implementation follows a **DOM-first approach**: structure is extracted directly from DOM nodes at extraction time, then mapped to character offsets in `content_raw` for traceability.

**Key Principle:** DOM is the source of truth for structure; `content_raw` is the immutable legal anchor.

## Tasks

- [x] 1. Define Pattern Constants and Selectors
  - [x] 1.1 Add STRUCTURE_SELECTORS configuration object to content.js
    - Define statutoryLinks selector for `a[href*="act-details"]`
    - Define tables selector for schedule detection
    - Define allLinks selector for reference extraction
    - _Requirements: 9.1, 9.2_
  - [x] 1.2 Add BENGALI_STRUCTURE_PATTERNS configuration object to bdlaw-extractor.js
    - Define sectionNumber regex for Bengali numeral+danda (১৷, ২৷, ১০৷)
    - Define subsectionMarker regex for Bengali numeral parentheses ((১), (২))
    - Define clauseMarker regex for Bengali letter parentheses ((ক), (খ), (গ))
    - Define preambleStart regex for যেহেতু and WHEREAS patterns
    - Define enactmentClause regex for সেহেতু এতদ্বারা and Be it enacted patterns
    - _Requirements: 2.1, 2.2, 4.1, 5.1, 6.1, 7.1_
  - [x] 1.3 Add CITATION_PATTERNS configuration object to bdlaw-extractor.js
    - Define bengaliCitation regex for Bengali act citations (১৯৯০ সনের ২০ নং আইন)
    - Define englishCitation regex for English act citations (Passport Act, 1920)
    - Define actLinkPattern regex for extracting act_id from href
    - _Requirements: 9.1, 9.2_

- [x] 2. Implement Offset Calculator Utility
  - [x] 2.1 Add calculateOffsetInContentRaw function to bdlaw-extractor.js
    - Accept DOM element textContent and content_raw as inputs
    - Find exact position of text in content_raw using indexOf
    - Handle Unicode normalization edge cases
    - Return character offset or -1 if not found
    - _Requirements: 2.4, 3.4, 4.4, 5.4, 8.3_
  - [x] 2.2 Write property test for offset calculation accuracy
    - **Property 2: Structure Offset Validity**
    - **Validates: Requirements 2.4, 3.4, 4.4, 5.4, 8.3, 8.5**

- [x] 3. Checkpoint - Verify pattern constants and offset calculator
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement DOM Section Extraction
  - [x] 4.1 Add extractSectionsFromDOM function to content.js
    - Query all `.lineremoves` rows from DOM
    - For each row, extract `.txt-head` content (section number + heading)
    - For each row, extract `.txt-details` content (section body)
    - Record dom_index for each section (DOM document order)
    - Parse section_number from .txt-head using sectionNumber regex
    - Parse heading from .txt-head (text before section number)
    - Return sections array with DOM-extracted data
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.5_
  - [x] 4.2 Write property test for DOM-section correspondence
    - **Property 3: DOM-Section Correspondence**
    - **Validates: Requirements 2.1, 2.2, 2.5, 3.1, 3.5**

- [x] 5. Implement Subsection Detection from DOM Content
  - [x] 5.1 Add detectSubsectionsInContent function to bdlaw-extractor.js
    - Accept section content text (from .txt-details textContent)
    - Parse using subsectionMarker regex
    - Record marker text verbatim
    - Record relative offset within section content
    - Return subsections array in document order
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_
  - [x] 5.2 Write property test for subsection nesting correctness
    - **Property 4: Subsection Nesting Correctness**
    - **Validates: Requirements 4.2, 4.5**

- [x] 6. Implement Clause Detection from DOM Content
  - [x] 6.1 Add detectClausesInContent function to bdlaw-extractor.js
    - Accept section/subsection content text
    - Parse using clauseMarker regex
    - Record marker text verbatim
    - Record relative offset within content
    - Return clauses array in document order
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_
  - [x] 6.2 Write property test for clause nesting correctness
    - **Property 5: Clause Nesting Correctness**
    - **Validates: Requirements 5.2, 5.5**

- [x] 7. Checkpoint - Verify section, subsection, and clause extraction
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Preamble Detection from DOM
  - [x] 8.1 Add extractPreambleFromDOM function to content.js
    - Query `.lineremove` (singular) elements from DOM
    - Check textContent for preambleStart patterns (যেহেতু, WHEREAS)
    - Record preamble text verbatim from DOM
    - Record dom_source as ".lineremove"
    - Set has_preamble flag based on detection
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6_
  - [x] 8.2 Write property test for preamble detection
    - **Property: Preamble Detection from DOM**
    - **Validates: Requirements 6.1, 6.3, 6.4**

- [x] 9. Implement Enactment Clause Detection from DOM
  - [x] 9.1 Add extractEnactmentFromDOM function to content.js
    - Query `.lineremove` elements from DOM
    - Check textContent for enactmentClause patterns (সেহেতু এতদ্বারা, Be it enacted)
    - Record enactment clause text verbatim from DOM
    - Record dom_source as ".lineremove"
    - Set has_enactment_clause flag based on detection
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_
  - [x] 9.2 Write property test for enactment clause detection
    - **Property: Enactment Clause Detection from DOM**
    - **Validates: Requirements 7.1, 7.3, 7.4**

- [x] 10. Checkpoint - Verify preamble and enactment detection
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement DOM Reference Link Extraction
  - [x] 11.1 Add extractReferencesFromDOM function to content.js
    - Query all `a[href*="act-details"]` links from DOM
    - For each link, extract textContent as citation_text
    - Extract href attribute
    - Parse act_id from href using actLinkPattern regex
    - Determine containing section by finding parent .lineremoves row
    - Record dom_section_index for scope anchoring
    - _Requirements: 9.1, 9.2, 9.3, 10.1_
  - [x] 11.2 Write property test for link extraction completeness
    - **Property 13: Link Extraction Completeness**
    - **Validates: Requirements 9.1, 9.2**

- [x] 12. Implement Citation Pattern Detection in DOM Content
  - [x] 12.1 Add detectCitationsInContent function to bdlaw-extractor.js
    - Accept section content text
    - Parse using bengaliCitation and englishCitation regexes
    - Record citation_text verbatim
    - Record relative offset within content
    - Return citations array (for non-linked references)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 12.2 Write property test for reference offset validity
    - **Property 6: Reference Offset Validity**
    - **Validates: Requirements 9.3, 9.4**

- [x] 13. Checkpoint - Verify reference extraction
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement Structure Tree Builder
  - [x] 14.1 Add buildStructureTree function to bdlaw-extractor.js
    - Accept DOM-extracted sections, preamble, enactment, and content_raw
    - Map DOM offsets to content_raw offsets using calculateOffsetInContentRaw
    - Build nested JSON tree with sections containing subsections and clauses
    - Calculate content_start and content_end for each element
    - Add metadata (total_sections, total_subsections, total_clauses, extraction_method: "dom_first")
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 14.2 Write property test for document order preservation
    - **Property 9: Document Order Preservation**
    - **Validates: Requirements 2.5, 8.2**
  - [x] 14.3 Write property test for verbatim text preservation
    - **Property 10: Verbatim Text Preservation**
    - **Validates: Requirements 2.3, 2.6, 3.3, 3.6, 4.3, 4.6, 5.3, 5.6, 6.3, 6.5, 7.3, 7.5**

- [x] 15. Implement Reference Scope Anchoring
  - [x] 15.1 Add anchorReferenceScope function to bdlaw-extractor.js
    - Accept reference with dom_section_index and structure tree
    - Look up section by dom_index in structure
    - Determine containing subsection by offset range
    - Determine containing clause by offset range
    - Return scope object with section, subsection, clause, dom_section_index
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [x] 15.2 Write property test for reference scope consistency
    - **Property 7: Reference Scope Consistency**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

- [x] 16. Implement Cross-References Output Builder
  - [x] 16.1 Add buildCrossReferences function to bdlaw-extractor.js
    - Accept DOM-extracted links, pattern-detected citations, structure, and content_raw
    - Merge link references and pattern references (deduplicate by offset)
    - Map offsets to content_raw using calculateOffsetInContentRaw
    - Call anchorReferenceScope for each reference
    - Add reference_semantics: "string_match_only" to each reference
    - Add reference_warning disclaimer to each reference
    - Preserve document order of references
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - [x] 16.2 Write property test for no legal inference
    - **Property 12: No Legal Inference**
    - **Validates: Requirements 9.5, 9.6, 11.3, 11.4, 11.5**

- [x] 17. Checkpoint - Verify structure tree and cross-references building
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Implement Main DOM Structure Extractor
  - [x] 18.1 Add extractStructureFromDOM function to content.js
    - Accept document and content_raw as inputs
    - Call extractPreambleFromDOM
    - Call extractEnactmentFromDOM
    - Call extractSectionsFromDOM
    - For each section, call detectSubsectionsInContent and detectClausesInContent
    - Call buildStructureTree to assemble final structure
    - Return complete structure tree
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 18.2 Add extractReferencesWithScope function to content.js
    - Accept document, content_raw, and structure as inputs
    - Call extractReferencesFromDOM for link-based references
    - Call detectCitationsInContent for pattern-based references in each section
    - Call buildCrossReferences to assemble final cross_references
    - Return complete cross_references array
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 19. Implement Content Raw Immutability Guard
  - [x] 19.1 Add deriveStructureAndReferences function to bdlaw-extractor.js
    - Accept extraction result (with content_raw) and document as inputs
    - Store content_raw hash before processing
    - Call extractStructureFromDOM with document and content_raw
    - Call extractReferencesWithScope with document, content_raw, and structure
    - Verify content_raw hash is unchanged after processing
    - Return new object with structure and cross_references added
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 19.2 Write property test for content raw immutability
    - **Property 1: Content Raw Immutability**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [x] 20. Implement Determinism Verification
  - [x] 20.1 Ensure all extraction functions are deterministic
    - No timestamps in structure or cross_references output
    - No random values
    - Consistent ordering (DOM order preserved)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [x] 20.2 Write property test for deterministic output
    - **Property 8: Deterministic Output**
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 21. Checkpoint - Verify immutability and determinism
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Integrate with Extraction Pipeline
  - [x] 22.1 Update extractActContent in content.js to call structure derivation
    - After content extraction is complete, call extractStructureFromDOM
    - Call extractReferencesWithScope with structure result
    - Add structure field to extraction result
    - Add cross_references field to extraction result
    - Ensure backward compatibility with existing fields
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  - [x] 22.2 Update bdlaw-export.js to include structure and cross_references in JSON export
    - Add structure field to export schema
    - Add cross_references field to export schema
    - Maintain existing field order for compatibility
    - _Requirements: 13.5_
  - [x] 22.3 Write property test for backward compatibility
    - **Property 11: Backward Compatibility**
    - **Validates: Requirements 13.1, 13.2, 13.5**

- [x] 23. Final Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify structure derivation works on sample Bengali acts
  - Verify cross-references include both DOM links and pattern-detected citations
  - Verify content_raw remains unchanged throughout pipeline
  - Verify offsets correctly map DOM elements to content_raw positions

## Notes

- Tasks marked with `*` are optional property tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- **DOM-first approach**: Structure is extracted from DOM nodes (.lineremoves, .txt-head, .txt-details, links) at extraction time
- **Offset mapping**: DOM-extracted text is mapped to content_raw offsets for traceability
- **Two reference sources**: Links (`a[href*="act-details"]`) and pattern-detected citations in text
- Property tests validate universal correctness properties
- Implementation order: patterns → offset calculator → DOM extraction → structure building → integration
