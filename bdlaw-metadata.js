/**
 * BDLawCorpus Metadata Generator Module
 * 
 * Generates and validates provenance metadata for academic legal text extraction.
 * Ensures all exports contain complete, traceable metadata for reproducible research.
 * 
 * @module bdlaw-metadata
 */

const BDLawMetadata = {
  /**
   * Required fields that must be present in every metadata object
   */
  REQUIRED_FIELDS: [
    'source',
    'source_url',
    'scraped_at',
    'extracted_at',
    'scraping_method',
    'tool',
    'tool_version',
    'browser_info',
    'language',
    'research_purpose'
  ],

  /**
   * Ethical disclaimer text included in all exports
   */
  DISCLAIMER: 'This tool performs manual extraction of publicly available legal texts for academic research. No automated crawling, modification, or interpretation is performed.',

  /**
   * Generate complete provenance metadata for an extraction
   * @param {string} url - The source URL being extracted (preserved exactly as provided)
   * @returns {Object} Complete metadata object with all required fields
   */
  generate(url) {
    const now = new Date().toISOString();

    // Capture browser identity for reproducibility documentation.
    // Peer reviewers require the exact browser version to assess rendering
    // determinism. navigator.userAgent is available in content scripts and
    // extension pages but NOT in service workers — falls back gracefully.
    let browserInfo = 'unknown';
    try {
      if (typeof navigator !== 'undefined' && navigator.userAgent) {
        browserInfo = navigator.userAgent;
      }
    } catch (_) {
      browserInfo = 'unavailable';
    }

    // Tool version sourced from manifest at runtime when available.
    let toolVersion = '1.3.0';
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
        toolVersion = chrome.runtime.getManifest().version;
      }
    } catch (_) {
      // Keep default version string
    }

    return {
      source: 'bdlaws.minlaw.gov.bd',
      source_url: url,            // Preserve original HTTP URL exactly
      scraped_at: now,
      extracted_at: now,          // Timestamp when data was extracted/exported
      scraping_method: 'manual page-level extraction',
      tool: 'BDLawCorpus',
      tool_version: toolVersion,  // Semantic version from manifest.json
      browser_info: browserInfo,  // Full user-agent string for reproducibility
      language: 'bn',
      research_purpose: 'academic legal corpus construction',
      robots_txt_status: 'not_present',  // bdlaws.minlaw.gov.bd returns 404 for robots.txt
      disclaimer: this.DISCLAIMER
    };
  },

  /**
   * Validate that a metadata object contains all required fields
   * @param {Object} metadata - The metadata object to validate
   * @returns {Object} Validation result with { valid: boolean, missing: string[] }
   */
  validate(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return {
        valid: false,
        missing: [...this.REQUIRED_FIELDS]
      };
    }

    const missing = [];
    
    for (const field of this.REQUIRED_FIELDS) {
      if (!(field in metadata) || metadata[field] === null || metadata[field] === undefined || metadata[field] === '') {
        missing.push(field);
      }
    }

    return {
      valid: missing.length === 0,
      missing: missing
    };
  },

  /**
   * Get the ethical disclaimer text
   * @returns {string} The disclaimer text
   */
  getDisclaimer() {
    return this.DISCLAIMER;
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawMetadata;
}
