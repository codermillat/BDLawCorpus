# Design Document: BDLawCorpus Extension

## Overview

BDLawCorpus is a purpose-built Chrome extension for academic extraction of Bangladeshi legal texts from the official bdlaws.minlaw.gov.bd website. This design document describes the architecture, components, and implementation approach for transforming the existing WebScrape extension into a research-grade legal corpus extraction tool.

The design prioritizes:
- Research ethics and transparency
- Manual, human-in-the-loop extraction
- Provenance metadata for reproducibility
- Clear UI guidance for the 3-layer research workflow
- Prevention of automation and bulk extraction

## Website Structure Model

The bdlaws.minlaw.gov.bd website has a THREE-LAYER hierarchical structure that the extension must recognize and handle appropriately:

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: Range Index                      │
│                 /laws-of-bangladesh.html                     │
│                   (Navigation Only)                          │
│                         │                                    │
│                         ▼                                    │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 2: Volume Pages                     │
│                    /volume-{XX}.html                         │
│                  (Act Catalog Extraction)                    │
│                         │                                    │
│                         ▼                                    │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 3: Act Details                      │
│                 /act-details-{XXXX}.html                     │
│                (Full Content Extraction)                     │
└─────────────────────────────────────────────────────────────┘
```

## Architecture

The extension follows Chrome Manifest V3 architecture with these core components:

```
┌─────────────────────────────────────────────────────────────┐
│                    BDLawCorpus Extension                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Side Panel  │  │   Content   │  │    Background       │  │
│  │   (UI)      │◄─┤   Script    │◄─┤    Service Worker   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                    │              │
│         ▼                ▼                    ▼              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Page Type   │  │ Legal       │  │ Export              │  │
│  │ Detector    │  │ Extractor   │  │ Handler             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                    │              │
│         ▼                ▼                    ▼              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Queue       │  │ Storage     │  │ Metadata            │  │
│  │ Manager     │  │ Manager     │  │ Generator           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

1. **Side Panel (UI)**: Persistent research-focused interface with three tabs (Capture, Queue, Export), page type indicator, workflow guidance, and ethical disclaimer
2. **Content Script**: DOM extraction using hardcoded legal selectors, section marker detection
3. **Background Service Worker**: Side panel management, file download handling, JSON validation
4. **Page Type Detector**: URL pattern matching for 3-layer detection
5. **Legal Extractor**: Hardcoded selector-based content extraction
6. **Metadata Generator**: Provenance metadata creation and validation
7. **Export Handler**: JSON formatting, file naming, download triggering
8. **Queue Manager**: Batch collection queue with persistence
9. **Storage Manager**: Chrome storage API for queue and captured acts persistence

## Components and Interfaces

### 1. Page Type Detector Module

```javascript
// bdlaw-page-detector.js
const BDLawPageDetector = {
  ALLOWED_ORIGIN: 'http://bdlaws.minlaw.gov.bd',
  
  URL_PATTERNS: {
    RANGE_INDEX: /\/laws-of-bangladesh\.html$/,
    VOLUME: /\/volume-\d+\.html$/,
    ACT_DETAILS: /\/act-details-\d+\.html$/,
    ACT_SUMMARY: /\/act-(?!details)\d+\.html$/  // Negative lookahead to exclude act-details
  },
  
  PAGE_TYPES: {
    RANGE_INDEX: 'range_index',    // Layer 1
    VOLUME: 'volume',              // Layer 2
    ACT_DETAILS: 'act_details',    // Layer 3
    ACT_SUMMARY: 'act_summary',    // Intermediate
    UNSUPPORTED: 'unsupported',
    INVALID_DOMAIN: 'invalid_domain'
  },
  
  // Detection order: ACT_DETAILS checked before ACT_SUMMARY to prevent overlap
  isAllowedDomain(url) → boolean,
  detectPageType(url) → PageType,
  getLayerNumber(pageType) → number | null,
  getPageTypeLabel(pageType) → string
};
```

### 2. Legal Extractor Module

The extraction logic is implemented in two places:
1. **bdlaw-extractor.js**: Testable module for Node.js unit/property tests
2. **content.js**: Browser content script with identical logic for actual extraction

Both implementations share the same selectors, markers, and algorithms to ensure consistency.

```javascript
// bdlaw-extractor.js (testable module)
// content.js (browser content script - duplicates logic for browser context)
const BDLawExtractor = {
  // Selectors are tried in listed order; the first non-empty match is used
  LEGAL_SELECTORS: {
    title: ['h1', '.act-title'],
    content: ['#lawContent', '.law-content', '.act-details'],
    meta: ['.act-meta', '.law-header'],
    schedule: ['table', '.schedule', '#schedule'],
    // DOM-specific selectors for structured extraction
    volumeTable: 'table.table-search tbody tr',
    actContainer: '.boxed-layout',
    actMetadata: ['.bg-act-section', '.act-role-style'],
    sectionRows: '.lineremoves',
    sectionTitle: '.col-sm-3.txt-head',
    sectionBody: '.col-sm-9.txt-details'
  },
  
  SECTION_MARKERS: ['ধারা', 'অধ্যায়', 'তফসিল'],
  
  // Amendment markers for detecting deleted/modified provisions
  AMENDMENT_MARKERS: ['বিলুপ্ত', 'সংশোধিত', 'প্রতিস্থাপিত'],
  
  // UI noise patterns to filter from extracted content
  UI_NOISE_PATTERNS: [
    'প্রিন্ট ভিউ',           // Print View button
    /^Top$/gm,               // Top navigation link
    /Copyright © \d{4}/g,    // Copyright notices
    /Legislative and Parliamentary Affairs Division/g  // Footer text
  ],
  
  // Volume metadata is extracted as rendered, without language normalization
  // Bengali text is preferred if present; numerals are not normalized
  extractActContent(document) → { title, content, sections, amendments, tables, structured_sections },
  extractVolumeData(document) → Array<{ title, year, actNumber, url }>,
  
  // Line numbers are computed after rendering text content split by newline (\n)
  detectSectionMarkers(text) → Array<{ type, line, lineNumber, position }>,
  countSectionMarkers(text) → { ধারা: number, অধ্যায়: number, তফসিল: number },
  
  // DOM-specific extraction methods
  extractVolumeFromDataTable(document) → Array<{ id, title, url, actNumber }>,
  extractActFromSectionRows(document) → { metadata, sections: Array<StructuredSection> },
  extractTableWithMergedCells(tableElement) → { data: string[][], hasMergedCells, rowCount, colCount },
  detectAmendmentMarkers(text) → Array<{ type, line, lineNumber, position, context }>,
  filterContentNoise(text) → string
};
```

**Critical Implementation Note**: The content.js script must implement all extraction methods directly (not import from bdlaw-extractor.js) because Chrome content scripts cannot use ES modules. The bdlaw-extractor.js module exists for testability in Node.js environment.

### 2.1 Content Script Extraction Flow

The content.js script implements a comprehensive extraction flow that integrates all extraction methods:

```javascript
/**
 * Extract act content from Layer 3 (Act Detail) pages
 * Requirements: 7.1, 9.4, 9.5, 23.1-23.7, 24.1-24.7, 25.1-25.5, 28.1-28.6
 * 
 * Uses structured extraction from section rows when available,
 * falls back to generic selectors for other page layouts.
 */
function extractBDLawActContent() {
  // 1. Try structured extraction from section rows first
  const structuredResult = bdlawExtractActFromSectionRows();
  const hasStructuredContent = structuredResult.sections?.length > 0;

  // 2. Extract title using ordered selectors
  let title = bdlawTrySelectors(BDLAW_LEGAL_SELECTORS.title);

  let content = '';
  let structuredSections = [];
  let tables = [];

  if (hasStructuredContent) {
    // 3a. Build content from structured sections
    // Extract tables from sections that have them
    // Build structured section array for export
    structuredResult.sections.forEach((section, idx) => {
      // ... build content and extract tables
    });
  } else {
    // 3b. Fallback: Extract using generic selectors
    content = bdlawTrySelectors(BDLAW_LEGAL_SELECTORS.content);
    // ... fallback extraction logic
  }

  // 4. Apply content noise filtering
  content = bdlawFilterContentNoise(content);
  structuredSections = structuredSections.map(s => ({
    ...s,
    sectionBody: bdlawFilterContentNoise(s.sectionBody)
  }));

  // 5. Detect section markers
  const detected = bdlawDetectSectionMarkers(content);
  const counts = bdlawCountSectionMarkers(content);

  // 6. Detect amendment markers
  const amendments = bdlawDetectAmendmentMarkers(content);

  // 7. Return complete extraction result
  return {
    success: true,
    title,
    content,
    sections: { detected, counts },
    structured_sections: structuredSections,
    tables,
    amendments,
    metadata: structuredResult.metadata
  };
}
```

**Key Design Decisions**:
1. **Structured extraction first**: Prefer `.boxed-layout` + `.lineremoves` structure when available
2. **Fallback for compatibility**: Generic selectors handle pages with different layouts
3. **Noise filtering applied early**: Content is cleaned during extraction, not export
4. **All data returned**: Structured sections, tables, and amendments included in response

### 2.2 Volume DataTable Extraction Algorithm

The Volume page uses a DataTable structure (`table.table-search`) to list acts. Each row contains:
- Cell 0: Hidden year/ID (often contains a link with ID)
- Cell 1: Title with anchor link to act page
- Cell 2: Act number

```javascript
/**
 * Extract volume catalog from DataTable structure
 * Requirements: 22.1-22.6
 */
extractVolumeFromDataTable(document) {
  const rows = document.querySelectorAll('table.table-search tbody tr');
  const acts = [];
  
  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) return;
    
    // Cell 1: Title with anchor link
    const titleAnchor = cells[1].querySelector('a');
    if (!titleAnchor) return;
    
    const href = titleAnchor.getAttribute('href');
    const title = titleAnchor.textContent.trim();
    
    // Extract ID from URL pattern /act-{ID}.html
    const idMatch = href.match(/act-(\d+)\.html/);
    const id = idMatch ? idMatch[1] : null;
    
    // Cell 2: Act number
    const actNoAnchor = cells[2].querySelector('a');
    const actNumber = actNoAnchor ? actNoAnchor.textContent.trim() : '';
    
    // Normalize relative URL to absolute
    const url = href.startsWith('http') 
      ? href 
      : `http://bdlaws.minlaw.gov.bd${href.startsWith('/') ? '' : '/'}${href}`;
    
    acts.push({
      id,
      title,
      url,
      actNumber,
      rowIndex: index  // Preserve original order
    });
  });
  
  return acts;
}
```

### 2.3 Act Content Section-Row Extraction Algorithm

Act detail pages use Bootstrap rows (`.lineremoves`) with section title and body columns:

```javascript
/**
 * Extract act content from section-row structure
 * Requirements: 23.1-23.7
 */
extractActFromSectionRows(document) {
  const container = document.querySelector('.boxed-layout');
  if (!container) return { metadata: null, sections: [] };
  
  // Extract metadata from header sections
  const metadataEl = container.querySelector('.bg-act-section, .act-role-style');
  const metadata = metadataEl ? metadataEl.textContent.trim() : null;
  
  // Extract sections from .lineremoves rows
  const sectionRows = container.querySelectorAll('.lineremoves');
  const sections = [];
  
  sectionRows.forEach((row, index) => {
    const titleEl = row.querySelector('.col-sm-3.txt-head');
    const bodyEl = row.querySelector('.col-sm-9.txt-details');
    
    const sectionTitle = titleEl ? titleEl.textContent.trim() : '';
    const sectionBodyHtml = bodyEl ? bodyEl.innerHTML : '';
    const sectionBodyText = bodyEl ? bodyEl.textContent.trim() : '';
    
    sections.push({
      index,
      sectionTitle,
      sectionBody: sectionBodyText,
      sectionBodyHtml,  // Preserve HTML for table parsing
      hasTable: bodyEl ? bodyEl.querySelector('table') !== null : false
    });
  });
  
  return { metadata, sections };
}
```

### 2.4 Matrix-Based Table Parsing Algorithm

Tables with `rowspan`/`colspan` require a matrix-based approach to maintain data integrity:

```javascript
/**
 * Extract table data handling merged cells correctly
 * Requirements: 24.1-24.7
 * 
 * Problem: Standard row/cell iteration breaks when rowspan causes cells
 * to "disappear" in subsequent rows, shifting data left.
 * 
 * Solution: Maintain a state matrix to track cell positions across rows.
 */
extractTableWithMergedCells(tableElement) {
  const matrix = [];
  const rows = tableElement.querySelectorAll('tr');
  
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td, th');
    let colIndex = 0;
    
    cells.forEach((cell) => {
      // Skip columns already filled by previous rowspan
      while (matrix[rowIndex] && matrix[rowIndex][colIndex]) {
        colIndex++;
      }
      
      // Clean and normalize cell content
      const content = cell.textContent
        .trim()
        .replace(/\s+/g, ' ')  // Collapse whitespace
        .replace(/\u00A0/g, ' ');  // Replace &nbsp;
      
      const rowspan = parseInt(cell.getAttribute('rowspan')) || 1;
      const colspan = parseInt(cell.getAttribute('colspan')) || 1;
      
      // Fill matrix based on span dimensions
      for (let r = 0; r < rowspan; r++) {
        for (let c = 0; c < colspan; c++) {
          const targetRow = rowIndex + r;
          const targetCol = colIndex + c;
          
          if (!matrix[targetRow]) matrix[targetRow] = [];
          
          // Only write content to origin cell (0,0) of merge
          // Mark other cells as MERGED_CELL for tracking
          matrix[targetRow][targetCol] = (r === 0 && c === 0) 
            ? content 
            : '__MERGED_CELL__';
        }
      }
      
      colIndex += colspan;
    });
  });
  
  // Convert matrix to clean 2D array (filter out merge markers if needed)
  return matrix.map(row => 
    row.map(cell => cell === '__MERGED_CELL__' ? '' : cell)
  );
}
```

### 2.5 Amendment Marker Detection

Detect deleted/amended provisions for legal accuracy:

```javascript
/**
 * Detect amendment markers in legal text
 * Requirements: 25.1-25.5
 */
detectAmendmentMarkers(text) {
  if (!text || typeof text !== 'string') return [];
  
  const AMENDMENT_MARKERS = ['বিলুপ্ত', 'সংশোধিত', 'প্রতিস্থাপিত'];
  const markers = [];
  const lines = text.split('\n');
  
  lines.forEach((line, lineIndex) => {
    AMENDMENT_MARKERS.forEach(marker => {
      let position = 0;
      let searchStart = 0;
      
      while ((position = line.indexOf(marker, searchStart)) !== -1) {
        markers.push({
          type: marker,
          line: line,
          lineNumber: lineIndex + 1,
          position: position,
          context: line.substring(
            Math.max(0, position - 20),
            Math.min(line.length, position + marker.length + 20)
          )
        });
        searchStart = position + marker.length;
      }
    });
  });
  
  return markers;
}
```

### 3. Metadata Generator Module

```javascript
// bdlaw-metadata.js
const BDLawMetadata = {
  REQUIRED_FIELDS: ['source', 'source_url', 'scraped_at', 'scraping_method', 
                    'tool', 'language', 'research_purpose'],
  
  DISCLAIMER: 'This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed.',
  
  generate(url) → MetadataObject,
  validate(metadata) → { valid: boolean, missing: string[] },
  getDisclaimer() → string
};
```

### 4. Export Handler Module

```javascript
// bdlaw-export.js
const BDLawExport = {
  formatActExport(content, metadata) → JSONString,
  formatVolumeExport(acts, metadata) → JSONString,
  generateActFilename(actNumber, timestamp) → string,
  generateVolumeFilename(volumeNumber, timestamp) → string,
  validateJSON(jsonString) → boolean,
  triggerDownload(content, filename) → Promise<void>
};
```

### 5. UI State Management

```javascript
// Popup state management
const PopupState = {
  pageType: PageType,
  layerNumber: number | null,
  extractionAllowed: boolean,
  extractionType: 'none' | 'catalog' | 'content',
  previewContent: string | null,
  sectionMarkers: Array<SectionMarker>,
  sectionCounts: { ধারা: number, অধ্যায়: number, তফসিল: number },
  metadataPreview: MetadataObject | null,
  workflowStep: 1 | 2 | 3
};
```

## Data Models

### Act Export Schema (Layer 3)

**METHODOLOGICAL PRINCIPLE**: Corpus-stage extraction only. No semantic interpretation.

```json
{
  "identifiers": {
    "internal_id": "754",
    "note": "internal_id is the bdlaws database identifier, not the legal citation number"
  },
  "act_number": "754",
  "title": "অর্থ আইন, ১৯৯১",
  "content": "Full legal text content...",
  "url": "http://bdlaws.minlaw.gov.bd/act-details-754.html",
  "volume_number": "28",
  "marker_frequency": {
    "ধারা": {
      "count": 12,
      "method": "raw string frequency, including cross-references"
    },
    "অধ্যায়": {
      "count": 0,
      "method": "raw string frequency"
    },
    "তফসিল": {
      "count": 10,
      "method": "raw string frequency, including schedule references"
    }
  },
  "_metadata": {
    "source": "bdlaws.minlaw.gov.bd",
    "source_url": "http://bdlaws.minlaw.gov.bd/act-details-754.html",
    "scraped_at": "2024-01-15T10:30:00.000Z",
    "extracted_at": "2024-01-15T10:30:00.000Z",
    "scraping_method": "manual page-level extraction",
    "tool": "BDLawCorpus",
    "language": "bn",
    "research_purpose": "academic legal corpus construction",
    "disclaimer": "This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed."
  }
}
```

**Schema Design Decisions (v2.0)**:

| Field | Included | Rationale |
|-------|----------|-----------|
| `identifiers.internal_id` | ✅ | bdlaws database ID from URL (e.g., "754") |
| `identifiers.note` | ✅ | Clarifies this is NOT the legal citation |
| `act_number` | ⚠️ DEPRECATED | Kept for backward compatibility, use `identifiers.internal_id` |
| `title` | ✅ | Direct extraction from DOM |
| `content` | ✅ | Raw text, noise-filtered |
| `url` | ✅ | Source provenance |
| `volume_number` | ✅ | Direct extraction from URL |
| `marker_frequency.*.count` | ✅ | Integer occurrence count |
| `marker_frequency.*.method` | ✅ | Documents counting methodology |
| `_metadata` | ✅ | Provenance and timestamps |

**Critical Identifier Clarification**:

The `internal_id` (e.g., "754") is the bdlaws database identifier extracted from the URL pattern `/act-details-{ID}.html`. This is NOT the legal citation number.

For example, Act 754 has:
- `internal_id`: "754" (database ID)
- Legal citation: "১৯৯১ সনের ২১ নং আইন" (Act No. 21 of 1991)

Extracting the legal citation (act_year, act_serial) requires parsing the title or preamble text, which is semantic interpretation and belongs in Phase 2.

**Why `marker_frequency` includes method documentation**:

The `marker_frequency` field counts ALL occurrences of marker strings, including:
- Structural sections in the current document
- Cross-references to sections in other laws
- References in preamble text and schedules

Example: অর্থ আইন, ১৯৯১ (Act 754) has:
- `"ধারা": 12` - includes cross-references to Income Tax Ordinance sections
- `"তফসিল": 10` - includes references to schedules in amended laws

This explicit documentation prevents misinterpretation by researchers.

**Note**: The following fields are intentionally excluded from corpus-stage exports:
- `structured_sections` - Requires semantic interpretation of section boundaries
- `tables` - Requires structural inference from HTML
- `amendments` - Requires legal classification of intent
- `act_year`, `act_serial` - Requires title/preamble parsing (Phase 2)

These belong in Phase 2 post-processing, not corpus construction.

### Volume Export Schema (Layer 2)

```json
{
  "volume_number": "56",
  "source_url": "http://bdlaws.minlaw.gov.bd/volume-56.html",
  "captured_at": "2024-01-15T10:30:00.000Z",
  "total_acts": 25,
  "acts": [
    {
      "title": "আইনের শিরোনাম",
      "year": "২০২৩",
      "act_number": "১৫১৪",
      "url": "http://bdlaws.minlaw.gov.bd/act-details-1514.html"
    }
  ],
  "_metadata": {
    "source": "bdlaws.minlaw.gov.bd",
    "source_url": "http://bdlaws.minlaw.gov.bd/volume-56.html",
    "scraped_at": "2024-01-15T10:30:00.000Z",
    "extracted_at": "2024-01-15T10:30:00.000Z",
    "scraping_method": "manual page-level extraction",
    "tool": "BDLawCorpus",
    "language": "bn",
    "research_purpose": "academic legal corpus construction",
    "disclaimer": "This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed."
  }
}
}
```

### Section Marker Types

```typescript
type SectionMarkerType = 'ধারা' | 'অধ্যায়' | 'তফসিল';
type AmendmentMarkerType = 'বিলুপ্ত' | 'সংশোধিত' | 'প্রতিস্থাপিত';

interface SectionMarker {
  type: SectionMarkerType;
  line: string;
  lineNumber: number;
  position: number;
}

interface AmendmentMarker {
  type: AmendmentMarkerType;
  line: string;
  lineNumber: number;
  position: number;
  context: string;  // Surrounding text for context
}

interface SectionCounts {
  'ধারা': number;
  'অধ্যায়': number;
  'তফসিল': number;
}
```

### Structured Section Schema

```typescript
interface StructuredSection {
  index: number;           // Original document order
  sectionTitle: string;    // From .txt-head column
  sectionBody: string;     // Text content from .txt-details
  sectionBodyHtml: string; // Raw HTML for table parsing
  hasTable: boolean;       // Whether section contains tables
  amendments: AmendmentMarker[];  // Detected amendment markers
}

interface ExtractedActContent {
  metadata: string | null;        // From .bg-act-section
  sections: StructuredSection[];  // Ordered section array
  tables: ExtractedTable[];       // Parsed tables with merged cell handling
}
```

### Table Extraction Schema

```typescript
interface ExtractedTable {
  sectionIndex: number;           // Which section contains this table
  data: string[][];               // 2D array preserving grid structure
  hasMergedCells: boolean;        // Whether rowspan/colspan was detected
  originalClasses: string[];      // e.g., ['MsoTableGrid', 'table-bordered']
  rowCount: number;
  colCount: number;
}
```

### Volume DataTable Row Schema

```typescript
interface VolumeActRow {
  id: string;              // Extracted from href pattern
  title: string;           // Bengali title from anchor text
  url: string;             // Absolute URL to act-details page
  actNumber: string;       // From Cell 2
  rowIndex: number;        // Original row order in DataTable
}
```

### Page Type Enum

```typescript
enum PageType {
  RANGE_INDEX = 'range_index',
  VOLUME = 'volume',
  ACT_DETAILS = 'act_details',
  ACT_SUMMARY = 'act_summary',
  UNSUPPORTED = 'unsupported',
  INVALID_DOMAIN = 'invalid_domain'
}
```

### Queue Item Schema

```typescript
interface QueueItem {
  id: string;              // Unique identifier (timestamp + actNumber)
  actNumber: string;       // Act number from URL
  title: string;           // Act title (Bengali)
  url: string;             // Full URL to act-details page
  year?: string;           // Year if available
  volumeNumber?: string;   // Source volume number
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;          // Error message if status is 'error'
  addedAt: string;         // ISO 8601 timestamp
}
```

### Captured Act Schema

```typescript
interface CapturedAct {
  id: string;              // Unique identifier
  actNumber: string;       // Act number
  title: string;           // Act title (Bengali)
  content: string;         // Full legal text
  url: string;             // Source URL
  volumeNumber?: string;   // Source volume number
  sections: {
    counts: SectionCounts;
    markers?: SectionMarker[];
  };
  metadata: MetadataObject;
  capturedAt: string;      // ISO 8601 timestamp
}
```

### Corpus Export Schema

**DEPRECATED**: The combined corpus export format is deprecated in favor of independent file exports.

The extension now exports acts and volumes as separate, independent files:

#### Individual Act Export (Primary Format)

Each act is exported as a separate JSON file with filename: `bdlaw_act_{internal_id}_{timestamp}.json`

**METHODOLOGICAL PRINCIPLE**: Corpus-stage extraction only. No semantic interpretation, no classification.

```json
{
  "identifiers": {
    "internal_id": "754",
    "note": "internal_id is the bdlaws database identifier, not the legal citation number"
  },
  "act_number": "754",
  "title": "অর্থ আইন, ১৯৯১",
  "content": "Full legal text...",
  "url": "http://bdlaws.minlaw.gov.bd/act-details-754.html",
  "volume_number": "28",
  "marker_frequency": {
    "ধারা": {
      "count": 12,
      "method": "raw string frequency, including cross-references"
    },
    "অধ্যায়": {
      "count": 0,
      "method": "raw string frequency"
    },
    "তফসিল": {
      "count": 10,
      "method": "raw string frequency, including schedule references"
    }
  },
  "_metadata": {
    "source": "bdlaws.minlaw.gov.bd",
    "source_url": "http://bdlaws.minlaw.gov.bd/act-details-754.html",
    "scraped_at": "2024-01-15T10:30:00.000Z",
    "extracted_at": "2024-01-15T10:30:00.000Z",
    "scraping_method": "manual page-level extraction",
    "tool": "BDLawCorpus",
    "language": "bn",
    "research_purpose": "academic legal corpus construction",
    "disclaimer": "This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed."
  }
}
```

**Schema Design Decisions (v2.0)**:

| Field | Included | Rationale |
|-------|----------|-----------|
| `identifiers.internal_id` | ✅ | bdlaws database ID from URL |
| `identifiers.note` | ✅ | Clarifies this is NOT the legal citation |
| `act_number` | ⚠️ DEPRECATED | Kept for backward compatibility |
| `title` | ✅ | Direct extraction from DOM |
| `content` | ✅ | Raw text, noise-filtered |
| `url` | ✅ | Source provenance |
| `volume_number` | ✅ | Direct extraction from URL |
| `marker_frequency.*.count` | ✅ | Integer occurrence count |
| `marker_frequency.*.method` | ✅ | Documents counting methodology |
| `_metadata` | ✅ | Provenance and timestamps |
| `structured_sections` | ❌ | Semantic interpretation - Phase 2 |
| `tables` | ❌ | Structural inference - Phase 2 |
| `amendments` | ❌ | Legal classification - Phase 2 |
| `act_year`, `act_serial` | ❌ | Requires title parsing - Phase 2 |

**Why `marker_frequency` includes method documentation**:
- Each marker now includes both `count` (integer) and `method` (string explaining the counting methodology)
- This explicit documentation prevents misinterpretation by researchers
- Example: অর্থ আইন, ১৯৯১ (Act 754) has `"ধারা": { "count": 12, "method": "raw string frequency, including cross-references" }`
- The count includes cross-references to Income Tax Ordinance sections, not just structural sections in this act

**Critical Identifier Clarification**:
- `internal_id` (e.g., "754") is the bdlaws database identifier from URL `/act-details-{ID}.html`
- This is NOT the legal citation number
- Example: Act 754 has legal citation "১৯৯১ সনের ২১ নং আইন" (Act No. 21 of 1991)
- Extracting legal citation (act_year, act_serial) requires title/preamble parsing → Phase 2

**What belongs in Phase 2 (post-processing)**:
- `structured_sections`: Requires inferring section boundaries and semantics
- `tables`: Requires structural interpretation of HTML
- `amendments`: Requires classifying legal intent (deletion, modification, substitution)
- `document_type`: Requires classification (amendatory, appropriation, standalone)
- `constitutional_basis`: Requires preamble parsing (Article 93(1) vs 93(3))
- `act_year`, `act_serial`: Requires title/preamble parsing for legal citation
- These are valuable for legal NLP but cross the boundary from extraction to analysis

**Known Data Completeness Issues**:
- Some acts reference তফসিল (schedules) that are not present in the HTML
- `marker_frequency.তফসিল.count` counts references, not actual schedule content
- Schedule data may require separate extraction from PDF sources

#### Volume Catalog Export

Volume catalogs are exported as separate JSON files with filename: `bdlaw_volume_{volume_number}_{timestamp}.json`

```json
{
  "volume_number": "56",
  "source_url": "http://bdlaws.minlaw.gov.bd/volume-56.html",
  "captured_at": "2024-01-15T10:30:00.000Z",
  "total_acts": 25,
  "acts": [
    {
      "title": "আইনের শিরোনাম",
      "year": "২০২৩",
      "act_number": "১৫১৪",
      "url": "http://bdlaws.minlaw.gov.bd/act-details-1514.html"
    }
  ],
  "_metadata": {
    "source": "bdlaws.minlaw.gov.bd",
    "source_url": "http://bdlaws.minlaw.gov.bd/volume-56.html",
    "scraped_at": "2024-01-15T10:30:00.000Z",
    "extracted_at": "2024-01-15T10:30:00.000Z",
    "scraping_method": "manual page-level extraction",
    "tool": "BDLawCorpus",
    "language": "bn",
    "research_purpose": "academic legal corpus construction",
    "disclaimer": "This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed."
  }
}
```

#### Batch Export Behavior

When "Export All as Separate Files" is clicked:
1. Each captured act is exported as an individual JSON file
2. Files are downloaded sequentially with a small delay to prevent browser blocking
3. Each file is self-contained with complete metadata
4. No combined corpus file is generated

### Content Noise Filtering

The content script applies noise filtering during extraction to remove UI elements while preserving legal text.

```javascript
// content.js noise filtering (also in bdlaw-extractor.js for testing)
const BDLAW_UI_NOISE_PATTERNS = [
  'প্রিন্ট ভিউ',           // Print View button
  /^Top$/gm,               // Top navigation link
  /Copyright © \d{4}/g,    // Copyright notices
  /Legislative and Parliamentary Affairs Division/g  // Footer text
];

/**
 * Filter UI noise from extracted content
 * Requirements: 28.1-28.6
 * 
 * Applied during extraction in content.js, not as a post-processing step.
 * This ensures the content field in exports is already clean.
 */
function bdlawFilterContentNoise(text) {
  if (!text || typeof text !== 'string') return text;
  
  let filtered = text;
  
  // Remove UI noise patterns
  for (const pattern of BDLAW_UI_NOISE_PATTERNS) {
    if (typeof pattern === 'string') {
      filtered = filtered.split(pattern).join('');
    } else {
      filtered = filtered.replace(pattern, '');
    }
  }
  
  // Trim empty lines at beginning and end
  filtered = filtered.replace(/^[\s\n]+/, '');
  filtered = filtered.replace(/[\s\n]+$/, '');
  
  return filtered;
}
```

**Integration Point**: The `extractBDLawActContent()` function in content.js applies `bdlawFilterContentNoise()` to:
1. The main content string before returning
2. Each structured section's `sectionBody` field

### Volume Number Extraction

```javascript
/**
 * Extract volume number from URL
 * Requirements: 29.1-29.5
 */
extractVolumeNumber(url) {
  if (!url || typeof url !== 'string') return 'unknown';
  
  const match = url.match(/\/volume-(\d+)\.html/);
  return match ? match[1] : 'unknown';
}
```

### Side Panel State Management

```javascript
// sidepanel.js state management
const SidePanelState = {
  currentTab: 'capture' | 'queue' | 'export',
  currentUrl: string,
  pageType: PageType | null,
  currentVolume: {
    volumeNumber: string,
    url: string,
    acts: Array<{ title, year, actNumber, url }>,
    capturedAt: string
  } | null,
  queue: QueueItem[],
  capturedActs: CapturedAct[],
  isProcessing: boolean
};

// Chrome Storage Keys
const STORAGE_KEYS = {
  QUEUE: 'bdlaw_queue',
  CAPTURED_ACTS: 'bdlaw_captured_acts',
  CURRENT_VOLUME: 'bdlaw_current_volume',
  EXPORT_HISTORY: 'bdlaw_export_history'
};
```

### Data Reset and Clearing

The extension provides a "Clear All Data" function to reset all extracted data and start fresh.

```javascript
/**
 * Clear and reset all extracted data
 * Requirements: 32.1-32.8
 * 
 * Removes all captured acts, queue items, and current volume from storage.
 * Displays confirmation dialog before deletion.
 */
async function clearAllData() {
  const actCount = state.capturedActs.length;
  const queueCount = state.queue.length;
  const hasVolume = state.currentVolume !== null;

  // Show confirmation with item counts
  const message = `Are you sure you want to clear all data?\n\n` +
    `This will permanently delete:\n` +
    `• ${actCount} captured act(s)\n` +
    `• ${queueCount} queued item(s)\n` +
    `${hasVolume ? '• Current volume catalog\n' : ''}` +
    `\nThis action cannot be undone.`;

  if (!confirm(message)) return;

  // Clear all state
  state.capturedActs = [];
  state.queue = [];
  state.currentVolume = null;

  // Save to storage
  await saveToStorage();

  // Update UI elements
  updateQueueBadge();
  renderQueue();
  updateExportStats();
  showCurrentVolume();
}
```

**UI Integration**: The "Clear All Data" button is placed in the Export tab with danger styling (red tones) and includes a warning message indicating the action is permanent.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Domain Restriction Enforcement

*For any* URL string, the page detector SHALL return `isAllowedDomain() = true` if and only if the URL starts with `http://bdlaws.minlaw.gov.bd/`

**Validates: Requirements 1.1, 1.2**

### Property 2: Page Type Classification Determinism

*For any* valid bdlaws.minlaw.gov.bd URL, the page type classification SHALL be deterministic—calling `detectPageType()` multiple times with the same URL SHALL always return the same result

**Validates: Requirements 2.1-2.5**

### Property 3: Layer Detection Accuracy

*For any* URL matching `/laws-of-bangladesh.html`, the detector SHALL return `RANGE_INDEX`; for `/volume-*.html`, SHALL return `VOLUME`; for `/act-details-*.html`, SHALL return `ACT_DETAILS`

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Metadata Completeness

*For any* generated metadata object, all required fields (source, source_url, scraped_at, scraping_method, tool, language, research_purpose) SHALL be present and non-empty

**Validates: Requirements 8.1, 8.2**

### Property 5: Metadata Validation Rejection

*For any* metadata object missing one or more required fields, the validator SHALL return `valid: false` and list all missing fields

**Validates: Requirements 8.2**

### Property 6: Export JSON Round-Trip

*For any* valid act content and metadata, formatting as JSON and then parsing SHALL produce an equivalent object structure

**Validates: Requirements 12.1, 12.5**

### Property 7: Section Marker Detection Completeness

*For any* text containing Bengali section markers (ধারা, অধ্যায়, তফসিল), the detector SHALL identify all occurrences with correct line numbers and positions

**Validates: Requirements 9.1, 9.2**

### Property 8: Content Preservation

*For any* extracted legal text, the content field in the export SHALL be byte-identical to the source text (no modification, summarization, or restructuring)

**Validates: Requirements 9.4, 9.5**

### Property 9: Filename Uniqueness

*For any* two exports with different act numbers or timestamps, the generated filenames SHALL be different

**Validates: Requirements 5.6, 12.4**

### Property 10: Extraction Reproducibility

*For any* page that has not changed, repeated extraction SHALL produce identical content output

**Validates: Requirements 12.6**

### Property 11: URL Preservation

*For any* extraction, the source_url in metadata SHALL exactly match the original HTTP URL as served by the website

**Validates: Requirements 1.5**

### Property 12: Queue Persistence

*For any* queue modification (add, remove, status update), the queue state SHALL be persisted to Chrome storage and recoverable after browser restart

**Validates: Requirements 19.5**

### Property 13: Corpus Export Completeness

*For any* corpus export, all captured acts SHALL be included with their complete content and metadata

**Validates: Requirements 21.2, 21.4**

### Property 14: Volume DataTable Extraction Accuracy

*For any* Volume page with a `table.table-search` DataTable, the extractor SHALL extract all rows preserving: Cell 0 (year/ID), Cell 1 (title with URL from anchor), Cell 2 (act number), and the original row order

**Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.6**

### Property 15: URL Normalization

*For any* relative URL extracted from a Volume DataTable, the normalizer SHALL produce an absolute URL starting with `http://bdlaws.minlaw.gov.bd/`

**Validates: Requirements 22.5**

### Property 16: Section Row Extraction Completeness

*For any* Act Detail page with `.lineremoves` section rows, the extractor SHALL extract all sections preserving: section title from `.txt-head`, section body from `.txt-details`, title-body association, and original document order

**Validates: Requirements 23.3, 23.4, 23.5, 23.6, 23.7**

### Property 17: Table Matrix Parsing Integrity

*For any* table with `rowspan` or `colspan` attributes, the matrix-based parser SHALL produce a 2D array where: cell positions are not shifted by merged cells, the logical grid structure is preserved, and whitespace is normalized

**Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.6, 24.7**

### Property 18: Amendment Marker Detection Completeness

*For any* text containing amendment markers ("বিলুপ্ত", "সংশোধিত", "প্রতিস্থাপিত"), the detector SHALL identify all occurrences with line numbers and positions, include them in the `amendments` array, and preserve the original text unchanged

**Validates: Requirements 25.1, 25.2, 25.3, 25.4**

### Property 19: Content Noise Filtering Preservation

*For any* extracted content containing UI noise patterns ("প্রিন্ট ভিউ", "Top", "Copyright ©"), the filter SHALL remove these patterns while preserving all Bengali legal text and section markers (ধারা, অধ্যায়, তফসিল)

**Validates: Requirements 28.1, 28.2, 28.3, 28.5, 28.6**

### Property 20: Queue Deduplication Uniqueness

*For any* queue containing acts, adding an act with an existing act_number SHALL be rejected, and the queue SHALL contain only unique act_numbers

**Validates: Requirements 27.1, 27.2, 27.4**

### Property 21: Volume Number Extraction Accuracy

*For any* URL matching `/volume-{XX}.html`, the extractor SHALL correctly parse and return the volume number; for non-volume URLs, SHALL return "unknown"

**Validates: Requirements 29.2, 29.5**

### Property 22: Corpus Export Structured Data Completeness

*For any* corpus export, each act SHALL include `structured_sections`, `tables`, and `amendments` arrays (empty if no data), and `volume_number` SHALL never be null

**Validates: Requirements 26.1, 26.2, 26.3, 26.5, 29.4**

## Error Handling

### Domain Validation Errors

| Error Condition | User Message | Action |
|----------------|--------------|--------|
| Non-bdlaws domain | "This tool only works on bdlaws.minlaw.gov.bd" | Disable all extraction buttons |
| Invalid URL format | "Unable to validate page URL" | Disable extraction, show error |

### Page Type Errors

| Error Condition | User Message | Action |
|----------------|--------------|--------|
| Range Index Page | "Navigation Page: Browse to a Volume page to see available acts" | Disable extraction |
| Act Summary Page | "Navigate to 'View Details' for full text extraction" | Disable extraction, show guidance |
| Unsupported Page | "This page type is not supported for extraction" | Disable extraction |

### Extraction Errors

| Error Condition | User Message | Action |
|----------------|--------------|--------|
| No content found | "No legal content found on this page" | Show error, suggest checking page |
| Selector mismatch | "Page structure not recognized" | Show error, log selectors tried |
| Empty extraction | "Extraction returned empty content" | Prevent export, show warning |
| DataTable not found | "Volume table structure not found on this page" | Show error, suggest page may have changed |
| Section rows not found | "Act section structure not found on this page" | Show error, suggest page may have changed |
| Table parsing error | "Error parsing table with merged cells" | Log error, continue with text extraction |
| Malformed rowspan/colspan | "Table contains invalid merge attributes" | Skip table, log warning |

### Export Errors

| Error Condition | User Message | Action |
|----------------|--------------|--------|
| Metadata validation failed | "Required metadata missing: [fields]" | Block export, show missing fields |
| JSON validation failed | "Export data is malformed" | Block export, show error |
| Download failed | "Failed to save file" | Show error, allow retry |
| File exists | "File already exists. Overwrite?" | Show confirmation dialog |

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **Page Type Detector Tests**
   - Range index URL correctly identified as Layer 1
   - Volume URLs correctly identified as Layer 2
   - Act details URLs correctly identified as Layer 3
   - Act summary URLs correctly identified as intermediate
   - Invalid domains return INVALID_DOMAIN
   - Edge cases: trailing slashes, query parameters

2. **Legal Extractor Tests**
   - Act content extraction with all selectors
   - Volume catalog extraction
   - Bengali markers detected: ধারা, অধ্যায়, তফসিল
   - Section counts accurate
   - Empty content handled gracefully
   - DataTable extraction with specific cell structure
   - Section row extraction with title-body pairing
   - Table parsing with rowspan/colspan

3. **Metadata Generator Tests**
   - All required fields present
   - Timestamp in ISO 8601 format
   - URL preserved exactly (HTTP)
   - Disclaimer included

4. **Export Format Tests**
   - Act JSON structure matches schema
   - Volume JSON structure matches schema
   - UTF-8 encoding preserved
   - Filename format correct
   - Structured sections included
   - Tables exported as 2D arrays
   - Amendments array populated

5. **Table Parser Tests**
   - Simple table without merged cells
   - Table with rowspan only
   - Table with colspan only
   - Table with both rowspan and colspan
   - MsoTableGrid class tables
   - Whitespace normalization

6. **Amendment Marker Tests**
   - Detection of বিলুপ্ত (deleted)
   - Detection of সংশোধিত (amended)
   - Detection of প্রতিস্থাপিত (substituted)
   - Multiple markers in same text
   - Context extraction around markers

### Property-Based Tests

Property-based tests verify universal properties across many generated inputs. Each test runs minimum 100 iterations using fast-check library.

1. **Domain Validation Property Test**
   - **Feature: bdlawcorpus-mode, Property 1: Domain Restriction Enforcement**
   - Generate random URLs, verify only http://bdlaws.minlaw.gov.bd/* returns true

2. **Page Type Determinism Property Test**
   - **Feature: bdlawcorpus-mode, Property 2: Page Type Classification Determinism**
   - Generate valid URLs, verify deterministic classification

3. **Layer Detection Property Test**
   - **Feature: bdlawcorpus-mode, Property 3: Layer Detection Accuracy**
   - Generate URLs for each layer, verify correct classification

4. **Metadata Completeness Property Test**
   - **Feature: bdlawcorpus-mode, Property 4: Metadata Completeness**
   - Generate metadata for random URLs, verify all fields present

5. **JSON Round-Trip Property Test**
   - **Feature: bdlawcorpus-mode, Property 6: Export JSON Round-Trip**
   - Generate random content, verify JSON serialize/deserialize identity

6. **Section Marker Detection Property Test**
   - **Feature: bdlawcorpus-mode, Property 7: Section Marker Detection Completeness**
   - Generate text with known markers, verify all detected

7. **Content Preservation Property Test**
   - **Feature: bdlawcorpus-mode, Property 8: Content Preservation**
   - Generate Bengali text, verify byte-identical after extraction

8. **Filename Uniqueness Property Test**
   - **Feature: bdlawcorpus-mode, Property 9: Filename Uniqueness**
   - Generate pairs with different act/timestamp, verify different filenames

9. **URL Preservation Property Test**
   - **Feature: bdlawcorpus-mode, Property 11: URL Preservation**
   - Generate extractions, verify source_url matches original HTTP URL

10. **Volume DataTable Extraction Property Test**
    - **Feature: bdlawcorpus-mode, Property 14: Volume DataTable Extraction Accuracy**
    - Generate DataTable DOM structures, verify all cells extracted with correct order

11. **URL Normalization Property Test**
    - **Feature: bdlawcorpus-mode, Property 15: URL Normalization**
    - Generate relative URLs, verify absolute URL output with correct domain

12. **Section Row Extraction Property Test**
    - **Feature: bdlawcorpus-mode, Property 16: Section Row Extraction Completeness**
    - Generate section row DOM structures, verify title-body pairs and order preserved

13. **Table Matrix Parsing Property Test**
    - **Feature: bdlawcorpus-mode, Property 17: Table Matrix Parsing Integrity**
    - Generate tables with rowspan/colspan, verify 2D array output without data shifting

14. **Amendment Marker Detection Property Test**
    - **Feature: bdlawcorpus-mode, Property 18: Amendment Marker Detection Completeness**
    - Generate text with amendment markers, verify all detected with locations

15. **Content Noise Filtering Property Test**
    - **Feature: bdlawcorpus-mode, Property 19: Content Noise Filtering Preservation**
    - Generate content with UI noise patterns, verify noise removed and legal text preserved

16. **Queue Deduplication Property Test**
    - **Feature: bdlawcorpus-mode, Property 20: Queue Deduplication Uniqueness**
    - Generate queue operations with duplicate act_numbers, verify duplicates rejected

17. **Volume Number Extraction Property Test**
    - **Feature: bdlawcorpus-mode, Property 21: Volume Number Extraction Accuracy**
    - Generate volume URLs, verify correct volume number extraction

18. **Corpus Export Completeness Property Test**
    - **Feature: bdlawcorpus-mode, Property 22: Corpus Export Structured Data Completeness**
    - Generate corpus exports, verify all acts include structured_sections, tables, amendments arrays and volume_number

## Document Analysis and Known Limitations

This section documents analyzed legal documents and known limitations discovered during corpus validation.

### Schema Version History

#### Schema v2.0 (Current)

**Changes from v1.0**:
1. **Identifier Separation**: Added `identifiers` object to distinguish internal database IDs from legal citation numbers
2. **Marker Frequency Clarification**: Each marker now includes `count` and `method` fields documenting the counting methodology
3. **Backward Compatibility**: `act_number` field retained but marked DEPRECATED

**Example v2.0 Schema**:
```json
{
  "identifiers": {
    "internal_id": "754",
    "note": "internal_id is the bdlaws database identifier, not the legal citation number"
  },
  "act_number": "754",
  "marker_frequency": {
    "ধারা": { "count": 12, "method": "raw string frequency, including cross-references" },
    "অধ্যায়": { "count": 0, "method": "raw string frequency" },
    "তফসিল": { "count": 10, "method": "raw string frequency, including schedule references" }
  }
}
```

### Analyzed Document Types

The corpus contains multiple document types, each with distinct characteristics:

#### 1. Amendatory Acts/Ordinances (সংশোধন আইন/অধ্যাদেশ)

**Examples**: Acts 1519, 1520, 1522, 1523, 754

**Characteristics**:
- Modify existing laws (delta/patch laws)
- Constitutional basis: Article 93(1) for ordinances
- Contain amendment verbs: বিলুপ্ত (deletion), সংশোধিত (amendment), প্রতিস্থাপিত (substitution)
- Cross-reference target acts via hyperlinks
- `marker_frequency.ধারা.count` includes cross-references to other laws
- Often have mixed English/Bengali drafting

**Example - Act 754** (অর্থ আইন, ১৯৯১):
```json
{
  "identifiers": { "internal_id": "754" },
  "title": "অর্থ আইন, ১৯৯১",
  "marker_frequency": {
    "ধারা": { "count": 12, "method": "raw string frequency, including cross-references" },
    "তফসিল": { "count": 10, "method": "raw string frequency, including schedule references" }
  }
}
```
- Legal citation: ১৯৯১ সনের ২১ নং আইন (Act No. 21 of 1991)
- `ধারা: 12` includes cross-references to Income Tax Ordinance sections

#### 2. Appropriation Acts (নির্দিষ্টকরণ আইন)

**Examples**: Acts 752, 753, 1544

**Characteristics**:
- Financial/budget laws authorizing expenditure
- Constitutional basis: Article 93(3) - different from amendatory ordinances
- Reference তফসিল (Schedule) for detailed allocations
- No amendment verbs (standalone laws)
- Schedule content often NOT present in HTML
- Typically very short (3 sections)

**Example - Act 752** (নির্দিষ্টকরণ (সম্পূরক) আইন, ১৯৯১):
```json
{
  "identifiers": { "internal_id": "752" },
  "title": "নির্দিষ্টকরণ (সম্পূরক) আইন, ১৯৯১",
  "marker_frequency": {
    "ধারা": { "count": 0, "method": "raw string frequency" },
    "তফসিল": { "count": 3, "method": "raw string frequency, including schedule references" }
  }
}
```
- `তফসিল: 3` counts references to schedule, but schedule content is missing from HTML
- Content length ~700 chars is CORRECT - these are intentionally minimal acts

#### 3. Repeal Acts (রহিতকরণ আইন)

**Examples**: Act 737

**Characteristics**:
- Repeal existing laws
- Typically only 2 sections: short title and repeal clause
- Very short content is CORRECT (not extraction failure)
- English titles common for older acts

**Example - Act 737**:
```json
{
  "identifiers": { "internal_id": "737" },
  "title": "The Development of Industries (Control and Regulation) (Repeal) Act, 1990",
  "marker_frequency": {
    "ধারা": { "count": 0, "method": "raw string frequency" },
    "অধ্যায়": { "count": 0, "method": "raw string frequency" },
    "তফসিল": { "count": 0, "method": "raw string frequency, including schedule references" }
  }
}
```
- Content length ~300 chars is CORRECT - repeal acts are intentionally minimal

#### 4. Substantive Acts (মূল আইন)

**Examples**: Acts 738, 750

**Characteristics**:
- Full standalone laws with multiple sections
- Define new legal frameworks
- May include definitions (সংজ্ঞা), penalties (দণ্ড), rule-making powers (বিধি প্রণয়নের ক্ষমতা)
- Longer content (5,000-50,000+ chars)

**Example - Act 738** (প্রাথমিক শিক্ষা (বাধ্যতামূলক করণ) আইন, ১৯৯০):
```json
{
  "identifiers": { "internal_id": "738" },
  "title": "প্রাথমিক শিক্ষা (বাধ্যতামূলক করণ) আইন, ১৯৯০",
  "marker_frequency": {
    "ধারা": { "count": 6, "method": "raw string frequency, including cross-references" }
  }
}
```
- 8 sections covering compulsory primary education
- Content length ~6,000 chars

#### 5. Omnibus Amendment Ordinances

**Examples**: Act 1518

**Characteristics**:
- Amend multiple target laws in a single ordinance
- Typically name-change or terminology updates
- High cross-reference density

### Content Length Guidelines

**NOT extraction failures** - these are legitimate document lengths:

| Document Type | Typical Length | Example |
|---------------|----------------|---------|
| Repeal Act | 200-500 chars | Act 737 |
| Appropriation Act | 500-1,000 chars | Acts 752, 753 |
| Short Amendment | 1,000-3,000 chars | - |
| Substantive Act | 5,000-50,000+ chars | Acts 738, 750, 754 |
| Finance Act | 10,000-100,000+ chars | Act 754 |

### Known Limitations

#### 1. Missing Schedule Content (তফসিল)

**Issue**: Some acts reference schedules (তফসিল) that are not present in the HTML page.

**Affected Documents**: Appropriation acts (752, 753), acts with detailed tables/annexures

**Impact**: 
- `marker_frequency.তফসিল.count` counts references, not actual schedule content
- Corpus may be incomplete for acts with significant schedule data

**Mitigation**: Document this limitation; schedule extraction may require separate handling or PDF sources.

#### 2. Cross-Reference Inflation in marker_frequency

**Issue**: `marker_frequency.ধারা.count` counts ALL occurrences of "ধারা", including:
- Structural sections in the current document
- Cross-references to sections in other laws
- References in preamble text

**Example**: Act 754 has ~11 numbered clauses but `ধারা: 12` due to cross-references.

**Mitigation**: Schema v2.0 includes `method` field documenting this behavior. Users must understand this counts string occurrences, not structural sections.

#### 3. Legal Citation Not Extracted

**Issue**: The legal citation (e.g., "১৯৯১ সনের ২১ নং আইন") is in the title/preamble but not extracted as structured metadata.

**Example**: Act 754 has:
- `internal_id`: "754" (database ID)
- Legal citation: "১৯৯১ সনের ২১ নং আইন" (Act No. 21 of 1991)

**Impact**: Cannot programmatically cite laws using standard legal citation format.

**Mitigation**: Schema v2.0 adds `identifiers.note` clarifying this limitation. Legal citation extraction (act_year, act_serial) is Phase 2 work.

#### 4. Constitutional Basis Not Captured

**Issue**: The constitutional article authorizing the ordinance (93(1) vs 93(3)) is in the preamble text but not extracted as structured metadata.

**Impact**: Cannot programmatically distinguish financial ordinances from general ordinances.

**Mitigation**: This is Phase 2 work - preamble parsing for constitutional basis extraction.

#### 5. Document Type Classification

**Issue**: The corpus does not classify documents by type (amendatory, appropriation, standalone, repeal).

**Impact**: Users cannot filter by document type without text analysis.

**Mitigation**: This is intentional - classification is semantic interpretation and belongs in Phase 2.

#### 6. Act Summary Pages (Table of Contents)

**Examples**: Acts 734, 735 (accessed via `/act-734.html`, `/act-735.html`)

**Characteristics**:
- URL pattern: `/act-{ID}.html` (NOT `/act-details-{ID}.html`)
- Contains Table of Contents (সূচি) only
- Section titles as links to individual section pages
- NO full content - only navigation
- Has "View Full Act" button linking to `/act-details-{ID}.html`

**HTML Structure**:
```html
<section class="search-here">
  <p class="act-section-name">
    <a href="/act-734/section-30246.html">১৷ শিরোনামা ও প্রবর্তন</a>
  </p>
  <!-- ... more section links ... -->
</section>
```

**Extraction Status**: ❌ NOT EXTRACTABLE
- Classified as `ACT_SUMMARY` page type
- Users must navigate to `/act-details-{ID}.html` for full content
- UI correctly blocks extraction on these pages

**User Guidance**: When on an Act Summary page, click "View Full Act" (সম্পূর্ণ আইন দেখুন) button to access extractable content.

### Validation Checklist for New Documents

When analyzing new HTML documents, verify:

1. ✅ Uses `.boxed-layout` + `.lineremoves` structure
2. ✅ Title extracted from `<h3>` in `.bg-act-section`
3. ✅ Content extracted from `.txt-details` columns
4. ✅ Cross-references preserved as text (hyperlinks stripped)
5. ✅ Amendment verbs detected in `marker_frequency` context
6. ⚠️ Check if তফসিল content is present or only referenced
7. ⚠️ Note constitutional basis (93(1) vs 93(3)) for documentation
8. ⚠️ Verify URL is `/act-details-{ID}.html` NOT `/act-{ID}.html` (summary page)

### Testing Framework

- **Unit Tests**: Jest with jsdom for DOM simulation
- **Property-Based Tests**: fast-check library for JavaScript
- **Minimum iterations**: 100 per property test
- **Coverage target**: All acceptance criteria from requirements

### Test File Structure

```
tests/
├── unit/
│   ├── page-detector.test.js
│   ├── legal-extractor.test.js
│   ├── metadata-generator.test.js
│   ├── export-handler.test.js
│   ├── table-parser.test.js
│   └── amendment-detector.test.js
├── property/
│   ├── domain.property.test.js
│   ├── page-type.property.test.js
│   ├── metadata.property.test.js
│   ├── export-roundtrip.property.test.js
│   ├── section-markers.property.test.js
│   ├── content-preservation.property.test.js
│   ├── filename-uniqueness.property.test.js
│   ├── url-preservation.property.test.js
│   ├── volume-datatable.property.test.js
│   ├── url-normalization.property.test.js
│   ├── section-rows.property.test.js
│   ├── table-matrix.property.test.js
│   ├── amendment-markers.property.test.js
│   ├── content-noise-filtering.property.test.js
│   ├── queue-deduplication.property.test.js
│   ├── volume-number-extraction.property.test.js
│   └── corpus-export-completeness.property.test.js
└── integration/
    └── extraction-workflow.test.js
```
