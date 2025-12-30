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
    return {
      source: 'bdlaws.minlaw.gov.bd',
      source_url: url,  // Preserve original HTTP URL exactly
      scraped_at: now,
      extracted_at: now,  // Timestamp when data was extracted/exported
      scraping_method: 'manual page-level extraction',
      tool: 'BDLawCorpus',
      language: 'bn',
      research_purpose: 'academic legal corpus construction',
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
