# Requirements Document: Textual Fidelity & Extraction Alignment

## Introduction

This feature addresses extraction gaps where browser-rendered pages are fully loaded but legally relevant text segments are omitted due to overly narrow DOM anchoring. The goal is to capture all DOM-exposed legal text (preambles, enactment clauses, Bengali section markers) without inference, while maintaining strict adherence to the legal integrity rules.

## Glossary

- **Preamble**: The introductory statement of a legal act, often beginning with "যেহেতু..." (Whereas...) in Bengali acts
- **Enactment_Clause**: The formal declaration that enacts the law, typically "সেহেতু এতদ্বারা আইন করা হইল" (Be it hereby enacted) in Bengali
- **Section_Marker**: Bengali numbered clauses using Bengali numerals followed by danda (৷), e.g., "১৷", "২৷", "৩৷"
- **Danda**: The Bengali punctuation mark (৷) used to terminate sentences and mark section numbers
- **Content_Selector**: CSS selector used to target DOM elements for text extraction
- **Selector_Mismatch**: Condition where the configured selector does not match any DOM element despite content being present
- **Fallback_Selector**: Alternative selector tried when primary selector fails to match
- **DOM_Readiness**: State where the page has fully rendered and all legal content is available in the DOM
- **Marker_Frequency**: Count of detected section markers in extracted content

## Requirements

### Requirement 1: Preamble and Enactment Clause Capture

**User Story:** As a legal researcher, I want preambles and enactment clauses captured when present in the DOM, so that I have complete act text without missing introductory legal language.

#### Acceptance Criteria

1. WHEN extracting Bengali act content, THE Extractor SHALL detect preamble patterns starting with "যেহেতু" (Whereas)
2. WHEN extracting Bengali act content, THE Extractor SHALL detect enactment clause patterns containing "সেহেতু এতদ্বারা আইন করা হইল" (Be it hereby enacted)
3. WHEN preamble text exists outside the main content container, THE Extractor SHALL attempt fallback selectors to capture it
4. WHEN enactment clause text exists outside the main content container, THE Extractor SHALL attempt fallback selectors to capture it
5. THE Extractor SHALL record `preamble_captured: true` or `preamble_captured: false` in extraction metadata
6. THE Extractor SHALL record `enactment_clause_captured: true` or `enactment_clause_captured: false` in extraction metadata
7. THE Extractor SHALL NOT synthesize or infer preamble/enactment text if not present in DOM

### Requirement 2: Bengali Section Marker Detection Enhancement

**User Story:** As a legal researcher, I want Bengali numbered clauses (১৷, ২৷, ৩৷) recognized as valid section markers, so that marker_frequency accurately reflects document structure.

#### Acceptance Criteria

1. WHEN counting section markers, THE Extractor SHALL detect Bengali numeral + danda patterns (e.g., "১৷", "২৷", "১০৷")
2. THE Extractor SHALL recognize Bengali numerals ০-৯ (U+09E6 to U+09EF) followed by danda (৷, U+09F7)
3. THE Extractor SHALL include Bengali numeral + danda markers in the `marker_frequency.section_numbers` count
4. THE Extractor SHALL NOT restructure or reformat content based on detected markers
5. THE Extractor SHALL preserve original marker text exactly as extracted from DOM
6. WHEN the word "ধারা" is absent but Bengali numeral + danda patterns exist, THE Extractor SHALL still count section markers

### Requirement 3: Schedule Reference vs Schedule Content Distinction

**User Story:** As a legal researcher, I want accurate distinction between schedule references in text and actual schedule HTML content, so that missing_schedule flags are correct.

#### Acceptance Criteria

1. WHEN text contains "তফসিল" (Schedule) reference, THE Extractor SHALL check for corresponding table DOM elements
2. IF schedule reference exists but no table DOM element is found, THE Extractor SHALL set `missing_schedule: true`
3. THE Extractor SHALL NOT classify internal text references as `table_schedule` numeric regions unless actual table DOM exists
4. WHEN schedule table DOM exists, THE Extractor SHALL capture it using raw HTML preservation
5. THE Extractor SHALL record `schedule_reference_count` separately from `schedule_table_count`
6. THE Extractor SHALL NOT infer schedule content from references alone

### Requirement 4: Content Selector Mismatch Handling

**User Story:** As a corpus builder, I want extraction to succeed on fully loaded pages even when primary selectors don't match, so that I don't get false extraction failures.

#### Acceptance Criteria

1. WHEN primary content selector returns no match, THE Extractor SHALL try fallback selectors in defined order
2. WHEN all configured selectors fail but page contains legal text, THE Extractor SHALL record `failure_reason: "content_selector_mismatch"`
3. THE Extractor SHALL maintain a fallback selector list for broader DOM targeting
4. WHEN using fallback selectors, THE Extractor SHALL log which selector succeeded
5. THE Extractor SHALL NOT use innerText for any fallback extraction (textContent only)
6. WHEN fallback extraction succeeds, THE Extractor SHALL record `extraction_method: "fallback_selector"` with the selector used

### Requirement 5: Extraction Delay and DOM Readiness

**User Story:** As a corpus builder, I want extraction to wait for DOM readiness before attempting content capture, so that dynamically loaded content is not missed.

#### Acceptance Criteria

1. WHEN extracting content, THE Extractor SHALL verify DOM readiness before selector queries
2. THE Extractor SHALL support configurable extraction delay (default: 0ms, configurable up to 5000ms)
3. WHEN extraction delay is configured, THE Extractor SHALL wait the specified duration before extraction
4. THE Extractor SHALL record `extraction_delay_ms` in extraction metadata
5. THE Extractor SHALL NOT assume content is missing if extraction occurs before DOM is ready
6. WHEN DOM readiness check fails, THE Extractor SHALL record `dom_readiness: "uncertain"` in metadata

### Requirement 6: Fallback Selector Configuration

**User Story:** As a corpus builder, I want to configure fallback selectors for different page structures, so that extraction adapts to DOM variations.

#### Acceptance Criteria

1. THE Extractor SHALL support an ordered list of fallback content selectors
2. THE Extractor SHALL try fallback selectors only after primary selectors fail
3. THE Extractor SHALL support fallback selectors for: preamble, main content, schedules, and metadata
4. WHEN adding fallback selectors, THE Extractor SHALL validate they target read-only DOM queries
5. THE Extractor SHALL log all selector attempts (primary and fallback) for audit trail
6. THE Extractor SHALL NOT modify DOM during fallback selector attempts

### Requirement 7: Extraction Failure Reason Classification

**User Story:** As a corpus builder, I want extraction failures classified by reason, so that I can diagnose and fix extraction issues systematically.

#### Acceptance Criteria

1. WHEN extraction fails, THE Extractor SHALL classify failure_reason as one of: "content_selector_mismatch", "empty_content", "dom_not_ready", "network_error", "unknown"
2. THE Extractor SHALL record `failure_reason` in extraction metadata for failed extractions
3. WHEN failure_reason is "content_selector_mismatch", THE Extractor SHALL list all attempted selectors
4. THE Extractor SHALL distinguish between "no content found" and "selector didn't match"
5. WHEN page is visually complete but extraction fails, THE Extractor SHALL NOT mark as "empty_content"
6. THE Extractor SHALL include `selectors_attempted` array in failure metadata

### Requirement 8: Preamble Pattern Detection

**User Story:** As a legal researcher, I want preamble patterns detected and flagged in extraction metadata, so that I know if the act has a preamble structure.

#### Acceptance Criteria

1. THE Extractor SHALL detect Bengali preamble start pattern "যেহেতু" (Whereas)
2. THE Extractor SHALL detect Bengali preamble continuation patterns "এবং যেহেতু" (And whereas)
3. THE Extractor SHALL detect English preamble patterns "WHEREAS", "Whereas"
4. WHEN preamble pattern is detected in content, THE Extractor SHALL set `has_preamble: true`
5. THE Extractor SHALL record `preamble_start_position` as character offset in content_raw
6. THE Extractor SHALL NOT modify or restructure preamble text

### Requirement 9: Enactment Clause Pattern Detection

**User Story:** As a legal researcher, I want enactment clause patterns detected and flagged, so that I can identify the formal enactment statement.

#### Acceptance Criteria

1. THE Extractor SHALL detect Bengali enactment pattern "সেহেতু এতদ্বারা আইন করা হইল" (Be it hereby enacted)
2. THE Extractor SHALL detect Bengali enactment variations "এতদ্বারা নিম্নরূপ আইন করা হইল"
3. THE Extractor SHALL detect English enactment patterns "Be it enacted", "IT IS HEREBY ENACTED"
4. WHEN enactment pattern is detected in content, THE Extractor SHALL set `has_enactment_clause: true`
5. THE Extractor SHALL record `enactment_clause_position` as character offset in content_raw
6. THE Extractor SHALL NOT modify or restructure enactment clause text

### Requirement 10: Bengali Numeral Section Marker Patterns

**User Story:** As a legal researcher, I want Bengali numeral + danda patterns counted as section markers, so that marker_frequency reflects actual document structure.

#### Acceptance Criteria

1. THE Extractor SHALL detect pattern: Bengali numeral(s) followed by danda (৷)
2. THE Extractor SHALL recognize multi-digit Bengali numerals (e.g., "১০৷", "২৫৷", "১০০৷")
3. THE Extractor SHALL count these patterns in `marker_frequency.bengali_numbered_sections`
4. THE Extractor SHALL NOT require the word "ধারা" for section marker detection
5. THE Extractor SHALL preserve the distinction between "ধারা" markers and numeral+danda markers
6. THE Extractor SHALL record both counts separately: `marker_frequency.dhara_count` and `marker_frequency.numeral_danda_count`

### Requirement 11: Broader Content Container Detection

**User Story:** As a corpus builder, I want the extractor to find content in broader containers when narrow selectors fail, so that legal text is not missed.

#### Acceptance Criteria

1. THE Extractor SHALL maintain a hierarchy of content selectors from specific to broad
2. WHEN specific selectors fail, THE Extractor SHALL try progressively broader selectors
3. THE Extractor SHALL include `.boxed-layout` as a fallback container selector
4. THE Extractor SHALL include `body` as the final fallback selector with strict filtering
5. WHEN `body` is used as a fallback, THE Extractor SHALL exclude navigation, header, footer, sidebar, search, and related-link regions by selector blacklist
6. WHEN using broad selectors, THE Extractor SHALL filter out non-content elements using a defined exclusion list
6. THE Extractor SHALL record `content_container_selector` indicating which selector succeeded

### Requirement 12: Retry Mechanism for Selector Mismatch

**User Story:** As a corpus builder, I want automatic retry with broader selectors when extraction fails, so that recoverable failures are handled automatically.

#### Acceptance Criteria

1. WHEN extraction fails with "content_selector_mismatch", THE Extractor SHALL automatically retry with fallback selectors
2. THE Extractor SHALL support configurable maximum retry attempts (default: 3)
3. THE Extractor SHALL log each retry attempt with the selector used
4. WHEN retry succeeds, THE Extractor SHALL record `retry_count` and `successful_selector`
5. WHEN all retries fail, THE Extractor SHALL record `all_selectors_exhausted: true`
6. THE Extractor SHALL NOT retry for failures unrelated to selector mismatch (e.g., network errors)

## Non-Functional Requirements

### NFR 1: Extraction Method Constraint

THE Extractor SHALL use ONLY `element.textContent` for text extraction. `innerText` is STRICTLY FORBIDDEN as it is layout-dependent and non-deterministic.

### NFR 2: No Content Synthesis

THE Extractor SHALL NOT synthesize, infer, or generate any content not present in the DOM. If content is not in the DOM, it is considered unavailable.

### NFR 3: Audit Trail Completeness

THE Extractor SHALL log all selector attempts, fallbacks, and retries for complete audit trail of extraction process.

### NFR 4: Research Integrity Preservation

All extraction enhancements SHALL maintain the research integrity guarantees defined in the legal-integrity-rules, including no semantic inference and no content modification.
