# BDLawCorpus

A browser-based archival snapshot tool for capturing DOM-rendered text from bdlaws.minlaw.gov.bd.

## Academic Positioning Statement

BDLawCorpus is a browser-based archival system designed to capture and preserve browser-rendered legal texts from the official Bangladesh Laws website (bdlaws.minlaw.gov.bd) for academic research purposes. It provides a transparent, reproducible snapshot of DOM-parsed text as rendered at extraction time, with strict guarantees of content immutability, explicit trust boundaries, and zero legal inference. By separating canonical raw capture (`content_raw`) from all derived representations and documenting structural, numeric, and provenance limitations, BDLawCorpus positions itself as a digital humanities and legal informatics resource rather than an authoritative legal database. The project is intended to support exploratory research in corpus linguistics, information retrieval, and legal text analysis, while explicitly disallowing claims of legal validity, completeness, or Gazette equivalence.

## Archival Nature

BDLawCorpus captures **browser-rendered DOM text nodes** via `element.textContent` from the official Bangladesh Laws website. This is an archival snapshot tool, not a legal database.

**What this captures:**
- Browser-parsed DOM text nodes obtained via `element.textContent`
- Text as rendered by the Chrome browser at extraction time
- Content after JavaScript execution has modified the DOM

**What this does NOT capture:**
- Raw HTML source code
- HTTP response bytes
- Server-side content before browser rendering
- Byte-identical copies of server responses

## Explicit Disclaimers

This tool and its outputs are:

- ❌ **NOT** a legal database
- ❌ **NOT** an authoritative source of law
- ❌ **NOT** a Gazette reconstruction
- ❌ **NOT** legally validated or verified
- ❌ **NOT** continuously updated or maintained
- ❌ **NOT** suitable for legal advice or proceedings

## Trust Boundary

**You CAN trust:**
- Text appeared on bdlaws HTML pages at extraction time
- No semantic rewriting was applied to extracted content
- All transformations are logged in the export

**You MUST NOT trust:**
- Legal validity of any content
- Gazette equivalence or official status
- Completeness of any act or corpus
- Numerical accuracy (dates, amounts, references)
- Amendment correctness or currency
- Post-extraction relevance or applicability

## Technical Specification

### DOM Extraction Method

The extraction method is strictly defined:

```javascript
// ONLY permitted extraction method
const text = element.textContent;

// STRICTLY FORBIDDEN (layout-dependent, non-deterministic)
// const text = element.innerText;  // NEVER USE
```

This distinction is critical for reproducibility. `textContent` returns all text nodes regardless of CSS styling, while `innerText` is layout-dependent and produces non-deterministic results.

### Content Model

Every extracted act contains three parallel content layers:

| Layer | Description | Modifications Allowed |
|-------|-------------|----------------------|
| `content_raw` | Browser-parsed DOM text via textContent | None (immutable anchor) |
| `content_normalized` | Unicode NFC normalization only | Normalization only |
| `content_corrected` | Encoding-level fixes for HTML artifacts | Non-semantic fixes only |

`content_raw` serves as the immutable anchor for all hashes, offsets, and citation positions.

### Reference Handling

All detected cross-references are **string-level pattern matches only**:

```json
{
  "reference_semantics": "string_match_only",
  "reference_warning": "Keywords detected in proximity to citation strings. No legal relationship, effect, direction, or applicability is implied."
}
```

The system detects citation patterns but does NOT:
- Resolve amendment chains
- Build dependency graphs
- Infer legal relationships
- Determine which act "overrides" another

## Reproducibility Statement

> This dataset is an archival snapshot captured via a browser-based workflow. Exact reproduction is not guaranteed due to browser rendering variations, JavaScript execution timing, and manual navigation sequences.

Factors affecting reproducibility:
- Browser version and rendering engine
- JavaScript execution state at capture time
- Network conditions and page load timing
- Manual navigation path taken by operator

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the project folder
5. The BDLawCorpus icon will appear in your extensions bar

## Usage

### Manual Extraction Workflow

1. Navigate to bdlaws.minlaw.gov.bd
2. Click the BDLawCorpus extension icon to open the side panel
3. Navigate to a volume page to capture the act catalog
4. Add acts to the extraction queue
5. Process the queue (each act requires navigation and extraction)
6. Export the corpus as JSON

**Critical**: All extraction is user-initiated. There is no automated crawling, background scraping, or bulk harvesting.

### Page Types

| Page Type | URL Pattern | Extraction Available |
|-----------|-------------|---------------------|
| Range Index | `/laws-of-bangladesh.html` | Volume links only |
| Volume | `/volume-{N}.html` | Act catalog |
| Act Details | `/act-details-{ID}.html` | Full content |

## Export Schema (v3.1)

```json
{
  "identifiers": {
    "internal_id": "1514",
    "note": "bdlaws database ID, NOT legal citation number"
  },
  "title_raw": "...",
  "content_raw": "...",
  "content_normalized": "...",
  "content_corrected": "...",
  
  "html_capture_definition": "Browser-rendered DOM text nodes",
  "dom_extraction_method": "textContent",
  "content_raw_disclaimer": "Represents browser-parsed DOM text via textContent, not raw HTML or server response bytes",
  
  "reference_semantics": "string_match_only",
  "negation_handling": "classification_suppression_only",
  "numeric_integrity": "best_effort_html_only",
  
  "data_quality": {
    "completeness": "complete|textual_partial|uncertain",
    "ml_usage_warning": "HTML artifacts, encoding noise, and structural gaps are present; suitable only for exploratory retrieval and analysis. Not validated for training or evaluation.",
    "ml_risk_factors": []
  },
  
  "trust_boundary": {
    "can_trust": ["Text appeared on bdlaws HTML pages at extraction time", "..."],
    "must_not_trust": ["Legal validity", "Gazette equivalence", "..."]
  },
  
  "_metadata": {
    "schema_version": "3.1",
    "source": "bdlaws.minlaw.gov.bd",
    "source_url": "http://bdlaws.minlaw.gov.bd/act-details-{ID}.html",
    "scraped_at": "ISO8601 timestamp",
    "extracted_at": "ISO8601 timestamp",
    "scraping_method": "manual page-level extraction",
    "tool": "BDLawCorpus"
  }
}
```

## Intended Use

**Appropriate uses:**
- Academic analysis and digital humanities research
- Exploratory information retrieval
- Corpus linguistics studies
- Low-resource language research

**Inappropriate uses:**
- Legal advice or proceedings
- Authoritative legal reference
- Production ML training without additional validation
- Any use requiring legal accuracy guarantees

## Citation

See `CITATION.cff` for academic citation metadata.

## Documentation

- `ARCHITECTURE.md` — System design and data flow
- `DATA_MODEL.md` — Export schema specification (v3.1)
- `METHODOLOGY.md` — Extraction workflow for academic citation
- `ETHICS.md` — Research ethics and access principles
- `LIMITATIONS.md` — Known technical and epistemic limitations
- `CHANGELOG.md` — Schema version history

## License

MIT License. See `LICENSE` file.

## Acknowledgments

Built for academic research in Digital Humanities, Legal Informatics, and Access to Information studies.
