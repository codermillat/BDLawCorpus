/**
 * Property-Based Tests for Verbatim Text Preservation
 * 
 * Feature: legal-structure-derivation, Property 10: Verbatim Text Preservation
 * Validates: Requirements 2.3, 2.6, 3.3, 3.6, 4.3, 4.6, 5.3, 5.6, 6.3, 6.5, 7.3, 7.5
 * 
 * For any structural element with a `marker` or `heading` field, the text SHALL be
 * exactly as it appears in the DOM's `textContent` at the source element—no
 * normalization, trimming, or modification.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 10: Verbatim Text Preservation', () => {
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
   * Helper to create a section marker
   */
  function createSectionMarker(num) {
    return toBengaliNumeral(num) + DANDA;
  }

  /**
   * Helper to create a subsection marker
   */
  function createSubsectionMarker(num) {
    return '(' + toBengaliNumeral(num) + ')';
  }

  /**
   * Helper to create a clause marker
   */
  function createClauseMarker(index) {
    if (index >= 0 && index < BENGALI_LETTERS.length) {
      return '(' + BENGALI_LETTERS[index] + ')';
    }
    return '(ক)';
  }

  /**
   * Property: Section numbers are preserved verbatim (no normalization)
   * Validates: Requirements 2.3, 2.6 - Record exact text, no normalization
   */
  it('should preserve section numbers verbatim without normalization', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ'), { minLength: 1, maxLength: 15 }),
        (sectionNum, heading) => {
          const sectionMarker = createSectionMarker(sectionNum);
          
          // Build section
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: heading,
            body_text: 'বিষয়বস্তু',
            subsections: [],
            clauses: []
          }];
          
          const contentRaw = heading + ' ' + sectionMarker + ' বিষয়বস্তু';
          
          // Build structure tree
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Section number should be exactly as input (verbatim)
          return structure.sections[0].section_number === sectionMarker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section headings are preserved verbatim
   * Validates: Requirements 3.3, 3.6 - Record exact heading text verbatim
   */
  it('should preserve section headings verbatim without modification', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        // Generate heading with various Bengali characters
        fc.stringOf(
          fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', ' ', 'া', 'ি', 'ু'),
          { minLength: 1, maxLength: 30 }
        ),
        (sectionNum, heading) => {
          const sectionMarker = createSectionMarker(sectionNum);
          
          // Build section with the exact heading
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: heading,
            body_text: 'বিষয়বস্তু',
            subsections: [],
            clauses: []
          }];
          
          const contentRaw = heading + ' ' + sectionMarker + ' বিষয়বস্তু';
          
          // Build structure tree
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Heading should be exactly as input (verbatim)
          return structure.sections[0].heading === heading;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Subsection markers are preserved verbatim
   * Validates: Requirements 4.3, 4.6 - Record exact marker text, no normalization
   */
  it('should preserve subsection markers verbatim without normalization', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 99 }),
        (sectionNum, subsectionNum) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const subsectionMarker = createSubsectionMarker(subsectionNum);
          
          // Build section with subsection
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: 'শিরোনাম',
            body_text: subsectionMarker + ' বিষয়বস্তু',
            subsections: [{
              marker: subsectionMarker,
              relativeOffset: 0,
              clauses: []
            }],
            clauses: []
          }];
          
          const contentRaw = 'শিরোনাম ' + sectionMarker + ' ' + subsectionMarker + ' বিষয়বস্তু';
          
          // Build structure tree
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Subsection marker should be exactly as input (verbatim)
          return structure.sections[0].subsections[0].marker === subsectionMarker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Clause markers are preserved verbatim
   * Validates: Requirements 5.3, 5.6 - Record exact marker text, no normalization
   */
  it('should preserve clause markers verbatim without normalization', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 7 }),
        (sectionNum, clauseIndex) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const clauseMarker = createClauseMarker(clauseIndex);
          
          // Build section with clause
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: 'শিরোনাম',
            body_text: clauseMarker + ' বিষয়বস্তু',
            subsections: [],
            clauses: [{
              marker: clauseMarker,
              relativeOffset: 0
            }]
          }];
          
          const contentRaw = 'শিরোনাম ' + sectionMarker + ' ' + clauseMarker + ' বিষয়বস্তু';
          
          // Build structure tree
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Clause marker should be exactly as input (verbatim)
          return structure.sections[0].clauses[0].marker === clauseMarker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Preamble text is preserved verbatim
   * Validates: Requirements 6.3, 6.5 - Record exact preamble text, no modification
   */
  it('should preserve preamble text verbatim without modification', () => {
    fc.assert(
      fc.property(
        fc.stringOf(
          fc.constantFrom('য', 'ে', 'হ', 'ে', 'ত', 'ু', ' ', 'ক', 'খ', 'গ'),
          { minLength: 5, maxLength: 100 }
        ),
        (preambleText) => {
          // Ensure preamble starts with যেহেতু pattern
          const fullPreamble = 'যেহেতু ' + preambleText;
          
          const contentRaw = fullPreamble + '\n সেহেতু এতদ্বারা আইন করা হইল';
          
          // Build structure tree with preamble
          const structure = BDLawExtractor.buildStructureTree({
            preamble: {
              text: fullPreamble,
              dom_source: '.lineremove'
            },
            enactment: null,
            sections: [],
            contentRaw: contentRaw
          });
          
          // Preamble text should be exactly as input (verbatim)
          return structure.preamble && structure.preamble.text === fullPreamble;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Enactment clause text is preserved verbatim
   * Validates: Requirements 7.3, 7.5 - Record exact enactment text, no modification
   */
  it('should preserve enactment clause text verbatim without modification', () => {
    fc.assert(
      fc.property(
        fc.stringOf(
          fc.constantFrom('আ', 'ই', 'ন', ' ', 'ক', 'র', 'া', 'হ', 'ই', 'ল'),
          { minLength: 5, maxLength: 50 }
        ),
        (enactmentSuffix) => {
          // Ensure enactment starts with সেহেতু এতদ্বারা pattern
          const fullEnactment = 'সেহেতু এতদ্বারা ' + enactmentSuffix;
          
          const contentRaw = 'যেহেতু প্রস্তাবনা\n' + fullEnactment;
          
          // Build structure tree with enactment
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: {
              text: fullEnactment,
              dom_source: '.lineremove'
            },
            sections: [],
            contentRaw: contentRaw
          });
          
          // Enactment text should be exactly as input (verbatim)
          return structure.enactment_clause && 
                 structure.enactment_clause.text === fullEnactment;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali numerals in section numbers are NOT converted to Arabic
   * Validates: Requirements 2.6 - No normalization of Bengali numerals
   */
  it('should NOT convert Bengali numerals to Arabic numerals in section numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        (num) => {
          const sectionMarker = createSectionMarker(num);
          
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: 'শিরোনাম',
            body_text: 'বিষয়বস্তু',
            subsections: [],
            clauses: []
          }];
          
          const contentRaw = 'শিরোনাম ' + sectionMarker + ' বিষয়বস্তু';
          
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          const outputNumber = structure.sections[0].section_number;
          
          // Should contain Bengali numerals
          const hasBengaliNumeral = /[০-৯]/.test(outputNumber);
          // Should NOT contain Arabic numerals
          const hasArabicNumeral = /[0-9]/.test(outputNumber);
          
          return hasBengaliNumeral && !hasArabicNumeral;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali numerals in subsection markers are NOT converted to Arabic
   * Validates: Requirements 4.6 - No normalization of subsection markers
   */
  it('should NOT convert Bengali numerals to Arabic numerals in subsection markers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        (num) => {
          const subsectionMarker = createSubsectionMarker(num);
          const sectionMarker = createSectionMarker(1);
          
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: 'শিরোনাম',
            body_text: subsectionMarker + ' বিষয়বস্তু',
            subsections: [{
              marker: subsectionMarker,
              relativeOffset: 0,
              clauses: []
            }],
            clauses: []
          }];
          
          const contentRaw = 'শিরোনাম ' + sectionMarker + ' ' + subsectionMarker + ' বিষয়বস্তু';
          
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          const outputMarker = structure.sections[0].subsections[0].marker;
          
          // Should contain Bengali numerals
          const hasBengaliNumeral = /[০-৯]/.test(outputMarker);
          // Should NOT contain Arabic numerals
          const hasArabicNumeral = /[0-9]/.test(outputMarker);
          
          return hasBengaliNumeral && !hasArabicNumeral;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali letters in clause markers are NOT modified
   * Validates: Requirements 5.6 - No normalization of clause letters
   */
  it('should NOT modify Bengali letters in clause markers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 7 }),
        (clauseIndex) => {
          const clauseMarker = createClauseMarker(clauseIndex);
          const sectionMarker = createSectionMarker(1);
          
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: 'শিরোনাম',
            body_text: clauseMarker + ' বিষয়বস্তু',
            subsections: [],
            clauses: [{
              marker: clauseMarker,
              relativeOffset: 0
            }]
          }];
          
          const contentRaw = 'শিরোনাম ' + sectionMarker + ' ' + clauseMarker + ' বিষয়বস্তু';
          
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          const outputMarker = structure.sections[0].clauses[0].marker;
          
          // Should contain Bengali letters
          const hasBengaliLetter = /[ক-ঞ]/.test(outputMarker);
          // Should NOT contain English letters
          const hasEnglishLetter = /[a-zA-Z]/.test(outputMarker);
          
          return hasBengaliLetter && !hasEnglishLetter;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Null headings remain null (not converted to empty string)
   * Validates: Requirements 3.6 - Do not synthesize headings
   */
  it('should preserve null headings as null', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (sectionNum) => {
          const sectionMarker = createSectionMarker(sectionNum);
          
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: null, // Explicitly null
            body_text: 'বিষয়বস্তু',
            subsections: [],
            clauses: []
          }];
          
          const contentRaw = sectionMarker + ' বিষয়বস্তু';
          
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Heading should remain null
          return structure.sections[0].heading === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple sections preserve all their verbatim text
   * Validates: Requirements 2.3, 3.3 - Verbatim preservation across multiple sections
   */
  it('should preserve verbatim text across multiple sections', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 30 }), { minLength: 2, maxLength: 5 }),
        fc.array(
          fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ'), { minLength: 1, maxLength: 10 }),
          { minLength: 2, maxLength: 5 }
        ),
        (sectionNums, headings) => {
          const count = Math.min(sectionNums.length, headings.length);
          
          // Build sections
          const sections = [];
          for (let i = 0; i < count; i++) {
            sections.push({
              dom_index: i,
              section_number: createSectionMarker(sectionNums[i]),
              heading: headings[i],
              body_text: 'বিষয়বস্তু',
              subsections: [],
              clauses: []
            });
          }
          
          const contentRaw = sections.map(s => 
            s.heading + ' ' + s.section_number + ' ' + s.body_text
          ).join('\n');
          
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // All sections should have verbatim text preserved
          return structure.sections.every((section, idx) => 
            section.section_number === sections[idx].section_number &&
            section.heading === sections[idx].heading
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
