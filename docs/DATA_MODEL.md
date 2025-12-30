# Data Model

## Export Schema v3.1

This document defines the complete export schema for BDLawCorpus extractions.

## Act Export Structure

### Top-Level Fields

```json
{
  "identifiers": { },
  "title_raw": "string",
  "title_normalized": "string",
  "content_raw": "string",
  "content_normalized": "string",
  "content_corrected": "string",
  
  "html_capture_definition": "string",
  "dom_extraction_method": "string",
  "content_raw_disclaimer": "string",
  
  "reference_semantics": "string",
  "reference_warning": "string",
  "negation_handling": "string",
  "numeric_integrity": "string",
  "numeric_warning": "string",
  
  "marker_frequency": { },
  "cross_references": { },
  "data_quality": { },
  "trust_boundary": { },
  
  "_metadata": { }
}
```

### Identifiers Object

```json
{
  "identifiers": {
    "internal_id": "1514",
    "note": "bdlaws database ID extracted from URL pattern /act-details-{ID}.html. This is NOT the legal citation number."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `internal_id` | string | Database identifier from URL, NOT legal citation |
| `note` | string | Clarification about identifier semantics |

### Content Fields

| Field | Type | Mutability | Description |
|-------|------|------------|-------------|
| `title_raw` | string | Immutable | Act title as extracted from DOM |
| `title_normalized` | string | Derived | Unicode NFC normalized title |
| `content_raw` | string | **Immutable** | Verbatim DOM text via textContent |
| `content_normalized` | string | Derived | Unicode NFC normalized content |
| `content_corrected` | string | Derived | Non-semantic encoding fixes applied |

**Critical**: `content_raw` is the immutable anchor. All hashes, character offsets, and citation positions reference this field.

### Capture Metadata Fields

```json
{
  "html_capture_definition": "Browser-rendered DOM text nodes",
  "dom_extraction_method": "textContent",
  "content_raw_disclaimer": "Represents browser-parsed DOM text via textContent, not raw HTML or server response bytes"
}
```

These fields document exactly what `content_raw` represents.

### Reference Handling Fields

```json
{
  "reference_semantics": "string_match_only",
  "reference_warning": "Keywords detected in proximity to citation strings. No legal relationship, effect, direction, or applicability is implied.",
  "negation_handling": "classification_suppression_only",
  "numeric_integrity": "best_effort_html_only",
  "numeric_warning": "Numeric expressions may be incomplete or malformed due to HTML source limitations"
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `reference_semantics` | `string_match_only` | Citations are pattern matches, not legal relationships |
| `negation_handling` | `classification_suppression_only` | Negation prevents false positive classification |
| `numeric_integrity` | `best_effort_html_only` | No guarantees on numeric accuracy |

### Marker Frequency Object

```json
{
  "marker_frequency": {
    "ধারা": { "count": 45, "method": "raw string frequency, including cross-references" },
    "অধ্যায়": { "count": 5, "method": "raw string frequency" },
    "তফসিল": { "count": 2, "method": "raw string frequency, including schedule references" }
  }
}
```

These are **raw string occurrence counts**, not structural section counts.

### Cross-References Object

```json
{
  "cross_references": {
    "count": 12,
    "method": "pattern-based citation detection",
    "disclaimer": "String-level matches only. No legal relationship implied.",
    "references": [
      {
        "citation_text": "Act XV of 1984",
        "pattern_type": "ENGLISH_ACT_SHORT",
        "line_number": 42,
        "position": 1523,
        "citation_year": "1984",
        "citation_serial": "XV",
        "reference_type": "mention",
        "context_before": "...subject to the provisions of ",
        "context_after": " and any rules made thereunder..."
      }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `citation_text` | string | Matched citation string |
| `pattern_type` | string | Which regex pattern matched |
| `line_number` | integer | 1-based line number in content_raw |
| `position` | integer | Character offset in content_raw |
| `reference_type` | string | Lexical classification (mention, amendment, repeal, etc.) |

**Reference types are lexical classifications based on keyword proximity, NOT legal determinations.**

### Data Quality Object

```json
{
  "data_quality": {
    "completeness": "complete",
    "completeness_disclaimer": "Website representation incomplete; legal completeness unknown",
    "flags": [],
    "issues": [],
    "risks": [],
    "known_limitations": [
      "Preamble and enactment clause may not be present in all HTML extractions",
      "Statutory footnotes may be incomplete or missing from source HTML",
      "Section boundary detection is presentation-dependent"
    ],
    "ml_usage_warning": "HTML artifacts, encoding noise, and structural gaps are present; suitable only for exploratory retrieval and analysis. Not validated for training or evaluation.",
    "ml_risk_factors": [],
    "preamble_present": false,
    "enactment_clause_present": false,
    "statutory_footnotes_present": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `completeness` | string | `complete`, `textual_partial`, or `uncertain` |
| `flags` | array | Detected quality flags |
| `issues` | array | Specific quality issues |
| `ml_usage_warning` | string | Warning about ML suitability |
| `ml_risk_factors` | array | Specific ML risk factors |

### Trust Boundary Object

```json
{
  "trust_boundary": {
    "can_trust": [
      "Text appeared on bdlaws HTML pages at extraction time",
      "No semantic rewriting was applied",
      "Transformations are logged"
    ],
    "must_not_trust": [
      "Legal validity",
      "Gazette equivalence",
      "Completeness",
      "Numerical accuracy",
      "Amendment correctness",
      "Post-extraction relevance"
    ]
  }
}
```

This object MUST be included in every export.

### Metadata Object

```json
{
  "_metadata": {
    "schema_version": "3.1",
    "source": "bdlaws.minlaw.gov.bd",
    "source_url": "http://bdlaws.minlaw.gov.bd/act-details-1514.html",
    "scraped_at": "2025-12-30T10:30:00.000Z",
    "extracted_at": "2025-12-30T10:30:05.000Z",
    "scraping_method": "manual page-level extraction",
    "tool": "BDLawCorpus",
    "language": "bn",
    "research_purpose": "academic legal corpus construction",
    "disclaimer": "This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed."
  }
}
```

## Corpus Export Structure

```json
{
  "_corpus_metadata": {
    "name": "BDLawCorpus Export",
    "source": "bdlaws.minlaw.gov.bd",
    "exported_at": "ISO8601 timestamp",
    "tool": "BDLawCorpus Chrome Extension",
    "total_acts": 150,
    "successful_acts": 148,
    "failed_acts": 2,
    "research_purpose": "academic legal corpus construction",
    "disclaimer": "...",
    "failure_notice": "2 act(s) failed extraction after maximum retry attempts..."
  },
  "acts": [ ]
}
```

## Failed Act Export Structure

```json
{
  "act_number": "1514",
  "title": "Example Act",
  "url": "http://bdlaws.minlaw.gov.bd/act-details-1514.html",
  "extraction_status": "failed",
  "failure_reason": "content_selector_mismatch",
  "attempts": 3,
  "attempt_history": [
    {
      "attempt_number": 1,
      "timestamp": "ISO8601",
      "reason": "content_selector_mismatch",
      "outcome": "failed",
      "selector_strategy": "standard_selectors"
    }
  ],
  "content_raw": null,
  "content_normalized": null,
  "content_corrected": null,
  "_metadata": {
    "extraction_status": "failed",
    "failure_reason": "content_selector_mismatch",
    "selector_strategies_used": ["standard_selectors", "broader_selectors"]
  }
}
```

Failed acts have `null` content fields. Content is NEVER inferred or auto-corrected for failed extractions.

## Schema Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.1 | 2025-12-30 | Added trust_boundary, ml_usage_warning, removed safe_for_ml_training |
| 3.0 | 2025-12-01 | Three-layer content model, transformation audit |
| 2.0 | 2025-11-01 | Cross-reference detection, quality assessment |
| 1.0 | 2025-09-15 | Initial schema |
