# Known Limitations

## Overview

This document catalogs the known technical, legal, and epistemic limitations of BDLawCorpus. Understanding these limitations is essential for appropriate use of extracted data.

## Technical Limitations

### DOM Extraction Constraints

| Limitation | Description | Impact |
|------------|-------------|--------|
| Browser rendering dependency | Content depends on Chrome's DOM construction | Different browsers may produce different results |
| JavaScript execution timing | Dynamic content may not be fully loaded | Some content may be missing |
| textContent semantics | Whitespace handling differs from visual rendering | Formatting may not match visual appearance |
| No raw HTML access | Cannot capture original HTML source | Markup structure is lost |

### Selector Limitations

| Limitation | Description | Impact |
|------------|-------------|--------|
| Hardcoded selectors | Cannot adapt to site structure changes | May fail if site redesigned |
| Fallback hierarchy | Generic selectors may capture noise | Quality varies by page structure |
| No XPath support | Limited to CSS selectors | Some content may be unreachable |

### Content Detection Limitations

| Limitation | Description | Impact |
|------------|-------------|--------|
| Section markers are string-based | "ধারা" counted as raw string | Cross-references inflate counts |
| Schedule detection is heuristic | Based on content length after reference | May produce false positives/negatives |
| OCR artifacts from source | Source contains digitization errors | Errors propagate to extractions |

### Storage Limitations

| Limitation | Description | Impact |
|------------|-------------|--------|
| Chrome storage quota | ~10MB local storage limit | Large corpora require export |
| No incremental sync | Full corpus must be re-exported | Export time scales with corpus size |
| Browser-local only | No cloud backup | Data loss risk if browser data cleared |

## Legal Limitations

### No Legal Authority

| Limitation | Description | Impact |
|------------|-------------|--------|
| Not a legal database | Archival snapshot only | Cannot be cited as legal authority |
| Not Gazette equivalent | Does not reproduce official Gazette | No official legal status |
| No legal validation | Content not verified against originals | May contain errors |

### No Legal Interpretation

| Limitation | Description | Impact |
|------------|-------------|--------|
| No amendment resolution | Cannot determine current law | Historical text only |
| No conflict resolution | Cannot determine which law prevails | No hierarchy inference |
| No applicability determination | Cannot determine if law applies | No scope inference |
| No effect inference | Cannot determine legal consequences | No outcome prediction |

### Temporal Limitations

| Limitation | Description | Impact |
|------------|-------------|--------|
| Point-in-time snapshot | Reflects source at extraction time | May be outdated |
| No update tracking | Cannot detect source changes | Staleness not detectable |
| Historical status only | All acts marked as "historical_text" | No currency claims |

## Epistemic Limitations

### Completeness Uncertainty

| Limitation | Description | Impact |
|------------|-------------|--------|
| Source completeness unknown | Cannot verify if source is complete | Gaps may exist |
| Missing schedules | Referenced schedules may not be in HTML | Incomplete acts |
| Missing preambles | Some acts lack preamble in source | Structural incompleteness |
| Missing footnotes | Statutory footnotes may be absent | Annotation gaps |

### Accuracy Uncertainty

| Limitation | Description | Impact |
|------------|-------------|--------|
| OCR errors in source | Digitization errors propagate | Text may be incorrect |
| Encoding artifacts | HTML rendering issues | Characters may be corrupted |
| Numeric uncertainty | Numbers may be malformed | Dates, amounts unreliable |

### Semantic Uncertainty

| Limitation | Description | Impact |
|------------|-------------|--------|
| Reference classification is lexical | Based on keyword proximity | May misclassify relationships |
| Negation detection is heuristic | ±20 character window | May miss or false-positive |
| Section boundaries are presentation-based | Depends on DOM structure | May not match legal structure |

## Source Limitations

### Website Constraints

| Limitation | Description | Impact |
|------------|-------------|--------|
| HTTP only (no HTTPS) | Unencrypted connection | No transport security |
| No API access | Screen scraping only | Fragile to changes |
| No versioning | Cannot access historical versions | Single point-in-time |
| No machine-readable format | HTML only | Parsing required |

### Content Constraints

| Limitation | Description | Impact |
|------------|-------------|--------|
| Bengali/English mixed | Language boundaries unclear | Processing complexity |
| Inconsistent formatting | Structure varies by act | Extraction quality varies |
| External references | Some content on separate pages | May be incomplete |
| Dynamic loading | Some content loaded via JavaScript | Timing-dependent |

## ML/NLP Limitations

### Training Suitability

| Limitation | Description | Impact |
|------------|-------------|--------|
| No ML safety guarantee | Explicitly disclaimed | Not validated for training |
| HTML artifacts present | Encoding noise in text | May affect model quality |
| Structural gaps | Missing sections/schedules | Incomplete examples |
| OCR errors | Source digitization issues | Noisy training data |

### Appropriate ML Uses

| Use Case | Suitability | Notes |
|----------|-------------|-------|
| Exploratory retrieval | Appropriate | With risk acknowledgment |
| Extractive QA | Appropriate | With risk acknowledgment |
| Production training | Not recommended | Without additional validation |
| Legal reasoning | Not appropriate | No legal validity |

## Reproducibility Limitations

### Non-Deterministic Factors

| Factor | Description | Impact |
|--------|-------------|--------|
| Browser version | Rendering may differ | Content may vary |
| JavaScript timing | Dynamic content loading | Completeness may vary |
| Network conditions | Page load completeness | Content may be partial |
| Manual navigation | User path varies | Extraction order varies |

### Mitigation Measures

| Measure | Description | Effectiveness |
|---------|-------------|---------------|
| Content hashing | SHA-256 of content_raw | Enables integrity verification |
| Timestamps | Extraction time recorded | Enables temporal tracking |
| Tool versioning | Version in metadata | Enables method tracking |
| Transformation logs | All changes recorded | Enables audit |

## Operational Limitations

### Performance

| Limitation | Description | Impact |
|------------|-------------|--------|
| Manual operation only | No bulk automation | Slow corpus construction |
| Sequential processing | One act at a time | Time-consuming |
| Configurable delays | Minimum 1 second between extractions | Rate-limited |

### Error Handling

| Limitation | Description | Impact |
|------------|-------------|--------|
| Limited retry | Maximum 3 attempts | Some failures permanent |
| No partial recovery | Failed acts have null content | No partial data |
| No automatic resume | Queue state may be lost | Manual restart required |

## Recommendations

### For Researchers

1. **Acknowledge limitations** in publications
2. **Verify critical information** against official sources
3. **Document extraction parameters** for reproducibility
4. **Use appropriate disclaimers** when sharing data

### For Developers

1. **Do not remove disclaimers** from exports
2. **Preserve content_raw** as immutable anchor
3. **Log all transformations** for audit
4. **Test with diverse page structures**

### For Users

1. **Understand this is not a legal database**
2. **Do not rely on extracted content for legal decisions**
3. **Verify completeness** before analysis
4. **Report issues** to improve the tool
