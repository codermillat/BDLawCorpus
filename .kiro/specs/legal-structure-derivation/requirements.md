# Requirements Document

## Introduction

This feature adds derived structural representation and scope-anchored cross-reference detection to the BDLawCorpus extraction output. The system parses `content_raw` (immutable canonical text) to produce a lossless JSON tree of legal structure elements and anchors statutory references with exact scope information. All outputs are derived, not replacements—`content_raw` remains unchanged.

## Glossary

- **Content_Raw**: The immutable, canonical text extracted via `textContent` from DOM; serves as the ground truth anchor for all derived outputs
- **Structure_Parser**: The component that parses `content_raw` to identify legal structure elements without modifying the source
- **Section_Heading**: Bengali text preceding a section number that identifies the section topic (e.g., সংক্ষিপ্ত শিরোনামা, সংজ্ঞা)
- **Section_Number**: Bengali numeral followed by danda (৷) that identifies a numbered section (e.g., ১৷, ২৷, ১০৷)
- **Subsection**: Numbered subdivision within a section, marked by Bengali numerals in parentheses (e.g., (১), (২))
- **Clause**: Lettered subdivision within a section or subsection, marked by Bengali letters in parentheses (e.g., (ক), (খ), (গ))
- **Preamble**: The introductory text beginning with যেহেতু (WHEREAS) that states the purpose of the act
- **Enactment_Clause**: The formal enacting formula beginning with সেহেতু এতদ্বারা (Be it enacted)
- **Statutory_Reference**: A citation to another act appearing in the text (e.g., Passport Act, 1920)
- **Reference_Scope**: The structural location where a reference appears (section, subsection, clause)
- **Character_Offset**: Zero-based position in `content_raw` where a structural element or reference begins

## Requirements

### Requirement 1: Content Raw Immutability

**User Story:** As a corpus maintainer, I want `content_raw` to remain completely unchanged during structure derivation, so that the canonical text anchor is preserved for all downstream processing.

#### Acceptance Criteria

1. THE Structure_Parser SHALL NOT modify, normalize, rewrite, merge, or reformat `content_raw` under any circumstances
2. WHEN structure derivation is performed, THE System SHALL read `content_raw` as read-only input
3. THE System SHALL produce all structural outputs as new derived fields, not replacements
4. WHEN the `structure` field is generated, THE System SHALL ensure `content_raw` byte-for-byte identity is preserved
5. THE System SHALL NOT alter punctuation, spacing, or any character in `content_raw`

### Requirement 2: Section Number Detection

**User Story:** As a legal researcher, I want section numbers to be accurately detected from Bengali numeral+danda patterns, so that I can navigate the act structure programmatically.

#### Acceptance Criteria

1. WHEN parsing `content_raw`, THE Structure_Parser SHALL detect Bengali numeral+danda patterns (e.g., ১৷, ২৷, ১০৷, ১৫৷)
2. THE Structure_Parser SHALL support single-digit (১৷ through ৯৷) and multi-digit (১০৷, ২৫৷, ১০০৷) section numbers
3. WHEN a section number is detected, THE Structure_Parser SHALL record the exact text as it appears in `content_raw`
4. THE Structure_Parser SHALL record the character offset where each section number begins
5. THE Structure_Parser SHALL preserve document order of sections in the output structure
6. THE Structure_Parser SHALL NOT normalize Bengali numerals to Arabic numerals

### Requirement 3: Section Heading Detection

**User Story:** As a legal researcher, I want section headings to be identified and associated with their sections, so that I can understand the topic of each section.

#### Acceptance Criteria

1. WHEN parsing `content_raw`, THE Structure_Parser SHALL detect section headings that precede section numbers
2. THE Structure_Parser SHALL identify common Bengali section heading patterns (e.g., সংক্ষিপ্ত শিরোনামা, সংজ্ঞা, কমিশনের ক্ষমতা)
3. WHEN a section heading is detected, THE Structure_Parser SHALL record the exact text verbatim
4. THE Structure_Parser SHALL record the character offset where each heading begins
5. THE Structure_Parser SHALL associate each heading with its corresponding section number
6. THE Structure_Parser SHALL NOT infer or synthesize headings that do not appear in `content_raw`

### Requirement 4: Subsection Detection

**User Story:** As a legal researcher, I want subsections to be detected and nested under their parent sections, so that I can navigate the hierarchical structure.

#### Acceptance Criteria

1. WHEN parsing `content_raw`, THE Structure_Parser SHALL detect subsection markers in Bengali numeral parentheses (e.g., (১), (২), (৩))
2. THE Structure_Parser SHALL associate each subsection with its parent section
3. WHEN a subsection is detected, THE Structure_Parser SHALL record the exact marker text verbatim
4. THE Structure_Parser SHALL record the character offset where each subsection marker begins
5. THE Structure_Parser SHALL preserve the sequential order of subsections within each section
6. THE Structure_Parser SHALL NOT renumber or normalize subsection markers

### Requirement 5: Clause Detection

**User Story:** As a legal researcher, I want clauses to be detected and nested under their parent sections or subsections, so that I can reference specific provisions.

#### Acceptance Criteria

1. WHEN parsing `content_raw`, THE Structure_Parser SHALL detect clause markers in Bengali letter parentheses (e.g., (ক), (খ), (গ), (ঘ))
2. THE Structure_Parser SHALL associate each clause with its parent section or subsection
3. WHEN a clause is detected, THE Structure_Parser SHALL record the exact marker text verbatim
4. THE Structure_Parser SHALL record the character offset where each clause marker begins
5. THE Structure_Parser SHALL preserve the sequential order of clauses within their parent
6. THE Structure_Parser SHALL NOT normalize clause letters or infer missing clauses

### Requirement 6: Preamble Detection

**User Story:** As a legal researcher, I want the preamble (যেহেতু clause) to be identified and separated in the structure, so that I can distinguish it from the operative provisions.

#### Acceptance Criteria

1. WHEN parsing `content_raw`, THE Structure_Parser SHALL detect preamble text beginning with যেহেতু or WHEREAS
2. THE Structure_Parser SHALL record the preamble as a distinct structural element
3. WHEN a preamble is detected, THE Structure_Parser SHALL record the exact text verbatim
4. THE Structure_Parser SHALL record the character offset where the preamble begins
5. THE Structure_Parser SHALL NOT modify or summarize the preamble text
6. IF no preamble pattern is found, THE Structure_Parser SHALL set `has_preamble: false`

### Requirement 7: Enactment Clause Detection

**User Story:** As a legal researcher, I want the enactment clause (সেহেতু এতদ্বারা) to be identified and separated, so that I can locate the formal enacting formula.

#### Acceptance Criteria

1. WHEN parsing `content_raw`, THE Structure_Parser SHALL detect enactment clause patterns (সেহেতু এতদ্বারা, Be it enacted)
2. THE Structure_Parser SHALL record the enactment clause as a distinct structural element
3. WHEN an enactment clause is detected, THE Structure_Parser SHALL record the exact text verbatim
4. THE Structure_Parser SHALL record the character offset where the enactment clause begins
5. THE Structure_Parser SHALL NOT modify or summarize the enactment clause text
6. IF no enactment clause pattern is found, THE Structure_Parser SHALL set `has_enactment_clause: false`

### Requirement 8: Lossless JSON Tree Output

**User Story:** As a corpus consumer, I want the structure output as a lossless JSON tree, so that I can programmatically traverse the act hierarchy.

#### Acceptance Criteria

1. THE Structure_Parser SHALL output structure as a JSON tree with nested sections, subsections, and clauses
2. WHEN generating the structure tree, THE System SHALL maintain document order of all elements
3. THE System SHALL include character offsets for all structural elements
4. THE System SHALL include verbatim text for all structural markers and headings
5. THE System SHALL ensure the structure can be fully regenerated from `content_raw` using the offsets
6. THE System SHALL NOT include any synthesized, inferred, or summarized content in the structure

### Requirement 9: Statutory Reference Detection

**User Story:** As a legal researcher, I want statutory references (citations to other acts) to be detected, so that I can identify which external laws are mentioned.

#### Acceptance Criteria

1. WHEN parsing `content_raw`, THE Reference_Detector SHALL detect statutory citation patterns (e.g., "Passport Act, 1920", "১৯৯০ সনের ২০ নং আইন")
2. THE Reference_Detector SHALL detect both English and Bengali citation formats
3. WHEN a reference is detected, THE Reference_Detector SHALL record the exact citation text verbatim
4. THE Reference_Detector SHALL record the character offset where each reference begins
5. THE Reference_Detector SHALL NOT resolve, link, or infer relationships between acts
6. THE Reference_Detector SHALL NOT determine legal effect, applicability, or validity of references

### Requirement 10: Reference Scope Anchoring

**User Story:** As a legal researcher, I want each statutory reference to be anchored to its exact structural scope, so that I can locate where in the act the reference appears.

#### Acceptance Criteria

1. WHEN a statutory reference is detected, THE Reference_Detector SHALL record the containing section number
2. WHEN a reference appears within a subsection, THE Reference_Detector SHALL record the subsection marker
3. WHEN a reference appears within a clause, THE Reference_Detector SHALL record the clause marker
4. THE Reference_Detector SHALL record scope as exact structural path (e.g., section: "১০", subsection: "(১)", clause: "(ক)")
5. THE Reference_Detector SHALL NOT infer scope beyond what is explicitly determinable from structure
6. IF scope cannot be determined, THE Reference_Detector SHALL set scope fields to null

### Requirement 11: Cross-Reference Output Format

**User Story:** As a corpus consumer, I want cross-references in a structured format with scope anchoring, so that I can query references by their location.

#### Acceptance Criteria

1. THE System SHALL output cross-references in a `cross_references` array field
2. WHEN outputting a reference, THE System SHALL include: citation_text, character_offset, section, subsection, clause
3. THE System SHALL include `reference_semantics: "string_match_only"` disclaimer
4. THE System SHALL include `reference_warning` stating no legal relationship is implied
5. THE System SHALL NOT include any inferred relationship type (amendment, repeal, etc.) in cross_references
6. THE System SHALL preserve the order of references as they appear in `content_raw`

### Requirement 12: Deterministic and Reproducible Output

**User Story:** As a corpus maintainer, I want structure derivation to be fully deterministic, so that the same input always produces identical output.

#### Acceptance Criteria

1. WHEN the same `content_raw` is processed multiple times, THE System SHALL produce byte-identical `structure` output
2. WHEN the same `content_raw` is processed multiple times, THE System SHALL produce byte-identical `cross_references` output
3. THE System SHALL NOT include timestamps, random values, or non-deterministic elements in derived outputs
4. THE System SHALL document all parsing rules to enable audit and verification
5. THE System SHALL ensure outputs are reproducible across different execution environments

### Requirement 13: Backward Compatibility

**User Story:** As a corpus consumer, I want existing fields to remain unchanged, so that my existing integrations continue to work.

#### Acceptance Criteria

1. THE System SHALL NOT modify existing fields (content_raw, content_normalized, content_corrected, lexical_references)
2. THE System SHALL add `structure` and `cross_references` as new top-level fields only
3. WHEN structure derivation fails, THE System SHALL set `structure: null` without affecting other fields
4. WHEN reference detection fails, THE System SHALL set `cross_references: []` without affecting other fields
5. THE System SHALL maintain compatibility with existing export and manifest formats
