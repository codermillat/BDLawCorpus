/**
 * Property-Based Tests for Clause Nesting Correctness
 * 
 * Feature: legal-structure-derivation, Property 5: Clause Nesting Correctness
 * Validates: Requirements 5.2, 5.5
 * 
 * For any clause element in the structure, its marker_offset SHALL fall within
 * the content_start and content_end range of its parent section or subsection.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 5: Clause Nesting Correctness', () => {
  // Bengali letters for clauses: ক-ঢ (U+0995 to U+09A2)
  const BENGALI_CLAUSE_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ'];
  // Bengali numerals: ০-৯ (U+09E6 to U+09EF)
  const BENGALI_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  // Bengali danda: ৷ (U+09F7)
  const DANDA = '৷';

  /**
   * Helper to generate a Bengali numeral string from a number
   */
  function toBengaliNumeral(num) {
    return String(num).split('').map(d => BENGALI_NUMERALS[parseInt(d)]).join('');
  }

  /**
   * Helper to create a clause marker from index (0-13 maps to ক-ঢ)
   */
  function createClauseMarker(index) {
    const letterIndex = index % BENGALI_CLAUSE_LETTERS.length;
    return '(' + BENGALI_CLAUSE_LETTERS[letterIndex] + ')';
  }

  /**
   * Helper to create a subsection marker
   */
  function createSubsectionMarker(num) {
    return '(' + toBengaliNumeral(num) + ')';
  }

  /**
   * Property: detectClausesInContent returns clauses in document order
   * Validates: Requirements 5.5 - Preserve sequential order of clauses
   */
  it('should return clauses in document order (ascending relativeOffset)', () => {
    fc.assert(
      fc.property(
        // Generate array of clause indices (0-13)
        fc.array(fc.integer({ min: 0, max: 13 }), { minLength: 2, maxLength: 10 }),
        // Generate separator text between clauses
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n'), { minLength: 1, maxLength: 20 }),
        (clauseIndices, separator) => {
          // Build content with clauses in order
          const markers = clauseIndices.map(i => createClauseMarker(i));
          const content = markers.join(separator);
          
          const result = BDLawExtractor.detectClausesInContent(content);
          
          // Should find all clauses
          if (result.length !== markers.length) return false;
          
          // relativeOffset values should be strictly ascending
          for (let i = 1; i < result.length; i++) {
            if (result[i].relativeOffset <= result[i - 1].relativeOffset) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectClausesInContent records marker text verbatim
   * Validates: Requirements 5.3 - Record exact marker text verbatim
   */
  it('should record clause marker text verbatim', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 13 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' '), { minLength: 0, maxLength: 20 }),
        fc.stringOf(fc.constantFrom('ঝ', 'ঞ', 'ট', ' '), { minLength: 0, maxLength: 20 }),
        (clauseIndex, prefix, suffix) => {
          const marker = createClauseMarker(clauseIndex);
          const content = prefix + marker + suffix;
          
          const result = BDLawExtractor.detectClausesInContent(content);
          
          // Should find exactly one clause
          if (result.length !== 1) return false;
          
          // Marker should be recorded verbatim
          return result[0].marker === marker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectClausesInContent records correct relative offset
   * Validates: Requirements 5.4 - Record character offset where marker begins
   */
  it('should record correct relative offset within content', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 13 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' '), { minLength: 0, maxLength: 30 }),
        fc.stringOf(fc.constantFrom('ঝ', 'ঞ', 'ট', ' '), { minLength: 0, maxLength: 30 }),
        (clauseIndex, prefix, suffix) => {
          const marker = createClauseMarker(clauseIndex);
          const content = prefix + marker + suffix;
          
          const result = BDLawExtractor.detectClausesInContent(content);
          
          // Should find exactly one clause
          if (result.length !== 1) return false;
          
          // Offset should point to the marker in content
          const offset = result[0].relativeOffset;
          const extracted = content.substring(offset, offset + marker.length);
          
          return extracted === marker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Clause marker_offset falls within parent section's content range
   * Validates: Requirements 5.2 - Associate each clause with its parent section
   * 
   * This is the core property: for any clause in the structure tree,
   * its marker_offset must be >= parent section's content_start
   * and < parent section's content_end
   */
  it('should ensure clause marker_offset falls within parent section content range', () => {
    fc.assert(
      fc.property(
        // Generate section number
        fc.integer({ min: 1, max: 50 }),
        // Generate clause indices
        fc.array(fc.integer({ min: 0, max: 13 }), { minLength: 1, maxLength: 5 }),
        // Generate section heading
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ'), { minLength: 1, maxLength: 15 }),
        // Generate body text between clauses
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' ', '\n'), { minLength: 1, maxLength: 20 }),
        (sectionNum, clauseIndices, heading, bodyText) => {
          // Build section content with clauses
          const sectionMarker = toBengaliNumeral(sectionNum) + DANDA;
          const clauseMarkers = clauseIndices.map(i => createClauseMarker(i));
          const sectionBody = clauseMarkers.join(bodyText);
          
          // Build full content_raw
          const contentRaw = heading + ' ' + sectionMarker + ' ' + sectionBody;
          
          // Detect clauses
          const clauses = BDLawExtractor.detectClausesInContent(sectionBody);
          
          // Build a mock section structure
          const sectionContentStart = contentRaw.indexOf(sectionBody);
          const sectionContentEnd = contentRaw.length;
          
          // For each clause, verify its offset falls within section bounds
          for (const clause of clauses) {
            // Calculate absolute offset in content_raw
            const absoluteOffset = sectionContentStart + clause.relativeOffset;
            
            // Verify offset is within section content range
            if (absoluteOffset < sectionContentStart) return false;
            if (absoluteOffset >= sectionContentEnd) return false;
            
            // Verify the marker can be extracted at that offset
            const extracted = contentRaw.substring(absoluteOffset, absoluteOffset + clause.marker.length);
            if (extracted !== clause.marker) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All Bengali clause letters (ক-ঢ) are correctly detected
   * Validates: Requirements 5.1 - Detect Bengali letter parentheses markers
   */
  it('should correctly detect all Bengali clause letters (ক-ঢ)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 13 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' '), { minLength: 0, maxLength: 20 }),
        (clauseIndex, prefix) => {
          const marker = createClauseMarker(clauseIndex);
          const content = prefix + marker + ' বিষয়বস্তু';
          
          const result = BDLawExtractor.detectClausesInContent(content);
          
          // Should find exactly one clause
          if (result.length !== 1) return false;
          
          // Marker should match the expected clause marker
          return result[0].marker === marker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content returns empty array
   * Validates: Requirements 5.1 - Handle edge cases gracefully
   */
  it('should return empty array for empty or null content', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('   ') // whitespace only
        ),
        (content) => {
          const result = BDLawExtractor.detectClausesInContent(content);
          return Array.isArray(result) && result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without clause markers returns empty array
   * Validates: Requirements 5.1 - Only detect valid clause patterns
   */
  it('should return empty array when no clause markers present', () => {
    fc.assert(
      fc.property(
        // Generate content without parentheses
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' ', '\n', '।'), { minLength: 1, maxLength: 100 }),
        (content) => {
          const result = BDLawExtractor.detectClausesInContent(content);
          return Array.isArray(result) && result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Clause markers do not normalize Bengali letters
   * Validates: Requirements 5.6 - Do not normalize clause letters
   */
  it('should not normalize Bengali letters to English letters', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 13 }),
        (clauseIndex) => {
          const bengaliMarker = createClauseMarker(clauseIndex);
          const content = 'প্রিফিক্স ' + bengaliMarker + ' সাফিক্স';
          
          const result = BDLawExtractor.detectClausesInContent(content);
          
          if (result.length !== 1) return false;
          
          // Marker should contain Bengali letters, not English
          const marker = result[0].marker;
          const hasEnglishLetter = /[a-zA-Z]/.test(marker);
          const hasBengaliLetter = /[ক-ঢ]/.test(marker);
          
          return !hasEnglishLetter && hasBengaliLetter;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: buildStructureTree places clauses within correct section bounds
   * Validates: Requirements 5.2, 5.5 - Clause nesting in structure tree
   */
  it('should place clauses within correct section content bounds in structure tree', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.array(fc.integer({ min: 0, max: 13 }), { minLength: 1, maxLength: 3 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ'), { minLength: 1, maxLength: 10 }),
        (sectionNum, clauseIndices, bodyText) => {
          // Build section with clauses
          const sectionMarker = toBengaliNumeral(sectionNum) + DANDA;
          const heading = 'শিরোনাম';
          const clauseMarkers = clauseIndices.map(i => createClauseMarker(i));
          const sectionBody = clauseMarkers.join(' ' + bodyText + ' ');
          
          // Build content_raw
          const contentRaw = heading + ' ' + sectionMarker + ' ' + sectionBody;
          
          // Detect clauses from body
          const detectedClauses = BDLawExtractor.detectClausesInContent(sectionBody);
          
          // Build mock section data
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: heading,
            body_text: sectionBody,
            subsections: [],
            clauses: detectedClauses.map(clause => ({
              marker: clause.marker,
              relativeOffset: clause.relativeOffset
            }))
          }];
          
          // Build structure tree
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Verify each clause's marker_offset is within section bounds
          const section = structure.sections[0];
          for (const clause of section.clauses) {
            const markerOffset = clause.marker_offset;
            
            // marker_offset should be >= 0 (valid)
            if (markerOffset < 0) return false;
            
            // marker_offset should be >= section content_start
            if (section.content_start >= 0 && markerOffset < section.content_start) {
              return false;
            }
            
            // marker_offset should be < section content_end
            if (section.content_end >= 0 && markerOffset >= section.content_end) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Clauses preserve their relative order within parent section
   * Validates: Requirements 5.5 - Preserve sequential order within each section
   * 
   * Note: Uses unique clause indices to avoid duplicate marker offset issues
   */
  it('should preserve clause order within parent section in structure tree', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        // Generate unique clause indices using uniqueArray
        fc.uniqueArray(fc.integer({ min: 0, max: 13 }), { minLength: 2, maxLength: 5 }),
        (sectionNum, clauseIndices) => {
          // Build section with multiple clauses (unique indices)
          const sectionMarker = toBengaliNumeral(sectionNum) + DANDA;
          const clauseMarkers = clauseIndices.map(i => createClauseMarker(i));
          const sectionBody = clauseMarkers.join(' বিষয়বস্তু ');
          const contentRaw = 'শিরোনাম ' + sectionMarker + ' ' + sectionBody;
          
          // Detect clauses
          const detectedClauses = BDLawExtractor.detectClausesInContent(sectionBody);
          
          // Build structure
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: 'শিরোনাম',
            body_text: sectionBody,
            subsections: [],
            clauses: detectedClauses.map(clause => ({
              marker: clause.marker,
              relativeOffset: clause.relativeOffset
            }))
          }];
          
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Verify clauses are in ascending marker_offset order
          const clauses = structure.sections[0].clauses;
          for (let i = 1; i < clauses.length; i++) {
            if (clauses[i].marker_offset <= clauses[i - 1].marker_offset) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Clauses nested within subsections have valid offsets
   * Validates: Requirements 5.2 - Clause nesting within subsections
   * 
   * For clauses nested within subsections, the clause's marker_offset
   * should fall within the subsection's content range.
   */
  it('should place clauses within correct subsection content bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        fc.array(fc.integer({ min: 0, max: 13 }), { minLength: 1, maxLength: 3 }),
        (sectionNum, subsectionNum, clauseIndices) => {
          // Build subsection with clauses
          const sectionMarker = toBengaliNumeral(sectionNum) + DANDA;
          const subsectionMarker = createSubsectionMarker(subsectionNum);
          const clauseMarkers = clauseIndices.map(i => createClauseMarker(i));
          const clauseContent = clauseMarkers.join(' বিষয় ');
          
          // Build section body with subsection containing clauses
          const sectionBody = subsectionMarker + ' ' + clauseContent;
          const contentRaw = 'শিরোনাম ' + sectionMarker + ' ' + sectionBody;
          
          // Detect clauses from clause content
          const detectedClauses = BDLawExtractor.detectClausesInContent(clauseContent);
          
          // Build structure with nested clauses in subsection
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: 'শিরোনাম',
            body_text: sectionBody,
            subsections: [{
              marker: subsectionMarker,
              relativeOffset: 0,
              clauses: detectedClauses.map(clause => ({
                marker: clause.marker,
                relativeOffset: clause.relativeOffset
              }))
            }],
            clauses: []
          }];
          
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Verify each nested clause's marker_offset is valid
          const section = structure.sections[0];
          const subsection = section.subsections[0];
          
          for (const clause of subsection.clauses) {
            const markerOffset = clause.marker_offset;
            
            // marker_offset should be >= 0 (valid)
            if (markerOffset < 0) return false;
            
            // marker_offset should be >= subsection marker_offset
            if (subsection.marker_offset >= 0 && markerOffset < subsection.marker_offset) {
              return false;
            }
            
            // marker_offset should be within section bounds
            if (section.content_start >= 0 && markerOffset < section.content_start) {
              return false;
            }
            if (section.content_end >= 0 && markerOffset >= section.content_end) {
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
