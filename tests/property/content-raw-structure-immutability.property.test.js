/**
 * Property-Based Tests for Content Raw Immutability During Structure Derivation
 * 
 * Feature: legal-structure-derivation, Property 1: Content Raw Immutability
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * For any DOM document and content_raw input, after structure extraction and
 * reference detection, the content_raw field in the output SHALL be byte-identical
 * to the input content_raw.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 1: Content Raw Immutability (Structure Derivation)', () => {
  // Bengali numerals: ০-৯ (U+09E6 to U+09EF)
  const BENGALI_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  // Bengali danda: ৷ (U+09F7)
  const DANDA = '৷';
  // Bengali letters for clauses
  const BENGALI_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'];

  /**
   * Helper to generate a Bengali numeral string from a number
   */
  function toBengaliNumeral(num) {
    return String(num).split('').map(d => BENGALI_NUMERALS[parseInt(d)]).join('');
  }

  /**
   * Generator for Bengali content with legal structure markers
   */
  const bengaliLegalContentGen = fc.record({
    sectionNum: fc.integer({ min: 1, max: 99 }),
    heading: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' '), { minLength: 1, maxLength: 20 }),
    bodyText: fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', 'ঝ', 'ঞ', ' ', '\n'), { minLength: 10, maxLength: 100 }),
    hasSubsection: fc.boolean(),
    subsectionNum: fc.integer({ min: 1, max: 9 }),
    hasClause: fc.boolean(),
    clauseIndex: fc.integer({ min: 0, max: 4 })
  }).map(data => {
    const sectionMarker = toBengaliNumeral(data.sectionNum) + DANDA;
    let content = data.heading + ' ' + sectionMarker + ' ' + data.bodyText;
    
    if (data.hasSubsection) {
      const subsectionMarker = '(' + toBengaliNumeral(data.subsectionNum) + ')';
      content += ' ' + subsectionMarker + ' উপধারা বিষয়বস্তু';
    }
    
    if (data.hasClause) {
      const clauseMarker = '(' + BENGALI_LETTERS[data.clauseIndex] + ')';
      content += ' ' + clauseMarker + ' দফা বিষয়বস্তু';
    }
    
    return content;
  });

  /**
   * Generator for extraction result with content_raw
   */
  const extractionResultGen = fc.record({
    content: bengaliLegalContentGen,
    title: fc.string({ minLength: 1, maxLength: 50 }),
    url: fc.constant('http://bdlaws.minlaw.gov.bd/act-details-123.html')
  });

  /**
   * Generator for structure data (simulating DOM extraction)
   */
  const structureDataGen = fc.record({
    sectionNum: fc.integer({ min: 1, max: 99 }),
    heading: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' '), { minLength: 1, maxLength: 20 }),
    bodyText: fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', 'ঝ', 'ঞ', ' '), { minLength: 5, maxLength: 50 })
  }).map(data => {
    const sectionMarker = toBengaliNumeral(data.sectionNum) + DANDA;
    const contentRaw = data.heading + ' ' + sectionMarker + ' ' + data.bodyText;
    
    return {
      preamble: null,
      enactment: null,
      sections: [{
        dom_index: 0,
        section_number: sectionMarker,
        heading: data.heading,
        body_text: data.bodyText,
        subsections: [],
        clauses: []
      }],
      linkReferences: [],
      patternReferences: [],
      contentRaw: contentRaw
    };
  });

  /**
   * Property: content_raw is byte-identical after deriveStructureAndReferences
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
   */
  it('should preserve content_raw as byte-identical after structure derivation', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          const contentRaw = structureData.contentRaw;
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          // Store original content for comparison
          const originalContent = contentRaw;
          
          // Call deriveStructureAndReferences
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // content field must be byte-identical to original
          return result.content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw length is unchanged after structure derivation
   * Requirements: 1.1, 1.5
   */
  it('should preserve content_raw length after structure derivation', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          const contentRaw = structureData.contentRaw;
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const originalLength = contentRaw.length;
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return result.content.length === originalLength;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: structure derivation produces new derived fields, not replacements
   * Requirements: 1.3
   */
  it('should produce structure and cross_references as new derived fields', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          const contentRaw = structureData.contentRaw;
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // Result should have structure and cross_references as new fields
          const hasStructure = 'structure' in result;
          const hasCrossReferences = 'cross_references' in result;
          
          // Original fields should still exist
          const hasContent = 'content' in result;
          const hasTitle = 'title' in result;
          const hasUrl = 'url' in result;
          
          return hasStructure && hasCrossReferences && hasContent && hasTitle && hasUrl;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw preserves all whitespace after structure derivation
   * Requirements: 1.5
   */
  it('should preserve all whitespace in content_raw after structure derivation', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringOf(fc.constantFrom('ক', 'খ', 'গ'), { minLength: 1, maxLength: 20 }),
          fc.constantFrom(' ', '\t', '\n', '\r\n', '  ', '\t\t', '\n\n'),
          fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ'), { minLength: 1, maxLength: 20 })
        ).map(([before, ws, after]) => before + ws + after),
        (contentWithWhitespace) => {
          const extractionResult = {
            content: contentWithWhitespace,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const structureData = {
            preamble: null,
            enactment: null,
            sections: [],
            linkReferences: [],
            patternReferences: [],
            contentRaw: contentWithWhitespace
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return result.content === contentWithWhitespace;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw preserves Bengali punctuation after structure derivation
   * Requirements: 1.5
   */
  it('should preserve Bengali punctuation in content_raw after structure derivation', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringOf(fc.constantFrom('ক', 'খ', 'গ'), { minLength: 1, maxLength: 10 }),
          fc.constantFrom('।', '৷', '॥', ',', ';', ':', '!', '?'),
          fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ'), { minLength: 1, maxLength: 10 })
        ).map(([before, punct, after]) => before + punct + after),
        (contentWithPunctuation) => {
          const extractionResult = {
            content: contentWithPunctuation,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const structureData = {
            preamble: null,
            enactment: null,
            sections: [],
            linkReferences: [],
            patternReferences: [],
            contentRaw: contentWithPunctuation
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return result.content === contentWithPunctuation;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: multiple calls produce identical content_raw
   * Requirements: 1.2
   */
  it('should produce identical content_raw across multiple derivation calls', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          const contentRaw = structureData.contentRaw;
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          // Call deriveStructureAndReferences multiple times
          const result1 = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          const result2 = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          const result3 = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // All results should have identical content
          return result1.content === result2.content && result2.content === result3.content;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: null/undefined structureData returns content_raw unchanged
   * Requirements: 1.1, 1.2
   */
  it('should preserve content_raw when structureData is null or undefined', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentGen,
        fc.constantFrom(null, undefined),
        (contentRaw, structureData) => {
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // content should be unchanged
          return result.content === contentRaw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: structure derivation with preamble preserves content_raw
   * Requirements: 1.1, 1.4
   */
  it('should preserve content_raw when processing preamble', () => {
    fc.assert(
      fc.property(
        fc.record({
          preambleText: fc.stringOf(fc.constantFrom('য', 'ে', 'হ', 'ে', 'ত', 'ু', ' '), { minLength: 10, maxLength: 50 }),
          bodyText: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 10, maxLength: 50 })
        }),
        (data) => {
          const preambleStart = 'যেহেতু ' + data.preambleText;
          const contentRaw = preambleStart + ' ' + data.bodyText;
          
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const structureData = {
            preamble: {
              text: preambleStart,
              has_preamble: true,
              dom_source: '.lineremove'
            },
            enactment: null,
            sections: [],
            linkReferences: [],
            patternReferences: [],
            contentRaw: contentRaw
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return result.content === contentRaw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: structure derivation with enactment clause preserves content_raw
   * Requirements: 1.1, 1.4
   */
  it('should preserve content_raw when processing enactment clause', () => {
    fc.assert(
      fc.property(
        fc.record({
          enactmentText: fc.stringOf(fc.constantFrom('স', 'ে', 'হ', 'ে', 'ত', 'ু', ' '), { minLength: 10, maxLength: 50 }),
          bodyText: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 10, maxLength: 50 })
        }),
        (data) => {
          const enactmentStart = 'সেহেতু এতদ্বারা ' + data.enactmentText;
          const contentRaw = enactmentStart + ' ' + data.bodyText;
          
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const structureData = {
            preamble: null,
            enactment: {
              text: enactmentStart,
              has_enactment_clause: true,
              dom_source: '.lineremove'
            },
            sections: [],
            linkReferences: [],
            patternReferences: [],
            contentRaw: contentRaw
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return result.content === contentRaw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: structure derivation with cross-references preserves content_raw
   * Requirements: 1.1, 1.4
   */
  it('should preserve content_raw when processing cross-references', () => {
    fc.assert(
      fc.property(
        fc.record({
          citationText: fc.constant('Passport Act, 1920'),
          bodyText: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 10, maxLength: 50 })
        }),
        (data) => {
          const contentRaw = data.bodyText + ' ' + data.citationText + ' ' + data.bodyText;
          
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const structureData = {
            preamble: null,
            enactment: null,
            sections: [],
            linkReferences: [{
              citation_text: data.citationText,
              href: 'http://bdlaws.minlaw.gov.bd/act-details-123.html',
              dom_section_index: 0
            }],
            patternReferences: [],
            contentRaw: contentRaw
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return result.content === contentRaw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: empty extraction result returns structure: null without error
   * Requirements: 1.1
   */
  it('should handle empty extraction result gracefully', () => {
    const emptyResult = {};
    const result = BDLawExtractor.deriveStructureAndReferences(emptyResult, null);
    
    expect(result.structure).toBeNull();
    expect(result.cross_references).toEqual([]);
  });

  /**
   * Property: extraction result without content returns structure: null
   * Requirements: 1.1
   */
  it('should handle extraction result without content gracefully', () => {
    const resultWithoutContent = {
      title: 'Test Act',
      url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
    };
    
    const result = BDLawExtractor.deriveStructureAndReferences(resultWithoutContent, null);
    
    expect(result.structure).toBeNull();
    expect(result.cross_references).toEqual([]);
  });

  /**
   * Property: content_raw character-by-character equality after derivation
   * Requirements: 1.1, 1.5
   */
  it('should preserve content_raw character-by-character after derivation', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          const contentRaw = structureData.contentRaw;
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // Character-by-character comparison
          if (result.content.length !== contentRaw.length) {
            return false;
          }
          
          for (let i = 0; i < contentRaw.length; i++) {
            if (result.content.charCodeAt(i) !== contentRaw.charCodeAt(i)) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
