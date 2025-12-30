# Changelog

All notable changes to the BDLawCorpus export schema are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Schema changes are **additive only**. Fields are never removed, only deprecated.

## [3.1.0] - 2025-12-30

### Added
- `trust_boundary` object with `can_trust` and `must_not_trust` arrays
- `ml_usage_warning` field replacing boolean `safe_for_ml_training`
- `ml_risk_factors` array for specific risk documentation
- `html_capture_definition` field documenting capture method
- `dom_extraction_method` field (always "textContent")
- `content_raw_disclaimer` field clarifying what content_raw represents
- `reference_semantics` field (always "string_match_only")
- `reference_warning` field with legal disclaimer
- `negation_handling` field (always "classification_suppression_only")
- `numeric_integrity` field (always "best_effort_html_only")
- `numeric_warning` field with accuracy disclaimer
- `completeness_disclaimer` field in data_quality

### Changed
- Renamed `sections_detected` to `marker_frequency` (honest naming)
- Renamed `partial` completeness status to `textual_partial`
- Updated all documentation to reflect archival snapshot nature

### Deprecated
- `safe_for_ml_training` boolean (replaced by `ml_usage_warning`)
- `sections_detected` field name (use `marker_frequency`)

### Removed
- None (additive-only policy)

## [3.0.0] - 2025-12-01

### Added
- Three-layer content model: `content_raw`, `content_normalized`, `content_corrected`
- Transformation audit logging with risk classification
- Protected section detection (definitions, provisos, explanations)
- Numeric region protection
- `transformation_log` array in exports
- `risk_level` classification for transformations
- `applied` boolean for transformation entries

### Changed
- `content` field split into three-layer model
- Encoding fixes now logged with full audit trail
- OCR corrections flagged but not applied in protected sections

## [2.1.0] - 2025-11-15

### Added
- Cross-reference detection with citation patterns
- `cross_references` object with count, method, and references array
- Reference type classification (mention, amendment, repeal, etc.)
- Context extraction (before/after citation)
- Line number and position tracking for citations

### Changed
- Enhanced quality assessment with cross-reference coverage

## [2.0.0] - 2025-11-01

### Added
- `identifiers` object with `internal_id` and clarifying `note`
- `data_quality` object with completeness assessment
- Missing schedule detection
- Encoding error detection
- OCR artifact detection
- `known_limitations` array
- `preamble_present`, `enactment_clause_present`, `statutory_footnotes_present` flags

### Changed
- `act_number` deprecated in favor of `identifiers.internal_id`
- Quality assessment now includes specific issue tracking

## [1.2.0] - 2025-10-15

### Added
- Batch queue processing support
- Volume number tracking
- Corpus-level export with `_corpus_metadata`
- Failed extraction tracking with `extraction_status`
- Retry mechanism with attempt history

### Changed
- Queue items now include `volumeNumber`
- Corpus exports include both successful and failed acts

## [1.1.0] - 2025-10-01

### Added
- Section marker detection (ধারা, অধ্যায়, তফসিল)
- `sections_detected` object with counts
- Amendment marker detection (বিলুপ্ত, সংশোধিত, প্রতিস্থাপিত)
- Content noise filtering

### Changed
- Improved content selector hierarchy
- Enhanced Bengali text preservation

## [1.0.0] - 2025-09-15

### Added
- Initial schema release
- Basic act export structure
- `_metadata` object with provenance fields
- `title`, `content`, `url` fields
- Source URL preservation
- Timestamp recording
- Tool identification

---

## Schema Evolution Policy

### Additive-Only Changes

New schema versions MUST:
- Add new fields without removing existing ones
- Deprecate fields rather than remove them
- Maintain backward compatibility for consumers
- Document migration paths for deprecated fields

### Breaking Changes

Breaking changes (field removal, type changes) require:
- Major version increment
- 6-month deprecation notice
- Migration documentation
- Consumer notification

### Field Deprecation Process

1. Mark field as deprecated in changelog
2. Add deprecation notice to field documentation
3. Introduce replacement field (if applicable)
4. Maintain deprecated field for minimum 2 major versions
5. Remove only after deprecation period

## Version Compatibility Matrix

| Schema Version | Extension Version | Compatible With |
|----------------|-------------------|-----------------|
| 3.1.x | 1.2.x | 3.0.x, 2.x, 1.x consumers |
| 3.0.x | 1.2.x | 2.x, 1.x consumers |
| 2.x | 1.1.x | 1.x consumers |
| 1.x | 1.0.x | - |
