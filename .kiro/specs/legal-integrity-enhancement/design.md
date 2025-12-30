# Design Document: Legal Integrity Enhancement

## Overview

This design enhances the BDLawCorpus extension to meet research-grade legal corpus standards. The system implements a three-version content model, numeric region protection, negation-aware reference classification, and comprehensive audit trails to ensure the corpus is forensically safe, peer-review defensible, and never alters legal meaning.

The design follows these non-negotiable principles:
- **No legal interpretation**: Pattern detection only, no semantic inference
- **No semantic rewriting**: Original text preserved byte-identical
- **Full auditability**: Every transformation logged with position and risk level
- **Ambiguity surfaced**: Risks flagged, not hidden

## Architecture

The legal integrity system integrates into the existing extraction pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Legal Integrity Pipeline                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ DOM         │  │ Three-Version   │  │ Protected Section               │  │
│  │ Extraction  │──▶│ Content Model   │──▶│ Detection                       │  │
│  └─────────────┘  └─────────────────┘  └─────────────────────────────────┘  │
│         │                │                           │                       │
│         ▼                ▼                           ▼                       │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ content_raw │  │ content_        │  │ Numeric Region                  │  │
│  │ (immutable) │  │ normalized      │  │ Detection                       │  │
│  └─────────────┘  └─────────────────┘  └─────────────────────────────────┘  │
│                          │                           │                       │
│                          ▼                           ▼                       │
│                 ┌─────────────────┐  ┌─────────────────────────────────┐    │
│                 │ content_        │  │ Transformation                  │    │
│                 │ corrected       │  │ Audit Log                       │    │
│                 └─────────────────┘  └─────────────────────────────────┘    │
│                          │                           │                       │
│                          └───────────┬───────────────┘                       │
│                                      ▼                                       │
│                          ┌─────────────────────────┐                        │
│                          │ Export with Full        │                        │
│                          │ Integrity Metadata      │                        │
│                          └─────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Three-Version Content Model

```javascript
/**
 * Three-version content structure
 * Requirements: 1.1-1.6
 */
const THREE_VERSION_CONTENT = {
  content_raw: '',        // Exact extracted text, NEVER modified
  content_normalized: '', // Unicode NFC normalized only
  content_corrected: ''   // Encoding-level fixes applied
};

/**
 * Create three-version content from extracted text
 * Requirements: 1.1, 1.3, 1.4
 * 
 * @param {string} extractedText - Raw text from DOM extraction
 * @returns {Object} Three-version content object
 */
function createThreeVersionContent(extractedText) {
  return {
    content_raw: extractedText,  // Never modify this
    content_normalized: extractedText.normalize('NFC'),
    content_corrected: extractedText.normalize('NFC')  // Will be updated by safe corrections
  };
}

/**
 * Compute content hash from content_raw only
 * Requirements: 1.5
 */
async function computeContentHash(threeVersionContent) {
  const encoder = new TextEncoder();
  const data = encoder.encode(threeVersionContent.content_raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 2. Transformation Audit System

```javascript
/**
 * Transformation log entry structure
 * Requirements: 2.1-2.5
 */
const TRANSFORMATION_ENTRY = {
  transformation_type: 'encoding_fix | ocr_fix | normalization',
  original: '',
  corrected: '',
  position: 0,           // Character offset in content_raw
  risk_level: 'non-semantic | potential-semantic',
  applied: true,         // false if flag-only mode
  timestamp: ''
};

/**
 * Risk level classification
 * Requirements: 2.2, 2.3
 */
const RISK_CLASSIFICATION = {
  // Non-semantic (safe to apply)
  'mojibake': 'non-semantic',
  'html_entity': 'non-semantic',
  'broken_unicode': 'non-semantic',
  'unicode_normalization': 'non-semantic',
  
  // Potential-semantic (flag only, do not apply)
  'ocr_word_correction': 'potential-semantic',
  'spelling_correction': 'potential-semantic',
  'punctuation_change': 'potential-semantic'
};

/**
 * Log a transformation with risk assessment
 * Requirements: 2.1, 2.4
 */
function logTransformation(transformationLog, entry) {
  const riskLevel = RISK_CLASSIFICATION[entry.transformation_type] || 'potential-semantic';
  
  transformationLog.push({
    ...entry,
    risk_level: riskLevel,
    applied: riskLevel === 'non-semantic',  // Only apply non-semantic
    timestamp: new Date().toISOString()
  });
  
  return riskLevel === 'non-semantic';  // Return whether to apply
}
```

### 3. Numeric Region Protection

```javascript
/**
 * Numeric region detection patterns
 * Requirements: 3.1-3.4
 */
const NUMERIC_PATTERNS = {
  currency: [
    /৳\s*[\d০-৯,]+/g,           // Bengali Taka symbol
    /টাকা\s*[\d০-৯,]+/g,        // "Taka" word
    /Tk\.?\s*[\d,]+/gi,          // English Tk
    /\$\s*[\d,]+/g               // Dollar
  ],
  percentage: [
    /[\d০-৯]+(?:\.[\d০-৯]+)?\s*%/g,
    /[\d০-৯]+(?:\.[\d০-৯]+)?\s*শতাংশ/g,
    /[\d০-৯]+(?:\.[\d০-৯]+)?\s*percent/gi
  ],
  rate: [
    /[\d০-৯]+(?:\.[\d০-৯]+)?\s*(?:per\s+annum|বার্ষিক|হার)/gi,
    /rate\s+of\s+[\d০-৯]+/gi
  ],
  table_markers: [
    /<table[\s\S]*?<\/table>/gi,
    /তফসিল|Schedule|Appendix/gi
  ]
};

/**
 * Detect numeric-sensitive regions
 * Requirements: 3.1-3.5
 * 
 * @param {string} content - Content to analyze
 * @returns {Array} Array of {start, end, type} for each numeric region
 */
function detectNumericRegions(content) {
  const regions = [];
  
  for (const [type, patterns] of Object.entries(NUMERIC_PATTERNS)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
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
  
  return mergeOverlappingRegions(regions);
}

/**
 * Check if position is within a numeric region
 * Requirements: 3.6
 */
function isInNumericRegion(position, numericRegions) {
  return numericRegions.some(r => position >= r.start && position < r.end);
}
```

### 4. Negation-Aware Reference Classification

```javascript
/**
 * Bengali negation words
 * Requirements: 4.1
 */
const NEGATION_WORDS = ['না', 'নয়', 'নহে', 'নাই', 'নেই', 'ব্যতীত', 'ছাড়া'];

/**
 * Check for negation within context window
 * Requirements: 4.1, 4.2
 * 
 * @param {string} content - Full content
 * @param {number} position - Citation position
 * @param {number} window - Characters to check (default ±20)
 * @returns {Object} {negation_present, negation_word, negation_position}
 */
function checkNegationContext(content, position, window = 20) {
  const start = Math.max(0, position - window);
  const end = Math.min(content.length, position + window);
  const context = content.substring(start, end);
  
  for (const word of NEGATION_WORDS) {
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
}

/**
 * Classify lexical relation with negation awareness
 * Requirements: 4.3, 4.4, 5.1
 * 
 * @param {string} contextText - Text surrounding citation
 * @param {Object} negationCheck - Result from checkNegationContext
 * @returns {Object} {lexical_relation_type, negation_present, ...}
 */
function classifyLexicalRelation(contextText, negationCheck) {
  // If negation present, ALWAYS return "mention"
  if (negationCheck.negation_present) {
    return {
      lexical_relation_type: 'mention',
      negation_present: true,
      negation_word: negationCheck.negation_word,
      negation_context: negationCheck.negation_context,
      classification_note: 'Negation detected - forced to mention type'
    };
  }
  
  // Otherwise, use keyword-based classification
  const type = detectLexicalRelationType(contextText);
  
  return {
    lexical_relation_type: type,
    negation_present: false
  };
}

/**
 * Detect lexical relation type from keywords (no negation)
 */
function detectLexicalRelationType(contextText) {
  const LEXICAL_KEYWORDS = {
    amendment: ['সংশোধন', 'সংশোধিত', 'amendment', 'amended'],
    repeal: ['রহিত', 'রহিতকরণ', 'repeal', 'repealed'],
    substitution: ['প্রতিস্থাপিত', 'substituted', 'replaced'],
    dependency: ['সাপেক্ষে', 'অধীন', 'subject to', 'under']
  };
  
  for (const [type, keywords] of Object.entries(LEXICAL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (contextText.includes(keyword)) {
        return type;
      }
    }
  }
  
  return 'mention';
}
```

### 5. Protected Section Detection

```javascript
/**
 * Protected section patterns
 * Requirements: 17.1-17.3
 */
const PROTECTED_SECTION_PATTERNS = {
  definitions: [
    /সংজ্ঞা/g,
    /\bdefinition[s]?\b/gi,
    /\bmeans\b/gi,
    /"[^"]+"\s+(?:means|অর্থ)/gi
  ],
  proviso: [
    /তবে শর্ত/g,
    /\bProvided\s+that\b/gi,
    /\bproviso\b/gi
  ],
  explanation: [
    /ব্যাখ্যা/g,
    /\bExplanation\b/gi
  ]
};

/**
 * Detect protected sections in content
 * Requirements: 17.1-17.4
 * 
 * @param {string} content - Content to analyze
 * @returns {Object} {protected_sections: [], regions: []}
 */
function detectProtectedSections(content) {
  const sections = new Set();
  const regions = [];
  
  for (const [sectionType, patterns] of Object.entries(PROTECTED_SECTION_PATTERNS)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        sections.add(sectionType);
        // Extend region to include surrounding context (e.g., full definition)
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
  
  return {
    protected_sections: Array.from(sections),
    regions: mergeOverlappingRegions(regions)
  };
}

/**
 * Check if position is within a protected section
 * Requirements: 17.5, 17.6
 */
function isInProtectedSection(position, protectedRegions) {
  return protectedRegions.some(r => position >= r.start && position < r.end);
}
```

### 6. Lexical Relation Confidence

```javascript
/**
 * Assign confidence level based on pattern clarity
 * Requirements: 16.1-16.5
 * 
 * @param {Object} citation - Detected citation object
 * @returns {string} 'high' | 'medium' | 'low'
 */
function assignLexicalConfidence(citation) {
  // High: Full citation with name, year, and serial
  if (citation.act_name && citation.citation_year && citation.citation_serial) {
    return 'high';
  }
  
  // Medium: Year and serial but no name
  if (citation.citation_year && citation.citation_serial) {
    return 'medium';
  }
  
  // Low: Partial match or ambiguous
  return 'low';
}
```

### 7. Extraction Risk Detection

```javascript
/**
 * Detect extraction risks
 * Requirements: 13.1-13.6
 * 
 * @param {Document} document - DOM document
 * @returns {Object} extraction_risk object
 */
function detectExtractionRisks(document) {
  const risks = {
    possible_truncation: false,
    reasons: []
  };
  
  // Check for pagination
  const paginationElements = document.querySelectorAll('.pagination, .page-nav, [data-page]');
  if (paginationElements.length > 0) {
    risks.possible_truncation = true;
    risks.reasons.push('pagination');
  }
  
  // Check for lazy-loaded content
  const lazyElements = document.querySelectorAll('[data-src], [loading="lazy"], .lazy-load');
  if (lazyElements.length > 0) {
    risks.possible_truncation = true;
    risks.reasons.push('lazy_load');
  }
  
  // Check for external schedule links
  const scheduleLinks = document.querySelectorAll('a[href*="schedule"], a[href*="appendix"]');
  if (scheduleLinks.length > 0) {
    risks.possible_truncation = true;
    risks.reasons.push('external_link');
  }
  
  // Check for hidden DOM
  const hiddenElements = document.querySelectorAll('[style*="display:none"], [hidden], .hidden');
  if (hiddenElements.length > 0) {
    risks.possible_truncation = true;
    risks.reasons.push('hidden_dom');
  }
  
  return {
    possible_truncation: risks.possible_truncation,
    reason: risks.reasons.length > 0 ? risks.reasons.join(', ') : 'none'
  };
}
```

### 8. Numeric Representation Recording

```javascript
/**
 * Detect numeric representation types
 * Requirements: 14.1-14.5
 * 
 * @param {string} content - Content to analyze
 * @returns {Object} {numeric_representation: [], bn_count, en_count}
 */
function detectNumericRepresentation(content) {
  const bengaliDigits = content.match(/[০-৯]/g) || [];
  const englishDigits = content.match(/[0-9]/g) || [];
  
  const representation = [];
  if (bengaliDigits.length > 0) representation.push('bn_digits');
  if (englishDigits.length > 0) representation.push('en_digits');
  
  return {
    numeric_representation: representation,
    bn_digit_count: bengaliDigits.length,
    en_digit_count: englishDigits.length,
    is_mixed: representation.length > 1
  };
}
```

### 9. Language Distribution Recording

```javascript
/**
 * Calculate language distribution
 * Requirements: 19.1-19.5
 * 
 * @param {string} content - Content to analyze
 * @returns {Object} {bn_ratio, en_ratio}
 */
function calculateLanguageDistribution(content) {
  const bengaliChars = (content.match(/[\u0980-\u09FF]/g) || []).length;
  const englishChars = (content.match(/[A-Za-z]/g) || []).length;
  const totalChars = bengaliChars + englishChars;
  
  if (totalChars === 0) {
    return { bn_ratio: 0, en_ratio: 0 };
  }
  
  return {
    bn_ratio: Math.round((bengaliChars / totalChars) * 100) / 100,
    en_ratio: Math.round((englishChars / totalChars) * 100) / 100
  };
}
```

### 10. Editorial Content Detection

```javascript
/**
 * Detect editorial content (footnotes, marginal notes, annotations)
 * Requirements: 15.1-15.6
 * 
 * @param {string} content - Content to analyze
 * @returns {Object} {editorial_content_present, types}
 */
function detectEditorialContent(content) {
  const EDITORIAL_PATTERNS = {
    footnote: [/\[\d+\]/g, /\*{1,3}/g, /†/g],
    marginal_note: [/\[মার্জিনাল নোট\]/gi, /\[Marginal Note\]/gi],
    editor_annotation: [/\[সম্পাদকের নোট\]/gi, /\[Editor's Note\]/gi, /\[Note:/gi]
  };
  
  const detectedTypes = [];
  
  for (const [type, patterns] of Object.entries(EDITORIAL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        detectedTypes.push(type);
        break;
      }
    }
  }
  
  return {
    editorial_content_present: detectedTypes.length > 0,
    editorial_types: detectedTypes
  };
}
```

## Data Models

### Enhanced Act Export Schema

```json
{
  "identifiers": {
    "internal_id": "754",
    "note": "internal_id is the bdlaws database identifier, not the legal citation number"
  },
  "title_raw": "অর্থ আইন, ১৯৯১",
  "title_normalized": "অর্থ আইন, ১৯৯১",
  "content_raw": "...",
  "content_normalized": "...",
  "content_corrected": "...",
  "url": "http://bdlaws.minlaw.gov.bd/act-details-754.html",
  "volume_number": "28",
  
  "legal_status": "active | repealed | unknown",
  "temporal_status": "historical_text",
  "temporal_disclaimer": "No inference of current legal force or applicability",
  
  "lexical_references": {
    "count": 8,
    "method": "pattern-based detection",
    "disclaimer": "Detected via pattern matching. No legal force or applicability implied.",
    "relationship_inference": "explicitly_prohibited",
    "references": [
      {
        "citation_text": "Income Tax Ordinance, 1984 (XXXVI of 1984)",
        "lexical_relation_type": "mention",
        "lexical_relation_confidence": "high",
        "negation_present": false,
        "position": 2341,
        "context_before": "...",
        "context_after": "..."
      }
    ]
  },
  
  "schedules": {
    "representation": "raw_html",
    "extraction_method": "verbatim_dom_capture",
    "processed": false,
    "html_content": "<table>...</table>"
  },
  
  "transformation_log": [
    {
      "transformation_type": "mojibake",
      "original": "à¦¬à¦¾à¦‚à¦²à¦¾",
      "corrected": "বাংলা",
      "position": 1234,
      "risk_level": "non-semantic",
      "applied": true,
      "timestamp": "2025-12-28T10:00:00Z"
    }
  ],
  
  "protected_sections": ["definitions", "proviso"],
  "numeric_regions": [
    {
      "start": 500,
      "end": 550,
      "type": "currency",
      "numeric_integrity_sensitive": true
    }
  ],
  
  "data_quality": {
    "completeness": "textual_partial",
    "completeness_disclaimer": "Website representation incomplete; legal completeness unknown",
    "flags": ["missing_schedule", "encoding_error"],
    "risks": ["numeric_corruption_risk"],
    "known_limitations": ["Section boundary detection is presentation-dependent"],
    "safe_for_ml_training": false,
    "intended_ml_use": ["retrieval", "extractive_question_answering"]
  },
  
  "extraction_risk": {
    "possible_truncation": true,
    "reason": "external_link"
  },
  
  "numeric_representation": ["bn_digits", "en_digits"],
  "language_distribution": {
    "bn_ratio": 0.92,
    "en_ratio": 0.08
  },
  "editorial_content_present": false,
  "formatting_scope": "presentation_only",
  
  "source_authority": "bdlaws_html_only",
  "authority_rank": ["bdlaws_html"],
  
  "_metadata": {
    "source": "bdlaws.minlaw.gov.bd",
    "source_url": "http://bdlaws.minlaw.gov.bd/act-details-754.html",
    "scraped_at": "2025-12-28T08:14:31Z",
    "extracted_at": "2025-12-28T08:14:31Z",
    "tool": "BDLawCorpus",
    "tool_version": "2.0.0",
    "schema_version": "3.0",
    "content_hash": "sha256:abc123...",
    "hash_source": "content_raw"
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Content Raw Immutability

*For any* act processed through the pipeline, `content_raw` SHALL be byte-identical to the originally extracted text. No operation SHALL modify `content_raw` after initial extraction.

**Validates: Requirements 1.1, 1.2**

### Property 2: Content Hash Anchoring

*For any* act, computing SHA-256 hash of `content_raw` SHALL produce the same value as `_metadata.content_hash`. The hash SHALL be deterministic and computed exclusively from `content_raw`.

**Validates: Requirements 1.5**

### Property 3: Citation Position Round-Trip

*For any* detected lexical reference, extracting `content_raw.substring(position, position + citation_text.length)` SHALL return exactly `citation_text`.

**Validates: Requirements 1.6**

### Property 4: Transformation Audit Completeness

*For any* transformation applied to content, the `transformation_log` SHALL contain an entry with all required fields: transformation_type, original, corrected, position, risk_level, applied, timestamp.

**Validates: Requirements 2.1, 2.5**

### Property 5: Risk Level Classification

*For any* encoding fix (mojibake, HTML entity, broken Unicode), risk_level SHALL be "non-semantic". *For any* OCR word correction, risk_level SHALL be "potential-semantic".

**Validates: Requirements 2.2, 2.3**

### Property 6: Potential-Semantic Flag-Only Mode

*For any* transformation with risk_level "potential-semantic", the `applied` field SHALL be false and `content_corrected` SHALL NOT contain the correction.

**Validates: Requirements 2.4**

### Property 7: Numeric Region Protection

*For any* detected numeric region (currency, percentage, rate, table), no OCR correction, encoding repair, or formatting SHALL be applied within that region. Only Unicode normalization is permitted.

**Validates: Requirements 3.5, 3.6, 3.7**

### Property 8: Negation Override Classification

*For any* lexical reference where Bengali negation words (না, নয়, নহে) appear within ±20 characters, `lexical_relation_type` SHALL be "mention" and `negation_present` SHALL be true, regardless of other keywords present.

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 9: Protected Section Enforcement

*For any* OCR artifact detected within a protected section (definitions, proviso, explanation), the artifact SHALL be flagged but NOT corrected. `content_corrected` SHALL preserve the original text in protected sections.

**Validates: Requirements 17.5, 17.6, 17.7**

### Property 10: Lexical Relation Purity

*For any* exported act, the field name SHALL be `lexical_relation_type` (not `reference_type`), and the export SHALL include the disclaimer "Detected via pattern matching. No legal force or applicability implied."

**Validates: Requirements 5.1, 5.2**

### Property 11: Safe For ML Training Logic

*For any* act with numeric corruption risk, encoding ambiguity, missing schedules, or heavy OCR correction, `data_quality.safe_for_ml_training` SHALL be false.

**Validates: Requirements 9.5**

### Property 12: Schedule HTML Preservation

*For any* act with schedule content, `schedules.representation` SHALL be "raw_html", `schedules.processed` SHALL be false, and the HTML SHALL be verbatim from DOM extraction.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

## Error Handling

| Error Condition | Handling |
|-----------------|----------|
| Empty/null content | Create empty three-version structure, flag as incomplete |
| Unicode normalization failure | Preserve content_raw, set content_normalized = content_raw |
| Numeric region detection failure | Default to no numeric regions, log error |
| Protected section detection failure | Default to no protected sections, log error |
| Hash computation failure | Log error, set content_hash to "error:computation_failed" |
| Transformation logging failure | Preserve original content, skip transformation |

## Testing Strategy

### Unit Tests
- Test three-version content creation with various encodings
- Test numeric region detection with currency, percentages, rates
- Test negation detection with all Bengali negation words
- Test protected section detection with definitions, provisos, explanations
- Test confidence level assignment for various citation patterns

### Property-Based Tests
- Generate random content and verify content_raw immutability
- Generate citations and verify position round-trip accuracy
- Generate transformations and verify audit log completeness
- Generate content with negation and verify classification override
- Generate numeric regions and verify protection enforcement

### Integration Tests
- Process actual extracted acts and verify full schema compliance
- Verify transformation log captures all changes
- Verify safe_for_ml_training logic across various conditions

### Test Configuration
- Minimum 100 iterations per property test
- Use fast-check for JavaScript property testing
- Tag format: **Feature: legal-integrity-enhancement, Property {N}: {title}**
