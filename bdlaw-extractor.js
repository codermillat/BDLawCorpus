/**
 * BDLawCorpus Legal Extractor Module
 * 
 * Extracts legal content from bdlaws.minlaw.gov.bd pages using hardcoded selectors.
 * Detects Bengali section markers (ধারা, অধ্যায়, তফসিল) for legal document structure.
 * Preserves original Bengali text without modification.
 * 
 * IMPORTANT: This module extracts browser-rendered DOM text, NOT raw HTML or HTTP response bytes.
 * The extraction method is element.textContent only. innerText is strictly forbidden.
 * 
 * @module bdlaw-extractor
 */

const BDLawExtractor = {
  // ============================================
  // ARCHIVAL CAPTURE METADATA (RESEARCH INTEGRITY)
  // These constants define the exact nature of what is captured
  // ============================================

  /**
   * HTML capture definition - describes exactly what content_raw represents
   * CRITICAL: This is NOT raw HTML, NOT HTTP response bytes
   */
  HTML_CAPTURE_DEFINITION: 'Browser-rendered DOM text nodes',
  
  /**
   * DOM extraction method - ONLY textContent is permitted
   * innerText is STRICTLY FORBIDDEN (layout-dependent, non-deterministic)
   */
  DOM_EXTRACTION_METHOD: 'textContent',
  
  /**
   * Capture environment metadata
   */
  CAPTURE_ENVIRONMENT: {
    browser: 'Chrome',
    browser_engine: 'Blink',
    extraction_api: 'element.textContent',
    innerText_forbidden: true
  },

  /**
   * content_raw disclaimer - MUST be included in every export
   * Clarifies that content_raw is NOT byte-identical to server response
   */
  CONTENT_RAW_DISCLAIMER: 'Represents browser-parsed DOM text via textContent, not raw HTML or server response bytes',

  /**
   * Reference semantics - downgrades cross-references to string-level mentions only
   * NO legal relationship, effect, direction, or applicability is implied
   */
  REFERENCE_SEMANTICS: 'string_match_only',
  REFERENCE_WARNING: 'Keywords detected in proximity to citation strings. No legal relationship, effect, direction, or applicability is implied.',

  /**
   * Negation handling - classification suppression only, no legal interpretation
   */
  NEGATION_HANDLING: 'classification_suppression_only',

  /**
   * Numeric integrity - best effort only, HTML source limitations apply
   */
  NUMERIC_INTEGRITY: 'best_effort_html_only',
  NUMERIC_WARNING: 'Numeric expressions may be incomplete or malformed due to HTML source limitations',

  /**
   * ML usage warning - replaces safe_for_ml_training boolean
   * NO guarantees, exploratory use only
   */
  ML_USAGE_WARNING: 'HTML artifacts, encoding noise, and structural gaps are present; suitable only for exploratory retrieval and analysis. Not validated for training or evaluation.',

  /**
   * Encoding policy - HTML rendering artifacts, not errors
   */
  ENCODING_POLICY: 'preserve_html_artifacts',
  ENCODING_SCOPE: 'non-semantic, display-only',

  /**
   * Trust boundary - MUST be included in every export
   * Defines exactly what can and cannot be trusted
   */
  TRUST_BOUNDARY: {
    can_trust: [
      'Text appeared on bdlaws HTML pages at extraction time',
      'No semantic rewriting was applied',
      'Transformations are logged'
    ],
    must_not_trust: [
      'Legal validity',
      'Gazette equivalence', 
      'Completeness',
      'Numerical accuracy',
      'Amendment correctness',
      'Post-extraction relevance'
    ]
  },

  /**
   * Reproducibility statement for corpus-level documentation
   */
  REPRODUCIBILITY_STATEMENT: 'This dataset is an archival snapshot captured via a browser-based workflow. Exact reproduction is not guaranteed due to browser rendering, JavaScript execution, and manual navigation.',

  // ============================================
  // TRANSFORMATION AUDIT SYSTEM
  // Requirements: 2.1-2.5 - Legal Integrity Enhancement
  // ============================================

  /**
   * Risk level classification for transformations
   * Requirements: 2.2, 2.3 - Risk Level Classification
   * 
   * Non-semantic transformations (safe to apply):
   * - Encoding fixes that don't change meaning
   * - HTML entity decoding
   * - Unicode normalization
   * 
   * Potential-semantic transformations (flag only, do not apply):
   * - OCR corrections that change words
   * - Spelling corrections
   * - Punctuation changes
   */
  RISK_CLASSIFICATION: {
    // Non-semantic (safe to apply) - Requirements: 2.2
    'mojibake': 'non-semantic',
    'html_entity': 'non-semantic',
    'broken_unicode': 'non-semantic',
    'unicode_normalization': 'non-semantic',
    'encoding_fix': 'non-semantic',
    
    // Potential-semantic (flag only, do not apply) - Requirements: 2.3
    'ocr_word_correction': 'potential-semantic',
    'ocr_correction': 'potential-semantic',
    'spelling_correction': 'potential-semantic',
    'punctuation_change': 'potential-semantic',
    'word_substitution': 'potential-semantic'
  },

  /**
   * Create an empty transformation log
   * Requirements: 2.1, 2.5 - Transformation Audit Logging
   * 
   * @returns {Array} Empty transformation log array
   */
  createTransformationLog() {
    return [];
  },

  /**
   * Log a transformation with risk assessment
   * Requirements: 2.1, 2.4, 2.5 - Transformation Audit Logging
   * 
   * Records every transformation with:
   * - transformation_type: Type of transformation applied
   * - original: Original text before transformation
   * - corrected: Text after transformation (or proposed correction)
   * - position: Character offset in content_raw
   * - risk_level: "non-semantic" or "potential-semantic"
   * - applied: true if applied, false if flag-only mode
   * - timestamp: ISO timestamp of when transformation was logged
   * 
   * CRITICAL: If risk_level is "potential-semantic", applied MUST be false
   * and the transformation should NOT be applied to content_corrected.
   * 
   * @param {Array} transformationLog - The log array to append to
   * @param {Object} entry - Transformation entry with type, original, corrected, position
   * @returns {boolean} Whether the transformation should be applied (true for non-semantic only)
   */
  logTransformation(transformationLog, entry) {
    // Validate required fields
    if (!transformationLog || !Array.isArray(transformationLog)) {
      return false;
    }
    
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    // Extract entry fields with defaults
    const transformationType = entry.transformation_type || 'unknown';
    const original = entry.original !== undefined ? String(entry.original) : '';
    const corrected = entry.corrected !== undefined ? String(entry.corrected) : '';
    const position = typeof entry.position === 'number' ? entry.position : 0;

    // Determine risk level from classification mapping
    // Requirements: 2.2, 2.3 - Risk Level Classification
    const riskLevel = this.RISK_CLASSIFICATION[transformationType] || 'potential-semantic';

    // Requirements: 2.4 - Flag-only mode for potential-semantic
    // If risk_level is "potential-semantic", applied MUST be false
    const shouldApply = riskLevel === 'non-semantic';

    // Create the complete log entry
    // Requirements: 2.1, 2.5 - Include all required fields
    const logEntry = {
      transformation_type: transformationType,
      original: original,
      corrected: corrected,
      position: position,
      risk_level: riskLevel,
      applied: shouldApply,
      timestamp: new Date().toISOString()
    };

    // Append to transformation log
    transformationLog.push(logEntry);

    // Return whether the transformation should be applied
    // Requirements: 2.4 - Only non-semantic transformations are applied
    return shouldApply;
  },

  /**
   * Get risk level for a transformation type
   * Requirements: 2.2, 2.3 - Risk Level Classification
   * 
   * @param {string} transformationType - The type of transformation
   * @returns {string} Risk level: "non-semantic" or "potential-semantic"
   */
  getRiskLevel(transformationType) {
    return this.RISK_CLASSIFICATION[transformationType] || 'potential-semantic';
  },

  /**
   * Check if a transformation type is safe to apply
   * Requirements: 2.4 - Flag-only mode for potential-semantic
   * 
   * @param {string} transformationType - The type of transformation
   * @returns {boolean} True if safe to apply (non-semantic), false otherwise
   */
  isTransformationSafe(transformationType) {
    return this.getRiskLevel(transformationType) === 'non-semantic';
  },

  /**
   * Apply a transformation to content_corrected if safe, otherwise flag only
   * Requirements: 2.4 - Flag-only mode for potential-semantic transformations
   * 
   * This function implements the flag-only mode:
   * - If transformation is non-semantic: apply to content_corrected and log with applied=true
   * - If transformation is potential-semantic: do NOT modify content_corrected, log with applied=false
   * 
   * @param {Object} threeVersionContent - The three-version content object
   * @param {Array} transformationLog - The transformation log array
   * @param {Object} transformation - The transformation to apply {type, original, corrected, position}
   * @returns {Object} Updated three-version content (content_corrected may be modified)
   */
  applyTransformation(threeVersionContent, transformationLog, transformation) {
    if (!threeVersionContent || !transformationLog || !transformation) {
      return threeVersionContent;
    }

    // Log the transformation and get whether it should be applied
    const shouldApply = this.logTransformation(transformationLog, {
      transformation_type: transformation.type,
      original: transformation.original,
      corrected: transformation.corrected,
      position: transformation.position
    });

    // Requirements: 2.4 - Only apply non-semantic transformations
    if (shouldApply && threeVersionContent.content_corrected) {
      // Apply the transformation to content_corrected
      const before = threeVersionContent.content_corrected.substring(0, transformation.position);
      const after = threeVersionContent.content_corrected.substring(
        transformation.position + transformation.original.length
      );
      threeVersionContent.content_corrected = before + transformation.corrected + after;
    }
    // If shouldApply is false (potential-semantic), content_corrected is NOT modified
    // The transformation is logged with applied=false (flag-only mode)

    return threeVersionContent;
  },

  /**
   * Get all flagged (not applied) transformations from a log
   * Requirements: 2.4 - Identify potential-semantic transformations that were flagged
   * 
   * @param {Array} transformationLog - The transformation log array
   * @returns {Array} Array of transformations where applied=false
   */
  getFlaggedTransformations(transformationLog) {
    if (!transformationLog || !Array.isArray(transformationLog)) {
      return [];
    }
    return transformationLog.filter(entry => entry.applied === false);
  },

  /**
   * Get all applied transformations from a log
   * Requirements: 2.5 - Identify non-semantic transformations that were applied
   * 
   * @param {Array} transformationLog - The transformation log array
   * @returns {Array} Array of transformations where applied=true
   */
  getAppliedTransformations(transformationLog) {
    if (!transformationLog || !Array.isArray(transformationLog)) {
      return [];
    }
    return transformationLog.filter(entry => entry.applied === true);
  },

  // ============================================
  // PROTECTED SECTION DETECTION
  // Requirements: 17.1-17.7 - Legal Integrity Enhancement
  // ============================================

  /**
   * Protected section patterns for detecting legally sensitive sections
   * Requirements: 17.1, 17.2, 17.3 - Detect definitions, provisos, and explanations
   * 
   * These sections are SACROSANCT - no OCR correction, no cleanup.
   * Only Unicode normalization is permitted. Flag-only detection for OCR artifacts.
   */
  PROTECTED_SECTION_PATTERNS: {
    // Requirements: 17.1 - Definition sections (সংজ্ঞা, "definition", "means")
    definitions: [
      /সংজ্ঞা/g,                                    // Bengali "definition"
      /\bdefinition[s]?\b/gi,                       // English "definition(s)"
      /\bmeans\b/gi,                                // "means" (common in definitions)
      /"[^"]+"\s+(?:means|অর্থ)/gi,                 // Quoted term followed by "means" or Bengali "meaning"
      /অর্থ\s+হইবে/g,                               // Bengali "shall mean"
      /বলিতে\s+বুঝাইবে/g                            // Bengali "shall be understood as"
    ],
    // Requirements: 17.2 - Proviso sections (তবে শর্ত, "Provided that")
    proviso: [
      /তবে শর্ত/g,                                  // Bengali "Provided that"
      /\bProvided\s+that\b/gi,                      // English "Provided that"
      /\bproviso\b/gi,                              // English "proviso"
      /শর্ত\s+থাকে\s+যে/g,                          // Bengali "subject to the condition that"
      /এই\s+শর্তে\s+যে/g                            // Bengali "on the condition that"
    ],
    // Requirements: 17.3 - Explanation sections (ব্যাখ্যা, "Explanation")
    explanation: [
      /ব্যাখ্যা/g,                                  // Bengali "Explanation"
      /\bExplanation\b/gi,                          // English "Explanation"
      /\bNote\b/gi,                                 // "Note" (often used similarly)
      /দ্রষ্টব্য/g                                   // Bengali "Note"
    ]
  },

  /**
   * Merge overlapping protected regions into consolidated regions
   * Requirements: 17.4 - Ensure protected sections are properly bounded
   * 
   * @param {Array} regions - Array of {start, end, type, marker} objects
   * @returns {Array} Merged array with no overlapping regions
   */
  mergeOverlappingProtectedRegions(regions) {
    if (!regions || regions.length === 0) {
      return [];
    }

    // Sort by start position
    const sorted = [...regions].sort((a, b) => a.start - b.start);
    const merged = [{ ...sorted[0] }];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];

      // Check if current overlaps with or is adjacent to last
      if (current.start <= last.end + 1) {
        // Merge: extend the end if needed, combine types
        last.end = Math.max(last.end, current.end);
        // Combine types if different
        if (last.type !== current.type && !last.type.includes(current.type)) {
          last.type = `${last.type},${current.type}`;
        }
        // Combine markers if different
        if (current.marker && last.marker !== current.marker) {
          last.marker = last.marker + ', ' + current.marker;
        }
      } else {
        // No overlap, add as new region
        merged.push({ ...current });
      }
    }

    return merged;
  },

  /**
   * Detect protected sections in content
   * Requirements: 17.1, 17.2, 17.3, 17.4 - Protected Section Detection
   * 
   * Detects sections containing:
   * - Definition sections (সংজ্ঞা, "definition", "means")
   * - Proviso sections (তবে শর্ত, "Provided that")
   * - Explanation sections (ব্যাখ্যা, "Explanation")
   * 
   * Returns object with:
   * - protected_sections: Array of detected section types
   * - regions: Array of {start, end, type, marker} for each protected region
   * 
   * These sections are SACROSANCT - no OCR correction allowed.
   * Only Unicode normalization is permitted within these regions.
   * 
   * @param {string} content - Content to analyze
   * @returns {Object} {protected_sections: string[], regions: Array<{start, end, type, marker}>}
   */
  detectProtectedSections(content) {
    if (!content || typeof content !== 'string') {
      return {
        protected_sections: [],
        regions: []
      };
    }

    const sections = new Set();
    const regions = [];

    // Iterate through all pattern categories
    for (const [sectionType, patterns] of Object.entries(this.PROTECTED_SECTION_PATTERNS)) {
      for (const pattern of patterns) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        
        // Create fresh regex to avoid state issues
        const freshPattern = new RegExp(pattern.source, pattern.flags);
        let match;

        while ((match = freshPattern.exec(content)) !== null) {
          sections.add(sectionType);
          
          // Extend region to include surrounding context
          // For definitions: extend forward to capture the full definition (up to 200 chars)
          // For provisos/explanations: extend forward to capture the full clause
          const regionStart = Math.max(0, match.index - 50);
          const regionEnd = Math.min(content.length, match.index + match[0].length + 200);
          
          regions.push({
            type: sectionType,
            start: regionStart,
            end: regionEnd,
            marker: match[0]
          });
        }
      }
    }

    // Merge overlapping regions
    const mergedRegions = this.mergeOverlappingProtectedRegions(regions);

    return {
      protected_sections: Array.from(sections),
      regions: mergedRegions
    };
  },

  /**
   * Check if a position falls within any protected section
   * Requirements: 17.5 - Position checking for protected section enforcement
   * 
   * Used by OCR correction functions to determine if a transformation
   * should be skipped because it falls within a protected section.
   * 
   * @param {number} position - Character position to check
   * @param {Array} protectedRegions - Array of protected regions from detectProtectedSections
   * @returns {boolean} True if position is within a protected section
   */
  isInProtectedSection(position, protectedRegions) {
    if (typeof position !== 'number' || !protectedRegions || !Array.isArray(protectedRegions)) {
      return false;
    }

    return protectedRegions.some(region => 
      position >= region.start && position < region.end
    );
  },

  /**
   * Check if a range overlaps with any protected section
   * Requirements: 17.5 - Range checking for protected section enforcement
   * 
   * Used to check if a transformation's affected range overlaps
   * with any protected section.
   * 
   * @param {number} start - Start position of range
   * @param {number} end - End position of range
   * @param {Array} protectedRegions - Array of protected regions from detectProtectedSections
   * @returns {boolean} True if range overlaps with any protected section
   */
  rangeOverlapsProtectedSection(start, end, protectedRegions) {
    if (typeof start !== 'number' || typeof end !== 'number' || 
        !protectedRegions || !Array.isArray(protectedRegions)) {
      return false;
    }

    return protectedRegions.some(region => 
      // Check if ranges overlap: not (end1 <= start2 or end2 <= start1)
      !(end <= region.start || region.end <= start)
    );
  },

  // ============================================
  // NEGATION-AWARE REFERENCE CLASSIFICATION
  // Requirements: 4.1-4.4, 5.1-5.5 - Legal Integrity Enhancement
  // ============================================

  /**
   * Check for negation context within a window around a position
   * Requirements: 4.1, 4.2 - Negation Context Detection
   * 
   * Searches for Bengali negation words (না, নয়, নহে, নাই, নেই, ব্যতীত, ছাড়া)
   * within ±window characters of the specified position.
   * 
   * CRITICAL: If negation is present, the lexical_relation_type MUST be forced
   * to "mention" regardless of other keywords present.
   * 
   * @param {string} content - Full content text
   * @param {number} position - Citation position to check around
   * @param {number} window - Characters to check before and after (default ±20)
   * @returns {Object} {negation_present, negation_word, negation_position, negation_context}
   */
  checkNegationContext(content, position, window = 20) {
    // Validate inputs
    if (!content || typeof content !== 'string') {
      return { negation_present: false };
    }
    
    if (typeof position !== 'number' || position < 0) {
      return { negation_present: false };
    }

    // Calculate context window bounds
    const start = Math.max(0, position - window);
    const end = Math.min(content.length, position + window);
    const context = content.substring(start, end);

    // Sort negation words by length (longest first) to avoid substring matching issues
    // e.g., "নাই" should be matched before "না" since "না" is a substring of "নাই"
    const sortedNegationWords = [...this.NEGATION_WORDS].sort((a, b) => b.length - a.length);

    // Search for each negation word in the context
    for (const word of sortedNegationWords) {
      const idx = context.indexOf(word);
      if (idx !== -1) {
        return {
          negation_present: true,
          negation_word: word,
          negation_position: start + idx,
          negation_context: context
        };
      }
    }

    return { negation_present: false };
  },

  /**
   * Classify lexical relation type with negation awareness
   * Requirements: 4.3, 4.4, 5.1 - Negation-Aware Classification
   * 
   * CRITICAL RULES:
   * 1. If negation is present, ALWAYS return "mention" regardless of other keywords
   * 2. Negation OVERRIDES all other classification keywords
   * 3. This is a LEXICAL relation, not a legal relationship
   * 
   * @param {string} contextText - Text surrounding the citation
   * @param {Object} negationCheck - Result from checkNegationContext
   * @returns {Object} {lexical_relation_type, negation_present, negation_word?, negation_context?, classification_note?}
   */
  classifyLexicalRelation(contextText, negationCheck) {
    // If negation is present, ALWAYS return "mention"
    // Requirements: 4.3, 4.4 - Negation overrides all other keywords
    if (negationCheck && negationCheck.negation_present) {
      return {
        lexical_relation_type: 'mention',
        negation_present: true,
        negation_word: negationCheck.negation_word,
        negation_context: negationCheck.negation_context,
        classification_note: 'Negation detected - forced to mention type'
      };
    }

    // No negation - use keyword-based classification
    const type = this._detectLexicalRelationType(contextText);

    return {
      lexical_relation_type: type,
      negation_present: false
    };
  },

  /**
   * Detect lexical relation type from keywords (internal, no negation check)
   * Requirements: 5.1 - Lexical Relation Type Detection
   * 
   * @param {string} contextText - Text surrounding the citation
   * @returns {string} Lexical relation type: 'amendment', 'repeal', 'substitution', 'dependency', 'incorporation', or 'mention'
   */
  _detectLexicalRelationType(contextText) {
    if (!contextText) {
      return 'mention';
    }

    const lowerContext = contextText.toLowerCase();

    // Check each lexical relation type in priority order
    for (const [relationType, keywords] of Object.entries(this.LEXICAL_RELATION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (contextText.includes(keyword) || lowerContext.includes(keyword.toLowerCase())) {
          return relationType;
        }
      }
    }

    return 'mention'; // Default type when no classification keyword found
  },

  // ============================================
  // LEXICAL RELATION CONFIDENCE
  // Requirements: 16.1-16.5 - Legal Integrity Enhancement
  // ============================================

  /**
   * Assign confidence level to a lexical relation based on pattern clarity
   * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5 - Lexical Relation Confidence
   * 
   * Confidence levels are based purely on pattern clarity, NOT semantic interpretation:
   * - "high": Full citation pattern matches (act_name + citation_year + citation_serial)
   *   e.g., "Income Tax Ordinance, 1984 (XXXVI of 1984)"
   * - "medium": Partial pattern matches (citation_year + citation_serial, but no act_name)
   *   e.g., "Act XV of 1984" or "১৯৮৪ সনের ১৫ নং আইন"
   * - "low": Ambiguous patterns or context unclear
   *   e.g., only year mentioned, or pattern partially matched
   * 
   * IMPORTANT: Confidence is based on pattern clarity only, not semantic interpretation.
   * This is a LEXICAL confidence measure, not a legal validity measure.
   * 
   * @param {Object} citation - Detected citation object with extracted components
   * @returns {string} Confidence level: 'high', 'medium', or 'low'
   */
  assignLexicalConfidence(citation) {
    // Validate input
    if (!citation || typeof citation !== 'object') {
      return 'low';
    }

    // Check for full citation pattern (name + year + serial)
    // Requirements: 16.2 - "high" confidence for full citation
    const hasActName = citation.act_name && 
                       typeof citation.act_name === 'string' && 
                       citation.act_name.trim().length > 0;
    
    const hasYear = citation.citation_year && 
                    (typeof citation.citation_year === 'string' || typeof citation.citation_year === 'number') &&
                    String(citation.citation_year).length > 0;
    
    const hasSerial = citation.citation_serial && 
                      (typeof citation.citation_serial === 'string' || typeof citation.citation_serial === 'number') &&
                      String(citation.citation_serial).length > 0;

    // Requirements: 16.2 - High confidence: full citation (name + year + serial)
    if (hasActName && hasYear && hasSerial) {
      return 'high';
    }

    // Requirements: 16.3 - Medium confidence: partial pattern (year + serial)
    if (hasYear && hasSerial) {
      return 'medium';
    }

    // Requirements: 16.4 - Low confidence: ambiguous or incomplete pattern
    // This includes: only year, only serial, only name, or no components
    return 'low';
  },

  // ============================================
  // NUMERIC REGION PROTECTION
  // Requirements: 3.1-3.7 - Legal Integrity Enhancement
  // ============================================

  /**
   * Numeric region detection patterns
   * Requirements: 3.1-3.4 - Detect currency, percentage, rate, and table patterns
   * 
   * These patterns identify legally sensitive numeric regions where
   * no OCR correction, encoding repair, or formatting should be applied.
   * Only Unicode normalization is permitted in these regions.
   */
  NUMERIC_PATTERNS: {
    // Requirements: 3.1 - Currency patterns (৳, $, Tk, টাকা)
    currency: [
      /৳\s*[\d০-৯,\.]+/g,           // Bengali Taka symbol with numbers
      /টাকা\s*[\d০-৯,\.]+/g,        // "Taka" word with numbers
      /[\d০-৯,\.]+\s*টাকা/g,        // Numbers followed by "Taka"
      /Tk\.?\s*[\d,\.]+/gi,          // English Tk abbreviation
      /\$\s*[\d,\.]+/g,              // Dollar symbol
      /[\d,\.]+\s*(?:taka|rupees?)/gi // Numbers followed by currency words
    ],
    // Requirements: 3.2 - Percentage patterns (%, শতাংশ)
    percentage: [
      /[\d০-৯]+(?:\.[\d০-৯]+)?\s*%/g,           // Numbers with % symbol
      /[\d০-৯]+(?:\.[\d০-৯]+)?\s*শতাংশ/g,       // Numbers with Bengali "percent"
      /[\d০-৯]+(?:\.[\d০-৯]+)?\s*percent/gi,    // Numbers with English "percent"
      /[\d০-৯]+(?:\.[\d০-৯]+)?\s*per\s*cent/gi  // Numbers with "per cent"
    ],
    // Requirements: 3.3 - Rate patterns (per annum, হার)
    rate: [
      /[\d০-৯]+(?:\.[\d০-৯]+)?\s*(?:per\s+annum|p\.?a\.?)/gi,  // Per annum rates
      /[\d০-৯]+(?:\.[\d০-৯]+)?\s*বার্ষিক/g,                     // Bengali annual rate
      /[\d০-৯]+(?:\.[\d০-৯]+)?\s*হার/g,                         // Bengali "rate"
      /rate\s+of\s+[\d০-৯]+(?:\.[\d০-৯]+)?/gi,                  // "rate of X"
      /interest\s+(?:rate\s+)?(?:of\s+)?[\d০-৯]+(?:\.[\d০-৯]+)?/gi, // Interest rate
      /সুদের?\s*হার\s*[\d০-৯]+(?:\.[\d০-৯]+)?/g                 // Bengali interest rate
    ],
    // Requirements: 3.4 - Table and schedule markers
    table_schedule: [
      /<table[\s\S]*?<\/table>/gi,              // HTML table elements
      /তফসিল/g,                                  // Bengali "Schedule"
      /Schedule\s*[IVXLCDM\d]+/gi,              // Schedule with Roman/Arabic numerals
      /Appendix\s*[A-Z\d]*/gi,                  // Appendix markers
      /Form\s*[A-Z\d]+/gi,                      // Form markers
      /Table\s*[IVXLCDM\d]+/gi                  // Table with numerals
    ]
  },

  /**
   * Merge overlapping regions into consolidated regions
   * Requirements: 3.5 - Ensure numeric regions are properly bounded
   * 
   * @param {Array} regions - Array of {start, end, type} objects
   * @returns {Array} Merged array with no overlapping regions
   */
  mergeOverlappingRegions(regions) {
    if (!regions || regions.length === 0) {
      return [];
    }

    // Sort by start position
    const sorted = [...regions].sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];

      // Check if current overlaps with or is adjacent to last
      if (current.start <= last.end + 1) {
        // Merge: extend the end if needed, combine types
        last.end = Math.max(last.end, current.end);
        // Combine types if different
        if (last.type !== current.type) {
          last.type = last.type.includes(current.type) ? last.type : `${last.type},${current.type}`;
        }
        // Combine text if available
        if (current.text && !last.text.includes(current.text)) {
          last.text = last.text + ' ' + current.text;
        }
      } else {
        // No overlap, add as new region
        merged.push(current);
      }
    }

    return merged;
  },

  /**
   * Detect numeric-sensitive regions in content
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - Numeric Region Detection
   * 
   * Detects regions containing:
   * - Currency patterns (৳, টাকা, Tk, $)
   * - Percentage patterns (%, শতাংশ)
   * - Rate patterns (per annum, হার)
   * - Table/schedule markers
   * 
   * Returns array of regions with start, end, type, and numeric_integrity_sensitive flag.
   * These regions should be protected from OCR correction, encoding repair, and formatting.
   * Only Unicode normalization is permitted within these regions.
   * 
   * @param {string} content - Content to analyze
   * @returns {Array} Array of {start, end, type, text, numeric_integrity_sensitive: true}
   */
  detectNumericRegions(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const regions = [];

    // Iterate through all pattern categories
    for (const [type, patterns] of Object.entries(this.NUMERIC_PATTERNS)) {
      for (const pattern of patterns) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        
        // Create fresh regex to avoid state issues
        const freshPattern = new RegExp(pattern.source, pattern.flags);
        let match;

        while ((match = freshPattern.exec(content)) !== null) {
          regions.push({
            start: match.index,
            end: match.index + match[0].length,
            type: type,
            text: match[0],
            numeric_integrity_sensitive: true
          });
        }
      }
    }

    // Merge overlapping regions and return
    return this.mergeOverlappingRegions(regions);
  },

  /**
   * Check if a position falls within any numeric region
   * Requirements: 3.6 - Position checking for numeric region protection
   * 
   * Used by cleaning functions to determine if a transformation
   * should be skipped because it falls within a protected numeric region.
   * 
   * @param {number} position - Character position to check
   * @param {Array} numericRegions - Array of numeric regions from detectNumericRegions
   * @returns {boolean} True if position is within a numeric region
   */
  isInNumericRegion(position, numericRegions) {
    if (typeof position !== 'number' || !numericRegions || !Array.isArray(numericRegions)) {
      return false;
    }

    return numericRegions.some(region => 
      position >= region.start && position < region.end
    );
  },

  /**
   * Check if a range overlaps with any numeric region
   * Requirements: 3.6 - Range checking for numeric region protection
   * 
   * Used to check if a transformation's affected range overlaps
   * with any protected numeric region.
   * 
   * @param {number} start - Start position of range
   * @param {number} end - End position of range
   * @param {Array} numericRegions - Array of numeric regions from detectNumericRegions
   * @returns {boolean} True if range overlaps with any numeric region
   */
  rangeOverlapsNumericRegion(start, end, numericRegions) {
    if (typeof start !== 'number' || typeof end !== 'number' || 
        !numericRegions || !Array.isArray(numericRegions)) {
      return false;
    }

    return numericRegions.some(region => 
      // Check if ranges overlap: not (end1 <= start2 or end2 <= start1)
      !(end <= region.start || region.end <= start)
    );
  },

  // ============================================
  // THREE-VERSION CONTENT MODEL
  // Requirements: 1.1-1.6 - Legal Integrity Enhancement
  // ============================================

  /**
   * Create three-version content structure from extracted text
   * Requirements: 1.1, 1.3, 1.4 - Three-Version Content Model
   * 
   * This function creates the foundational content model for legal integrity:
   * - content_raw: Exact extracted text, NEVER modified after creation
   * - content_normalized: Unicode NFC normalized only, no wording changes
   * - content_corrected: Initialized from normalized, will receive encoding-level fixes only
   * 
   * CRITICAL: content_raw is immutable and serves as the anchor for:
   * - Content hash computation
   * - Citation position offsets
   * - Audit trail verification
   * 
   * @param {string} extractedText - Raw text from DOM extraction
   * @returns {Object} Three-version content object
   */
  createThreeVersionContent(extractedText) {
    // Handle null/undefined input - create empty structure
    if (extractedText === null || extractedText === undefined) {
      return {
        content_raw: '',
        content_normalized: '',
        content_corrected: ''
      };
    }

    // Ensure we have a string
    const rawText = String(extractedText);

    // content_raw: Store exact extracted text, NEVER modify this
    // Requirements: 1.1, 1.2 - content_raw is byte-identical to extracted text
    const content_raw = rawText;

    // content_normalized: Apply Unicode NFC normalization only
    // Requirements: 1.3 - Unicode NFC normalization, no wording changes
    // NFC (Canonical Decomposition, followed by Canonical Composition)
    // This ensures consistent Unicode representation without changing meaning
    const content_normalized = rawText.normalize('NFC');

    // content_corrected: Initialize from normalized, will receive encoding fixes
    // Requirements: 1.4 - Encoding-level fixes only (mojibake, HTML entities, broken Unicode)
    // At creation time, this is identical to normalized
    const content_corrected = content_normalized;

    return {
      content_raw,
      content_normalized,
      content_corrected
    };
  },

  /**
   * Compute SHA-256 hash from content_raw exclusively
   * Requirements: 1.5 - Content hash anchored to content_raw
   * 
   * CRITICAL: This function MUST only use content_raw for hash computation.
   * The hash serves as the immutable anchor for:
   * - Content integrity verification
   * - Deduplication checks
   * - Audit trail
   * 
   * @param {Object|string} content - Either a three-version content object or raw string
   * @returns {Promise<Object>} Hash result with hash value and hash_source metadata
   */
  async computeContentHash(content) {
    // Extract content_raw from three-version object or use string directly
    let contentRaw;
    
    if (content && typeof content === 'object' && 'content_raw' in content) {
      // Three-version content object - use content_raw exclusively
      contentRaw = content.content_raw;
    } else if (typeof content === 'string') {
      // Legacy support: raw string passed directly
      contentRaw = content;
    } else if (content === null || content === undefined) {
      return {
        content_hash: null,
        hash_source: 'content_raw',
        error: 'No content provided'
      };
    } else {
      return {
        content_hash: null,
        hash_source: 'content_raw',
        error: 'Invalid content type'
      };
    }

    // Handle empty content
    if (!contentRaw || contentRaw.length === 0) {
      return {
        content_hash: null,
        hash_source: 'content_raw',
        error: 'Empty content'
      };
    }

    try {
      // Use Web Crypto API if available (browser environment)
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(contentRaw);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return {
          content_hash: `sha256:${hashHex}`,
          hash_source: 'content_raw'
        };
      }
      
      // Fallback for Node.js environment (tests)
      if (typeof require !== 'undefined') {
        try {
          const cryptoModule = require('crypto');
          const hash = cryptoModule.createHash('sha256').update(contentRaw).digest('hex');
          
          return {
            content_hash: `sha256:${hash}`,
            hash_source: 'content_raw'
          };
        } catch (e) {
          // crypto module not available
        }
      }

      // If no crypto available, return error
      return {
        content_hash: null,
        hash_source: 'content_raw',
        error: 'Crypto API not available'
      };
    } catch (e) {
      return {
        content_hash: null,
        hash_source: 'content_raw',
        error: `Hash computation failed: ${e.message}`
      };
    }
  },

  // ============================================
  // TITLE PRESERVATION
  // Requirements: 18.1-18.5 - Legal Integrity Enhancement
  // ============================================

  /**
   * Create title preservation structure with raw and normalized versions
   * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5 - Title Preservation
   * 
   * Stores act titles in two parallel versions:
   * - title_raw: Exact extracted title, NEVER modified
   * - title_normalized: Unicode NFC normalized only, no corrections
   * 
   * CRITICAL RULES:
   * - NEVER "correct" titles for spelling, spacing, or formatting
   * - Preserve year format variations (১৯৯১ vs 1991) as extracted
   * - Use title_raw for display
   * - Use title_normalized for deduplication matching
   * 
   * @param {string} extractedTitle - Raw title from DOM extraction
   * @returns {Object} Title preservation object with title_raw and title_normalized
   */
  createTitlePreservation(extractedTitle) {
    // Handle null/undefined input - create empty structure
    if (extractedTitle === null || extractedTitle === undefined) {
      return {
        title_raw: '',
        title_normalized: ''
      };
    }

    // Ensure we have a string
    const rawTitle = String(extractedTitle);

    // title_raw: Store exact extracted title, NEVER modify this
    // Requirements: 18.1 - title_raw is the exact extracted title
    const title_raw = rawTitle;

    // title_normalized: Apply Unicode NFC normalization only
    // Requirements: 18.2 - Unicode NFC normalization only, no corrections
    // NFC (Canonical Decomposition, followed by Canonical Composition)
    // This ensures consistent Unicode representation without changing meaning
    // Requirements: 18.3 - NEVER "correct" titles for spelling, spacing, or formatting
    // Requirements: 18.4 - Preserve year format variations (১৯৯১ vs 1991) as extracted
    const title_normalized = rawTitle.normalize('NFC');

    return {
      title_raw,
      title_normalized
    };
  },

  /**
   * Hardcoded CSS selectors for legal content extraction
   * Selectors are tried in listed order; the first non-empty match is used
   * Requirements: 7.1 - Only predefined selectors allowed
   */
  LEGAL_SELECTORS: {
    title: ['h1', '.act-title'],
    content: ['#lawContent', '.law-content', '.act-details'],
    meta: ['.act-meta', '.law-header'],
    schedule: ['table', '.schedule', '#schedule'],
    // DOM-specific selectors for Volume DataTable extraction
    // Requirements: 22.1 - Target table.table-search tbody tr structure
    volumeTable: 'table.table-search tbody tr',
    actContainer: '.boxed-layout',
    actMetadata: ['.bg-act-section', '.act-role-style'],
    sectionRows: '.lineremoves',
    sectionTitle: '.col-sm-3.txt-head',
    sectionBody: '.col-sm-9.txt-details',
    // Preamble and header content selectors (content BEFORE section rows)
    // These contain act number, date, repealed notice, purpose, and preamble
    actHeaderSection: '.bg-act-section',      // Contains act number and date
    actRepealedNotice: '.bt-act-repealed',    // Contains repealed notice (if any)
    actPurpose: '.act-role-style',            // Contains act purpose statement
    actPreamble: '.lineremove'                // Singular - contains preamble (যেহেতু...সেহেতু)
  },

  // ============================================
  // SELECTOR HIERARCHY FOR FALLBACK EXTRACTION
  // Requirements: 6.1, 6.3, 11.1, 11.3, 11.4 - Textual Fidelity Enhancement
  // ============================================

  /**
   * Selector hierarchy configuration for fallback extraction
   * Requirements: 6.1, 6.3, 11.1, 11.3, 11.4 - Fallback Selector Configuration
   * 
   * Selectors are organized in a hierarchy from most specific to most broad:
   * - primary: Existing selectors (tried first)
   * - fallback: Alternative selectors for different page structures
   * - bodyFallback: Last resort using body with exclusion filtering
   * 
   * INVARIANT: Body fallback extraction MUST contain at least one legal marker
   * (section marker, preamble, enactment clause, or schedule reference);
   * otherwise, extraction SHALL be classified as content_selector_mismatch.
   */
  SELECTOR_HIERARCHY: {
    // Primary selectors (existing) - tried first
    // Requirements: 6.1 - Support an ordered list of fallback content selectors
    primary: {
      title: ['h1', '.act-title'],
      content: ['#lawContent', '.law-content', '.act-details'],
      meta: ['.act-meta', '.law-header'],
      schedule: ['table.schedule', '.schedule', '#schedule', 'table']
    },
    
    // Fallback selectors (new) - tried when primary fails
    // Requirements: 6.3 - Support fallback selectors for preamble, main content, schedules
    fallback: {
      content: [
        '.boxed-layout',
        '.content-wrapper',
        '.main-content',
        'article',
        'main',
        '[role="main"]'
      ],
      preamble: [
        '.preamble',
        '.act-preamble',
        '.whereas-section'
      ],
      schedule: [
        'table.schedule',
        '.schedule-content',
        '.appendix'
      ]
    },
    
    // Body fallback with exclusion blacklist and legal signal requirement
    // Requirements: 11.1, 11.3, 11.4 - Broader content container detection
    bodyFallback: {
      selector: 'body',
      // Requirements: 11.4 - Exclusion blacklist for body fallback
      exclusions: [
        // Structural exclusions
        'header',
        'nav',
        'footer',
        'aside',
        // Class-based exclusions
        '.sidebar',
        '.navigation',
        '.menu',
        '.nav-menu',
        '.header-content',
        '.footer-content',
        // Search-related exclusions
        '.search',
        '.search-box',
        '.search-form',
        '.search-results',
        '[role="search"]',
        // Auxiliary content exclusions
        '.related-links',
        '.breadcrumb',
        '.breadcrumbs',
        '.copyright',
        '.disclaimer',
        '.social-links',
        // Script/style exclusions
        'script',
        'style',
        'noscript',
        'iframe',
        'object',
        'embed'
      ],
      // INVARIANT: Body fallback extraction MUST contain at least one legal marker
      // (section marker, preamble, enactment clause, or schedule reference);
      // otherwise, extraction SHALL be classified as content_selector_mismatch.
      requireLegalSignal: true
    }
  },

  /**
   * Bengali section markers for legal document structure
   * Requirements: 9.1, 9.2 - Section marker detection
   */
  SECTION_MARKERS: ['ধারা', 'অধ্যায়', 'তফসিল'],

  /**
   * Bengali numeral + danda section marker pattern
   * Requirements: 2.1, 2.2, 10.1, 10.2 - Bengali Numeral+Danda Section Marker Detection
   * 
   * Bengali numerals: ০-৯ (U+09E6 to U+09EF)
   * Danda: ৷ (U+09F7)
   * 
   * Matches patterns like: ১৷, ২৷, ১০৷, ২৫৷, ১০০৷
   * Supports single and multi-digit Bengali numerals followed by danda.
   * 
   * IMPORTANT: This pattern detects section markers independently of "ধারা".
   * Content with only numeral+danda patterns (no ধারা) SHALL still have markers counted.
   */
  BENGALI_NUMERAL_DANDA_PATTERN: /[০-৯]+৷/g,

  /**
   * Amendment markers for detecting deleted/modified provisions
   * Requirements: 25.1 - Detect Amendment_Markers in legal text
   * - বিলুপ্ত (deleted/abolished)
   * - সংশোধিত (amended)
   * - প্রতিস্থাপিত (substituted)
   */
  AMENDMENT_MARKERS: ['বিলুপ্ত', 'সংশোধিত', 'প্রতিস্থাপিত'],

  /**
   * Cross-reference citation patterns for detecting references to other acts
   * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3 - Citation Pattern Detection
   * 
   * English patterns:
   * - ACT_FULL: "[Name] Act, [Year] ([Roman/Arabic] of [Year])"
   * - ACT_SHORT: "Act [Roman/Arabic] of [Year]"
   * - ORDINANCE: "Ordinance [Roman/Arabic] of [Year]"
   * 
   * Bengali patterns:
   * - BENGALI_ACT_FULL: "[Name] আইন, [Year] ([Year] সনের [Number] নং আইন)"
   * - BENGALI_ACT_SHORT: "[Year] সনের [Number] নং আইন/অধ্যাদেশ"
   * - BENGALI_ORDINANCE: "[Name] অধ্যাদেশ, [Year] (অধ্যাদেশ নং [Number], [Year])"
   * 
   * Special patterns:
   * - PRESIDENTS_ORDER: "P.O. [No.] [Number] of [Year]"
   */
  CITATION_PATTERNS: {
    // English patterns - Requirements: 1.1, 1.2, 1.3
    ENGLISH_ACT_FULL: /([A-Z][a-zA-Z\s]+(?:Act|Ordinance)),?\s*(\d{4})\s*\(([IVXLCDM]+|\d+)\s+of\s+(\d{4})\)/g,
    ENGLISH_ACT_SHORT: /(?:Act|Ordinance)\s+([IVXLCDM]+|\d+)\s+of\s+(\d{4})/g,
    
    // Bengali patterns - Requirements: 2.1, 2.2, 2.3
    BENGALI_ACT_FULL: /([^\s,।]+(?:\s+[^\s,।]+)*\s+আইন),?\s*([\u09E6-\u09EF]{4})\s*\(([\u09E6-\u09EF]{4})\s*সনের\s*([\u09E6-\u09EF]+)\s*নং\s*আইন\)/g,
    BENGALI_ACT_SHORT: /([\u09E6-\u09EF]{4})\s*সনের\s*([\u09E6-\u09EF]+)\s*নং\s*(আইন|অধ্যাদেশ)/g,
    BENGALI_ORDINANCE: /([^\s,।]+(?:\s+[^\s,।]+)*\s+অধ্যাদেশ),?\s*([\u09E6-\u09EF]{4})\s*\(অধ্যাদেশ\s*নং\s*([\u09E6-\u09EF]+),?\s*([\u09E6-\u09EF]{4})\)/g,
    
    // President's Order pattern - Special reference type
    PRESIDENTS_ORDER: /P\.?O\.?\s*(?:No\.?)?\s*(\d+)\s+of\s+(\d{4})/gi
  },

  /**
   * Lexical relation type classification keywords
   * Requirements: 3.1, 3.2, 3.3, 3.4, 5.1 - Lexical Relation Type Classification
   * 
   * Keywords for classifying the nature of cross-references:
   * - amendment: সংশোধন, amendment, amended, amending
   * - repeal: রহিত, repeal, repealed, repealing
   * - substitution: প্রতিস্থাপিত, substituted, substitution, replaced
   * - dependency: সাপেক্ষে, subject to, under, pursuant to
   * - incorporation: সন্নিবেশিত, inserted, incorporated, added
   * 
   * NOTE: Field renamed from REFERENCE_TYPE_KEYWORDS to LEXICAL_RELATION_KEYWORDS
   * per Requirements 5.1 - Lexical Relation Type Rename
   */
  LEXICAL_RELATION_KEYWORDS: {
    amendment: ['সংশোধন', 'সংশোধিত', 'amendment', 'amended', 'amending'],
    repeal: ['রহিত', 'রহিতকরণ', 'বিলুপ্ত', 'repeal', 'repealed', 'repealing'],
    substitution: ['প্রতিস্থাপিত', 'প্রতিস্থাপন', 'substituted', 'substitution', 'replaced'],
    dependency: ['সাপেক্ষে', 'অধীন', 'অনুসারে', 'subject to', 'under', 'pursuant to'],
    incorporation: ['সন্নিবেশিত', 'অন্তর্ভুক্ত', 'inserted', 'incorporated', 'added']
  },

  // Legacy alias for backward compatibility
  REFERENCE_TYPE_KEYWORDS: null, // Will be set to LEXICAL_RELATION_KEYWORDS after object definition

  /**
   * Bengali negation words for negation-aware reference classification
   * Requirements: 4.1 - Negation Context Detection
   * 
   * These words indicate negation in Bengali legal text:
   * - না (no/not)
   * - নয় (is not)
   * - নহে (is not - formal)
   * - নাই (there is not)
   * - নেই (there is not)
   * - ব্যতীত (except/without)
   * - ছাড়া (except/without)
   */
  NEGATION_WORDS: ['না', 'নয়', 'নহে', 'নাই', 'নেই', 'ব্যতীত', 'ছাড়া'],

  // ============================================
  // BENGALI STRUCTURE PATTERNS
  // Requirements: Legal Structure Derivation - Pattern definitions
  // ============================================

  /**
   * Bengali legal structure patterns for DOM content parsing
   * Used to detect sections, subsections, clauses within DOM-extracted text
   */
  BENGALI_STRUCTURE_PATTERNS: {
    // Section number: Bengali numeral(s) + danda (extracted from .txt-head)
    // Matches: ১৷, ২৷, ১০৷, ১৫৷, ১০০৷
    sectionNumber: /[০-৯]+৷/g,
    
    // Subsection marker: Bengali numeral in parentheses (within .txt-details)
    // Matches: (১), (২), (৩), (১০), (১৫)
    subsectionMarker: /\([০-৯]+\)/g,
    
    // Clause marker: Bengali letter in parentheses (within .txt-details)
    // Matches: (ক), (খ), (গ), (ঘ), (ঙ), (চ), (ছ), (জ), (ঝ), (ঞ), (ট), (ঠ), (ড), (ঢ)
    clauseMarker: /\([ক-ঢ]\)/g,
    
    // Preamble start patterns (in .lineremove content)
    // Matches: যেহেতু, WHEREAS
    preambleStart: /যেহেতু|WHEREAS/gi,
    
    // Enactment clause patterns (in .lineremove content)
    // Matches: সেহেতু এতদ্বারা, Be it enacted
    enactmentClause: /সেহেতু\s+এতদ্বারা|Be\s+it\s+enacted/gi
  },

  /**
   * Act link pattern for href extraction (used by content.js)
   * Extracts act_id from URLs like act-details-790.html
   */
  ACT_LINK_PATTERN: /act-details-(\d+)/,

  /**
   * Bengali Unicode range for language detection
   * Bengali characters: U+0980 to U+09FF
   * Requirements: 11.1 - Detect content language (Bengali or English)
   */
  BENGALI_UNICODE_RANGE: /[\u0980-\u09FF]/,

  /**
   * UI noise patterns to filter from extracted content
   * Requirements: 28.1, 28.2, 28.3 - Content Noise Filtering
   * - প্রিন্ট ভিউ (Print View button)
   * - Top (navigation link)
   * - Copyright © (copyright notices)
   * - Legislative and Parliamentary Affairs Division (footer text)
   */
  UI_NOISE_PATTERNS: [
    'প্রিন্ট ভিউ',
    /^Top$/gm,
    /Copyright © \d{4}/g,
    /Legislative and Parliamentary Affairs Division/g
  ],

  /**
   * Try selectors in order and return the first non-empty match
   * @param {Document} document - The DOM document to search
   * @param {string[]} selectors - Array of CSS selectors to try
   * @returns {string} The text content of the first matching element, or empty string
   */
  _trySelectors(document, selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    return '';
  },

  /**
   * Try selectors and return all matching elements' content
   * @param {Document} document - The DOM document to search
   * @param {string[]} selectors - Array of CSS selectors to try
   * @returns {string} Combined text content from all matching elements
   */
  _trySelectorsAll(document, selectors) {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements && elements.length > 0) {
        const content = Array.from(elements)
          .map(el => el.textContent ? el.textContent.trim() : '')
          .filter(text => text.length > 0)
          .join('\n\n');
        if (content) {
          return content;
        }
      }
    }
    return '';
  },

  /**
   * Try selectors with fallback hierarchy and record all attempts
   * Requirements: 4.1, 4.4, 4.6, 6.2, 11.2 - Fallback selector extraction with audit trail
   * 
   * This function implements the hierarchical selector fallback system:
   * 1. Try primary selectors first
   * 2. If primary fails, try fallback selectors in order
   * 3. Record all attempts in selectors_attempted array
   * 4. Set extraction_method and successful_selector on success
   * 
   * CRITICAL: Uses textContent only (innerText is FORBIDDEN)
   * 
   * @param {Document} document - The DOM document to search
   * @param {string} contentType - Type of content to extract ('content', 'preamble', 'schedule')
   * @returns {Object} Result with content, extraction_method, successful_selector, selectors_attempted
   */
  _trySelectorsWithFallback(document, contentType = 'content') {
    const result = {
      content: '',
      extraction_method: null,
      successful_selector: null,
      selectors_attempted: [],
      extraction_success: false
    };

    if (!document) {
      return result;
    }

    let attemptOrder = 0;

    // Step 1: Try primary selectors first
    // Requirements: 6.2 - Try fallback selectors only after primary selectors fail
    const primarySelectors = this.SELECTOR_HIERARCHY.primary[contentType] || [];
    
    for (const selector of primarySelectors) {
      try {
        const element = document.querySelector(selector);
        const matched = element !== null;
        const elementCount = matched ? 1 : 0;
        
        // Record the attempt
        result.selectors_attempted.push(
          this.createSelectorAttempt(selector, matched, elementCount, attemptOrder++)
        );
        
        if (element && element.textContent && element.textContent.trim()) {
          // Requirements: 4.4 - Log which selector succeeded
          result.content = element.textContent.trim();
          result.extraction_method = 'primary';
          result.successful_selector = selector;
          result.extraction_success = true;
          return result;
        }
      } catch (e) {
        // Selector failed, record as not matched and continue
        result.selectors_attempted.push(
          this.createSelectorAttempt(selector, false, 0, attemptOrder++)
        );
      }
    }

    // Step 2: Try fallback selectors
    // Requirements: 4.1 - When primary content selector returns no match, try fallback selectors
    const fallbackSelectors = this.SELECTOR_HIERARCHY.fallback[contentType] || [];
    
    for (const selector of fallbackSelectors) {
      try {
        const element = document.querySelector(selector);
        const matched = element !== null;
        const elementCount = matched ? 1 : 0;
        
        // Record the attempt
        result.selectors_attempted.push(
          this.createSelectorAttempt(selector, matched, elementCount, attemptOrder++)
        );
        
        if (element && element.textContent && element.textContent.trim()) {
          // Requirements: 4.6 - Record extraction_method: "fallback_selector"
          result.content = element.textContent.trim();
          result.extraction_method = 'fallback';
          result.successful_selector = selector;
          result.extraction_success = true;
          return result;
        }
      } catch (e) {
        // Selector failed, record as not matched and continue
        result.selectors_attempted.push(
          this.createSelectorAttempt(selector, false, 0, attemptOrder++)
        );
      }
    }

    // All selectors exhausted, return empty result
    // Requirements: 11.2 - Record all attempts for audit trail
    return result;
  },

  /**
   * Extract content using body as fallback with exclusion filtering
   * Requirements: 11.4, 11.5, 11.6 - Body fallback with exclusion blacklist
   * 
   * This function implements the body fallback extraction:
   * 1. Clone the body element to avoid modifying the original DOM
   * 2. Remove all excluded elements (nav, header, footer, sidebar, etc.)
   * 3. Extract textContent from the filtered body
   * 4. Validate that extracted content has legal signal
   * 5. Return content_selector_mismatch if no legal signal
   * 
   * CRITICAL: Uses textContent only (innerText is FORBIDDEN)
   * CRITICAL: Does NOT modify the original DOM
   * 
   * @param {Document} document - The DOM document to search
   * @param {number} startAttemptOrder - Starting attempt order for audit trail
   * @returns {Object} Result with content, extraction_method, successful_selector, selectors_attempted, hasLegalSignal
   */
  _tryBodyFallback(document, startAttemptOrder = 0) {
    const result = {
      content: '',
      extraction_method: null,
      successful_selector: null,
      selectors_attempted: [],
      extraction_success: false,
      hasLegalSignal: false
    };

    if (!document || !document.body) {
      return result;
    }

    const bodySelector = this.SELECTOR_HIERARCHY.bodyFallback.selector;
    const exclusions = this.SELECTOR_HIERARCHY.bodyFallback.exclusions;
    const requireLegalSignal = this.SELECTOR_HIERARCHY.bodyFallback.requireLegalSignal;

    try {
      // Clone the body to avoid modifying the original DOM
      // Requirements: 6.6 - SHALL NOT modify DOM during fallback selector attempts
      const bodyClone = document.body.cloneNode(true);

      // Requirements: 11.5 - When body is used as fallback, exclude navigation, header, footer, etc.
      // Requirements: 11.6 - Filter out non-content elements using defined exclusion list
      for (const exclusionSelector of exclusions) {
        try {
          const excludedElements = bodyClone.querySelectorAll(exclusionSelector);
          excludedElements.forEach(el => {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          });
        } catch (e) {
          // Invalid selector, skip
        }
      }

      // Extract textContent from filtered body
      // CRITICAL: textContent only, innerText is FORBIDDEN
      const content = bodyClone.textContent ? bodyClone.textContent.trim() : '';
      const matched = content.length > 0;

      // Record the attempt
      result.selectors_attempted.push(
        this.createSelectorAttempt(bodySelector, matched, matched ? 1 : 0, startAttemptOrder)
      );

      if (content) {
        // Requirements: 11.4 - Body fallback requires legal signal
        // Validate extracted content has legal signal
        const hasSignal = this.hasLegalSignal(content);
        result.hasLegalSignal = hasSignal;

        if (requireLegalSignal && !hasSignal) {
          // Content exists but has no legal signal
          // Requirements: 11.4 - Classify as content_selector_mismatch if no legal signal
          result.content = content;
          result.extraction_method = 'body_fallback';
          result.successful_selector = bodySelector;
          result.extraction_success = false; // Failed due to no legal signal
          return result;
        }

        // Content has legal signal (or legal signal not required)
        result.content = content;
        result.extraction_method = 'body_fallback';
        result.successful_selector = bodySelector;
        result.extraction_success = true;
        return result;
      }
    } catch (e) {
      // Body fallback failed
      result.selectors_attempted.push(
        this.createSelectorAttempt(bodySelector, false, 0, startAttemptOrder)
      );
    }

    return result;
  },

  /**
   * Try all selectors including body fallback with full audit trail
   * Requirements: 4.1, 4.4, 4.6, 6.2, 11.2, 11.4 - Complete fallback extraction pipeline
   * 
   * This function implements the complete extraction pipeline:
   * 1. Try primary selectors first
   * 2. If primary fails, try fallback selectors
   * 3. If fallback fails, try body fallback with exclusion filtering
   * 4. Record all attempts in selectors_attempted array
   * 
   * @param {Document} document - The DOM document to search
   * @param {string} contentType - Type of content to extract ('content', 'preamble', 'schedule')
   * @returns {Object} Result with content, extraction_method, successful_selector, selectors_attempted
   */
  _tryAllSelectorsWithFallback(document, contentType = 'content') {
    // First try primary and fallback selectors
    const result = this._trySelectorsWithFallback(document, contentType);

    // If successful, return immediately
    if (result.extraction_success) {
      return result;
    }

    // Try body fallback as last resort (only for 'content' type)
    if (contentType === 'content') {
      const bodyResult = this._tryBodyFallback(document, result.selectors_attempted.length);
      
      // Merge body fallback attempts into main result
      result.selectors_attempted.push(...bodyResult.selectors_attempted);
      
      if (bodyResult.extraction_success) {
        result.content = bodyResult.content;
        result.extraction_method = bodyResult.extraction_method;
        result.successful_selector = bodyResult.successful_selector;
        result.extraction_success = true;
        result.hasLegalSignal = bodyResult.hasLegalSignal;
      } else if (bodyResult.content && !bodyResult.hasLegalSignal) {
        // Body had content but no legal signal
        result.content = bodyResult.content;
        result.extraction_method = bodyResult.extraction_method;
        result.successful_selector = bodyResult.successful_selector;
        result.hasLegalSignal = false;
      }
    }

    return result;
  },

  /**
   * Extract act content from Layer 3 (Act Detail) pages
   * Requirements: 4.1, 6.2, 7.1, 9.4, 9.5, 11.2 - Content extraction with preservation
   * Requirements: 1.1, 1.2, 2.1, 3.1 - Pattern detection integration
   * Requirements: 1.5, 1.6, 4.4, 4.6, 5.4, 7.2 - Extraction metadata
   * 
   * This function integrates all extraction components:
   * - Hierarchical selector fallback system (_trySelectorsWithFallback)
   * - Body fallback with exclusion filtering
   * - Pattern detection (preamble, enactment clause, section markers)
   * - Schedule reference vs table DOM distinction
   * - Comprehensive extraction metadata
   * 
   * @param {Document} document - The DOM document to extract from
   * @param {Object} options - Extraction options
   * @param {number} options.extractionDelayMs - Delay before extraction (default: 0)
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @returns {Object} Extracted content with comprehensive metadata
   */
  extractActContent(document, options = {}) {
    // Default result structure with all metadata fields
    const defaultResult = {
      title: '',
      content: '',
      content_raw: '',
      sections: { detected: [], counts: {} },
      extraction_metadata: {
        // Selector audit trail
        selectors_attempted: [],
        successful_selector: null,
        extraction_method: null,
        content_container_selector: null,
        
        // Failure classification
        extraction_success: false,
        failure_reason: null,
        all_selectors_exhausted: false,
        
        // Retry tracking
        retry_count: 0,
        max_retries: this.RETRY_CONFIG.max_retries,
        
        // DOM readiness
        dom_readiness: this.DOM_READINESS_STATES.UNCERTAIN,
        extraction_delay_ms: 0,
        
        // Pattern detection flags
        has_preamble: false,
        preamble_captured: false,
        preamble_start_position: null,
        
        has_enactment_clause: false,
        enactment_clause_captured: false,
        enactment_clause_position: null,
        
        // Schedule tracking
        schedule_reference_count: 0,
        schedule_table_count: 0,
        missing_schedule: false
      },
      marker_frequency: {
        dhara_count: 0,
        numeral_danda_count: 0,
        bengali_numbered_sections: 0,
        chapter_count: 0,
        schedule_count: 0
      }
    };

    if (!document) {
      defaultResult.extraction_metadata.failure_reason = this.FAILURE_REASONS.DOM_NOT_READY;
      return defaultResult;
    }

    // Requirements: 5.1 - Verify DOM readiness before extraction
    const domReadiness = this.checkDOMReadiness(document);
    const extractionDelayMs = this.getExtractionDelayConfig(options.extractionDelayMs).delay_ms;

    // Extract title using ordered selectors (title extraction unchanged)
    const title = this._trySelectors(document, this.LEGAL_SELECTORS.title);

    // Requirements: 4.1, 6.2, 11.2 - Use _tryAllSelectorsWithFallback for content extraction
    // This implements the hierarchical selector fallback system
    const contentResult = this._tryAllSelectorsWithFallback(document, 'content');

    // Get the extracted content
    let content = contentResult.content || '';
    const content_raw = content; // Preserve raw content before any processing

    // If no main content found via fallback hierarchy, try meta selectors as last resort
    if (!content) {
      content = this._trySelectors(document, this.LEGAL_SELECTORS.meta);
    }

    // Extract schedule content if present and not already included
    const scheduleContent = this._trySelectorsAll(document, this.LEGAL_SELECTORS.schedule);
    if (scheduleContent && content && !content.includes(scheduleContent)) {
      content = `${content}\n\n${scheduleContent}`;
    } else if (scheduleContent && !content) {
      content = scheduleContent;
    }

    // Detect section markers in the content (legacy)
    const detected = this.detectSectionMarkers(content);
    const counts = this.countSectionMarkers(content);

    // Requirements: 2.1 - Call countBengaliSectionMarkers for enhanced marker counting
    const markerFrequency = this.countBengaliSectionMarkers(content);

    // Requirements: 1.1 - Call detectPreamble for preamble pattern detection
    const preambleResult = this.detectPreamble(content);

    // Requirements: 1.2 - Call detectEnactmentClause for enactment clause detection
    const enactmentResult = this.detectEnactmentClause(content);

    // Requirements: 3.1 - Update schedule detection logic with reference vs table DOM distinction
    const scheduleDistinction = this.detectScheduleDistinction(document, content);

    // Classify failure if extraction was not successful
    let failureReason = null;
    if (!contentResult.extraction_success && !content) {
      failureReason = this.classifyFailure({
        selectorsAttempted: contentResult.selectors_attempted,
        domReady: domReadiness === this.DOM_READINESS_STATES.READY,
        networkError: false,
        contentFound: content
      });
    }

    // Build comprehensive extraction metadata
    // Requirements: 1.5, 1.6, 4.4, 4.6, 5.4, 7.2 - Include all new metadata fields
    const extractionMetadata = {
      // Selector audit trail
      selectors_attempted: contentResult.selectors_attempted,
      successful_selector: contentResult.successful_selector,
      extraction_method: contentResult.extraction_method,
      content_container_selector: contentResult.successful_selector,
      
      // Failure classification
      extraction_success: contentResult.extraction_success || Boolean(content),
      failure_reason: failureReason,
      all_selectors_exhausted: !contentResult.extraction_success && contentResult.selectors_attempted.length > 0,
      
      // Retry tracking (populated by extractWithRetry if used)
      retry_count: 0,
      max_retries: this.getRetryConfig(options.maxRetries).max_retries,
      
      // DOM readiness
      // Requirements: 5.4 - Record extraction_delay_ms in extraction metadata
      dom_readiness: domReadiness,
      extraction_delay_ms: extractionDelayMs,
      
      // Pattern detection flags
      // Requirements: 1.5 - Record preamble_captured
      has_preamble: preambleResult.has_preamble,
      preamble_captured: preambleResult.preamble_captured,
      preamble_start_position: preambleResult.preamble_start_position,
      
      // Requirements: 1.6 - Record enactment_clause_captured
      has_enactment_clause: enactmentResult.has_enactment_clause,
      enactment_clause_captured: enactmentResult.enactment_clause_captured,
      enactment_clause_position: enactmentResult.enactment_clause_position,
      
      // Schedule tracking
      // Requirements: 3.5 - Record schedule_reference_count and schedule_table_count separately
      schedule_reference_count: scheduleDistinction.schedule_reference_count,
      schedule_table_count: scheduleDistinction.schedule_table_count,
      // Requirements: 3.2 - Set missing_schedule: true only when reference exists but no table DOM
      missing_schedule: scheduleDistinction.missing_schedule
    };

    return {
      title,
      content,
      content_raw,
      sections: {
        detected,
        counts
      },
      extraction_metadata: extractionMetadata,
      marker_frequency: markerFrequency
    };
  },

  /**
   * Extract volume data (act catalog) from Layer 2 (Volume) pages
   * Requirements: 4.1 - Volume page metadata extraction
   * 
   * @param {Document} document - The DOM document to extract from
   * @returns {Array<Object>} Array of act metadata { title, year, actNumber, url }
   */
  extractVolumeData(document) {
    if (!document) {
      return [];
    }

    const acts = [];
    
    // Look for act links in the volume page
    // Common patterns: links to act-details-*.html or act-*.html
    const links = document.querySelectorAll('a[href*="act-"]');
    
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;

      // Extract act number from URL
      const actNumberMatch = href.match(/act-(?:details-)?(\d+)\.html/);
      if (!actNumberMatch) continue;

      const actNumber = actNumberMatch[1];
      
      // Get the title from the link text or parent element
      let title = link.textContent ? link.textContent.trim() : '';
      
      // Try to extract year from the title or nearby elements
      let year = '';
      const yearMatch = title.match(/(\d{4})/);
      if (yearMatch) {
        year = yearMatch[1];
      }

      // Build full URL if relative
      let url = href;
      if (!href.startsWith('http')) {
        url = `http://bdlaws.minlaw.gov.bd/${href.replace(/^\//, '')}`;
      }

      // Prefer act-details URL
      if (!url.includes('act-details')) {
        url = url.replace(/act-(\d+)\.html/, 'act-details-$1.html');
      }

      acts.push({
        title,
        year,
        actNumber,
        url
      });
    }

    return acts;
  },

  /**
   * Extract volume catalog from DataTable structure
   * Requirements: 22.1-22.6 - Volume Page DOM Structure Extraction
   * 
   * The Volume page uses a DataTable structure (table.table-search) to list acts.
   * Each row contains:
   * - Cell 0: Hidden year/ID (often contains a link with ID)
   * - Cell 1: Title with anchor link to act page
   * - Cell 2: Act number
   * 
   * @param {Document} document - The DOM document to extract from
   * @returns {Array<Object>} Array of { id, title, url, actNumber, rowIndex }
   */
  extractVolumeFromDataTable(document) {
    if (!document) {
      return [];
    }

    const rows = document.querySelectorAll(this.LEGAL_SELECTORS.volumeTable);
    const acts = [];

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;

      // Cell 1: Title with anchor link
      const titleAnchor = cells[1].querySelector('a');
      if (!titleAnchor) return;

      const href = titleAnchor.getAttribute('href');
      if (!href) return;

      const title = titleAnchor.textContent ? titleAnchor.textContent.trim() : '';

      // Extract ID from URL pattern /act-{ID}.html
      // Requirements: 22.4 - Extract act ID from href attribute pattern
      const idMatch = href.match(/act-(\d+)\.html/);
      const id = idMatch ? idMatch[1] : null;

      // Cell 2: Act number
      // Requirements: 22.2 - Extract Cell 2 (act number)
      const actNoAnchor = cells[2].querySelector('a');
      const actNumber = actNoAnchor ? actNoAnchor.textContent.trim() : '';

      // Normalize relative URL to absolute
      // Requirements: 22.5 - Normalize relative URLs to absolute with bdlaws.minlaw.gov.bd domain
      const url = this._normalizeUrl(href);

      acts.push({
        id,
        title,
        url,
        actNumber,
        rowIndex: index  // Requirements: 22.6 - Preserve original row order
      });
    });

    return acts;
  },

  /**
   * Normalize a URL to absolute with bdlaws.minlaw.gov.bd domain
   * Requirements: 22.5 - Normalize relative URLs to absolute
   * 
   * @param {string} href - The URL to normalize (may be relative or absolute)
   * @returns {string} Absolute URL with http://bdlaws.minlaw.gov.bd domain
   */
  _normalizeUrl(href) {
    if (!href || typeof href !== 'string') {
      return '';
    }

    // Already absolute URL
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }

    // Relative URL - normalize to absolute
    const baseUrl = 'http://bdlaws.minlaw.gov.bd';
    
    if (href.startsWith('/')) {
      return `${baseUrl}${href}`;
    }
    
    return `${baseUrl}/${href}`;
  },

  /**
   * Detect section markers in text with line number computation
   * Requirements: 9.1, 9.2 - Section marker detection with line numbers
   * 
   * @param {string} text - The text to analyze
   * @returns {Array<Object>} Array of { type, line, lineNumber, position }
   */
  detectSectionMarkers(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const markers = [];
    const lines = text.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1; // 1-based line numbers

      for (const marker of this.SECTION_MARKERS) {
        let position = 0;
        let searchStart = 0;

        // Find all occurrences of this marker in the line
        while ((position = line.indexOf(marker, searchStart)) !== -1) {
          markers.push({
            type: marker,
            line: line,
            lineNumber: lineNumber,
            position: position
          });
          searchStart = position + marker.length;
        }
      }
    }

    return markers;
  },

  /**
   * Count section markers by type
   * Requirements: 9.2 - Display count of detected section markers
   * 
   * @param {string} text - The text to analyze
   * @returns {Object} Counts object { 'ধারা': number, 'অধ্যায়': number, 'তফসিল': number }
   */
  countSectionMarkers(text) {
    const counts = {
      'ধারা': 0,
      'অধ্যায়': 0,
      'তফসিল': 0
    };

    if (!text || typeof text !== 'string') {
      return counts;
    }

    for (const marker of this.SECTION_MARKERS) {
      // Count all occurrences of this marker
      const regex = new RegExp(marker, 'g');
      const matches = text.match(regex);
      counts[marker] = matches ? matches.length : 0;
    }

    return counts;
  },

  /**
   * Count Bengali section markers with separate dhara and numeral+danda counts
   * Requirements: 2.1, 2.2, 2.3, 2.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6 - Bengali Section Marker Enhancement
   * 
   * Counts section markers in two categories:
   * - dhara_count: Occurrences of "ধারা" marker
   * - numeral_danda_count: Occurrences of Bengali numeral + danda patterns (১৷, ২৷, ১০৷, etc.)
   * 
   * IMPORTANT: These counts are INDEPENDENT. Content with only numeral+danda patterns
   * (no ধারা) SHALL have dhara_count: 0 and numeral_danda_count > 0.
   * 
   * The function does NOT require "ধারা" for section marker detection.
   * Bengali numeral+danda patterns are valid section markers on their own.
   * 
   * @param {string} text - The text to analyze
   * @returns {Object} marker_frequency object with:
   *   - dhara_count: number - Count of "ধারা" markers
   *   - numeral_danda_count: number - Count of Bengali numeral+danda patterns
   *   - bengali_numbered_sections: number - Combined count (dhara_count + numeral_danda_count)
   *   - chapter_count: number - Count of "অধ্যায়" markers
   *   - schedule_count: number - Count of "তফসিল" markers
   */
  countBengaliSectionMarkers(text) {
    const markerFrequency = {
      dhara_count: 0,
      numeral_danda_count: 0,
      bengali_numbered_sections: 0,
      chapter_count: 0,
      schedule_count: 0
    };

    if (!text || typeof text !== 'string') {
      return markerFrequency;
    }

    // Count ধারা markers (Requirements 10.5)
    const dharaRegex = /ধারা/g;
    const dharaMatches = text.match(dharaRegex);
    markerFrequency.dhara_count = dharaMatches ? dharaMatches.length : 0;

    // Count Bengali numeral + danda patterns (Requirements 10.1, 10.2, 10.3, 10.4)
    // Pattern: Bengali numerals (০-৯) followed by danda (৷)
    // Supports single and multi-digit: ১৷, ২৷, ১০৷, ২৫৷, ১০০৷
    const numeralDandaRegex = new RegExp(this.BENGALI_NUMERAL_DANDA_PATTERN.source, 'g');
    const numeralDandaMatches = text.match(numeralDandaRegex);
    markerFrequency.numeral_danda_count = numeralDandaMatches ? numeralDandaMatches.length : 0;

    // Combined count (Requirements 10.3)
    markerFrequency.bengali_numbered_sections = markerFrequency.dhara_count + markerFrequency.numeral_danda_count;

    // Count chapter markers (অধ্যায়)
    const chapterRegex = /অধ্যায়/g;
    const chapterMatches = text.match(chapterRegex);
    markerFrequency.chapter_count = chapterMatches ? chapterMatches.length : 0;

    // Count schedule markers (তফসিল)
    const scheduleRegex = /তফসিল/g;
    const scheduleMatches = text.match(scheduleRegex);
    markerFrequency.schedule_count = scheduleMatches ? scheduleMatches.length : 0;

    return markerFrequency;
  },

  /**
   * Detect amendment markers in legal text
   * Requirements: 25.1, 25.2, 25.3, 25.4 - Amendment and Deletion Marker Detection
   * 
   * Detects Bengali amendment markers:
   * - বিলুপ্ত (deleted/abolished)
   * - সংশোধিত (amended)
   * - প্রতিস্থাপিত (substituted)
   * 
   * Returns array with type, line, lineNumber, position, and context (20 chars before/after).
   * Preserves original text unchanged.
   * 
   * @param {string} text - The text to analyze
   * @returns {Array<Object>} Array of { type, line, lineNumber, position, context }
   */
  detectAmendmentMarkers(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const markers = [];
    const lines = text.split('\n');

    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1; // 1-based line numbers

      for (const marker of this.AMENDMENT_MARKERS) {
        let position = 0;
        let searchStart = 0;

        // Find all occurrences of this marker in the line
        while ((position = line.indexOf(marker, searchStart)) !== -1) {
          // Extract surrounding context (20 chars before/after)
          // Requirements: 25.3 - Include context in amendments array
          const contextStart = Math.max(0, position - 20);
          const contextEnd = Math.min(line.length, position + marker.length + 20);
          const context = line.substring(contextStart, contextEnd);

          markers.push({
            type: marker,
            line: line,
            lineNumber: lineNumber,
            position: position,
            context: context
          });

          searchStart = position + marker.length;
        }
      }
    });

    return markers;
  },

  /**
   * Filter UI noise from extracted content
   * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6 - Content Noise Filtering
   * 
   * Removes UI navigation elements, copyright notices, and footer text while
   * preserving all Bengali legal text and section markers.
   * 
   * @param {string} text - The text to filter
   * @returns {string} Filtered text with UI noise removed
   */
  filterContentNoise(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let filtered = text;

    // Requirements: 28.1, 28.2, 28.3 - Remove UI noise patterns
    for (const pattern of this.UI_NOISE_PATTERNS) {
      if (typeof pattern === 'string') {
        // For string patterns, use split/join to remove all occurrences
        filtered = filtered.split(pattern).join('');
      } else {
        // For regex patterns, use replace
        filtered = filtered.replace(pattern, '');
      }
    }

    // Requirements: 28.4 - Trim empty whitespace-only lines at beginning and end
    // Remove leading empty/whitespace-only lines (including spaces and tabs)
    filtered = filtered.replace(/^[\s\n]+/, '');
    // Remove trailing empty/whitespace-only lines (including spaces and tabs)
    filtered = filtered.replace(/[\s\n]+$/, '');

    // Requirements: 28.5, 28.6 - Preserve all Bengali legal text and section markers
    // The filtering above only removes specific noise patterns, so legal text is preserved

    return filtered;
  },

  /**
   * Extract table data handling merged cells correctly using matrix-based algorithm
   * Requirements: 24.1-24.7 - Table Parsing with Merged Cell Handling
   * 
   * Problem: Standard row/cell iteration breaks when rowspan causes cells
   * to "disappear" in subsequent rows, shifting data left.
   * 
   * Solution: Maintain a state matrix to track cell positions across rows.
   * 
   * @param {HTMLTableElement} tableElement - The table element to extract
   * @returns {Object} { data: string[][], hasMergedCells: boolean, rowCount: number, colCount: number }
   */
  extractTableWithMergedCells(tableElement) {
    if (!tableElement) {
      return { data: [], hasMergedCells: false, rowCount: 0, colCount: 0 };
    }

    const matrix = [];
    let hasMergedCells = false;
    let maxColCount = 0;

    // Requirements: 24.5 - Handle tables with class MsoTableGrid and table-bordered
    const rows = tableElement.querySelectorAll('tr');

    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('td, th');
      let colIndex = 0;

      // Initialize row in matrix if not exists
      if (!matrix[rowIndex]) {
        matrix[rowIndex] = [];
      }

      cells.forEach((cell) => {
        // Requirements: 24.1, 24.3 - Skip columns already filled by previous rowspan
        // This prevents data shifting when merged cells span multiple rows
        while (matrix[rowIndex] && matrix[rowIndex][colIndex] !== undefined) {
          colIndex++;
        }

        // Requirements: 24.6 - Normalize whitespace within table cells
        // Collapse multiple spaces to single space, replace &nbsp; with regular space
        let content = '';
        if (cell.textContent) {
          content = cell.textContent
            .trim()
            .replace(/\s+/g, ' ')           // Collapse multiple whitespace
            .replace(/\u00A0/g, ' ');        // Replace &nbsp; (non-breaking space)
        }

        // Get rowspan and colspan attributes
        const rowspan = parseInt(cell.getAttribute('rowspan')) || 1;
        const colspan = parseInt(cell.getAttribute('colspan')) || 1;

        // Track if we have any merged cells
        if (rowspan > 1 || colspan > 1) {
          hasMergedCells = true;
        }

        // Requirements: 24.1, 24.2, 24.4 - Fill matrix based on span dimensions
        // Use matrix-based algorithm to track cell positions across rows
        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            const targetRow = rowIndex + r;
            const targetCol = colIndex + c;

            // Initialize target row if not exists
            if (!matrix[targetRow]) {
              matrix[targetRow] = [];
            }

            // Only write content to origin cell (0,0) of merge
            // Mark other cells as empty string for merged positions
            matrix[targetRow][targetCol] = (r === 0 && c === 0) ? content : '';
          }
        }

        // Track maximum column count
        const endCol = colIndex + colspan;
        if (endCol > maxColCount) {
          maxColCount = endCol;
        }

        colIndex += colspan;
      });
    });

    // Requirements: 24.7 - Export table data as 2D array preserving row and column positions
    // Ensure all rows have the same number of columns (fill with empty strings if needed)
    const normalizedMatrix = matrix.map(row => {
      const normalizedRow = [];
      for (let i = 0; i < maxColCount; i++) {
        normalizedRow.push(row[i] !== undefined ? row[i] : '');
      }
      return normalizedRow;
    });

    return {
      data: normalizedMatrix,
      hasMergedCells,
      rowCount: normalizedMatrix.length,
      colCount: maxColCount
    };
  },

  /**
   * Extract act content from section-row structure on Act Detail pages
   * Requirements: 23.1-23.7 - Act Content DOM Structure Extraction
   * 
   * Act detail pages use Bootstrap rows (.lineremoves) with section title and body columns:
   * - Container: .boxed-layout
   * - Metadata: .bg-act-section or .act-role-style
   * - Section rows: .lineremoves
   * - Section title: .col-sm-3.txt-head
   * - Section body: .col-sm-9.txt-details
   * 
   * Extracts content in order:
   * 1. Header section (.bg-act-section) - act number, date
   * 2. Repealed notice (.bt-act-repealed) - if present
   * 3. Act purpose (.act-role-style) - purpose statement
   * 4. Preamble (.lineremove singular) - যেহেতু...সেহেতু clause
   * 5. Section rows (.lineremoves plural) - numbered sections
   * 
   * @param {Document} document - The DOM document to extract from
   * @returns {Object} { preambleContent: string|null, metadata: string|null, sections: Array<StructuredSection> }
   */
  extractActFromSectionRows(document) {
    if (!document) {
      return { preambleContent: null, metadata: null, sections: [] };
    }

    // Requirements: 23.1 - Target the .boxed-layout container
    const container = document.querySelector(this.LEGAL_SELECTORS.actContainer);
    if (!container) {
      return { preambleContent: null, metadata: null, sections: [] };
    }

    // Collect preamble content parts (content BEFORE section rows)
    const preambleParts = [];

    // 1. Extract header section (.bg-act-section) - act number, date
    const headerSection = container.querySelector(this.LEGAL_SELECTORS.actHeaderSection);
    if (headerSection && headerSection.textContent) {
      const headerText = headerSection.textContent.trim();
      if (headerText) {
        preambleParts.push(headerText);
      }
    }

    // 2. Extract repealed notice (.bt-act-repealed) - if present
    const repealedNotice = container.querySelector(this.LEGAL_SELECTORS.actRepealedNotice);
    if (repealedNotice && repealedNotice.textContent) {
      const repealedText = repealedNotice.textContent.trim();
      if (repealedText) {
        preambleParts.push(repealedText);
      }
    }

    // 3. Extract act purpose (.act-role-style) - purpose statement
    const actPurpose = container.querySelector(this.LEGAL_SELECTORS.actPurpose);
    if (actPurpose && actPurpose.textContent) {
      const purposeText = actPurpose.textContent.trim();
      if (purposeText) {
        preambleParts.push(purposeText);
      }
    }

    // 4. Extract preamble (.lineremove singular) - যেহেতু...সেহেতু clause
    // Note: .lineremove (singular) is different from .lineremoves (plural)
    // We need to find .lineremove elements that are NOT .lineremoves
    const allLineremove = container.querySelectorAll(this.LEGAL_SELECTORS.actPreamble);
    if (allLineremove && allLineremove.length > 0) {
      allLineremove.forEach((el) => {
        // Skip if this is a .lineremoves element (section rows)
        if (el.classList && el.classList.contains('lineremoves')) {
          return;
        }
        // Extract preamble content using textContent ONLY
        if (el.textContent) {
          const preambleText = el.textContent.trim();
          if (preambleText) {
            preambleParts.push(preambleText);
          }
        }
      });
    }

    // Combine preamble parts
    const preambleContent = preambleParts.length > 0 ? preambleParts.join('\n\n') : null;

    // Requirements: 23.2 - Extract metadata from .bg-act-section or .act-role-style elements (for backward compatibility)
    let metadata = null;
    for (const selector of this.LEGAL_SELECTORS.actMetadata) {
      const metadataEl = container.querySelector(selector);
      if (metadataEl && metadataEl.textContent) {
        metadata = metadataEl.textContent.trim();
        break;
      }
    }

    // Requirements: 23.3 - Iterate through .lineremoves rows to extract section content
    const sectionRows = container.querySelectorAll(this.LEGAL_SELECTORS.sectionRows);
    const sections = [];

    sectionRows.forEach((row, index) => {
      // Requirements: 23.4 - Extract section title from .col-sm-3.txt-head
      const titleEl = row.querySelector(this.LEGAL_SELECTORS.sectionTitle);
      const sectionTitle = titleEl ? titleEl.textContent.trim() : '';

      // Requirements: 23.5 - Extract section body from .col-sm-9.txt-details
      const bodyEl = row.querySelector(this.LEGAL_SELECTORS.sectionBody);
      const sectionBodyHtml = bodyEl ? bodyEl.innerHTML : '';
      const sectionBody = bodyEl ? bodyEl.textContent.trim() : '';

      // Track hasTable flag for sections containing tables
      const hasTable = bodyEl ? bodyEl.querySelector('table') !== null : false;

      // Requirements: 23.6, 23.7 - Preserve title-body association and document order
      sections.push({
        index,                    // Original document order
        sectionTitle,             // From .txt-head column
        sectionBody,              // Text content from .txt-details
        sectionBodyHtml,          // Raw HTML for table parsing
        hasTable                  // Whether section contains tables
      });
    });

    return { preambleContent, metadata, sections };
  },

  /**
   * Detect cross-references in legal text
   * Requirements: 1.4, 1.5, 2.4, 2.5, 4.1-4.4, 5.1-5.5, 16.1 - Citation Detection and Component Extraction
   * 
   * Iterates through text line by line, applies citation patterns, and extracts
   * citation components. Returns array of CrossReference objects with position,
   * context, and classification information.
   * 
   * IMPORTANT: Uses lexical_relation_type (not reference_type) per Requirements 5.1
   * IMPORTANT: Applies negation-aware classification per Requirements 4.1-4.4
   * IMPORTANT: Includes lexical_relation_confidence per Requirements 16.1
   * 
   * @param {string} text - The legal text content to analyze
   * @returns {Array<Object>} Array of CrossReference objects
   */
  detectCrossReferences(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const references = [];
    const lines = text.split('\n');
    let charOffset = 0;

    lines.forEach((line, lineIndex) => {
      // Check each pattern type
      for (const [patternName, pattern] of Object.entries(this.CITATION_PATTERNS)) {
        // Create a new regex instance to reset lastIndex for global patterns
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;

        while ((match = regex.exec(line)) !== null) {
          const absolutePosition = charOffset + match.index;
          
          const citation = {
            citation_text: match[0],
            pattern_type: patternName,
            line_number: lineIndex + 1, // 1-based line numbers
            position: absolutePosition,
            // Extract components based on pattern type
            ...this._extractCitationComponents(patternName, match)
          };

          // Add context (50 chars before and after)
          citation.context_before = this._extractContextBefore(text, absolutePosition, 50);
          citation.context_after = this._extractContextAfter(text, absolutePosition + match[0].length, 50);

          // Requirements: 4.1, 4.2 - Check for negation context
          const negationCheck = this.checkNegationContext(text, absolutePosition, 20);

          // Requirements: 4.3, 4.4, 5.1 - Classify using negation-aware lexical relation
          const fullContext = citation.context_before + ' ' + citation.citation_text + ' ' + citation.context_after;
          const classification = this.classifyLexicalRelation(fullContext, negationCheck);

          // Requirements: 5.1 - Use lexical_relation_type field name
          citation.lexical_relation_type = classification.lexical_relation_type;
          citation.negation_present = classification.negation_present;
          
          // Include negation details if present
          if (classification.negation_present) {
            citation.negation_word = classification.negation_word;
            citation.negation_context = classification.negation_context;
            citation.classification_note = classification.classification_note;
          }

          // Requirements: 16.1 - Assign lexical relation confidence based on pattern clarity
          citation.lexical_relation_confidence = this.assignLexicalConfidence(citation);

          references.push(citation);
        }
      }

      charOffset += line.length + 1; // +1 for newline character
    });

    // Deduplicate overlapping matches (keep most specific)
    return this._deduplicateReferences(references);
  },

  /**
   * Extract citation components based on pattern type
   * Requirements: 1.4, 2.4, 2.5 - Component Extraction
   * 
   * @param {string} patternName - The name of the matched pattern
   * @param {Array} match - The regex match array
   * @returns {Object} Extracted components { act_name, citation_year, citation_serial, script }
   */
  _extractCitationComponents(patternName, match) {
    switch (patternName) {
      case 'ENGLISH_ACT_FULL':
        return {
          act_name: match[1] ? match[1].trim() : null,
          citation_year: match[2] || match[4],
          citation_serial: match[3],
          script: 'english'
        };
      case 'ENGLISH_ACT_SHORT':
        return {
          act_name: null,
          citation_serial: match[1],
          citation_year: match[2],
          script: 'english'
        };
      case 'BENGALI_ACT_FULL':
        return {
          act_name: match[1] ? match[1].trim() : null,
          citation_year: match[2] || match[3],
          citation_serial: match[4],
          script: 'bengali'
        };
      case 'BENGALI_ACT_SHORT':
        return {
          citation_year: match[1],
          citation_serial: match[2],
          act_type: match[3],
          script: 'bengali'
        };
      case 'BENGALI_ORDINANCE':
        return {
          act_name: match[1] ? match[1].trim() : null,
          citation_year: match[2] || match[4],
          citation_serial: match[3],
          script: 'bengali'
        };
      case 'PRESIDENTS_ORDER':
        return {
          act_name: null,
          citation_serial: match[1],
          citation_year: match[2],
          script: 'english'
        };
      default:
        return { script: 'unknown' };
    }
  },

  /**
   * Extract context before a citation (public API)
   * Requirements: 4.1, 4.3 - Context Extraction
   * 
   * Extracts up to `length` characters before the specified position.
   * Handles document boundary edge cases by clamping to start of text.
   * 
   * @param {string} text - The full text
   * @param {number} position - The citation start position
   * @param {number} length - Maximum context length (default 50)
   * @returns {string} Context text before the citation (trimmed)
   */
  extractContextBefore(text, position, length = 50) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    if (typeof position !== 'number' || position <= 0) {
      return '';
    }
    const start = Math.max(0, position - length);
    return text.substring(start, position).trim();
  },

  /**
   * Extract context after a citation (public API)
   * Requirements: 4.2, 4.3 - Context Extraction
   * 
   * Extracts up to `length` characters after the specified position.
   * Handles document boundary edge cases by clamping to end of text.
   * 
   * @param {string} text - The full text
   * @param {number} position - The position after the citation
   * @param {number} length - Maximum context length (default 50)
   * @returns {string} Context text after the citation (trimmed)
   */
  extractContextAfter(text, position, length = 50) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    if (typeof position !== 'number' || position < 0) {
      return '';
    }
    if (position >= text.length) {
      return '';
    }
    const end = Math.min(text.length, position + length);
    return text.substring(position, end).trim();
  },

  /**
   * Extract context before a citation (internal use)
   * Requirements: 4.1, 4.3 - Context Extraction
   * 
   * @param {string} text - The full text
   * @param {number} position - The citation start position
   * @param {number} length - Maximum context length (default 50)
   * @returns {string} Context text before the citation
   */
  _extractContextBefore(text, position, length) {
    if (!text || position <= 0) {
      return '';
    }
    const start = Math.max(0, position - length);
    return text.substring(start, position).trim();
  },

  /**
   * Extract context after a citation (internal use)
   * Requirements: 4.2, 4.3 - Context Extraction
   * 
   * @param {string} text - The full text
   * @param {number} position - The position after the citation
   * @param {number} length - Maximum context length (default 50)
   * @returns {string} Context text after the citation
   */
  _extractContextAfter(text, position, length) {
    if (!text || position >= text.length) {
      return '';
    }
    const end = Math.min(text.length, position + length);
    return text.substring(position, end).trim();
  },

  /**
   * Classify the type of reference based on surrounding context
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - Reference Type Classification
   * 
   * @deprecated Use classifyLexicalRelation() instead for negation-aware classification
   * @param {string} contextText - Text surrounding the citation
   * @returns {string} Reference type: 'amendment', 'repeal', 'substitution', 'dependency', 'incorporation', or 'mention'
   */
  _classifyReferenceType(contextText) {
    // Delegate to the new lexical relation type detection
    return this._detectLexicalRelationType(contextText);
  },

  /**
   * Remove duplicate/overlapping references
   * Keeps the most specific match (longest) when patterns overlap
   * 
   * @param {Array} references - Array of detected references
   * @returns {Array} Deduplicated references
   */
  _deduplicateReferences(references) {
    if (!references || references.length === 0) {
      return [];
    }

    // Sort by position, then by specificity (longer matches first)
    const sorted = [...references].sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return b.citation_text.length - a.citation_text.length;
    });

    const deduplicated = [];
    let lastEnd = -1;

    for (const ref of sorted) {
      const refEnd = ref.position + ref.citation_text.length;

      // Skip if this reference overlaps with the previous one
      if (ref.position < lastEnd) {
        continue;
      }

      deduplicated.push(ref);
      lastEnd = refEnd;
    }

    return deduplicated;
  },

  /**
   * Detect the primary language of content
   * Requirements: 11.1 - Detect content language (Bengali or English)
   * 
   * Checks if content contains Bengali Unicode characters (U+0980 to U+09FF).
   * Returns 'bengali' if Bengali characters are found, 'english' otherwise.
   * 
   * @param {string} content - The act content to analyze
   * @returns {string} 'bengali' if content contains Bengali characters, 'english' otherwise
   */
  detectContentLanguage(content) {
    if (!content || typeof content !== 'string') {
      return 'english'; // Default to English for empty/invalid content
    }

    // Check if content contains Bengali Unicode characters
    if (this.BENGALI_UNICODE_RANGE.test(content)) {
      return 'bengali';
    }

    return 'english';
  },

  /**
   * Lexical relation disclaimer for exports
   * Requirements: 5.2, 5.3, 5.4, 5.5 - Lexical Relation Purity
   * 
   * This disclaimer MUST be included in all exports containing lexical references.
   * It explicitly states that detected relations are pattern-based and have no legal force.
   */
  LEXICAL_RELATION_DISCLAIMER: 'Detected via pattern matching. No legal force or applicability implied.',

  /**
   * Get lexical references metadata for export
   * Requirements: 5.2, 5.3, 5.4, 5.5 - Lexical Relation Export Metadata
   * 
   * Returns the standard metadata structure for lexical references in exports.
   * This ensures all exports include the required disclaimer and prohibition flags.
   * 
   * @param {Array} references - Array of detected lexical references
   * @returns {Object} Lexical references metadata object for export
   */
  getLexicalReferencesMetadata(references) {
    return {
      count: references ? references.length : 0,
      method: 'pattern-based detection',
      disclaimer: this.LEXICAL_RELATION_DISCLAIMER,
      relationship_inference: 'explicitly_prohibited',
      references: references || []
    };
  },

  // ============================================
  // LEGAL STATUS AND TEMPORAL MARKING
  // Requirements: 6.1-6.3, 7.1-7.4 - Legal Integrity Enhancement
  // ============================================

  /**
   * Patterns for detecting repealed status on source pages
   * Requirements: 6.1 - Detect if act is marked as repealed on source page
   * 
   * These patterns identify common indicators of repealed acts:
   * - Bengali: রহিত, বিলুপ্ত, রহিতকরণ
   * - English: repealed, abolished, revoked
   * - Status markers in metadata sections
   */
  LEGAL_STATUS_PATTERNS: {
    // Bengali patterns for repealed status
    repealed_bengali: [
      /রহিত(?:করণ)?/gi,                    // "repealed" or "repeal"
      /বিলুপ্ত/gi,                          // "abolished"
      /বাতিল(?:করণ)?/gi,                   // "cancelled" or "cancellation"
      /রদ(?:করণ)?/gi                       // "revoked" or "revocation"
    ],
    // English patterns for repealed status
    repealed_english: [
      /\brepealed\b/gi,
      /\babolished\b/gi,
      /\brevoked\b/gi,
      /\brescinded\b/gi,
      /\bno\s+longer\s+in\s+force\b/gi
    ],
    // Status indicator patterns (often in metadata/header sections)
    status_indicators: [
      /status\s*:\s*repealed/gi,
      /status\s*:\s*রহিত/gi,
      /\[repealed\]/gi,
      /\[রহিত\]/gi,
      /\(repealed\)/gi,
      /\(রহিত\)/gi
    ]
  },

  /**
   * Selectors for finding status information on act pages
   * Requirements: 6.1 - Detect status from source page structure
   */
  LEGAL_STATUS_SELECTORS: [
    '.act-status',
    '.law-status',
    '.status-badge',
    '.act-meta .status',
    '.bg-act-section',
    '.act-role-style',
    'h1',
    '.act-title',
    '.card-header'
  ],

  /**
   * Detect legal status of an act from the DOM document
   * Requirements: 6.1, 6.2, 6.3 - Legal Status Tracking
   * 
   * Detects if an act is marked as repealed on the source page by:
   * 1. Checking status-specific DOM elements
   * 2. Searching title/header for repealed indicators
   * 3. Scanning metadata sections for status markers
   * 
   * Returns one of:
   * - "active": No repealed indicators found (default assumption)
   * - "repealed": Clear repealed indicators detected
   * - "unknown": Cannot determine status reliably
   * 
   * IMPORTANT: This function does NOT infer legal status from content.
   * It only detects explicit status markers on the source page.
   * 
   * @param {Document} document - The DOM document to analyze
   * @returns {Object} {legal_status: string, status_source: string|null, status_indicators: string[]}
   */
  detectLegalStatus(document) {
    // Default result - unknown status
    const result = {
      legal_status: 'unknown',
      status_source: null,
      status_indicators: []
    };

    // Validate input
    if (!document) {
      return result;
    }

    const detectedIndicators = [];
    let statusSource = null;

    // Step 1: Check status-specific DOM elements
    for (const selector of this.LEGAL_STATUS_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent ?? '';
          if (!text.trim()) continue;

          // Check for repealed patterns in this element
          const repealedFound = this._checkForRepealedStatus(text);
          if (repealedFound.found) {
            detectedIndicators.push(...repealedFound.indicators);
            if (!statusSource) {
              statusSource = selector;
            }
          }
        }
      } catch (e) {
        // Selector failed, continue with next
        continue;
      }
    }

    // Step 2: Check document title
    if (document.title) {
      const titleCheck = this._checkForRepealedStatus(document.title);
      if (titleCheck.found) {
        detectedIndicators.push(...titleCheck.indicators);
        if (!statusSource) {
          statusSource = 'document.title';
        }
      }
    }

    // Step 3: Determine final status based on findings
    if (detectedIndicators.length > 0) {
      // Clear repealed indicators found
      result.legal_status = 'repealed';
      result.status_source = statusSource;
      result.status_indicators = [...new Set(detectedIndicators)]; // Deduplicate
    } else {
      // No repealed indicators found - assume active
      // Requirements: 6.2 - Default to "active" when no repealed markers found
      result.legal_status = 'active';
      result.status_source = 'no_repealed_indicators';
      result.status_indicators = [];
    }

    return result;
  },

  /**
   * Check text for repealed status indicators
   * Requirements: 6.1 - Internal helper for status detection
   * 
   * @param {string} text - Text to check for repealed indicators
   * @returns {Object} {found: boolean, indicators: string[]}
   */
  _checkForRepealedStatus(text) {
    if (!text || typeof text !== 'string') {
      return { found: false, indicators: [] };
    }

    const indicators = [];

    // Check Bengali repealed patterns
    for (const pattern of this.LEGAL_STATUS_PATTERNS.repealed_bengali) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      const match = freshPattern.exec(text);
      if (match) {
        indicators.push(match[0]);
      }
    }

    // Check English repealed patterns
    for (const pattern of this.LEGAL_STATUS_PATTERNS.repealed_english) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      const match = freshPattern.exec(text);
      if (match) {
        indicators.push(match[0]);
      }
    }

    // Check status indicator patterns
    for (const pattern of this.LEGAL_STATUS_PATTERNS.status_indicators) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      const match = freshPattern.exec(text);
      if (match) {
        indicators.push(match[0]);
      }
    }

    return {
      found: indicators.length > 0,
      indicators: indicators
    };
  },

  /**
   * Temporal status constant
   * Requirements: 7.1 - All acts are marked as "historical_text"
   */
  TEMPORAL_STATUS: 'historical_text',

  /**
   * Temporal disclaimer constant
   * Requirements: 7.4 - Include temporal disclaimer in exports
   */
  TEMPORAL_DISCLAIMER: 'No inference of current legal force or applicability',

  // ============================================
  // SOURCE AUTHORITY DECLARATION
  // Requirements: 11.1-11.4, 12.1-12.4 - Legal Integrity Enhancement
  // ============================================

  /**
   * Source authority constant
   * Requirements: 11.1 - Set source_authority in all exports
   * 
   * Declares that this corpus is derived exclusively from the bdlaws HTML source.
   * No Gazette PDFs or other sources are used to override or correct HTML text.
   */
  SOURCE_AUTHORITY: 'bdlaws_html_only',

  /**
   * Authority rank constant
   * Requirements: 11.2 - Set authority_rank in corpus metadata
   * 
   * Documents the single source of authority for this corpus.
   * Gazette comparison is explicitly out of scope.
   */
  AUTHORITY_RANK: ['bdlaws_html'],

  /**
   * Formatting scope constant
   * Requirements: 12.1 - Set formatting_scope when formatting is applied
   * 
   * Indicates that any formatting applied is for presentation purposes only.
   * Formatted content is NOT used for hashing, offsets, or citation anchoring.
   */
  FORMATTING_SCOPE: 'presentation_only',

  /**
   * Get source authority metadata for export
   * Requirements: 11.1, 11.2, 11.3, 11.4 - Source Authority Declaration
   * 
   * Returns the standard source authority structure for all exports.
   * This declares that the corpus is derived from bdlaws HTML only,
   * with no Gazette PDF comparison or correction.
   * 
   * @returns {Object} Source authority metadata object for export
   */
  getSourceAuthorityMetadata() {
    return {
      source_authority: this.SOURCE_AUTHORITY,
      authority_rank: this.AUTHORITY_RANK
    };
  },

  /**
   * Get formatting scope metadata for export
   * Requirements: 12.1, 12.2, 12.3, 12.4 - Formatting Scope Declaration
   * 
   * Returns the formatting scope when formatting has been applied.
   * This indicates that formatting is for presentation only and
   * should not be used for legal analysis.
   * 
   * @param {boolean} formattingApplied - Whether formatting was applied to content
   * @returns {Object|null} Formatting scope metadata or null if no formatting applied
   */
  getFormattingScopeMetadata(formattingApplied) {
    if (formattingApplied) {
      return {
        formatting_scope: this.FORMATTING_SCOPE
      };
    }
    return null;
  },

  /**
   * Get temporal status metadata for export
   * Requirements: 7.1, 7.2, 7.3, 7.4 - Temporal Status Marking
   * 
   * Returns the standard temporal status structure for all exports.
   * Every act is marked as "historical_text" with no inference of current applicability.
   * 
   * CRITICAL: This function ALWAYS returns "historical_text" regardless of
   * any other factors. We do NOT infer "current law" or "currently applicable".
   * 
   * @returns {Object} Temporal status metadata object for export
   */
  getTemporalStatusMetadata() {
    return {
      temporal_status: this.TEMPORAL_STATUS,
      temporal_disclaimer: this.TEMPORAL_DISCLAIMER
    };
  },

  /**
   * Get complete legal status and temporal metadata for export
   * Requirements: 6.1-6.3, 7.1-7.4 - Combined status metadata
   * 
   * Combines legal status detection with temporal status marking
   * for a complete status metadata object.
   * 
   * @param {Document} document - The DOM document to analyze (optional)
   * @returns {Object} Combined status metadata for export
   */
  getLegalStatusMetadata(document) {
    // Get legal status from document if provided
    const legalStatus = document ? this.detectLegalStatus(document) : {
      legal_status: 'unknown',
      status_source: null,
      status_indicators: []
    };

    // Get temporal status (always "historical_text")
    const temporalStatus = this.getTemporalStatusMetadata();

    return {
      legal_status: legalStatus.legal_status,
      status_source: legalStatus.status_source,
      status_indicators: legalStatus.status_indicators,
      ...temporalStatus
    };
  },

  // ============================================
  // SCHEDULE HTML PRESERVATION
  // Requirements: 8.1-8.6 - Legal Integrity Enhancement
  // ============================================

  /**
   * Schedule detection selectors for DOM extraction
   * Requirements: 8.1 - Detect schedule/table elements in DOM
   * 
   * These selectors identify schedule and table elements that should be
   * preserved as raw HTML without any cleaning or transformation.
   */
  SCHEDULE_SELECTORS: [
    '.schedule',
    '#schedule',
    '.tofshil',
    '[class*="schedule"]',
    '[id*="schedule"]',
    '[class*="tofshil"]'
  ],

  /**
   * Schedule marker patterns for detecting schedule sections
   * Requirements: 8.1 - Detect schedule markers in content
   */
  SCHEDULE_MARKER_PATTERNS: [
    /তফসিল/gi,                              // Bengali "Schedule"
    /Schedule\s*[IVXLCDM\d]*/gi,            // English "Schedule" with optional number
    /Appendix\s*[A-Z\d]*/gi,                // Appendix markers
    /Form\s*[A-Z\d]+/gi                     // Form markers
  ],

  /**
   * Extract schedule HTML verbatim from DOM
   * Requirements: 8.1, 8.2, 8.3, 8.4 - Schedule Raw HTML Preservation
   * 
   * Extracts schedule and table HTML content verbatim from the DOM without
   * any cleaning, flattening, or transformation. This preserves the exact
   * structure and formatting of schedules which often contain legally
   * sensitive numeric data.
   * 
   * Returns object with:
   * - representation: "raw_html" (always)
   * - extraction_method: "verbatim_dom_capture" (always)
   * - processed: false (always - no processing applied)
   * - html_content: The raw HTML string (or null if no schedules found)
   * - schedule_count: Number of schedule elements found
   * - has_tables: Whether any tables were found
   * - missing_schedule_flag: True if schedule markers found but no HTML content
   * 
   * CRITICAL: This function does NOT flatten, clean, or transform the HTML.
   * The raw HTML is preserved exactly as extracted from the DOM.
   * 
   * @param {Document} document - The DOM document to extract from
   * @returns {Object} Schedule extraction result with raw HTML and metadata
   */
  extractScheduleHTML(document) {
    // Default result structure
    // Requirements: 8.2, 8.3, 8.4 - Set required metadata fields
    const result = {
      representation: 'raw_html',
      extraction_method: 'verbatim_dom_capture',
      processed: false,
      html_content: null,
      schedule_count: 0,
      has_tables: false,
      missing_schedule_flag: false,
      schedule_elements: []
    };

    // Validate input
    if (!document) {
      return result;
    }

    const scheduleElements = [];
    const seenHtml = new Set(); // Track unique HTML to avoid duplicates

    // Step 1: Find schedule elements using dedicated selectors
    for (const selector of this.SCHEDULE_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          // Get the outer HTML verbatim
          // Requirements: 8.1 - Extract schedule/table HTML verbatim from DOM
          const html = element.outerHTML;
          if (html && !seenHtml.has(html)) {
            seenHtml.add(html);
            scheduleElements.push({
              selector: selector,
              html: html,
              has_table: element.querySelector('table') !== null || element.tagName === 'TABLE'
            });
          }
        }
      } catch (e) {
        // Selector failed, continue with next
        continue;
      }
    }

    // Step 2: Find tables that may be schedules (tables within content areas)
    // Look for tables in common content containers
    const contentSelectors = ['#lawContent', '.law-content', '.act-details', '.boxed-layout', '.txt-details'];
    for (const containerSelector of contentSelectors) {
      try {
        const container = document.querySelector(containerSelector);
        if (container) {
          const tables = container.querySelectorAll('table');
          for (const table of tables) {
            const html = table.outerHTML;
            if (html && !seenHtml.has(html)) {
              seenHtml.add(html);
              scheduleElements.push({
                selector: `${containerSelector} table`,
                html: html,
                has_table: true
              });
            }
          }
        }
      } catch (e) {
        // Selector failed, continue with next
        continue;
      }
    }

    // Step 3: Check for schedule markers in text content to detect missing schedules
    // Requirements: 8.6 - Flag missing schedules without inferring content
    let hasScheduleMarkers = false;
    try {
      const bodyText = document.body ? document.body.textContent || '' : '';
      for (const pattern of this.SCHEDULE_MARKER_PATTERNS) {
        const freshPattern = new RegExp(pattern.source, pattern.flags);
        if (freshPattern.test(bodyText)) {
          hasScheduleMarkers = true;
          break;
        }
      }
    } catch (e) {
      // Text extraction failed, continue
    }

    // Step 4: Build result
    if (scheduleElements.length > 0) {
      // Combine all schedule HTML into single content
      // Requirements: 8.5 - Do not flatten or clean schedule HTML
      result.html_content = scheduleElements.map(el => el.html).join('\n\n');
      result.schedule_count = scheduleElements.length;
      result.has_tables = scheduleElements.some(el => el.has_table);
      result.schedule_elements = scheduleElements.map(el => ({
        selector: el.selector,
        has_table: el.has_table,
        html_length: el.html.length
      }));
    } else if (hasScheduleMarkers) {
      // Schedule markers found but no HTML content
      // Requirements: 8.6 - Flag missing schedules without inferring content
      result.missing_schedule_flag = true;
    }

    return result;
  },

  /**
   * Check if content has schedule references but missing schedule HTML
   * Requirements: 8.6 - Flag missing schedules without inferring content
   * 
   * This function checks if the text content contains schedule references
   * (e.g., "First Schedule", "তফসিল") but the DOM extraction found no
   * schedule HTML elements. This indicates a potential missing schedule.
   * 
   * IMPORTANT: This function only FLAGS missing schedules. It does NOT
   * infer or generate schedule content.
   * 
   * @param {string} textContent - The text content to check for schedule references
   * @param {Object} scheduleResult - Result from extractScheduleHTML
   * @returns {Object} {missing: boolean, references: string[]}
   */
  checkMissingSchedules(textContent, scheduleResult) {
    const result = {
      missing: false,
      references: []
    };

    // Validate inputs
    if (!textContent || typeof textContent !== 'string') {
      return result;
    }

    // Find all schedule references in text
    const references = [];
    for (const pattern of this.SCHEDULE_MARKER_PATTERNS) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = freshPattern.exec(textContent)) !== null) {
        if (!references.includes(match[0])) {
          references.push(match[0]);
        }
      }
    }

    // Check if we have references but no HTML content
    if (references.length > 0) {
      result.references = references;
      
      // Missing if no schedule HTML was extracted
      if (!scheduleResult || !scheduleResult.html_content) {
        result.missing = true;
      }
    }

    return result;
  },

  /**
   * Get schedule metadata for export
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6 - Schedule HTML Preservation
   * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6 - Schedule Reference vs Table DOM Distinction
   * 
   * Returns the complete schedule metadata structure for export.
   * This ensures all exports include the required schedule fields.
   * 
   * @param {Document} document - The DOM document to extract from
   * @param {string} textContent - Optional text content for missing schedule detection
   * @returns {Object} Schedule metadata object for export
   */
  getScheduleMetadata(document, textContent = null) {
    // Extract schedule HTML
    const scheduleResult = this.extractScheduleHTML(document);

    // Check for missing schedules if text content provided
    let missingCheck = { missing: false, references: [] };
    let scheduleDistinction = { 
      schedule_reference_count: 0, 
      schedule_table_count: 0, 
      missing_schedule: false,
      references: [],
      tables: []
    };
    
    if (textContent) {
      missingCheck = this.checkMissingSchedules(textContent, scheduleResult);
      // Requirements: 3.1, 3.2, 3.3, 3.5, 3.6 - Get schedule reference vs table DOM distinction
      scheduleDistinction = this.detectScheduleDistinction(document, textContent);
    }

    // Build export metadata
    // Requirements: 3.2, 3.3 - Set missing_schedule: true only when reference exists but no table DOM
    return {
      representation: scheduleResult.representation,
      extraction_method: scheduleResult.extraction_method,
      processed: scheduleResult.processed,
      html_content: scheduleResult.html_content,
      schedule_count: scheduleResult.schedule_count,
      has_tables: scheduleResult.has_tables,
      // Use the new distinction logic for missing_schedule_flag
      // Requirements: 3.2 - Set missing_schedule: true only when reference exists but no table DOM
      missing_schedule_flag: scheduleDistinction.missing_schedule || scheduleResult.missing_schedule_flag || missingCheck.missing,
      missing_schedule_references: missingCheck.references,
      // New fields for schedule reference vs table DOM distinction
      // Requirements: 3.5 - Record schedule_reference_count and schedule_table_count separately
      schedule_reference_count: scheduleDistinction.schedule_reference_count,
      schedule_table_count: scheduleDistinction.schedule_table_count
    };
  },

  // ============================================
  // SCHEDULE REFERENCE VS TABLE DOM DISTINCTION
  // Requirements: 3.1, 3.2, 3.3, 3.5, 3.6 - Textual Fidelity Extraction
  // ============================================

  /**
   * Schedule reference patterns for text detection
   * Requirements: 3.1, 3.5 - Detect text references to তফসিল/Schedule
   * 
   * These patterns detect textual references to schedules in content,
   * separate from actual table DOM elements.
   */
  SCHEDULE_REFERENCE_PATTERNS: [
    /তফসিল/gi,                              // Bengali "Schedule"
    /প্রথম\s*তফসিল/gi,                      // Bengali "First Schedule"
    /দ্বিতীয়\s*তফসিল/gi,                   // Bengali "Second Schedule"
    /তৃতীয়\s*তফসিল/gi,                     // Bengali "Third Schedule"
    /Schedule\s*[IVXLCDM\d]*/gi,            // English "Schedule" with optional number
    /First\s+Schedule/gi,                   // English "First Schedule"
    /Second\s+Schedule/gi,                  // English "Second Schedule"
    /Third\s+Schedule/gi,                   // English "Third Schedule"
    /Appendix\s*[A-Z\d]*/gi                 // Appendix markers
  ],

  /**
   * Count text references to schedules in content
   * Requirements: 3.1, 3.5 - Count text references to তফসিল/Schedule
   * 
   * Counts all textual references to schedules in the content.
   * This is separate from counting actual table DOM elements.
   * 
   * IMPORTANT: This counts STRING OCCURRENCES, not semantic schedule sections.
   * A reference like "See First Schedule" is counted, but this does NOT
   * imply the schedule content exists or is complete.
   * 
   * @param {string} content - Text content to analyze
   * @returns {Object} {schedule_reference_count: number, references: Array<{text, position}>}
   */
  countScheduleReferences(content) {
    const result = {
      schedule_reference_count: 0,
      references: []
    };

    // Validate input
    if (!content || typeof content !== 'string') {
      return result;
    }

    const seenPositions = new Set(); // Avoid counting overlapping matches

    // Search for each pattern
    for (const pattern of this.SCHEDULE_REFERENCE_PATTERNS) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      let match;
      
      while ((match = freshPattern.exec(content)) !== null) {
        const position = match.index;
        
        // Check if this position overlaps with an already counted reference
        let overlaps = false;
        for (const seenPos of seenPositions) {
          // Check if positions are within 5 characters (to handle overlapping patterns)
          if (Math.abs(position - seenPos) < 5) {
            overlaps = true;
            break;
          }
        }
        
        if (!overlaps) {
          seenPositions.add(position);
          result.references.push({
            text: match[0],
            position: position
          });
        }
      }
    }

    result.schedule_reference_count = result.references.length;
    return result;
  },

  /**
   * Count actual table DOM elements in document
   * Requirements: 3.1, 3.5 - Count actual table DOM elements
   * 
   * Counts the number of <table> elements in the DOM.
   * This is separate from counting textual schedule references.
   * 
   * IMPORTANT: This counts DOM elements, not semantic schedule tables.
   * A table may or may not be a schedule table - this function only
   * counts the presence of table elements.
   * 
   * @param {Document} document - The DOM document to analyze
   * @returns {Object} {schedule_table_count: number, tables: Array<{selector, has_content}>}
   */
  countScheduleTableDOM(document) {
    const result = {
      schedule_table_count: 0,
      tables: []
    };

    // Validate input
    if (!document) {
      return result;
    }

    const seenHtml = new Set(); // Track unique tables to avoid duplicates

    // First, look for tables in schedule-specific containers
    const scheduleContainerSelectors = [
      '.schedule table',
      '#schedule table',
      '.tofshil table',
      '[class*="schedule"] table'
    ];

    for (const selector of scheduleContainerSelectors) {
      try {
        const tables = document.querySelectorAll(selector);
        for (const table of tables) {
          const html = table.outerHTML;
          if (html && !seenHtml.has(html)) {
            seenHtml.add(html);
            result.tables.push({
              selector: selector,
              has_content: table.textContent && table.textContent.trim().length > 0
            });
          }
        }
      } catch (e) {
        // Selector failed, continue
        continue;
      }
    }

    // Then, look for tables in content areas
    const contentSelectors = ['#lawContent', '.law-content', '.act-details', '.boxed-layout', '.txt-details'];
    for (const containerSelector of contentSelectors) {
      try {
        const container = document.querySelector(containerSelector);
        if (container) {
          const tables = container.querySelectorAll('table');
          for (const table of tables) {
            const html = table.outerHTML;
            if (html && !seenHtml.has(html)) {
              seenHtml.add(html);
              result.tables.push({
                selector: `${containerSelector} table`,
                has_content: table.textContent && table.textContent.trim().length > 0
              });
            }
          }
        }
      } catch (e) {
        // Selector failed, continue
        continue;
      }
    }

    result.schedule_table_count = result.tables.length;
    return result;
  },

  /**
   * Detect schedule reference vs table DOM distinction
   * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6 - Schedule Reference vs Content Distinction
   * 
   * Analyzes both text references and DOM tables to determine:
   * - schedule_reference_count: Number of text references to schedules
   * - schedule_table_count: Number of actual table DOM elements
   * - missing_schedule: True if references exist but no table DOM
   * 
   * CRITICAL: This function does NOT classify text references as table_schedule
   * numeric regions. Text references are string occurrences only.
   * 
   * @param {Document} document - The DOM document to analyze
   * @param {string} content - Text content to analyze for references
   * @returns {Object} Schedule distinction result with counts and missing_schedule flag
   */
  detectScheduleDistinction(document, content) {
    // Count text references
    const referenceResult = this.countScheduleReferences(content);
    
    // Count table DOM elements
    const tableResult = this.countScheduleTableDOM(document);

    // Determine missing_schedule flag
    // Requirements: 3.2, 3.3 - Set missing_schedule: true only when reference exists but no table DOM
    const missing_schedule = referenceResult.schedule_reference_count > 0 && 
                             tableResult.schedule_table_count === 0;

    return {
      schedule_reference_count: referenceResult.schedule_reference_count,
      schedule_table_count: tableResult.schedule_table_count,
      missing_schedule: missing_schedule,
      references: referenceResult.references,
      tables: tableResult.tables
    };
  },

  // ============================================
  // EXTRACTION RISK DETECTION
  // Requirements: 13.1-13.6 - Legal Integrity Enhancement
  // ============================================

  /**
   * Selectors for detecting pagination elements
   * Requirements: 13.1 - Detect pagination elements
   */
  PAGINATION_SELECTORS: [
    '.pagination',
    '.page-nav',
    '.pager',
    '.page-numbers',
    '[data-page]',
    '[class*="pagination"]',
    '[class*="pager"]',
    'nav[aria-label*="page"]',
    '.page-link',
    '.page-item'
  ],

  /**
   * Selectors for detecting lazy-loaded content
   * Requirements: 13.2 - Detect lazy-loaded content
   */
  LAZY_LOAD_SELECTORS: [
    '[data-src]',
    '[loading="lazy"]',
    '.lazy-load',
    '.lazy',
    '[data-lazy]',
    '[class*="lazy"]',
    'img[data-original]',
    '[data-srcset]'
  ],

  /**
   * Selectors for detecting external schedule/appendix links
   * Requirements: 13.3 - Detect external schedule links
   */
  EXTERNAL_SCHEDULE_SELECTORS: [
    'a[href*="schedule"]',
    'a[href*="appendix"]',
    'a[href*="tofshil"]',
    'a[href*="form"]',
    'a[href*="annex"]',
    'a[href*="attachment"]'
  ],

  /**
   * Selectors for detecting hidden DOM elements
   * Requirements: 13.4 - Detect hidden DOM elements
   */
  HIDDEN_DOM_SELECTORS: [
    '[style*="display:none"]',
    '[style*="display: none"]',
    '[hidden]',
    '.hidden',
    '.d-none',
    '[aria-hidden="true"]',
    '.collapse:not(.show)',
    '.tab-pane:not(.active)',
    '[style*="visibility:hidden"]',
    '[style*="visibility: hidden"]'
  ],

  /**
   * Detect extraction risks in a document
   * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6 - Extraction Risk Detection
   * 
   * Detects potential issues that could cause content truncation or incompleteness:
   * - Pagination elements (content may be split across pages)
   * - Lazy-loaded content (content may not be fully loaded)
   * - External schedule links (schedules may be on separate pages)
   * - Hidden DOM elements (content may be hidden and not extracted)
   * 
   * Returns object with:
   * - possible_truncation: boolean indicating if truncation risk exists
   * - reason: string describing the detected risk(s), or "none" if no risks
   * - detected_risks: array of detailed risk information
   * 
   * IMPORTANT: This function only FLAGS risks. It does NOT attempt to
   * resolve or work around them. The caller must decide how to handle.
   * 
   * @param {Document} document - The DOM document to analyze
   * @returns {Object} {possible_truncation: boolean, reason: string, detected_risks: Array}
   */
  detectExtractionRisks(document) {
    // Default result - no risks detected
    const result = {
      possible_truncation: false,
      reason: 'none',
      detected_risks: []
    };

    // Validate input
    if (!document) {
      return result;
    }

    const reasons = [];
    const detectedRisks = [];

    // Requirements: 13.1 - Check for pagination elements
    for (const selector of this.PAGINATION_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          // Verify at least one element has meaningful content
          for (const el of elements) {
            const text = el.textContent || '';
            // Check if it looks like actual pagination (has numbers or page indicators)
            if (/\d|page|next|prev|পৃষ্ঠা/i.test(text) || el.querySelector('a')) {
              if (!reasons.includes('pagination')) {
                reasons.push('pagination');
              }
              detectedRisks.push({
                type: 'pagination',
                selector: selector,
                element_count: elements.length,
                sample_text: text.substring(0, 100).trim()
              });
              break;
            }
          }
        }
      } catch (e) {
        // Selector failed, continue with next
        continue;
      }
    }

    // Requirements: 13.2 - Check for lazy-loaded content
    for (const selector of this.LAZY_LOAD_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          if (!reasons.includes('lazy_load')) {
            reasons.push('lazy_load');
          }
          detectedRisks.push({
            type: 'lazy_load',
            selector: selector,
            element_count: elements.length
          });
          break; // One detection is enough for this category
        }
      } catch (e) {
        // Selector failed, continue with next
        continue;
      }
    }

    // Requirements: 13.3 - Check for external schedule links
    for (const selector of this.EXTERNAL_SCHEDULE_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          // Verify links point to different pages (not anchors on same page)
          for (const el of elements) {
            const href = el.getAttribute('href') || '';
            // Skip anchor links (same page references)
            if (href.startsWith('#')) {
              continue;
            }
            // Skip javascript: links
            if (href.startsWith('javascript:')) {
              continue;
            }
            // This is an external link to schedule content
            if (!reasons.includes('external_link')) {
              reasons.push('external_link');
            }
            detectedRisks.push({
              type: 'external_link',
              selector: selector,
              href: href,
              link_text: (el.textContent || '').substring(0, 100).trim()
            });
          }
        }
      } catch (e) {
        // Selector failed, continue with next
        continue;
      }
    }

    // Requirements: 13.4 - Check for hidden DOM elements
    // Only flag if hidden elements contain substantial content
    for (const selector of this.HIDDEN_DOM_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          for (const el of elements) {
            const text = el.textContent || '';
            // Only flag if hidden element has substantial content (>50 chars)
            // This avoids flagging empty hidden elements or small UI elements
            if (text.trim().length > 50) {
              if (!reasons.includes('hidden_dom')) {
                reasons.push('hidden_dom');
              }
              detectedRisks.push({
                type: 'hidden_dom',
                selector: selector,
                content_length: text.length,
                sample_text: text.substring(0, 100).trim()
              });
              break; // One detection is enough for this category
            }
          }
        }
      } catch (e) {
        // Selector failed, continue with next
        continue;
      }
    }

    // Build final result
    // Requirements: 13.5 - Set possible_truncation based on detected risks
    if (reasons.length > 0) {
      result.possible_truncation = true;
      result.reason = reasons.join(', ');
      result.detected_risks = detectedRisks;
    }

    return result;
  },

  /**
   * Get extraction risk metadata for export
   * Requirements: 13.6 - Include extraction_risk in every exported act
   * 
   * Returns the extraction risk structure for export.
   * This ensures all exports include the required extraction_risk fields.
   * 
   * @param {Document} document - The DOM document to analyze
   * @returns {Object} Extraction risk metadata object for export
   */
  getExtractionRiskMetadata(document) {
    const riskResult = this.detectExtractionRisks(document);
    
    // Return the standard export structure
    // Requirements: 13.6 - Include possible_truncation and reason fields
    return {
      possible_truncation: riskResult.possible_truncation,
      reason: riskResult.reason,
      detected_risks: riskResult.detected_risks
    };
  },

  // ============================================
  // NUMERIC REPRESENTATION RECORDING
  // Requirements: 14.1-14.5 - Legal Integrity Enhancement
  // ============================================

  /**
   * Detect numeric representation types in content
   * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5 - Numeric Representation Recording
   * 
   * Detects the types of numeric digits used in the content:
   * - Bengali digits (০-৯): U+09E6 to U+09EF
   * - English digits (0-9): ASCII 0x30 to 0x39
   * 
   * Returns object with:
   * - numeric_representation: Array containing "bn_digits", "en_digits", or both
   * - bn_digit_count: Count of Bengali digits found
   * - en_digit_count: Count of English digits found
   * - is_mixed: Boolean indicating if both digit types are present
   * 
   * IMPORTANT: This function does NOT attempt to convert or normalize
   * digit representations. It only records what is present.
   * 
   * @param {string} content - Content to analyze
   * @returns {Object} {numeric_representation: string[], bn_digit_count: number, en_digit_count: number, is_mixed: boolean}
   */
  detectNumericRepresentation(content) {
    // Default result structure
    const result = {
      numeric_representation: [],
      bn_digit_count: 0,
      en_digit_count: 0,
      is_mixed: false
    };

    // Validate input
    if (!content || typeof content !== 'string') {
      return result;
    }

    // Requirements: 14.1 - Detect Bengali digits (০-৯)
    // Bengali digits are in Unicode range U+09E6 to U+09EF
    const bengaliDigits = content.match(/[০-৯]/g) || [];
    result.bn_digit_count = bengaliDigits.length;

    // Requirements: 14.2 - Detect English digits (0-9)
    const englishDigits = content.match(/[0-9]/g) || [];
    result.en_digit_count = englishDigits.length;

    // Requirements: 14.3 - Record numeric_representation as array
    if (result.bn_digit_count > 0) {
      result.numeric_representation.push('bn_digits');
    }
    if (result.en_digit_count > 0) {
      result.numeric_representation.push('en_digits');
    }

    // Requirements: 14.5 - Flag mixed representation for downstream awareness
    result.is_mixed = result.numeric_representation.length > 1;

    // Requirements: 14.4 - Do NOT attempt to convert or normalize digit representations
    // This function only records what is present, no conversion is performed

    return result;
  },

  // ============================================
  // PREAMBLE AND ENACTMENT CLAUSE DETECTION
  // Requirements: Textual Fidelity Alignment
  // ============================================

  /**
   * Preamble and enactment clause detection patterns
   * 
   * These patterns identify formal legislative components:
   * - Preamble: "WHEREAS...", "যেহেতু..." (Bengali)
   * - Enactment clause: "It is hereby enacted...", "Be it enacted...", "এতদ্দ্বারা প্রণীত হইল..."
   * 
   * IMPORTANT: These patterns detect presence in content_raw.
   * If present, they should be captured. If absent, completeness
   * should be marked as "textual_partial" with appropriate limitation.
   */
  PREAMBLE_PATTERNS: [
    /\bWHEREAS\b/gi,                        // English preamble marker
    /\bযেহেতু\b/g,                          // Bengali preamble marker
    /\bPreamble\b/gi,                       // Explicit preamble label
    /\bপ্রস্তাবনা\b/g                        // Bengali "preamble"
  ],

  ENACTMENT_CLAUSE_PATTERNS: [
    /\bIt is hereby enacted\b/gi,           // English enactment clause
    /\bBe it enacted\b/gi,                  // Alternative English form
    /\bBe it therefore enacted\b/gi,        // Formal English form
    /\bএতদ্দ্বারা প্রণীত হইল\b/g,            // Bengali enactment clause
    /\bএতদ্দ্বারা আইন প্রণয়ন করা হইল\b/g,   // Alternative Bengali form
    /\bনিম্নরূপ আইন প্রণয়ন করা হইল\b/g      // Another Bengali form
  ],

  /**
   * Bengali Legal Patterns Configuration Object
   * Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3 - Textual Fidelity Extraction
   * 
   * Comprehensive pattern definitions for detecting Bengali legal document structures.
   * Detection only - no content modification.
   * 
   * IMPORTANT: These patterns are used for metadata recording only.
   * content_raw is NEVER modified based on pattern detection.
   */
  BengaliLegalPatterns: {
    // Preamble patterns (Requirements 8.1, 8.2, 8.3)
    preamble: {
      // Bengali preamble start pattern - "Whereas"
      start: /যেহেতু/g,
      // Bengali preamble continuation - "And whereas"
      continuation: /এবং\s*যেহেতু/g,
      // English preamble patterns
      english: /\bWHEREAS\b|\bWhereas\b/g
    },
    
    // Enactment clause patterns (Requirements 9.1, 9.2, 9.3)
    enactment: {
      // Primary Bengali enactment - "Be it hereby enacted"
      primary: /সেহেতু\s*এতদ্বারা\s*আইন\s*করা\s*হইল/g,
      // Bengali variation - "hereby enacted as follows"
      variation: /এতদ্বারা\s*নিম্নরূপ\s*আইন\s*করা\s*হইল/g,
      // English enactment patterns
      english: /\bBe\s+it\s+enacted\b|\bIT\s+IS\s+HEREBY\s+ENACTED\b/gi
    },
    
    // Bengali numeral + danda section markers (Requirements 10.1, 10.2)
    sectionMarkers: {
      // Bengali numerals: ০-৯ (U+09E6 to U+09EF)
      // Danda: ৷ (U+09F7)
      numeralDanda: /[০-৯]+৷/g,
      // Multi-digit patterns
      multiDigit: /[০-৯]{2,}৷/g
    },
    
    // Schedule reference patterns (Requirement 3)
    scheduleReference: {
      bengali: /তফসিল/g,
      english: /\bSchedule\b|\bAppendix\b/gi
    }
  },

  /**
   * Detect preamble presence in content (Enhanced)
   * Requirements: 1.1, 8.1, 8.2, 8.3, 8.4, 8.5 - Textual Fidelity Extraction
   * 
   * Detects Bengali and English preamble patterns and records metadata.
   * CRITICAL: Does NOT modify content_raw - detection is observation-only.
   * 
   * Detects:
   * - Bengali preamble start: "যেহেতু" (Whereas)
   * - Bengali preamble continuation: "এবং যেহেতু" (And whereas)
   * - English preamble: "WHEREAS", "Whereas"
   * 
   * @param {string} content - Content to analyze (content_raw)
   * @returns {Object} Enhanced preamble detection result with:
   *   - has_preamble: boolean - Whether any preamble pattern was detected
   *   - preamble_captured: boolean - Whether preamble text exists in content
   *   - preamble_start_position: number|null - Character offset of first pattern
   *   - preamble_markers: string[] - All detected preamble markers (legacy compatibility)
   *   - preamble_present: boolean - Legacy field (same as has_preamble)
   */
  detectPreamble(content) {
    const result = {
      // New fields per Requirements 8.4, 8.5
      has_preamble: false,
      preamble_captured: false,
      preamble_start_position: null,
      // Legacy fields for backward compatibility
      preamble_present: false,
      preamble_markers: []
    };

    if (!content || typeof content !== 'string') {
      return result;
    }

    // Use BengaliLegalPatterns for enhanced detection
    const patterns = this.BengaliLegalPatterns.preamble;
    let earliestPosition = Infinity;
    let foundAny = false;

    // Check Bengali preamble start pattern (যেহেতু)
    const startPattern = new RegExp(patterns.start.source, patterns.start.flags);
    let match;
    while ((match = startPattern.exec(content)) !== null) {
      foundAny = true;
      result.preamble_markers.push(match[0]);
      if (match.index < earliestPosition) {
        earliestPosition = match.index;
      }
    }

    // Check Bengali preamble continuation pattern (এবং যেহেতু)
    const contPattern = new RegExp(patterns.continuation.source, patterns.continuation.flags);
    while ((match = contPattern.exec(content)) !== null) {
      foundAny = true;
      // Avoid duplicates - continuation contains start
      if (!result.preamble_markers.includes(match[0])) {
        result.preamble_markers.push(match[0]);
      }
      if (match.index < earliestPosition) {
        earliestPosition = match.index;
      }
    }

    // Check English preamble patterns (WHEREAS, Whereas)
    const englishPattern = new RegExp(patterns.english.source, patterns.english.flags);
    while ((match = englishPattern.exec(content)) !== null) {
      foundAny = true;
      result.preamble_markers.push(match[0]);
      if (match.index < earliestPosition) {
        earliestPosition = match.index;
      }
    }

    // Also check legacy PREAMBLE_PATTERNS for backward compatibility
    for (const pattern of this.PREAMBLE_PATTERNS) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      while ((match = freshPattern.exec(content)) !== null) {
        foundAny = true;
        if (!result.preamble_markers.includes(match[0])) {
          result.preamble_markers.push(match[0]);
        }
        if (match.index < earliestPosition) {
          earliestPosition = match.index;
        }
      }
    }

    // Set result fields
    if (foundAny) {
      result.has_preamble = true;
      result.preamble_captured = true;
      result.preamble_start_position = earliestPosition;
      result.preamble_present = true; // Legacy compatibility
    }

    return result;
  },

  /**
   * Detect enactment clause presence in content (Enhanced)
   * Requirements: 1.2, 9.1, 9.2, 9.3, 9.4, 9.5 - Textual Fidelity Extraction
   * 
   * Detects Bengali and English enactment clause patterns and records metadata.
   * CRITICAL: Does NOT modify content_raw - detection is observation-only.
   * 
   * Detects:
   * - Bengali primary: "সেহেতু এতদ্বারা আইন করা হইল" (Be it hereby enacted)
   * - Bengali variation: "এতদ্বারা নিম্নরূপ আইন করা হইল"
   * - English: "Be it enacted", "IT IS HEREBY ENACTED"
   * 
   * @param {string} content - Content to analyze (content_raw)
   * @returns {Object} Enhanced enactment clause detection result with:
   *   - has_enactment_clause: boolean - Whether any enactment pattern was detected
   *   - enactment_clause_captured: boolean - Whether enactment text exists in content
   *   - enactment_clause_position: number|null - Character offset of pattern
   *   - enactment_markers: string[] - All detected enactment markers (legacy compatibility)
   *   - enactment_clause_present: boolean - Legacy field (same as has_enactment_clause)
   */
  detectEnactmentClause(content) {
    const result = {
      // New fields per Requirements 9.4, 9.5
      has_enactment_clause: false,
      enactment_clause_captured: false,
      enactment_clause_position: null,
      // Legacy fields for backward compatibility
      enactment_clause_present: false,
      enactment_markers: []
    };

    if (!content || typeof content !== 'string') {
      return result;
    }

    // Use BengaliLegalPatterns for enhanced detection
    const patterns = this.BengaliLegalPatterns.enactment;
    let earliestPosition = Infinity;
    let foundAny = false;

    // Check Bengali primary enactment pattern
    const primaryPattern = new RegExp(patterns.primary.source, patterns.primary.flags);
    let match;
    while ((match = primaryPattern.exec(content)) !== null) {
      foundAny = true;
      result.enactment_markers.push(match[0]);
      if (match.index < earliestPosition) {
        earliestPosition = match.index;
      }
    }

    // Check Bengali variation pattern
    const variationPattern = new RegExp(patterns.variation.source, patterns.variation.flags);
    while ((match = variationPattern.exec(content)) !== null) {
      foundAny = true;
      if (!result.enactment_markers.includes(match[0])) {
        result.enactment_markers.push(match[0]);
      }
      if (match.index < earliestPosition) {
        earliestPosition = match.index;
      }
    }

    // Check English enactment patterns
    const englishPattern = new RegExp(patterns.english.source, patterns.english.flags);
    while ((match = englishPattern.exec(content)) !== null) {
      foundAny = true;
      result.enactment_markers.push(match[0]);
      if (match.index < earliestPosition) {
        earliestPosition = match.index;
      }
    }

    // Also check legacy ENACTMENT_CLAUSE_PATTERNS for backward compatibility
    for (const pattern of this.ENACTMENT_CLAUSE_PATTERNS) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      while ((match = freshPattern.exec(content)) !== null) {
        foundAny = true;
        if (!result.enactment_markers.includes(match[0])) {
          result.enactment_markers.push(match[0]);
        }
        if (match.index < earliestPosition) {
          earliestPosition = match.index;
        }
      }
    }

    // Set result fields
    if (foundAny) {
      result.has_enactment_clause = true;
      result.enactment_clause_captured = true;
      result.enactment_clause_position = earliestPosition;
      result.enactment_clause_present = true; // Legacy compatibility
    }

    return result;
  },

  /**
   * Detect statutory footnotes in content
   * 
   * Statutory footnotes are different from editorial footnotes.
   * They include revision notes, amendment references, and legislative history.
   * 
   * @param {string} content - Content to analyze
   * @returns {Object} {statutory_footnotes_present: boolean, footnote_count: number}
   */
  detectStatutoryFootnotes(content) {
    const result = {
      statutory_footnotes_present: false,
      footnote_count: 0
    };

    if (!content || typeof content !== 'string') {
      return result;
    }

    // Patterns for statutory footnotes (revision notes, amendment references)
    const statutoryFootnotePatterns = [
      /\[Substituted by\s+[^\]]+\]/gi,      // Substitution notes
      /\[Inserted by\s+[^\]]+\]/gi,         // Insertion notes
      /\[Omitted by\s+[^\]]+\]/gi,          // Omission notes
      /\[Repealed by\s+[^\]]+\]/gi,         // Repeal notes
      /\[Added by\s+[^\]]+\]/gi,            // Addition notes
      /\[Amended by\s+[^\]]+\]/gi,          // Amendment notes
      /\[প্রতিস্থাপিত[^\]]*\]/g,            // Bengali substitution
      /\[সংযোজিত[^\]]*\]/g,                 // Bengali insertion
      /\[বিলুপ্ত[^\]]*\]/g,                 // Bengali omission
      /\[সংশোধিত[^\]]*\]/g                  // Bengali amendment
    ];

    let totalCount = 0;
    for (const pattern of statutoryFootnotePatterns) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      const matches = content.match(freshPattern);
      if (matches) {
        totalCount += matches.length;
      }
    }

    result.statutory_footnotes_present = totalCount > 0;
    result.footnote_count = totalCount;

    return result;
  },

  // ============================================
  // EDITORIAL CONTENT DETECTION
  // Requirements: 15.1-15.6 - Legal Integrity Enhancement
  // ============================================

  /**
   * Editorial content detection patterns
   * Requirements: 15.1, 15.2, 15.3 - Detect footnotes, marginal notes, editor annotations
   * 
   * These patterns identify editorial additions to legal text:
   * - Footnotes: [1], [2], *, †, ‡
   * - Marginal notes: [মার্জিনাল নোট], [Marginal Note]
   * - Editor annotations: [সম্পাদকের নোট], [Editor's Note], [Note:]
   */
  EDITORIAL_PATTERNS: {
    // Requirements: 15.2 - Footnote patterns
    footnote: [
      /\[\d+\]/g,                           // Numbered footnotes [1], [2], etc.
      /\*{1,3}/g,                           // Asterisk footnotes *, **, ***
      /†/g,                                 // Dagger footnote marker
      /‡/g,                                 // Double dagger footnote marker
      /\(\d+\)/g,                           // Parenthetical numbers (1), (2)
      /\[\*\]/g,                            // Bracketed asterisk [*]
      /পাদটীকা/gi                           // Bengali "footnote"
    ],
    // Requirements: 15.1 - Marginal note patterns
    marginal_note: [
      /\[মার্জিনাল নোট[^\]]*\]/gi,          // Bengali marginal note
      /\[Marginal Note[^\]]*\]/gi,          // English marginal note
      /\[পার্শ্ব টীকা[^\]]*\]/gi,           // Bengali side note
      /\[Side Note[^\]]*\]/gi,              // English side note
      /মার্জিনাল নোট\s*:/gi,                // Bengali marginal note with colon
      /Marginal Note\s*:/gi                 // English marginal note with colon
    ],
    // Requirements: 15.3 - Editor annotation patterns
    editor_annotation: [
      /\[সম্পাদকের নোট[^\]]*\]/gi,          // Bengali editor's note
      /\[Editor'?s? Note[^\]]*\]/gi,        // English editor's note
      /\[Note:[^\]]*\]/gi,                  // Generic note
      /\[Ed\.?:[^\]]*\]/gi,                 // Abbreviated editor note
      /\[সম্পাদক:[^\]]*\]/gi,               // Bengali editor
      /সম্পাদকের নোট\s*:/gi,                // Bengali editor's note with colon
      /Editor'?s? Note\s*:/gi               // English editor's note with colon
    ]
  },

  /**
   * Detect editorial content in legal text
   * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6 - Editorial Content Detection
   * 
   * Detects editorial additions to legal text including:
   * - Footnotes (numbered, asterisk, dagger markers)
   * - Marginal notes (Bengali and English)
   * - Editor annotations (Bengali and English)
   * 
   * Returns object with:
   * - editorial_content_present: Boolean indicating if any editorial content found
   * - editorial_types: Array of detected editorial content types
   * 
   * IMPORTANT: This function only DETECTS editorial content. It does NOT
   * remove or modify it. Editorial content is preserved in content_raw
   * exactly as extracted (Requirements: 15.5, 15.6).
   * 
   * @param {string} content - Content to analyze
   * @returns {Object} {editorial_content_present: boolean, editorial_types: string[]}
   */
  detectEditorialContent(content) {
    // Default result structure
    const result = {
      editorial_content_present: false,
      editorial_types: []
    };

    // Validate input
    if (!content || typeof content !== 'string') {
      return result;
    }

    const detectedTypes = [];

    // Check each editorial pattern category
    for (const [type, patterns] of Object.entries(this.EDITORIAL_PATTERNS)) {
      for (const pattern of patterns) {
        // Create fresh regex to avoid state issues with global patterns
        const freshPattern = new RegExp(pattern.source, pattern.flags);
        if (freshPattern.test(content)) {
          // Only add type once even if multiple patterns match
          if (!detectedTypes.includes(type)) {
            detectedTypes.push(type);
          }
          break; // Move to next type after first match
        }
      }
    }

    // Requirements: 15.4 - Record editorial_content_present as true or false
    result.editorial_content_present = detectedTypes.length > 0;
    result.editorial_types = detectedTypes;

    // Requirements: 15.5, 15.6 - NEVER remove or modify editorial content
    // This function only detects; content_raw preserves editorial content exactly

    return result;
  },

  // ============================================
  // LANGUAGE DISTRIBUTION RECORDING
  // Requirements: 19.1-19.5 - Legal Integrity Enhancement
  // ============================================

  /**
   * Calculate language distribution in content
   * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5 - Language Distribution Recording
   * 
   * Calculates the ratio of Bengali and English characters in the content:
   * - Bengali characters: Unicode range U+0980 to U+09FF
   * - English characters: A-Z and a-z (ASCII letters)
   * 
   * Returns object with:
   * - bn_ratio: Decimal ratio of Bengali characters (0.0 to 1.0)
   * - en_ratio: Decimal ratio of English characters (0.0 to 1.0)
   * 
   * Note: Ratios are calculated relative to total Bengali + English characters.
   * Other characters (numbers, punctuation, whitespace) are not counted.
   * 
   * IMPORTANT: This function does NOT attempt to separate or segment
   * content by language (Requirements: 19.5). It only records distribution.
   * 
   * @param {string} content - Content to analyze
   * @returns {Object} {bn_ratio: number, en_ratio: number}
   */
  calculateLanguageDistribution(content) {
    // Default result structure
    const result = {
      bn_ratio: 0,
      en_ratio: 0
    };

    // Validate input
    if (!content || typeof content !== 'string') {
      return result;
    }

    // Requirements: 19.1 - Calculate Bengali character ratio (U+0980-U+09FF)
    const bengaliChars = (content.match(/[\u0980-\u09FF]/g) || []).length;

    // Requirements: 19.2 - Calculate English character ratio (A-Za-z)
    const englishChars = (content.match(/[A-Za-z]/g) || []).length;

    // Calculate total for ratio computation
    const totalChars = bengaliChars + englishChars;

    // Avoid division by zero
    if (totalChars === 0) {
      return result;
    }

    // Requirements: 19.3, 19.4 - Record ratios as decimal (0.0-1.0)
    // Round to 2 decimal places for cleaner output
    result.bn_ratio = Math.round((bengaliChars / totalChars) * 100) / 100;
    result.en_ratio = Math.round((englishChars / totalChars) * 100) / 100;

    // Requirements: 19.5 - Do NOT attempt to separate or segment content by language
    // This function only records distribution, no segmentation is performed

    return result;
  },

  // ============================================
  // FAILURE CLASSIFICATION SYSTEM
  // Requirements: 7.1-7.6 - Textual Fidelity & Extraction Alignment
  // ============================================

  /**
   * Failure reason codes for extraction failures
   * Requirements: 7.1, 7.2 - Failure reason classification
   */
  FAILURE_REASONS: {
    CONTENT_SELECTOR_MISMATCH: 'content_selector_mismatch',
    EMPTY_CONTENT: 'empty_content',
    DOM_NOT_READY: 'dom_not_ready',
    NETWORK_ERROR: 'network_error',
    UNKNOWN: 'unknown'
  },

  /**
   * Retry configuration for extraction failures
   * Requirements: 12.2 - Support configurable maximum retry attempts
   * 
   * Retry mechanism is ONLY triggered for content_selector_mismatch failures.
   * Other failure types (network_error, dom_not_ready, etc.) are NOT retried.
   * 
   * Retries SHALL differ only by selector choice or delay timing;
   * retries SHALL NOT alter content processing, filtering rules, or pattern detection logic.
   */
  RETRY_CONFIG: {
    // Default maximum retry attempts
    // Requirements: 12.2 - Support configurable maximum retry attempts (default: 3)
    max_retries: 3,
    
    // Minimum allowed max_retries
    max_retries_min: 1,
    
    // Maximum allowed max_retries
    max_retries_max: 10,
    
    // Failure reasons that trigger automatic retry
    // Requirements: 12.1, 12.6 - Retry only for content_selector_mismatch
    retryable_failures: ['content_selector_mismatch']
  },

  // ============================================
  // EXTRACTION DELAY AND DOM READINESS CONFIGURATION
  // Requirements: 5.1-5.6 - Textual Fidelity Extraction
  // ============================================

  /**
   * Extraction delay configuration
   * Requirements: 5.2, 5.3, 5.4 - Configurable extraction delay
   * 
   * The extraction delay allows waiting for DOM to stabilize before extraction.
   * This is useful for pages with dynamic content loading.
   * 
   * IMPORTANT: This is different from the queue-level extraction_delay_ms in bdlaw-queue.js
   * which controls delay BETWEEN extractions. This controls delay BEFORE extraction starts.
   */
  EXTRACTION_DELAY_CONFIG: {
    // Default extraction delay (0ms - no delay by default)
    // Requirements: 5.2 - Default: 0ms
    default_delay_ms: 0,
    
    // Minimum allowed delay
    min_delay_ms: 0,
    
    // Maximum allowed delay
    // Requirements: 5.2 - Configurable up to 5000ms
    max_delay_ms: 5000
  },

  /**
   * DOM readiness states
   * Requirements: 5.1, 5.5, 5.6 - DOM readiness verification
   * 
   * DOM readiness indicates whether the page has fully rendered:
   * - "ready": DOM is fully loaded and stable
   * - "uncertain": DOM state cannot be definitively determined
   * - "not_ready": DOM is still loading or incomplete
   */
  DOM_READINESS_STATES: {
    READY: 'ready',
    UNCERTAIN: 'uncertain',
    NOT_READY: 'not_ready'
  },

  /**
   * DOM readiness check configuration
   * Requirements: 5.1, 5.5 - DOM readiness verification
   */
  DOM_READINESS_CONFIG: {
    // Minimum content length to consider DOM ready
    min_content_length: 100,
    
    // Selectors that indicate page is still loading
    loading_indicators: [
      '.loading',
      '.spinner',
      '[data-loading="true"]',
      '.skeleton'
    ]
  },

  /**
   * Legal signal patterns for content validation
   * Requirements: 7.4, 7.5 - Distinguish between "no content found" and "selector didn't match"
   * 
   * These patterns identify legally relevant content that indicates
   * successful extraction of legal text (not navigation/UI content).
   */
  LEGAL_SIGNAL_PATTERNS: {
    // Bengali section markers
    bengali: {
      dhara: /ধারা/,                           // Section marker
      adhyay: /অধ্যায়/,                        // Chapter marker
      tafshil: /তফসিল/,                        // Schedule marker
      numeralDanda: /[০-৯]+৷/,                 // Bengali numeral + danda (১৷, ২৷)
      preamble: /যেহেতু/,                      // Preamble start "Whereas"
      enactment: /সেহেতু\s*এতদ্বারা/           // Enactment clause
    },
    // English legal markers
    english: {
      section: /\bSection\b/i,                 // English section
      chapter: /\bChapter\b/i,                 // English chapter
      schedule: /\bSchedule\b/i,               // English schedule
      preamble: /\bWHEREAS\b/i,                // English preamble
      enactment: /\bBe\s+it\s+enacted\b/i      // English enactment
    }
  },

  /**
   * Check if content contains legal signal markers
   * Requirements: 7.4, 7.5 - Distinguish between "no content found" and "selector didn't match"
   * 
   * Content is considered to have legal signal if it contains at least one of:
   * - Bengali markers: ধারা, অধ্যায়, তফসিল, numeral+danda (১৷, ২৷)
   * - Bengali preamble/enactment: যেহেতু, সেহেতু এতদ্বারা
   * - English markers: Section, Chapter, Schedule
   * - English preamble/enactment: WHEREAS, Be it enacted
   * 
   * This function is used to distinguish between:
   * - content_selector_mismatch: Page has legal content but selector didn't match
   * - empty_content: Page truly has no legal content
   * 
   * @param {string} content - Extracted content to validate
   * @returns {boolean} True if content contains legal signal markers
   */
  hasLegalSignal(content) {
    // Empty or non-string content has no legal signal
    if (!content || typeof content !== 'string') {
      return false;
    }

    // Trim and check for empty content
    const trimmed = content.trim();
    if (trimmed === '') {
      return false;
    }

    // Check Bengali markers
    const bengaliPatterns = this.LEGAL_SIGNAL_PATTERNS.bengali;
    for (const key in bengaliPatterns) {
      if (bengaliPatterns[key].test(trimmed)) {
        return true;
      }
    }

    // Check English markers
    const englishPatterns = this.LEGAL_SIGNAL_PATTERNS.english;
    for (const key in englishPatterns) {
      if (englishPatterns[key].test(trimmed)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Classify extraction failure reason
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6 - Failure reason classification
   * 
   * Classifies failure_reason as one of:
   * - "content_selector_mismatch": Selectors tried but no match, or content has no legal signal
   * - "empty_content": Content found but is empty after trimming
   * - "dom_not_ready": DOM was not ready for extraction
   * - "network_error": Network error occurred during extraction
   * - "unknown": Unable to determine failure reason
   * 
   * CRITICAL: A DOM with visible legal text but no matching selectors SHALL be
   * classified as "content_selector_mismatch", NOT "empty_content".
   * 
   * @param {Object} context - Extraction context
   * @param {Array} context.selectorsAttempted - Array of selectors that were tried
   * @param {boolean} context.domReady - Whether DOM was ready
   * @param {boolean} context.networkError - Whether network error occurred
   * @param {string} context.contentFound - Raw extracted text (may be empty)
   * @returns {string} Failure reason code
   */
  classifyFailure(context) {
    // Validate context
    if (!context || typeof context !== 'object') {
      return this.FAILURE_REASONS.UNKNOWN;
    }

    const {
      selectorsAttempted = [],
      domReady = true,
      networkError = false,
      contentFound = ''
    } = context;

    // Requirements: 7.1 - network_error classification
    if (networkError) {
      return this.FAILURE_REASONS.NETWORK_ERROR;
    }

    // Requirements: 7.1 - dom_not_ready classification
    if (!domReady) {
      return this.FAILURE_REASONS.DOM_NOT_READY;
    }

    // Requirements: 7.3 - When selectors tried but no content found
    if (selectorsAttempted.length > 0 && (!contentFound || contentFound.trim() === '')) {
      return this.FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH;
    }

    // Requirements: 7.1 - empty_content classification
    if (contentFound && contentFound.trim() === '') {
      return this.FAILURE_REASONS.EMPTY_CONTENT;
    }

    // Requirements: 7.4, 7.5 - Content exists but has no legal signal
    // This means we captured non-legal content (like navigation)
    // Treat as selector mismatch, not empty content
    if (contentFound && !this.hasLegalSignal(contentFound)) {
      return this.FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH;
    }

    return this.FAILURE_REASONS.UNKNOWN;
  },

  /**
   * Create a selector attempt record for audit trail
   * Requirements: 6.5, 7.3, 7.6 - Selector attempt tracking
   * 
   * Records each selector attempt with:
   * - selector: The CSS selector that was tried
   * - matched: Whether the selector matched any elements
   * - element_count: Number of elements matched
   * - attempt_order: 0-based index for provable ordering
   * 
   * @param {string} selector - CSS selector that was tried
   * @param {boolean} matched - Whether selector matched
   * @param {number} elementCount - Number of elements matched
   * @param {number} attemptOrder - Order in which selector was tried (0-based)
   * @returns {Object} Selector attempt record
   */
  createSelectorAttempt(selector, matched, elementCount, attemptOrder) {
    return {
      selector: selector || '',
      matched: Boolean(matched),
      element_count: typeof elementCount === 'number' ? elementCount : 0,
      attempt_order: typeof attemptOrder === 'number' ? attemptOrder : 0
    };
  },

  /**
   * Create extraction metadata with failure classification
   * Requirements: 7.2, 7.6 - Extraction metadata for failed extractions
   * 
   * @param {Object} options - Metadata options
   * @param {boolean} options.success - Whether extraction succeeded
   * @param {string} options.failureReason - Failure reason code (if failed)
   * @param {Array} options.selectorsAttempted - Array of selector attempt records
   * @param {string} options.successfulSelector - Selector that succeeded (if any)
   * @param {string} options.extractionMethod - 'primary', 'fallback', or 'body_fallback'
   * @returns {Object} Extraction metadata object
   */
  createExtractionMetadata(options = {}) {
    const {
      success = false,
      failureReason = null,
      selectorsAttempted = [],
      successfulSelector = null,
      extractionMethod = 'primary'
    } = options;

    return {
      extraction_success: success,
      failure_reason: success ? null : (failureReason || this.FAILURE_REASONS.UNKNOWN),
      selectors_attempted: selectorsAttempted,
      successful_selector: successfulSelector,
      extraction_method: extractionMethod,
      all_selectors_exhausted: !success && selectorsAttempted.length > 0
    };
  },

  // ============================================
  // RETRY MECHANISM
  // Requirements: 12.1-12.6 - Textual Fidelity & Extraction Alignment
  // ============================================

  /**
   * Get validated retry configuration
   * Requirements: 12.2 - Support configurable maximum retry attempts
   * 
   * Validates and clamps the provided max_retries value to allowed range.
   * Returns default configuration if no custom value provided.
   * 
   * @param {number} [maxRetries] - Custom max retries value (optional)
   * @returns {Object} Validated retry configuration
   */
  getRetryConfig(maxRetries) {
    const config = { ...this.RETRY_CONFIG };
    
    if (typeof maxRetries === 'number') {
      // Clamp to allowed range
      config.max_retries = Math.max(
        this.RETRY_CONFIG.max_retries_min,
        Math.min(this.RETRY_CONFIG.max_retries_max, Math.floor(maxRetries))
      );
    }
    
    return config;
  },

  /**
   * Check if a failure reason is retryable
   * Requirements: 12.1, 12.6 - Retry only for content_selector_mismatch
   * 
   * CRITICAL: Only content_selector_mismatch failures trigger automatic retry.
   * Other failure types (network_error, dom_not_ready, etc.) are NOT retried.
   * 
   * @param {string} failureReason - The failure reason code
   * @returns {boolean} True if the failure is retryable
   */
  isRetryableFailure(failureReason) {
    if (!failureReason || typeof failureReason !== 'string') {
      return false;
    }
    
    return this.RETRY_CONFIG.retryable_failures.includes(failureReason);
  },

  /**
   * Check if retry should be attempted based on failure and retry count
   * Requirements: 12.1, 12.2, 12.6 - Retry mechanism correctness
   * 
   * Returns true if:
   * 1. The failure reason is retryable (content_selector_mismatch only)
   * 2. The current retry count is less than max_retries
   * 
   * @param {string} failureReason - The failure reason code
   * @param {number} currentRetryCount - Current number of retries attempted
   * @param {number} [maxRetries] - Maximum retries allowed (default: 3)
   * @returns {boolean} True if retry should be attempted
   */
  shouldRetryExtraction(failureReason, currentRetryCount, maxRetries) {
    // Requirements: 12.6 - Do NOT retry for failures unrelated to selector mismatch
    if (!this.isRetryableFailure(failureReason)) {
      return false;
    }
    
    // Get validated max retries
    const config = this.getRetryConfig(maxRetries);
    
    // Requirements: 12.2 - Check against max_retries
    return typeof currentRetryCount === 'number' && 
           currentRetryCount < config.max_retries;
  },

  /**
   * Create retry metadata for tracking retry attempts
   * Requirements: 12.3, 12.4, 12.5 - Retry tracking and logging
   * 
   * Creates metadata object for tracking retry state:
   * - retry_count: Number of retries attempted
   * - max_retries: Maximum retries configured
   * - successful_selector: Selector that succeeded (if any)
   * - all_selectors_exhausted: True when all retries fail
   * - retry_attempts: Array of retry attempt records
   * 
   * @param {Object} options - Retry metadata options
   * @param {number} options.retryCount - Current retry count
   * @param {number} options.maxRetries - Maximum retries allowed
   * @param {string} options.successfulSelector - Selector that succeeded (if any)
   * @param {boolean} options.allSelectorsExhausted - Whether all selectors exhausted
   * @param {Array} options.retryAttempts - Array of retry attempt records
   * @returns {Object} Retry metadata object
   */
  createRetryMetadata(options = {}) {
    const {
      retryCount = 0,
      maxRetries = this.RETRY_CONFIG.max_retries,
      successfulSelector = null,
      allSelectorsExhausted = false,
      retryAttempts = []
    } = options;

    return {
      retry_count: retryCount,
      max_retries: maxRetries,
      successful_selector: successfulSelector,
      all_selectors_exhausted: allSelectorsExhausted,
      retry_attempts: retryAttempts
    };
  },

  /**
   * Log a retry attempt for audit trail
   * Requirements: 12.3 - Log each retry attempt with the selector used
   * 
   * Creates a retry attempt record with:
   * - attempt_number: 1-based retry attempt number
   * - selector_used: The selector tried in this attempt
   * - extraction_method: 'primary', 'fallback', or 'body_fallback'
   * - success: Whether this attempt succeeded
   * - timestamp: ISO timestamp of the attempt
   * 
   * @param {number} attemptNumber - 1-based attempt number
   * @param {string} selectorUsed - Selector tried in this attempt
   * @param {string} extractionMethod - Extraction method used
   * @param {boolean} success - Whether attempt succeeded
   * @returns {Object} Retry attempt record
   */
  createRetryAttemptRecord(attemptNumber, selectorUsed, extractionMethod, success) {
    return {
      attempt_number: typeof attemptNumber === 'number' ? attemptNumber : 1,
      selector_used: selectorUsed || null,
      extraction_method: extractionMethod || 'primary',
      success: Boolean(success),
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Perform extraction with automatic retry for content_selector_mismatch
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6 - Retry mechanism
   * 
   * This function implements the complete retry mechanism:
   * 1. Attempt extraction using _tryAllSelectorsWithFallback
   * 2. If extraction fails with content_selector_mismatch, retry up to max_retries
   * 3. Log each retry attempt with selector used
   * 4. Record retry_count and successful_selector on success
   * 5. Set all_selectors_exhausted: true when all retries fail
   * 6. Do NOT retry for network_error, dom_not_ready, or other failures
   * 
   * CRITICAL: Retries SHALL differ only by selector choice or delay timing;
   * retries SHALL NOT alter content processing, filtering rules, or pattern detection logic.
   * 
   * @param {Document} document - The DOM document to extract from
   * @param {string} contentType - Type of content to extract ('content', 'preamble', 'schedule')
   * @param {Object} options - Retry options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @returns {Object} Extraction result with retry metadata
   */
  extractWithRetry(document, contentType = 'content', options = {}) {
    const config = this.getRetryConfig(options.maxRetries);
    const retryAttempts = [];
    let retryCount = 0;
    let lastResult = null;
    let lastFailureReason = null;

    // Initial extraction attempt (attempt 0)
    lastResult = this._tryAllSelectorsWithFallback(document, contentType);
    
    // Record initial attempt
    retryAttempts.push(this.createRetryAttemptRecord(
      0,
      lastResult.successful_selector,
      lastResult.extraction_method,
      lastResult.extraction_success
    ));

    // If initial extraction succeeded, return immediately
    if (lastResult.extraction_success) {
      return {
        ...lastResult,
        retry_metadata: this.createRetryMetadata({
          retryCount: 0,
          maxRetries: config.max_retries,
          successfulSelector: lastResult.successful_selector,
          allSelectorsExhausted: false,
          retryAttempts
        })
      };
    }

    // Classify the failure
    lastFailureReason = this.classifyFailure({
      selectorsAttempted: lastResult.selectors_attempted,
      domReady: true,
      networkError: false,
      contentFound: lastResult.content
    });

    // Requirements: 12.6 - Do NOT retry for failures unrelated to selector mismatch
    if (!this.isRetryableFailure(lastFailureReason)) {
      return {
        ...lastResult,
        failure_reason: lastFailureReason,
        retry_metadata: this.createRetryMetadata({
          retryCount: 0,
          maxRetries: config.max_retries,
          successfulSelector: null,
          allSelectorsExhausted: true,
          retryAttempts
        })
      };
    }

    // Requirements: 12.1 - Automatic retry for content_selector_mismatch
    while (retryCount < config.max_retries) {
      retryCount++;
      
      // Requirements: 12.3 - Log each retry attempt
      // Retry extraction - same selectors, different attempt
      lastResult = this._tryAllSelectorsWithFallback(document, contentType);
      
      // Record retry attempt
      retryAttempts.push(this.createRetryAttemptRecord(
        retryCount,
        lastResult.successful_selector,
        lastResult.extraction_method,
        lastResult.extraction_success
      ));

      // Requirements: 12.4 - Record retry_count and successful_selector on success
      if (lastResult.extraction_success) {
        return {
          ...lastResult,
          retry_metadata: this.createRetryMetadata({
            retryCount,
            maxRetries: config.max_retries,
            successfulSelector: lastResult.successful_selector,
            allSelectorsExhausted: false,
            retryAttempts
          })
        };
      }

      // Re-classify failure for next iteration
      lastFailureReason = this.classifyFailure({
        selectorsAttempted: lastResult.selectors_attempted,
        domReady: true,
        networkError: false,
        contentFound: lastResult.content
      });

      // If failure is no longer retryable, stop retrying
      if (!this.isRetryableFailure(lastFailureReason)) {
        break;
      }
    }

    // Requirements: 12.5 - Set all_selectors_exhausted: true when all retries fail
    return {
      ...lastResult,
      failure_reason: lastFailureReason,
      retry_metadata: this.createRetryMetadata({
        retryCount,
        maxRetries: config.max_retries,
        successfulSelector: null,
        allSelectorsExhausted: true,
        retryAttempts
      })
    };
  },

  // ============================================
  // EXTRACTION DELAY AND DOM READINESS FUNCTIONS
  // Requirements: 5.1-5.6 - Textual Fidelity Extraction
  // ============================================

  /**
   * Get extraction delay configuration with validation
   * Requirements: 5.2, 5.3 - Support configurable delay (default: 0ms, max: 5000ms)
   * 
   * Validates and clamps the provided delay value to allowed range [0, 5000].
   * Returns default configuration if no custom value provided.
   * 
   * @param {number} delayMs - Requested delay in milliseconds
   * @returns {Object} Configuration with validated delay_ms
   */
  getExtractionDelayConfig(delayMs) {
    const config = { ...this.EXTRACTION_DELAY_CONFIG };
    
    if (typeof delayMs === 'number') {
      // Clamp to allowed range [0, 5000]
      config.delay_ms = Math.max(
        this.EXTRACTION_DELAY_CONFIG.min_delay_ms,
        Math.min(this.EXTRACTION_DELAY_CONFIG.max_delay_ms, Math.floor(delayMs))
      );
    } else {
      config.delay_ms = this.EXTRACTION_DELAY_CONFIG.default_delay_ms;
    }
    
    return config;
  },

  /**
   * Check DOM readiness state
   * Requirements: 5.1, 5.5, 5.6 - Verify DOM readiness before extraction
   * 
   * Determines DOM readiness based on:
   * 1. Document readyState
   * 2. Presence of loading indicators
   * 3. Content availability
   * 
   * Returns one of: "ready", "uncertain", "not_ready"
   * 
   * @param {Document} document - The DOM document to check
   * @returns {string} DOM readiness state
   */
  checkDOMReadiness(document) {
    // No document means not ready
    if (!document) {
      return this.DOM_READINESS_STATES.NOT_READY;
    }

    // Check document readyState
    // Requirements: 5.1 - Verify DOM readiness before selector queries
    if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
      return this.DOM_READINESS_STATES.NOT_READY;
    }

    // Check for loading indicators
    // If any loading indicator is present, DOM is not ready
    for (const selector of this.DOM_READINESS_CONFIG.loading_indicators) {
      try {
        const loadingElement = document.querySelector(selector);
        if (loadingElement) {
          return this.DOM_READINESS_STATES.NOT_READY;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    // Check if body exists and has content
    if (!document.body) {
      return this.DOM_READINESS_STATES.NOT_READY;
    }

    // Check minimum content length
    const bodyText = document.body.textContent || '';
    if (bodyText.trim().length < this.DOM_READINESS_CONFIG.min_content_length) {
      // Content is too short - could be still loading
      return this.DOM_READINESS_STATES.UNCERTAIN;
    }

    // All checks passed
    return this.DOM_READINESS_STATES.READY;
  },

  /**
   * Create extraction delay metadata
   * Requirements: 5.4 - Record extraction_delay_ms in extraction metadata
   * 
   * Creates metadata object for tracking extraction delay state:
   * - extraction_delay_ms: Configured delay in milliseconds
   * - dom_readiness: DOM readiness state at extraction time
   * 
   * @param {Object} options - Metadata options
   * @param {number} options.delayMs - Configured delay in milliseconds
   * @param {string} options.domReadiness - DOM readiness state
   * @returns {Object} Extraction delay metadata
   */
  createExtractionDelayMetadata(options = {}) {
    const {
      delayMs = this.EXTRACTION_DELAY_CONFIG.default_delay_ms,
      domReadiness = this.DOM_READINESS_STATES.READY
    } = options;

    return {
      extraction_delay_ms: delayMs,
      dom_readiness: domReadiness
    };
  },

  /**
   * Apply extraction delay (async)
   * Requirements: 5.3 - Wait the specified duration before extraction
   * 
   * This function returns a Promise that resolves after the specified delay.
   * Used to wait for DOM to stabilize before extraction.
   * 
   * @param {number} delayMs - Delay in milliseconds
   * @returns {Promise<void>} Promise that resolves after delay
   */
  async applyExtractionDelay(delayMs) {
    const config = this.getExtractionDelayConfig(delayMs);
    
    if (config.delay_ms > 0) {
      return new Promise(resolve => setTimeout(resolve, config.delay_ms));
    }
    
    return Promise.resolve();
  },

  /**
   * Extract with delay and DOM readiness check
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6 - Complete extraction with delay
   * 
   * This function implements extraction with:
   * 1. Configurable extraction delay
   * 2. DOM readiness verification
   * 3. Recording of delay and readiness metadata
   * 
   * @param {Document} document - The DOM document to extract from
   * @param {string} contentType - Type of content to extract
   * @param {Object} options - Extraction options
   * @param {number} options.extractionDelayMs - Delay before extraction (default: 0)
   * @param {number} options.maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} Extraction result with delay metadata
   */
  async extractWithDelayAndReadiness(document, contentType = 'content', options = {}) {
    const delayConfig = this.getExtractionDelayConfig(options.extractionDelayMs);
    
    // Requirements: 5.1 - Verify DOM readiness before extraction
    const initialReadiness = this.checkDOMReadiness(document);
    
    // Requirements: 5.5 - Do NOT assume content is missing if extraction occurs before DOM is ready
    // Record the initial readiness state but proceed with extraction
    let finalReadiness = initialReadiness;
    
    // Requirements: 5.3 - Wait the specified duration before extraction
    if (delayConfig.delay_ms > 0) {
      await this.applyExtractionDelay(delayConfig.delay_ms);
      // Re-check readiness after delay
      finalReadiness = this.checkDOMReadiness(document);
    }
    
    // Perform extraction with retry mechanism
    const extractionResult = this.extractWithRetry(document, contentType, {
      maxRetries: options.maxRetries
    });
    
    // Requirements: 5.4 - Record extraction_delay_ms in extraction metadata
    // Requirements: 5.6 - Record dom_readiness in metadata
    const delayMetadata = this.createExtractionDelayMetadata({
      delayMs: delayConfig.delay_ms,
      domReadiness: finalReadiness
    });
    
    return {
      ...extractionResult,
      extraction_delay_metadata: delayMetadata
    };
  },

  /**
   * Synchronous extraction with DOM readiness check (no delay)
   * Requirements: 5.1, 5.4, 5.6 - Extraction with readiness check
   * 
   * This function provides synchronous extraction with DOM readiness check.
   * Use this when async delay is not needed but readiness tracking is required.
   * 
   * @param {Document} document - The DOM document to extract from
   * @param {string} contentType - Type of content to extract
   * @param {Object} options - Extraction options
   * @returns {Object} Extraction result with readiness metadata
   */
  extractWithReadinessCheck(document, contentType = 'content', options = {}) {
    // Requirements: 5.1 - Verify DOM readiness before extraction
    const domReadiness = this.checkDOMReadiness(document);
    
    // Perform extraction with retry mechanism
    const extractionResult = this.extractWithRetry(document, contentType, {
      maxRetries: options.maxRetries
    });
    
    // Requirements: 5.4, 5.6 - Record metadata
    const delayMetadata = this.createExtractionDelayMetadata({
      delayMs: 0, // No delay in synchronous version
      domReadiness: domReadiness
    });
    
    return {
      ...extractionResult,
      extraction_delay_metadata: delayMetadata
    };
  },

  // ============================================
  // DOM-FIRST STRUCTURE EXTRACTION
  // Requirements: Legal Structure Derivation & Reference Anchoring
  // ============================================

  /**
   * Calculate the character offset of text in content_raw
   * Requirements: 2.4, 3.4, 4.4, 5.4, 8.3 - Offset mapping for traceability
   * 
   * Maps DOM-extracted text to exact character offsets in content_raw.
   * This enables full regeneration from content_raw using offsets.
   * 
   * @param {string} text - The text to find (from DOM element textContent)
   * @param {string} contentRaw - The full content_raw string
   * @param {number} searchStart - Optional start position for search (default: 0)
   * @returns {number} Character offset in content_raw, or -1 if not found
   */
  calculateOffsetInContentRaw(text, contentRaw, searchStart = 0) {
    if (!text || !contentRaw || typeof text !== 'string' || typeof contentRaw !== 'string') {
      return -1;
    }
    
    // Trim the text to match how it appears in content_raw
    const trimmedText = text.trim();
    if (!trimmedText) {
      return -1;
    }
    
    // Find exact position using indexOf starting from searchStart
    const offset = contentRaw.indexOf(trimmedText, searchStart);
    return offset;
  },

  /**
   * Detect subsections within section content text
   * Requirements: 4.1, 4.2, 4.3, 4.5, 4.6 - Subsection detection
   * 
   * Parses section content to find Bengali numeral parentheses markers.
   * Records marker text verbatim and relative offset within content.
   * 
   * @param {string} sectionContent - The section body text (from .txt-details textContent)
   * @returns {Array<Object>} Array of {marker, relativeOffset} in document order
   */
  detectSubsectionsInContent(sectionContent) {
    if (!sectionContent || typeof sectionContent !== 'string') {
      return [];
    }
    
    const subsections = [];
    const pattern = new RegExp(this.BENGALI_STRUCTURE_PATTERNS.subsectionMarker.source, 'g');
    let match;
    
    while ((match = pattern.exec(sectionContent)) !== null) {
      subsections.push({
        marker: match[0],           // Exact marker text verbatim
        relativeOffset: match.index // Offset within section content
      });
    }
    
    return subsections;
  },

  /**
   * Detect clauses within section/subsection content text
   * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6 - Clause detection
   * 
   * Parses content to find Bengali letter parentheses markers.
   * Records marker text verbatim and relative offset within content.
   * 
   * @param {string} content - The content text to parse
   * @returns {Array<Object>} Array of {marker, relativeOffset} in document order
   */
  detectClausesInContent(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }
    
    const clauses = [];
    const pattern = new RegExp(this.BENGALI_STRUCTURE_PATTERNS.clauseMarker.source, 'g');
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      clauses.push({
        marker: match[0],           // Exact marker text verbatim
        relativeOffset: match.index // Offset within content
      });
    }
    
    return clauses;
  },

  /**
   * Detect citations in section content text (non-linked references)
   * Requirements: 9.1, 9.2, 9.3, 9.4 - Citation pattern detection
   * 
   * Parses content to find Bengali and English citation patterns.
   * Used for references that are not hyperlinked in the DOM.
   * 
   * @param {string} content - The content text to parse
   * @returns {Array<Object>} Array of {citation_text, relativeOffset, pattern_type} in document order
   */
  detectCitationsInContent(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }
    
    const citations = [];
    
    // Detect Bengali citations using BENGALI_ACT_SHORT pattern
    const bengaliPattern = new RegExp(this.CITATION_PATTERNS.BENGALI_ACT_SHORT.source, 'g');
    let match;
    
    while ((match = bengaliPattern.exec(content)) !== null) {
      citations.push({
        citation_text: match[0],
        relativeOffset: match.index,
        pattern_type: 'bengali_citation'
      });
    }
    
    // Detect English citations using ENGLISH_ACT_SHORT pattern
    const englishPattern = new RegExp(this.CITATION_PATTERNS.ENGLISH_ACT_SHORT.source, 'g');
    
    while ((match = englishPattern.exec(content)) !== null) {
      citations.push({
        citation_text: match[0],
        relativeOffset: match.index,
        pattern_type: 'english_citation'
      });
    }
    
    // Sort by offset to maintain document order
    citations.sort((a, b) => a.relativeOffset - b.relativeOffset);
    
    return citations;
  },

  /**
   * Build the structure tree from DOM-extracted data
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6 - Lossless JSON tree output
   * 
   * Assembles the final structure tree with:
   * - Preamble and enactment clause
   * - Sections with nested subsections and clauses
   * - Character offsets mapped to content_raw
   * - Metadata (counts, extraction method)
   * 
   * @param {Object} params - Structure building parameters
   * @param {Object|null} params.preamble - Preamble data from DOM
   * @param {Object|null} params.enactment - Enactment clause data from DOM
   * @param {Array} params.sections - Sections array from DOM extraction
   * @param {string} params.contentRaw - The content_raw for offset mapping
   * @returns {Object} Complete structure tree
   */
  buildStructureTree({ preamble, enactment, sections, contentRaw }) {
    // Map sections with offsets
    let totalSubsections = 0;
    let totalClauses = 0;
    
    const mappedSections = (sections || []).map((section, index) => {
      // Calculate offsets in content_raw
      const headingOffset = section.heading 
        ? this.calculateOffsetInContentRaw(section.heading, contentRaw)
        : -1;
      const numberOffset = section.section_number
        ? this.calculateOffsetInContentRaw(section.section_number, contentRaw, headingOffset > -1 ? headingOffset : 0)
        : -1;
      
      // Calculate content boundaries
      const contentStart = numberOffset > -1 ? numberOffset : headingOffset;
      let contentEnd = contentRaw.length;
      
      // If there's a next section, end at its start
      if (index < sections.length - 1) {
        const nextSection = sections[index + 1];
        const nextHeadingOffset = nextSection.heading
          ? this.calculateOffsetInContentRaw(nextSection.heading, contentRaw, contentStart + 1)
          : -1;
        if (nextHeadingOffset > -1) {
          contentEnd = nextHeadingOffset;
        }
      }
      
      // Process subsections
      const subsections = (section.subsections || []).map(sub => {
        totalSubsections++;
        const markerOffset = this.calculateOffsetInContentRaw(
          sub.marker, 
          contentRaw, 
          contentStart > -1 ? contentStart : 0
        );
        
        // Process nested clauses
        const nestedClauses = (sub.clauses || []).map(clause => {
          totalClauses++;
          const clauseOffset = this.calculateOffsetInContentRaw(
            clause.marker,
            contentRaw,
            markerOffset > -1 ? markerOffset : contentStart
          );
          return {
            marker: clause.marker,
            marker_offset: clauseOffset,
            content_start: clauseOffset,
            content_end: -1 // Will be calculated based on next element
          };
        });
        
        return {
          marker: sub.marker,
          marker_offset: markerOffset,
          clauses: nestedClauses,
          content_start: markerOffset,
          content_end: -1 // Will be calculated based on next element
        };
      });
      
      // Process direct clauses (not nested in subsections)
      const directClauses = (section.clauses || []).map(clause => {
        totalClauses++;
        const clauseOffset = this.calculateOffsetInContentRaw(
          clause.marker,
          contentRaw,
          contentStart > -1 ? contentStart : 0
        );
        return {
          marker: clause.marker,
          marker_offset: clauseOffset,
          content_start: clauseOffset,
          content_end: -1
        };
      });
      
      return {
        dom_index: section.dom_index !== undefined ? section.dom_index : index,
        section_number: section.section_number || null,
        heading: section.heading || null,
        heading_offset: headingOffset,
        number_offset: numberOffset,
        subsections: subsections,
        clauses: directClauses,
        content_start: contentStart,
        content_end: contentEnd,
        dom_source: '.lineremoves'
      };
    });
    
    // Build preamble structure
    let preambleStructure = null;
    if (preamble && preamble.text) {
      const preambleOffset = this.calculateOffsetInContentRaw(preamble.text, contentRaw);
      preambleStructure = {
        text: preamble.text,
        offset: preambleOffset,
        has_preamble: true,
        dom_source: preamble.dom_source || '.lineremove'
      };
    }
    
    // Build enactment clause structure
    let enactmentStructure = null;
    if (enactment && enactment.text) {
      const enactmentOffset = this.calculateOffsetInContentRaw(enactment.text, contentRaw);
      enactmentStructure = {
        text: enactment.text,
        offset: enactmentOffset,
        has_enactment_clause: true,
        dom_source: enactment.dom_source || '.lineremove'
      };
    }
    
    return {
      preamble: preambleStructure,
      enactment_clause: enactmentStructure,
      sections: mappedSections,
      metadata: {
        total_sections: mappedSections.length,
        total_subsections: totalSubsections,
        total_clauses: totalClauses,
        extraction_method: 'dom_first',
        deterministic: true
      }
    };
  },

  /**
   * Anchor a reference to its structural scope
   * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6 - Reference scope anchoring
   * 
   * Determines the containing section, subsection, and clause for a reference
   * based on its character offset in content_raw.
   * 
   * @param {Object} reference - Reference with character_offset
   * @param {Object} structure - The structure tree
   * @returns {Object} Scope object with section, subsection, clause, dom_section_index
   */
  anchorReferenceScope(reference, structure) {
    const scope = {
      section: null,
      subsection: null,
      clause: null,
      dom_section_index: null
    };
    
    if (!reference || typeof reference.character_offset !== 'number' || !structure) {
      return scope;
    }
    
    const offset = reference.character_offset;
    
    // Find containing section
    const sections = structure.sections || [];
    for (const section of sections) {
      if (section.content_start <= offset && offset < section.content_end) {
        scope.section = section.section_number;
        scope.dom_section_index = section.dom_index;
        
        // Find containing subsection
        for (const subsection of (section.subsections || [])) {
          if (subsection.marker_offset <= offset) {
            scope.subsection = subsection.marker;
            
            // Find containing clause within subsection
            for (const clause of (subsection.clauses || [])) {
              if (clause.marker_offset <= offset) {
                scope.clause = clause.marker;
              }
            }
          }
        }
        
        // If no subsection, check direct clauses
        if (!scope.subsection) {
          for (const clause of (section.clauses || [])) {
            if (clause.marker_offset <= offset) {
              scope.clause = clause.marker;
            }
          }
        }
        
        break;
      }
    }
    
    return scope;
  },

  /**
   * Build cross-references array with scope anchoring
   * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6 - Cross-reference output format
   * 
   * Merges link-based and pattern-detected references, deduplicates by offset,
   * anchors scope, and adds required disclaimers.
   * 
   * @param {Object} params - Build parameters
   * @param {Array} params.linkReferences - References from DOM links
   * @param {Array} params.patternReferences - References from pattern detection
   * @param {Object} params.structure - Structure tree for scope anchoring
   * @param {string} params.contentRaw - Content raw for offset mapping
   * @returns {Array} Complete cross_references array
   */
  buildCrossReferences({ linkReferences, patternReferences, structure, contentRaw }) {
    const allReferences = [];
    const seenOffsets = new Set();
    
    // Process link references first (higher priority)
    for (const ref of (linkReferences || [])) {
      const offset = ref.character_offset;
      if (offset !== -1 && !seenOffsets.has(offset)) {
        seenOffsets.add(offset);
        
        const scope = this.anchorReferenceScope(ref, structure);
        
        allReferences.push({
          citation_text: ref.citation_text,
          character_offset: offset,
          href: ref.href || null,
          act_id: ref.act_id || null,
          scope: scope,
          reference_semantics: this.REFERENCE_SEMANTICS,
          reference_warning: this.REFERENCE_WARNING
        });
      }
    }
    
    // Process pattern references (skip if already covered by link)
    for (const ref of (patternReferences || [])) {
      const offset = ref.character_offset;
      if (offset !== -1 && !seenOffsets.has(offset)) {
        seenOffsets.add(offset);
        
        const scope = this.anchorReferenceScope(ref, structure);
        
        allReferences.push({
          citation_text: ref.citation_text,
          character_offset: offset,
          href: null,
          act_id: null,
          scope: scope,
          reference_semantics: this.REFERENCE_SEMANTICS,
          reference_warning: this.REFERENCE_WARNING
        });
      }
    }
    
    // Sort by character offset to preserve document order
    allReferences.sort((a, b) => a.character_offset - b.character_offset);
    
    return allReferences;
  },

  /**
   * Derive structure and references from extraction result
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5 - Content raw immutability guard
   * 
   * Main entry point for structure derivation. Ensures content_raw remains
   * byte-identical throughout processing.
   * 
   * @param {Object} extractionResult - The extraction result with content_raw
   * @param {Object} structureData - DOM-extracted structure data
   * @returns {Object} New object with structure and cross_references added
   */
  deriveStructureAndReferences(extractionResult, structureData) {
    if (!extractionResult || !extractionResult.content) {
      return {
        ...extractionResult,
        structure: null,
        cross_references: []
      };
    }
    
    const contentRaw = extractionResult.content;
    
    // Store hash before processing for immutability verification
    const contentHashBefore = this._simpleHash(contentRaw);
    
    try {
      // Build structure tree
      const structure = structureData ? this.buildStructureTree({
        preamble: structureData.preamble,
        enactment: structureData.enactment,
        sections: structureData.sections,
        contentRaw: contentRaw
      }) : null;
      
      // Build cross-references
      const crossReferences = structureData ? this.buildCrossReferences({
        linkReferences: structureData.linkReferences || [],
        patternReferences: structureData.patternReferences || [],
        structure: structure,
        contentRaw: contentRaw
      }) : [];
      
      // Verify content_raw immutability
      const contentHashAfter = this._simpleHash(contentRaw);
      if (contentHashBefore !== contentHashAfter) {
        console.error('CRITICAL: content_raw was modified during structure derivation');
        return {
          ...extractionResult,
          structure: null,
          cross_references: [],
          structure_derivation_error: 'content_raw_modified'
        };
      }
      
      return {
        ...extractionResult,
        structure: structure,
        cross_references: crossReferences
      };
    } catch (error) {
      // Never throw - return null structure on error
      console.error('Structure derivation error:', error);
      return {
        ...extractionResult,
        structure: null,
        cross_references: [],
        structure_derivation_error: error.message
      };
    }
  },

  /**
   * Simple hash function for content immutability verification
   * @param {string} str - String to hash
   * @returns {number} Simple hash value
   */
  _simpleHash(str) {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
};

// Set backward compatibility alias for REFERENCE_TYPE_KEYWORDS
// This allows existing code to continue working while transitioning to LEXICAL_RELATION_KEYWORDS
BDLawExtractor.REFERENCE_TYPE_KEYWORDS = BDLawExtractor.LEXICAL_RELATION_KEYWORDS;

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawExtractor;
}
