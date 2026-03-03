# Peer Review Preparation Guide

## BDLawCorpus — Anticipating Reviewer Questions & Eliminating Research Risks

---

## Overview

This document prepares researchers using BDLawCorpus for peer review scrutiny. It is structured as:
1. **How expert corpus researchers work** — standards your project is measured against
2. **Anticipated peer reviewer questions** — with ready answers grounded in the codebase
3. **Risk register** — known threats and mitigations
4. **What still needs strengthening** — honest gap analysis

---

## Part 1: How Expert Corpus Researchers Work

Expert corpus linguists and digital humanities researchers follow a set of practices that peer reviewers will check against. BDLawCorpus maps to each of these:

### 1.1 Provenance Documentation
> *"Every datum must trace back to its source without ambiguity."*

**What experts do:** Document exact source URL, access date, access method, and tool version for every item in the corpus.

**What BDLawCorpus does:**
- Every export includes `source_url`, `extracted_at` (ISO 8601), `extraction_method: "manual page-level extraction"`, `tool_name`, `tool_version`
- `content_raw` SHA-256 hash anchors the original text immutably
- `CITATION.cff` provides machine-readable citation metadata

**Reviewer will ask:** *"How can I verify you captured what was actually on the site?"*
**Answer:** *"Each act record includes a SHA-256 hash of the verbatim DOM text (`content_raw`). The source URL and timestamp allow independent re-extraction for verification. The transformation audit log records every post-extraction change."*

---

### 1.2 Reproducibility
> *"Another researcher must be able to reconstruct your corpus."*

**What experts do:** Publish their collection tool, methodology, and parameters. The corpus should be re-creatable from documented steps.

**What BDLawCorpus does:**
- Source code is MIT-licensed and public on GitHub
- `docs/METHODOLOGY.md` documents the exact pipeline (DOM selection → `textContent` → NFC → encoding repair → quality assessment → metadata)
- Deterministic: `element.textContent` produces identical output for identical DOM state
- `innerText` is explicitly forbidden (layout-dependent, non-deterministic)
- Hardcoded selectors prevent variable user-defined extraction paths

**Reviewer will ask:** *"Can someone else reproduce your dataset?"*
**Answer:** *"Yes. The tool is open-source, the methodology is documented in `docs/METHODOLOGY.md`, the source website is publicly accessible, and each record contains enough provenance metadata to verify or re-extract any item."*

---

### 1.3 Explicit Scope Declaration
> *"Researchers must define what is in and what is out — and why."*

**What experts do:** Define inclusion/exclusion criteria, explain gaps, and acknowledge what the corpus does NOT represent.

**What BDLawCorpus does:**
- Scope: bdlaws.minlaw.gov.bd only — official government source
- ~1,500 acts across 57 volumes (1799–2026)
- Explicit exclusions: PDF schedules (not extractable via DOM), external references, dynamic-loading content
- `docs/LIMITATIONS.md` is a comprehensive limitations catalog

**Reviewer will ask:** *"Is this corpus complete? What did you miss?"*
**Answer:** *"No. The corpus is explicitly an archival snapshot, not a complete legal database. Known gaps are documented in `docs/LIMITATIONS.md` and include: PDF-linked schedules, dynamically loaded content, acts with missing preambles, and potential OCR errors inherited from the source digitization."*

---

### 1.4 Transformation Transparency
> *"Any change to the original must be logged and justified."*

**What experts do:** Distinguish raw data from processed data. Every transformation is documented with its rationale.

**What BDLawCorpus does (three-version model):**

| Version | Description | Mutability |
|---|---|---|
| `content_raw` | Verbatim `textContent` from DOM | **Immutable** — SHA-256 anchored |
| `content_normalized` | NFC Unicode normalization applied | Logged |
| `content_corrected` | HTML entity artifacts repaired | Logged, risk-classified |

- `potential_semantic` transformations are **flagged but never applied automatically**
- All transformations recorded in `transformation_audit` array per export
- `content_raw` immutability enforced in code via hash verification

**Reviewer will ask:** *"Did you modify the original text?"*
**Answer:** *"The original DOM text is preserved verbatim in `content_raw` and is SHA-256 anchored. Downstream versions apply only Unicode normalization (NFC) and non-semantic encoding repairs. Any transformation with potential semantic impact is flagged for researcher review, not applied automatically."*

---

### 1.5 Limitation Acknowledgment
> *"Claiming more than your data supports is a research integrity failure."*

**What experts do:** Publish explicit limitations sections in both the tool/dataset documentation and the research paper.

**What BDLawCorpus does:**
- `docs/LIMITATIONS.md` — 6 categories: DOM/technical, selector, content detection, legal, temporal, epistemic
- `docs/ETHICS.md` — 6 explicit "What This Tool Does NOT Do" claims
- `CITATION.cff` abstract includes: *"Not a legal database. Not Gazette equivalent. Not validated for legal use or ML training."*
- Every export JSON includes disclaimer fields

---

### 1.6 Ethics and Data Rights
> *"Data collection must be ethical, legal, and respectful of source terms."*

**What experts do:** Document why the data can be collected, confirm no terms of service are violated, confirm no personal data is involved.

**What BDLawCorpus does:**
- Source: Official government website, publicly accessible, no authentication
- Content: Government legislation (public domain in Bangladesh)
- No personal data collected or processed
- No automated crawling — manual, user-initiated only
- Ethical framework documented in `docs/ETHICS.md` and `Research.md`

---

## Part 2: Anticipated Peer Reviewer Questions & Ready Answers

### Category A — Data Quality

**Q1: "How do you ensure the extracted text matches the official source?"**
> SHA-256 hash of `content_raw` allows byte-for-byte verification against a fresh extraction. The source URL and timestamp are preserved. Reviewers can re-extract any act and compare hashes.

**Q2: "Your source uses HTTP, not HTTPS. How do you address transport integrity?"**
> This is a limitation of the source website (`bdlaws.minlaw.gov.bd` does not offer HTTPS and has no `robots.txt`). It is documented in `docs/LIMITATIONS.md`. The SHA-256 content hash in `content_raw` provides post-hoc integrity verification independent of transport security. For archival purposes, submitting extracted URLs to web.archive.org is recommended to create a third-party verifiable snapshot. Researchers should note the HTTP limitation in publications.

**Q3: "How do you handle OCR errors in the source?"**
> OCR artifacts are detected (not corrected) using pattern matching in `bdlaw-quality.js`. Detected artifacts are flagged in the quality assessment report. The policy is non-correction: `content_raw` inherits the source error, which is the correct archival behavior. Researchers must acknowledge this noise in their analysis.

**Q4: "Is the Bengali text correct Unicode?"**
> Unicode NFC normalization is applied in `content_normalized`. Encoding errors are detected via `bdlaw-quality.js`. Non-semantic repairs (e.g., HTML entity artifacts) are applied in `content_corrected`. No transliteration or character substitution is performed.

---

### Category B — Methodology

**Q5: "Why DOM `textContent` and not raw HTML?"**
> `element.textContent` returns all text nodes without CSS or layout dependency, producing deterministic output for a given DOM state. Raw HTML would require a separate HTML parser, introduce dependency on markup structure that the source site may change, and make reproducibility harder. The methodology is documented in `docs/METHODOLOGY.md`.

**Q6: "Why Chrome only? Does this introduce browser bias?"**
> Chrome's rendering engine (Blink) is used by ~65% of global web traffic. The limitation is acknowledged in `docs/LIMITATIONS.md`. For reproducibility, the Chrome version should be documented by researchers. The tool's reliance on a specific browser is a known constraint, not a hidden assumption.

**Q7: "Your selectors are hardcoded. What if the site changes?"**
> Hardcoded selectors are a deliberate design choice to prevent variable extraction paths between researchers. If the site redesigns, the selectors will fail visibly (empty extraction) rather than silently capturing wrong content. This failure mode is preferable for research integrity. The limitation is documented.

**Q8: "How do you ensure manual extraction doesn't introduce operator bias?"**
> The extension enforces a single workflow: user navigates to a page, initiates extraction, the tool captures exactly what the DOM contains. There are no operator-configurable parameters that affect content. The only operator variable is which URLs are visited and in what order — both are recorded in metadata.

---

### Category C — Scope and Completeness

**Q9: "Is this the complete body of Bangladesh law?"**
> No, and this is explicitly stated. The corpus is an archival snapshot of what is available at bdlaws.minlaw.gov.bd at extraction time. Known gaps: PDF-linked schedules, acts not yet digitized, content loaded dynamically after extraction window. All acts are marked `historical_text` — no currency claims are made.

**Q10: "Why are some acts missing schedules?"**
> Many acts on bdlaws.minlaw.gov.bd reference schedules but link to separate PDF files, which cannot be accessed via DOM text extraction. Missing schedules are flagged in the quality assessment output (`missing_schedule: true`). This is an inherent limitation of the source website's structure.

**Q11: "Can this corpus be used as a training set for legal AI?"**
> Not without additional validation. The corpus is explicitly disclaimed in `CITATION.cff` as "not validated for ML training." Known issues include OCR errors, structural gaps, encoding artifacts, and no legal validity guarantees. Exploratory NLP use (retrieval, extractive QA) is appropriate with risk acknowledgment. Production legal AI training is not recommended without human validation.

---

### Category D — Ethics

**Q12: "Do you have permission to scrape this website?"**
> The source (`bdlaws.minlaw.gov.bd`) is an official government website publishing public legislation. No authentication is required, no terms of service prohibit access, and the content (government legislation) is in the public domain. The tool does not circumvent any access controls. Additionally, the site has no `robots.txt` file (returns HTTP 404), meaning no crawling restrictions are declared. Every extraction record includes `robots_txt_status: "not_present"` as documented evidence. The ethical framework is documented in `docs/ETHICS.md`.

**Q13: "Does your tool automate access in a way that could harm the source server?"**
> No. All extraction requires direct user action on an already-open browser page. There is no background crawling, no automated navigation, and a configurable delay (minimum 1 second) is enforced between extractions. This is documented in `Research.md` under "Automation and Manipulation Policy."

**Q14: "Does this involve personal data?"**
> No. The corpus consists exclusively of government-published legislation. No personal data, user behavior data, or private information is collected or processed.

---

### Category E — Reproducibility

**Q15: "How do I cite this tool in my paper?"**
> Use the `CITATION.cff` file at the repository root. The preferred citation format is:
> ```
> BDLawCorpus Contributors. (2026). BDLawCorpus: Browser-Based Archival Snapshot
> Tool for Bangladeshi Legal Texts (v1.3.0). https://github.com/codermillat/BDLawCorpus
> ```

**Q16: "How do I report what version of the tool I used?"**
> The tool version is embedded in every export's `_metadata.tool_version` field. The repository uses semantic versioning. Document the version in your Methods section.

**Q17: "What parameters should I report in my paper's Methods section?"**
Minimum required:
- Tool: BDLawCorpus vX.X.X
- Source: bdlaws.minlaw.gov.bd (accessed [date range])
- Extraction method: Browser DOM `textContent`, Chrome vXX
- Content version used: `content_raw` | `content_normalized` | `content_corrected`
- Extraction delay: [configured delay in ms]
- Known limitations: Acknowledge OCR errors, missing schedules, point-in-time snapshot

---

## Part 3: Risk Register

| Risk | Likelihood | Impact | Current Mitigation | Gap |
|---|---|---|---|---|
| Source site changes structure → selector failure | High | High | Failure detected visibly (empty extraction) | No automated selector update |
| Source site goes offline → unverifiable | Medium | High | SHA-256 hash + Wayback Machine recommendation | No archive.org integration |
| Browser version affects rendering | Low | Medium | Chrome version documented in metadata | Not currently captured in metadata |
| OCR errors in source propagate | High | Medium | Detected and flagged; not corrected | Errors persist in corpus |
| Missing schedules in PDF format | High | Medium | Flagged as `missing_schedule: true` | No PDF extraction |
| Reviewer disputes data currency | High | Low | All acts marked `historical_text` | Need explicit extraction date range in dataset release |
| Corpus used for legal decisions | Low | Critical | Multi-layer disclaimers in code + docs + exports | Cannot prevent misuse |
| Bengali Unicode bugs affect language detection | High | Medium | BUGs 1/2/3 identified | **Still open — not yet fixed** |
| Hindi/English misclassification | Medium | Medium | Language detection uses Unicode range matching | Depends on Bengali Unicode fix |
| Storage quota overflow on chrome.storage | Medium | High | `unlimitedStorage` permission added (v1.3.0) | IndexedDB is primary; should be fine |

---

## Part 4: What Still Needs Strengthening

### Critical for Publication

1. **Bengali Unicode bugs (BUGs 1, 2, 3)** — Language detection is currently broken. If your paper makes any claims about Bengali text identification, language distribution, or bilingual analysis, these bugs must be fixed before data collection. The regex patterns for U+0980–U+09FF need correct codepoints inserted.

2. **Chrome version in metadata** — Currently not captured. Add `navigator.userAgent` or `chrome.runtime.getManifest()` browser info to `_metadata`. This is needed for reproducibility.

3. **Extraction date range in dataset release** — The `CITATION.cff` lacks a `date-collected` field. For corpus citation standards (CLARIN, Zenodo), the collection date range is required metadata.

### Recommended for Robustness

4. **Wayback Machine archiving** — For each extracted act, submit the URL to `https://web.archive.org/save/` to create a verifiable third-party snapshot. This gives reviewers an independent way to verify content at a known point in time.

5. **Inter-rater reliability test** — Have two operators independently extract a sample of 20 acts and compare `content_raw` SHA-256 hashes. Identical hashes confirm the extraction is operator-independent. Report this in your paper.

6. **Dataset card** — Following Hugging Face and ACL standards, produce a `DATASET_CARD.md` with: dataset size, languages, domains, known biases, limitations, and intended use. This is now standard for NLP dataset papers.

7. **robots.txt compliance** — ✅ **Confirmed:** `bdlaws.minlaw.gov.bd/robots.txt` returns HTTP 404 (no `robots.txt` file exists). The site declares no crawling restrictions. This is a positive finding — document it in your paper. The field `robots_txt_status: "not_present"` is now included in every extraction's `_metadata` object as of v1.3.0.

---

## Part 5: Template — Methods Section for Academic Paper

> BDLawCorpus v1.3.0 \[CITE\] was used to extract legal text from bdlaws.minlaw.gov.bd, the official Bangladesh Laws portal maintained by the Ministry of Law and Justice. All extractions were performed manually on a per-page basis using Chrome [version] during [date range]. Text was captured via the browser DOM `element.textContent` property, which produces deterministic output independent of visual rendering. Each extracted record includes a verbatim `content_raw` field anchored by SHA-256 hash for integrity verification, along with Unicode-normalized (`content_normalized`) and encoding-corrected (`content_corrected`) variants. All transformations are logged in a per-record audit trail. The corpus consists of [N] acts spanning [year range]. Known limitations include: point-in-time extraction (source content may have changed since collection), missing PDF-linked schedules, potential OCR artifacts inherited from source digitization, and no guarantee of completeness or legal currency. This corpus is not a legal database and should not be used for legal determinations. Full methodology documentation and limitations are available at \[repository URL\].

---

## References

- `docs/METHODOLOGY.md` — Extraction pipeline documentation
- `docs/ETHICS.md` — Ethical framework and non-misuse guarantees
- `docs/LIMITATIONS.md` — Comprehensive limitations catalog
- `Research.md` — Research purpose and ethical principles
- `CITATION.cff` — Machine-readable citation metadata
- Chrome Extension documentation: [developer.chrome.com/docs/extensions](https://developer.chrome.com/docs/extensions)
- CLARIN corpus documentation standards: [clarin.eu](https://www.clarin.eu)
- Bender et al. (2021) "On the Dangers of Stochastic Parrots" — dataset documentation standards reference