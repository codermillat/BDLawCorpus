# Requirements Document: Data Quality & Remediation

## Introduction

This feature adds data quality assessment, text cleaning, and completeness validation to the BDLawCorpus extension. Legal acts often contain encoding errors from OCR digitization, missing schedules/appendices, and dense formatting that reduces readability. This feature detects these issues, applies configurable cleaning rules, and flags incomplete content for downstream consumers.

## Glossary

- **Schedule**: A table or appendix attached to a legal act containing detailed data (তফসিল in Bengali)
- **Appendix**: Supplementary material referenced by the main act text (e.g., warrant forms, rate tables)
- **OCR_Artifact**: Character corruption resulting from optical character recognition errors in the source
- **Encoding_Error**: Corrupted characters from improper text encoding (e.g., æ instead of ")
- **Data_Quality_Flag**: A marker indicating a specific quality issue in the extracted content
- **Completeness**: Assessment of whether all referenced content (schedules, appendices) is present
- **Text_Cleaner**: Module that applies regex-based transformations to fix known issues
- **Quality_Validator**: Module that assesses content completeness and detects issues

## Requirements

### Requirement 1: Detect Missing Schedules

**User Story:** As a legal researcher, I want the system to detect when an act references schedules that are not present in the extracted content, so that I know the data is incomplete.

#### Acceptance Criteria

1. WHEN extracting act content, THE Quality_Validator SHALL detect references to schedules using patterns "Schedule", "Appendix", "তফসিল", "Topsil"
2. WHEN a schedule reference is detected, THE Quality_Validator SHALL search for corresponding table content after the reference
3. IF schedule is referenced but content length after reference is less than 500 characters, THE Quality_Validator SHALL flag as "missing_schedule"
4. WHEN a missing schedule is detected, THE Quality_Validator SHALL record the schedule type and reference location
5. THE Quality_Validator SHALL support both English patterns ("First Schedule", "Third Schedule") and Bengali patterns ("প্রথম তফসিল", "দ্বিতীয় তফসিল")

### Requirement 2: Detect Encoding Errors

**User Story:** As a corpus builder, I want the system to detect known encoding errors in the content, so that I can identify and fix corrupted text.

#### Acceptance Criteria

1. WHEN processing act content, THE Quality_Validator SHALL detect the corrupted quote character "æ"
2. WHEN processing act content, THE Quality_Validator SHALL detect corrupted table border characters (ì, í, î, ï - Unicode \u00ec-\u00ef)
3. WHEN an encoding error is detected, THE Quality_Validator SHALL flag as "encoding_error"
4. WHEN an encoding error is detected, THE Quality_Validator SHALL record the character, position, and surrounding context
5. THE Quality_Validator SHALL maintain a configurable list of known encoding error patterns

### Requirement 3: Detect OCR Artifacts

**User Story:** As a corpus builder, I want the system to detect known OCR typos from the source digitization, so that I can correct them.

#### Acceptance Criteria

1. WHEN processing act content, THE Quality_Validator SHALL detect known OCR typos from a configurable dictionary
2. THE Quality_Validator SHALL include known typos: "প্রম্্নফ" → "প্রুফ", "অতগরটির" → "অক্ষরটির"
3. WHEN an OCR artifact is detected, THE Quality_Validator SHALL flag as "ocr_artifact"
4. WHEN an OCR artifact is detected, THE Quality_Validator SHALL record the incorrect text, correct text, and position
5. THE Quality_Validator SHALL support adding new OCR patterns without code changes

### Requirement 4: Apply Encoding Repair Rules

**User Story:** As a corpus builder, I want the system to automatically fix known encoding errors, so that the exported content is clean.

#### Acceptance Criteria

1. WHEN the Text_Cleaner processes content, THE Text_Cleaner SHALL replace "æ" with standard quotation mark '"'
2. WHEN the Text_Cleaner processes content, THE Text_Cleaner SHALL replace corrupted table borders (ì, í, î, ï) with newline characters
3. THE Text_Cleaner SHALL apply repairs in a configurable order
4. THE Text_Cleaner SHALL preserve original content and provide cleaned content separately
5. WHEN repairs are applied, THE Text_Cleaner SHALL log each transformation for audit trail

### Requirement 5: Apply OCR Correction Rules

**User Story:** As a corpus builder, I want the system to automatically correct known OCR typos, so that the exported content is accurate.

#### Acceptance Criteria

1. WHEN the Text_Cleaner processes content, THE Text_Cleaner SHALL apply OCR corrections from the configured dictionary
2. THE Text_Cleaner SHALL correct "প্রম্্নফ" to "প্রুফ" (London Proof context)
3. THE Text_Cleaner SHALL correct "অতগরটির" to "অক্ষরটির" (letter context)
4. THE Text_Cleaner SHALL support case-sensitive and case-insensitive corrections
5. WHEN corrections are applied, THE Text_Cleaner SHALL record the count and positions of corrections

### Requirement 6: Apply Formatting Improvements

**User Story:** As a legal researcher, I want dense legal text to be formatted with proper line breaks, so that lists and sub-clauses are readable.

#### Acceptance Criteria

1. WHEN the Text_Cleaner processes Bengali content, THE Text_Cleaner SHALL insert line breaks before Bengali list markers (ক), (খ), (গ) following semicolons or dandas
2. WHEN the Text_Cleaner processes English content, THE Text_Cleaner SHALL insert line breaks before English list markers (a), (b), (c) following semicolons
3. THE Text_Cleaner SHALL apply formatting rules only when enabled in configuration
4. THE Text_Cleaner SHALL preserve legal meaning while improving readability
5. WHEN formatting is applied, THE Text_Cleaner SHALL flag as "formatting_applied"

### Requirement 7: Generate Data Quality Assessment

**User Story:** As a downstream consumer, I want each exported act to include a data quality assessment, so that I can filter or handle incomplete data appropriately.

#### Acceptance Criteria

1. WHEN exporting an act, THE System SHALL include a "data_quality" object in the JSON output
2. THE data_quality object SHALL include a "completeness" field with values: "complete", "partial", or "uncertain"
3. THE data_quality object SHALL include a "flags" array containing detected issue types
4. THE data_quality object SHALL include an "issues" array with human-readable descriptions
5. WHEN no issues are detected, THE System SHALL set completeness to "complete" and flags to empty array

### Requirement 8: Configurable Cleaning Rules

**User Story:** As a corpus builder, I want to configure which cleaning rules are applied, so that I can customize the pipeline for different use cases.

#### Acceptance Criteria

1. THE System SHALL support enabling/disabling encoding repair rules
2. THE System SHALL support enabling/disabling OCR correction rules
3. THE System SHALL support enabling/disabling formatting improvement rules
4. THE System SHALL load cleaning rules from a configuration object
5. THE System SHALL allow adding new rules without modifying core code

### Requirement 9: Content Preservation

**User Story:** As a legal researcher, I want the original content preserved alongside cleaned content, so that I can verify transformations.

#### Acceptance Criteria

1. THE System SHALL NOT modify the original "content" field during quality assessment
2. WHEN cleaning is applied, THE System SHALL provide cleaned content in a separate field or on explicit request
3. THE System SHALL document all transformations applied to the content
4. THE System SHALL support a "dry run" mode that detects issues without applying fixes
5. THE System SHALL maintain byte-identical original content for audit purposes

### Requirement 10: Batch Processing Support

**User Story:** As a corpus builder, I want to run quality assessment on multiple exported files, so that I can remediate the entire corpus efficiently.

#### Acceptance Criteria

1. THE System SHALL support processing multiple JSON files in a batch
2. THE System SHALL generate a summary report of issues found across all files
3. THE System SHALL support filtering files by issue type (e.g., only missing_schedule)
4. THE System SHALL support outputting remediated files to a separate directory
5. THE System SHALL track processing progress and handle errors gracefully
