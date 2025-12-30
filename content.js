/**
 * BDLawCorpus Content Script
 * 
 * Handles extraction of legal content from bdlaws.minlaw.gov.bd
 * Requirements: 7.1, 7.2, 7.3, 9.4, 9.5, 17.1, 17.2, 23.1-23.7, 24.1-24.7, 25.1-25.5, 28.1-28.6
 */
(function() {
  'use strict';

  // Content script version for compatibility checks
  const CONTENT_SCRIPT_VERSION = '5';

  // ============================================
  // BDLawCorpus Legal Selectors
  // Requirement 7.1: Hardcoded selectors only
  // Extended selectors based on actual bdlaws.minlaw.gov.bd page structure
  // ============================================
  const BDLAW_LEGAL_SELECTORS = {
    // Title selectors - try multiple patterns
    title: [
      'h1',
      '.act-title',
      '.law-title',
      '#act-title',
      '.card-header h4',
      '.card-header h3',
      '.card-header h2',
      '.page-title',
      'h2.title',
      'h3.title',
      '.content-header h1',
      '.content-header h2',
      '.act-name',
      '.law-name'
    ],
    // Main content selectors - hierarchical fallback order
    // Primary selectors (site-specific)
    content: [
      '#lawContent',
      '.law-content',
      '.act-details',
      '.act-content',
      '.law-body',
      '.card-body',
      '.content-body',
      '#act-content',
      '.act-text',
      '.law-text'
    ],
    // Fallback selectors (generic semantic containers)
    // Used when primary selectors fail
    contentFallback: [
      '.boxed-layout',
      '.content-wrapper',
      '.main-content',
      'article',
      'main',
      '[role="main"]'
    ],
    // Metadata selectors
    meta: [
      '.act-meta',
      '.law-header',
      '.act-header',
      '.law-meta',
      '.metadata'
    ],
    // Schedule/table selectors
    schedule: [
      'table',
      '.schedule',
      '#schedule',
      '.tofshil'
    ],
    // DOM-specific selectors for structured extraction
    // Requirements: 23.1-23.7 - Act Content DOM Structure
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
    actPreamble: '.lineremove',               // Singular - contains preamble (যেহেতু...সেহেতু)
    // Body fallback exclusion selectors
    // Elements to remove when using body as final fallback
    bodyExclusions: [
      'nav',
      'header',
      'footer',
      'script',
      'style',
      'noscript',
      '.navbar',
      '.sidebar',
      '.menu',
      '.navigation',
      '.footer',
      '.header',
      '.search',
      '.search-box',
      '.related-links',
      '.breadcrumb',
      '.pagination',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '[role="search"]'
    ]
  };

  // ============================================
  // DOM-First Structure Extraction Selectors
  // Requirements: Legal Structure Derivation - DOM-first approach
  // ============================================
  const STRUCTURE_SELECTORS = {
    // Statutory links (references to other acts)
    statutoryLinks: 'a[href*="act-details"]',
    
    // Tables (for schedule detection)
    tables: 'table',
    
    // All links for reference extraction
    allLinks: 'a[href]'
  };

  // Section markers for Bengali legal documents
  const BDLAW_SECTION_MARKERS = ['ধারা', 'অধ্যায়', 'তফসিল'];

  // Amendment markers for detecting deleted/modified provisions
  // Requirements: 25.1 - Detect Amendment_Markers in legal text
  const BDLAW_AMENDMENT_MARKERS = ['বিলুপ্ত', 'সংশোধিত', 'প্রতিস্থাপিত'];

  // UI noise patterns to filter from extracted content
  // Requirements: 28.1, 28.2, 28.3 - Content Noise Filtering
  const BDLAW_UI_NOISE_PATTERNS = [
    'প্রিন্ট ভিউ',
    /^Top$/gm,
    /Copyright © \d{4}/g,
    /Legislative and Parliamentary Affairs Division/g
  ];

  // Cross-reference citation patterns for detecting references to other acts
  // Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3 - Citation Pattern Detection
  const BDLAW_CITATION_PATTERNS = {
    // English patterns - Requirements: 1.1, 1.2, 1.3
    ENGLISH_ACT_FULL: /([A-Z][a-zA-Z\s]+(?:Act|Ordinance)),?\s*(\d{4})\s*\(([IVXLCDM]+|\d+)\s+of\s+(\d{4})\)/g,
    ENGLISH_ACT_SHORT: /(?:Act|Ordinance)\s+([IVXLCDM]+|\d+)\s+of\s+(\d{4})/g,
    
    // Bengali patterns - Requirements: 2.1, 2.2, 2.3
    BENGALI_ACT_FULL: /([^\s,।]+(?:\s+[^\s,।]+)*\s+আইন),?\s*([\u09E6-\u09EF]{4})\s*\(([\u09E6-\u09EF]{4})\s*সনের\s*([\u09E6-\u09EF]+)\s*নং\s*আইন\)/g,
    BENGALI_ACT_SHORT: /([\u09E6-\u09EF]{4})\s*সনের\s*([\u09E6-\u09EF]+)\s*নং\s*(আইন|অধ্যাদেশ)/g,
    BENGALI_ORDINANCE: /([^\s,।]+(?:\s+[^\s,।]+)*\s+অধ্যাদেশ),?\s*([\u09E6-\u09EF]{4})\s*\(অধ্যাদেশ\s*নং\s*([\u09E6-\u09EF]+),?\s*([\u09E6-\u09EF]{4})\)/g,
    
    // President's Order pattern - Special reference type
    PRESIDENTS_ORDER: /P\.?O\.?\s*(?:No\.?)?\s*(\d+)\s+of\s+(\d{4})/gi
  };

  // Reference type classification keywords
  // Requirements: 3.1, 3.2, 3.3, 3.4 - Reference Type Classification
  const BDLAW_REFERENCE_TYPE_KEYWORDS = {
    amendment: ['সংশোধন', 'সংশোধিত', 'amendment', 'amended', 'amending'],
    repeal: ['রহিত', 'রহিতকরণ', 'বিলুপ্ত', 'repeal', 'repealed', 'repealing'],
    substitution: ['প্রতিস্থাপিত', 'প্রতিস্থাপন', 'substituted', 'substitution', 'replaced'],
    dependency: ['সাপেক্ষে', 'অধীন', 'অনুসারে', 'subject to', 'under', 'pursuant to'],
    incorporation: ['সন্নিবেশিত', 'অন্তর্ভুক্ত', 'inserted', 'incorporated', 'added']
  };

  // ============================================
  // LEGAL STATUS AND TEMPORAL MARKING
  // Requirements: 6.1-6.3, 7.1-7.4 - Legal Integrity Enhancement
  // ============================================

  /**
   * Patterns for detecting repealed status on source pages
   * Requirements: 6.1 - Detect if act is marked as repealed on source page
   */
  const BDLAW_LEGAL_STATUS_PATTERNS = {
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
  };

  /**
   * Selectors for finding status information on act pages
   * Requirements: 6.1 - Detect status from source page structure
   */
  const BDLAW_LEGAL_STATUS_SELECTORS = [
    '.act-status',
    '.law-status',
    '.status-badge',
    '.act-meta .status',
    '.bg-act-section',
    '.act-role-style',
    'h1',
    '.act-title',
    '.card-header'
  ];

  /**
   * Temporal status constant
   * Requirements: 7.1 - All acts are marked as "historical_text"
   */
  const BDLAW_TEMPORAL_STATUS = 'historical_text';

  /**
   * Temporal disclaimer constant
   * Requirements: 7.4 - Include temporal disclaimer in exports
   */
  const BDLAW_TEMPORAL_DISCLAIMER = 'No inference of current legal force or applicability';

  // ============================================
  // EXTRACTION RISK DETECTION
  // Requirements: 13.1-13.6 - Legal Integrity Enhancement
  // ============================================

  /**
   * Selectors for detecting pagination elements
   * Requirements: 13.1 - Detect pagination elements
   */
  const BDLAW_PAGINATION_SELECTORS = [
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
  ];

  /**
   * Selectors for detecting lazy-loaded content
   * Requirements: 13.2 - Detect lazy-loaded content
   */
  const BDLAW_LAZY_LOAD_SELECTORS = [
    '[data-src]',
    '[loading="lazy"]',
    '.lazy-load',
    '.lazy',
    '[data-lazy]',
    '[class*="lazy"]',
    'img[data-original]',
    '[data-srcset]'
  ];

  /**
   * Selectors for detecting external schedule/appendix links
   * Requirements: 13.3 - Detect external schedule links
   */
  const BDLAW_EXTERNAL_SCHEDULE_SELECTORS = [
    'a[href*="schedule"]',
    'a[href*="appendix"]',
    'a[href*="tofshil"]',
    'a[href*="form"]',
    'a[href*="annex"]',
    'a[href*="attachment"]'
  ];

  /**
   * Selectors for detecting hidden DOM elements
   * Requirements: 13.4 - Detect hidden DOM elements
   */
  const BDLAW_HIDDEN_DOM_SELECTORS = [
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
  ];

  // ============================================
  // Helper Functions
  // ============================================

  /**
   * Detect extraction risks in the current document
   * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6 - Extraction Risk Detection
   * 
   * Detects potential issues that could cause content truncation or incompleteness:
   * - Pagination elements (content may be split across pages)
   * - Lazy-loaded content (content may not be fully loaded)
   * - External schedule links (schedules may be on separate pages)
   * - Hidden DOM elements (content may be hidden and not extracted)
   * 
   * @returns {Object} {possible_truncation: boolean, reason: string, detected_risks: Array}
   */
  function bdlawDetectExtractionRisks() {
    // Default result - no risks detected
    const result = {
      possible_truncation: false,
      reason: 'none',
      detected_risks: []
    };

    const reasons = [];
    const detectedRisks = [];

    // Requirements: 13.1 - Check for pagination elements
    for (const selector of BDLAW_PAGINATION_SELECTORS) {
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
    for (const selector of BDLAW_LAZY_LOAD_SELECTORS) {
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
    for (const selector of BDLAW_EXTERNAL_SCHEDULE_SELECTORS) {
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
    for (const selector of BDLAW_HIDDEN_DOM_SELECTORS) {
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
  }

  /**
   * Check text for repealed status indicators
   * Requirements: 6.1 - Internal helper for status detection
   * 
   * @param {string} text - Text to check for repealed indicators
   * @returns {Object} {found: boolean, indicators: string[]}
   */
  function bdlawCheckForRepealedStatus(text) {
    if (!text || typeof text !== 'string') {
      return { found: false, indicators: [] };
    }

    const indicators = [];

    // Check Bengali repealed patterns
    for (const pattern of BDLAW_LEGAL_STATUS_PATTERNS.repealed_bengali) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      const match = freshPattern.exec(text);
      if (match) {
        indicators.push(match[0]);
      }
    }

    // Check English repealed patterns
    for (const pattern of BDLAW_LEGAL_STATUS_PATTERNS.repealed_english) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      const match = freshPattern.exec(text);
      if (match) {
        indicators.push(match[0]);
      }
    }

    // Check status indicator patterns
    for (const pattern of BDLAW_LEGAL_STATUS_PATTERNS.status_indicators) {
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
  }

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
   * @returns {Object} {legal_status: string, status_source: string|null, status_indicators: string[]}
   */
  function bdlawDetectLegalStatus() {
    // Default result - unknown status
    const result = {
      legal_status: 'unknown',
      status_source: null,
      status_indicators: []
    };

    const detectedIndicators = [];
    let statusSource = null;

    // Step 1: Check status-specific DOM elements
    for (const selector of BDLAW_LEGAL_STATUS_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent ?? '';
          if (!text.trim()) continue;

          // Check for repealed patterns in this element
          const repealedFound = bdlawCheckForRepealedStatus(text);
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
      const titleCheck = bdlawCheckForRepealedStatus(document.title);
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
  }

  /**
   * Try selectors in order, return first non-empty match
   */
  function bdlawTrySelectors(selectors) {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent ?? '';
          const trimmed = text.trim();
          if (trimmed) {
            return trimmed;
          }
        }
      } catch (e) {
        console.warn('Selector failed:', selector, e);
      }
    }
    return '';
  }

  /**
   * Try selectors and combine all matches
   */
  function bdlawTrySelectorsAll(selectors) {
    const results = [];
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent ?? '';
          const trimmed = text.trim();
          if (trimmed) {
            results.push(trimmed);
          }
        }
      } catch (e) {
        console.warn('Selector failed:', selector, e);
      }
    }
    return results.join('\n\n');
  }

  /**
   * Count section markers in text
   */
  function bdlawCountSectionMarkers(text) {
    if (!text || typeof text !== 'string') {
      return { 'ধারা': 0, 'অধ্যায়': 0, 'তফসিল': 0 };
    }

    const counts = {};
    for (const marker of BDLAW_SECTION_MARKERS) {
      const regex = new RegExp(marker, 'g');
      const matches = text.match(regex);
      counts[marker] = matches ? matches.length : 0;
    }
    return counts;
  }

  /**
   * Detect section markers with line numbers and positions
   */
  function bdlawDetectSectionMarkers(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const markers = [];
    const lines = text.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;

      for (const marker of BDLAW_SECTION_MARKERS) {
        let position = 0;
        let searchStart = 0;

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
  }

  /**
   * Detect amendment markers in legal text
   * Requirements: 25.1, 25.2, 25.3, 25.4 - Amendment and Deletion Marker Detection
   * 
   * @param {string} text - The text to analyze
   * @returns {Array<Object>} Array of { type, line, lineNumber, position, context }
   */
  function bdlawDetectAmendmentMarkers(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const markers = [];
    const lines = text.split('\n');

    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;

      for (const marker of BDLAW_AMENDMENT_MARKERS) {
        let position = 0;
        let searchStart = 0;

        while ((position = line.indexOf(marker, searchStart)) !== -1) {
          // Extract surrounding context (20 chars before/after)
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
  }

  /**
   * Filter UI noise from extracted content
   * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6 - Content Noise Filtering
   * 
   * @param {string} text - The text to filter
   * @returns {string} Filtered text with UI noise removed
   */
  function bdlawFilterContentNoise(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let filtered = text;

    for (const pattern of BDLAW_UI_NOISE_PATTERNS) {
      if (typeof pattern === 'string') {
        filtered = filtered.split(pattern).join('');
      } else {
        filtered = filtered.replace(pattern, '');
      }
    }

    // Trim empty whitespace-only lines at beginning and end
    filtered = filtered.replace(/^[\s\n]+/, '');
    filtered = filtered.replace(/[\s\n]+$/, '');

    return filtered;
  }

  /**
   * Detect cross-references in legal text
   * Requirements: 1.4, 1.5, 2.4, 2.5, 6.1 - Citation Detection and Component Extraction
   * 
   * @param {string} text - The legal text content to analyze
   * @returns {Array<Object>} Array of CrossReference objects
   */
  function bdlawDetectCrossReferences(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const references = [];
    const lines = text.split('\n');
    let charOffset = 0;

    lines.forEach((line, lineIndex) => {
      // Check each pattern type
      for (const [patternName, pattern] of Object.entries(BDLAW_CITATION_PATTERNS)) {
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
            ...bdlawExtractCitationComponents(patternName, match)
          };

          // Add context (50 chars before and after)
          citation.context_before = bdlawExtractContextBefore(text, absolutePosition, 50);
          citation.context_after = bdlawExtractContextAfter(text, absolutePosition + match[0].length, 50);

          // Classify reference type based on surrounding context
          const fullContext = citation.context_before + ' ' + citation.citation_text + ' ' + citation.context_after;
          citation.reference_type = bdlawClassifyReferenceType(fullContext);

          references.push(citation);
        }
      }

      charOffset += line.length + 1; // +1 for newline character
    });

    // Deduplicate overlapping matches (keep most specific)
    return bdlawDeduplicateReferences(references);
  }

  /**
   * Extract citation components based on pattern type
   * Requirements: 1.4, 2.4, 2.5 - Component Extraction
   * 
   * @param {string} patternName - The name of the matched pattern
   * @param {Array} match - The regex match array
   * @returns {Object} Extracted components
   */
  function bdlawExtractCitationComponents(patternName, match) {
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
  }

  /**
   * Extract context before a citation
   * Requirements: 4.1, 4.3 - Context Extraction
   * 
   * @param {string} text - The full text
   * @param {number} position - The citation start position
   * @param {number} length - Maximum context length
   * @returns {string} Context text before the citation
   */
  function bdlawExtractContextBefore(text, position, length) {
    if (!text || position <= 0) {
      return '';
    }
    const start = Math.max(0, position - length);
    return text.substring(start, position).trim();
  }

  /**
   * Extract context after a citation
   * Requirements: 4.2, 4.3 - Context Extraction
   * 
   * @param {string} text - The full text
   * @param {number} position - The position after the citation
   * @param {number} length - Maximum context length
   * @returns {string} Context text after the citation
   */
  function bdlawExtractContextAfter(text, position, length) {
    if (!text || position >= text.length) {
      return '';
    }
    const end = Math.min(text.length, position + length);
    return text.substring(position, end).trim();
  }

  /**
   * Classify the type of reference based on surrounding context
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 - Reference Type Classification
   * 
   * @param {string} contextText - Text surrounding the citation
   * @returns {string} Reference type classification
   */
  function bdlawClassifyReferenceType(contextText) {
    if (!contextText) {
      return 'mention';
    }

    const lowerContext = contextText.toLowerCase();

    // Check each reference type in priority order
    for (const [refType, keywords] of Object.entries(BDLAW_REFERENCE_TYPE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (contextText.includes(keyword) || lowerContext.includes(keyword.toLowerCase())) {
          return refType;
        }
      }
    }

    return 'mention'; // Default type when no classification keyword found
  }

  /**
   * Remove duplicate/overlapping references
   * Keeps the most specific match (longest) when patterns overlap
   * 
   * @param {Array} references - Array of detected references
   * @returns {Array} Deduplicated references
   */
  function bdlawDeduplicateReferences(references) {
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
  }

  /**
   * Extract table data handling merged cells correctly using matrix-based algorithm
   * Requirements: 24.1-24.7 - Table Parsing with Merged Cell Handling
   * 
   * @param {HTMLTableElement} tableElement - The table element to extract
   * @returns {Object} { data: string[][], hasMergedCells: boolean, rowCount: number, colCount: number }
   */
  function bdlawExtractTableWithMergedCells(tableElement) {
    if (!tableElement) {
      return { data: [], hasMergedCells: false, rowCount: 0, colCount: 0 };
    }

    const matrix = [];
    let hasMergedCells = false;
    let maxColCount = 0;

    const rows = tableElement.querySelectorAll('tr');

    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('td, th');
      let colIndex = 0;

      if (!matrix[rowIndex]) {
        matrix[rowIndex] = [];
      }

      cells.forEach((cell) => {
        while (matrix[rowIndex] && matrix[rowIndex][colIndex] !== undefined) {
          colIndex++;
        }

        let content = '';
        if (cell.textContent) {
          content = cell.textContent
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\u00A0/g, ' ');
        }

        const rowspan = parseInt(cell.getAttribute('rowspan')) || 1;
        const colspan = parseInt(cell.getAttribute('colspan')) || 1;

        if (rowspan > 1 || colspan > 1) {
          hasMergedCells = true;
        }

        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            const targetRow = rowIndex + r;
            const targetCol = colIndex + c;

            if (!matrix[targetRow]) {
              matrix[targetRow] = [];
            }

            matrix[targetRow][targetCol] = (r === 0 && c === 0) ? content : '';
          }
        }

        const endCol = colIndex + colspan;
        if (endCol > maxColCount) {
          maxColCount = endCol;
        }

        colIndex += colspan;
      });
    });

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
  }

  /**
   * Extract act content from section-row structure on Act Detail pages
   * Requirements: 23.1-23.7 - Act Content DOM Structure Extraction
   * 
   * Extracts content in order:
   * 1. Header section (.bg-act-section) - act number, date
   * 2. Repealed notice (.bt-act-repealed) - if present
   * 3. Act purpose (.act-role-style) - purpose statement
   * 4. Preamble (.lineremove singular) - যেহেতু...সেহেতু clause
   * 5. Section rows (.lineremoves plural) - numbered sections
   * 
   * IMPORTANT: Pre-section nodes are sorted by DOM position (compareDocumentPosition)
   * to preserve actual document order, not selector order.
   * 
   * @returns {Object} { preambleContent: string|null, metadata: string|null, sections: Array<StructuredSection> }
   */
  function bdlawExtractActFromSectionRows() {
    // Target the .boxed-layout container
    const container = document.querySelector(BDLAW_LEGAL_SELECTORS.actContainer);
    if (!container) {
      return { preambleContent: null, metadata: null, sections: [] };
    }

    // Collect all pre-section nodes using a combined selector
    // These are nodes that appear BEFORE the .lineremoves section rows
    const preSectionSelectors = [
      BDLAW_LEGAL_SELECTORS.actHeaderSection,
      BDLAW_LEGAL_SELECTORS.actRepealedNotice,
      BDLAW_LEGAL_SELECTORS.actPurpose,
      BDLAW_LEGAL_SELECTORS.actPreamble  // .lineremove (singular)
    ].join(', ');

    const preSectionNodes = Array.from(container.querySelectorAll(preSectionSelectors));

    // Filter out .lineremoves elements (section rows) - we only want .lineremove (singular)
    const filteredNodes = preSectionNodes.filter(node => {
      // Skip if this is a .lineremoves element (section rows)
      if (node.classList && node.classList.contains('lineremoves')) {
        return false;
      }
      // Skip empty nodes
      if (!node.textContent || !node.textContent.trim()) {
        return false;
      }
      return true;
    });

    // Sort by DOM position to preserve actual document order
    // This ensures we don't accidentally reorder content based on selector order
    filteredNodes.sort((a, b) => {
      const position = a.compareDocumentPosition(b);
      // If b follows a, a should come first (return -1)
      // If a follows b, b should come first (return 1)
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }
      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }
      return 0;
    });

    // Extract text content from sorted nodes using textContent ONLY
    const preambleParts = filteredNodes.map(node => node.textContent.trim());

    // Combine preamble parts
    const preambleContent = preambleParts.length > 0 ? preambleParts.join('\n\n') : null;

    // Extract metadata from .bg-act-section or .act-role-style elements (for backward compatibility)
    let metadata = null;
    for (const selector of BDLAW_LEGAL_SELECTORS.actMetadata) {
      const metadataEl = container.querySelector(selector);
      if (metadataEl && metadataEl.textContent) {
        metadata = metadataEl.textContent.trim();
        break;
      }
    }

    // Iterate through .lineremoves rows to extract section content
    const sectionRows = container.querySelectorAll(BDLAW_LEGAL_SELECTORS.sectionRows);
    const sections = [];

    sectionRows.forEach((row, index) => {
      const titleEl = row.querySelector(BDLAW_LEGAL_SELECTORS.sectionTitle);
      const sectionTitle = titleEl ? titleEl.textContent.trim() : '';

      const bodyEl = row.querySelector(BDLAW_LEGAL_SELECTORS.sectionBody);
      const sectionBodyHtml = bodyEl ? bodyEl.innerHTML : '';
      const sectionBody = bodyEl ? bodyEl.textContent.trim() : '';

      const hasTable = bodyEl ? bodyEl.querySelector('table') !== null : false;

      sections.push({
        index,
        sectionTitle,
        sectionBody,
        sectionBodyHtml,
        hasTable
      });
    });

    return { preambleContent, metadata, sections };
  }

  // ============================================
  // DOM-FIRST STRUCTURE EXTRACTION FUNCTIONS
  // Requirements: Legal Structure Derivation & Reference Anchoring
  // ============================================

  /**
   * Extract sections from DOM with structure data
   * Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.5 - Section extraction
   * 
   * Queries all .lineremoves rows from DOM and extracts:
   * - Section number from .txt-head using Bengali numeral+danda pattern
   * - Section heading from .txt-head (text before section number)
   * - Section body from .txt-details
   * - DOM index for document order preservation
   * 
   * @returns {Array<Object>} Array of section objects with DOM-extracted data
   */
  function extractSectionsFromDOM() {
    const container = document.querySelector(BDLAW_LEGAL_SELECTORS.actContainer);
    if (!container) {
      return [];
    }

    const sectionRows = container.querySelectorAll(BDLAW_LEGAL_SELECTORS.sectionRows);
    const sections = [];
    
    // Bengali section number pattern: numeral(s) + danda
    const sectionNumberPattern = /[০-৯]+৷/;

    sectionRows.forEach((row, domIndex) => {
      const titleEl = row.querySelector(BDLAW_LEGAL_SELECTORS.sectionTitle);
      const bodyEl = row.querySelector(BDLAW_LEGAL_SELECTORS.sectionBody);
      
      // Extract full title text
      const titleText = titleEl ? titleEl.textContent.trim() : '';
      const bodyText = bodyEl ? bodyEl.textContent.trim() : '';
      
      // Parse section number and heading from title
      let sectionNumber = null;
      let heading = null;
      
      if (titleText) {
        const numberMatch = titleText.match(sectionNumberPattern);
        if (numberMatch) {
          sectionNumber = numberMatch[0];
          // Heading is text before the section number
          const numberIndex = titleText.indexOf(sectionNumber);
          if (numberIndex > 0) {
            heading = titleText.substring(0, numberIndex).trim();
          }
        } else {
          // No section number found, entire title is heading
          heading = titleText;
        }
      }
      
      // Detect subsections and clauses in body content
      let subsections = [];
      let clauses = [];
      
      if (typeof BDLawExtractor !== 'undefined') {
        subsections = BDLawExtractor.detectSubsectionsInContent(bodyText);
        clauses = BDLawExtractor.detectClausesInContent(bodyText);
      }
      
      sections.push({
        dom_index: domIndex,
        section_number: sectionNumber,
        heading: heading,
        body_text: bodyText,
        subsections: subsections,
        clauses: clauses,
        has_table: bodyEl ? bodyEl.querySelector('table') !== null : false
      });
    });

    return sections;
  }

  /**
   * Extract preamble from DOM
   * Requirements: 6.1, 6.2, 6.3, 6.5, 6.6 - Preamble detection
   * 
   * Queries .lineremove (singular) elements and checks for preamble patterns.
   * Records preamble text verbatim from DOM.
   * 
   * @returns {Object|null} Preamble object or null if not found
   */
  function extractPreambleFromDOM() {
    const container = document.querySelector(BDLAW_LEGAL_SELECTORS.actContainer);
    if (!container) {
      return null;
    }

    // Query .lineremove elements (singular - preamble container)
    const preambleElements = container.querySelectorAll(BDLAW_LEGAL_SELECTORS.actPreamble);
    
    // Preamble patterns
    const preamblePattern = /যেহেতু|WHEREAS/gi;
    
    for (const element of preambleElements) {
      // Skip if this is actually a .lineremoves element (section rows)
      if (element.classList && element.classList.contains('lineremoves')) {
        continue;
      }
      
      const text = element.textContent ? element.textContent.trim() : '';
      if (text && preamblePattern.test(text)) {
        return {
          text: text,
          has_preamble: true,
          dom_source: '.lineremove'
        };
      }
    }
    
    return {
      text: null,
      has_preamble: false,
      dom_source: null
    };
  }

  /**
   * Extract enactment clause from DOM
   * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6 - Enactment clause detection
   * 
   * Queries .lineremove elements and checks for enactment clause patterns.
   * Records enactment clause text verbatim from DOM.
   * 
   * @returns {Object|null} Enactment clause object or null if not found
   */
  function extractEnactmentFromDOM() {
    const container = document.querySelector(BDLAW_LEGAL_SELECTORS.actContainer);
    if (!container) {
      return null;
    }

    // Query .lineremove elements
    const elements = container.querySelectorAll(BDLAW_LEGAL_SELECTORS.actPreamble);
    
    // Enactment clause patterns
    const enactmentPattern = /সেহেতু\s+এতদ্বারা|Be\s+it\s+enacted/gi;
    
    for (const element of elements) {
      // Skip if this is actually a .lineremoves element
      if (element.classList && element.classList.contains('lineremoves')) {
        continue;
      }
      
      const text = element.textContent ? element.textContent.trim() : '';
      if (text && enactmentPattern.test(text)) {
        return {
          text: text,
          has_enactment_clause: true,
          dom_source: '.lineremove'
        };
      }
    }
    
    return {
      text: null,
      has_enactment_clause: false,
      dom_source: null
    };
  }

  /**
   * Extract statutory references from DOM links
   * Requirements: 9.1, 9.2, 9.3, 10.1 - Reference link extraction
   * 
   * Queries all a[href*="act-details"] links from DOM and extracts:
   * - Citation text (link textContent)
   * - href attribute
   * - act_id from href
   * - DOM section index for scope anchoring
   * 
   * @param {string} contentRaw - The content_raw for offset mapping
   * @returns {Array<Object>} Array of reference objects
   */
  function extractReferencesFromDOM(contentRaw) {
    const container = document.querySelector(BDLAW_LEGAL_SELECTORS.actContainer);
    if (!container) {
      return [];
    }

    const references = [];
    const links = container.querySelectorAll(STRUCTURE_SELECTORS.statutoryLinks);
    const actLinkPattern = /act-details-(\d+)/;
    
    // Get section rows for scope determination
    const sectionRows = Array.from(container.querySelectorAll(BDLAW_LEGAL_SELECTORS.sectionRows));

    links.forEach(link => {
      const citationText = link.textContent ? link.textContent.trim() : '';
      const href = link.getAttribute('href') || null;
      
      if (!citationText) {
        return; // Skip empty links
      }
      
      // Extract act_id from href
      let actId = null;
      if (href) {
        const actIdMatch = href.match(actLinkPattern);
        if (actIdMatch) {
          actId = actIdMatch[1];
        }
      }
      
      // Calculate character offset in content_raw
      let characterOffset = -1;
      if (contentRaw && typeof BDLawExtractor !== 'undefined') {
        characterOffset = BDLawExtractor.calculateOffsetInContentRaw(citationText, contentRaw);
      }
      
      // Determine containing section by finding parent .lineremoves row
      let domSectionIndex = null;
      let parentRow = link.closest(BDLAW_LEGAL_SELECTORS.sectionRows);
      if (parentRow) {
        domSectionIndex = sectionRows.indexOf(parentRow);
        if (domSectionIndex === -1) {
          domSectionIndex = null;
        }
      }
      
      references.push({
        citation_text: citationText,
        character_offset: characterOffset,
        href: href,
        act_id: actId,
        dom_section_index: domSectionIndex
      });
    });

    return references;
  }

  /**
   * Extract complete structure from DOM
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6 - Main structure extractor
   * 
   * Main entry point for DOM-first structure extraction.
   * Combines preamble, enactment, sections, and maps to content_raw offsets.
   * 
   * @param {string} contentRaw - The content_raw for offset mapping
   * @returns {Object} Complete structure tree
   */
  function extractStructureFromDOM(contentRaw) {
    // Extract components from DOM
    const preamble = extractPreambleFromDOM();
    const enactment = extractEnactmentFromDOM();
    const sections = extractSectionsFromDOM();
    
    // If BDLawExtractor is available, build the structure tree
    if (typeof BDLawExtractor !== 'undefined') {
      return BDLawExtractor.buildStructureTree({
        preamble: preamble,
        enactment: enactment,
        sections: sections,
        contentRaw: contentRaw
      });
    }
    
    // Fallback: return raw extracted data
    return {
      preamble: preamble,
      enactment_clause: enactment,
      sections: sections,
      metadata: {
        total_sections: sections.length,
        total_subsections: 0,
        total_clauses: 0,
        extraction_method: 'dom_first',
        deterministic: true
      }
    };
  }

  /**
   * Extract references with scope anchoring
   * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6 - Cross-reference extraction
   * 
   * Extracts both link-based and pattern-detected references,
   * anchors them to structural scope, and adds required disclaimers.
   * 
   * @param {string} contentRaw - The content_raw for offset mapping
   * @param {Object} structure - The structure tree for scope anchoring
   * @returns {Array} Complete cross_references array
   */
  function extractReferencesWithScope(contentRaw, structure) {
    // Extract link-based references from DOM
    const linkReferences = extractReferencesFromDOM(contentRaw);
    
    // Extract pattern-based references from each section
    const patternReferences = [];
    const sections = structure && structure.sections ? structure.sections : [];
    
    for (const section of sections) {
      if (section.body_text && typeof BDLawExtractor !== 'undefined') {
        const citations = BDLawExtractor.detectCitationsInContent(section.body_text);
        
        for (const citation of citations) {
          // Calculate absolute offset in content_raw
          let absoluteOffset = -1;
          if (section.content_start !== undefined && section.content_start > -1) {
            absoluteOffset = section.content_start + citation.relativeOffset;
          } else if (contentRaw) {
            absoluteOffset = BDLawExtractor.calculateOffsetInContentRaw(
              citation.citation_text, 
              contentRaw
            );
          }
          
          patternReferences.push({
            citation_text: citation.citation_text,
            character_offset: absoluteOffset,
            pattern_type: citation.pattern_type,
            dom_section_index: section.dom_index
          });
        }
      }
    }
    
    // Build cross-references with scope anchoring
    if (typeof BDLawExtractor !== 'undefined') {
      return BDLawExtractor.buildCrossReferences({
        linkReferences: linkReferences,
        patternReferences: patternReferences,
        structure: structure,
        contentRaw: contentRaw
      });
    }
    
    // Fallback: return link references with basic formatting
    return linkReferences.map(ref => ({
      ...ref,
      scope: {
        section: null,
        subsection: null,
        clause: null,
        dom_section_index: ref.dom_section_index
      },
      reference_semantics: 'string_match_only',
      reference_warning: 'Keywords detected in proximity to citation strings. No legal relationship, effect, direction, or applicability is implied.'
    }));
  }

  // ============================================
  // BDLawCorpus Extraction Functions
  // ============================================

  /**
   * Try selectors with hierarchical fallback and audit tracking
   * Returns content and metadata about which selector succeeded
   * 
   * @param {Array} selectors - Array of selectors to try in order
   * @param {string} selectorSetName - Name of the selector set for logging
   * @returns {Object} { content: string, successfulSelector: string|null, selectorsAttempted: Array }
   */
  function bdlawTrySelectorsWithAudit(selectors, selectorSetName = 'unknown') {
    const selectorsAttempted = [];
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        const elementCount = elements.length;
        
        selectorsAttempted.push({
          selector,
          matched: elementCount > 0,
          element_count: elementCount
        });
        
        if (elementCount > 0) {
          // Use textContent ONLY (NEVER innerText per legal-integrity-rules)
          const element = elements[0];
          const text = element.textContent ?? '';
          const trimmed = text.trim();
          
          if (trimmed) {
            return {
              content: trimmed,
              successfulSelector: selector,
              selectorsAttempted,
              selectorSetName
            };
          }
        }
      } catch (e) {
        selectorsAttempted.push({
          selector,
          matched: false,
          element_count: 0,
          error: e.message
        });
      }
    }
    
    return {
      content: '',
      successfulSelector: null,
      selectorsAttempted,
      selectorSetName
    };
  }

  /**
   * Extract content using body as final fallback with strict exclusion filtering
   * Uses textContent ONLY (NEVER innerText per legal-integrity-rules)
   * 
   * @returns {Object} { content: string, exclusionsApplied: Array }
   */
  function bdlawExtractBodyFallback() {
    const body = document.body;
    if (!body) {
      return { content: '', exclusionsApplied: [] };
    }
    
    // Clone body to avoid modifying the actual DOM
    const clone = body.cloneNode(true);
    const exclusionsApplied = [];
    
    // Remove all exclusion elements
    for (const selector of BDLAW_LEGAL_SELECTORS.bodyExclusions) {
      try {
        const elements = clone.querySelectorAll(selector);
        if (elements.length > 0) {
          exclusionsApplied.push({
            selector,
            removed_count: elements.length
          });
          elements.forEach(el => el.remove());
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    
    // Use textContent ONLY (NEVER innerText per legal-integrity-rules)
    const content = clone.textContent ?? '';
    
    return {
      content: content.trim(),
      exclusionsApplied
    };
  }

  /**
   * Check if content contains legal signals (preamble, enactment, sections)
   * Used to validate that extracted content is actually legal text
   * 
   * @param {string} content - Content to check
   * @returns {Object} { hasSignal: boolean, signalType: string|null }
   */
  function bdlawCheckLegalSignals(content) {
    if (!content || typeof content !== 'string') {
      return { hasSignal: false, signalType: null };
    }
    
    // Bengali legal signals
    if (/[০-৯]+৷/.test(content)) {
      return { hasSignal: true, signalType: 'bengali_numeral_danda' };
    }
    if (/ধারা/.test(content)) {
      return { hasSignal: true, signalType: 'bengali_section_marker' };
    }
    if (/যেহেতু/.test(content)) {
      return { hasSignal: true, signalType: 'bengali_preamble' };
    }
    if (/সেহেতু/.test(content)) {
      return { hasSignal: true, signalType: 'bengali_enactment' };
    }
    if (/তফসিল/.test(content)) {
      return { hasSignal: true, signalType: 'bengali_schedule' };
    }
    if (/অধ্যায়/.test(content)) {
      return { hasSignal: true, signalType: 'bengali_chapter' };
    }
    
    // English legal signals
    if (/\bSection\b/i.test(content)) {
      return { hasSignal: true, signalType: 'english_section' };
    }
    if (/\bChapter\b/i.test(content)) {
      return { hasSignal: true, signalType: 'english_chapter' };
    }
    if (/\bSchedule\b/i.test(content)) {
      return { hasSignal: true, signalType: 'english_schedule' };
    }
    if (/\bWHEREAS\b/i.test(content)) {
      return { hasSignal: true, signalType: 'english_preamble' };
    }
    if (/\bBe\s+it\s+enacted\b/i.test(content)) {
      return { hasSignal: true, signalType: 'english_enactment' };
    }
    
    return { hasSignal: false, signalType: null };
  }

  /**
   * Extract act content from Layer 3 (Act Detail) pages
   * Requirements: 7.1, 9.4, 9.5, 23.1-23.7, 24.1-24.7, 25.1-25.5, 28.1-28.6
   * Requirements: 5.8, 5.9, 5.10 - Support broader selectors for retry attempts
   * 
   * HIERARCHICAL FALLBACK ORDER:
   * 1. Structured extraction from section rows (.boxed-layout)
   * 2. Primary content selectors (site-specific)
   * 3. Fallback content selectors (generic semantic containers)
   * 4. Body fallback with strict exclusion filtering
   * 
   * Uses textContent ONLY (NEVER innerText per legal-integrity-rules)
   * 
   * @param {Object} options - Extraction options
   * @param {boolean} options.useBroaderSelectors - Whether to use broader selectors (for retry)
   * @param {Array} options.broaderSelectors - Custom broader selectors array (optional)
   */
  function extractBDLawActContent(options = {}) {
    const { useBroaderSelectors = false, broaderSelectors = null } = options;
    
    // Audit metadata for tracking extraction method
    const extractionAudit = {
      selectors_attempted: [],
      successful_selector: null,
      extraction_method: null, // 'structured' | 'primary' | 'fallback' | 'body_fallback'
      dom_extraction_method: 'textContent', // ALWAYS textContent per legal-integrity-rules
      body_exclusions_applied: []
    };
    
    // First, try structured extraction from section rows
    // Requirements: 23.1-23.7 - Act Content DOM Structure Extraction
    const structuredResult = bdlawExtractActFromSectionRows();
    const hasStructuredContent = structuredResult.sections && structuredResult.sections.length > 0;

    // Extract title using ordered selectors
    let title = bdlawTrySelectors(BDLAW_LEGAL_SELECTORS.title);
    
    // Fallback: try document title if no element found
    if (!title && document.title) {
      title = document.title
        .replace(/\s*[-|]\s*bdlaws.*$/i, '')
        .replace(/\s*[-|]\s*Bangladesh.*$/i, '')
        .trim();
    }

    let content = '';
    let structuredSections = [];
    let tables = [];

    if (hasStructuredContent) {
      // Build content from structured sections
      // Requirements: 23.6, 23.7 - Preserve title-body association and document order
      extractionAudit.extraction_method = 'structured';
      extractionAudit.successful_selector = BDLAW_LEGAL_SELECTORS.actContainer;
      
      const contentParts = [];
      
      // FIRST: Include preamble content (act number, date, repealed notice, purpose, preamble)
      // This content appears BEFORE the section rows in the DOM
      if (structuredResult.preambleContent) {
        contentParts.push(structuredResult.preambleContent);
      }
      
      // THEN: Include section rows content
      structuredResult.sections.forEach((section, idx) => {
        // Build section content
        let sectionContent = '';
        if (section.sectionTitle) {
          sectionContent += section.sectionTitle;
        }
        if (section.sectionBody) {
          sectionContent += (sectionContent ? '\n' : '') + section.sectionBody;
        }
        
        if (sectionContent) {
          contentParts.push(sectionContent);
        }

        // Extract tables from sections that have them
        // Requirements: 24.1-24.7 - Table Parsing with Merged Cell Handling
        if (section.hasTable && section.sectionBodyHtml) {
          // Create a temporary element to parse the HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = section.sectionBodyHtml;
          const tablElements = tempDiv.querySelectorAll('table');
          
          tablElements.forEach(tableEl => {
            const tableData = bdlawExtractTableWithMergedCells(tableEl);
            if (tableData.data.length > 0) {
              tables.push({
                sectionIndex: idx,
                data: tableData.data,
                hasMergedCells: tableData.hasMergedCells
              });
            }
          });
        }

        // Build structured section for export
        structuredSections.push({
          index: section.index,
          sectionTitle: section.sectionTitle || '',
          sectionBody: section.sectionBody || '',
          hasTable: section.hasTable || false
        });
      });

      content = contentParts.join('\n\n');
    } else {
      // HIERARCHICAL FALLBACK EXTRACTION
      // Step 1: Try primary content selectors
      const primaryResult = bdlawTrySelectorsWithAudit(
        BDLAW_LEGAL_SELECTORS.content,
        'primary'
      );
      extractionAudit.selectors_attempted.push(...primaryResult.selectorsAttempted);
      
      if (primaryResult.content) {
        content = primaryResult.content;
        extractionAudit.extraction_method = 'primary';
        extractionAudit.successful_selector = primaryResult.successfulSelector;
      }
      
      // Step 2: Try fallback content selectors if primary failed
      if (!content) {
        const fallbackResult = bdlawTrySelectorsWithAudit(
          BDLAW_LEGAL_SELECTORS.contentFallback,
          'fallback'
        );
        extractionAudit.selectors_attempted.push(...fallbackResult.selectorsAttempted);
        
        if (fallbackResult.content) {
          content = fallbackResult.content;
          extractionAudit.extraction_method = 'fallback';
          extractionAudit.successful_selector = fallbackResult.successfulSelector;
        }
      }
      
      // Step 3: Try meta selectors if still no content
      if (!content) {
        const metaResult = bdlawTrySelectorsWithAudit(
          BDLAW_LEGAL_SELECTORS.meta,
          'meta'
        );
        extractionAudit.selectors_attempted.push(...metaResult.selectorsAttempted);
        
        if (metaResult.content) {
          content = metaResult.content;
          extractionAudit.extraction_method = 'meta';
          extractionAudit.successful_selector = metaResult.successfulSelector;
        }
      }
      
      // Step 4: Body fallback with strict exclusion filtering
      // Requirements: 5.9, 5.10 - Never infer missing text, never downgrade integrity rules
      // This uses textContent ONLY (Requirement 9.4) and removes UI noise
      if (!content) {
        const bodyResult = bdlawExtractBodyFallback();
        
        extractionAudit.selectors_attempted.push({
          selector: 'body',
          matched: true,
          element_count: 1,
          note: 'body_fallback_with_exclusions'
        });
        extractionAudit.body_exclusions_applied = bodyResult.exclusionsApplied;
        
        if (bodyResult.content) {
          content = bodyResult.content;
          extractionAudit.extraction_method = 'body_fallback';
          extractionAudit.successful_selector = 'body';
        }
      }

      // Extract schedule content if present
      const scheduleContent = bdlawTrySelectorsAll(BDLAW_LEGAL_SELECTORS.schedule);
      if (scheduleContent && content && !content.includes(scheduleContent)) {
        content = `${content}\n\n${scheduleContent}`;
      } else if (scheduleContent && !content) {
        content = scheduleContent;
      }

      // Extract tables from the page for fallback mode
      const allTables = document.querySelectorAll('table');
      allTables.forEach((tableEl, idx) => {
        const tableData = bdlawExtractTableWithMergedCells(tableEl);
        if (tableData.data.length > 0) {
          tables.push({
            sectionIndex: idx,
            data: tableData.data,
            hasMergedCells: tableData.hasMergedCells
          });
        }
      });
    }

    // Apply content noise filtering
    // Requirements: 28.1-28.6 - Content Noise Filtering
    content = bdlawFilterContentNoise(content);

    // Also filter noise from structured section bodies
    structuredSections = structuredSections.map(section => ({
      ...section,
      sectionBody: bdlawFilterContentNoise(section.sectionBody)
    }));

    // Detect section markers in the content
    const detected = bdlawDetectSectionMarkers(content);
    const counts = bdlawCountSectionMarkers(content);

    // Detect amendment markers
    // Requirements: 25.1-25.5 - Amendment and Deletion Marker Detection
    const amendments = bdlawDetectAmendmentMarkers(content);

    // Detect cross-references in the content
    // Requirements: 6.1 - Cross-reference detection during extraction
    const crossReferences = bdlawDetectCrossReferences(content);

    // Requirements: 7.1 - Call validateContentQuality during extraction
    // Return data_quality in extraction result
    let dataQuality = { completeness: 'complete', flags: [], issues: [] };
    if (typeof BDLawQuality !== 'undefined' && BDLawQuality.validateContentQuality) {
      dataQuality = BDLawQuality.validateContentQuality(content);
    }

    // Detect extraction risks
    // Requirements: 13.1-13.6 - Extraction Risk Detection
    const extractionRisk = bdlawDetectExtractionRisks();

    // ============================================
    // LEGAL INTEGRITY ENHANCEMENT - Additional Detection Functions
    // Requirements: All Legal Integrity Enhancement requirements
    // ============================================

    // Detect numeric regions for protection
    // Requirements: 3.1-3.7 - Numeric Region Protection
    let numericRegions = [];
    if (typeof BDLawExtractor !== 'undefined' && BDLawExtractor.detectNumericRegions) {
      numericRegions = BDLawExtractor.detectNumericRegions(content);
    }

    // Detect protected sections (definitions, provisos, explanations)
    // Requirements: 17.1-17.7 - Protected Section Detection
    let protectedSectionsResult = { protected_sections: [], regions: [] };
    if (typeof BDLawExtractor !== 'undefined' && BDLawExtractor.detectProtectedSections) {
      protectedSectionsResult = BDLawExtractor.detectProtectedSections(content);
    }

    // Detect numeric representation (Bengali vs English digits)
    // Requirements: 14.1-14.5 - Numeric Representation Recording
    let numericRepresentation = { numeric_representation: [], bn_digit_count: 0, en_digit_count: 0, is_mixed: false };
    if (typeof BDLawExtractor !== 'undefined' && BDLawExtractor.detectNumericRepresentation) {
      numericRepresentation = BDLawExtractor.detectNumericRepresentation(content);
    }

    // Calculate language distribution
    // Requirements: 19.1-19.5 - Language Distribution Recording
    let languageDistribution = { bn_ratio: 0, en_ratio: 0 };
    if (typeof BDLawExtractor !== 'undefined' && BDLawExtractor.calculateLanguageDistribution) {
      languageDistribution = BDLawExtractor.calculateLanguageDistribution(content);
    }

    // Detect editorial content (footnotes, marginal notes, annotations)
    // Requirements: 15.1-15.6 - Editorial Content Detection
    let editorialContent = { editorial_content_present: false, editorial_types: [] };
    if (typeof BDLawExtractor !== 'undefined' && BDLawExtractor.detectEditorialContent) {
      editorialContent = BDLawExtractor.detectEditorialContent(content);
    }

    // Extract schedule HTML verbatim
    // Requirements: 8.1-8.6 - Schedule HTML Preservation
    let schedules = {
      representation: 'raw_html',
      extraction_method: 'verbatim_dom_capture',
      processed: false,
      html_content: null,
      schedule_count: 0,
      has_tables: false,
      missing_schedule_flag: false
    };
    if (typeof BDLawExtractor !== 'undefined' && BDLawExtractor.extractScheduleHTML) {
      schedules = BDLawExtractor.extractScheduleHTML(document);
    }

    // Create title preservation structure
    // Requirements: 18.1-18.5 - Title Preservation
    let titlePreservation = { title_raw: title, title_normalized: title };
    if (typeof BDLawExtractor !== 'undefined' && BDLawExtractor.createTitlePreservation) {
      titlePreservation = BDLawExtractor.createTitlePreservation(title);
    }

    // ============================================
    // DOM-FIRST STRUCTURE DERIVATION
    // Requirements: Legal Structure Derivation & Reference Anchoring
    // ============================================
    
    // Extract structure from DOM (content is the content_raw)
    let structureDerived = null;
    let crossReferencesDerived = [];
    
    try {
      // Extract structure tree from DOM
      structureDerived = extractStructureFromDOM(content);
      
      // Extract cross-references with scope anchoring
      crossReferencesDerived = extractReferencesWithScope(content, structureDerived);
    } catch (structureError) {
      // Never throw - set null on error per error handling requirements
      console.error('Structure derivation error:', structureError);
      structureDerived = null;
      crossReferencesDerived = [];
    }

    return {
      success: true,
      title: title,
      content: content,
      sections: {
        detected: detected,
        counts: counts
      },
      // Structured data for corpus export
      // Requirements: 26.1, 26.2, 26.3 - Include structured arrays
      structured_sections: structuredSections,
      tables: tables,
      amendments: amendments,
      // Cross-references detected during extraction
      // Requirements: 6.1 - Return cross_references in extraction result
      cross_references: {
        count: crossReferences.length,
        method: "pattern-based detection, not semantically verified",
        references: crossReferences
      },
      // Data quality assessment
      // Requirements: 7.1 - Return data_quality in extraction result
      data_quality: dataQuality,
      // Legal status and temporal marking
      // Requirements: 6.1-6.3, 7.1-7.4 - Legal Integrity Enhancement
      ...bdlawDetectLegalStatus(),
      temporal_status: BDLAW_TEMPORAL_STATUS,
      temporal_disclaimer: BDLAW_TEMPORAL_DISCLAIMER,
      // Extraction risk detection
      // Requirements: 13.1-13.6 - Include extraction_risk in every exported act
      extraction_risk: extractionRisk,
      metadata: structuredResult.metadata,
      
      // ============================================
      // LEGAL INTEGRITY ENHANCEMENT - New Fields
      // ============================================
      
      // Title preservation
      // Requirements: 18.1-18.5 - Title Preservation
      title_raw: titlePreservation.title_raw,
      title_normalized: titlePreservation.title_normalized,
      
      // Numeric regions for protection
      // Requirements: 3.1-3.7 - Numeric Region Protection
      numeric_regions: numericRegions,
      
      // Protected sections (definitions, provisos, explanations)
      // Requirements: 17.1-17.7 - Protected Section Detection
      protected_sections: protectedSectionsResult.protected_sections,
      protected_sections_result: protectedSectionsResult,
      
      // Numeric representation (Bengali vs English digits)
      // Requirements: 14.1-14.5 - Numeric Representation Recording
      numeric_representation: numericRepresentation,
      
      // Language distribution
      // Requirements: 19.1-19.5 - Language Distribution Recording
      language_distribution: languageDistribution,
      
      // Editorial content detection
      // Requirements: 15.1-15.6 - Editorial Content Detection
      editorial_content: editorialContent,
      
      // Schedule HTML preservation
      // Requirements: 8.1-8.6 - Schedule HTML Preservation
      schedules: schedules,
      
      // ============================================
      // DOM-FIRST STRUCTURE DERIVATION
      // Requirements: Legal Structure Derivation & Reference Anchoring
      // ============================================
      
      // Structure tree (DOM-derived JSON tree)
      structure: structureDerived,
      
      // Cross-references (DOM-anchored array)
      cross_references_derived: crossReferencesDerived,
      
      // ============================================
      // EXTRACTION AUDIT METADATA
      // Full audit trail for selector hierarchy and extraction method
      // ============================================
      
      // Extraction method used (structured | primary | fallback | body_fallback)
      extraction_method: extractionAudit.extraction_method,
      
      // DOM extraction method (ALWAYS textContent per legal-integrity-rules)
      dom_extraction_method: extractionAudit.dom_extraction_method,
      
      // Successful selector that yielded content
      successful_selector: extractionAudit.successful_selector,
      
      // Full audit of selectors attempted with match status
      selectors_attempted: extractionAudit.selectors_attempted,
      
      // Body exclusions applied (only for body_fallback method)
      body_exclusions_applied: extractionAudit.body_exclusions_applied,
      
      // Legacy field for backward compatibility
      // Requirements: 5.7 - Record which selector set was used
      selector_strategy_used: extractionAudit.extraction_method || 'standard'
    };
  }

  /**
   * Extract volume data (act catalog) from Layer 2 (Volume) pages
   * Requirements: 4.1 - Volume page metadata extraction
   */
  function extractBDLawVolumeData() {
    const actsMap = new Map(); // Use Map to deduplicate by act number
    
    // Look for act links in the volume page
    const links = document.querySelectorAll('a[href*="act-"]');
    
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;

      // Extract act number from URL
      const actNumberMatch = href.match(/act-(?:details-)?(\d+)\.html/);
      if (!actNumberMatch) continue;

      const actNumber = actNumberMatch[1];
      
      // Get the title from the link text
      let title = link.textContent ? link.textContent.trim() : '';
      
      // Skip if title is just a number (serial number or year only)
      if (/^[০-৯\d]+$/.test(title)) {
        continue;
      }
      
      // Skip if title is just a 4-digit year
      if (/^(১৯|২০|19|20)\d{2}$/.test(title)) {
        continue;
      }
      
      // Skip very short titles (likely not actual act names)
      if (title.length < 5) {
        continue;
      }

      // Try to extract year from the title
      let year = '';
      // Match Bengali year (২০২৫) or English year (2025)
      const bengaliYearMatch = title.match(/(২০[০-৯]{2}|১৯[০-৯]{2})/);
      const englishYearMatch = title.match(/(20\d{2}|19\d{2})/);
      if (englishYearMatch) {
        year = englishYearMatch[1];
      } else if (bengaliYearMatch) {
        year = bengaliYearMatch[1];
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

      // Only add if we don't have this act yet, or if new title is longer (more complete)
      const existing = actsMap.get(actNumber);
      if (!existing || title.length > existing.title.length) {
        actsMap.set(actNumber, {
          title,
          year,
          actNumber,
          url
        });
      }
    }

    // Convert Map to array and sort by act number
    const acts = Array.from(actsMap.values()).sort((a, b) => {
      return parseInt(a.actNumber) - parseInt(b.actNumber);
    });

    return {
      success: true,
      acts: acts
    };
  }

  /**
   * Extract act catalog from Chronological or Alphabetical Index pages
   * These pages list all acts in a different format than volume pages.
   * 
   * @param {string} indexType - 'chronological' or 'alphabetical'
   * @returns {Object} { success: boolean, acts: Array, indexType: string }
   */
  function extractBDLawIndexData(indexType) {
    const actsMap = new Map(); // Use Map to deduplicate by act number
    
    // Look for act links in the index page
    // Index pages typically have links to act-details pages
    const links = document.querySelectorAll('a[href*="act-"]');
    
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;

      // Extract act number from URL
      const actNumberMatch = href.match(/act-(?:details-)?(\d+)\.html/);
      if (!actNumberMatch) continue;

      const actNumber = actNumberMatch[1];
      
      // Get the title from the link text using textContent (NEVER innerText)
      let title = link.textContent ? link.textContent.trim() : '';
      
      // Skip if title is just a number (serial number or year only)
      if (/^[০-৯\d]+$/.test(title)) {
        continue;
      }
      
      // Skip if title is just a 4-digit year
      if (/^(১৯|২০|19|20)\d{2}$/.test(title)) {
        continue;
      }
      
      // Skip very short titles (likely not actual act names)
      if (title.length < 5) {
        continue;
      }

      // Try to extract year from the title
      let year = '';
      // Match Bengali year (২০২৫) or English year (2025)
      const bengaliYearMatch = title.match(/(২০[০-৯]{2}|১৯[০-৯]{2})/);
      const englishYearMatch = title.match(/(20\d{2}|19\d{2})/);
      if (englishYearMatch) {
        year = englishYearMatch[1];
      } else if (bengaliYearMatch) {
        year = bengaliYearMatch[1];
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

      // Only add if we don't have this act yet, or if new title is longer (more complete)
      const existing = actsMap.get(actNumber);
      if (!existing || title.length > existing.title.length) {
        actsMap.set(actNumber, {
          title,
          year,
          actNumber,
          url,
          source: indexType // Track which index this came from
        });
      }
    }

    // Convert Map to array
    let acts = Array.from(actsMap.values());
    
    // Sort based on index type
    if (indexType === 'chronological') {
      // Sort by year (descending) then by act number
      acts.sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        if (yearB !== yearA) return yearB - yearA;
        return parseInt(a.actNumber) - parseInt(b.actNumber);
      });
    } else {
      // Alphabetical - sort by title
      acts.sort((a, b) => a.title.localeCompare(b.title, 'bn'));
    }

    return {
      success: true,
      acts: acts,
      indexType: indexType
    };
  }

  // ============================================
  // Message Handler
  // ============================================

  // Prevent multiple script injections
  if (window.bdlawCorpusContentScript) {
    console.log('BDLawCorpus content script already loaded');
    return;
  }
  window.bdlawCorpusContentScript = true;

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('BDLawCorpus received message:', request.action);
    
    try {
      // Ping handler for connection check
      if (request.action === 'ping') {
        sendResponse({ 
          success: true, 
          message: 'BDLawCorpus content script ready', 
          version: CONTENT_SCRIPT_VERSION 
        });
        return true;
      }
      
      // Extract act content from Layer 3 pages
      // Requirements: 5.8 - Support broader selectors for retry attempts
      if (request.action === 'bdlaw:extractAct') {
        try {
          // Pass broader selectors if provided (for retry attempts)
          const options = {
            useBroaderSelectors: request.useBroaderSelectors || false,
            broaderSelectors: request.broaderSelectors || null
          };
          const result = extractBDLawActContent(options);
          sendResponse(result);
        } catch (error) {
          console.error('BDLaw act extraction error:', error);
          sendResponse({
            success: false,
            error: error.message || 'Failed to extract act content'
          });
        }
        return true;
      }
      
      // Extract volume catalog from Layer 2 pages
      if (request.action === 'bdlaw:extractVolume') {
        try {
          const result = extractBDLawVolumeData();
          sendResponse(result);
        } catch (error) {
          console.error('BDLaw volume extraction error:', error);
          sendResponse({
            success: false,
            error: error.message || 'Failed to extract volume catalog'
          });
        }
        return true;
      }

      // Extract index catalog from Chronological/Alphabetical Index pages
      if (request.action === 'bdlaw:extractIndex') {
        try {
          const indexType = request.indexType || 'chronological';
          const result = extractBDLawIndexData(indexType);
          sendResponse(result);
        } catch (error) {
          console.error('BDLaw index extraction error:', error);
          sendResponse({
            success: false,
            error: error.message || 'Failed to extract index catalog'
          });
        }
        return true;
      }

      // Unknown action
      sendResponse({ 
        success: false, 
        error: 'Unknown action: ' + request.action 
      });
      return true;

    } catch (error) {
      console.error('BDLawCorpus message handler error:', error);
      sendResponse({
        success: false,
        error: error.message || 'Unknown error'
      });
      return true;
    }
  });

  console.log('BDLawCorpus content script loaded on:', window.location.href);

})();
