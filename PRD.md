# Product Requirements Document (PRD)
## Project: BDLawCorpus

---

## 1. Product Overview

BDLawCorpus is a purpose-built, research-grade Chrome extension designed to support the disciplined, manual extraction of publicly available Bangladeshi legal texts from the official website https://bdlaws.minlaw.gov.bd.

The product is intended exclusively for academic dataset construction in the fields of Digital Humanities, Legal Informatics, and Access to Information. It prioritizes transparency, reproducibility, and ethical data collection over speed or convenience.

BDLawCorpus is not a general-purpose web scraper and does not support automated or bulk data extraction.

---

## 2. Product Goals

- Enable reproducible extraction of Bangladeshi legal texts
- Preserve original Bengali legal language without modification
- Enforce index-first, act-by-act research workflow
- Encode research discipline directly into tool behavior
- Produce structured, citable datasets suitable for academic use

---

## 3. Target Users

- Research students
- Digital humanities scholars
- Legal accessibility researchers
- Low-resource language dataset curators

Non-target users:
- Commercial scrapers
- Data miners
- Automated crawling systems

---

## 4. Functional Requirements

### FR-1: Domain Restriction

The extension SHALL operate exclusively on: https://bdlaws.minlaw.gov.bd/

Extraction functionality SHALL be disabled on all other domains.

---

### FR-2: Index-First Workflow Enforcement

When the current page is the laws listing page (`laws-of-bangladesh.html`):

- The extension SHALL allow extraction of:
  - Act title (Bengali)
  - Act number
  - Act year
  - Act URL
- The extension SHALL NOT allow full legal text extraction
- The extension SHALL export index data as structured JSON

---

### FR-3: Act-by-Act Extraction Discipline

- The extension SHALL extract content from only the currently open act page
- The extension SHALL NOT provide batch or multi-page extraction
- The extension SHALL require user confirmation before saving each act
- Filenames SHALL be unique and include act identifier and timestamp

---

### FR-4: Hardcoded Legal Selectors

The extension SHALL use only predefined CSS selectors for content extraction:
- `h1`, `.act-title`
- `#lawContent`, `.law-content`, `.act-details`
- `.act-meta`, `.law-header`

User-defined selectors or XPath expressions SHALL NOT be permitted.

---

### FR-5: Mandatory Provenance Metadata

Every export SHALL include a `_metadata` object containing:
- Source domain
- Source URL
- Extraction timestamp (ISO 8601)
- Extraction method (“manual page-level extraction”)
- Tool name (“BDLawCorpus Chrome Extension”)
- Language code (“bn”)
- Research purpose (“academic legal corpus construction”)

Exports SHALL be blocked if any metadata field is missing.

---

### FR-6: Section Awareness with Human Confirmation

- The extension SHALL highlight Bengali legal section markers:
  - ধারা
  - অধ্যায়
  - তফসিল
- The extension SHALL display a preview before export
- The extension SHALL NOT modify or restructure legal text

---

### FR-7: Persistent Side Panel UI

- The extension SHALL open a persistent side panel when the icon is clicked
- The side panel SHALL remain visible while navigating between pages
- The side panel SHALL automatically update to reflect the current page type
- The side panel SHALL provide three tabs: Capture, Queue, and Export
- The side panel SHALL persist its state across page navigations

---

### FR-8: Batch Collection Queue

- The extension SHALL allow capturing volume catalogs on Volume pages
- The extension SHALL allow adding all acts from a volume to an extraction queue
- The extension SHALL allow adding individual acts to the queue
- The queue SHALL persist in browser storage across sessions
- The extension SHALL display queue status (pending, processing, completed, error)
- The extension SHALL allow removing individual items from the queue

---

### FR-9: Queue Processing

- The extension SHALL navigate to each queued act URL when processing
- The extension SHALL extract content using the standard extraction method
- The extension SHALL update queue item status during processing
- The extension SHALL store extracted content in browser storage
- The extension SHALL handle extraction errors gracefully and continue
- The extension SHALL display a progress indicator during processing

---

### FR-10: Bulk Corpus Export

- The extension SHALL display statistics (total acts, volumes, character count)
- The extension SHALL generate a single JSON corpus file on export
- The corpus export SHALL include corpus-level metadata
- The corpus export SHALL include all captured acts with individual metadata
- The extension SHALL allow toggling metadata inclusion
- The extension SHALL allow toggling pretty-print formatting
- The corpus filename SHALL include act count and timestamp

---

## 5. Non-Functional Requirements (Research Safety)

- No automated crawling
- No background extraction
- No AI or NLP processing
- No content modification or summarization
- All actions require explicit user interaction
- UTF-8 encoding MUST be preserved

---

## 6. MVP Definition (Critical)

### MVP Includes:
- Domain-locked extraction
- Index-first workflow
- Act-by-act manual extraction
- Mandatory provenance metadata
- Structured JSON export
- Visible extraction preview
- Persistent side panel UI
- Batch collection queue
- Queue processing with auto-navigation
- Bulk corpus export

### MVP Excludes:
- Automation without user initiation
- Background scraping
- Pagination handling
- Multi-tab extraction
- Performance optimizations

---

## 7. Acceptance Criteria

The MVP is considered complete when:

1. All extracted files contain complete provenance metadata
2. Legal text remains unchanged from the source
3. Extraction cannot occur outside the approved domain
4. Each act is extracted individually with user confirmation
5. Output JSON validates successfully and preserves Bengali text
6. The workflow can be reproduced by an independent researcher

---

## 8. Out of Scope

- Dataset publication
- Model training
- Legal interpretation
- Summarization or simplification
- Academic paper writing
```