# Design Document: Data Quality & Remediation

## Overview

This design adds data quality assessment, text cleaning, and completeness validation to the BDLawCorpus extension. The system detects missing schedules, encoding errors, and OCR artifacts, then applies configurable cleaning rules while preserving original content for audit purposes.

The design follows these principles:
- **Non-destructive**: Original content is never modified in place
- **Configurable**: All cleaning rules can be enabled/disabled
- **Transparent**: All transformations are logged for audit
- **Extensible**: New rules can be added via configuration

## Architecture

The data quality system integrates into the existing extraction pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Quality Pipeline                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Extracted   │  │ Quality     │  │ Text                │  │
│  │ Content     │──▶│ Validator   │──▶│ Cleaner             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                          │                    │              │
│                          ▼                    ▼              │
│                 ┌─────────────┐      ┌─────────────────┐    │
│                 │ Issue       │      │ Cleaned         │    │
│                 │ Detection   │      │ Content         │    │
│                 └─────────────┘      └─────────────────┘    │
│                          │                    │              │
│                          └────────┬───────────┘              │
│                                   ▼                          │
│                          ┌─────────────────┐                │
│                          │ Export with     │                │
│                          │ data_quality    │                │
│                          └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Quality Validator Configuration

```javascript
/**
 * Configuration for data quality validation
 * Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5
 */
const QUALITY_CONFIG = {
  // Schedule detection patterns
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
  scheduleContentThreshold: 500,
  
  // Encoding error patterns
  encodingErrors: [
    { pattern: /æ/g, description: 'Corrupted quotation mark', replacement: '"' },
    { pattern: /[\u00ec\u00ed\u00ee\u00ef]/g, description: 'Corrupted table border', replacement: '\n' }
  ],
  
  // OCR artifact corrections
  ocrCorrections: [
    { incorrect: 'প্রম্্নফ', correct: 'প্রুফ', context: 'London Proof' },
    { incorrect: 'অতগরটির', correct: 'অক্ষরটির', context: 'letter reference' }
  ],
  
  // Formatting rules
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
};
```

### 2. Quality Validator Module

```javascript
/**
 * Validate content quality and detect issues
 * Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5
 * 
 * @param {string} content - The act content to validate
 * @param {Object} config - Quality configuration
 * @returns {Object} Quality assessment result
 */
function validateContentQuality(content, config = QUALITY_CONFIG) {
  if (!content || typeof content !== 'string') {
    return createEmptyAssessment();
  }
  
  const issues = [];
  const flags = new Set();
  
  // Detect missing schedules
  const scheduleIssues = detectMissingSchedules(content, config);
  if (scheduleIssues.length > 0) {
    flags.add('missing_schedule');
    issues.push(...scheduleIssues);
  }
  
  // Detect encoding errors
  const encodingIssues = detectEncodingErrors(content, config);
  if (encodingIssues.length > 0) {
    flags.add('encoding_error');
    issues.push(...encodingIssues);
  }
  
  // Detect OCR artifacts
  const ocrIssues = detectOcrArtifacts(content, config);
  if (ocrIssues.length > 0) {
    flags.add('ocr_artifact');
    issues.push(...ocrIssues);
  }
  
  // Determine completeness
  const completeness = determineCompleteness(flags, issues);
  
  return {
    completeness,
    flags: Array.from(flags),
    issues: issues.map(i => i.description)
  };
}

/**
 * Detect missing schedules in content
 * Requirements: 1.1-1.5
 */
function detectMissingSchedules(content, config) {
  const issues = [];
  const allPatterns = [
    ...config.schedulePatterns.english,
    ...config.schedulePatterns.bengali
  ];
  
  for (const pattern of allPatterns) {
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      const referencePosition = match.index;
      const contentAfterReference = content.substring(referencePosition + match[0].length);
      
      // Check if there's substantial content after the reference
      if (contentAfterReference.trim().length < config.scheduleContentThreshold) {
        issues.push({
          type: 'missing_schedule',
          scheduleType: match[0],
          position: referencePosition,
          description: `Schedule "${match[0]}" referenced but content appears missing (only ${contentAfterReference.trim().length} chars after reference)`
        });
      }
    }
  }
  
  return deduplicateIssues(issues);
}

/**
 * Detect encoding errors in content
 * Requirements: 2.1-2.5
 */
function detectEncodingErrors(content, config) {
  const issues = [];
  
  for (const errorDef of config.encodingErrors) {
    errorDef.pattern.lastIndex = 0;
    let match;
    
    while ((match = errorDef.pattern.exec(content)) !== null) {
      const contextStart = Math.max(0, match.index - 20);
      const contextEnd = Math.min(content.length, match.index + match[0].length + 20);
      
      issues.push({
        type: 'encoding_error',
        character: match[0],
        position: match.index,
        context: content.substring(contextStart, contextEnd),
        description: `${errorDef.description}: "${match[0]}" at position ${match.index}`
      });
    }
  }
  
  return issues;
}

/**
 * Detect OCR artifacts in content
 * Requirements: 3.1-3.5
 */
function detectOcrArtifacts(content, config) {
  const issues = [];
  
  for (const correction of config.ocrCorrections) {
    const pattern = new RegExp(escapeRegex(correction.incorrect), 'g');
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      issues.push({
        type: 'ocr_artifact',
        incorrect: correction.incorrect,
        correct: correction.correct,
        position: match.index,
        context: correction.context,
        description: `OCR artifact: "${correction.incorrect}" should be "${correction.correct}" (${correction.context})`
      });
    }
  }
  
  return issues;
}

/**
 * Determine overall completeness based on detected issues
 */
function determineCompleteness(flags, issues) {
  if (flags.size === 0) {
    return 'complete';
  }
  
  if (flags.has('missing_schedule')) {
    return 'partial';
  }
  
  // Encoding errors and OCR artifacts don't affect completeness, just quality
  return 'complete';
}
```

### 3. Text Cleaner Module

```javascript
/**
 * Clean content by applying configured rules
 * Requirements: 4.1-4.5, 5.1-5.5, 6.1-6.5
 * 
 * @param {string} content - Original content
 * @param {Object} options - Cleaning options
 * @returns {Object} Cleaning result with original and cleaned content
 */
function cleanContent(content, options = {}) {
  const {
    applyEncodingRepairs = true,
    applyOcrCorrections = true,
    applyFormatting = true,
    dryRun = false,
    config = QUALITY_CONFIG
  } = options;
  
  // Preserve original
  const original = content;
  let cleaned = content;
  const transformations = [];
  
  // Apply encoding repairs
  if (applyEncodingRepairs) {
    const result = applyEncodingRepairRules(cleaned, config, dryRun);
    cleaned = result.content;
    transformations.push(...result.transformations);
  }
  
  // Apply OCR corrections
  if (applyOcrCorrections) {
    const result = applyOcrCorrectionRules(cleaned, config, dryRun);
    cleaned = result.content;
    transformations.push(...result.transformations);
  }
  
  // Apply formatting improvements
  if (applyFormatting) {
    const result = applyFormattingRules(cleaned, config, dryRun);
    cleaned = result.content;
    transformations.push(...result.transformations);
  }
  
  return {
    original,
    cleaned: dryRun ? original : cleaned,
    transformations,
    flags: transformations.length > 0 ? ['cleaning_applied'] : []
  };
}

/**
 * Apply encoding repair rules
 * Requirements: 4.1-4.5
 */
function applyEncodingRepairRules(content, config, dryRun) {
  let result = content;
  const transformations = [];
  
  for (const rule of config.encodingErrors) {
    rule.pattern.lastIndex = 0;
    const matches = content.match(rule.pattern);
    
    if (matches && matches.length > 0) {
      if (!dryRun) {
        result = result.replace(rule.pattern, rule.replacement);
      }
      
      transformations.push({
        type: 'encoding_repair',
        rule: rule.description,
        count: matches.length,
        replacement: rule.replacement
      });
    }
  }
  
  return { content: result, transformations };
}

/**
 * Apply OCR correction rules
 * Requirements: 5.1-5.5
 */
function applyOcrCorrectionRules(content, config, dryRun) {
  let result = content;
  const transformations = [];
  
  for (const correction of config.ocrCorrections) {
    const pattern = new RegExp(escapeRegex(correction.incorrect), 'g');
    const matches = content.match(pattern);
    
    if (matches && matches.length > 0) {
      if (!dryRun) {
        result = result.replace(pattern, correction.correct);
      }
      
      transformations.push({
        type: 'ocr_correction',
        incorrect: correction.incorrect,
        correct: correction.correct,
        count: matches.length,
        context: correction.context
      });
    }
  }
  
  return { content: result, transformations };
}

/**
 * Apply formatting improvement rules
 * Requirements: 6.1-6.5
 */
function applyFormattingRules(content, config, dryRun) {
  let result = content;
  const transformations = [];
  
  // Bengali list separation
  if (config.formattingRules.bengaliListSeparation.enabled) {
    const rule = config.formattingRules.bengaliListSeparation;
    const matches = content.match(rule.pattern);
    
    if (matches && matches.length > 0) {
      if (!dryRun) {
        result = result.replace(rule.pattern, rule.replacement);
      }
      
      transformations.push({
        type: 'formatting',
        rule: 'bengali_list_separation',
        count: matches.length
      });
    }
  }
  
  // English list separation
  if (config.formattingRules.englishListSeparation.enabled) {
    const rule = config.formattingRules.englishListSeparation;
    const matches = content.match(rule.pattern);
    
    if (matches && matches.length > 0) {
      if (!dryRun) {
        result = result.replace(rule.pattern, rule.replacement);
      }
      
      transformations.push({
        type: 'formatting',
        rule: 'english_list_separation',
        count: matches.length
      });
    }
  }
  
  return { content: result, transformations };
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### 4. Data Quality Schema

```javascript
/**
 * Data quality assessment schema
 * Requirements: 7.1-7.5
 */
const DATA_QUALITY_SCHEMA = {
  completeness: {
    type: 'string',
    enum: ['complete', 'partial', 'uncertain'],
    description: 'Overall completeness assessment'
  },
  flags: {
    type: 'array',
    items: {
      type: 'string',
      enum: [
        'missing_schedule',
        'encoding_error',
        'ocr_artifact',
        'formatting_density',
        'cleaning_applied'
      ]
    },
    description: 'Detected issue types'
  },
  issues: {
    type: 'array',
    items: { type: 'string' },
    description: 'Human-readable issue descriptions'
  }
};

/**
 * Create empty quality assessment
 */
function createEmptyAssessment() {
  return {
    completeness: 'complete',
    flags: [],
    issues: []
  };
}
```

## Data Models

### Quality Assessment Result

```typescript
interface QualityAssessment {
  completeness: 'complete' | 'partial' | 'uncertain';
  flags: QualityFlag[];
  issues: string[];
}

type QualityFlag = 
  | 'missing_schedule'
  | 'encoding_error'
  | 'ocr_artifact'
  | 'formatting_density'
  | 'cleaning_applied';
```

### Cleaning Result

```typescript
interface CleaningResult {
  original: string;           // Preserved original content
  cleaned: string;            // Cleaned content (or original if dryRun)
  transformations: Transformation[];
  flags: string[];
}

interface Transformation {
  type: 'encoding_repair' | 'ocr_correction' | 'formatting';
  rule: string;
  count: number;
  replacement?: string;
  incorrect?: string;
  correct?: string;
  context?: string;
}
```

### Updated Act Export Schema

```json
{
  "identifiers": { ... },
  "act_number": "754",
  "title": "Finance Act, 1991",
  "content": "...",
  "url": "...",
  "volume_number": "28",
  "marker_frequency": { ... },
  "cross_references": { ... },
  "data_quality": {
    "completeness": "partial",
    "flags": ["missing_schedule", "encoding_error"],
    "issues": [
      "Schedule \"First Schedule\" referenced but content appears missing",
      "Corrupted quotation mark: \"æ\" at position 1234"
    ]
  },
  "_metadata": { ... }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Schedule Reference Detection

*For any* text containing schedule reference patterns (English: "First Schedule", "Appendix"; Bengali: "তফসিল", "প্রথম তফসিল"), the Quality_Validator SHALL detect and return all references with their positions.

**Validates: Requirements 1.1, 1.5**

### Property 2: Missing Schedule Flagging

*For any* text where a schedule is referenced but content after the reference is less than 500 characters, the Quality_Validator SHALL flag as "missing_schedule" and record the schedule type and position.

**Validates: Requirements 1.3, 1.4**

### Property 3: Encoding Error Detection

*For any* text containing encoding error characters (æ, ì, í, î, ï), the Quality_Validator SHALL detect all occurrences and return them with character, position, and context.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 4: OCR Artifact Detection

*For any* text containing known OCR artifacts from the configured dictionary, the Quality_Validator SHALL detect all occurrences and return them with incorrect text, correct text, and position.

**Validates: Requirements 3.1, 3.3, 3.4**

### Property 5: Encoding Repair Application

*For any* text with encoding errors, when the Text_Cleaner applies repairs, the cleaned content SHALL have all æ replaced with " and all ì/í/î/ï replaced with newlines, while the original content remains unchanged.

**Validates: Requirements 4.1, 4.2, 4.4**

### Property 6: OCR Correction Application

*For any* text with OCR artifacts, when the Text_Cleaner applies corrections, the cleaned content SHALL have all known typos replaced with correct text, and the transformation count SHALL equal the number of replacements made.

**Validates: Requirements 5.1, 5.5**

### Property 7: Formatting Rule Application

*For any* text with list markers following semicolons or dandas, when formatting rules are enabled, the Text_Cleaner SHALL insert line breaks before the markers without changing any other content.

**Validates: Requirements 6.1, 6.2, 6.4**

### Property 8: Data Quality Schema Completeness

*For any* exported act, the data_quality object SHALL contain completeness (one of "complete", "partial", "uncertain"), flags (array of valid flag strings), and issues (array of strings).

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 9: Configuration Rule Control

*For any* cleaning operation, when a rule category is disabled in configuration, the Text_Cleaner SHALL NOT apply transformations from that category, and the cleaned content SHALL be identical to input for that category.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 10: Content Preservation

*For any* quality assessment or cleaning operation, the original content field SHALL remain byte-identical before and after the operation, regardless of what transformations are applied.

**Validates: Requirements 9.1, 9.4, 9.5**

## Error Handling

| Error Condition | Handling |
|-----------------|----------|
| Empty/null content | Return empty assessment with completeness "complete" |
| Invalid config | Use default QUALITY_CONFIG |
| Regex execution error | Skip pattern, log error, continue processing |
| Invalid Unicode in content | Preserve as-is, flag as potential encoding issue |
| Transformation failure | Log error, preserve original content |

## Testing Strategy

### Unit Tests
- Test each detection function with known problematic content
- Test cleaning functions with specific error patterns
- Test configuration enable/disable behavior
- Test edge cases: empty content, very long content, mixed languages

### Property-Based Tests
- Generate random text with embedded schedule references
- Generate text with encoding errors and verify detection
- Verify content preservation across all operations
- Test schema compliance for all outputs

### Integration Tests
- Process actual extracted acts with known issues
- Verify end-to-end pipeline from extraction to export
- Test batch processing with multiple files

### Test Configuration
- Minimum 100 iterations per property test
- Use fast-check for JavaScript property testing
- Tag format: **Feature: data-quality-remediation, Property {N}: {title}**
