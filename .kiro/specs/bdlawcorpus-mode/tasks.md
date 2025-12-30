# Implementation Plan: BDLawCorpus Extension

## Overview

This implementation plan transforms the existing WebScrape Chrome extension into BDLawCorpus, a research-grade legal text extraction tool for bdlaws.minlaw.gov.bd. The implementation follows a modular approach, building core modules first, then integrating them into the UI.

## Tasks

- [x] 1. Create Page Type Detector Module
  - [x] 1.1 Create bdlaw-page-detector.js with URL pattern matching
    - Implement ALLOWED_ORIGIN constant for http://bdlaws.minlaw.gov.bd
    - Implement URL_PATTERNS with regex for each page type
    - Implement isAllowedDomain(url) function
    - Implement detectPageType(url) function with ACT_DETAILS checked before ACT_SUMMARY
    - Implement getLayerNumber(pageType) and getPageTypeLabel(pageType) helpers
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Write property test for domain restriction
    - **Property 1: Domain Restriction Enforcement**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 1.3 Write property test for page type classification
    - **Property 2: Page Type Classification Determinism**
    - **Property 3: Layer Detection Accuracy**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 2. Create Metadata Generator Module
  - [x] 2.1 Create bdlaw-metadata.js with provenance metadata generation
    - Implement REQUIRED_FIELDS constant array
    - Implement DISCLAIMER constant string
    - Implement generate(url) function returning complete metadata object
    - Implement validate(metadata) function returning { valid, missing }
    - Implement getDisclaimer() function
    - Ensure source_url preserves original HTTP URL exactly
    - _Requirements: 8.1, 8.2, 8.3, 10.1, 10.2_

  - [x] 2.2 Write property test for metadata completeness
    - **Property 4: Metadata Completeness**
    - **Property 5: Metadata Validation Rejection**
    - **Validates: Requirements 8.1, 8.2**

  - [x] 2.3 Write property test for URL preservation
    - **Property 11: URL Preservation**
    - **Validates: Requirements 1.5**

- [x] 3. Create Legal Extractor Module
  - [x] 3.1 Create bdlaw-extractor.js with content extraction logic
    - Implement LEGAL_SELECTORS constant with ordered selector arrays
    - Implement SECTION_MARKERS constant array
    - Implement extractActContent(document) for Layer 3 pages
    - Implement extractVolumeData(document) for Layer 2 pages
    - Implement detectSectionMarkers(text) with line number computation
    - Implement countSectionMarkers(text) returning counts object
    - Ensure selectors are tried in order, first non-empty match used
    - _Requirements: 7.1, 9.1, 9.2, 9.4, 9.5_

  - [x] 3.2 Write property test for section marker detection
    - **Property 7: Section Marker Detection Completeness**
    - **Validates: Requirements 9.1, 9.2**

  - [x] 3.3 Write property test for content preservation
    - **Property 8: Content Preservation**
    - **Validates: Requirements 9.4, 9.5**

- [x] 4. Checkpoint - Core Modules Complete
  - Ensure all unit tests pass for page detector, metadata generator, and legal extractor
  - Ask the user if questions arise

- [x] 5. Create Export Handler Module
  - [x] 5.1 Create bdlaw-export.js with JSON formatting and download
    - Implement formatActExport(content, metadata) returning JSON string
    - Implement formatVolumeExport(acts, metadata) returning JSON string
    - Implement generateActFilename(actNumber, timestamp) with format bdlaw_act_{num}_{ts}.json
    - Implement generateVolumeFilename(volumeNumber, timestamp) with format bdlaw_volume_{num}_{ts}.json
    - Implement validateJSON(jsonString) function
    - Implement triggerDownload(content, filename) using chrome.downloads API
    - Ensure UTF-8 encoding for Bengali characters
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 5.2 Write property test for JSON round-trip
    - **Property 6: Export JSON Round-Trip**
    - **Validates: Requirements 12.1, 12.5**

  - [x] 5.3 Write property test for filename uniqueness
    - **Property 9: Filename Uniqueness**
    - **Validates: Requirements 5.6, 12.4**

- [x] 6. Modify Popup HTML for BDLawCorpus UI
  - [x] 6.1 Update popup.html with research-focused layout
    - Add page type indicator section at top
    - Add workflow progress indicator (3 steps)
    - Add contextual help text area
    - Add metadata preview section (collapsible)
    - Add section marker counts display
    - Add ethical disclaimer footer with distinct styling
    - Remove generic scraping controls (Scrape Links button)
    - Remove irrelevant text processing options
    - _Requirements: 13.1, 13.2, 14.1, 14.2, 14.3, 15.1, 16.1, 16.2, 16.3_

- [x] 7. Modify Popup CSS for BDLawCorpus Styling
  - [x] 7.1 Update popup.css with layer-specific visual styles
    - Add styles for page type indicator (gray/blue/green/red)
    - Add styles for workflow progress indicator
    - Add styles for section marker highlighting (distinct colors per type)
    - Add styles for metadata preview section
    - Add styles for ethical disclaimer footer
    - Add readable Bengali font styling for preview
    - Remove animations, keep clean academic design
    - _Requirements: 13.3, 13.4, 13.5, 13.6, 9.6, 15.2, 16.5_

- [x] 8. Modify Popup JavaScript for BDLawCorpus Logic
  - [x] 8.1 Update popup.js to integrate BDLawCorpus modules
    - Import page detector, metadata generator, legal extractor, export handler
    - Implement page type detection on popup open
    - Implement UI state management based on page type
    - Implement extraction button enable/disable based on layer
    - Implement workflow step highlighting
    - Implement contextual help text updates
    - _Requirements: 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [x] 8.2 Implement extraction preview with section highlighting
    - Display extracted content in preview area
    - Highlight section markers with distinct colors
    - Display section counts in preview header
    - Display character and word counts
    - Implement line number display
    - _Requirements: 9.1, 9.2, 9.6, 15.1, 15.3, 15.4, 15.5_

  - [x] 8.3 Implement export with confirmation dialog
    - Display metadata preview before save
    - Show confirmation dialog with extraction summary
    - Validate metadata before export
    - Handle file overwrite confirmation
    - Trigger download with correct filename
    - _Requirements: 5.4, 5.5, 8.4, 8.5, 9.3_

- [x] 9. Checkpoint - UI Integration Complete
  - Ensure popup correctly detects page types
  - Ensure extraction works for Volume and Act Detail pages
  - Ensure export produces valid JSON with metadata
  - Ask the user if questions arise

- [x] 10. Modify Content Script for BDLawCorpus Extraction
  - [x] 10.1 Update content.js with BDLawCorpus extraction handlers
    - Add message handler for 'bdlaw:extractAct' action
    - Add message handler for 'bdlaw:extractVolume' action
    - Use hardcoded LEGAL_SELECTORS only
    - Preserve original Bengali text without modification
    - Return structured extraction result
    - _Requirements: 7.1, 7.2, 7.3, 9.4, 9.5, 17.1, 17.2_

- [x] 11. Update Manifest for BDLawCorpus
  - [x] 11.1 Update manifest.json with BDLawCorpus branding and permissions
    - Update extension name to "BDLawCorpus"
    - Update description for academic research purpose
    - Restrict host_permissions to http://bdlaws.minlaw.gov.bd/*
    - Remove unnecessary permissions
    - _Requirements: 1.1, 1.2_

- [x] 12. Checkpoint - Full Integration Complete
  - Test complete workflow: Range Index → Volume → Act Details
  - Verify domain restriction works
  - Verify metadata is complete in exports
  - Verify Bengali text preservation
  - Ask the user if questions arise

- [x] 13. Write Integration Tests
  - [x] 13.1 Write extraction workflow integration test
    - Test Volume page catalog extraction
    - Test Act Detail page content extraction
    - Test metadata injection
    - Test JSON export format
    - _Requirements: 4.1, 5.1, 8.1, 12.1, 12.2_

  - [x] 13.2 Write property test for extraction reproducibility
    - **Property 10: Extraction Reproducibility**
    - **Validates: Requirements 12.6**

- [x] 14. Final Checkpoint - All Tests Pass
  - Ensure all unit tests pass
  - Ensure all property tests pass (minimum 100 iterations each)
  - Ensure all integration tests pass
  - Ask the user if questions arise

- [x] 15. Create Persistent Side Panel UI
  - [x] 15.1 Create sidepanel.html with three-tab layout
    - Implement Capture tab with volume and act capture buttons
    - Implement Queue tab with queue list and processing controls
    - Implement Export tab with statistics and export buttons
    - Add connection status indicator
    - Add page type badge display
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 15.2 Create sidepanel.css with responsive styling
    - Style tab navigation
    - Style queue items with status indicators
    - Style export statistics display
    - Style progress indicators
    - _Requirements: 18.4, 18.5_

  - [x] 15.3 Create sidepanel.js with state management
    - Implement Chrome storage persistence for queue and captured acts
    - Implement tab switching logic
    - Implement page detection on tab change
    - Implement connection status updates
    - _Requirements: 18.3, 18.5, 19.5_

- [x] 16. Implement Batch Collection Queue
  - [x] 16.1 Implement volume catalog capture
    - Extract all acts from volume page
    - Store volume metadata with act list
    - Display captured volume information
    - _Requirements: 19.1, 19.2_

  - [x] 16.2 Implement queue management
    - Add all acts from volume to queue
    - Add individual acts to queue
    - Remove items from queue
    - Display queue status (pending/processing/completed)
    - _Requirements: 19.3, 19.4, 19.6, 19.7_

- [x] 17. Implement Queue Processing
  - [x] 17.1 Implement automatic queue processing
    - Navigate to each queued act URL
    - Extract content using standard extraction
    - Update queue item status
    - Store extracted content
    - Handle extraction errors gracefully
    - Display progress indicator
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [x] 18. Implement Bulk Corpus Export
  - [x] 18.1 Implement export statistics display
    - Show total captured acts count
    - Show unique volumes count
    - Show total character count
    - _Requirements: 21.1_

  - [x] 18.2 Implement corpus export functionality
    - Generate single JSON corpus file
    - Include corpus-level metadata
    - Include all captured acts with metadata
    - Support metadata inclusion toggle
    - Support pretty-print toggle
    - Generate filename with act count and timestamp
    - _Requirements: 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

- [x] 19. Update Manifest for Side Panel
  - [x] 19.1 Update manifest.json with side panel configuration
    - Add sidePanel permission
    - Add storage permission
    - Add tabs permission
    - Configure side_panel with default_path
    - Remove default_popup (side panel replaces popup)
    - Bump version to 1.2.0
    - _Requirements: 18.1_

- [x] 20. Update Background Script for Side Panel
  - [x] 20.1 Update background.js with side panel handler
    - Add chrome.action.onClicked listener
    - Open side panel on extension icon click
    - _Requirements: 18.1_

- [x] 21. Implement Volume DataTable Extraction
  - [x] 21.1 Update bdlaw-extractor.js with DataTable extraction
    - Add LEGAL_SELECTORS.volumeTable selector for `table.table-search tbody tr`
    - Implement extractVolumeFromDataTable(document) function
    - Extract Cell 0 (hidden year/ID), Cell 1 (title with anchor), Cell 2 (act number)
    - Extract act URL from anchor href attribute
    - Extract act ID from URL pattern `/act-{ID}.html`
    - Normalize relative URLs to absolute with bdlaws.minlaw.gov.bd domain
    - Preserve original row order with rowIndex property
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6_

  - [x] 21.2 Write property test for Volume DataTable extraction
    - **Property 14: Volume DataTable Extraction Accuracy**
    - **Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.6**

  - [x] 21.3 Write property test for URL normalization
    - **Property 15: URL Normalization**
    - **Validates: Requirements 22.5**

- [x] 22. Implement Act Section-Row Extraction
  - [x] 22.1 Update bdlaw-extractor.js with section-row extraction
    - Add LEGAL_SELECTORS for actContainer, sectionRows, sectionTitle, sectionBody
    - Implement extractActFromSectionRows(document) function
    - Target `.boxed-layout` container
    - Extract metadata from `.bg-act-section` or `.act-role-style`
    - Iterate through `.lineremoves` rows
    - Extract section title from `.col-sm-3.txt-head`
    - Extract section body from `.col-sm-9.txt-details`
    - Preserve title-body association and document order
    - Track hasTable flag for sections containing tables
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7_

  - [x] 22.2 Write property test for section row extraction
    - **Property 16: Section Row Extraction Completeness**
    - **Validates: Requirements 23.3, 23.4, 23.5, 23.6, 23.7**

- [x] 23. Implement Matrix-Based Table Parsing
  - [x] 23.1 Add extractTableWithMergedCells function to bdlaw-extractor.js
    - Implement matrix-based algorithm for rowspan/colspan handling
    - Track cell positions across rows to prevent data shifting
    - Handle tables with class `MsoTableGrid` and `table-bordered`
    - Normalize whitespace (collapse multiple spaces, replace &nbsp;)
    - Return 2D array preserving row and column positions
    - Mark merged cells appropriately in output
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7_

  - [x] 23.2 Write property test for table matrix parsing
    - **Property 17: Table Matrix Parsing Integrity**
    - **Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.6, 24.7**

- [x] 24. Implement Amendment Marker Detection
  - [x] 24.1 Add amendment marker detection to bdlaw-extractor.js
    - Add AMENDMENT_MARKERS constant array: ['বিলুপ্ত', 'সংশোধিত', 'প্রতিস্থাপিত']
    - Implement detectAmendmentMarkers(text) function
    - Return array with type, line, lineNumber, position, and context
    - Extract surrounding context (20 chars before/after)
    - Preserve original text unchanged
    - _Requirements: 25.1, 25.2, 25.3, 25.4_

  - [x] 24.2 Write property test for amendment marker detection
    - **Property 18: Amendment Marker Detection Completeness**
    - **Validates: Requirements 25.1, 25.2, 25.3, 25.4**

- [x] 25. Update Export Schema for Structured Data
  - [x] 25.1 Update bdlaw-export.js to include structured sections
    - Add structured_sections array to act export
    - Add tables array with 2D data and merged cell flags
    - Add amendments array with marker locations
    - Update formatActExport to include new fields
    - _Requirements: 12.1, 23.6, 24.7, 25.3_

- [x] 26. Update UI for Amendment Highlighting
  - [x] 26.1 Update sidepanel.js to display amendment markers
    - Add distinct visual highlighting for amendment markers in preview
    - Display amendment count alongside section counts
    - Use different color for বিলুপ্ত (deleted) vs সংশোধিত (amended)
    - _Requirements: 25.5_

  - [x] 26.2 Update sidepanel.css with amendment marker styles
    - Add styles for amendment marker highlighting
    - Use red/orange tones for deleted/amended markers
    - _Requirements: 25.5_

- [x] 27. Checkpoint - DOM Structure Extraction Complete
  - Ensure Volume DataTable extraction works correctly
  - Ensure Act section-row extraction preserves title-body pairs
  - Ensure table parsing handles merged cells without data shifting
  - Ensure amendment markers are detected and highlighted
  - Ask the user if questions arise

- [x] 28. Integration Testing for DOM Extraction
  - [x] 28.1 Update integration tests for new extraction methods
    - Test DataTable extraction with real volume page structure
    - Test section-row extraction with real act page structure
    - Test table parsing with rowspan/colspan examples
    - Test amendment marker detection in legal text
    - _Requirements: 22.1-22.6, 23.1-23.7, 24.1-24.7, 25.1-25.4_

- [x] 29. Final Checkpoint - All DOM Extraction Tests Pass
  - Ensure all new property tests pass (minimum 100 iterations each)
  - Ensure all integration tests pass
  - Verify exports include structured sections, tables, and amendments
  - Ask the user if questions arise

- [x] 30. Implement Content Noise Filtering
  - [x] 30.1 Update bdlaw-extractor.js with noise filtering
    - Add UI_NOISE_PATTERNS constant array with patterns: 'প্রিন্ট ভিউ', 'Top', 'Copyright ©'
    - Implement filterContentNoise(text) function
    - Remove UI navigation elements from extracted content
    - Remove copyright notices and footer text
    - Trim empty whitespace-only lines at beginning and end
    - Preserve all Bengali legal text and section markers
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6_

  - [x] 30.2 Write property test for content noise filtering
    - **Property 19: Content Noise Filtering Preservation**
    - Test that legal text is preserved after filtering
    - Test that UI noise patterns are removed
    - Test that section markers are never filtered
    - **Validates: Requirements 28.1, 28.2, 28.3, 28.5, 28.6**

- [x] 31. Implement Queue Deduplication
  - [x] 31.1 Update sidepanel.js with queue deduplication
    - Implement isDuplicateInQueue(actNumber) function
    - Check for existing act_number before adding to queue
    - Display notification when duplicate is skipped
    - Track and display count of skipped duplicates when adding from volume
    - Use act_number as unique identifier
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5_

  - [x] 31.2 Write property test for queue deduplication
    - **Property 20: Queue Deduplication Uniqueness**
    - Test that duplicate act_numbers are rejected
    - Test that unique act_numbers are accepted
    - Test that skipped count is accurate
    - **Validates: Requirements 27.1, 27.2, 27.4**

- [x] 32. Implement Volume Number Tracking
  - [x] 32.1 Update sidepanel.js with volume number tracking
    - Implement extractVolumeNumber(url) function to parse volume-{XX}.html pattern
    - Store volume_number when capturing acts from Volume_Page
    - Include volume_number in captured act data
    - Set volume_number to "unknown" for direct Act_Detail_Page captures
    - _Requirements: 29.1, 29.2, 29.3, 29.5_

  - [x] 32.2 Write property test for volume number extraction
    - **Property 21: Volume Number Extraction Accuracy**
    - Test extraction from valid volume URLs
    - Test handling of non-volume URLs
    - **Validates: Requirements 29.2, 29.5**

- [x] 33. Implement Corpus Export Structured Data
  - [x] 33.1 Update sidepanel.js corpus export to include structured data
    - Include structured_sections array for each act in corpus export
    - Include tables array for each act in corpus export
    - Include amendments array for each act in corpus export
    - Include volume_number for each act (not null)
    - Use empty arrays when structured data is not available
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 29.4_

  - [x] 33.2 Write property test for corpus export completeness
    - **Property 22: Corpus Export Structured Data Completeness**
    - Test that all acts include structured_sections, tables, amendments arrays
    - Test that volume_number is never null
    - Test that empty arrays are used when data unavailable
    - **Validates: Requirements 26.1, 26.2, 26.3, 26.5, 29.4**

- [x] 34. Checkpoint - Corpus Export Fixes Complete
  - Ensure content noise filtering removes UI elements but preserves legal text
  - Ensure queue deduplication prevents duplicate acts
  - Ensure volume number is tracked for all captured acts
  - Ensure corpus export includes all structured data fields
  - Run all property tests (minimum 100 iterations each)
  - Run all integration tests
  - Ask the user if questions arise

- [x] 35. Fix Content Script Structured Extraction Integration
  - [x] 35.1 Update content.js to use structured extraction methods
    - Add DOM-specific selectors (actContainer, actMetadata, sectionRows, sectionTitle, sectionBody)
    - Add BDLAW_AMENDMENT_MARKERS constant array
    - Add BDLAW_UI_NOISE_PATTERNS constant array
    - Implement bdlawDetectAmendmentMarkers(text) function
    - Implement bdlawFilterContentNoise(text) function
    - Implement bdlawExtractTableWithMergedCells(tableElement) function
    - Implement bdlawExtractActFromSectionRows() function
    - Update extractBDLawActContent() to use structured extraction first
    - Apply noise filtering to content and structured section bodies
    - Return structured_sections, tables, and amendments arrays
    - _Requirements: 23.1-23.7, 24.1-24.7, 25.1-25.5, 28.1-28.6_

  - [x] 35.2 Update sidepanel.js to store structured data from extraction
    - Update captureCurrentAct() to store structured_sections, tables, amendments
    - Update queue processing to store structured data when capturing acts
    - _Requirements: 26.1, 26.2, 26.3_

- [x] 36. Implement Independent File Export
  - [x] 36.1 Update sidepanel.js export functions for individual act files
    - Implement exportSingleAct(act) function to export one act as JSON file
    - Generate filename: bdlaw_act_{act_number}_{timestamp}.json
    - Include complete metadata in each individual file
    - Remove combined corpus export as default behavior
    - _Requirements: 31.1, 31.2_

  - [x] 36.2 Implement batch export of all acts as separate files
    - Implement exportAllAsSeparateFiles() function
    - Export each captured act as individual JSON file
    - Add delay between downloads to prevent browser blocking
    - Display progress indicator during batch export
    - _Requirements: 31.5, 31.8_

  - [x] 36.3 Implement volume catalog export
    - Implement exportVolumeCatalog() function
    - Generate filename: bdlaw_volume_{volume_number}_{timestamp}.json
    - Export current volume's act list with metadata
    - _Requirements: 31.3, 31.4, 31.6_

  - [x] 36.4 Update Export tab UI for independent file export
    - Replace "Export All" button with "Export All as Separate Files"
    - Add "Export Volume Catalog" button
    - Add "Export Selected Act" option for individual act export
    - Update statistics display for individual file export
    - _Requirements: 31.5, 31.6, 31.7_

- [x] 37. Implement Data Reset and Clearing
  - [x] 37.1 Add clearAllData() function to sidepanel.js
    - Implement clearAllData() function to clear all captured acts, queue items, and current volume
    - Display confirmation dialog showing count of items to be deleted
    - Clear state and browser storage when confirmed
    - Update all UI elements to reflect cleared state
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7_

  - [x] 37.2 Add Clear All Data button to Export tab UI
    - Add "Clear All Data" button with danger styling
    - Add warning message below button indicating action is permanent
    - Bind click event to clearAllData() function
    - _Requirements: 32.1, 32.8_

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The implementation modifies the existing WebScrape extension minimally
- All automation features from the original extension are removed or disabled
- Tasks 21-29 implement the DOM structure refinements for accurate extraction
- Tasks 30-34 implement corpus export quality improvements identified from output review
- Task 35 fixes a critical integration issue where content.js was not using the structured extraction methods from bdlaw-extractor.js, resulting in empty structured_sections, tables, and amendments arrays in corpus exports

## Schema Version History

### Schema v2.0 (Current - 2025-12-28)

**Publication-grade schema changes**:

1. **Identifier Separation**: Added `identifiers` object to distinguish internal database IDs from legal citation numbers
   ```json
   "identifiers": {
     "internal_id": "754",
     "note": "internal_id is the bdlaws database identifier, not the legal citation number"
   }
   ```

2. **Marker Frequency Clarification**: Each marker now includes `count` and `method` fields
   ```json
   "marker_frequency": {
     "ধারা": { "count": 12, "method": "raw string frequency, including cross-references" }
   }
   ```

3. **Backward Compatibility**: `act_number` field retained but marked DEPRECATED

**Rationale**: 
- Reviewers asked: "Are these counts structural, lexical, or referential?" - now explicitly documented
- Legal citation (e.g., "১৯৯১ সনের ২১ নং আইন") differs from internal_id (e.g., "754") - now separated

### Schema v1.0 (Initial)

- `act_number`: Internal database ID (misleadingly named)
- `marker_frequency`: Simple integer counts without methodology documentation

## Observations from Corpus Analysis

### Volume 28 Analysis (Acts 734-754)

Analysis of 22 exported files from Volume 28 revealed:

**Document Types Identified**:
| Type | Examples | Typical Length | Notes |
|------|----------|----------------|-------|
| Repeal Act | 737 | ~300 chars | Intentionally minimal |
| Appropriation Act | 752, 753 | ~700 chars | Schedule content missing from HTML |
| Substantive Act | 738, 750 | 5,000-8,000 chars | Full legal frameworks |
| Finance/Amendment Act | 754 | 10,000+ chars | Heavy cross-references |

**Key Findings**:
1. Short content is NOT extraction failure - repeal/appropriation acts are legitimately minimal
2. `marker_frequency.তফসিল` counts references to schedules not present in HTML
3. `marker_frequency.ধারা` includes cross-references to other laws (e.g., Income Tax Ordinance)
4. Mixed English/Bengali drafting common in older acts

### Earlier Corpus Analysis (79 acts)

Analysis of `bdlaw_corpus_79acts_2025-12-28T06-59-10.json` revealed:
1. **Content noise not filtered**: All 79 acts contained UI elements (প্রিন্ট ভিউ, Top, Copyright)
2. **Empty structured data**: All acts had empty structured_sections, tables, and amendments arrays
3. **Root cause**: content.js used generic selectors and didn't integrate the structured extraction methods

**Resolution**: Task 35 updated content.js to:
- Use structured extraction from `.boxed-layout` + `.lineremoves` when available
- Apply noise filtering during extraction
- Extract tables with merged cell handling
- Detect amendment markers
- Return complete structured data to sidepanel.js

