/**
 * BDLawCorpus Manifest Manager Module
 * 
 * Manages corpus manifest for tracking all extracted acts, deduplication,
 * and cross-reference coverage analysis.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4 - Corpus Manifest and Mapping
 * 
 * @module bdlaw-corpus-manifest
 */

const BDLawCorpusManifest = {
  /**
   * Storage key for corpus manifest in chrome.storage
   */
  STORAGE_KEY: 'bdlaw_corpus_manifest',

  /**
   * Clear corpus manifest from chrome.storage
   * Used when user clears all data to ensure manifest and capturedActs stay in sync
   * 
   * @returns {Promise<boolean>} True if clear succeeded, false otherwise
   */
  async clearCorpusManifest() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove([this.STORAGE_KEY]);
        return true;
      }
      return true;
    } catch (e) {
      console.error('Failed to clear corpus manifest:', e);
      return false;
    }
  },

  /**
   * Current manifest schema version
   * Requirements: 9.6 - Version the corpus schema with semantic versioning
   */
  SCHEMA_VERSION: '2.0',

  /**
   * Extension version for tracking extraction tool version
   */
  EXTENSION_VERSION: '1.2.0',

  /**
   * Default manifest schema structure
   * Requirements: 8.1, 8.2 - Corpus manifest schema definition
   * 
   * @returns {Object} Empty manifest with default structure
   */
  createEmptyManifest() {
    const now = new Date().toISOString();
    return {
      version: this.SCHEMA_VERSION,
      created_at: now,
      updated_at: now,
      corpus_stats: {
        total_acts: 0,
        total_volumes: 0,
        total_characters: 0,
        extraction_date_range: {
          earliest: null,
          latest: null
        }
      },
      cross_reference_coverage: {
        referenced_acts_in_corpus: [],
        referenced_acts_missing: [],
        coverage_percentage: 0
      },
      acts: {},
      volumes: {},
      version_history: {}
    };
  },

  /**
   * Load corpus manifest from chrome.storage
   * Requirements: 8.1 - Maintain corpus_manifest.json tracking all extracted acts
   * 
   * @returns {Promise<Object>} The loaded manifest or a new empty manifest
   */
  async loadCorpusManifest() {
    try {
      // Check if we're in a Chrome extension environment
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get([this.STORAGE_KEY]);
        if (result[this.STORAGE_KEY]) {
          return result[this.STORAGE_KEY];
        }
      }
      // Return empty manifest if not found or not in Chrome environment
      return this.createEmptyManifest();
    } catch (e) {
      console.error('Failed to load corpus manifest:', e);
      return this.createEmptyManifest();
    }
  },

  /**
   * Save corpus manifest to chrome.storage
   * Requirements: 8.1 - Maintain corpus_manifest.json tracking all extracted acts
   * 
   * @param {Object} manifest - The manifest to save
   * @returns {Promise<boolean>} True if save succeeded, false otherwise
   */
  async saveCorpusManifest(manifest) {
    try {
      // Check if we're in a Chrome extension environment
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [this.STORAGE_KEY]: manifest
        });
        return true;
      }
      // In non-Chrome environment (e.g., tests), just return true
      return true;
    } catch (e) {
      console.error('Failed to save corpus manifest:', e);
      return false;
    }
  },

  /**
   * Update corpus manifest with a new act
   * Requirements: 8.2, 8.3, 11.6 - Record act entry, update corpus statistics, and record content language
   * 
   * @param {Object} manifest - The current manifest
   * @param {Object} newAct - The new act to add
   * @param {string} newAct.internal_id - The bdlaws database identifier
   * @param {string} newAct.title - The act title
   * @param {string} newAct.volume_number - The volume number
   * @param {string} newAct.capturedAt - ISO8601 capture timestamp
   * @param {string} newAct.file_path - The export file path
   * @param {string} newAct.content - The act content (for hash and char count)
   * @param {string} [newAct.content_language] - The content language ('bengali' or 'english')
   * @param {number} [newAct.cross_reference_count] - Number of cross-references
   * @returns {Object} The updated manifest
   */
  updateCorpusManifest(manifest, newAct) {
    if (!manifest || !newAct) {
      return manifest || this.createEmptyManifest();
    }

    const now = new Date().toISOString();
    const internalId = newAct.internal_id || newAct.actNumber;

    if (!internalId) {
      console.error('Cannot update manifest: missing internal_id');
      return manifest;
    }

    // Update or add act entry
    // Requirements: 8.2 - Record internal_id, title, volume_number, capture_timestamp, file_path, content_hash
    // Requirements: 11.6 - Record content_language in manifest
    manifest.acts[internalId] = {
      internal_id: internalId,
      title: newAct.title || '',
      volume_number: newAct.volume_number || newAct.volumeNumber || 'unknown',
      capture_timestamp: newAct.capturedAt || now,
      file_path: newAct.file_path || `bdlaw_act_${internalId}_${now.replace(/[:.]/g, '-').slice(0, 19)}.json`,
      content_hash: newAct.content_hash || null, // Requirements: 10.2 - Store content hash
      content_language: newAct.content_language || 'english', // Requirements: 11.6 - Store content language
      content_length: newAct.content ? newAct.content.length : 0,
      cross_reference_count: newAct.cross_reference_count || 0,
      extraction_version: this.EXTENSION_VERSION
    };

    // Update volume tracking if volume_number is provided
    const volumeNumber = newAct.volume_number || newAct.volumeNumber;
    if (volumeNumber && volumeNumber !== 'unknown') {
      if (!manifest.volumes[volumeNumber]) {
        manifest.volumes[volumeNumber] = {
          volume_number: volumeNumber,
          capture_timestamp: now,
          extracted_acts: []
        };
      }
      // Add act to volume's extracted_acts if not already present
      if (!manifest.volumes[volumeNumber].extracted_acts.includes(internalId)) {
        manifest.volumes[volumeNumber].extracted_acts.push(internalId);
      }
    }

    // Update corpus statistics
    // Requirements: 8.3 - Include corpus-level statistics
    manifest.corpus_stats.total_acts = Object.keys(manifest.acts).length;
    manifest.corpus_stats.total_volumes = Object.keys(manifest.volumes).length;
    
    // Calculate total characters from all acts
    manifest.corpus_stats.total_characters = Object.values(manifest.acts)
      .reduce((sum, act) => sum + (act.content_length || 0), 0);

    // Update extraction date range
    const captureDate = newAct.capturedAt || now;
    if (!manifest.corpus_stats.extraction_date_range.earliest || 
        captureDate < manifest.corpus_stats.extraction_date_range.earliest) {
      manifest.corpus_stats.extraction_date_range.earliest = captureDate;
    }
    if (!manifest.corpus_stats.extraction_date_range.latest || 
        captureDate > manifest.corpus_stats.extraction_date_range.latest) {
      manifest.corpus_stats.extraction_date_range.latest = captureDate;
    }

    // Update manifest timestamp
    manifest.updated_at = now;

    return manifest;
  },

  /**
   * Update cross-reference coverage tracking
   * Requirements: 8.4 - Track cross-reference coverage
   * 
   * Collects all referenced act citations from the corpus and compares
   * against manifest.acts keys to determine coverage.
   * 
   * @param {Object} manifest - The manifest to update
   * @param {Object} [crossRefData] - Optional map of internal_id to cross-references array
   * @returns {Object} The updated manifest with coverage information
   */
  updateCrossReferenceCoverage(manifest, crossRefData = {}) {
    if (!manifest) {
      return this.createEmptyManifest();
    }

    // Collect all unique referenced act identifiers
    // These would typically be extracted from cross-reference data
    const referencedActIds = new Set();
    const corpusActIds = new Set(Object.keys(manifest.acts));

    // If crossRefData is provided, extract referenced IDs
    // crossRefData format: { internal_id: [{ citation_year, citation_serial, ... }] }
    for (const [actId, references] of Object.entries(crossRefData)) {
      if (Array.isArray(references)) {
        for (const ref of references) {
          // Try to construct a potential internal_id from citation
          // Note: This is a heuristic - actual resolution requires Phase 2 work
          if (ref.citation_year && ref.citation_serial) {
            // Store as a reference identifier (not resolved to internal_id)
            const refId = `${ref.citation_year}_${ref.citation_serial}`;
            referencedActIds.add(refId);
          }
        }
      }
    }

    // Determine which referenced acts are in corpus vs missing
    // Requirements: 8.4 - Populate referenced_acts_in_corpus and referenced_acts_missing
    const inCorpus = [];
    const missing = [];

    for (const refId of referencedActIds) {
      // Check if any act in corpus matches this reference
      // This is a simplified check - actual matching requires citation resolution
      if (corpusActIds.has(refId)) {
        inCorpus.push(refId);
      } else {
        missing.push(refId);
      }
    }

    // Update coverage information
    manifest.cross_reference_coverage = {
      referenced_acts_in_corpus: inCorpus,
      referenced_acts_missing: missing,
      coverage_percentage: referencedActIds.size > 0 
        ? Math.round((inCorpus.length / referencedActIds.size) * 100)
        : 100 // 100% if no references (nothing to cover)
    };

    manifest.updated_at = new Date().toISOString();

    return manifest;
  },

  /**
   * Check if act already exists in corpus
   * Requirements: 7.1, 7.4 - Prevent re-extraction of existing acts
   * 
   * @param {Object} manifest - The corpus manifest
   * @param {string} internalId - The internal_id to check
   * @returns {Object} Duplicate status with existing entry details
   */
  isDuplicateAct(manifest, internalId) {
    if (!manifest || !manifest.acts || !internalId) {
      return { isDuplicate: false };
    }

    const existing = manifest.acts[internalId];
    if (existing) {
      return {
        isDuplicate: true,
        existingEntry: existing,
        message: `Act ${internalId} already captured on ${existing.capture_timestamp}`
      };
    }
    return { isDuplicate: false };
  },

  /**
   * Check for language-aware duplicate with Bengali preference
   * Requirements: 11.2, 11.3, 11.4, 11.5 - Language-aware deduplication
   * 
   * Logic:
   * - If act doesn't exist: allow extraction
   * - If act exists in same language: standard duplicate (block)
   * - If existing is English, new is Bengali: allow (replace English with Bengali)
   * - If existing is Bengali, new is English: block (Bengali preferred)
   * 
   * @param {Object} manifest - The corpus manifest
   * @param {string} internalId - The internal_id of the act
   * @param {string} newContentLanguage - The language of the new content ('bengali' or 'english')
   * @returns {Object} Duplicate check result with language-aware logic
   */
  checkLanguageAwareDuplicate(manifest, internalId, newContentLanguage) {
    if (!manifest || !manifest.acts || !internalId) {
      return { isDuplicate: false, allowExtraction: true };
    }

    const existing = manifest.acts[internalId];
    
    // Act doesn't exist - allow extraction
    if (!existing) {
      return { 
        isDuplicate: false, 
        allowExtraction: true 
      };
    }

    const existingLanguage = existing.content_language || 'english'; // Default to English if not set

    // Same language - standard duplicate behavior
    if (existingLanguage === newContentLanguage) {
      return {
        isDuplicate: true,
        allowExtraction: false,
        existingEntry: existing,
        existingLanguage: existingLanguage,
        newLanguage: newContentLanguage,
        message: `Act ${internalId} already captured in ${existingLanguage} on ${existing.capture_timestamp}`
      };
    }

    // Existing is English, new is Bengali - allow (Bengali preferred)
    if (existingLanguage === 'english' && newContentLanguage === 'bengali') {
      return {
        isDuplicate: true,
        allowExtraction: true,
        replaceExisting: true,
        existingEntry: existing,
        existingLanguage: existingLanguage,
        newLanguage: newContentLanguage,
        message: `Act ${internalId} exists in English. Bengali version will replace it (Bengali preferred).`
      };
    }

    // Existing is Bengali, new is English - block (Bengali preferred)
    if (existingLanguage === 'bengali' && newContentLanguage === 'english') {
      return {
        isDuplicate: true,
        allowExtraction: false,
        existingEntry: existing,
        existingLanguage: existingLanguage,
        newLanguage: newContentLanguage,
        message: `Act ${internalId} already captured in Bengali on ${existing.capture_timestamp}. Bengali version is preferred - English extraction blocked.`
      };
    }

    // Fallback - shouldn't reach here
    return { isDuplicate: false, allowExtraction: true };
  },

  /**
   * Check if volume already captured
   * Requirements: 7.2 - Warn before re-capture of existing volume
   * 
   * @param {Object} manifest - The corpus manifest
   * @param {string} volumeNumber - The volume_number to check
   * @returns {Object} Duplicate status with warning message
   */
  isDuplicateVolume(manifest, volumeNumber) {
    if (!manifest || !manifest.volumes || !volumeNumber) {
      return { isDuplicate: false };
    }

    const existing = manifest.volumes[volumeNumber];
    if (existing) {
      return {
        isDuplicate: true,
        existingEntry: existing,
        message: `Volume ${volumeNumber} already captured on ${existing.capture_timestamp}`
      };
    }
    return { isDuplicate: false };
  },

  /**
   * Force re-extraction with version tracking
   * Requirements: 7.5 - Archive previous version and update manifest with new extraction
   * 
   * @param {Object} manifest - The corpus manifest
   * @param {string} internalId - The internal_id of the act to re-extract
   * @param {Object} newAct - The new act data
   * @returns {Object} The updated manifest with archived previous version
   */
  forceReExtraction(manifest, internalId, newAct) {
    if (!manifest || !internalId || !newAct) {
      return manifest || this.createEmptyManifest();
    }

    const existing = manifest.acts[internalId];
    
    // Initialize version_history if not present
    if (!manifest.version_history) {
      manifest.version_history = {};
    }
    if (!manifest.version_history[internalId]) {
      manifest.version_history[internalId] = [];
    }

    // Archive previous version if it exists
    if (existing) {
      manifest.version_history[internalId].push({
        ...existing,
        archived_at: new Date().toISOString(),
        reason: 'force_re_extraction'
      });
    }

    // Update with new extraction using updateCorpusManifest
    return this.updateCorpusManifest(manifest, newAct);
  },

  /**
   * Compute SHA-256 hash of content
   * Requirements: 10.2 - Compute and store content_hash (SHA-256)
   * 
   * @param {string} content - The content to hash
   * @returns {Promise<string>} Hash in format "sha256:hexstring"
   */
  async computeContentHash(content) {
    if (!content || typeof content !== 'string') {
      return null;
    }

    try {
      // Use Web Crypto API if available (browser environment)
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `sha256:${hashHex}`;
      }
      
      // Fallback for Node.js environment (tests)
      if (typeof require !== 'undefined') {
        try {
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          return `sha256:${hash}`;
        } catch (e) {
          // crypto module not available
        }
      }

      // If no crypto available, return null
      return null;
    } catch (e) {
      console.error('Failed to compute content hash:', e);
      return null;
    }
  },

  /**
   * Storage key for extraction audit log in localStorage
   * Requirements: 10.5 - Log all extraction operations with timestamps for audit trail
   */
  EXTRACTION_LOG_KEY: 'bdlaw_extraction_log',

  /**
   * Maximum number of log entries to retain (to prevent localStorage overflow)
   */
  MAX_LOG_ENTRIES: 1000,

  /**
   * Log an extraction operation for audit trail
   * Requirements: 10.5 - Log all extraction operations with timestamps for audit trail
   * 
   * Creates a log entry with timestamp, operation type, and result,
   * then appends it to the extraction log in localStorage.
   * 
   * @param {Object} operation - The operation details to log
   * @param {string} operation.type - Operation type: 'extract', 'export', 'duplicate_check', 'force_re_extract'
   * @param {string} [operation.internal_id] - The internal_id of the act (if applicable)
   * @param {string} [operation.volume_number] - The volume_number (if applicable)
   * @param {string} operation.result - Result: 'success', 'duplicate', 'skipped', 'error'
   * @param {Object} [operation.details] - Additional details about the operation
   * @returns {Object} The created log entry
   */
  logExtractionOperation(operation) {
    if (!operation || !operation.type) {
      console.error('logExtractionOperation: operation type is required');
      return null;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      operation: operation.type,
      internal_id: operation.internal_id || null,
      volume_number: operation.volume_number || null,
      result: operation.result || 'unknown',
      details: operation.details || {}
    };

    try {
      // Load existing log from localStorage
      let log = [];
      if (typeof localStorage !== 'undefined') {
        const existingLog = localStorage.getItem(this.EXTRACTION_LOG_KEY);
        if (existingLog) {
          try {
            log = JSON.parse(existingLog);
            if (!Array.isArray(log)) {
              log = [];
            }
          } catch (e) {
            console.error('Failed to parse extraction log, starting fresh:', e);
            log = [];
          }
        }

        // Append new entry
        log.push(logEntry);

        // Trim log if it exceeds maximum entries (keep most recent)
        if (log.length > this.MAX_LOG_ENTRIES) {
          log = log.slice(log.length - this.MAX_LOG_ENTRIES);
        }

        // Save back to localStorage
        localStorage.setItem(this.EXTRACTION_LOG_KEY, JSON.stringify(log));
      }

      return logEntry;
    } catch (e) {
      console.error('Failed to log extraction operation:', e);
      return logEntry; // Return the entry even if storage failed
    }
  },

  /**
   * Get the extraction audit log
   * Requirements: 10.5 - Audit trail access
   * 
   * @param {Object} [options] - Filter options
   * @param {string} [options.type] - Filter by operation type
   * @param {string} [options.internal_id] - Filter by internal_id
   * @param {number} [options.limit] - Maximum number of entries to return
   * @returns {Array} Array of log entries
   */
  getExtractionLog(options = {}) {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }

      const existingLog = localStorage.getItem(this.EXTRACTION_LOG_KEY);
      if (!existingLog) {
        return [];
      }

      let log = JSON.parse(existingLog);
      if (!Array.isArray(log)) {
        return [];
      }

      // Apply filters
      if (options.type) {
        log = log.filter(entry => entry.operation === options.type);
      }
      if (options.internal_id) {
        log = log.filter(entry => entry.internal_id === options.internal_id);
      }

      // Apply limit (return most recent entries)
      if (options.limit && options.limit > 0) {
        log = log.slice(-options.limit);
      }

      return log;
    } catch (e) {
      console.error('Failed to get extraction log:', e);
      return [];
    }
  },

  /**
   * Clear the extraction audit log
   * Requirements: 10.5 - Audit trail management
   * 
   * @returns {boolean} True if cleared successfully
   */
  clearExtractionLog() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.EXTRACTION_LOG_KEY);
      }
      return true;
    } catch (e) {
      console.error('Failed to clear extraction log:', e);
      return false;
    }
  },

  // ============================================
  // RESEARCH STANDARDS GENERATORS
  // Requirements: 9.1, 9.2, 9.3, 9.4, 9.5 - Research Standards Compliance
  // ============================================

  /**
   * Generate CITATION.cff content for academic citation
   * Requirements: 9.2 - Generate a CITATION.cff file for proper academic citation
   * 
   * @param {Object} manifest - The corpus manifest
   * @returns {string} CITATION.cff content as a string
   */
  generateCitationCff(manifest) {
    if (!manifest) {
      manifest = this.createEmptyManifest();
    }

    const stats = manifest.corpus_stats || {};
    const dateRange = stats.extraction_date_range || {};
    const releaseDate = manifest.updated_at 
      ? manifest.updated_at.split('T')[0] 
      : new Date().toISOString().split('T')[0];

    return `cff-version: 1.2.0
message: "If you use this dataset, please cite it as below."
type: dataset
title: "BDLawCorpus: Bangladeshi Legal Text Corpus"
version: "${manifest.version || this.SCHEMA_VERSION}"
date-released: "${releaseDate}"
url: "http://bdlaws.minlaw.gov.bd"
repository: "https://github.com/bdlawcorpus/bdlawcorpus"
abstract: >-
  A research-grade corpus of Bangladeshi legal texts extracted from 
  bdlaws.minlaw.gov.bd using the BDLawCorpus Chrome extension.
  Contains ${stats.total_acts || 0} acts from 
  ${stats.total_volumes || 0} volumes with ${(stats.total_characters || 0).toLocaleString()} total characters.
  Extraction period: ${dateRange.earliest || 'N/A'} to ${dateRange.latest || 'N/A'}.
keywords:
  - legal corpus
  - Bangladesh law
  - legal NLP
  - legislative text
  - Bangladeshi legislation
  - legal research
license: "CC-BY-4.0"
authors:
  - name: "BDLawCorpus Contributors"
    affiliation: "Academic Research"
`;
  },

  /**
   * Generate corpus README with methodology documentation
   * Requirements: 9.1, 9.3, 9.4 - README with methodology, provenance chain, and known limitations
   * 
   * @param {Object} manifest - The corpus manifest
   * @returns {string} README.md content as a string
   */
  generateCorpusReadme(manifest) {
    if (!manifest) {
      manifest = this.createEmptyManifest();
    }

    const stats = manifest.corpus_stats || {};
    const dateRange = stats.extraction_date_range || {};
    const coverage = manifest.cross_reference_coverage || {};

    return `# BDLawCorpus Dataset

## Overview

This corpus contains ${stats.total_acts || 0} Bangladeshi legal acts extracted from the official bdlaws.minlaw.gov.bd website. The corpus spans ${stats.total_volumes || 0} volumes with a total of ${(stats.total_characters || 0).toLocaleString()} characters.

## Corpus Statistics

| Metric | Value |
|--------|-------|
| Total Acts | ${stats.total_acts || 0} |
| Total Volumes | ${stats.total_volumes || 0} |
| Total Characters | ${(stats.total_characters || 0).toLocaleString()} |
| Extraction Period | ${dateRange.earliest || 'N/A'} to ${dateRange.latest || 'N/A'} |
| Cross-Reference Coverage | ${coverage.coverage_percentage || 0}% |
| Schema Version | ${manifest.version || this.SCHEMA_VERSION} |

## Methodology

### Extraction Tool
- **Tool**: BDLawCorpus Chrome Extension v${this.EXTENSION_VERSION}
- **Method**: Manual page-level extraction (human-in-the-loop)
- **Schema Version**: ${manifest.version || this.SCHEMA_VERSION}

### Extraction Process
1. Human operator navigates to bdlaws.minlaw.gov.bd
2. Volume catalog pages are captured to identify available acts
3. Individual act pages are visited and content is extracted
4. Cross-references are detected via pattern matching (not semantic analysis)
5. Content is exported as individual JSON files with full metadata

### Methodological Principles
- **No Automated Crawling**: All extraction is manually triggered
- **No Content Modification**: Text is preserved exactly as found in source
- **No Semantic Interpretation**: Cross-references are pattern-detected, not verified
- **Full Provenance**: Every extraction includes source URL and timestamps

## Provenance Chain

1. **Source**: bdlaws.minlaw.gov.bd (official Ministry of Law website)
2. **Extraction**: BDLawCorpus extension with hardcoded legal selectors
3. **Processing**: No modification, restructuring, or interpretation
4. **Export**: Individual JSON files with full metadata

Each exported act includes:
- \`source_url\`: Original page URL
- \`scraped_at\`: Timestamp of page access
- \`extracted_at\`: Timestamp of content processing
- \`tool\`: Tool name and version
- \`content_hash\`: SHA-256 hash for integrity verification

## Known Limitations

### Content Limitations
1. **Missing Schedules**: Some acts reference তফসিল (schedules) not present in HTML source
2. **OCR Errors**: Source contains digitization errors (e.g., "প্রম্্নফ" should be "প্রুফ")
3. **Encoding Issues**: Some English text has phantom characters (e.g., "æ")
4. **Incomplete Coverage**: Not all acts from all volumes are extracted

### Technical Limitations
1. **Cross-Reference Resolution**: Citations are detected but not resolved to internal IDs
2. **Structural Parsing**: Section boundaries are marker-based, not semantically verified
3. **Amendment Tracking**: Amendment markers are detected but not linked to source acts

### Coverage Gaps
- Referenced acts in corpus: ${coverage.referenced_acts_in_corpus?.length || 0}
- Referenced acts missing: ${coverage.referenced_acts_missing?.length || 0}

## Schema Documentation

See \`DATA_DICTIONARY.md\` for complete field definitions.

## Citation

See \`CITATION.cff\` for citation information.

If you use this dataset in academic work, please cite:

\`\`\`bibtex
@dataset{bdlawcorpus,
  title = {BDLawCorpus: Bangladeshi Legal Text Corpus},
  author = {BDLawCorpus Contributors},
  year = {${new Date().getFullYear()}},
  url = {http://bdlaws.minlaw.gov.bd},
  note = {Extracted using BDLawCorpus Chrome Extension v${this.EXTENSION_VERSION}}
}
\`\`\`

## License

This dataset is provided for academic research purposes only. The original legal texts are public domain as official government documents. The corpus structure and metadata are licensed under CC-BY-4.0.

## Disclaimer

This corpus is provided "as is" for academic research purposes. The extractors make no guarantees about completeness, accuracy, or fitness for any particular purpose. Users should verify critical information against the official source.
`;
  },

  /**
   * Generate data dictionary documenting all schema fields
   * Requirements: 9.5 - Include a data dictionary defining all schema fields
   * 
   * @returns {string} DATA_DICTIONARY.md content as a string
   */
  generateDataDictionary() {
    return `# BDLawCorpus Data Dictionary

## Overview

This document defines all fields in the BDLawCorpus export schema (v${this.SCHEMA_VERSION}).

## Act Export Schema

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`identifiers\` | object | Yes | Container for identification fields |
| \`act_number\` | string | Yes | DEPRECATED: Use \`identifiers.internal_id\` |
| \`title\` | string | Yes | Act title in original language (usually Bengali) |
| \`content\` | string | Yes | Full legal text content, noise-filtered |
| \`url\` | string | Yes | Source URL for provenance tracking |
| \`volume_number\` | string | Yes | Volume containing this act |
| \`marker_frequency\` | object | Yes | Raw string occurrence counts |
| \`cross_references\` | object | Yes | Detected cross-references to other acts |
| \`_metadata\` | object | No | Provenance and extraction metadata |

### Identifiers Object

| Field | Type | Description |
|-------|------|-------------|
| \`internal_id\` | string | bdlaws database ID extracted from URL pattern \`/act-details-{ID}.html\` |
| \`note\` | string | Clarification that internal_id is NOT the legal citation number |

### Marker Frequency Object

| Field | Type | Description |
|-------|------|-------------|
| \`ধারা\` | object | Section marker frequency |
| \`ধারা.count\` | integer | Raw string occurrence count |
| \`ধারা.method\` | string | Counting methodology: "raw string frequency, including cross-references" |
| \`অধ্যায়\` | object | Chapter marker frequency |
| \`অধ্যায়.count\` | integer | Raw string occurrence count |
| \`অধ্যায়.method\` | string | Counting methodology: "raw string frequency" |
| \`তফসিল\` | object | Schedule marker frequency |
| \`তফসিল.count\` | integer | Raw string occurrence count |
| \`তফসিল.method\` | string | Counting methodology: "raw string frequency, including schedule references" |

### Cross-References Object

| Field | Type | Description |
|-------|------|-------------|
| \`count\` | integer | Total number of detected cross-references |
| \`method\` | string | Detection methodology: "pattern-based detection, not semantically verified" |
| \`references\` | array | Array of CrossReference objects |

### CrossReference Object

| Field | Type | Description |
|-------|------|-------------|
| \`citation_text\` | string | Original citation text as found in content |
| \`citation_year\` | string | Year component extracted from citation (original script) |
| \`citation_serial\` | string | Serial number (Roman numerals or Arabic numerals) |
| \`reference_type\` | string | Classification: "amendment", "repeal", "substitution", "dependency", "incorporation", or "mention" |
| \`line_number\` | integer | 1-indexed line number where citation appears |
| \`position\` | integer | Character position in full content string |
| \`context_before\` | string | Up to 50 characters before the citation |
| \`context_after\` | string | Up to 50 characters after the citation |

### Metadata Object

| Field | Type | Description |
|-------|------|-------------|
| \`source\` | string | Source domain: "bdlaws.minlaw.gov.bd" |
| \`source_url\` | string | Full source URL |
| \`scraped_at\` | string | ISO8601 timestamp of page access |
| \`extracted_at\` | string | ISO8601 timestamp of content processing |
| \`scraping_method\` | string | Extraction methodology: "manual page-level extraction" |
| \`tool\` | string | Tool name and version |
| \`language\` | string | Content language code: "bn" (Bengali) |
| \`research_purpose\` | string | Intended use: "academic legal corpus construction" |
| \`disclaimer\` | string | Legal/ethical disclaimer |

## Volume Catalog Schema

| Field | Type | Description |
|-------|------|-------------|
| \`volume_number\` | string | Volume identifier |
| \`source_url\` | string | URL of volume catalog page |
| \`captured_at\` | string | ISO8601 timestamp of capture |
| \`total_acts\` | integer | Number of acts listed in volume |
| \`acts\` | array | Array of act summary objects |

### Act Summary Object (in Volume Catalog)

| Field | Type | Description |
|-------|------|-------------|
| \`title\` | string | Act title |
| \`year\` | string | Act year |
| \`act_number\` | string | Act number/identifier |
| \`url\` | string | URL to act details page |

## Corpus Manifest Schema

| Field | Type | Description |
|-------|------|-------------|
| \`version\` | string | Schema version (semantic versioning) |
| \`created_at\` | string | ISO8601 timestamp of manifest creation |
| \`updated_at\` | string | ISO8601 timestamp of last update |
| \`corpus_stats\` | object | Corpus-level statistics |
| \`cross_reference_coverage\` | object | Cross-reference coverage tracking |
| \`acts\` | object | Map of internal_id to act metadata |
| \`volumes\` | object | Map of volume_number to volume metadata |
| \`version_history\` | object | Archive of previous extractions |

### Corpus Stats Object

| Field | Type | Description |
|-------|------|-------------|
| \`total_acts\` | integer | Count of acts in corpus |
| \`total_volumes\` | integer | Count of volumes in corpus |
| \`total_characters\` | integer | Sum of all act content lengths |
| \`extraction_date_range.earliest\` | string | Earliest extraction timestamp |
| \`extraction_date_range.latest\` | string | Latest extraction timestamp |

### Cross-Reference Coverage Object

| Field | Type | Description |
|-------|------|-------------|
| \`referenced_acts_in_corpus\` | array | IDs of referenced acts that exist in corpus |
| \`referenced_acts_missing\` | array | IDs of referenced acts not in corpus |
| \`coverage_percentage\` | integer | Percentage of referenced acts in corpus |

## Reference Type Classifications

| Type | Bengali Keywords | English Keywords | Description |
|------|------------------|------------------|-------------|
| \`amendment\` | সংশোধন, সংশোধিত | amendment, amended, amending | Act modifies another act |
| \`repeal\` | রহিত, রহিতকরণ, বিলুপ্ত | repeal, repealed, repealing | Act abolishes another act |
| \`substitution\` | প্রতিস্থাপিত, প্রতিস্থাপন | substituted, substitution, replaced | Act replaces provisions |
| \`dependency\` | সাপেক্ষে, অধীন, অনুসারে | subject to, under, pursuant to | Act depends on another |
| \`incorporation\` | সন্নিবেশিত, অন্তর্ভুক্ত | inserted, incorporated, added | Act incorporates provisions |
| \`mention\` | (none) | (none) | General reference without classification |

## Citation Patterns Detected

### English Patterns
- \`Act [Roman/Arabic] of [Year]\` - e.g., "Act XV of 1963"
- \`Ordinance [Roman/Arabic] of [Year]\` - e.g., "Ordinance XXXVI of 1984"
- \`[Name] Act, [Year] ([Roman/Arabic] of [Year])\` - e.g., "Income Tax Ordinance, 1984 (XXXVI of 1984)"
- \`P.O. No. [Number] of [Year]\` - President's Orders

### Bengali Patterns
- \`[Year] সনের [Number] নং আইন\` - e.g., "১৯৯০ সনের ২০ নং আইন"
- \`[Year] সনের [Number] নং অধ্যাদেশ\` - e.g., "১৯৮৪ সনের ৩৬ নং অধ্যাদেশ"
- \`[Name] আইন, [Year] ([Year] সনের [Number] নং আইন)\` - Full Bengali citation

## Notes

1. **Internal ID vs Legal Citation**: The \`internal_id\` is the bdlaws database identifier, NOT the legal citation number. Legal citation parsing requires Phase 2 work.

2. **Marker Frequency vs Section Count**: The \`marker_frequency\` counts are raw string occurrences, not structural section counts. A "ধারা" count of 50 does not mean 50 sections.

3. **Cross-Reference Limitations**: Cross-references are pattern-detected, not semantically verified. False positives may occur.

4. **Content Preservation**: The \`content\` field preserves original text exactly as found, including any OCR errors or encoding issues in the source.
`;
  },

  /**
   * Check if extraction is idempotent by comparing content hashes
   * Requirements: 10.1, 10.3 - Extraction idempotency and source change detection
   * 
   * Compares the hash of new content with the existing hash in the manifest
   * to determine if the source has changed since last extraction.
   * 
   * @param {Object} manifest - The corpus manifest
   * @param {string} internalId - The internal_id of the act to check
   * @param {string} newContent - The new content to compare
   * @returns {Promise<Object>} Idempotency check result with isIdentical or source_changed flag
   */
  async checkExtractionIdempotency(manifest, internalId, newContent) {
    // Handle case where act doesn't exist in manifest
    if (!manifest || !manifest.acts || !manifest.acts[internalId]) {
      return { isNew: true };
    }

    const existing = manifest.acts[internalId];
    
    // If no existing hash, we can't compare
    if (!existing.content_hash) {
      return {
        isNew: false,
        isIdentical: false,
        message: 'No previous content hash available for comparison',
        flag: 'no_previous_hash'
      };
    }

    // Compute hash of new content
    const newHash = await this.computeContentHash(newContent);
    
    // If we couldn't compute the new hash, return error state
    if (!newHash) {
      return {
        isNew: false,
        isIdentical: false,
        message: 'Failed to compute hash for new content',
        flag: 'hash_computation_failed'
      };
    }

    // Compare hashes
    if (existing.content_hash === newHash) {
      return {
        isNew: false,
        isIdentical: true,
        message: 'Content unchanged from previous extraction',
        previousHash: existing.content_hash,
        newHash: newHash
      };
    } else {
      return {
        isNew: false,
        isIdentical: false,
        previousHash: existing.content_hash,
        newHash: newHash,
        message: 'Source content has changed since last extraction',
        flag: 'source_changed'
      };
    }
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawCorpusManifest;
}
