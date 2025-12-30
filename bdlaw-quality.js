/**
 * BDLawCorpus Data Quality & Remediation Module
 * 
 * Provides data quality assessment, text cleaning, and completeness validation
 * for extracted legal content. Detects missing schedules, encoding errors, and
 * OCR artifacts, then applies configurable cleaning rules while preserving
 * original content for audit purposes.
 * 
 * @module bdlaw-quality
 */

const BDLawQuality = {
  /**
   * Quality configuration for data validation and cleaning
   * Requirements: 1.1, 2.5, 3.5, 8.4
   */
  QUALITY_CONFIG: {
    // Schedule detection patterns
    // Requirements: 1.1, 1.5 - Detect schedule references in English and Bengali
    schedulePatterns: {
      english: [
        /\b(First|Second|Third|Fourth|Fifth)\s+Schedule\b/gi,
        /\bSchedule\s+[IVXLCDM]+\b/gi,
        /\bAppendix\s+[A-Z]?\b/gi,
        /\bAppendix\s+to\s+this\s+(Act|Regulation)\b/gi
      ],
      bengali: [
        /তফসিল/g,
        /প্রথম\s+তফসিল/g,
        /দ্বিতীয়\s+তফসিল/g,
        /তৃতীয়\s+তফসিল/g,
        /Topsil/gi
      ]
    },

    // Minimum content length after schedule reference to consider it present
    // Requirements: 1.3 - Content threshold for missing schedule detection
    scheduleContentThreshold: 500,

    // Encoding error patterns
    // Requirements: 2.1, 2.2, 2.5 - Configurable encoding error patterns
    encodingErrors: [
      { pattern: /æ/g, description: 'Corrupted quotation mark', replacement: '"' },
      { pattern: /[\u00ec\u00ed\u00ee\u00ef]/g, description: 'Corrupted table border', replacement: '\n' }
    ],

    // OCR artifact corrections
    // Requirements: 3.1, 3.2, 3.5 - Configurable OCR correction dictionary
    ocrCorrections: [
      { incorrect: 'প্রম্্নফ', correct: 'প্রুফ', context: 'London Proof' },
      { incorrect: 'অতগরটির', correct: 'অক্ষরটির', context: 'letter reference' }
    ],

    // Formatting rules
    // Requirements: 6.1, 6.2, 6.3 - Configurable formatting improvement rules
    formattingRules: {
      bengaliListSeparation: {
        enabled: true,
        pattern: /(?<=[;।])\s+(\([ক-হ]\))/g,
        replacement: '\n$1'
      },
      englishListSeparation: {
        enabled: true,
        pattern: /(?<=;)\s+(\([a-z]\))/gi,
        replacement: '\n$1'
      }
    }
  },

  /**
   * Escape special regex characters in a string
   * Requirements: 7.5 - Safe pattern creation for dynamic regex
   * 
   * @param {string} string - The string to escape
   * @returns {string} String with regex special characters escaped
   */
  escapeRegex(string) {
    if (!string || typeof string !== 'string') {
      return '';
    }
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Create an empty quality assessment object with default values
   * Requirements: 7.5, 9.1-9.6, 10.1-10.4 - Default quality object for edge cases
   * 
   * @returns {Object} Empty assessment with enhanced data quality schema
   */
  createEmptyAssessment() {
    return {
      completeness: 'complete',
      completeness_disclaimer: 'Website representation incomplete; legal completeness unknown',
      flags: [],
      issues: [],
      risks: [],
      known_limitations: [
        'Preamble and enactment clause may not be present in all HTML extractions',
        'Statutory footnotes may be incomplete or missing from source HTML',
        'Section boundary detection is presentation-dependent'
      ],
      safe_for_ml_training: true,
      ml_usage_warning: 'HTML artifacts, encoding noise, and structural gaps are present; suitable only for exploratory retrieval and analysis. Not validated for training or evaluation.',
      ml_risk_factors: [],
      intended_ml_use: ['retrieval', 'extractive_question_answering'],
      preamble_present: false,
      enactment_clause_present: false,
      statutory_footnotes_present: false
    };
  },

  /**
   * Remove duplicate issues from an array based on type and position
   * Requirements: 7.5 - Deduplicate detected issues
   * 
   * @param {Array<Object>} issues - Array of issue objects
   * @returns {Array<Object>} Deduplicated array of issues
   */
  deduplicateIssues(issues) {
    if (!issues || !Array.isArray(issues)) {
      return [];
    }

    const seen = new Set();
    const deduplicated = [];

    for (const issue of issues) {
      // Create a unique key based on type and position
      const key = `${issue.type || ''}:${issue.position || 0}:${issue.scheduleType || issue.character || issue.incorrect || ''}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(issue);
      }
    }

    return deduplicated;
  },

  /**
   * Detect missing schedules in content
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
   * 
   * Iterates through all schedule patterns (English and Bengali), checks content
   * length after each reference, and flags as missing_schedule if content is
   * below the threshold.
   * 
   * @param {string} content - The act content to analyze
   * @param {Object} config - Quality configuration (defaults to QUALITY_CONFIG)
   * @returns {Array<Object>} Array of schedule issues with type, position, description
   */
  detectMissingSchedules(content, config = null) {
    // Use default config if not provided
    const cfg = config || this.QUALITY_CONFIG;
    
    // Handle invalid input
    if (!content || typeof content !== 'string') {
      return [];
    }

    const issues = [];
    
    // Combine all schedule patterns from English and Bengali
    const allPatterns = [
      ...(cfg.schedulePatterns?.english || []),
      ...(cfg.schedulePatterns?.bengali || [])
    ];

    // Get the content threshold
    const threshold = cfg.scheduleContentThreshold || 500;

    // Iterate through all patterns
    for (const pattern of allPatterns) {
      // Reset lastIndex for global patterns to ensure fresh search
      if (pattern.lastIndex !== undefined) {
        pattern.lastIndex = 0;
      }
      
      // Create a fresh copy of the pattern to avoid state issues with global flag
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      let match;

      while ((match = freshPattern.exec(content)) !== null) {
        const referencePosition = match.index;
        const matchedText = match[0];
        
        // Get content after the reference
        const contentAfterReference = content.substring(referencePosition + matchedText.length);
        const trimmedContentLength = contentAfterReference.trim().length;

        // Check if there's substantial content after the reference
        if (trimmedContentLength < threshold) {
          issues.push({
            type: 'missing_schedule',
            scheduleType: matchedText,
            position: referencePosition,
            description: `Schedule "${matchedText}" referenced but content appears missing (only ${trimmedContentLength} chars after reference)`
          });
        }
      }
    }

    // Deduplicate issues before returning
    return this.deduplicateIssues(issues);
  },

  /**
   * Detect encoding errors in content
   * Requirements: 2.1, 2.2, 2.3, 2.4
   * 
   * Iterates through encodingErrors patterns, extracts character, position,
   * and surrounding context (±20 chars) for each match.
   * 
   * @param {string} content - The act content to analyze
   * @param {Object} config - Quality configuration (defaults to QUALITY_CONFIG)
   * @returns {Array<Object>} Array of encoding issues with type, character, position, context, description
   */
  detectEncodingErrors(content, config = null) {
    // Use default config if not provided
    const cfg = config || this.QUALITY_CONFIG;
    
    // Handle invalid input
    if (!content || typeof content !== 'string') {
      return [];
    }

    const issues = [];
    
    // Get encoding error patterns from config
    const encodingErrors = cfg.encodingErrors || [];

    // Iterate through all encoding error patterns
    for (const errorDef of encodingErrors) {
      // Skip invalid error definitions
      if (!errorDef || !errorDef.pattern) {
        continue;
      }

      // Create a fresh copy of the pattern to avoid state issues with global flag
      const freshPattern = new RegExp(errorDef.pattern.source, errorDef.pattern.flags);
      let match;

      while ((match = freshPattern.exec(content)) !== null) {
        const position = match.index;
        const character = match[0];
        
        // Extract context: ±20 characters around the match
        const contextStart = Math.max(0, position - 20);
        const contextEnd = Math.min(content.length, position + character.length + 20);
        const context = content.substring(contextStart, contextEnd);

        issues.push({
          type: 'encoding_error',
          character: character,
          position: position,
          context: context,
          description: `${errorDef.description}: "${character}" at position ${position}`
        });
      }
    }

    return issues;
  },

  /**
   * Detect OCR artifacts in content
   * Requirements: 3.1, 3.3, 3.4
   * 
   * Iterates through ocrCorrections dictionary, records incorrect text,
   * correct text, position, and context for each match.
   * 
   * @param {string} content - The act content to analyze
   * @param {Object} config - Quality configuration (defaults to QUALITY_CONFIG)
   * @returns {Array<Object>} Array of OCR issues with type, incorrect, correct, position, context, description
   */
  detectOcrArtifacts(content, config = null) {
    // Use default config if not provided
    const cfg = config || this.QUALITY_CONFIG;
    
    // Handle invalid input
    if (!content || typeof content !== 'string') {
      return [];
    }

    const issues = [];
    
    // Get OCR corrections from config
    const ocrCorrections = cfg.ocrCorrections || [];

    // Iterate through all OCR correction entries
    for (const correction of ocrCorrections) {
      // Skip invalid correction definitions
      if (!correction || !correction.incorrect) {
        continue;
      }

      // Create a regex pattern from the incorrect text (escaped for safety)
      const escapedIncorrect = this.escapeRegex(correction.incorrect);
      const pattern = new RegExp(escapedIncorrect, 'g');
      let match;

      while ((match = pattern.exec(content)) !== null) {
        const position = match.index;
        const incorrectText = match[0];
        
        issues.push({
          type: 'ocr_artifact',
          incorrect: correction.incorrect,
          correct: correction.correct,
          position: position,
          context: correction.context,
          description: `OCR artifact: "${correction.incorrect}" should be "${correction.correct}" (${correction.context})`
        });
      }
    }

    return issues;
  },

  /**
   * Determine overall completeness based on detected flags and issues
   * Requirements: 7.2, 10.1, 10.2, 10.3, 10.4
   * 
   * Returns "textual_partial" if missing_schedule flag is present, "complete" if no
   * critical flags, and "uncertain" for edge cases.
   * Note: "partial" has been renamed to "textual_partial" per Requirements 10.1
   * 
   * Preamble/enactment clause presence is recorded but does NOT affect completeness
   * determination - many legal documents legitimately lack these elements.
   * 
   * @param {Set<string>|Array<string>} flags - Set or array of detected flag types
   * @param {Array<Object>} issues - Array of detected issues
   * @param {Object} options - Additional options (reserved for future use)
   * @returns {string} Completeness assessment: 'complete', 'textual_partial', or 'uncertain'
   */
  determineCompleteness(flags, issues, options = {}) {
    // Convert to Set if array is provided
    const flagSet = flags instanceof Set ? flags : new Set(flags || []);
    
    // If no flags, content is complete
    // Note: Preamble/enactment clause absence does NOT make content incomplete
    // as many legal documents legitimately lack these elements
    if (flagSet.size === 0) {
      return 'complete';
    }

    // If missing_schedule flag is present, content is textual_partial
    // Requirements: 10.1 - Rename "partial" to "textual_partial"
    if (flagSet.has('missing_schedule')) {
      return 'textual_partial';
    }

    // Encoding errors and OCR artifacts don't affect completeness, just quality
    // These are fixable issues, so content is still considered complete
    if (flagSet.has('encoding_error') || flagSet.has('ocr_artifact')) {
      return 'complete';
    }

    // For any other unknown flags, return uncertain
    return 'uncertain';
  },

  /**
   * Apply encoding repair rules to content
   * Requirements: 4.1, 4.2, 4.3, 4.5
   * Requirements: 3.6, 3.7 - Skip numeric regions (only Unicode normalization allowed)
   * 
   * Iterates through encodingErrors and applies replacements.
   * Tracks transformations with type, rule, count, replacement.
   * If dryRun is true, detects but doesn't modify content.
   * Skips transformations that fall within numeric regions.
   * 
   * @param {string} content - The content to repair
   * @param {Object} config - Quality configuration (defaults to QUALITY_CONFIG)
   * @param {boolean} dryRun - If true, detect but don't modify content
   * @param {Array} numericRegions - Optional array of numeric regions to skip
   * @returns {Object} { content, transformations, skippedInNumericRegions }
   */
  applyEncodingRepairRules(content, config = null, dryRun = false, numericRegions = null) {
    // Use default config if not provided
    const cfg = config || this.QUALITY_CONFIG;
    
    // Handle invalid input - return unchanged content with empty transformations
    if (!content || typeof content !== 'string') {
      return {
        content: content || '',
        transformations: [],
        skippedInNumericRegions: 0
      };
    }

    let result = content;
    const transformations = [];
    let skippedInNumericRegions = 0;
    
    // Get encoding error patterns from config
    const encodingErrors = cfg.encodingErrors || [];

    // Iterate through all encoding error patterns
    for (const rule of encodingErrors) {
      // Skip invalid rule definitions
      if (!rule || !rule.pattern) {
        continue;
      }

      // Create a fresh copy of the pattern to find all matches with positions
      const freshPattern = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match;
      const matchesToApply = [];
      const matchesSkipped = [];

      // Find all matches and check if they're in numeric regions
      while ((match = freshPattern.exec(content)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        // Requirements: 3.6, 3.7 - Check if match is in a numeric region
        if (numericRegions && this._isInNumericRegion(matchStart, matchEnd, numericRegions)) {
          matchesSkipped.push(match);
          skippedInNumericRegions++;
        } else {
          matchesToApply.push(match);
        }
      }

      if (matchesToApply.length > 0) {
        // Record the transformation
        transformations.push({
          type: 'encoding_repair',
          rule: rule.description,
          count: matchesToApply.length,
          replacement: rule.replacement,
          skippedCount: matchesSkipped.length
        });

        // Apply the replacement only if not in dryRun mode
        if (!dryRun) {
          // Apply replacements in reverse order to preserve positions
          const sortedMatches = [...matchesToApply].sort((a, b) => b.index - a.index);
          for (const m of sortedMatches) {
            result = result.substring(0, m.index) + rule.replacement + result.substring(m.index + m[0].length);
          }
        }
      } else if (matchesSkipped.length > 0) {
        // Record that matches were found but all skipped
        transformations.push({
          type: 'encoding_repair',
          rule: rule.description,
          count: 0,
          replacement: rule.replacement,
          skippedCount: matchesSkipped.length,
          skippedReason: 'numeric_region_protection'
        });
      }
    }

    return {
      content: result,
      transformations,
      skippedInNumericRegions
    };
  },

  /**
   * Check if a range overlaps with any numeric region
   * Requirements: 3.6 - Helper for numeric region checking
   * 
   * @param {number} start - Start position
   * @param {number} end - End position
   * @param {Array} numericRegions - Array of numeric regions
   * @returns {boolean} True if range overlaps with any numeric region
   */
  _isInNumericRegion(start, end, numericRegions) {
    if (!numericRegions || !Array.isArray(numericRegions)) {
      return false;
    }
    return numericRegions.some(region => 
      !(end <= region.start || region.end <= start)
    );
  },

  /**
   * Check if a range overlaps with any protected section
   * Requirements: 17.5 - Helper for protected section checking
   * 
   * @param {number} start - Start position
   * @param {number} end - End position
   * @param {Array} protectedRegions - Array of protected regions
   * @returns {boolean} True if range overlaps with any protected section
   */
  _isInProtectedSection(start, end, protectedRegions) {
    if (!protectedRegions || !Array.isArray(protectedRegions)) {
      return false;
    }
    return protectedRegions.some(region => 
      !(end <= region.start || region.end <= start)
    );
  },

  /**
   * Apply OCR correction rules to content
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   * Requirements: 3.6, 3.7 - Skip numeric regions (only Unicode normalization allowed)
   * Requirements: 17.5, 17.6, 17.7 - Skip protected sections (flag but do not correct)
   * 
   * Iterates through ocrCorrections and applies replacements.
   * Tracks transformations with type, incorrect, correct, count, context.
   * If dryRun is true, detects but doesn't modify content.
   * Skips transformations that fall within numeric regions.
   * Flags but does NOT correct OCR artifacts in protected sections (definitions, provisos, explanations).
   * 
   * @param {string} content - The content to correct
   * @param {Object} config - Quality configuration (defaults to QUALITY_CONFIG)
   * @param {boolean} dryRun - If true, detect but don't modify content
   * @param {Array} numericRegions - Optional array of numeric regions to skip
   * @param {Array} protectedRegions - Optional array of protected sections to skip (flag only)
   * @returns {Object} { content, transformations, skippedInNumericRegions, skippedInProtectedSections, flaggedInProtectedSections }
   */
  applyOcrCorrectionRules(content, config = null, dryRun = false, numericRegions = null, protectedRegions = null) {
    // Use default config if not provided
    const cfg = config || this.QUALITY_CONFIG;
    
    // Handle invalid input - return unchanged content with empty transformations
    if (!content || typeof content !== 'string') {
      return {
        content: content || '',
        transformations: [],
        skippedInNumericRegions: 0,
        skippedInProtectedSections: 0,
        flaggedInProtectedSections: []
      };
    }

    let result = content;
    const transformations = [];
    let skippedInNumericRegions = 0;
    let skippedInProtectedSections = 0;
    const flaggedInProtectedSections = [];
    
    // Get OCR corrections from config
    const ocrCorrections = cfg.ocrCorrections || [];

    // Iterate through all OCR correction entries
    for (const correction of ocrCorrections) {
      // Skip invalid correction definitions
      if (!correction || !correction.incorrect || !correction.correct) {
        continue;
      }

      // Create a regex pattern from the incorrect text (escaped for safety)
      const escapedIncorrect = this.escapeRegex(correction.incorrect);
      const pattern = new RegExp(escapedIncorrect, 'g');
      let match;
      const matchesToApply = [];
      const matchesSkippedNumeric = [];
      const matchesFlaggedProtected = [];

      // Find all matches and check if they're in numeric regions or protected sections
      while ((match = pattern.exec(content)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        // Requirements: 3.6, 3.7 - Check if match is in a numeric region
        if (numericRegions && this._isInNumericRegion(matchStart, matchEnd, numericRegions)) {
          matchesSkippedNumeric.push(match);
          skippedInNumericRegions++;
        }
        // Requirements: 17.5, 17.6, 17.7 - Check if match is in a protected section
        // Flag but do NOT correct OCR artifacts in protected sections
        else if (protectedRegions && this._isInProtectedSection(matchStart, matchEnd, protectedRegions)) {
          matchesFlaggedProtected.push({
            match: match,
            position: matchStart,
            incorrect: correction.incorrect,
            correct: correction.correct,
            context: correction.context
          });
          skippedInProtectedSections++;
        } else {
          matchesToApply.push(match);
        }
      }

      // Requirements: 17.6, 17.7 - Flag OCR artifacts in protected sections (do not correct)
      if (matchesFlaggedProtected.length > 0) {
        for (const flagged of matchesFlaggedProtected) {
          flaggedInProtectedSections.push({
            type: 'ocr_artifact_in_protected_section',
            incorrect: flagged.incorrect,
            correct: flagged.correct,
            position: flagged.position,
            context: flagged.context,
            applied: false,
            reason: 'protected_section_enforcement'
          });
        }
        
        // Record the transformation as flagged but not applied
        transformations.push({
          type: 'ocr_correction',
          incorrect: correction.incorrect,
          correct: correction.correct,
          count: 0,
          context: correction.context,
          skippedCount: matchesFlaggedProtected.length,
          skippedReason: 'protected_section_enforcement',
          applied: false
        });
      }

      if (matchesToApply.length > 0) {
        // Record the transformation with all required fields
        transformations.push({
          type: 'ocr_correction',
          incorrect: correction.incorrect,
          correct: correction.correct,
          count: matchesToApply.length,
          context: correction.context,
          skippedCount: matchesSkippedNumeric.length,
          applied: !dryRun
        });

        // Apply the replacement only if not in dryRun mode
        if (!dryRun) {
          // Apply replacements in reverse order to preserve positions
          const sortedMatches = [...matchesToApply].sort((a, b) => b.index - a.index);
          for (const m of sortedMatches) {
            result = result.substring(0, m.index) + correction.correct + result.substring(m.index + m[0].length);
          }
        }
      } else if (matchesSkippedNumeric.length > 0) {
        // Record that matches were found but all skipped due to numeric regions
        transformations.push({
          type: 'ocr_correction',
          incorrect: correction.incorrect,
          correct: correction.correct,
          count: 0,
          context: correction.context,
          skippedCount: matchesSkippedNumeric.length,
          skippedReason: 'numeric_region_protection',
          applied: false
        });
      }
    }

    return {
      content: result,
      transformations,
      skippedInNumericRegions,
      skippedInProtectedSections,
      flaggedInProtectedSections
    };
  },

  /**
   * Apply formatting improvement rules to content
   * Requirements: 6.1, 6.2, 6.3, 6.5
   * Requirements: 3.6, 3.7 - Skip numeric regions (only Unicode normalization allowed)
   * 
   * Applies Bengali list separation if enabled, applies English list separation
   * if enabled, tracks transformations with type, rule, count.
   * If dryRun is true, detects but doesn't modify content.
   * Skips transformations that fall within numeric regions.
   * 
   * @param {string} content - The content to format
   * @param {Object} config - Quality configuration (defaults to QUALITY_CONFIG)
   * @param {boolean} dryRun - If true, detect but don't modify content
   * @param {Array} numericRegions - Optional array of numeric regions to skip
   * @returns {Object} { content, transformations, skippedInNumericRegions }
   */
  applyFormattingRules(content, config = null, dryRun = false, numericRegions = null) {
    // Use default config if not provided
    const cfg = config || this.QUALITY_CONFIG;
    
    // Handle invalid input - return unchanged content with empty transformations
    if (!content || typeof content !== 'string') {
      return {
        content: content || '',
        transformations: [],
        skippedInNumericRegions: 0
      };
    }

    let result = content;
    const transformations = [];
    let skippedInNumericRegions = 0;
    
    // Get formatting rules from config
    const formattingRules = cfg.formattingRules || {};

    // Apply Bengali list separation if enabled
    if (formattingRules.bengaliListSeparation && formattingRules.bengaliListSeparation.enabled) {
      const rule = formattingRules.bengaliListSeparation;
      
      if (rule.pattern) {
        // Create a fresh copy of the pattern to find all matches
        const freshPattern = new RegExp(rule.pattern.source, rule.pattern.flags);
        const matches = result.match(freshPattern);
        
        if (matches && matches.length > 0) {
          // Check if any matches are in numeric regions
          let matchesToApply = matches.length;
          let matchesSkipped = 0;
          
          if (numericRegions && numericRegions.length > 0) {
            // We need to find positions of matches to check against numeric regions
            const positionPattern = new RegExp(rule.pattern.source, rule.pattern.flags);
            let match;
            const positions = [];
            
            while ((match = positionPattern.exec(result)) !== null) {
              positions.push({ index: match.index, length: match[0].length });
            }
            
            // Count how many are in numeric regions
            for (const pos of positions) {
              if (this._isInNumericRegion(pos.index, pos.index + pos.length, numericRegions)) {
                matchesSkipped++;
                skippedInNumericRegions++;
              }
            }
            matchesToApply = matches.length - matchesSkipped;
          }

          if (matchesToApply > 0) {
            // Record the transformation
            transformations.push({
              type: 'formatting',
              rule: 'bengali_list_separation',
              count: matchesToApply,
              skippedCount: matchesSkipped
            });

            // Apply the replacement only if not in dryRun mode
            if (!dryRun) {
              if (numericRegions && numericRegions.length > 0) {
                // Apply selectively, skipping numeric regions
                const positionPattern = new RegExp(rule.pattern.source, rule.pattern.flags);
                let match;
                const replacements = [];
                
                while ((match = positionPattern.exec(result)) !== null) {
                  if (!this._isInNumericRegion(match.index, match.index + match[0].length, numericRegions)) {
                    replacements.push({
                      index: match.index,
                      original: match[0],
                      replacement: match[0].replace(new RegExp(rule.pattern.source, rule.pattern.flags), rule.replacement)
                    });
                  }
                }
                
                // Apply in reverse order to preserve positions
                replacements.sort((a, b) => b.index - a.index);
                for (const r of replacements) {
                  result = result.substring(0, r.index) + r.replacement + result.substring(r.index + r.original.length);
                }
              } else {
                // No numeric regions, apply globally
                const replacePattern = new RegExp(rule.pattern.source, rule.pattern.flags);
                result = result.replace(replacePattern, rule.replacement);
              }
            }
          } else if (matchesSkipped > 0) {
            transformations.push({
              type: 'formatting',
              rule: 'bengali_list_separation',
              count: 0,
              skippedCount: matchesSkipped,
              skippedReason: 'numeric_region_protection'
            });
          }
        }
      }
    }

    // Apply English list separation if enabled
    if (formattingRules.englishListSeparation && formattingRules.englishListSeparation.enabled) {
      const rule = formattingRules.englishListSeparation;
      
      if (rule.pattern) {
        // Create a fresh copy of the pattern to find all matches
        const freshPattern = new RegExp(rule.pattern.source, rule.pattern.flags);
        const matches = result.match(freshPattern);

        if (matches && matches.length > 0) {
          // Check if any matches are in numeric regions
          let matchesToApply = matches.length;
          let matchesSkipped = 0;
          
          if (numericRegions && numericRegions.length > 0) {
            // We need to find positions of matches to check against numeric regions
            const positionPattern = new RegExp(rule.pattern.source, rule.pattern.flags);
            let match;
            const positions = [];
            
            while ((match = positionPattern.exec(result)) !== null) {
              positions.push({ index: match.index, length: match[0].length });
            }
            
            // Count how many are in numeric regions
            for (const pos of positions) {
              if (this._isInNumericRegion(pos.index, pos.index + pos.length, numericRegions)) {
                matchesSkipped++;
                skippedInNumericRegions++;
              }
            }
            matchesToApply = matches.length - matchesSkipped;
          }

          if (matchesToApply > 0) {
            // Record the transformation
            transformations.push({
              type: 'formatting',
              rule: 'english_list_separation',
              count: matchesToApply,
              skippedCount: matchesSkipped
            });

            // Apply the replacement only if not in dryRun mode
            if (!dryRun) {
              if (numericRegions && numericRegions.length > 0) {
                // Apply selectively, skipping numeric regions
                const positionPattern = new RegExp(rule.pattern.source, rule.pattern.flags);
                let match;
                const replacements = [];
                
                while ((match = positionPattern.exec(result)) !== null) {
                  if (!this._isInNumericRegion(match.index, match.index + match[0].length, numericRegions)) {
                    replacements.push({
                      index: match.index,
                      original: match[0],
                      replacement: match[0].replace(new RegExp(rule.pattern.source, rule.pattern.flags), rule.replacement)
                    });
                  }
                }
                
                // Apply in reverse order to preserve positions
                replacements.sort((a, b) => b.index - a.index);
                for (const r of replacements) {
                  result = result.substring(0, r.index) + r.replacement + result.substring(r.index + r.original.length);
                }
              } else {
                // No numeric regions, apply globally
                const replacePattern = new RegExp(rule.pattern.source, rule.pattern.flags);
                result = result.replace(replacePattern, rule.replacement);
              }
            }
          } else if (matchesSkipped > 0) {
            transformations.push({
              type: 'formatting',
              rule: 'english_list_separation',
              count: 0,
              skippedCount: matchesSkipped,
              skippedReason: 'numeric_region_protection'
            });
          }
        }
      }
    }

    return {
      content: result,
      transformations,
      skippedInNumericRegions
    };
  },

  /**
   * Clean content by applying configured rules
   * Requirements: 4.4, 9.2, 9.3
   * Requirements: 3.6, 3.7 - Skip numeric regions (only Unicode normalization allowed)
   * Requirements: 17.5, 17.6, 17.7 - Skip protected sections for OCR correction (flag only)
   * 
   * Accepts options for which rules to apply, preserves original content,
   * applies enabled rules in order, collects all transformations, and
   * returns both original and cleaned content with transformation log.
   * Detects numeric regions and passes them to cleaning functions to skip.
   * Detects protected sections and passes them to OCR correction to flag but not correct.
   * 
   * @param {string} content - Original content to clean
   * @param {Object} options - Cleaning options
   * @param {boolean} options.applyEncodingRepairs - Enable encoding repairs (default: true)
   * @param {boolean} options.applyOcrCorrections - Enable OCR corrections (default: true)
   * @param {boolean} options.applyFormatting - Enable formatting improvements (default: true)
   * @param {boolean} options.dryRun - If true, detect but don't modify content (default: false)
   * @param {Object} options.config - Quality configuration (defaults to QUALITY_CONFIG)
   * @param {Array} options.numericRegions - Pre-detected numeric regions (optional, will detect if not provided)
   * @param {Array} options.protectedRegions - Pre-detected protected sections (optional, will detect if not provided)
   * @param {boolean} options.skipNumericRegionDetection - If true, skip numeric region detection (default: false)
   * @param {boolean} options.skipProtectedSectionDetection - If true, skip protected section detection (default: false)
   * @returns {Object} { original, cleaned, transformations, flags, numericRegions, protectedRegions, skippedInNumericRegions, skippedInProtectedSections, flaggedInProtectedSections }
   */
  cleanContent(content, options = {}) {
    // Extract options with defaults
    const {
      applyEncodingRepairs = true,
      applyOcrCorrections = true,
      applyFormatting = true,
      dryRun = false,
      config = null,
      numericRegions = null,
      protectedRegions = null,
      skipNumericRegionDetection = false,
      skipProtectedSectionDetection = false
    } = options;

    // Use default config if not provided
    const cfg = config || this.QUALITY_CONFIG;

    // Handle invalid input - return original unchanged
    if (!content || typeof content !== 'string') {
      return {
        original: content || '',
        cleaned: content || '',
        transformations: [],
        flags: [],
        numericRegions: [],
        protectedRegions: [],
        skippedInNumericRegions: 0,
        skippedInProtectedSections: 0,
        flaggedInProtectedSections: []
      };
    }

    // Preserve original content (byte-identical)
    const original = content;
    let cleaned = content;
    const allTransformations = [];
    let totalSkippedInNumericRegions = 0;
    let totalSkippedInProtectedSections = 0;
    let allFlaggedInProtectedSections = [];

    // Requirements: 3.6, 3.7 - Detect numeric regions if not provided
    let detectedNumericRegions = numericRegions;
    if (!skipNumericRegionDetection && !detectedNumericRegions) {
      // Try to use BDLawExtractor if available
      if (typeof BDLawExtractor !== 'undefined' && BDLawExtractor.detectNumericRegions) {
        detectedNumericRegions = BDLawExtractor.detectNumericRegions(content);
      } else {
        // Fallback: try to require it (Node.js environment)
        try {
          const extractor = require('./bdlaw-extractor.js');
          if (extractor && extractor.detectNumericRegions) {
            detectedNumericRegions = extractor.detectNumericRegions(content);
          }
        } catch (e) {
          // BDLawExtractor not available, proceed without numeric region protection
          detectedNumericRegions = [];
        }
      }
    }
    detectedNumericRegions = detectedNumericRegions || [];

    // Requirements: 17.5, 17.6, 17.7 - Detect protected sections if not provided
    let detectedProtectedRegions = protectedRegions;
    if (!skipProtectedSectionDetection && !detectedProtectedRegions) {
      // Try to use BDLawExtractor if available
      if (typeof BDLawExtractor !== 'undefined' && BDLawExtractor.detectProtectedSections) {
        const result = BDLawExtractor.detectProtectedSections(content);
        detectedProtectedRegions = result.regions || [];
      } else {
        // Fallback: try to require it (Node.js environment)
        try {
          const extractor = require('./bdlaw-extractor.js');
          if (extractor && extractor.detectProtectedSections) {
            const result = extractor.detectProtectedSections(content);
            detectedProtectedRegions = result.regions || [];
          }
        } catch (e) {
          // BDLawExtractor not available, proceed without protected section detection
          detectedProtectedRegions = [];
        }
      }
    }
    detectedProtectedRegions = detectedProtectedRegions || [];

    // Apply encoding repairs if enabled
    if (applyEncodingRepairs) {
      const result = this.applyEncodingRepairRules(cleaned, cfg, dryRun, detectedNumericRegions);
      cleaned = result.content;
      allTransformations.push(...result.transformations);
      totalSkippedInNumericRegions += result.skippedInNumericRegions || 0;
    }

    // Apply OCR corrections if enabled
    // Requirements: 17.5, 17.6, 17.7 - Pass protected regions to flag but not correct
    if (applyOcrCorrections) {
      const result = this.applyOcrCorrectionRules(cleaned, cfg, dryRun, detectedNumericRegions, detectedProtectedRegions);
      cleaned = result.content;
      allTransformations.push(...result.transformations);
      totalSkippedInNumericRegions += result.skippedInNumericRegions || 0;
      totalSkippedInProtectedSections += result.skippedInProtectedSections || 0;
      if (result.flaggedInProtectedSections && result.flaggedInProtectedSections.length > 0) {
        allFlaggedInProtectedSections.push(...result.flaggedInProtectedSections);
      }
    }

    // Apply formatting improvements if enabled
    if (applyFormatting) {
      const result = this.applyFormattingRules(cleaned, cfg, dryRun, detectedNumericRegions);
      cleaned = result.content;
      allTransformations.push(...result.transformations);
      totalSkippedInNumericRegions += result.skippedInNumericRegions || 0;
    }

    // Determine flags based on transformations
    const flags = allTransformations.length > 0 ? ['cleaning_applied'] : [];
    if (totalSkippedInNumericRegions > 0) {
      flags.push('numeric_regions_protected');
    }
    if (totalSkippedInProtectedSections > 0) {
      flags.push('protected_sections_enforced');
    }

    return {
      original,
      cleaned: dryRun ? original : cleaned,
      transformations: allTransformations,
      flags,
      numericRegions: detectedNumericRegions,
      protectedRegions: detectedProtectedRegions,
      skippedInNumericRegions: totalSkippedInNumericRegions,
      skippedInProtectedSections: totalSkippedInProtectedSections,
      flaggedInProtectedSections: allFlaggedInProtectedSections
    };
  },

  /**
   * Validate content quality and detect all issues
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.1-9.6, 10.1-10.4
   * 
   * Calls detectMissingSchedules, detectEncodingErrors, detectOcrArtifacts,
   * collects all issues, builds flags Set, and determines completeness.
   * Returns enhanced data_quality object with completeness, flags, issues,
   * risks, known_limitations, safe_for_ml_training, and intended_ml_use.
   * 
   * @param {string} content - The act content to validate
   * @param {Object} config - Quality configuration (defaults to QUALITY_CONFIG)
   * @param {Object} options - Additional options for quality assessment
   * @param {boolean} options.hasNumericCorruptionRisk - Whether numeric corruption risk is detected
   * @param {boolean} options.hasEncodingAmbiguity - Whether encoding ambiguity is detected
   * @param {boolean} options.hasMissingSchedules - Whether schedules are missing
   * @param {boolean} options.hasHeavyOcrCorrection - Whether heavy OCR correction was needed
   * @param {Array} options.numericRegions - Detected numeric regions
   * @param {Array} options.protectedRegions - Detected protected sections
   * @param {Object} options.transformationLog - Transformation log from cleaning
   * @returns {Object} Enhanced quality assessment
   */
  validateContentQuality(content, config = null, options = {}) {
    // Use default config if not provided
    const cfg = config || this.QUALITY_CONFIG;
    
    // Handle invalid input - return empty assessment
    if (!content || typeof content !== 'string') {
      return this.createEmptyAssessment();
    }

    const allIssues = [];
    const flags = new Set();
    const risks = [];
    const knownLimitations = [];

    // Detect missing schedules
    const scheduleIssues = this.detectMissingSchedules(content, cfg);
    if (scheduleIssues.length > 0) {
      flags.add('missing_schedule');
      allIssues.push(...scheduleIssues);
      // Requirements: 9.2 - Add to risks array
      risks.push('missing_schedule_content');
    }

    // Detect encoding errors
    const encodingIssues = this.detectEncodingErrors(content, cfg);
    if (encodingIssues.length > 0) {
      flags.add('encoding_error');
      allIssues.push(...encodingIssues);
      // Requirements: 9.2 - Add to risks array
      risks.push('encoding_ambiguity');
    }

    // Detect OCR artifacts
    const ocrIssues = this.detectOcrArtifacts(content, cfg);
    if (ocrIssues.length > 0) {
      flags.add('ocr_artifact');
      allIssues.push(...ocrIssues);
    }

    // Requirements: 9.2 - Add risks from options
    if (options.hasNumericCorruptionRisk) {
      risks.push('numeric_corruption_risk');
    }
    if (options.hasEncodingAmbiguity && !risks.includes('encoding_ambiguity')) {
      risks.push('encoding_ambiguity');
    }
    if (options.hasMissingSchedules && !risks.includes('missing_schedule_content')) {
      risks.push('missing_schedule_content');
    }
    if (options.hasHeavyOcrCorrection) {
      risks.push('heavy_ocr_correction');
    }

    // Requirements: 9.3 - Add known limitations
    knownLimitations.push('Section boundary detection is presentation-dependent');
    knownLimitations.push('Gazette PDF comparison is out of scope');
    knownLimitations.push('Amendment chain inference is prohibited');
    knownLimitations.push('Preamble and enactment clause may not be present in all HTML extractions');
    knownLimitations.push('Statutory footnotes may be incomplete or missing from source HTML');

    // Detect preamble and enactment clause presence
    // These are used for textual completeness assessment
    let preambleResult = { preamble_present: false, preamble_markers: [] };
    let enactmentResult = { enactment_clause_present: false, enactment_markers: [] };
    let statutoryFootnotesResult = { statutory_footnotes_present: false, footnote_count: 0 };

    // Try to use BDLawExtractor if available
    if (typeof BDLawExtractor !== 'undefined') {
      if (BDLawExtractor.detectPreamble) {
        preambleResult = BDLawExtractor.detectPreamble(content);
      }
      if (BDLawExtractor.detectEnactmentClause) {
        enactmentResult = BDLawExtractor.detectEnactmentClause(content);
      }
      if (BDLawExtractor.detectStatutoryFootnotes) {
        statutoryFootnotesResult = BDLawExtractor.detectStatutoryFootnotes(content);
      }
    } else {
      // Fallback: try to require it (Node.js environment)
      try {
        const extractor = require('./bdlaw-extractor.js');
        if (extractor) {
          if (extractor.detectPreamble) {
            preambleResult = extractor.detectPreamble(content);
          }
          if (extractor.detectEnactmentClause) {
            enactmentResult = extractor.detectEnactmentClause(content);
          }
          if (extractor.detectStatutoryFootnotes) {
            statutoryFootnotesResult = extractor.detectStatutoryFootnotes(content);
          }
        }
      } catch (e) {
        // BDLawExtractor not available, proceed with defaults
      }
    }

    // Determine overall completeness
    // Requirements: 10.1 - Uses "textual_partial" instead of "partial"
    // Note: Preamble/enactment clause presence is recorded but does NOT affect
    // completeness - many legal documents legitimately lack these elements
    const completeness = this.determineCompleteness(flags, allIssues);

    // Requirements: 9.4, 9.5 - Determine safe_for_ml_training
    const safeForMlTraining = this.determineSafeForMlTraining(
      flags,
      risks,
      options
    );

    // Return enhanced data_quality object
    // Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 10.2
    // Also includes preamble/enactment clause detection results
    
    // Build ml_risk_factors array based on detected issues
    const mlRiskFactors = [];
    if (risks.includes('numeric_corruption_risk')) mlRiskFactors.push('numeric_corruption_risk');
    if (risks.includes('encoding_ambiguity')) mlRiskFactors.push('encoding_ambiguity');
    if (risks.includes('missing_schedule_content')) mlRiskFactors.push('missing_schedule_content');
    if (risks.includes('heavy_ocr_correction')) mlRiskFactors.push('heavy_ocr_correction');
    if (!preambleResult.preamble_present) mlRiskFactors.push('preamble_not_detected');
    if (!enactmentResult.enactment_clause_present) mlRiskFactors.push('enactment_clause_not_detected');
    
    return {
      completeness,
      // Requirements: 10.2 - Add completeness_disclaimer
      completeness_disclaimer: 'Website representation incomplete; legal completeness unknown',
      flags: Array.from(flags),
      issues: allIssues.map(issue => issue.description),
      // Requirements: 9.2 - risks array
      risks: risks,
      // Requirements: 9.3 - known_limitations array
      known_limitations: knownLimitations,
      // ML training assessment - use warning and risk factors instead of boolean
      safe_for_ml_training: safeForMlTraining,
      ml_usage_warning: 'HTML artifacts, encoding noise, and structural gaps are present; suitable only for exploratory retrieval and analysis. Not validated for training or evaluation.',
      ml_risk_factors: mlRiskFactors,
      // Requirements: 9.6 - intended_ml_use array
      intended_ml_use: ['retrieval', 'extractive_question_answering'],
      // Preamble and enactment clause detection results
      preamble_present: preambleResult.preamble_present,
      preamble_markers: preambleResult.preamble_markers,
      enactment_clause_present: enactmentResult.enactment_clause_present,
      enactment_markers: enactmentResult.enactment_markers,
      // Statutory footnotes detection
      statutory_footnotes_present: statutoryFootnotesResult.statutory_footnotes_present,
      statutory_footnote_count: statutoryFootnotesResult.footnote_count,
      // Editorial content flag (set by caller if detected)
      editorial_content_present: options.editorialContentPresent || false
    };
  },

  /**
   * Determine if content is safe for ML training
   * Requirements: 9.5
   * 
   * Sets safe_for_ml_training to false if:
   * - numeric corruption risk
   * - encoding ambiguity
   * - missing schedules
   * - heavy OCR correction
   * 
   * @param {Set<string>|Array<string>} flags - Detected flags
   * @param {Array<string>} risks - Detected risks
   * @param {Object} options - Additional options
   * @returns {boolean} Whether content is safe for ML training
   */
  determineSafeForMlTraining(flags, risks, options = {}) {
    // Convert to Set if array is provided
    const flagSet = flags instanceof Set ? flags : new Set(flags || []);
    const riskSet = new Set(risks || []);

    // Requirements: 9.5 - Set false if any of these conditions apply
    
    // Check for numeric corruption risk
    if (riskSet.has('numeric_corruption_risk') || options.hasNumericCorruptionRisk) {
      return false;
    }

    // Check for encoding ambiguity
    if (riskSet.has('encoding_ambiguity') || flagSet.has('encoding_error') || options.hasEncodingAmbiguity) {
      return false;
    }

    // Check for missing schedules
    if (riskSet.has('missing_schedule_content') || flagSet.has('missing_schedule') || options.hasMissingSchedules) {
      return false;
    }

    // Check for heavy OCR correction
    if (riskSet.has('heavy_ocr_correction') || options.hasHeavyOcrCorrection) {
      return false;
    }

    // If none of the above apply, content is safe for ML training
    return true;
  },

  // ============================================
  // SCHEDULE HTML PRESERVATION INTEGRATION
  // Requirements: 8.1-8.6 - Legal Integrity Enhancement
  // ============================================

  /**
   * Validate schedule HTML extraction result
   * Requirements: 8.5, 8.6 - Schedule HTML Preservation
   * 
   * Validates that schedule HTML was extracted correctly and flags
   * any issues without inferring or modifying content.
   * 
   * CRITICAL: This function does NOT flatten, clean, or transform schedule HTML.
   * It only validates and flags issues.
   * 
   * @param {Object} scheduleResult - Result from BDLawExtractor.extractScheduleHTML()
   * @param {string} textContent - Optional text content for additional validation
   * @returns {Object} Validation result { valid, issues, flags }
   */
  validateScheduleHTML(scheduleResult, textContent = null) {
    const result = {
      valid: true,
      issues: [],
      flags: []
    };

    // Validate input
    if (!scheduleResult) {
      result.valid = false;
      result.issues.push({
        type: 'schedule_validation_error',
        description: 'No schedule extraction result provided'
      });
      return result;
    }

    // Check required metadata fields
    // Requirements: 8.2, 8.3, 8.4 - Verify required metadata
    if (scheduleResult.representation !== 'raw_html') {
      result.valid = false;
      result.issues.push({
        type: 'schedule_metadata_error',
        description: 'Schedule representation must be "raw_html"'
      });
    }

    if (scheduleResult.extraction_method !== 'verbatim_dom_capture') {
      result.valid = false;
      result.issues.push({
        type: 'schedule_metadata_error',
        description: 'Schedule extraction_method must be "verbatim_dom_capture"'
      });
    }

    if (scheduleResult.processed !== false) {
      result.valid = false;
      result.issues.push({
        type: 'schedule_metadata_error',
        description: 'Schedule processed flag must be false'
      });
    }

    // Check for missing schedule flag
    // Requirements: 8.6 - Flag missing schedules without inferring content
    if (scheduleResult.missing_schedule_flag) {
      result.flags.push('missing_schedule');
      result.issues.push({
        type: 'missing_schedule',
        description: 'Schedule markers found in text but no schedule HTML extracted'
      });
    }

    // Additional validation if text content provided
    if (textContent && typeof textContent === 'string') {
      // Check if text references schedules but none were extracted
      const schedulePatterns = [
        /তফসিল/gi,
        /Schedule\s*[IVXLCDM\d]*/gi,
        /Appendix\s*[A-Z\d]*/gi
      ];

      let hasScheduleReferences = false;
      for (const pattern of schedulePatterns) {
        if (pattern.test(textContent)) {
          hasScheduleReferences = true;
          break;
        }
      }

      if (hasScheduleReferences && !scheduleResult.html_content) {
        if (!result.flags.includes('missing_schedule')) {
          result.flags.push('missing_schedule');
        }
        result.issues.push({
          type: 'missing_schedule',
          description: 'Text content references schedules but no schedule HTML was extracted'
        });
      }
    }

    return result;
  },

  /**
   * Get schedule quality assessment for export
   * Requirements: 8.1-8.6 - Schedule HTML Preservation
   * 
   * Returns a quality assessment specifically for schedule content.
   * This is used to populate the data_quality object in exports.
   * 
   * @param {Object} scheduleResult - Result from BDLawExtractor.extractScheduleHTML()
   * @param {string} textContent - Optional text content for additional validation
   * @returns {Object} Schedule quality assessment for data_quality object
   */
  getScheduleQualityAssessment(scheduleResult, textContent = null) {
    const validation = this.validateScheduleHTML(scheduleResult, textContent);

    return {
      schedule_html_preserved: scheduleResult && scheduleResult.html_content !== null,
      schedule_count: scheduleResult ? scheduleResult.schedule_count : 0,
      schedule_has_tables: scheduleResult ? scheduleResult.has_tables : false,
      schedule_missing_flag: validation.flags.includes('missing_schedule'),
      schedule_validation_issues: validation.issues.map(i => i.description)
    };
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawQuality;
}
