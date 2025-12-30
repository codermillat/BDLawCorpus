/**
 * Property-Based Tests for Subsection Nesting Correctness
 * 
 * Feature: legal-structure-derivation, Property 4: Subsection Nesting Correctness
 * Validates: Requirements 4.2, 4.5
 * 
 * For any subsection element in the structure, its marker_offset SHALL fall within
 * the content_start and content_end range of its parent section.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 4: Subsection Nesting Correctness', () => {
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
   * Helper to create a subsection marker
   */
  function createSubsectionMarker(num) {
    return '(' + toBengaliNumeral(num) + ')';
  }

  /**
   * Property: detectSubsectionsInContent returns subsections in document order
   * Validates: Requirements 4.5 - Preserve sequential order of subsections
   */
  it('should return subsections in document order (ascending relativeOffset)', () => {
    fc.assert(
      fc.property(
        // Generate array of subsection numbers (1-20)
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 2, maxLength: 10 }),
        // Generate separator text between subsections
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n'), { minLength: 1, maxLength: 20 }),
        (subsectionNums, separator) => {
          // Build content with subsections in order
          const markers = subsectionNums.map(n => createSubsectionMarker(n));
          const content = markers.join(separator);
          
          const result = BDLawExtractor.detectSubsectionsInContent(content);
          
          // Should find all subsections
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
   * Property: detectSubsectionsInContent records marker text verbatim
   * Validates: Requirements 4.3 - Record exact marker text verbatim
   */
  it('should record subsection marker text verbatim', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 20 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' '), { minLength: 0, maxLength: 20 }),
        (subsectionNum, prefix, suffix) => {
          const marker = createSubsectionMarker(subsectionNum);
          const content = prefix + marker + suffix;
          
          const result = BDLawExtractor.detectSubsectionsInContent(content);
          
          // Should find exactly one subsection
          if (result.length !== 1) return false;
          
          // Marker should be recorded verbatim
          return result[0].marker === marker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectSubsectionsInContent records correct relative offset
   * Validates: Requirements 4.4 - Record character offset where marker begins
   */
  it('should record correct relative offset within section content', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 30 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' '), { minLength: 0, maxLength: 30 }),
        (subsectionNum, prefix, suffix) => {
          const marker = createSubsectionMarker(subsectionNum);
          const content = prefix + marker + suffix;
          
          const result = BDLawExtractor.detectSubsectionsInContent(content);
          
          // Should find exactly one subsection
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
   * Property: Subsection marker_offset falls within parent section's content range
   * Validates: Requirements 4.2 - Associate each subsection with its parent section
   * 
   * This is the core property: for any subsection in the structure tree,
   * its marker_offset must be >= parent section's content_start
   * and < parent section's content_end
   */
  it('should ensure subsection marker_offset falls within parent section content range', () => {
    fc.assert(
      fc.property(
        // Generate section number
        fc.integer({ min: 1, max: 50 }),
        // Generate subsection numbers
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 5 }),
        // Generate section heading
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ'), { minLength: 1, maxLength: 15 }),
        // Generate body text between subsections
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' ', '\n'), { minLength: 1, maxLength: 20 }),
        (sectionNum, subsectionNums, heading, bodyText) => {
          // Build section content with subsections
          const sectionMarker = toBengaliNumeral(sectionNum) + DANDA;
          const subsectionMarkers = subsectionNums.map(n => createSubsectionMarker(n));
          const sectionBody = subsectionMarkers.join(bodyText);
          
          // Build full content_raw
          const contentRaw = heading + ' ' + sectionMarker + ' ' + sectionBody;
          
          // Detect subsections
          const subsections = BDLawExtractor.detectSubsectionsInContent(sectionBody);
          
          // Build a mock section structure
          const sectionContentStart = contentRaw.indexOf(sectionBody);
          const sectionContentEnd = contentRaw.length;
          
          // For each subsection, verify its offset falls within section bounds
          for (const sub of subsections) {
            // Calculate absolute offset in content_raw
            const absoluteOffset = sectionContentStart + sub.relativeOffset;
            
            // Verify offset is within section content range
            if (absoluteOffset < sectionContentStart) return false;
            if (absoluteOffset >= sectionContentEnd) return false;
            
            // Verify the marker can be extracted at that offset
            const extracted = contentRaw.substring(absoluteOffset, absoluteOffset + sub.marker.length);
            if (extracted !== sub.marker) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multi-digit subsection numbers are correctly detected
   * Validates: Requirements 4.1 - Detect Bengali numeral parentheses markers
   */
  it('should correctly detect multi-digit subsection markers ((১০), (১৫), etc.)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 99 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 20 }),
        (subsectionNum, prefix) => {
          const marker = createSubsectionMarker(subsectionNum);
          const content = prefix + marker + ' বিষয়বস্তু';
          
          const result = BDLawExtractor.detectSubsectionsInContent(content);
          
          // Should find exactly one subsection
          if (result.length !== 1) return false;
          
          // Marker should match the multi-digit marker
          return result[0].marker === marker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content returns empty array
   * Validates: Requirements 4.1 - Handle edge cases gracefully
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
          const result = BDLawExtractor.detectSubsectionsInContent(content);
          return Array.isArray(result) && result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without subsection markers returns empty array
   * Validates: Requirements 4.1 - Only detect valid subsection patterns
   */
  it('should return empty array when no subsection markers present', () => {
    fc.assert(
      fc.property(
        // Generate content without parentheses
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' ', '\n', '।'), { minLength: 1, maxLength: 100 }),
        (content) => {
          const result = BDLawExtractor.detectSubsectionsInContent(content);
          return Array.isArray(result) && result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Subsection markers do not normalize Bengali numerals
   * Validates: Requirements 4.6 - Do not renumber or normalize subsection markers
   */
  it('should not normalize Bengali numerals to Arabic numerals', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        (num) => {
          const bengaliMarker = createSubsectionMarker(num);
          const content = 'প্রিফিক্স ' + bengaliMarker + ' সাফিক্স';
          
          const result = BDLawExtractor.detectSubsectionsInContent(content);
          
          if (result.length !== 1) return false;
          
          // Marker should contain Bengali numerals, not Arabic
          const marker = result[0].marker;
          const hasArabicNumeral = /[0-9]/.test(marker);
          const hasBengaliNumeral = /[০-৯]/.test(marker);
          
          return !hasArabicNumeral && hasBengaliNumeral;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: buildStructureTree places subsections within correct section bounds
   * Validates: Requirements 4.2, 4.5 - Subsection nesting in structure tree
   */
  it('should place subsections within correct section content bounds in structure tree', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 3 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ'), { minLength: 1, maxLength: 10 }),
        (sectionNum, subsectionNums, bodyText) => {
          // Build section with subsections
          const sectionMarker = toBengaliNumeral(sectionNum) + DANDA;
          const heading = 'শিরোনাম';
          const subsectionMarkers = subsectionNums.map(n => createSubsectionMarker(n));
          const sectionBody = subsectionMarkers.join(' ' + bodyText + ' ');
          
          // Build content_raw
          const contentRaw = heading + ' ' + sectionMarker + ' ' + sectionBody;
          
          // Detect subsections from body
          const detectedSubsections = BDLawExtractor.detectSubsectionsInContent(sectionBody);
          
          // Build mock section data
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: heading,
            body_text: sectionBody,
            subsections: detectedSubsections.map(sub => ({
              marker: sub.marker,
              relativeOffset: sub.relativeOffset,
              clauses: []
            })),
            clauses: []
          }];
          
          // Build structure tree
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Verify each subsection's marker_offset is within section bounds
          const section = structure.sections[0];
          for (const subsection of section.subsections) {
            const markerOffset = subsection.marker_offset;
            
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
   * Property: Subsections preserve their relative order within parent section
   * Validates: Requirements 4.5 - Preserve sequential order within each section
   * 
   * Note: Uses unique subsection numbers to avoid duplicate marker offset issues
   * when the same marker appears multiple times in content_raw
   */
  it('should preserve subsection order within parent section in structure tree', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        // Generate unique subsection numbers using uniqueArray
        fc.uniqueArray(fc.integer({ min: 1, max: 20 }), { minLength: 2, maxLength: 5 }),
        (sectionNum, subsectionNums) => {
          // Build section with multiple subsections (unique numbers)
          const sectionMarker = toBengaliNumeral(sectionNum) + DANDA;
          const subsectionMarkers = subsectionNums.map(n => createSubsectionMarker(n));
          const sectionBody = subsectionMarkers.join(' বিষয়বস্তু ');
          const contentRaw = 'শিরোনাম ' + sectionMarker + ' ' + sectionBody;
          
          // Detect subsections
          const detectedSubsections = BDLawExtractor.detectSubsectionsInContent(sectionBody);
          
          // Build structure
          const sections = [{
            dom_index: 0,
            section_number: sectionMarker,
            heading: 'শিরোনাম',
            body_text: sectionBody,
            subsections: detectedSubsections.map(sub => ({
              marker: sub.marker,
              relativeOffset: sub.relativeOffset,
              clauses: []
            })),
            clauses: []
          }];
          
          const structure = BDLawExtractor.buildStructureTree({
            preamble: null,
            enactment: null,
            sections: sections,
            contentRaw: contentRaw
          });
          
          // Verify subsections are in ascending marker_offset order
          const subsections = structure.sections[0].subsections;
          for (let i = 1; i < subsections.length; i++) {
            if (subsections[i].marker_offset <= subsections[i - 1].marker_offset) {
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
