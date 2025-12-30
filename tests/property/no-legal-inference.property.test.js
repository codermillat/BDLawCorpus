/**
 * Property-Based Tests for No Legal Inference
 * 
 * Feature: legal-structure-derivation, Property 12: No Legal Inference
 * Validates: Requirements 9.5, 9.6, 11.3, 11.4, 11.5
 * 
 * For any cross-reference in the output, the `reference_semantics` field SHALL be
 * "string_match_only" and no relationship type (amendment, repeal, etc.) SHALL be present.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 12: No Legal Inference', () => {
  // Bengali numerals: ০-৯ (U+09E6 to U+09EF)
  const BENGALI_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  // Bengali danda: ৷ (U+09F7)
  const DANDA = '৷';
  
  // Forbidden relationship types that should NEVER appear in cross_references
  const FORBIDDEN_RELATIONSHIP_TYPES = [
    'amendment',
    'repeal',
    'substitution',
    'dependency',
    'incorporation',
    'modification',
    'supersession',
    'override',
    'revocation',
    'annulment'
  ];

  /**
   * Helper to convert Arabic number to Bengali numerals
   */
  function toBengaliNumeral(num) {
    return String(num).split('').map(d => BENGALI_NUMERALS[parseInt(d)]).join('');
  }

  /**
   * Helper to create a section marker
   */
  function createSectionMarker(num) {
    return toBengaliNumeral(num) + DANDA;
  }

  /**
   * Helper to create a Bengali citation
   */
  function createBengaliCitation(year, serial) {
    return `${toBengaliNumeral(year)} সনের ${toBengaliNumeral(serial)} নং আইন`;
  }

  /**
   * Helper to create an English citation
   */
  function createEnglishCitation(actName, year, romanNumeral) {
    return `${actName} Act, ${year} (${romanNumeral} of ${year})`;
  }

  /**
   * Helper to create a link reference
   */
  function createLinkReference(citationText, offset, href, actId) {
    return {
      citation_text: citationText,
      character_offset: offset,
      href: href || null,
      act_id: actId || null,
      dom_section_index: 0
    };
  }

  /**
   * Helper to create a pattern reference
   */
  function createPatternReference(citationText, offset) {
    return {
      citation_text: citationText,
      character_offset: offset,
      dom_section_index: 0
    };
  }

  /**
   * Helper to create a minimal structure for testing
   */
  function createMinimalStructure(sectionMarker, contentStart, contentEnd) {
    return {
      sections: [{
        dom_index: 0,
        section_number: sectionMarker,
        heading: null,
        content_start: contentStart,
        content_end: contentEnd,
        subsections: [],
        clauses: []
      }],
      metadata: { total_sections: 1 }
    };
  }

  /**
   * Property: reference_semantics is always "string_match_only"
   * Validates: Requirements 11.3 - Include reference_semantics disclaimer
   */
  it('should set reference_semantics to "string_match_only" for all cross-references', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
        (sectionNum, citationYear, citationSerial, actIds) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          
          // Build content
          const contentRaw = sectionMarker + ' বিষয় ' + citation + ' শেষ';
          const citationOffset = contentRaw.indexOf(citation);
          
          // Create link references
          const linkReferences = actIds.map((actId, idx) => 
            createLinkReference(
              citation + idx,
              citationOffset + idx,
              `http://bdlaws.minlaw.gov.bd/act-details-${actId}.html`,
              String(actId)
            )
          );
          
          // Create structure
          const structure = createMinimalStructure(sectionMarker, 0, contentRaw.length);
          
          // Build cross-references
          const crossReferences = BDLawExtractor.buildCrossReferences({
            linkReferences,
            patternReferences: [],
            structure,
            contentRaw
          });
          
          // Verify all references have reference_semantics = "string_match_only"
          return crossReferences.every(ref => 
            ref.reference_semantics === 'string_match_only'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: reference_warning is always present
   * Validates: Requirements 11.4 - Include reference_warning disclaimer
   */
  it('should include reference_warning disclaimer for all cross-references', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        (sectionNum, citationYear, citationSerial) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          
          // Build content
          const contentRaw = sectionMarker + ' বিষয় ' + citation + ' শেষ';
          const citationOffset = contentRaw.indexOf(citation);
          
          // Create pattern reference
          const patternReferences = [createPatternReference(citation, citationOffset)];
          
          // Create structure
          const structure = createMinimalStructure(sectionMarker, 0, contentRaw.length);
          
          // Build cross-references
          const crossReferences = BDLawExtractor.buildCrossReferences({
            linkReferences: [],
            patternReferences,
            structure,
            contentRaw
          });
          
          // Verify all references have reference_warning
          return crossReferences.every(ref => 
            ref.reference_warning && 
            typeof ref.reference_warning === 'string' &&
            ref.reference_warning.length > 0 &&
            ref.reference_warning.includes('No legal relationship')
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: No relationship type fields present in cross-references
   * Validates: Requirements 11.5 - No inferred relationship type
   */
  it('should not include any relationship type fields in cross-references', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 3 }),
        (sectionNum, citationYear, citationSerial, actIds) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          
          // Build content
          const contentRaw = sectionMarker + ' বিষয় ' + citation + ' শেষ';
          const citationOffset = contentRaw.indexOf(citation);
          
          // Create mixed references (both link and pattern)
          const linkReferences = actIds.slice(0, 1).map((actId, idx) => 
            createLinkReference(
              citation,
              citationOffset,
              `http://bdlaws.minlaw.gov.bd/act-details-${actId}.html`,
              String(actId)
            )
          );
          
          const patternReferences = actIds.slice(1).map((_, idx) => 
            createPatternReference(citation + ' অতিরিক্ত ' + idx, citationOffset + 50 + idx * 10)
          );
          
          // Create structure
          const structure = createMinimalStructure(sectionMarker, 0, contentRaw.length + 100);
          
          // Build cross-references
          const crossReferences = BDLawExtractor.buildCrossReferences({
            linkReferences,
            patternReferences,
            structure,
            contentRaw
          });
          
          // Verify no forbidden relationship type fields exist
          return crossReferences.every(ref => {
            // Check that none of the forbidden relationship types are present as fields
            for (const forbiddenType of FORBIDDEN_RELATIONSHIP_TYPES) {
              if (ref.hasOwnProperty(forbiddenType)) return false;
              if (ref.hasOwnProperty('relationship_type') && ref.relationship_type === forbiddenType) return false;
              if (ref.hasOwnProperty('relation_type') && ref.relation_type === forbiddenType) return false;
              if (ref.hasOwnProperty('type') && FORBIDDEN_RELATIONSHIP_TYPES.includes(ref.type)) return false;
            }
            return true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cross-references do not resolve or link acts
   * Validates: Requirements 9.5 - No resolution or linking
   */
  it('should not resolve or infer relationships between acts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        fc.stringOf(fc.constantFrom('A', 'B', 'C', 'D', 'E', ' '), { minLength: 3, maxLength: 15 }),
        (sectionNum, citationYear, citationSerial, actNamePart) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const bengaliCitation = createBengaliCitation(citationYear, citationSerial);
          const englishCitation = createEnglishCitation(actNamePart.trim() || 'Test', citationYear, 'XV');
          
          // Build content with both citation types
          const contentRaw = sectionMarker + ' ' + bengaliCitation + ' এবং ' + englishCitation + ' শেষ';
          const bengaliOffset = contentRaw.indexOf(bengaliCitation);
          const englishOffset = contentRaw.indexOf(englishCitation);
          
          // Create references
          const linkReferences = [
            createLinkReference(bengaliCitation, bengaliOffset, 'http://bdlaws.minlaw.gov.bd/act-details-123.html', '123')
          ];
          const patternReferences = [
            createPatternReference(englishCitation, englishOffset)
          ];
          
          // Create structure
          const structure = createMinimalStructure(sectionMarker, 0, contentRaw.length);
          
          // Build cross-references
          const crossReferences = BDLawExtractor.buildCrossReferences({
            linkReferences,
            patternReferences,
            structure,
            contentRaw
          });
          
          // Verify no resolution/linking fields exist
          return crossReferences.every(ref => {
            // Should not have resolved_to, linked_act, target_act, etc.
            const forbiddenFields = [
              'resolved_to', 'linked_act', 'target_act', 'source_act',
              'amends', 'amended_by', 'repeals', 'repealed_by',
              'depends_on', 'dependency_of', 'incorporates', 'incorporated_by',
              'legal_effect', 'applicability', 'validity'
            ];
            
            for (const field of forbiddenFields) {
              if (ref.hasOwnProperty(field)) return false;
            }
            return true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cross-references do not determine legal effect
   * Validates: Requirements 9.6 - No legal effect determination
   */
  it('should not include legal effect, applicability, or validity fields', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        (sectionNum, citationYear, citationSerial) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          
          // Build content
          const contentRaw = sectionMarker + ' বিষয় ' + citation + ' শেষ';
          const citationOffset = contentRaw.indexOf(citation);
          
          // Create reference
          const linkReferences = [
            createLinkReference(citation, citationOffset, 'http://bdlaws.minlaw.gov.bd/act-details-456.html', '456')
          ];
          
          // Create structure
          const structure = createMinimalStructure(sectionMarker, 0, contentRaw.length);
          
          // Build cross-references
          const crossReferences = BDLawExtractor.buildCrossReferences({
            linkReferences,
            patternReferences: [],
            structure,
            contentRaw
          });
          
          // Verify no legal effect fields exist
          return crossReferences.every(ref => {
            const forbiddenLegalFields = [
              'legal_effect', 'effect', 'applicability', 'validity',
              'in_force', 'current', 'active', 'status',
              'effective_date', 'commencement', 'expiry'
            ];
            
            for (const field of forbiddenLegalFields) {
              if (ref.hasOwnProperty(field)) return false;
            }
            return true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty inputs produce empty cross-references with no inference
   * Validates: Requirements 11.3, 11.4, 11.5 - Edge case handling
   */
  it('should return empty array for empty inputs without any inference', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ linkReferences: [], patternReferences: [], structure: null, contentRaw: '' }),
          fc.constant({ linkReferences: [], patternReferences: [], structure: { sections: [] }, contentRaw: 'test' }),
          fc.constant({ linkReferences: null, patternReferences: null, structure: null, contentRaw: '' })
        ),
        (input) => {
          const crossReferences = BDLawExtractor.buildCrossReferences(input);
          
          // Should return empty array
          return Array.isArray(crossReferences) && crossReferences.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All cross-references have only allowed fields
   * Validates: Requirements 11.2, 11.3, 11.4, 11.5 - Output format compliance
   */
  it('should only include allowed fields in cross-reference output', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        (sectionNum, citationYear, citationSerial) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          
          // Build content
          const contentRaw = sectionMarker + ' বিষয় ' + citation + ' শেষ';
          const citationOffset = contentRaw.indexOf(citation);
          
          // Create reference
          const linkReferences = [
            createLinkReference(citation, citationOffset, 'http://bdlaws.minlaw.gov.bd/act-details-789.html', '789')
          ];
          
          // Create structure
          const structure = createMinimalStructure(sectionMarker, 0, contentRaw.length);
          
          // Build cross-references
          const crossReferences = BDLawExtractor.buildCrossReferences({
            linkReferences,
            patternReferences: [],
            structure,
            contentRaw
          });
          
          // Allowed fields per Requirements 11.2
          const allowedFields = new Set([
            'citation_text',
            'character_offset',
            'href',
            'act_id',
            'scope',
            'reference_semantics',
            'reference_warning'
          ]);
          
          // Verify all references only have allowed fields
          return crossReferences.every(ref => {
            const refFields = Object.keys(ref);
            return refFields.every(field => allowedFields.has(field));
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: reference_semantics value is exactly "string_match_only"
   * Validates: Requirements 11.3 - Exact value check
   */
  it('should have reference_semantics exactly equal to "string_match_only"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        (sectionNum, citationYear, citationSerial) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          
          // Build content
          const contentRaw = sectionMarker + ' বিষয় ' + citation + ' শেষ';
          const citationOffset = contentRaw.indexOf(citation);
          
          // Create both link and pattern references
          const linkReferences = [
            createLinkReference(citation, citationOffset, 'http://bdlaws.minlaw.gov.bd/act-details-111.html', '111')
          ];
          const patternReferences = [
            createPatternReference(citation + ' অতিরিক্ত', citationOffset + 50)
          ];
          
          // Create structure
          const structure = createMinimalStructure(sectionMarker, 0, contentRaw.length + 100);
          
          // Build cross-references
          const crossReferences = BDLawExtractor.buildCrossReferences({
            linkReferences,
            patternReferences,
            structure,
            contentRaw
          });
          
          // Verify exact value
          return crossReferences.every(ref => 
            ref.reference_semantics === 'string_match_only' &&
            ref.reference_semantics !== 'legal_relationship' &&
            ref.reference_semantics !== 'semantic_match' &&
            ref.reference_semantics !== 'inferred'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
