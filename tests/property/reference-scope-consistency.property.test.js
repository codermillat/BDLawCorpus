/**
 * Property-Based Tests for Reference Scope Consistency
 * 
 * Feature: legal-structure-derivation, Property 7: Reference Scope Consistency
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 * 
 * For any cross-reference with a non-null scope, the scope's section/subsection/clause
 * values SHALL correspond to structural elements that contain the reference's character_offset.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 7: Reference Scope Consistency', () => {
  // Bengali numerals: ০-৯ (U+09E6 to U+09EF)
  const BENGALI_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  // Bengali letters for clauses: ক-ঢ (U+0995 to U+09A2)
  const BENGALI_CLAUSE_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ'];
  // Bengali danda: ৷ (U+09F7)
  const DANDA = '৷';

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
   * Helper to create a subsection marker
   */
  function createSubsectionMarker(num) {
    return '(' + toBengaliNumeral(num) + ')';
  }

  /**
   * Helper to create a clause marker
   */
  function createClauseMarker(index) {
    const letterIndex = index % BENGALI_CLAUSE_LETTERS.length;
    return '(' + BENGALI_CLAUSE_LETTERS[letterIndex] + ')';
  }

  /**
   * Helper to create a Bengali citation
   */
  function createBengaliCitation(year, serial) {
    return `${toBengaliNumeral(year)} সনের ${toBengaliNumeral(serial)} নং আইন`;
  }

  /**
   * Property: anchorReferenceScope returns section when reference is within section bounds
   * Validates: Requirements 10.1 - Record containing section number
   */
  it('should return section when reference offset is within section content bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 5, maxLength: 30 }),
        (sectionNum, citationYear, citationSerial, bodyText) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          const heading = 'শিরোনাম';
          
          // Build content with citation inside section
          const sectionBody = bodyText + ' ' + citation + ' ' + bodyText;
          const contentRaw = heading + ' ' + sectionMarker + ' ' + sectionBody;
          
          // Calculate citation offset in content_raw
          const citationOffset = contentRaw.indexOf(citation);
          
          // Build structure
          const sectionContentStart = contentRaw.indexOf(sectionBody);
          const structure = {
            sections: [{
              dom_index: 0,
              section_number: sectionMarker,
              heading: heading,
              content_start: sectionContentStart,
              content_end: contentRaw.length,
              subsections: [],
              clauses: []
            }],
            metadata: { total_sections: 1 }
          };
          
          // Create reference
          const reference = { character_offset: citationOffset };
          
          // Anchor scope
          const scope = BDLawExtractor.anchorReferenceScope(reference, structure);
          
          // Verify section is correctly identified
          return scope.section === sectionMarker && scope.dom_section_index === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: anchorReferenceScope returns subsection when reference is within subsection
   * Validates: Requirements 10.2 - Record subsection marker when applicable
   */
  it('should return subsection when reference offset is after subsection marker', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        (sectionNum, subsectionNum, citationYear, citationSerial) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const subsectionMarker = createSubsectionMarker(subsectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          const heading = 'শিরোনাম';
          
          // Build content with citation inside subsection
          const subsectionContent = subsectionMarker + ' বিষয় ' + citation + ' শেষ';
          const sectionBody = 'প্রারম্ভ ' + subsectionContent;
          const contentRaw = heading + ' ' + sectionMarker + ' ' + sectionBody;
          
          // Calculate offsets
          const sectionContentStart = contentRaw.indexOf(sectionBody);
          const subsectionOffset = contentRaw.indexOf(subsectionMarker);
          const citationOffset = contentRaw.indexOf(citation);
          
          // Build structure with subsection
          const structure = {
            sections: [{
              dom_index: 0,
              section_number: sectionMarker,
              heading: heading,
              content_start: sectionContentStart,
              content_end: contentRaw.length,
              subsections: [{
                marker: subsectionMarker,
                marker_offset: subsectionOffset,
                content_start: subsectionOffset,
                content_end: contentRaw.length,
                clauses: []
              }],
              clauses: []
            }],
            metadata: { total_sections: 1 }
          };
          
          // Create reference
          const reference = { character_offset: citationOffset };
          
          // Anchor scope
          const scope = BDLawExtractor.anchorReferenceScope(reference, structure);
          
          // Verify subsection is correctly identified
          return scope.section === sectionMarker && 
                 scope.subsection === subsectionMarker &&
                 scope.dom_section_index === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: anchorReferenceScope returns clause when reference is within clause
   * Validates: Requirements 10.3 - Record clause marker when applicable
   */
  it('should return clause when reference offset is after clause marker', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 13 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        (sectionNum, clauseIndex, citationYear, citationSerial) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const clauseMarker = createClauseMarker(clauseIndex);
          const citation = createBengaliCitation(citationYear, citationSerial);
          const heading = 'শিরোনাম';
          
          // Build content with citation inside clause
          const clauseContent = clauseMarker + ' বিষয় ' + citation + ' শেষ';
          const sectionBody = 'প্রারম্ভ ' + clauseContent;
          const contentRaw = heading + ' ' + sectionMarker + ' ' + sectionBody;
          
          // Calculate offsets
          const sectionContentStart = contentRaw.indexOf(sectionBody);
          const clauseOffset = contentRaw.indexOf(clauseMarker);
          const citationOffset = contentRaw.indexOf(citation);
          
          // Build structure with clause (direct under section)
          const structure = {
            sections: [{
              dom_index: 0,
              section_number: sectionMarker,
              heading: heading,
              content_start: sectionContentStart,
              content_end: contentRaw.length,
              subsections: [],
              clauses: [{
                marker: clauseMarker,
                marker_offset: clauseOffset,
                content_start: clauseOffset,
                content_end: contentRaw.length
              }]
            }],
            metadata: { total_sections: 1 }
          };
          
          // Create reference
          const reference = { character_offset: citationOffset };
          
          // Anchor scope
          const scope = BDLawExtractor.anchorReferenceScope(reference, structure);
          
          // Verify clause is correctly identified
          return scope.section === sectionMarker && 
                 scope.clause === clauseMarker &&
                 scope.dom_section_index === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: anchorReferenceScope returns null scope when reference is outside all sections
   * Validates: Requirements 10.5, 10.6 - Set scope fields to null when undeterminable
   */
  it('should return null scope fields when reference is outside all sections', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        (sectionNum, citationYear, citationSerial) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          const heading = 'শিরোনাম';
          
          // Build content with citation BEFORE section
          const contentRaw = citation + ' প্রারম্ভ ' + heading + ' ' + sectionMarker + ' বিষয়বস্তু';
          
          // Calculate offsets - citation is at the beginning
          const citationOffset = 0;
          const sectionContentStart = contentRaw.indexOf(heading);
          
          // Build structure where section starts after citation
          const structure = {
            sections: [{
              dom_index: 0,
              section_number: sectionMarker,
              heading: heading,
              content_start: sectionContentStart,
              content_end: contentRaw.length,
              subsections: [],
              clauses: []
            }],
            metadata: { total_sections: 1 }
          };
          
          // Create reference at position before section
          const reference = { character_offset: citationOffset };
          
          // Anchor scope
          const scope = BDLawExtractor.anchorReferenceScope(reference, structure);
          
          // Verify all scope fields are null
          return scope.section === null && 
                 scope.subsection === null &&
                 scope.clause === null &&
                 scope.dom_section_index === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: anchorReferenceScope handles invalid inputs gracefully
   * Validates: Requirements 10.5, 10.6 - Handle edge cases
   */
  it('should return null scope for invalid inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant({}),
          fc.constant({ character_offset: -1 }),
          fc.constant({ character_offset: 'invalid' })
        ),
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant({}),
          fc.constant({ sections: null }),
          fc.constant({ sections: [] })
        ),
        (reference, structure) => {
          const scope = BDLawExtractor.anchorReferenceScope(reference, structure);
          
          // Should return object with null fields
          return scope !== null &&
                 scope.section === null &&
                 scope.subsection === null &&
                 scope.clause === null &&
                 scope.dom_section_index === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Scope section corresponds to structural element containing the offset
   * Validates: Requirements 10.1, 10.4 - Scope path matches structure
   */
  it('should return scope where section content range contains reference offset', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 10, maxLength: 50 }),
        (sectionNum, citationYear, citationSerial, bodyText) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const citation = createBengaliCitation(citationYear, citationSerial);
          
          // Build content
          const contentRaw = 'প্রারম্ভ ' + sectionMarker + ' ' + bodyText + ' ' + citation + ' শেষ';
          
          // Calculate offsets
          const sectionContentStart = contentRaw.indexOf(sectionMarker);
          const citationOffset = contentRaw.indexOf(citation);
          
          // Build structure
          const structure = {
            sections: [{
              dom_index: 0,
              section_number: sectionMarker,
              heading: null,
              content_start: sectionContentStart,
              content_end: contentRaw.length,
              subsections: [],
              clauses: []
            }],
            metadata: { total_sections: 1 }
          };
          
          // Create reference
          const reference = { character_offset: citationOffset };
          
          // Anchor scope
          const scope = BDLawExtractor.anchorReferenceScope(reference, structure);
          
          // If section is returned, verify offset is within section bounds
          if (scope.section !== null) {
            const section = structure.sections.find(s => s.section_number === scope.section);
            if (!section) return false;
            
            // Offset should be within section content range
            return citationOffset >= section.content_start && 
                   citationOffset < section.content_end;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple sections - reference anchored to correct section
   * Validates: Requirements 10.1, 10.4 - Correct section identification
   */
  it('should anchor reference to correct section when multiple sections exist', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 6, max: 10 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        (section1Num, section2Num, citationYear, citationSerial) => {
          const section1Marker = createSectionMarker(section1Num);
          const section2Marker = createSectionMarker(section2Num);
          const citation = createBengaliCitation(citationYear, citationSerial);
          
          // Build content with citation in second section
          const section1Body = 'প্রথম ধারার বিষয়বস্তু';
          const section2Body = 'দ্বিতীয় ধারার ' + citation + ' বিষয়বস্তু';
          const contentRaw = section1Marker + ' ' + section1Body + ' ' + section2Marker + ' ' + section2Body;
          
          // Calculate offsets
          const section1Start = 0;
          const section2Start = contentRaw.indexOf(section2Marker);
          const citationOffset = contentRaw.indexOf(citation);
          
          // Build structure with two sections
          const structure = {
            sections: [
              {
                dom_index: 0,
                section_number: section1Marker,
                heading: null,
                content_start: section1Start,
                content_end: section2Start,
                subsections: [],
                clauses: []
              },
              {
                dom_index: 1,
                section_number: section2Marker,
                heading: null,
                content_start: section2Start,
                content_end: contentRaw.length,
                subsections: [],
                clauses: []
              }
            ],
            metadata: { total_sections: 2 }
          };
          
          // Create reference
          const reference = { character_offset: citationOffset };
          
          // Anchor scope
          const scope = BDLawExtractor.anchorReferenceScope(reference, structure);
          
          // Verify reference is anchored to section 2
          return scope.section === section2Marker && scope.dom_section_index === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Nested clause within subsection - full scope path returned
   * Validates: Requirements 10.2, 10.3, 10.4 - Complete scope path
   */
  it('should return full scope path for reference in clause within subsection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 13 }),
        fc.integer({ min: 1950, max: 2020 }),
        fc.integer({ min: 1, max: 50 }),
        (sectionNum, subsectionNum, clauseIndex, citationYear, citationSerial) => {
          const sectionMarker = createSectionMarker(sectionNum);
          const subsectionMarker = createSubsectionMarker(subsectionNum);
          const clauseMarker = createClauseMarker(clauseIndex);
          const citation = createBengaliCitation(citationYear, citationSerial);
          
          // Build nested content: section > subsection > clause > citation
          const clauseContent = clauseMarker + ' ' + citation + ' শেষ';
          const subsectionContent = subsectionMarker + ' ' + clauseContent;
          const sectionBody = 'প্রারম্ভ ' + subsectionContent;
          const contentRaw = sectionMarker + ' ' + sectionBody;
          
          // Calculate offsets
          const sectionContentStart = contentRaw.indexOf(sectionBody);
          const subsectionOffset = contentRaw.indexOf(subsectionMarker);
          const clauseOffset = contentRaw.indexOf(clauseMarker);
          const citationOffset = contentRaw.indexOf(citation);
          
          // Build structure with nested elements
          const structure = {
            sections: [{
              dom_index: 0,
              section_number: sectionMarker,
              heading: null,
              content_start: sectionContentStart,
              content_end: contentRaw.length,
              subsections: [{
                marker: subsectionMarker,
                marker_offset: subsectionOffset,
                content_start: subsectionOffset,
                content_end: contentRaw.length,
                clauses: [{
                  marker: clauseMarker,
                  marker_offset: clauseOffset,
                  content_start: clauseOffset,
                  content_end: contentRaw.length
                }]
              }],
              clauses: []
            }],
            metadata: { total_sections: 1 }
          };
          
          // Create reference
          const reference = { character_offset: citationOffset };
          
          // Anchor scope
          const scope = BDLawExtractor.anchorReferenceScope(reference, structure);
          
          // Verify full scope path
          return scope.section === sectionMarker && 
                 scope.subsection === subsectionMarker &&
                 scope.clause === clauseMarker &&
                 scope.dom_section_index === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Deterministic - same inputs produce same scope
   * Validates: Requirements 10.4 - Consistent scope determination
   */
  it('should produce deterministic scope for same inputs', () => {
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
          
          // Build structure
          const structure = {
            sections: [{
              dom_index: 0,
              section_number: sectionMarker,
              heading: null,
              content_start: 0,
              content_end: contentRaw.length,
              subsections: [],
              clauses: []
            }],
            metadata: { total_sections: 1 }
          };
          
          // Create reference
          const reference = { character_offset: citationOffset };
          
          // Anchor scope twice
          const scope1 = BDLawExtractor.anchorReferenceScope(reference, structure);
          const scope2 = BDLawExtractor.anchorReferenceScope(reference, structure);
          
          // Verify identical results
          return scope1.section === scope2.section &&
                 scope1.subsection === scope2.subsection &&
                 scope1.clause === scope2.clause &&
                 scope1.dom_section_index === scope2.dom_section_index;
        }
      ),
      { numRuns: 100 }
    );
  });
});
