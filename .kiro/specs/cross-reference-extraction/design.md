# Design Document: Cross-Reference Extraction

## Overview

This design extends the BDLawCorpus extension to detect and extract cross-references between legal acts. Legal acts in Bangladesh frequently reference other acts through amendments, repeals, incorporations, and general mentions. Capturing these relationships enables corpus-level analysis of the legal citation network.

The design maintains methodological purity by:
- Pattern-based detection (not semantic interpretation)
- Explicit methodology documentation
- No resolution to internal IDs (Phase 2 work)
- No validation of referenced acts

## Architecture

The cross-reference extraction integrates into the existing extraction pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│                    Content Extraction Flow                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ DOM         │  │ Content     │  │ Cross-Reference     │  │
│  │ Extraction  │──▶│ Processing  │──▶│ Detection           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                              │               │
│                                              ▼               │
│                                    ┌─────────────────────┐  │
│                                    │ Reference           │  │
│                                    │ Classification      │  │
│                                    └─────────────────────┘  │
│                                              │               │
│                                              ▼               │
│                                    ┌─────────────────────┐  │
│                                    │ Export with         │  │
│                                    │ Cross-References    │  │
│                                    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Citation Pattern Definitions

```javascript
// Cross-reference detection patterns
const CITATION_PATTERNS = {
  // English patterns
  ENGLISH_ACT_FULL: /([A-Z][a-zA-Z\s]+(?:Act|Ordinance)),?\s*(\d{4})\s*\(([IVXLCDM]+|\d+)\s+of\s+(\d{4})\)/g,
  ENGLISH_ACT_SHORT: /(?:Act|Ordinance)\s+([IVXLCDM]+|\d+)\s+of\s+(\d{4})/g,
  ENGLISH_SECTION_REF: /section\s+(\d+[A-Z]?(?:\s*\(\d+\))?)/gi,
  
  // Bengali patterns
  BENGALI_ACT_FULL: /([^\s,]+\s+আইন),?\s*([\u09E6-\u09EF]{4})\s*\(([\u09E6-\u09EF]{4})\s*সনের\s*([\u09E6-\u09EF]+)\s*নং\s*আইন\)/g,
  BENGALI_ACT_SHORT: /([\u09E6-\u09EF]{4})\s*সনের\s*([\u09E6-\u09EF]+)\s*নং\s*(আইন|অধ্যাদেশ)/g,
  BENGALI_ORDINANCE: /([^\s,]+\s+অধ্যাদেশ),?\s*([\u09E6-\u09EF]{4})\s*\(অধ্যাদেশ\s*নং\s*([\u09E6-\u09EF]+),?\s*([\u09E6-\u09EF]{4})\)/g,
  
  // P.O. (President's Order) pattern
  PRESIDENTS_ORDER: /P\.?O\.?\s*(?:No\.?)?\s*(\d+)\s+of\s+(\d{4})/gi
};

// Reference type classification keywords
const REFERENCE_TYPE_KEYWORDS = {
  amendment: ['সংশোধন', 'সংশোধিত', 'amendment', 'amended', 'amending'],
  repeal: ['রহিত', 'রহিতকরণ', 'বিলুপ্ত', 'repeal', 'repealed', 'repealing'],
  substitution: ['প্রতিস্থাপিত', 'প্রতিস্থাপন', 'substituted', 'substitution', 'replaced'],
  dependency: ['সাপেক্ষে', 'অধীন', 'অনুসারে', 'subject to', 'under', 'pursuant to'],
  incorporation: ['সন্নিবেশিত', 'অন্তর্ভুক্ত', 'inserted', 'incorporated', 'added']
};
```

### 2. Cross-Reference Detector Module

```javascript
/**
 * Detect cross-references in legal text
 * Requirements: 1.1-1.5, 2.1-2.5
 * 
 * @param {string} text - The legal text content
 * @returns {Array<CrossReference>} Detected cross-references
 */
function detectCrossReferences(text) {
  if (!text || typeof text !== 'string') return [];
  
  const references = [];
  const lines = text.split('\n');
  let charOffset = 0;
  
  lines.forEach((line, lineIndex) => {
    // Check each pattern type
    for (const [patternName, pattern] of Object.entries(CITATION_PATTERNS)) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      let match;
      
      while ((match = pattern.exec(line)) !== null) {
        const citation = {
          citation_text: match[0],
          pattern_type: patternName,
          line_number: lineIndex + 1,
          position: charOffset + match.index,
          // Extract components based on pattern type
          ...extractCitationComponents(patternName, match)
        };
        
        // Add context
        citation.context_before = extractContextBefore(text, charOffset + match.index, 50);
        citation.context_after = extractContextAfter(text, charOffset + match.index + match[0].length, 50);
        
        // Classify reference type
        citation.reference_type = classifyReferenceType(
          citation.context_before + ' ' + citation.citation_text + ' ' + citation.context_after
        );
        
        references.push(citation);
      }
    }
    
    charOffset += line.length + 1; // +1 for newline
  });
  
  // Deduplicate overlapping matches
  return deduplicateReferences(references);
}

/**
 * Extract citation components based on pattern type
 */
function extractCitationComponents(patternName, match) {
  switch (patternName) {
    case 'ENGLISH_ACT_FULL':
      return {
        act_name: match[1]?.trim(),
        citation_year: match[2] || match[4],
        citation_serial: match[3],
        script: 'english'
      };
    case 'ENGLISH_ACT_SHORT':
      return {
        citation_serial: match[1],
        citation_year: match[2],
        script: 'english'
      };
    case 'BENGALI_ACT_FULL':
      return {
        act_name: match[1]?.trim(),
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
    default:
      return { script: 'unknown' };
  }
}
```

### 3. Reference Type Classifier

```javascript
/**
 * Classify the type of reference based on surrounding context
 * Requirements: 3.1-3.5
 * 
 * @param {string} contextText - Text surrounding the citation
 * @returns {string} Reference type classification
 */
function classifyReferenceType(contextText) {
  if (!contextText) return 'mention';
  
  const lowerContext = contextText.toLowerCase();
  
  // Check each reference type in priority order
  for (const [refType, keywords] of Object.entries(REFERENCE_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (contextText.includes(keyword) || lowerContext.includes(keyword.toLowerCase())) {
        return refType;
      }
    }
  }
  
  return 'mention'; // Default type
}
```

### 4. Context Extraction

```javascript
/**
 * Extract context before a citation
 * Requirements: 4.1, 4.3
 */
function extractContextBefore(text, position, length) {
  const start = Math.max(0, position - length);
  return text.substring(start, position).trim();
}

/**
 * Extract context after a citation
 * Requirements: 4.2, 4.3
 */
function extractContextAfter(text, position, length) {
  const end = Math.min(text.length, position + length);
  return text.substring(position, end).trim();
}
```

### 5. Deduplication Logic

```javascript
/**
 * Remove duplicate/overlapping references
 * Keeps the most specific match when patterns overlap
 */
function deduplicateReferences(references) {
  // Sort by position, then by specificity (longer matches first)
  const sorted = references.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return b.citation_text.length - a.citation_text.length;
  });
  
  const deduplicated = [];
  let lastEnd = -1;
  
  for (const ref of sorted) {
    const refEnd = ref.position + ref.citation_text.length;
    
    // Skip if this reference overlaps with the previous one
    if (ref.position < lastEnd) continue;
    
    deduplicated.push(ref);
    lastEnd = refEnd;
  }
  
  return deduplicated;
}
```

## Data Models

### Cross-Reference Schema

```typescript
interface CrossReference {
  citation_text: string;        // Original citation text as found
  pattern_type: string;         // Which pattern matched
  act_name?: string;            // Name of referenced act (if detected)
  citation_year: string;        // Year component (original script)
  citation_serial: string;      // Serial number (Roman or Arabic)
  script: 'english' | 'bengali' | 'mixed';
  reference_type: 'amendment' | 'repeal' | 'substitution' | 'dependency' | 'incorporation' | 'mention';
  line_number: number;          // 1-indexed line number
  position: number;             // Character position in full text
  context_before: string;       // 50 chars before citation
  context_after: string;        // 50 chars after citation
}
```

### Updated Act Export Schema

```json
{
  "identifiers": {
    "internal_id": "754",
    "note": "internal_id is the bdlaws database identifier, not the legal citation number"
  },
  "act_number": "754",
  "title": "অর্থ আইন, ১৯৯১",
  "content": "...",
  "url": "http://bdlaws.minlaw.gov.bd/act-details-754.html",
  "volume_number": "28",
  "marker_frequency": { ... },
  "cross_references": {
    "count": 8,
    "method": "pattern-based detection, not semantically verified",
    "references": [
      {
        "citation_text": "Income Tax Ordinance, 1984 (XXXVI of 1984)",
        "pattern_type": "ENGLISH_ACT_FULL",
        "act_name": "Income Tax Ordinance",
        "citation_year": "1984",
        "citation_serial": "XXXVI",
        "script": "english",
        "reference_type": "amendment",
        "line_number": 45,
        "position": 2341,
        "context_before": "...এর section 2 তে,-",
        "context_after": "এর- (১) section 2 তে..."
      }
    ]
  },
  "_metadata": { ... }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*



### Property 1: English Citation Pattern Detection

*For any* text containing a valid English citation pattern (Act/Ordinance [Roman/Arabic] of [Year]), the detector SHALL find and return that citation with correct year and serial components extracted.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Bengali Citation Pattern Detection

*For any* text containing a valid Bengali citation pattern ([Year] সনের [Number] নং আইন/অধ্যাদেশ), the detector SHALL find and return that citation with year and serial preserved in original Bengali script.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 3: Position Accuracy Round-Trip

*For any* detected citation, using the reported position and citation_text length to extract a substring from the original text SHALL return the exact citation_text.

**Validates: Requirements 1.5, 4.4**

### Property 4: Reference Type Classification

*For any* citation with a classification keyword (amendment/repeal/substitution/dependency) within 50 characters, the reference_type SHALL match the keyword category. Citations without keywords SHALL have type "mention".

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 5: Context Extraction Bounds

*For any* detected citation, context_before SHALL be a substring of the original text ending at the citation position, and context_after SHALL be a substring starting after the citation. Neither context SHALL exceed 50 characters.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Export Schema Completeness

*For any* exported act with cross-references, each reference object SHALL contain all required fields (citation_text, citation_year, citation_serial, reference_type, line_number, position, context_before, context_after), and cross_reference_count SHALL equal the references array length.

**Validates: Requirements 5.1, 5.3, 5.4**

### Property 7: Content Preservation

*For any* act processed for cross-references, the content field SHALL be byte-identical before and after cross-reference extraction. Cross-reference detection SHALL NOT modify the source content.

**Validates: Requirements 6.1**

### Property 8: No Internal ID Resolution

*For any* detected cross-reference, the reference object SHALL NOT contain an internal_id field or any field attempting to resolve the citation to a corpus entry.

**Validates: Requirements 6.3, 6.4**

## Error Handling

| Error Condition | Handling |
|-----------------|----------|
| Empty/null text input | Return empty references array |
| Malformed regex match | Skip match, continue processing |
| Position out of bounds | Clamp to document boundaries |
| Invalid Unicode in Bengali | Preserve as-is, mark script as "unknown" |
| Overlapping pattern matches | Keep most specific (longest) match |

## Testing Strategy

### Unit Tests
- Test each citation pattern with known examples from Act 754
- Test edge cases: citations at document start/end
- Test classification keywords in various positions
- Test mixed English/Bengali citations

### Property-Based Tests
- Generate random text with embedded citation patterns
- Verify detection completeness and accuracy
- Test position round-trip property
- Test context extraction bounds

### Integration Tests
- Process actual extracted acts (734, 754)
- Verify cross-references match manual inspection
- Test export schema compliance

### Test Configuration
- Minimum 100 iterations per property test
- Use fast-check for JavaScript property testing
- Tag format: **Feature: cross-reference-extraction, Property {N}: {title}**


## Corpus Management Components

### 6. Corpus Manifest Manager

```javascript
/**
 * Corpus manifest structure for tracking all extracted acts
 * Requirements: 8.1-8.5
 */
const MANIFEST_SCHEMA = {
  version: "2.0",
  created_at: "ISO8601 timestamp",
  updated_at: "ISO8601 timestamp",
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
  acts: {
    // Keyed by internal_id
    "754": {
      internal_id: "754",
      title: "অর্থ আইন, ১৯৯১",
      volume_number: "28",
      capture_timestamp: "ISO8601",
      file_path: "bdlaw_act_754_2025-12-28T08-15-00.json",
      content_hash: "sha256:abc123...",
      cross_reference_count: 8,
      extraction_version: "1.2.0"
    }
  },
  volumes: {
    // Keyed by volume_number
    "28": {
      volume_number: "28",
      capture_timestamp: "ISO8601",
      file_path: "bdlaw_volume_28_2025-12-28T08-14-45.json",
      total_acts: 21,
      extracted_acts: 5
    }
  }
};

/**
 * Generate or update corpus manifest
 * Requirements: 8.1, 8.2, 8.3
 */
function updateCorpusManifest(manifest, newAct) {
  const now = new Date().toISOString();
  
  // Update or add act entry
  manifest.acts[newAct.internal_id] = {
    internal_id: newAct.internal_id,
    title: newAct.title,
    volume_number: newAct.volume_number,
    capture_timestamp: newAct.capturedAt,
    file_path: newAct.file_path,
    content_hash: computeContentHash(newAct.content),
    cross_reference_count: newAct.cross_references?.count || 0,
    extraction_version: EXTENSION_VERSION
  };
  
  // Update stats
  manifest.corpus_stats.total_acts = Object.keys(manifest.acts).length;
  manifest.corpus_stats.total_volumes = Object.keys(manifest.volumes).length;
  manifest.corpus_stats.total_characters = Object.values(manifest.acts)
    .reduce((sum, act) => sum + (act.content?.length || 0), 0);
  manifest.updated_at = now;
  
  // Update cross-reference coverage
  updateCrossReferenceCoverage(manifest);
  
  return manifest;
}

/**
 * Compute SHA-256 hash of content
 * Requirements: 10.2
 */
async function computeContentHash(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 7. Deduplication Manager

```javascript
/**
 * Check if act already exists in corpus
 * Requirements: 7.1, 7.4
 */
function isDuplicateAct(manifest, internalId) {
  const existing = manifest.acts[internalId];
  if (existing) {
    return {
      isDuplicate: true,
      existingEntry: existing,
      message: `Act ${internalId} already captured on ${existing.capture_timestamp}`
    };
  }
  return { isDuplicate: false };
}

/**
 * Check if volume already captured
 * Requirements: 7.2
 */
function isDuplicateVolume(manifest, volumeNumber) {
  const existing = manifest.volumes[volumeNumber];
  if (existing) {
    return {
      isDuplicate: true,
      existingEntry: existing,
      message: `Volume ${volumeNumber} already captured on ${existing.capture_timestamp}`
    };
  }
  return { isDuplicate: false };
}

/**
 * Force re-extraction with version tracking
 * Requirements: 7.5
 */
function forceReExtraction(manifest, internalId, newAct) {
  const existing = manifest.acts[internalId];
  
  // Archive previous version
  if (!manifest.version_history) manifest.version_history = {};
  if (!manifest.version_history[internalId]) manifest.version_history[internalId] = [];
  
  manifest.version_history[internalId].push({
    ...existing,
    archived_at: new Date().toISOString(),
    reason: 'force_re_extraction'
  });
  
  // Update with new extraction
  return updateCorpusManifest(manifest, newAct);
}
```

### 8. Research Standards Generator

```javascript
/**
 * Generate CITATION.cff for academic citation
 * Requirements: 9.2
 */
function generateCitationCff(manifest) {
  return `cff-version: 1.2.0
message: "If you use this dataset, please cite it as below."
type: dataset
title: "BDLawCorpus: Bangladeshi Legal Text Corpus"
version: "${manifest.version}"
date-released: "${manifest.updated_at.split('T')[0]}"
url: "http://bdlaws.minlaw.gov.bd"
repository: "https://github.com/[your-repo]/bdlawcorpus"
abstract: >-
  A research-grade corpus of Bangladeshi legal texts extracted from 
  bdlaws.minlaw.gov.bd using the BDLawCorpus Chrome extension.
  Contains ${manifest.corpus_stats.total_acts} acts from 
  ${manifest.corpus_stats.total_volumes} volumes.
keywords:
  - legal corpus
  - Bangladesh law
  - legal NLP
  - legislative text
license: "CC-BY-4.0"
authors:
  - name: "[Your Name]"
    affiliation: "[Your Institution]"
`;
}

/**
 * Generate corpus README with methodology
 * Requirements: 9.1, 9.3, 9.4
 */
function generateCorpusReadme(manifest) {
  return `# BDLawCorpus Dataset

## Overview
This corpus contains ${manifest.corpus_stats.total_acts} Bangladeshi legal acts 
extracted from the official bdlaws.minlaw.gov.bd website.

## Methodology
- **Extraction Tool**: BDLawCorpus Chrome Extension v${EXTENSION_VERSION}
- **Extraction Method**: Manual page-level extraction (human-in-the-loop)
- **Schema Version**: ${manifest.version}
- **Extraction Period**: ${manifest.corpus_stats.extraction_date_range.earliest} to ${manifest.corpus_stats.extraction_date_range.latest}

## Provenance Chain
1. Source: bdlaws.minlaw.gov.bd (official Ministry of Law website)
2. Extraction: BDLawCorpus extension with hardcoded legal selectors
3. Processing: No modification, restructuring, or interpretation
4. Export: Individual JSON files with full metadata

## Known Limitations
1. **Missing Schedules**: Some acts reference তফসিল (schedules) not present in HTML
2. **OCR Errors**: Source contains digitization errors (e.g., "প্রম্্নফ" should be "প্রুফ")
3. **Encoding Issues**: Some English text has phantom characters (e.g., "æ")
4. **Incomplete Coverage**: Not all acts from all volumes are extracted

## Schema Documentation
See \`DATA_DICTIONARY.md\` for field definitions.

## Citation
See \`CITATION.cff\` for citation information.

## License
This dataset is provided for academic research purposes only.
`;
}

/**
 * Generate data dictionary
 * Requirements: 9.5
 */
function generateDataDictionary() {
  return `# BDLawCorpus Data Dictionary

## Act Export Schema (v2.0)

| Field | Type | Description |
|-------|------|-------------|
| identifiers.internal_id | string | bdlaws database ID from URL |
| identifiers.note | string | Clarification that this is NOT legal citation |
| act_number | string | DEPRECATED: Use identifiers.internal_id |
| title | string | Act title in Bengali |
| content | string | Full legal text, noise-filtered |
| url | string | Source URL for provenance |
| volume_number | string | Volume containing this act |
| marker_frequency.*.count | integer | Raw string occurrence count |
| marker_frequency.*.method | string | Counting methodology documentation |
| cross_references.count | integer | Number of detected citations |
| cross_references.method | string | Detection methodology |
| cross_references.references | array | Detected citation objects |
| _metadata.source | string | Source domain |
| _metadata.source_url | string | Full source URL |
| _metadata.scraped_at | string | ISO8601 extraction timestamp |
| _metadata.extracted_at | string | ISO8601 processing timestamp |
| _metadata.scraping_method | string | Extraction methodology |
| _metadata.tool | string | Tool name and version |
| _metadata.language | string | Content language code |
| _metadata.research_purpose | string | Intended use documentation |
| _metadata.disclaimer | string | Legal/ethical disclaimer |

## Cross-Reference Schema

| Field | Type | Description |
|-------|------|-------------|
| citation_text | string | Original citation as found |
| pattern_type | string | Which regex pattern matched |
| act_name | string | Name of referenced act (if detected) |
| citation_year | string | Year component (original script) |
| citation_serial | string | Serial number (Roman or Arabic) |
| script | string | 'english', 'bengali', or 'mixed' |
| reference_type | string | Classification: amendment/repeal/substitution/dependency/mention |
| line_number | integer | 1-indexed line number |
| position | integer | Character position in content |
| context_before | string | Up to 50 chars before citation |
| context_after | string | Up to 50 chars after citation |
`;
}
```

### 9. Idempotency Checker

```javascript
/**
 * Check if extraction is idempotent
 * Requirements: 10.1, 10.3
 */
async function checkExtractionIdempotency(manifest, internalId, newContent) {
  const existing = manifest.acts[internalId];
  if (!existing) return { isNew: true };
  
  const newHash = await computeContentHash(newContent);
  
  if (existing.content_hash === newHash) {
    return {
      isNew: false,
      isIdentical: true,
      message: 'Content unchanged from previous extraction'
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

/**
 * Log extraction operation for audit trail
 * Requirements: 10.5
 */
function logExtractionOperation(operation) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation: operation.type, // 'extract', 'export', 'update'
    internal_id: operation.internal_id,
    volume_number: operation.volume_number,
    result: operation.result, // 'success', 'duplicate', 'error'
    details: operation.details
  };
  
  // Append to extraction log
  const log = JSON.parse(localStorage.getItem('bdlaw_extraction_log') || '[]');
  log.push(logEntry);
  localStorage.setItem('bdlaw_extraction_log', JSON.stringify(log));
  
  return logEntry;
}
```

### 10. Language Detection and Language-Aware Deduplication

```javascript
/**
 * Bengali Unicode range for language detection
 * Bengali characters: U+0980 to U+09FF
 */
const BENGALI_UNICODE_RANGE = /[\u0980-\u09FF]/;

/**
 * Detect the primary language of content
 * Requirements: 11.1 - Detect content language (Bengali or English)
 * 
 * @param {string} content - The act content to analyze
 * @returns {string} 'bengali' if content contains Bengali characters, 'english' otherwise
 */
function detectContentLanguage(content) {
  if (!content || typeof content !== 'string') {
    return 'english'; // Default to English for empty/invalid content
  }
  
  // Check if content contains Bengali Unicode characters
  if (BENGALI_UNICODE_RANGE.test(content)) {
    return 'bengali';
  }
  
  return 'english';
}

/**
 * Check for language-aware duplicate with Bengali preference
 * Requirements: 11.2, 11.3, 11.4, 11.5, 11.7 - Language-aware deduplication
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
function checkLanguageAwareDuplicate(manifest, internalId, newContentLanguage) {
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
}

/**
 * Update manifest with language information
 * Requirements: 11.6 - Record content_language in manifest
 * 
 * @param {Object} manifest - The corpus manifest
 * @param {Object} newAct - The new act to add
 * @param {string} contentLanguage - The detected content language
 * @returns {Object} Updated manifest
 */
function updateCorpusManifestWithLanguage(manifest, newAct, contentLanguage) {
  // Use existing updateCorpusManifest and add language field
  const updatedManifest = updateCorpusManifest(manifest, newAct);
  
  // Add content_language to the act entry
  if (updatedManifest.acts[newAct.internal_id]) {
    updatedManifest.acts[newAct.internal_id].content_language = contentLanguage;
  }
  
  return updatedManifest;
}
```

### Updated Manifest Schema with Language

```javascript
/**
 * Updated manifest act entry with content_language field
 * Requirements: 11.6
 */
const MANIFEST_ACT_ENTRY = {
  internal_id: "754",
  title: "অর্থ আইন, ১৯৯১",
  volume_number: "28",
  capture_timestamp: "ISO8601",
  file_path: "bdlaw_act_754_2025-12-28T08-15-00.json",
  content_hash: "sha256:abc123...",
  content_language: "bengali",  // NEW: 'bengali' or 'english'
  cross_reference_count: 8,
  extraction_version: "1.2.0"
};
```

## Additional Correctness Properties

### Property 9: Deduplication Enforcement

*For any* act with internal_id already in the corpus manifest, attempting to add it again without force flag SHALL return isDuplicate: true and NOT modify the manifest.

**Validates: Requirements 7.1, 7.4**

### Property 10: Content Hash Consistency

*For any* act content, computing the content hash twice SHALL produce identical results. The hash SHALL be deterministic based solely on content bytes.

**Validates: Requirements 10.1, 10.2**

### Property 11: Manifest Statistics Accuracy

*For any* corpus manifest, total_acts SHALL equal the count of keys in manifest.acts, and total_volumes SHALL equal the count of keys in manifest.volumes.

**Validates: Requirements 8.3**

### Property 12: Cross-Reference Coverage Tracking

*For any* corpus with cross-references, referenced_acts_in_corpus SHALL contain only internal_ids that exist in manifest.acts, and referenced_acts_missing SHALL contain only internal_ids NOT in manifest.acts.

**Validates: Requirements 8.4**

### Property 13: Idempotent Extraction

*For any* act extracted twice from the same source URL without source changes, the content field (excluding _metadata timestamps) SHALL be byte-identical.

**Validates: Requirements 10.1**

### Property 14: Language Detection Accuracy

*For any* act content, the language detector SHALL correctly identify Bengali content (containing Bengali Unicode characters [\u0980-\u09FF]) as "bengali" and content without Bengali characters as "english".

**Validates: Requirements 11.1**

### Property 15: Language-Aware Deduplication - Bengali Preference

*For any* act that exists in the corpus in English, attempting to extract the Bengali version SHALL succeed and replace the English version. The manifest SHALL be updated with the Bengali version.

**Validates: Requirements 11.5**

### Property 16: Language-Aware Deduplication - English Blocked

*For any* act that exists in the corpus in Bengali, attempting to extract the English version SHALL be blocked and return a warning indicating Bengali version exists.

**Validates: Requirements 11.4**

### Property 17: Language Recording in Manifest

*For any* extracted act, the manifest entry SHALL include a content_language field with value "bengali" or "english".

**Validates: Requirements 11.6**
