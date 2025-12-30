# Design Document: Legal Structure Derivation & Reference Anchoring

## Overview

This design specifies a DOM-first structural derivation system for the BDLawCorpus that extracts legal structure directly from DOM nodes at extraction time, while keeping `content_raw` strictly immutable. The DOM is the source of truth for structure; `content_raw` is the immutable legal anchor.

## Key Principle

> **DOM is the source of truth for structure; `content_raw` is the immutable legal anchor.**

Structure and references are derived directly from DOM elements (which already contain structural information like section rows, headings, and hyperlinks) rather than re-parsing flat text. This approach is more accurate and leverages the existing DOM structure.

## Architecture

The system consists of three main components:

1. **DOM Structure Extractor**: Extracts legal structure elements directly from DOM nodes at extraction time (preamble, enactment clause, sections, subsections, clauses)
2. **DOM Reference Extractor**: Detects statutory citations from DOM context (act names, act numbers, hyperlinks) and anchors them to structural scope
3. **Offset Calculator**: Maps DOM-extracted elements to character offsets in `content_raw` for traceability

```
┌─────────────────────────────────────────────────────────────────┐
│                    Live DOM (Source of Truth)                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ .boxed-layout > .lineremoves (section rows)             │    │
│  │ .txt-head (section headings)                            │    │
│  │ .txt-details (section content)                          │    │
│  │ <a href="..."> (statutory links)                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────────────────────────────────┐ ┌─────────────────────────────────────────────────┐
│   DOM Structure Extractor                        │ │   DOM Reference Extractor                        │
│  ┌──────────────────────────────────────────┐   │ │  ┌──────────────────────────────────────────┐   │
│  │ Preamble (.lineremove, .bg-act-section)  │   │ │  │ Citation Links (<a href="act-details">)  │   │
│  │ Enactment (.lineremove with সেহেতু)       │   │ │  │ Act Name Patterns in textContent         │   │
│  │ Sections (.lineremoves rows)              │   │ │  │ Act Number Patterns (১৯৯০ সনের ২০ নং)    │   │
│  │ Headings (.txt-head column)               │   │ │  └──────────────────────────────────────────┘   │
│  │ Content (.txt-details column)             │   │ └─────────────────────────────────────────────────┘
│  │ Subsections ((১), (২) in content)         │   │                   │
│  │ Clauses ((ক), (খ) in content)             │   │                   │
│  └──────────────────────────────────────────┘   │                   │
└─────────────────────────────────────────────────┘                   │
          │                                                           │
          └───────────────────┬───────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Offset Calculator                            │
│  Maps DOM elements to character offsets in content_raw           │
│  (for traceability and regeneration)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Extraction Result (Output)                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ content_raw (UNCHANGED - textContent only)              │    │
│  │ structure (NEW - DOM-derived JSON tree)                 │    │
│  │ cross_references (NEW - DOM-anchored array)             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### DOM Structure Extractor Interface

```javascript
/**
 * Extracts legal structure directly from DOM at extraction time
 * @param {Document} document - The live DOM document
 * @param {string} contentRaw - The extracted content_raw for offset mapping
 * @returns {StructureTree} - Lossless JSON tree of structure elements
 */
function extractStructureFromDOM(document, contentRaw) {
  // Extracts structure from DOM, maps to content_raw offsets
}

/**
 * @typedef {Object} StructureTree
 * @property {PreambleElement|null} preamble - Preamble if detected from DOM
 * @property {EnactmentElement|null} enactment_clause - Enactment clause if detected
 * @property {SectionElement[]} sections - Array of sections from .lineremoves rows
 * @property {StructureMetadata} metadata - Extraction metadata
 */

/**
 * @typedef {Object} SectionElement
 * @property {number} dom_index - Index in DOM order (from .lineremoves)
 * @property {string} section_number - Exact text (e.g., "১৷") from .txt-head
 * @property {string|null} heading - Section heading text verbatim from .txt-head
 * @property {number} heading_offset - Character offset of heading in content_raw
 * @property {number} number_offset - Character offset of section number in content_raw
 * @property {SubsectionElement[]} subsections - Nested subsections from .txt-details
 * @property {ClauseElement[]} clauses - Direct clauses from .txt-details
 * @property {number} content_start - Start offset of section content in content_raw
 * @property {number} content_end - End offset of section content in content_raw
 */

/**
 * @typedef {Object} SubsectionElement
 * @property {string} marker - Exact marker text (e.g., "(১)") from DOM
 * @property {number} marker_offset - Character offset of marker in content_raw
 * @property {ClauseElement[]} clauses - Nested clauses
 * @property {number} content_start - Start offset in content_raw
 * @property {number} content_end - End offset in content_raw
 */

/**
 * @typedef {Object} ClauseElement
 * @property {string} marker - Exact marker text (e.g., "(ক)") from DOM
 * @property {number} marker_offset - Character offset of marker in content_raw
 * @property {number} content_start - Start offset in content_raw
 * @property {number} content_end - End offset in content_raw
 */
```

### DOM Reference Extractor Interface

```javascript
/**
 * Extracts statutory references from DOM elements (links, text patterns)
 * @param {Document} document - The live DOM document
 * @param {string} contentRaw - The extracted content_raw for offset mapping
 * @param {StructureTree} structure - Parsed structure for scope resolution
 * @returns {CrossReference[]} - Array of scope-anchored references
 */
function extractReferencesFromDOM(document, contentRaw, structure) {
  // Extracts references from DOM links and patterns
}

/**
 * @typedef {Object} CrossReference
 * @property {string} citation_text - Exact citation text verbatim from DOM
 * @property {number} character_offset - Position in content_raw
 * @property {string|null} href - Hyperlink URL if reference is a link
 * @property {string|null} act_id - Act ID extracted from href (e.g., "790")
 * @property {ReferenceScope} scope - Structural location
 * @property {string} reference_semantics - Always "string_match_only"
 * @property {string} reference_warning - Disclaimer text
 */

/**
 * @typedef {Object} ReferenceScope
 * @property {string|null} section - Section number if determinable
 * @property {string|null} subsection - Subsection marker if applicable
 * @property {string|null} clause - Clause marker if applicable
 * @property {number|null} dom_section_index - DOM index of containing section
 */
```

## DOM Selectors

### Existing Selectors (from content.js)

```javascript
const BDLAW_LEGAL_SELECTORS = {
  // Container
  actContainer: '.boxed-layout',
  
  // Pre-section elements
  actHeaderSection: '.bg-act-section',
  actRepealedNotice: '.bt-act-repealed',
  actPurpose: '.act-role-style',
  actPreamble: '.lineremove',  // singular - preamble
  
  // Section rows
  sectionRows: '.lineremoves',  // plural - section rows
  sectionTitle: '.col-sm-3.txt-head',
  sectionBody: '.col-sm-9.txt-details'
};
```

### New Selectors for Structure Extraction

```javascript
const STRUCTURE_SELECTORS = {
  // Statutory links (references to other acts)
  statutoryLinks: 'a[href*="act-details"]',
  
  // Tables (for schedule detection)
  tables: 'table',
  
  // All links for reference extraction
  allLinks: 'a[href]'
};
```

## Data Models

### Structure Output Schema

```json
{
  "structure": {
    "preamble": {
      "text": "যেহেতু বাংলাদেশের সামুদ্রিক এলাকা...",
      "offset": 1234,
      "has_preamble": true,
      "dom_source": ".lineremove"
    },
    "enactment_clause": {
      "text": "সেহেতু এতদ্বারা নিম্নরূপ আইন করা হইল",
      "offset": 1456,
      "has_enactment_clause": true,
      "dom_source": ".lineremove"
    },
    "sections": [
      {
        "dom_index": 0,
        "section_number": "১৷",
        "heading": "সংক্ষিপ্ত শিরোনামা",
        "heading_offset": 1500,
        "number_offset": 1520,
        "subsections": [],
        "clauses": [],
        "content_start": 1520,
        "content_end": 1600,
        "dom_source": ".lineremoves"
      },
      {
        "dom_index": 1,
        "section_number": "২৷",
        "heading": "সংজ্ঞা",
        "heading_offset": 1600,
        "number_offset": 1610,
        "subsections": [],
        "clauses": [
          {
            "marker": "(ক)",
            "marker_offset": 1650,
            "content_start": 1650,
            "content_end": 1700
          },
          {
            "marker": "(খ)",
            "marker_offset": 1700,
            "content_start": 1700,
            "content_end": 1800
          }
        ],
        "content_start": 1610,
        "content_end": 2000,
        "dom_source": ".lineremoves"
      }
    ],
    "metadata": {
      "total_sections": 15,
      "total_subsections": 12,
      "total_clauses": 45,
      "extraction_method": "dom_first",
      "deterministic": true
    }
  }
}
```

### Cross-References Output Schema

```json
{
  "cross_references": [
    {
      "citation_text": "Passport Act, 1920 (XXXIX of 1920)",
      "character_offset": 5678,
      "href": "http://bdlaws.minlaw.gov.bd/act-details-123.html",
      "act_id": "123",
      "scope": {
        "section": "১০৷",
        "subsection": "(১)",
        "clause": "(ক)",
        "dom_section_index": 9
      },
      "reference_semantics": "string_match_only",
      "reference_warning": "Keywords detected in proximity to citation strings. No legal relationship, effect, direction, or applicability is implied."
    },
    {
      "citation_text": "মাদকদ্রব্য নিয়ন্ত্রণ আইন, ১৯৯০ (১৯৯০ সনের ২০ নং আইন)",
      "character_offset": 5890,
      "href": null,
      "act_id": null,
      "scope": {
        "section": "১০৷",
        "subsection": "(১)",
        "clause": "(ক)",
        "dom_section_index": 9
      },
      "reference_semantics": "string_match_only",
      "reference_warning": "Keywords detected in proximity to citation strings. No legal relationship, effect, direction, or applicability is implied."
    }
  ]
}
```

## Pattern Definitions

### Bengali Legal Patterns (for subsection/clause detection within DOM content)

```javascript
const BENGALI_STRUCTURE_PATTERNS = {
  // Section number: Bengali numeral(s) + danda (extracted from .txt-head)
  sectionNumber: /[০-৯]+৷/g,
  
  // Subsection marker: Bengali numeral in parentheses (within .txt-details)
  subsectionMarker: /\([০-৯]+\)/g,
  
  // Clause marker: Bengali letter in parentheses (within .txt-details)
  clauseMarker: /\([ক-ঢ]\)/g,
  
  // Preamble start patterns (in .lineremove content)
  preambleStart: /যেহেতু|WHEREAS/gi,
  
  // Enactment clause patterns (in .lineremove content)
  enactmentClause: /সেহেতু\s+এতদ্বারা|Be\s+it\s+enacted/gi
};

const CITATION_PATTERNS = {
  // Bengali citation pattern: year + number + আইন
  bengaliCitation: /[০-৯]{4}\s+সনের\s+[০-৯]+\s+নং\s+আইন/g,
  
  // English citation pattern: Name Act, Year (Roman numerals)
  englishCitation: /[A-Z][a-zA-Z\s]+(?:Act|Ordinance|Order),?\s*\d{4}\s*\([IVXLCDM]+\s+of\s+\d{4}\)/g,
  
  // Act link pattern for href extraction
  actLinkPattern: /act-details-(\d+)/
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Content Raw Immutability

*For any* DOM document and `content_raw` input, after structure extraction and reference detection, the `content_raw` field in the output SHALL be byte-identical to the input `content_raw`.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

### Property 2: Structure Offset Validity

*For any* structural element in the `structure` output, the `character_offset` SHALL be a valid index into `content_raw`, and `content_raw.substring(offset, offset + marker.length)` SHALL equal the recorded marker text.

**Validates: Requirements 2.4, 3.4, 4.4, 5.4, 6.4, 7.4, 8.3, 8.5**

### Property 3: DOM-Section Correspondence

*For any* `.lineremoves` row in the DOM, there SHALL be a corresponding entry in `structure.sections` with matching `dom_index` and content derived from `.txt-head` and `.txt-details`.

**Validates: Requirements 2.1, 2.2, 2.5, 3.1, 3.5**

### Property 4: Subsection Nesting Correctness

*For any* subsection element in the structure, its `marker_offset` SHALL fall within the `content_start` and `content_end` range of its parent section.

**Validates: Requirements 4.2, 4.5**

### Property 5: Clause Nesting Correctness

*For any* clause element in the structure, its `marker_offset` SHALL fall within the `content_start` and `content_end` range of its parent section or subsection.

**Validates: Requirements 5.2, 5.5**

### Property 6: Reference Offset Validity

*For any* cross-reference in the output, `content_raw.substring(character_offset, character_offset + citation_text.length)` SHALL equal the recorded `citation_text`.

**Validates: Requirements 9.4, 11.2**

### Property 7: Reference Scope Consistency

*For any* cross-reference with a non-null scope, the scope's section/subsection/clause values SHALL correspond to structural elements that contain the reference's `character_offset`.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 8: Deterministic Output

*For any* DOM document and `content_raw` input, calling `extractStructureFromDOM()` and `extractReferencesFromDOM()` multiple times SHALL produce byte-identical output each time.

**Validates: Requirements 12.1, 12.2, 12.3**

### Property 9: Document Order Preservation

*For any* `structure.sections` array, the sections SHALL be ordered by their `dom_index` values in ascending order (DOM document order).

**Validates: Requirements 2.5, 8.2**

### Property 10: Verbatim Text Preservation

*For any* structural element with a `marker` or `heading` field, the text SHALL be exactly as it appears in the DOM's `textContent` at the source element—no normalization, trimming, or modification.

**Validates: Requirements 2.3, 2.6, 3.3, 3.6, 4.3, 4.6, 5.3, 5.6, 6.3, 6.5, 7.3, 7.5**

### Property 11: Backward Compatibility

*For any* extraction result processed through structure derivation, all existing fields (content_raw, content_normalized, content_corrected, lexical_references) SHALL remain unchanged.

**Validates: Requirements 13.1, 13.2, 13.5**

### Property 12: No Legal Inference

*For any* cross-reference in the output, the `reference_semantics` field SHALL be "string_match_only" and no relationship type (amendment, repeal, etc.) SHALL be present.

**Validates: Requirements 9.5, 9.6, 11.3, 11.4, 11.5**

### Property 13: Link Extraction Completeness

*For any* `<a href="...act-details...">` element in the DOM within section content, there SHALL be a corresponding entry in `cross_references` with the `href` and extracted `act_id`.

**Validates: Requirements 9.1, 9.2**

## Error Handling

### Structure Extraction Errors

- If DOM document is null, return `structure: null`
- If no `.lineremoves` rows found, return `structure: { sections: [], metadata: { total_sections: 0 } }`
- If offset calculation fails, log error and set offset to -1 (invalid)
- Never throw exceptions that would prevent output generation

### Reference Extraction Errors

- If DOM document is null, return `cross_references: []`
- If structure is null, extract references without scope anchoring (scope fields set to null)
- If scope resolution fails for a reference, set scope fields to null for that reference
- If href parsing fails, set act_id to null
- Never throw exceptions that would prevent output generation

## Testing Strategy

### Unit Tests

- Test DOM structure extraction with mock DOM documents
- Test offset calculation for various Unicode character combinations
- Test link extraction from DOM elements
- Test edge cases: empty DOM, no sections, no references
- Test backward compatibility with existing extraction output

### Property-Based Tests

- Use fast-check to generate mock DOM structures
- Verify all 13 correctness properties hold for generated inputs
- Test with real extracted acts from the corpus
- Minimum 100 iterations per property test

### Integration Tests

- Process sample acts through full pipeline
- Verify structure matches DOM structure
- Verify cross-references include all links
- Verify offsets map correctly to content_raw
- Test determinism by running same input multiple times
