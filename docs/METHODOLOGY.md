# Methodology

## Extraction Methodology for Academic Citation

This document describes the extraction methodology used by BDLawCorpus, suitable for inclusion in academic papers and research documentation.

## Overview

BDLawCorpus employs a manual, browser-based extraction workflow to capture DOM-rendered text from the official Bangladesh Laws website (bdlaws.minlaw.gov.bd). The methodology prioritizes transparency, reproducibility, and non-interference with source content.

## Source

**Primary Source**: bdlaws.minlaw.gov.bd  
**Source Type**: Official government website, Ministry of Law and Justice, Bangladesh  
**Access Method**: HTTP (unencrypted)  
**Content Type**: Browser-rendered HTML pages

## Extraction Method

### DOM Text Extraction

Text is extracted exclusively via the DOM `textContent` property:

```javascript
const text = element.textContent;
```

This method:
- Returns all text nodes within an element
- Ignores CSS styling and visibility
- Produces deterministic output for a given DOM state
- Does not depend on layout rendering

The alternative `innerText` property is **strictly forbidden** because it:
- Depends on CSS layout computation
- Produces non-deterministic results
- Varies based on viewport and styling

### Selector Strategy

Content is located using a hierarchical selector strategy:

1. **Primary selectors**: Site-specific containers (`#lawContent`, `.law-content`, `.act-details`)
2. **Fallback selectors**: Generic semantic elements (`article`, `main`, `.boxed-layout`)
3. **Body fallback**: Document body with navigation/footer exclusions

Selectors are hardcoded; user-defined selectors are not permitted.

### Content Processing Pipeline

```
Source Page DOM
      │
      ▼
┌─────────────────────────────────────┐
│  Step 1: DOM Selection              │
│  - Apply selector hierarchy         │
│  - Locate content container         │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Step 2: Text Extraction            │
│  - element.textContent (ONLY)       │
│  - Produces content_raw             │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Step 3: Normalization              │
│  - Unicode NFC normalization        │
│  - Produces content_normalized      │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Step 4: Encoding Repair            │
│  - Non-semantic fixes only          │
│  - HTML entity artifacts            │
│  - Produces content_corrected       │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Step 5: Quality Assessment         │
│  - Missing schedule detection       │
│  - Encoding error detection         │
│  - OCR artifact detection           │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Step 6: Metadata Generation        │
│  - Source URL                       │
│  - Timestamps                       │
│  - Tool identification              │
└─────────────────────────────────────┘
      │
      ▼
JSON Export
```

## Workflow

### Manual Operation

All extraction operations require explicit user initiation:

1. **Navigation**: User manually navigates to target page
2. **Initiation**: User clicks extraction button
3. **Confirmation**: User reviews extraction preview
4. **Storage**: User confirms save operation

There is no automated crawling, background scraping, or bulk harvesting.

### Batch Processing

For corpus construction:

1. User navigates to volume catalog page
2. User adds acts to extraction queue
3. User initiates queue processing
4. System navigates to each act page sequentially
5. User-configured delay between extractions (default: 3 seconds)
6. Failed extractions are logged and optionally retried

### Quality Control

Each extraction undergoes automated quality assessment:

- **Completeness check**: Minimum content threshold (100 characters)
- **Schedule detection**: Flags referenced but missing schedules
- **Encoding detection**: Identifies HTML rendering artifacts
- **OCR detection**: Identifies digitization errors in source

## Provenance Chain

```
┌─────────────────────────────────────┐
│  1. Source Website                  │
│     bdlaws.minlaw.gov.bd            │
│     (Ministry of Law, Bangladesh)   │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  2. Browser Rendering               │
│     Chrome browser                  │
│     JavaScript execution            │
│     DOM construction                │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  3. DOM Text Extraction             │
│     BDLawCorpus extension           │
│     element.textContent             │
│     Manual user initiation          │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  4. Local Storage                   │
│     Chrome extension storage        │
│     No server transmission          │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  5. JSON Export                     │
│     Local filesystem                │
│     UTF-8 encoding                  │
│     Full metadata included          │
└─────────────────────────────────────┘
```

## Reproducibility

### Factors Affecting Reproducibility

1. **Browser version**: Different Chrome versions may render DOM differently
2. **JavaScript execution**: Dynamic content may vary based on timing
3. **Network conditions**: Page load completeness may vary
4. **Navigation path**: Manual navigation introduces variability
5. **Source changes**: Website content may be updated

### Reproducibility Statement

> This dataset is an archival snapshot captured via a browser-based workflow. Exact reproduction is not guaranteed due to browser rendering variations, JavaScript execution timing, and manual navigation sequences.

### Mitigation Measures

- Content hashes (SHA-256) enable integrity verification
- Timestamps record exact extraction time
- Tool version is recorded in metadata
- Transformation logs document all modifications

## Limitations

See `LIMITATIONS.md` for comprehensive documentation of known limitations.

## Citation

When citing this methodology:

```bibtex
@misc{bdlawcorpus_methodology,
  title = {BDLawCorpus Extraction Methodology},
  author = {BDLawCorpus Contributors},
  year = {2024},
  howpublished = {GitHub repository},
  note = {Browser-based DOM text extraction via element.textContent}
}
```

## Ethical Considerations

See `ETHICS.md` for research ethics documentation.
