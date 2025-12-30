---
inclusion: always
---

# Legal Integrity Rules for BDLawCorpus

You are operating on an **archival HTML snapshot** captured from bdlaws.minlaw.gov.bd.

## WHAT THIS IS

- An archival snapshot of **browser-rendered DOM text** from bdlaws.minlaw.gov.bd
- Captured **as rendered in a browser** at extraction time
- Intended for **academic analysis, digital humanities, and exploratory ML**

## WHAT THIS IS NOT

- ❌ NOT a legal database
- ❌ NOT an authoritative source of law
- ❌ NOT a Gazette reconstruction
- ❌ NOT legally validated
- ❌ NOT continuously updated

## CRITICAL TECHNICAL FACTS

### What content_raw Actually Is

`content_raw` represents **browser-parsed DOM text nodes** obtained via `element.textContent`.

It is:
- DOM-parsed text (not HTTP response bytes)
- Browser-rendered (JavaScript may have modified DOM before capture)
- `textContent`-extracted (whitespace handling differs from raw HTML)

It is NOT:
- Raw HTML source code
- HTTP response bytes
- Byte-identical to server response

### DOM Extraction Method

- **ONLY** `element.textContent` is permitted
- `innerText` is **STRICTLY FORBIDDEN** (layout-dependent, non-deterministic)
- If DOM does not expose textContent, content is considered unavailable

## ABSOLUTE CONSTRAINTS (NON-NEGOTIABLE)

1. NEVER modify `content_raw` after initial extraction
2. NEVER infer legal meaning, intent, effect, scope, or applicability
3. NEVER resolve amendment chains
4. NEVER decide which act is "stronger", "later", or "overrides" another
5. NEVER normalize numbers, dates, or currencies
6. NEVER rewrite definitions, provisos, explanations, or schedules
7. NEVER assume completeness of the source website
8. NEVER treat absence of text as legal absence
9. NEVER convert pattern detection into legal interpretation

If ANY of the above would be required to answer a task, STOP and ASK.

## CONTENT MODEL

Every act contains THREE parallel content layers:

- **content_raw**: Browser-parsed DOM text via textContent, may contain encoding artifacts, anchor for hashes/offsets/citations
- **content_normalized**: Unicode NFC normalization ONLY, no wording changes
- **content_corrected**: Encoding-level fixes ONLY (HTML rendering artifacts), NEVER spelling/grammar/wording

If you detect a change that may alter meaning: FLAG IT, DO NOT APPLY IT.

## REFERENCE HANDLING (STRING MATCHING ONLY)

You may DETECT string patterns. You may NOT INTERPRET legal relationships.

All detected references are: **string-level citation mentions**, pattern-based, legally non-binding.

Required metadata:
- `reference_semantics: "string_match_only"`
- `reference_warning: "Keywords detected in proximity to citation strings. No legal relationship, effect, direction, or applicability is implied."`

Prohibited:
- Amendment chains
- Dependency graphs
- Resolution logic
- Cross-act reasoning

## NEGATION HANDLING (CLASSIFICATION SUPPRESSION ONLY)

Negation detection exists **ONLY** to prevent false positive classifications.

If negation words (না, নয়, নহে, নাই, নেই, ব্যতীত, ছাড়া) appear within ±20 characters:
- FORCE relation type to "mention"
- OVERRIDE all other keywords

This is classification suppression, NOT legal interpretation.

Required metadata:
- `negation_handling: "classification_suppression_only"`

## NUMERIC INTEGRITY (BEST EFFORT, HTML ONLY)

Numeric expressions are captured as-is from HTML. No guarantees of:
- Correctness
- Completeness
- Legal accuracy

Required metadata:
- `numeric_integrity: "best_effort_html_only"`
- `numeric_warning: "Numeric expressions may be incomplete or malformed due to HTML source limitations"`

## ML USAGE (WARNING ONLY, NO GUARANTEES)

There is NO `safe_for_ml_training` guarantee. Replace with explicit warning:

`ml_usage_warning: "HTML artifacts, encoding noise, and structural gaps are present; suitable only for exploratory retrieval and analysis. Not validated for training or evaluation."`

Use `ml_risk_factors` array to list detected issues, not a binary "safe" flag.

## ENCODING POLICY

Encoding fixes are framed as **HTML rendering artifacts**, not errors.

- `encoding_policy: "preserve_html_artifacts"`
- `encoding_scope: "non-semantic, display-only"`

Never export corrected text without raw text alongside it.

## TEMPORAL & STATUS RULES

- Every act is `temporal_status = "historical_text"`
- Extract dates ONLY if explicitly written
- Do NOT infer "current law"
- Repealed acts MUST remain
- Unknown status MUST remain unknown

## TRUST BOUNDARY (MANDATORY IN EVERY EXPORT)

```json
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
```

## WHEN YOU MUST STOP AND ASK

Before proceeding, you MUST ask clarification if ANY of these arise:
1. Conflicting text across sources
2. Ambiguous numeric interpretation
3. Missing but referenced schedules
4. Mixed language with unclear boundaries
5. OCR errors inside protected sections
6. Acts with multiple titles or years
7. Pagination or hidden DOM detection
8. Partial extraction due to external links

Ask explicitly. Do NOT guess. Do NOT proceed silently.

## SINGLE-SENTENCE DEFENSE

If challenged, the defense is:

> "BDLawCorpus is a browser-based archival snapshot of DOM-exposed text as rendered at extraction time. It explicitly disclaims legal correctness, Gazette equivalence, numerical accuracy, and future validity."
