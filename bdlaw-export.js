/**
 * BDLawCorpus Export Handler Module
 * 
 * Handles JSON formatting, file naming, validation, and download triggering
 * for academic legal text exports. Ensures UTF-8 encoding for Bengali characters.
 * 
 * @module bdlaw-export
 */

const BDLawExport = {
  /**
   * Format act content and metadata for export as JSON
   * Requirements: 12.1 - Act export structure with _metadata, title, act_number, content
   * Requirements: 23.6 - Include structured_sections array
   * Requirements: 24.7 - Include tables array with 2D data and merged cell flags
   * Requirements: 25.3 - Include amendments array with marker locations
   * 
   * @param {Object} content - The extracted content { title, content, sections, structured_sections, tables, amendments }
   * @param {Object} metadata - The provenance metadata object
   * @returns {string} JSON string with proper UTF-8 encoding
   */
  formatActExport(content, metadata) {
    if (!content || typeof content !== 'object') {
      content = { title: '', content: '', sections: { counts: {} } };
    }
    if (!metadata || typeof metadata !== 'object') {
      metadata = {};
    }

    const exportData = {
      _metadata: metadata,
      title: content.title || '',
      act_number: this._extractActNumber(metadata.source_url) || '',
      content: content.content || '',
      sections_detected: content.sections?.counts || {
        'ধারা': 0,
        'অধ্যায়': 0,
        'তফসিল': 0
      },
      // Requirements: 23.6 - Add structured_sections array to act export
      // Each section contains: index, section_title, section_body, has_table, amendments
      structured_sections: this._formatStructuredSections(content.structured_sections, content.amendments),
      // Requirements: 24.7 - Add tables array with 2D data and merged cell flags
      tables: this._formatTables(content.tables),
      // Requirements: 25.3 - Add amendments array with marker locations
      amendments: this._formatAmendments(content.amendments),
      // ============================================
      // DOM-FIRST STRUCTURE DERIVATION
      // Requirements: Legal Structure Derivation & Reference Anchoring
      // ============================================
      // Structure tree (DOM-derived JSON tree with sections, subsections, clauses)
      structure: content.structure || null,
      // Cross-references (DOM-anchored array with scope information)
      cross_references: content.cross_references_derived || []
    };

    // Use JSON.stringify with proper formatting for readability
    // UTF-8 encoding is handled natively by JavaScript strings
    return JSON.stringify(exportData, null, 2);
  },

  /**
   * Format volume data and metadata for export as JSON
   * Requirements: 12.2 - Volume export structure with _metadata and acts array
   * 
   * @param {Array} acts - Array of act metadata { title, year, actNumber, url }
   * @param {Object} metadata - The provenance metadata object
   * @returns {string} JSON string with proper UTF-8 encoding
   */
  formatVolumeExport(acts, metadata) {
    if (!Array.isArray(acts)) {
      acts = [];
    }
    if (!metadata || typeof metadata !== 'object') {
      metadata = {};
    }

    const volumeNumber = this._extractVolumeNumber(metadata.source_url) || '';

    const exportData = {
      _metadata: metadata,
      volume_number: volumeNumber,
      acts: acts.map(act => ({
        title: act.title || '',
        year: act.year || '',
        act_number: act.actNumber || act.act_number || '',
        url: act.url || ''
      })),
      total_count: acts.length
    };

    return JSON.stringify(exportData, null, 2);
  },

  /**
   * Generate filename for act export
   * Requirements: 12.4 - Filename format bdlaw_act_{act_number}_{timestamp}.json
   * 
   * @param {string} actNumber - The act number
   * @param {string|Date} timestamp - ISO timestamp or Date object
   * @returns {string} Formatted filename
   */
  generateActFilename(actNumber, timestamp) {
    const sanitizedActNumber = this._sanitizeForFilename(actNumber || 'unknown');
    const formattedTimestamp = this._formatTimestampForFilename(timestamp);
    
    return `bdlaw_act_${sanitizedActNumber}_${formattedTimestamp}.json`;
  },

  /**
   * Generate filename for volume export
   * Requirements: 12.4 - Filename format bdlaw_volume_{volume_number}_{timestamp}.json
   * 
   * @param {string} volumeNumber - The volume number
   * @param {string|Date} timestamp - ISO timestamp or Date object
   * @returns {string} Formatted filename
   */
  generateVolumeFilename(volumeNumber, timestamp) {
    const sanitizedVolumeNumber = this._sanitizeForFilename(volumeNumber || 'unknown');
    const formattedTimestamp = this._formatTimestampForFilename(timestamp);
    
    return `bdlaw_volume_${sanitizedVolumeNumber}_${formattedTimestamp}.json`;
  },

  /**
   * Validate JSON string structure
   * Requirements: 12.5 - Validate JSON structure before saving
   * 
   * @param {string} jsonString - The JSON string to validate
   * @returns {boolean} True if valid JSON, false otherwise
   */
  validateJSON(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
      return false;
    }

    try {
      const parsed = JSON.parse(jsonString);
      // Ensure it's an object (not null, array, or primitive)
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
    } catch (e) {
      return false;
    }
  },

  /**
   * Trigger file download using Chrome downloads API
   * Requirements: 12.3 - UTF-8 encoding for Bengali characters
   * 
   * @param {string} content - The content to download (JSON string)
   * @param {string} filename - The filename for the download
   * @returns {Promise<void>} Resolves when download is initiated
   */
  triggerDownload(content, filename) {
    return new Promise((resolve, reject) => {
      try {
        // Create a Blob with UTF-8 encoding for proper Bengali character support
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        // Check if chrome.downloads API is available (Chrome extension context)
        if (typeof chrome !== 'undefined' && chrome.downloads) {
          chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
          }, (downloadId) => {
            // Clean up the object URL after a delay
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(downloadId);
            }
          });
        } else {
          // Fallback for non-extension context (e.g., testing)
          // Create a download link and click it
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Clean up the object URL
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Format structured sections for export
   * Requirements: 23.6 - Preserve title-body association and document order
   * 
   * @private
   * @param {Array} structuredSections - Array of section objects from extraction
   * @param {Array} amendments - Array of amendment markers to associate with sections
   * @returns {Array} Formatted structured sections array
   */
  _formatStructuredSections(structuredSections, amendments) {
    if (!Array.isArray(structuredSections)) {
      return [];
    }

    const amendmentsList = Array.isArray(amendments) ? amendments : [];

    return structuredSections.map(section => {
      // Find amendments that belong to this section based on content matching
      const sectionAmendments = amendmentsList.filter(amendment => {
        // Check if the amendment's line appears in this section's body
        if (section.sectionBody && amendment.line) {
          return section.sectionBody.includes(amendment.line.trim());
        }
        return false;
      }).map(amendment => ({
        type: amendment.type || '',
        line_number: amendment.lineNumber || 0,
        position: amendment.position || 0,
        context: amendment.context || ''
      }));

      return {
        index: section.index !== undefined ? section.index : 0,
        section_title: section.sectionTitle || '',
        section_body: section.sectionBody || '',
        has_table: section.hasTable || false,
        amendments: sectionAmendments
      };
    });
  },

  /**
   * Format tables for export
   * Requirements: 24.7 - Export table data as 2D array preserving row and column positions
   * 
   * @private
   * @param {Array} tables - Array of table objects from extraction
   * @returns {Array} Formatted tables array
   */
  _formatTables(tables) {
    if (!Array.isArray(tables)) {
      return [];
    }

    return tables.map(table => ({
      section_index: table.sectionIndex !== undefined ? table.sectionIndex : 0,
      data: Array.isArray(table.data) ? table.data : [],
      has_merged_cells: table.hasMergedCells || false
    }));
  },

  /**
   * Format amendments for export
   * Requirements: 25.3 - Include amendments array with marker locations
   * 
   * @private
   * @param {Array} amendments - Array of amendment markers from detection
   * @returns {Array} Formatted amendments array
   */
  _formatAmendments(amendments) {
    if (!Array.isArray(amendments)) {
      return [];
    }

    return amendments.map(amendment => ({
      type: amendment.type || '',
      line_number: amendment.lineNumber || 0,
      context: amendment.context || ''
    }));
  },

  /**
   * Extract act number from URL
   * @private
   * @param {string} url - The source URL
   * @returns {string|null} The act number or null
   */
  _extractActNumber(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }
    const match = url.match(/act-(?:details-)?(\d+)\.html/);
    return match ? match[1] : null;
  },

  /**
   * Extract volume number from URL
   * @private
   * @param {string} url - The source URL
   * @returns {string|null} The volume number or null
   */
  _extractVolumeNumber(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }
    const match = url.match(/volume-(\d+)\.html/);
    return match ? match[1] : null;
  },

  /**
   * Sanitize a string for use in filename
   * @private
   * @param {string} str - The string to sanitize
   * @returns {string} Sanitized string safe for filenames
   */
  _sanitizeForFilename(str) {
    if (!str || typeof str !== 'string') {
      return 'unknown';
    }
    // Remove or replace characters that are invalid in filenames
    return str.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'unknown';
  },

  /**
   * Format timestamp for filename (removes colons and special chars)
   * @private
   * @param {string|Date} timestamp - ISO timestamp or Date object
   * @returns {string} Formatted timestamp safe for filenames
   */
  _formatTimestampForFilename(timestamp) {
    let date;
    
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = new Date();
    }

    if (isNaN(date.getTime())) {
      date = new Date();
    }

    // Format: YYYYMMDD_HHmmss
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawExport;
}
