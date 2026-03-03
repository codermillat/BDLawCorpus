# BDLawCorpus — Product Context

## Why This Project Exists
Bangladesh has no publicly accessible, machine-readable corpus of its laws. The official website (`bdlaws.minlaw.gov.bd`) contains all Acts and Ordinances going back to 1799, but only as HTML pages. Researchers studying Bengali legal language, building legal AI systems, or doing comparative legal informatics need a structured, citable dataset. BDLawCorpus fills that gap.

## The Problem It Solves
1. **No digital corpus** of Bangladeshi laws exists for NLP/ML research
2. **Manual copying** is error-prone and produces no provenance record
3. **Bengali legal text** is severely underrepresented in AI training data
4. **Research reproducibility** requires knowing exactly what was captured, when, and how

## How It Works

### Extraction Workflow
```
User navigates to bdlaws page
        ↓
content.js detects page type (volume / act-details)
        ↓
User initiates extraction via side panel
        ↓
bdlaw-extractor.js extracts element.textContent
        ↓
Three content layers produced:
  • content_raw       → immutable, SHA-256 hashed
  • content_normalized → Unicode NFC only
  • content_corrected  → encoding artifact fixes
        ↓
bdlaw-storage.js persists to IndexedDB
  (fallback → chrome.storage.local → memory)
        ↓
Extraction receipt issued (append-only proof)
        ↓
Export as JSON with full provenance schema v3.1
```

### Page Types the Extension Handles
| URL Pattern | Page Type | What Extension Does |
|---|---|---|
| `/laws-of-bangladesh.html` | Root Index | Reads 57 volume links |
| `/volume-{N}.html` | Volume | Reads act catalog table |
| `/act-{ID}.html` | Act Summary | Reads TOC + metadata |
| `/act-details-{ID}.html` | Act Details | **Extracts full legal text** |

### Three Content Layers (Immutability Contract)
| Layer | Description | Modifications Allowed |
|---|---|---|
| `content_raw` | Browser-parsed DOM text via textContent | **None** — immutable anchor |
| `content_normalized` | Unicode NFC normalization only | NFC only |
| `content_corrected` | Encoding-level fixes for HTML artifacts | Non-semantic fixes only |

## User Experience Goals
1. Researcher navigates the website normally
2. Side panel shows current page type and available actions
3. One click adds all acts from a volume to the extraction queue
4. Queue processes automatically with configurable delays
5. Progress shown in real-time (extracted / total / failed)
6. After batch: export corpus as JSON with full metadata
7. After batch: retry any transiently-failed acts with one click
8. Final export includes both successful and failed acts with honest reporting

## Known Extraction Challenges
1. **Footnote superscripts** (`¹²³`) leak into `textContent` as stray numbers — amendment annotations embedded in headings
2. **`[***]` markers** = content removed by amendment — genuinely missing, not an extraction bug
3. **Schedule PDFs** — linked as `/upload/act/{ID}___Schedule.pdf` — not extractable (PDF only)
4. **Mixed language** — some Bengali-volume acts have English section text
5. **Bengali numerals** in act numbers (০১২৩৪৫৬৭৮৯) — require special regex handling
6. **Site downtime** — server goes down mid-batch, causing transient failures that should be retried

## Trust Boundary
**CAN trust:** Text appeared on bdlaws HTML pages at extraction time; no semantic rewriting applied; all transformations logged.

**MUST NOT trust:** Legal validity; Gazette equivalence; completeness; numerical accuracy; amendment correctness.