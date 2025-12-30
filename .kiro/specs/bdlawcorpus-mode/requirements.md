# Requirements Document

## Introduction

BDLawCorpus is a purpose-built Chrome extension for academic extraction of Bangladeshi legal texts from the official bdlaws.minlaw.gov.bd website. The tool enforces strict manual, page-level extraction with mandatory provenance metadata to support reproducible academic research in Digital Humanities and Access to Information.

This tool prioritizes research ethics, transparency, and reproducibility over convenience or speed. It explicitly prohibits automation, bulk scraping, and content modification to maintain academic credibility.

## Website Structure

The bdlaws.minlaw.gov.bd website has a THREE-LAYER hierarchical structure:

### Layer 1: Range Index Page
- **URL Pattern**: `/laws-of-bangladesh.html`
- **Content**: Lists ranges of laws organized by year and volume number
- **Purpose**: Navigation entry point only
- **Contains**: Links to Volume Pages, NOT individual laws
- **Extraction**: Navigation metadata only (volume references)

### Layer 2: Volume Pages
- **URL Pattern**: `/volume-{XX}.html`
- **Content**: Lists multiple individual Acts/Ordinances within a volume
- **Purpose**: Acts catalog for a specific volume/year range
- **Contains**: Links to individual Act pages
- **Extraction**: Act metadata (title, year, act number, URL) for corpus indexing

### Layer 3: Act Detail Pages
- **URL Pattern**: `/act-details-{XXXX}.html`
- **Content**: Full legal text of ONE law
- **Purpose**: Authoritative source for legal text extraction
- **Contains**: Complete Bengali legal text
- **Extraction**: Full content with provenance metadata

**Navigation Flow Example**:
```
laws-of-bangladesh.html → volume-56.html → act-1514.html → act-details-1514.html
```

**Critical Rules**:
- Each individual law MUST be visited and extracted manually, one by one
- Bulk or automated traversal is PROHIBITED
- English and Bangla views represent the SAME law; only the Bangla version is extracted
- `act-details-*.html` is the authoritative extraction target
- Range pages and language toggles MUST NOT be treated as separate laws

## Glossary

- **Extension**: The BDLawCorpus Chrome browser extension
- **Range_Index_Page**: The laws-of-bangladesh.html page listing volume/year ranges (Layer 1)
- **Volume_Page**: A volume-XX.html page listing acts within that volume (Layer 2)
- **Act_Detail_Page**: An act-details-XXXX.html page containing full legal text (Layer 3)
- **Act_Summary_Page**: An act-XXXX.html page (intermediate, redirects to details)
- **Provenance_Metadata**: Structured data recording the source, timestamp, and method of extraction
- **Legal_Selector**: Predefined CSS selectors for extracting legal content elements
- **Section_Marker**: Bengali text patterns (ধারা, অধ্যায়, তফসিল) indicating legal document structure
- **Amendment_Marker**: Bengali text patterns (বিলুপ্ত, সংশোধিত) indicating deleted or amended provisions
- **Content**: The legal text rendered on the Act_Detail_Page, excluding UI elements, navigation menus, advertisements, or scripts
- **User**: A research student, digital humanities scholar, or legal accessibility researcher
- **Page_Type_Indicator**: Visual UI element showing current page layer and allowed actions
- **DataTable**: The `table.table-search` element used on Volume pages to list acts
- **Section_Row**: A `.lineremoves` row element containing section title and body columns
- **Merged_Cell**: A table cell with `rowspan` or `colspan` attributes requiring matrix-based parsing
- **Corpus_Export**: A single JSON file containing all captured acts with corpus-level and individual metadata
- **Captured_Act**: An act that has been extracted and stored in browser storage awaiting export
- **UI_Noise**: Non-legal text elements such as navigation links, print buttons, and copyright notices that should be filtered from extracted content

## Requirements

### Requirement 1: Domain Restriction

**User Story:** As a researcher, I want the extension to only operate on the official Bangladesh Laws website, so that I cannot accidentally scrape unauthorized sources.

#### Acceptance Criteria

1. WHEN the current URL does not match `http://bdlaws.minlaw.gov.bd/*`, THE Extension SHALL disable all extraction buttons
2. WHEN the current URL matches `http://bdlaws.minlaw.gov.bd/*`, THE Extension SHALL enable extraction functionality appropriate to the page layer
3. THE Extension SHALL display a clear message indicating "This tool only works on bdlaws.minlaw.gov.bd" when extraction is disabled due to domain mismatch
4. THE Extension SHALL display the domain restriction prominently in the popup header area
5. THE Extension SHALL preserve the original HTTP source URL exactly as served by the website in all provenance metadata

### Requirement 2: Three-Layer Page Detection

**User Story:** As a researcher, I want the tool to correctly identify which layer of the website I'm on, so that I understand what extraction is possible.

#### Acceptance Criteria

1. WHEN the URL matches `/laws-of-bangladesh.html`, THE Extension SHALL detect this as a Range_Index_Page (Layer 1)
2. WHEN the URL matches `/volume-*.html`, THE Extension SHALL detect this as a Volume_Page (Layer 2)
3. WHEN the URL matches `/act-details-*.html`, THE Extension SHALL detect this as an Act_Detail_Page (Layer 3)
4. WHEN the URL matches `/act-*.html` but NOT `/act-details-*.html`, THE Extension SHALL detect this as an Act_Summary_Page and guide user to the details page
5. THE Extension SHALL display the detected page layer prominently in the UI
6. Volume_Page detection SHALL rely on URL pattern AND page content indicators, not numeric assumptions alone

### Requirement 3: Range Index Page Behavior (Layer 1)

**User Story:** As a researcher, I want the tool to prevent content extraction on the range index page, so that I don't mistakenly treat navigation links as legal content.

#### Acceptance Criteria

1. WHEN on a Range_Index_Page, THE Extension SHALL disable all content extraction buttons
2. WHEN on a Range_Index_Page, THE Extension SHALL display message: "Navigation Page: Browse to a Volume page to see available acts"
3. WHEN on a Range_Index_Page, THE Extension SHALL NOT allow any data export
4. THE Extension SHALL clearly indicate this page contains NO legal text

### Requirement 4: Volume Page Behavior (Layer 2)

**User Story:** As a researcher, I want to extract act metadata from volume pages, so that I can build a catalog of available laws before extracting individual acts.

#### Acceptance Criteria

1. WHEN on a Volume_Page, THE Extension SHALL allow extraction of act metadata ONLY: title (Bengali), year, act number, and URL to act-details page
2. WHEN on a Volume_Page, THE Extension SHALL disable full content extraction
3. WHEN on a Volume_Page, THE Extension SHALL display message: "Volume Index: Extract act catalog for this volume"
4. THE Extension SHALL export Volume_Page data as structured JSON array with act references
5. THE Extension SHALL clearly indicate this page is for CATALOGING, not content extraction

### Requirement 5: Act Detail Page Behavior (Layer 3)

**User Story:** As a researcher, I want to extract full legal text from act detail pages, so that I can build my corpus one law at a time.

#### Acceptance Criteria

1. WHEN on an Act_Detail_Page, THE Extension SHALL enable full content extraction
2. WHEN on an Act_Detail_Page, THE Extension SHALL extract content from only the current page
3. WHEN on an Act_Detail_Page, THE Extension SHALL display message: "Act Detail: Extract full legal text"
4. THE Extension SHALL NOT provide batch export or multi-page extraction functionality
5. WHEN a user initiates export, THE Extension SHALL display a preview of the content before saving
6. THE Extension SHALL generate unique filenames including act number and extraction timestamp

### Requirement 6: Act Summary Page Guidance

**User Story:** As a researcher, I want guidance when I'm on an intermediate act page, so that I navigate to the correct extraction target.

#### Acceptance Criteria

1. WHEN on an Act_Summary_Page (act-*.html but not act-details-*.html), THE Extension SHALL display a guidance message
2. THE Extension SHALL indicate: "Navigate to 'View Details' or 'বিস্তারিত দেখুন' for full text extraction"
3. THE Extension SHALL disable content extraction on Act_Summary_Pages
4. THE Extension SHALL NOT treat Act_Summary_Pages as valid extraction targets

### Requirement 7: Hardcoded Legal Selectors

**User Story:** As a researcher, I want the tool to use only predefined selectors for legal content, so that extraction is consistent and reproducible across all acts.

#### Acceptance Criteria

1. THE Extension SHALL use ONLY the following selectors for content extraction: `h1`, `.act-title`, `#lawContent`, `.law-content`, `.act-details`, `.act-meta`, `.law-header`, `table`, `.schedule`, `#schedule`, `.boxed-layout`, `.lineremoves`, `.txt-head`, `.txt-details`, `.bg-act-section`, `.act-role-style`
2. THE Extension SHALL NOT accept user-defined CSS selectors
3. THE Extension SHALL NOT accept user-defined XPath expressions
4. THE Extension SHALL document the hardcoded selectors in a collapsible "Technical Details" section in the UI

### Requirement 22: Volume Page DOM Structure Extraction

**User Story:** As a researcher, I want the tool to accurately extract act metadata from the DataTable structure on volume pages, so that I get complete and correctly ordered catalog data.

#### Acceptance Criteria

1. WHEN extracting from a Volume_Page, THE Extension SHALL target the `table.table-search tbody tr` structure
2. FOR EACH row in the DataTable, THE Extension SHALL extract: Cell 0 (hidden year/ID), Cell 1 (title with anchor link), Cell 2 (act number)
3. THE Extension SHALL extract the act URL from the anchor element in Cell 1
4. THE Extension SHALL extract the act ID from the href attribute pattern `/act-{ID}.html`
5. THE Extension SHALL normalize relative URLs to absolute URLs with the bdlaws.minlaw.gov.bd domain
6. THE Extension SHALL preserve the original row order from the DataTable

### Requirement 23: Act Content DOM Structure Extraction

**User Story:** As a researcher, I want the tool to accurately extract legal text from the section-based row structure on act detail pages, so that section titles and bodies are correctly associated.

#### Acceptance Criteria

1. WHEN extracting from an Act_Detail_Page, THE Extension SHALL target the `.boxed-layout` container
2. THE Extension SHALL extract metadata (title, date) from `.bg-act-section` or `.act-role-style` elements
3. THE Extension SHALL iterate through `.lineremoves` rows to extract section content
4. FOR EACH Section_Row, THE Extension SHALL extract the section title from `.col-sm-3.txt-head`
5. FOR EACH Section_Row, THE Extension SHALL extract the section body from `.col-sm-9.txt-details`
6. THE Extension SHALL preserve the association between section titles and their corresponding bodies
7. THE Extension SHALL maintain the original document order of sections

### Requirement 24: Table Parsing with Merged Cell Handling

**User Story:** As a researcher, I want the tool to correctly parse tables with merged cells (rowspan/colspan), so that tabular legal data maintains its structural integrity.

#### Acceptance Criteria

1. WHEN parsing tables with `rowspan` attributes, THE Extension SHALL use a matrix-based algorithm to track cell positions
2. WHEN parsing tables with `colspan` attributes, THE Extension SHALL correctly span content across columns
3. THE Extension SHALL NOT shift cell data when encountering merged cells in subsequent rows
4. THE Extension SHALL preserve the logical grid structure of tables in the extracted data
5. THE Extension SHALL handle tables with class `MsoTableGrid` (Word-generated HTML) and `table-bordered`
6. THE Extension SHALL normalize whitespace within table cells (collapse multiple spaces to single space)
7. THE Extension SHALL export table data as a 2D array preserving row and column positions

### Requirement 25: Amendment and Deletion Marker Detection

**User Story:** As a researcher, I want the tool to identify and flag deleted or amended provisions, so that I can distinguish current law from historical changes.

#### Acceptance Criteria

1. THE Extension SHALL detect Amendment_Markers in legal text: "বিলুপ্ত" (deleted/abolished), "সংশোধিত" (amended), "প্রতিস্থাপিত" (substituted)
2. WHEN an Amendment_Marker is detected, THE Extension SHALL flag the containing section in the export
3. THE Extension SHALL include an `amendments` array in the export listing all detected amendment markers with their locations
4. THE Extension SHALL NOT modify or remove amended/deleted text from the content
5. THE Extension SHALL display amendment markers with distinct visual highlighting in the preview

### Requirement 8: Mandatory Metadata Injection

**User Story:** As a researcher, I want every exported file to contain provenance metadata, so that my dataset is fully traceable and citable.

#### Acceptance Criteria

1. THE Extension SHALL inject the following metadata into every export: source domain, source URL, extraction timestamp (ISO 8601), scraping method ("manual page-level extraction"), tool name ("BDLawCorpus"), language code ("bn"), research purpose ("academic legal corpus construction")
2. IF any required metadata field is missing or empty, THEN THE Extension SHALL prevent the export and display an error message
3. THE Extension SHALL format exports as structured JSON with metadata in a dedicated `_metadata` object
4. THE Extension SHALL include the original Bengali text in a `content` field without modification
5. THE Extension SHALL display a "Metadata Preview" section showing all provenance fields before export

### Requirement 9: Section Awareness with Human Confirmation

**User Story:** As a researcher, I want the tool to highlight legal section markers and require my confirmation before saving, so that I can verify the extraction quality.

#### Acceptance Criteria

1. WHEN displaying a preview, THE Extension SHALL highlight lines containing Section_Markers: ধারা (Section), অধ্যায় (Chapter), তফসিল (Schedule)
2. THE Extension SHALL display a count of detected Section_Markers in the preview header
3. WHEN a user clicks "Save", THE Extension SHALL display a confirmation dialog showing extraction summary including section counts
4. THE Extension SHALL NOT automatically restructure or modify the legal text content
5. THE Extension SHALL preserve original Bengali text exactly as it appears on the source page
6. THE Extension SHALL use distinct visual highlighting (e.g., background color) for each Section_Marker type

### Requirement 10: Ethical Disclaimer Display

**User Story:** As a researcher, I want a visible ethical disclaimer in the UI, so that the tool's academic purpose and limitations are clear.

#### Acceptance Criteria

1. THE Extension SHALL display the following disclaimer in the popup footer: "This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed."
2. THE Extension SHALL include the disclaimer text in the metadata of every exported file
3. THE Extension SHALL display the disclaimer prominently and persistently in the popup UI with a distinct visual style

### Requirement 11: Automation Prevention

**User Story:** As a researcher, I want the tool to prevent any form of automation, so that my data collection methodology is academically defensible.

#### Acceptance Criteria

1. THE Extension SHALL NOT provide auto-pagination functionality
2. THE Extension SHALL NOT provide background scraping functionality
3. THE Extension SHALL NOT provide timer-based or scheduled extraction
4. THE Extension SHALL NOT provide multi-tab extraction
5. THE Extension SHALL require explicit user click for every extraction action
6. THE Extension SHALL NOT perform any content retrieval, navigation, or page loading network requests without visible user initiation

### Requirement 12: Export Format and Structure

**User Story:** As a researcher, I want exports in a consistent, structured format, so that I can process and cite my corpus systematically.

#### Acceptance Criteria

1. THE Extension SHALL export Act_Detail_Page content as JSON with the following structure: `_metadata` object, `title` field, `act_number` field, `content` field containing the full legal text
2. THE Extension SHALL export Volume_Page data as JSON with `_metadata` object and `acts` array, each act containing: title, year, act_number, url
3. THE Extension SHALL use UTF-8 encoding to preserve Bengali characters
4. THE Extension SHALL generate filenames in the format: `bdlaw_act_{act_number}_{timestamp}.json` for acts, `bdlaw_volume_{volume_number}_{timestamp}.json` for volumes
5. WHEN exporting, THE Extension SHALL validate JSON structure before saving
6. THE Extension SHALL ensure that repeated extraction of the same page without page changes produces identical content output

### Requirement 13: Clear Page Type Indication

**User Story:** As a researcher, I want to clearly see what type of page I'm on, so that I understand what extraction options are available.

#### Acceptance Criteria

1. THE Extension SHALL display a prominent Page_Type_Indicator showing one of: "Range Index (Layer 1)", "Volume Index (Layer 2)", "Act Details (Layer 3)", "Act Summary (Navigate to Details)", or "Unsupported Page"
2. THE Extension SHALL use distinct visual styling (color, icon) for each page type
3. WHEN on a Range_Index_Page, THE Extension SHALL display the indicator in a gray/navigation style
4. WHEN on a Volume_Page, THE Extension SHALL display the indicator in a blue/catalog style
5. WHEN on an Act_Detail_Page, THE Extension SHALL display the indicator in a green/ready style
6. WHEN on an unsupported page, THE Extension SHALL display the indicator in a red/disabled style with explanation

### Requirement 14: Guided Research Workflow

**User Story:** As a researcher, I want the UI to guide me through the correct extraction workflow, so that I follow proper research methodology.

#### Acceptance Criteria

1. THE Extension SHALL display a workflow progress indicator showing: "1. Browse Volumes → 2. Catalog Acts → 3. Extract Each Act"
2. WHEN on a Range_Index_Page, THE Extension SHALL highlight step 1 as active
3. WHEN on a Volume_Page, THE Extension SHALL highlight step 2 as active
4. WHEN on an Act_Detail_Page, THE Extension SHALL highlight step 3 as active
5. THE Extension SHALL provide contextual help text explaining the current step's purpose
6. THE Extension SHALL display a "Research Workflow" section that remains visible during extraction

### Requirement 15: Preview and Inspection

**User Story:** As a researcher, I want to thoroughly inspect extracted content before saving, so that I can verify accuracy and completeness.

#### Acceptance Criteria

1. THE Extension SHALL display extracted content in a scrollable, readable preview area
2. THE Extension SHALL use a readable, non-decorative font suitable for Bengali legal text
3. THE Extension SHALL display line numbers in the preview for reference
4. THE Extension SHALL allow the user to scroll through the entire extracted content before confirming save
5. THE Extension SHALL display the total character count and estimated word count in the preview header

### Requirement 16: UI Simplification

**User Story:** As a researcher, I want a minimal, focused UI that only shows research-relevant controls, so that I am not distracted by irrelevant features.

#### Acceptance Criteria

1. THE Extension SHALL display only extraction controls relevant to legal corpus construction
2. THE Extension SHALL hide or remove generic scraping features including "Scrape Links" button
3. THE Extension SHALL hide or remove text processing options not relevant to legal text preservation (e.g., "Remove URLs", "Remove Numbers", "Remove Stop Words")
4. THE Extension SHALL provide clear visual feedback for all user actions (loading states, success messages, error messages)
5. THE Extension SHALL use a clean, academic-appropriate visual design without distracting animations

### Requirement 17: Language Version Handling

**User Story:** As a researcher, I want the tool to extract only the Bengali version of laws, so that my corpus is consistent and authentic.

#### Acceptance Criteria

1. THE Extension SHALL extract only the Bengali (বাংলা) version of legal texts
2. THE Extension SHALL NOT treat English and Bengali versions as separate laws
3. WHEN both language versions are available, THE Extension SHALL indicate that only Bengali is extracted
4. THE Extension SHALL include language code "bn" in all export metadata

### Requirement 18: Persistent Side Panel UI

**User Story:** As a researcher, I want a persistent UI panel that stays open while I browse, so that I don't have to click the extension icon repeatedly.

#### Acceptance Criteria

1. WHEN the user clicks the extension icon, THE Extension SHALL open a persistent side panel
2. THE Side_Panel SHALL remain visible while the user navigates between pages
3. THE Side_Panel SHALL automatically update to reflect the current page type
4. THE Side_Panel SHALL provide three tabs: Capture, Queue, and Export
5. THE Side_Panel SHALL persist its state across page navigations

### Requirement 19: Batch Collection Queue

**User Story:** As a researcher, I want to queue multiple acts for extraction, so that I can collect an entire volume without saving each act individually.

#### Acceptance Criteria

1. WHEN on a Volume_Page, THE Extension SHALL allow capturing the volume catalog
2. WHEN a volume is captured, THE Extension SHALL display all acts from that volume
3. THE Extension SHALL allow adding all acts from a volume to an extraction queue
4. THE Extension SHALL allow adding individual acts to the queue from Act_Detail_Pages
5. THE Queue SHALL persist in browser storage across sessions
6. THE Extension SHALL display queue status showing pending, processing, and completed items
7. THE Extension SHALL allow removing individual items from the queue

### Requirement 20: Queue Processing

**User Story:** As a researcher, I want to process the queue automatically, so that I can extract multiple acts without manual intervention for each one.

#### Acceptance Criteria

1. WHEN the user clicks "Process Queue", THE Extension SHALL navigate to each queued act URL
2. FOR EACH queued act, THE Extension SHALL extract content using the standard extraction method
3. THE Extension SHALL update queue item status to show processing progress
4. THE Extension SHALL store extracted content in browser storage
5. IF extraction fails for an item, THE Extension SHALL mark it as error and continue with remaining items
6. THE Extension SHALL display a progress indicator during queue processing

### Requirement 21: Bulk Export as Separate Files

**User Story:** As a researcher, I want to export all captured acts as separate individual files, so that I can manage and process each legal document independently.

#### Acceptance Criteria

1. THE Extension SHALL display statistics showing total captured acts, volumes, and character count
2. WHEN the user clicks "Export All as Separate Files", THE Extension SHALL export each act as an individual JSON file
3. EACH exported act file SHALL be self-contained with complete metadata
4. THE Extension SHALL generate filenames in format: `bdlaw_act_{act_number}_{timestamp}.json`
5. THE Extension SHALL allow toggling inclusion of provenance metadata in export
6. THE Extension SHALL allow toggling pretty-print formatting for JSON export
7. THE Extension SHALL add a small delay between file downloads to prevent browser blocking

### Requirement 26: Individual Act Export Structured Data

**User Story:** As a researcher, I want each individual act export to include structured sections, tables, and amendments, so that I can analyze the legal structure programmatically.

#### Acceptance Criteria

1. EACH individual act export SHALL include `structured_sections` array containing section title-body pairs
2. EACH individual act export SHALL include `tables` array containing parsed table data as 2D arrays
3. EACH individual act export SHALL include `amendments` array listing detected amendment markers with locations
4. EACH individual act export SHALL be a complete, self-contained JSON document
5. WHEN structured data is not available for an act, THE Extension SHALL include empty arrays rather than omitting the fields

### Requirement 27: Queue Deduplication

**User Story:** As a researcher, I want the queue to prevent duplicate acts, so that my corpus doesn't contain redundant entries.

#### Acceptance Criteria

1. WHEN adding an act to the queue, THE Extension SHALL check if an act with the same act_number already exists
2. IF a duplicate act_number is detected in the queue, THE Extension SHALL NOT add the duplicate and display a notification
3. WHEN capturing acts from a volume, THE Extension SHALL skip acts already present in the queue
4. THE Extension SHALL use act_number as the unique identifier for deduplication
5. THE Extension SHALL display a count of skipped duplicates when adding from a volume

### Requirement 28: Content Noise Filtering

**User Story:** As a researcher, I want the extracted content to exclude UI elements and boilerplate text, so that my corpus contains only legal text.

#### Acceptance Criteria

1. THE Extension SHALL filter out UI navigation elements including "প্রিন্ট ভিউ" (Print View) text
2. THE Extension SHALL filter out page navigation elements including "Top" links
3. THE Extension SHALL filter out copyright notices and footer text (e.g., "Copyright © 2019, Legislative and Parliamentary Affairs Division")
4. THE Extension SHALL filter out empty whitespace-only lines at the beginning and end of content
5. THE Extension SHALL preserve all legal text content between the act title and the last legal section
6. THE Extension SHALL NOT filter any Bengali legal text or section markers

### Requirement 29: Volume Number Tracking

**User Story:** As a researcher, I want each captured act to track its source volume number, so that I can organize and reference acts by volume.

#### Acceptance Criteria

1. WHEN capturing an act from a Volume_Page queue, THE Extension SHALL record the source volume_number
2. THE Extension SHALL extract volume_number from the Volume_Page URL pattern `/volume-{XX}.html`
3. THE Captured_Act SHALL include `volume_number` field in its stored data
4. THE Corpus_Export SHALL include `volume_number` for each act (not null)
5. WHEN an act is captured directly from an Act_Detail_Page (not via queue), THE Extension SHALL attempt to extract volume_number from any available source or set to "unknown"

### Requirement 30: Content Script Extraction Integration

**User Story:** As a researcher, I want the content script to use all available extraction methods, so that my corpus includes complete structured data.

#### Acceptance Criteria

1. THE Content_Script SHALL implement structured extraction using `.boxed-layout` and `.lineremoves` selectors
2. THE Content_Script SHALL apply content noise filtering during extraction (not as post-processing)
3. THE Content_Script SHALL extract tables using matrix-based algorithm for merged cell handling
4. THE Content_Script SHALL detect amendment markers and include them in extraction results
5. THE Content_Script SHALL return structured_sections, tables, and amendments arrays in extraction response
6. THE Side_Panel SHALL store all structured data fields from extraction response

### Requirement 31: Independent File Export

**User Story:** As a researcher, I want to export each act as a separate file and volumes as separate catalog files, so that I can manage and process individual legal documents independently.

#### Acceptance Criteria

1. WHEN exporting captured acts, THE Extension SHALL export each act as a separate JSON file
2. THE Extension SHALL generate act filenames in format: `bdlaw_act_{act_number}_{timestamp}.json`
3. WHEN exporting a volume catalog, THE Extension SHALL export it as a separate JSON file
4. THE Extension SHALL generate volume filenames in format: `bdlaw_volume_{volume_number}_{timestamp}.json`
5. THE Extension SHALL provide an "Export All as Separate Files" option that exports all captured acts as individual files
6. THE Extension SHALL provide an "Export Volume Catalog" option to export the current volume's act list
7. THE Extension SHALL NOT combine multiple acts into a single corpus file by default
8. THE Extension SHALL allow batch download of multiple individual act files

### Requirement 32: Data Reset and Clearing

**User Story:** As a researcher, I want to clear all extracted data and reset the extension state, so that I can start a fresh corpus collection without residual data from previous sessions.

#### Acceptance Criteria

1. THE Extension SHALL provide a "Clear All Data" button in the Export tab
2. WHEN the user clicks "Clear All Data", THE Extension SHALL display a confirmation dialog listing all data to be deleted
3. THE confirmation dialog SHALL show the count of captured acts, queue items, and whether a volume catalog exists
4. WHEN confirmed, THE Extension SHALL permanently delete all captured acts from browser storage
5. WHEN confirmed, THE Extension SHALL permanently delete all queue items from browser storage
6. WHEN confirmed, THE Extension SHALL permanently delete the current volume catalog from browser storage
7. THE Extension SHALL update all UI elements to reflect the cleared state after deletion
8. THE Extension SHALL display a warning message below the clear button indicating the action is permanent
