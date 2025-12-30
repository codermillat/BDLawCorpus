# Requirements Document: Legal Integrity Enhancement

## Introduction

This feature enhances the BDLawCorpus extension to meet research-grade legal corpus standards. It implements the three-version content model, numeric region protection, negation-aware reference classification, and comprehensive audit trails. The goal is a forensically safe, peer-review defensible corpus that never alters legal meaning.

## Glossary

- **Content_Raw**: Exact extracted text including any encoding corruption, never modified
- **Content_Normalized**: Unicode NFC-normalized text, semantically untouched
- **Content_Corrected**: Encoding-level fixes only, no wording changes
- **Numeric_Region**: Text containing currency, percentages, rates, tables, or schedules
- **Negation_Context**: Bengali negation words (না, নয়, নহে) within ±20 characters of a reference
- **Lexical_Relation**: Pattern-detected text mention with no legal force implied
- **Risk_Level**: Classification of transformation safety (non-semantic vs potential-semantic)
- **Transformation_Log**: Audit record of every change with position and risk level
- **Legal_Status**: Whether an act is active, repealed, or unknown
- **Temporal_Status**: Always "historical_text" - no inference of current applicability

## Requirements

### Requirement 1: Three-Version Content Model

**User Story:** As a legal researcher, I want three parallel content versions stored for every act, so that I can audit transformations and verify original text integrity.

#### Acceptance Criteria

1. WHEN extracting act content, THE System SHALL store `content_raw` as the exact extracted text including any encoding corruption
2. THE System SHALL NEVER modify `content_raw` after initial extraction
3. WHEN processing content, THE System SHALL create `content_normalized` using Unicode NFC normalization only
4. WHEN applying encoding fixes, THE System SHALL store results in `content_corrected` only
5. THE System SHALL compute content_hash using `content_raw` exclusively
6. THE System SHALL anchor all citation positions to `content_raw` character offsets

### Requirement 2: Transformation Audit Logging

**User Story:** As a corpus auditor, I want every transformation logged with position and risk level, so that I can verify no semantic changes occurred.

#### Acceptance Criteria

1. FOR EACH transformation applied, THE System SHALL record: transformation_type, original, corrected, position, risk_level
2. THE System SHALL classify risk_level as "non-semantic" for encoding fixes (mojibake, HTML entities, broken Unicode)
3. THE System SHALL classify risk_level as "potential-semantic" for OCR corrections that change words
4. IF risk_level equals "potential-semantic", THE System SHALL apply flag-only mode (detect but not correct)
5. THE System SHALL include transformation_log array in every exported act

### Requirement 3: Numeric Region Protection

**User Story:** As a legal researcher, I want numeric-sensitive regions protected from any modification, so that legal values remain accurate.

#### Acceptance Criteria

1. WHEN processing content, THE System SHALL detect regions containing currency symbols (৳, $, Tk, টাকা)
2. WHEN processing content, THE System SHALL detect regions containing percentages (%, শতাংশ)
3. WHEN processing content, THE System SHALL detect regions containing rate patterns (per annum, হার)
4. WHEN processing content, THE System SHALL detect table structures and schedule content
5. FOR ANY detected numeric region, THE System SHALL set `numeric_integrity_sensitive: true`
6. THE System SHALL NOT apply OCR correction, encoding repair, or formatting to numeric regions
7. THE System SHALL only apply Unicode normalization to numeric regions

### Requirement 4: Negation-Aware Reference Classification

**User Story:** As a legal researcher, I want references near negation words flagged appropriately, so that I don't misinterpret negative statements as positive relationships.

#### Acceptance Criteria

1. WHEN classifying a reference, THE System SHALL check for Bengali negation words (না, নয়, নহে) within ±20 characters
2. IF negation is present, THE System SHALL set `negation_present: true`
3. IF negation is present, THE System SHALL override lexical_relation_type to "mention" regardless of other keywords
4. THE System SHALL NEVER classify as amendment/repeal/substitution when negation is present
5. THE System SHALL record negation_context showing the detected negation word and position

### Requirement 5: Lexical Relation Type Rename

**User Story:** As a corpus builder, I want reference types renamed to lexical relations, so that no legal force is implied by the classification.

#### Acceptance Criteria

1. THE System SHALL rename field `reference_type` to `lexical_relation_type` in all exports
2. THE System SHALL include disclaimer: "Detected via pattern matching. No legal force or applicability implied."
3. THE System SHALL NOT infer amendment direction, effect, or scope
4. THE System SHALL NOT resolve references to internal_ids or construct amendment chains
5. THE System SHALL set `relationship_inference: "explicitly_prohibited"` in export metadata

### Requirement 6: Legal Status Tracking

**User Story:** As a legal researcher, I want each act's legal status recorded, so that I can distinguish active from repealed laws.

#### Acceptance Criteria

1. WHEN extracting an act, THE System SHALL detect if the act is marked as repealed on the source page
2. THE System SHALL record `legal_status` as one of: "active", "repealed", "unknown"
3. IF status cannot be determined, THE System SHALL set legal_status to "unknown"
4. THE System SHALL NEVER remove repealed acts from the corpus
5. THE System SHALL include legal_status in every exported act

### Requirement 7: Temporal Status Marking

**User Story:** As a legal researcher, I want all acts marked as historical text, so that no inference of current applicability is made.

#### Acceptance Criteria

1. THE System SHALL set `temporal_status: "historical_text"` for every exported act
2. THE System SHALL extract only explicitly written dates (enactment, effective, referenced years)
3. THE System SHALL NEVER infer "current law" or "currently applicable"
4. THE System SHALL include temporal_disclaimer: "No inference of current legal force or applicability"

### Requirement 8: Schedule Raw HTML Preservation

**User Story:** As a legal researcher, I want schedules preserved as raw HTML, so that table structure and numeric values remain intact.

#### Acceptance Criteria

1. WHEN a schedule contains table HTML, THE System SHALL preserve the raw HTML verbatim
2. THE System SHALL set `schedules.representation: "raw_html"`
3. THE System SHALL set `schedules.extraction_method: "verbatim_dom_capture"`
4. THE System SHALL set `schedules.processed: false`
5. THE System SHALL NOT flatten, clean, or transform schedule HTML
6. IF schedule HTML is missing, THE System SHALL flag as missing without inferring content

### Requirement 9: Enhanced Data Quality Object

**User Story:** As a downstream consumer, I want comprehensive data quality flags, so that I can determine if an act is safe for ML training.

#### Acceptance Criteria

1. THE System SHALL include `data_quality.flags` array with all detected issues
2. THE System SHALL include `data_quality.risks` array with potential integrity concerns
3. THE System SHALL include `data_quality.known_limitations` array with documented gaps
4. THE System SHALL include `data_quality.safe_for_ml_training` boolean
5. THE System SHALL set safe_for_ml_training to false if: numeric corruption risk, encoding ambiguity, missing schedules, or heavy OCR correction
6. THE System SHALL set `intended_ml_use: ["retrieval", "extractive_question_answering"]`

### Requirement 10: Completeness Semantics Update

**User Story:** As a legal researcher, I want completeness to reflect textual representation, not legal completeness, so that I don't make false claims.

#### Acceptance Criteria

1. THE System SHALL rename completeness value "partial" to "textual_partial"
2. THE System SHALL include completeness_disclaimer: "Website representation incomplete; legal completeness unknown"
3. THE System SHALL NOT claim an act is legally incomplete based on missing schedules
4. THE System SHALL distinguish between textual completeness and legal completeness

### Requirement 11: Source Authority Declaration

**User Story:** As a corpus builder, I want source authority explicitly declared, so that provenance is unambiguous.

#### Acceptance Criteria

1. THE System SHALL set `source_authority: "bdlaws_html_only"` in all exports
2. THE System SHALL set `authority_rank: ["bdlaws_html"]` in corpus metadata
3. THE System SHALL NOT use Gazette PDFs to override or correct HTML text
4. THE System SHALL document that Gazette comparison is out of scope for this corpus

### Requirement 12: Formatting Scope Declaration

**User Story:** As a legal researcher, I want formatting marked as presentation-only, so that it's not used for legal analysis.

#### Acceptance Criteria

1. THE System SHALL set `formatting_scope: "presentation_only"` when formatting is applied
2. THE System SHALL NOT apply formatting to provisos, definitions, or explanations
3. THE System SHALL NOT use formatted content for hashing, offsets, or citation anchoring
4. THE System SHALL always use content_raw for position calculations

### Requirement 13: Extraction Risk Detection

**User Story:** As a corpus auditor, I want extraction risks flagged, so that I know if content may be truncated or incomplete due to source limitations.

#### Acceptance Criteria

1. WHEN extracting content, THE System SHALL detect possible pagination or hidden DOM elements
2. WHEN extracting content, THE System SHALL detect if schedules are behind separate links
3. THE System SHALL record `extraction_risk.possible_truncation` as true or false
4. THE System SHALL record `extraction_risk.reason` as one of: "pagination", "hidden_dom", "lazy_load", "external_link", "none"
5. IF truncation risk is detected, THE System SHALL NOT mark the act as complete
6. THE System SHALL include extraction_risk in every exported act

### Requirement 14: Numeric Representation Recording

**User Story:** As a legal researcher, I want numeric representation types recorded, so that I can handle mixed Bengali-English numerals appropriately.

#### Acceptance Criteria

1. WHEN processing content, THE System SHALL detect Bengali digits (০-৯)
2. WHEN processing content, THE System SHALL detect English digits (0-9)
3. THE System SHALL record `numeric_representation` as array containing: "bn_digits", "en_digits", or both if mixed
4. THE System SHALL NOT attempt to convert or normalize digit representations
5. THE System SHALL flag mixed representation for downstream awareness

### Requirement 15: Editorial Content Detection

**User Story:** As a legal researcher, I want editorial content (marginal notes, footnotes, annotations) flagged but preserved, so that I can distinguish law text from editorial additions.

#### Acceptance Criteria

1. WHEN extracting content, THE System SHALL detect marginal notes patterns
2. WHEN extracting content, THE System SHALL detect footnote patterns
3. WHEN extracting content, THE System SHALL detect editor annotation patterns
4. THE System SHALL record `editorial_content_present` as true or false
5. THE System SHALL NEVER remove or modify editorial content
6. THE System SHALL preserve editorial content in content_raw exactly as extracted

### Requirement 16: Lexical Relation Confidence

**User Story:** As a legal researcher, I want confidence levels on lexical relations, so that I can filter by pattern clarity without inferring meaning.

#### Acceptance Criteria

1. FOR EACH detected lexical relation, THE System SHALL assign `lexical_relation_confidence` as "high", "medium", or "low"
2. THE System SHALL assign "high" confidence when full citation pattern matches (e.g., "Act XV of 1984")
3. THE System SHALL assign "medium" confidence when partial pattern matches (e.g., year only)
4. THE System SHALL assign "low" confidence when pattern is ambiguous or context unclear
5. THE System SHALL base confidence purely on pattern clarity, not semantic interpretation

### Requirement 17: Protected Section Detection

**User Story:** As a corpus builder, I want definition, proviso, and explanation sections protected from OCR correction, so that critical legal language is never altered.

#### Acceptance Criteria

1. WHEN processing content, THE System SHALL detect definition sections (সংজ্ঞা, "definition", "means")
2. WHEN processing content, THE System SHALL detect proviso sections (তবে শর্ত, "Provided that", "proviso")
3. WHEN processing content, THE System SHALL detect explanation sections (ব্যাখ্যা, "Explanation")
4. THE System SHALL record `protected_sections` array listing detected section types
5. THE System SHALL NOT apply OCR correction within protected sections
6. THE System SHALL only apply Unicode normalization within protected sections
7. IF OCR artifact is detected in protected section, THE System SHALL flag but NOT correct

### Requirement 18: Title Preservation

**User Story:** As a legal researcher, I want act titles preserved in both raw and normalized forms, so that I can track title variations without losing original text.

#### Acceptance Criteria

1. WHEN extracting an act, THE System SHALL store `title_raw` as the exact extracted title
2. WHEN extracting an act, THE System SHALL store `title_normalized` with Unicode NFC normalization only
3. THE System SHALL NEVER "correct" titles for spelling, spacing, or formatting
4. THE System SHALL preserve year format variations (১৯৯১ vs 1991) as extracted
5. THE System SHALL use title_raw for display and title_normalized for deduplication matching

### Requirement 19: Language Distribution Recording

**User Story:** As a legal researcher, I want language distribution recorded, so that I can identify acts with mixed Bengali-English content.

#### Acceptance Criteria

1. WHEN processing content, THE System SHALL calculate Bengali character ratio (U+0980-U+09FF)
2. WHEN processing content, THE System SHALL calculate English character ratio (A-Za-z)
3. THE System SHALL record `language_distribution.bn_ratio` as decimal (0.0-1.0)
4. THE System SHALL record `language_distribution.en_ratio` as decimal (0.0-1.0)
5. THE System SHALL NOT attempt to separate or segment content by language

## Known Limitations (Documented, No Code Required)

### Limitation 1: Section Boundary Ambiguity

Legal sections may be visually separated but not structurally marked in HTML, or split across paragraphs. Section boundary detection is presentation-dependent and not legally asserted. The System does not restructure or infer section boundaries.

### Limitation 2: Gazette PDF Comparison Out of Scope

Gazette PDFs may differ from HTML text due to OCR vs transcription differences. Gazette comparison is explicitly out of scope for this corpus version. Future validation studies may address this.

### Limitation 3: Amendment Chain Inference Prohibited

While lexical references to other acts are detected, the System explicitly prohibits inferring amendment direction, effect, scope, or constructing amendment chains. This is a methodological boundary, not a technical limitation.

