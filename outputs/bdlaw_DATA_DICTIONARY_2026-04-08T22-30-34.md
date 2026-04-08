# BDLawCorpus Data Dictionary

## Overview

This document defines all fields in the BDLawCorpus export schema (v2.0).

## Act Export Schema

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `identifiers` | object | Yes | Container for identification fields |
| `act_number` | string | Yes | DEPRECATED: Use `identifiers.internal_id` |
| `title` | string | Yes | Act title in original language (usually Bengali) |
| `content` | string | Yes | Full legal text content, noise-filtered |
| `url` | string | Yes | Source URL for provenance tracking |
| `volume_number` | string | Yes | Volume containing this act |
| `marker_frequency` | object | Yes | Raw string occurrence counts |
| `cross_references` | object | Yes | Detected cross-references to other acts |
| `_metadata` | object | No | Provenance and extraction metadata |

### Identifiers Object

| Field | Type | Description |
|-------|------|-------------|
| `internal_id` | string | bdlaws database ID extracted from URL pattern `/act-details-{ID}.html` |
| `note` | string | Clarification that internal_id is NOT the legal citation number |

### Marker Frequency Object

| Field | Type | Description |
|-------|------|-------------|
| `ধারা` | object | Section marker frequency |
| `ধারা.count` | integer | Raw string occurrence count |
| `ধারা.method` | string | Counting methodology: "raw string frequency, including cross-references" |
| `অধ্যায়` | object | Chapter marker frequency |
| `অধ্যায়.count` | integer | Raw string occurrence count |
| `অধ্যায়.method` | string | Counting methodology: "raw string frequency" |
| `তফসিল` | object | Schedule marker frequency |
| `তফসিল.count` | integer | Raw string occurrence count |
| `তফসিল.method` | string | Counting methodology: "raw string frequency, including schedule references" |

### Cross-References Object

| Field | Type | Description |
|-------|------|-------------|
| `count` | integer | Total number of detected cross-references |
| `method` | string | Detection methodology: "pattern-based detection, not semantically verified" |
| `references` | array | Array of CrossReference objects |

### CrossReference Object

| Field | Type | Description |
|-------|------|-------------|
| `citation_text` | string | Original citation text as found in content |
| `citation_year` | string | Year component extracted from citation (original script) |
| `citation_serial` | string | Serial number (Roman numerals or Arabic numerals) |
| `reference_type` | string | Classification: "amendment", "repeal", "substitution", "dependency", "incorporation", or "mention" |
| `line_number` | integer | 1-indexed line number where citation appears |
| `position` | integer | Character position in full content string |
| `context_before` | string | Up to 50 characters before the citation |
| `context_after` | string | Up to 50 characters after the citation |

### Metadata Object

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Source domain: "bdlaws.minlaw.gov.bd" |
| `source_url` | string | Full source URL |
| `scraped_at` | string | ISO8601 timestamp of page access |
| `extracted_at` | string | ISO8601 timestamp of content processing |
| `scraping_method` | string | Extraction methodology: "manual page-level extraction" |
| `tool` | string | Tool name and version |
| `language` | string | Content language code: "bn" (Bengali) |
| `research_purpose` | string | Intended use: "academic legal corpus construction" |
| `disclaimer` | string | Legal/ethical disclaimer |

## Volume Catalog Schema

| Field | Type | Description |
|-------|------|-------------|
| `volume_number` | string | Volume identifier |
| `source_url` | string | URL of volume catalog page |
| `captured_at` | string | ISO8601 timestamp of capture |
| `total_acts` | integer | Number of acts listed in volume |
| `acts` | array | Array of act summary objects |

### Act Summary Object (in Volume Catalog)

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Act title |
| `year` | string | Act year |
| `act_number` | string | Act number/identifier |
| `url` | string | URL to act details page |

## Corpus Manifest Schema

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version (semantic versioning) |
| `created_at` | string | ISO8601 timestamp of manifest creation |
| `updated_at` | string | ISO8601 timestamp of last update |
| `corpus_stats` | object | Corpus-level statistics |
| `cross_reference_coverage` | object | Cross-reference coverage tracking |
| `acts` | object | Map of internal_id to act metadata |
| `volumes` | object | Map of volume_number to volume metadata |
| `version_history` | object | Archive of previous extractions |

### Corpus Stats Object

| Field | Type | Description |
|-------|------|-------------|
| `total_acts` | integer | Count of acts in corpus |
| `total_volumes` | integer | Count of volumes in corpus |
| `total_characters` | integer | Sum of all act content lengths |
| `extraction_date_range.earliest` | string | Earliest extraction timestamp |
| `extraction_date_range.latest` | string | Latest extraction timestamp |

### Cross-Reference Coverage Object

| Field | Type | Description |
|-------|------|-------------|
| `referenced_acts_in_corpus` | array | IDs of referenced acts that exist in corpus |
| `referenced_acts_missing` | array | IDs of referenced acts not in corpus |
| `coverage_percentage` | integer | Percentage of referenced acts in corpus |

## Reference Type Classifications

| Type | Bengali Keywords | English Keywords | Description |
|------|------------------|------------------|-------------|
| `amendment` | সংশোধন, সংশোধিত | amendment, amended, amending | Act modifies another act |
| `repeal` | রহিত, রহিতকরণ, বিলুপ্ত | repeal, repealed, repealing | Act abolishes another act |
| `substitution` | প্রতিস্থাপিত, প্রতিস্থাপন | substituted, substitution, replaced | Act replaces provisions |
| `dependency` | সাপেক্ষে, অধীন, অনুসারে | subject to, under, pursuant to | Act depends on another |
| `incorporation` | সন্নিবেশিত, অন্তর্ভুক্ত | inserted, incorporated, added | Act incorporates provisions |
| `mention` | (none) | (none) | General reference without classification |

## Citation Patterns Detected

### English Patterns
- `Act [Roman/Arabic] of [Year]` - e.g., "Act XV of 1963"
- `Ordinance [Roman/Arabic] of [Year]` - e.g., "Ordinance XXXVI of 1984"
- `[Name] Act, [Year] ([Roman/Arabic] of [Year])` - e.g., "Income Tax Ordinance, 1984 (XXXVI of 1984)"
- `P.O. No. [Number] of [Year]` - President's Orders

### Bengali Patterns
- `[Year] সনের [Number] নং আইন` - e.g., "১৯৯০ সনের ২০ নং আইন"
- `[Year] সনের [Number] নং অধ্যাদেশ` - e.g., "১৯৮৪ সনের ৩৬ নং অধ্যাদেশ"
- `[Name] আইন, [Year] ([Year] সনের [Number] নং আইন)` - Full Bengali citation

## Notes

1. **Internal ID vs Legal Citation**: The `internal_id` is the bdlaws database identifier, NOT the legal citation number. Legal citation parsing requires Phase 2 work.

2. **Marker Frequency vs Section Count**: The `marker_frequency` counts are raw string occurrences, not structural section counts. A "ধারা" count of 50 does not mean 50 sections.

3. **Cross-Reference Limitations**: Cross-references are pattern-detected, not semantically verified. False positives may occur.

4. **Content Preservation**: The `content` field preserves original text exactly as found, including any OCR errors or encoding issues in the source.
