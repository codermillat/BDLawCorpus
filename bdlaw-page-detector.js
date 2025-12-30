/**
 * BDLawCorpus Page Type Detector Module
 * 
 * Detects the page type and layer of bdlaws.minlaw.gov.bd URLs.
 * Enforces domain restriction to only the official Bangladesh Laws website.
 * 
 * @module bdlaw-page-detector
 */

const BDLawPageDetector = {
  /**
   * The only allowed origin for extraction
   */
  ALLOWED_ORIGIN: 'http://bdlaws.minlaw.gov.bd',

  /**
   * URL patterns for each page type
   * Note: ACT_DETAILS must be checked before ACT_SUMMARY due to pattern overlap
   */
  URL_PATTERNS: {
    RANGE_INDEX: /\/laws-of-bangladesh\.html$/,
    VOLUME: /\/volume-\d+\.html$/,
    ACT_DETAILS: /\/act-details-\d+\.html$/,
    ACT_SUMMARY: /\/act-(?!details)\d+\.html$/,  // Negative lookahead to exclude act-details
    CHRONOLOGICAL_INDEX: /\/laws-of-bangladesh-chronological-index\.html$/,
    ALPHABETICAL_INDEX: /\/laws-of-bangladesh-alphabetical-index\.html$/
  },

  /**
   * Page type constants
   */
  PAGE_TYPES: {
    RANGE_INDEX: 'range_index',              // Layer 1
    VOLUME: 'volume',                        // Layer 2
    ACT_DETAILS: 'act_details',              // Layer 3
    ACT_SUMMARY: 'act_summary',              // Intermediate
    CHRONOLOGICAL_INDEX: 'chronological_index',  // Alternative catalog
    ALPHABETICAL_INDEX: 'alphabetical_index',    // Alternative catalog
    UNSUPPORTED: 'unsupported',
    INVALID_DOMAIN: 'invalid_domain'
  },

  /**
   * Check if a URL belongs to the allowed domain
   * @param {string} url - The URL to check
   * @returns {boolean} True if the URL is from bdlaws.minlaw.gov.bd
   */
  isAllowedDomain(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    try {
      // Handle URLs that might not have a protocol
      const normalizedUrl = url.startsWith('http') ? url : `http://${url}`;
      const urlObj = new URL(normalizedUrl);
      
      // Check if the origin matches exactly (including protocol)
      return url.startsWith(this.ALLOWED_ORIGIN);
    } catch (e) {
      return false;
    }
  },

  /**
   * Detect the page type from a URL
   * Detection order: ACT_DETAILS checked before ACT_SUMMARY to prevent overlap
   * Index pages checked before RANGE_INDEX to prevent false matches
   * 
   * @param {string} url - The URL to analyze
   * @returns {string} One of PAGE_TYPES values
   */
  detectPageType(url) {
    if (!url || typeof url !== 'string') {
      return this.PAGE_TYPES.INVALID_DOMAIN;
    }

    // First check domain restriction
    if (!this.isAllowedDomain(url)) {
      return this.PAGE_TYPES.INVALID_DOMAIN;
    }

    // Extract the path from the URL
    let path;
    try {
      const urlObj = new URL(url);
      path = urlObj.pathname;
    } catch (e) {
      return this.PAGE_TYPES.UNSUPPORTED;
    }

    // Check index patterns first (more specific than RANGE_INDEX)
    if (this.URL_PATTERNS.CHRONOLOGICAL_INDEX.test(path)) {
      return this.PAGE_TYPES.CHRONOLOGICAL_INDEX;
    }
    
    if (this.URL_PATTERNS.ALPHABETICAL_INDEX.test(path)) {
      return this.PAGE_TYPES.ALPHABETICAL_INDEX;
    }

    // Check patterns in specific order (ACT_DETAILS before ACT_SUMMARY)
    if (this.URL_PATTERNS.RANGE_INDEX.test(path)) {
      return this.PAGE_TYPES.RANGE_INDEX;
    }
    
    if (this.URL_PATTERNS.VOLUME.test(path)) {
      return this.PAGE_TYPES.VOLUME;
    }
    
    // ACT_DETAILS must be checked before ACT_SUMMARY
    if (this.URL_PATTERNS.ACT_DETAILS.test(path)) {
      return this.PAGE_TYPES.ACT_DETAILS;
    }
    
    if (this.URL_PATTERNS.ACT_SUMMARY.test(path)) {
      return this.PAGE_TYPES.ACT_SUMMARY;
    }

    return this.PAGE_TYPES.UNSUPPORTED;
  },

  /**
   * Get the layer number for a page type
   * @param {string} pageType - One of PAGE_TYPES values
   * @returns {number|null} Layer number (1, 2, or 3) or null if not applicable
   */
  getLayerNumber(pageType) {
    switch (pageType) {
      case this.PAGE_TYPES.RANGE_INDEX:
        return 1;
      case this.PAGE_TYPES.VOLUME:
      case this.PAGE_TYPES.CHRONOLOGICAL_INDEX:
      case this.PAGE_TYPES.ALPHABETICAL_INDEX:
        return 2;  // Index pages are catalog sources like volumes
      case this.PAGE_TYPES.ACT_DETAILS:
        return 3;
      default:
        return null;
    }
  },

  /**
   * Get a human-readable label for a page type
   * @param {string} pageType - One of PAGE_TYPES values
   * @returns {string} Human-readable label
   */
  getPageTypeLabel(pageType) {
    switch (pageType) {
      case this.PAGE_TYPES.RANGE_INDEX:
        return 'Range Index (Layer 1)';
      case this.PAGE_TYPES.VOLUME:
        return 'Volume Index (Layer 2)';
      case this.PAGE_TYPES.CHRONOLOGICAL_INDEX:
        return 'Chronological Index (Catalog)';
      case this.PAGE_TYPES.ALPHABETICAL_INDEX:
        return 'Alphabetical Index (Catalog)';
      case this.PAGE_TYPES.ACT_DETAILS:
        return 'Act Details (Layer 3)';
      case this.PAGE_TYPES.ACT_SUMMARY:
        return 'Act Summary (Navigate to Details)';
      case this.PAGE_TYPES.UNSUPPORTED:
        return 'Unsupported Page';
      case this.PAGE_TYPES.INVALID_DOMAIN:
        return 'Invalid Domain';
      default:
        return 'Unknown';
    }
  },

  /**
   * Check if a page type is a catalog source (can queue acts)
   * @param {string} pageType - One of PAGE_TYPES values
   * @returns {boolean} True if the page type can be used to queue acts
   */
  isCatalogSource(pageType) {
    return pageType === this.PAGE_TYPES.VOLUME ||
           pageType === this.PAGE_TYPES.CHRONOLOGICAL_INDEX ||
           pageType === this.PAGE_TYPES.ALPHABETICAL_INDEX;
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawPageDetector;
}
