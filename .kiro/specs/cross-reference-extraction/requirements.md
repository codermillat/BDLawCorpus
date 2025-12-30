# Requirements Document: Cross-Reference Extraction

## Introduction

This feature adds the capability to detect and extract cross-references between legal acts in the BDLawCorpus extension. Legal acts frequently reference other acts (amendments, repeals, incorporations), and capturing these relationships enables corpus-level analysis of the Bangladeshi legal network.

## Glossary

- **Cross_Reference**: A textual mention of one legal act within another act's content
- **Citation_Pattern**: A recognizable format for referencing acts (e.g., "Act XV of 1963", "১৯৯০ সনের ২০ নং আইন")
- **Reference_Type**: The nature of the reference (amendment, repeal, incorporation, general mention)
- **Internal_ID**: The bdlaws database identifier extracted from URL pattern
- **Legal_Citation**: The formal citation format (e.g., "Act XV of 1963")
- **Extractor**: The BDLawCorpus content extraction module
- **Content_Language**: The primary language of an act's content (Bengali or English)
- **Language_Variant**: Different language versions of the same act (same internal_id, different language)

## Requirements

### Requirement 1: Detect English Citation Patterns

**User Story:** As a legal researcher, I want the system to detect English-format act citations, so that I can identify cross-references to acts cited in English.

#### Acceptance Criteria

1. WHEN extracting act content, THE Extractor SHALL detect citations matching pattern "Act [Roman/Arabic] of [Year]"
2. WHEN extracting act content, THE Extractor SHALL detect citations matching pattern "Ordinance [Roman/Arabic] of [Year]"
3. WHEN extracting act content, THE Extractor SHALL detect citations matching pattern "[Name] Act, [Year] ([Roman/Arabic] of [Year])"
4. WHEN a citation is detected, THE Extractor SHALL extract the year and serial number components
5. WHEN a citation is detected, THE Extractor SHALL record the line number and character position

### Requirement 2: Detect Bengali Citation Patterns

**User Story:** As a legal researcher, I want the system to detect Bengali-format act citations, so that I can identify cross-references to acts cited in Bengali.

#### Acceptance Criteria

1. WHEN extracting act content, THE Extractor SHALL detect citations matching pattern "[Year] সনের [Number] নং আইন"
2. WHEN extracting act content, THE Extractor SHALL detect citations matching pattern "[Year] সনের [Number] নং অধ্যাদেশ"
3. WHEN extracting act content, THE Extractor SHALL detect citations matching pattern "[Name] আইন, [Year] ([Year] সনের [Number] নং আইন)"
4. WHEN a Bengali citation is detected, THE Extractor SHALL extract the year and serial number in their original script
5. WHEN a citation contains both Bengali and English components, THE Extractor SHALL preserve both forms

### Requirement 3: Classify Reference Types

**User Story:** As a legal researcher, I want cross-references classified by type, so that I can understand the relationship between acts.

#### Acceptance Criteria

1. WHEN a reference appears with "সংশোধন" or "amendment", THE Extractor SHALL classify it as type "amendment"
2. WHEN a reference appears with "রহিত" or "repeal", THE Extractor SHALL classify it as type "repeal"
3. WHEN a reference appears with "প্রতিস্থাপিত" or "substituted", THE Extractor SHALL classify it as type "substitution"
4. WHEN a reference appears with "সাপেক্ষে" or "subject to", THE Extractor SHALL classify it as type "dependency"
5. WHEN no classification keyword is found, THE Extractor SHALL classify it as type "mention"

### Requirement 4: Extract Reference Context

**User Story:** As a legal researcher, I want surrounding context for each reference, so that I can understand how the reference is used.

#### Acceptance Criteria

1. WHEN a cross-reference is detected, THE Extractor SHALL extract 50 characters before the citation
2. WHEN a cross-reference is detected, THE Extractor SHALL extract 50 characters after the citation
3. WHEN the context would be truncated by document boundaries, THE Extractor SHALL extract available text
4. THE Extractor SHALL preserve the original text without modification in the context field

### Requirement 5: Export Cross-Reference Data

**User Story:** As a legal researcher, I want cross-references included in the export, so that I can analyze citation networks.

#### Acceptance Criteria

1. WHEN exporting an act, THE Extractor SHALL include a `cross_references` array in the JSON output
2. WHEN no cross-references are found, THE Extractor SHALL include an empty array
3. FOR EACH cross-reference, THE Extractor SHALL include: citation_text, citation_year, citation_serial, reference_type, line_number, position, context_before, context_after
4. THE Extractor SHALL include a `cross_reference_count` field with the total number of detected references
5. THE Extractor SHALL include methodology documentation: "detected via pattern matching, not verified against corpus"

### Requirement 6: Preserve Methodological Purity

**User Story:** As a corpus builder, I want cross-reference extraction to maintain methodological transparency, so that researchers understand the data provenance.

#### Acceptance Criteria

1. THE Extractor SHALL NOT modify the original content field based on cross-reference detection
2. THE Extractor SHALL document that cross-references are "pattern-detected, not semantically verified"
3. THE Extractor SHALL NOT attempt to resolve references to internal_ids (this is Phase 2 work)
4. THE Extractor SHALL NOT validate that referenced acts exist in the corpus
5. WHEN a pattern match is ambiguous, THE Extractor SHALL include all matches with confidence indicators

### Requirement 7: Corpus Deduplication

**User Story:** As a corpus builder, I want to prevent duplicate extractions, so that the corpus maintains data integrity and doesn't contain redundant entries.

#### Acceptance Criteria

1. WHEN an act with the same internal_id already exists in captured acts, THE System SHALL prevent re-extraction
2. WHEN a volume with the same volume_number already exists, THE System SHALL warn before re-capture
3. THE System SHALL maintain a corpus manifest tracking all extracted acts by internal_id
4. WHEN attempting to add a duplicate, THE System SHALL display the existing entry's capture timestamp
5. THE System SHALL provide an option to force re-extraction with version tracking

### Requirement 8: Corpus Manifest and Mapping

**User Story:** As a legal researcher, I want a corpus manifest that maps all extracted acts, so that I can understand corpus coverage and completeness.

#### Acceptance Criteria

1. THE System SHALL maintain a `corpus_manifest.json` file tracking all extracted acts
2. FOR EACH extracted act, THE Manifest SHALL record: internal_id, title, volume_number, capture_timestamp, file_path, content_hash
3. THE Manifest SHALL include corpus-level statistics: total_acts, total_volumes, total_characters, extraction_date_range
4. THE Manifest SHALL track cross-reference coverage: referenced_acts_in_corpus, referenced_acts_missing
5. WHEN exporting, THE System SHALL generate an updated manifest alongside act files

### Requirement 9: Research Standards Compliance

**User Story:** As an academic researcher, I want the corpus to follow established research data standards, so that it can be cited and reproduced.

#### Acceptance Criteria

1. THE System SHALL include a corpus-level README with methodology documentation
2. THE System SHALL generate a CITATION.cff file for proper academic citation
3. THE System SHALL include provenance chain: source_url → extraction_timestamp → tool_version → export_timestamp
4. THE System SHALL document known limitations: missing schedules, OCR errors in source, encoding issues
5. THE System SHALL include a data dictionary defining all schema fields
6. THE System SHALL version the corpus schema with semantic versioning (currently v2.0)

### Requirement 10: Extraction Idempotency

**User Story:** As a corpus builder, I want extraction to be idempotent, so that re-running extraction produces identical results.

#### Acceptance Criteria

1. WHEN extracting the same act twice, THE Extractor SHALL produce byte-identical content (excluding timestamps)
2. THE System SHALL compute and store content_hash (SHA-256) for each extracted act
3. WHEN content_hash differs from previous extraction, THE System SHALL flag as "source_changed"
4. THE System SHALL support diff comparison between extraction versions
5. THE System SHALL log all extraction operations with timestamps for audit trail

### Requirement 11: Language-Aware Deduplication

**User Story:** As a corpus builder, I want to prevent extracting the same act in both Bengali and English versions, so that the corpus contains only one version per act with Bengali preferred.

#### Acceptance Criteria

1. WHEN extracting an act, THE System SHALL detect the content language (Bengali or English)
2. WHEN an act exists only in one language, THE System SHALL allow extraction regardless of language
3. WHEN an act is available in both Bengali and English, THE System SHALL prefer the Bengali version
4. WHEN attempting to extract an English version of an act that already has a Bengali version, THE System SHALL prevent extraction and display a warning
5. WHEN attempting to extract a Bengali version of an act that already has an English version, THE System SHALL allow extraction and replace the English version
6. THE Manifest SHALL record the content_language for each extracted act
7. WHEN displaying duplicate warnings, THE System SHALL indicate the language of the existing version

