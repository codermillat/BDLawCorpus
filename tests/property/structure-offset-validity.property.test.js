/**
 * Property-Based Tests for Structure Offset Validity
 * 
 * Feature: legal-structure-derivation, Property 2: Structure Offset Validity
 * Validates: Requirements 2.4, 3.4, 4.4, 5.4, 8.3, 8.5
 * 
 * For any structural element in the structure output, the character_offset SHALL be a valid
 * index into content_raw, and content_raw.substring(offset, offset + marker.length) SHALL
 * equal the recorded marker text.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 2: Structure Offset Validity', () => {
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
   * Property: calculateOffsetInContentRaw returns valid offset for text that exists in content_raw
   * Validates: Requirements 2.4, 8.3
   */
  it('should return valid offset when text exists in content_raw', () => {
    fc.assert(
      fc.property(
        // Generate random prefix text
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' ', '\n'), { minLength: 0, maxLength: 50 }),
        // Generate the target text to find
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ'), { minLength: 1, maxLength: 20 }),
        // Generate random suffix text
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', 'ঝ', ' ', '\n'), { minLength: 0, maxLength: 50 }),
        (prefix, target, suffix) => {
          const contentRaw = prefix + target + suffix;
          const offset = BDLawExtractor.calculateOffsetInContentRaw(target, contentRaw);
          
          // Offset should be valid (>= 0)
          if (offset < 0) return false;
          
          // Offset should be within bounds
          if (offset + target.length > contentRaw.length) return false;
          
          // Substring at offset should equal target
          const extracted = contentRaw.substring(offset, offset + target.length);
          return extracted === target;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: calculateOffsetInContentRaw returns -1 for text that does not exist
   * Validates: Requirements 8.3, 8.5
   */
  it('should return -1 when text does not exist in content_raw', () => {
    fc.assert(
      fc.property(
        // Generate content_raw with only Bengali letters
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ'), { minLength: 1, maxLength: 50 }),
        // Generate target with only English letters (guaranteed not to be in content_raw)
        fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 10 }),
        (contentRaw, target) => {
          const offset = BDLawExtractor.calculateOffsetInContentRaw(target, contentRaw);
          return offset === -1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section number offsets are valid indices into content_raw
   * Validates: Requirements 2.4 - Section number offset validity
   */
  it('should return valid offset for Bengali section numbers (numeral+danda)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n'), { minLength: 0, maxLength: 30 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' ', '\n'), { minLength: 0, maxLength: 30 }),
        (sectionNum, prefix, suffix) => {
          const sectionMarker = toBengaliNumeral(sectionNum) + DANDA;
          const contentRaw = prefix + sectionMarker + suffix;
          
          const offset = BDLawExtractor.calculateOffsetInContentRaw(sectionMarker, contentRaw);
          
          // Offset should be valid
          if (offset < 0) return false;
          
          // Extracted text should match section marker
          const extracted = contentRaw.substring(offset, offset + sectionMarker.length);
          return extracted === sectionMarker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Subsection marker offsets are valid indices into content_raw
   * Validates: Requirements 4.4 - Subsection marker offset validity
   */
  it('should return valid offset for Bengali subsection markers ((১), (২), etc.)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n'), { minLength: 0, maxLength: 30 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' ', '\n'), { minLength: 0, maxLength: 30 }),
        (subsectionNum, prefix, suffix) => {
          const subsectionMarker = '(' + toBengaliNumeral(subsectionNum) + ')';
          const contentRaw = prefix + subsectionMarker + suffix;
          
          const offset = BDLawExtractor.calculateOffsetInContentRaw(subsectionMarker, contentRaw);
          
          // Offset should be valid
          if (offset < 0) return false;
          
          // Extracted text should match subsection marker
          const extracted = contentRaw.substring(offset, offset + subsectionMarker.length);
          return extracted === subsectionMarker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Clause marker offsets are valid indices into content_raw
   * Validates: Requirements 5.4 - Clause marker offset validity
   */
  it('should return valid offset for Bengali clause markers ((ক), (খ), etc.)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n'), { minLength: 0, maxLength: 30 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', ' ', '\n'), { minLength: 0, maxLength: 30 }),
        (letterIndex, prefix, suffix) => {
          const clauseMarker = '(' + BENGALI_LETTERS[letterIndex] + ')';
          const contentRaw = prefix + clauseMarker + suffix;
          
          const offset = BDLawExtractor.calculateOffsetInContentRaw(clauseMarker, contentRaw);
          
          // Offset should be valid
          if (offset < 0) return false;
          
          // Extracted text should match clause marker
          const extracted = contentRaw.substring(offset, offset + clauseMarker.length);
          return extracted === clauseMarker;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: searchStart parameter correctly limits search to positions after it
   * Validates: Requirements 8.3 - Offset calculation with search start
   */
  it('should respect searchStart parameter and find text after that position', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ'), { minLength: 1, maxLength: 10 }),
        fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ'), { minLength: 1, maxLength: 10 }),
        (target, separator) => {
          // Create content with target appearing twice
          const contentRaw = target + separator + target;
          
          // First occurrence
          const firstOffset = BDLawExtractor.calculateOffsetInContentRaw(target, contentRaw, 0);
          
          // Second occurrence (search after first)
          const secondOffset = BDLawExtractor.calculateOffsetInContentRaw(
            target, 
            contentRaw, 
            firstOffset + 1
          );
          
          // Both should be valid
          if (firstOffset < 0 || secondOffset < 0) return false;
          
          // Second should be after first
          if (secondOffset <= firstOffset) return false;
          
          // Both should extract the target correctly
          const firstExtracted = contentRaw.substring(firstOffset, firstOffset + target.length);
          const secondExtracted = contentRaw.substring(secondOffset, secondOffset + target.length);
          
          return firstExtracted === target && secondExtracted === target;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null inputs return -1
   * Validates: Requirements 8.5 - Error handling for invalid inputs
   */
  it('should return -1 for empty or null inputs', () => {
    const validContent = 'কিছু বাংলা টেক্সট';
    const validText = 'বাংলা';
    
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ text: '', contentRaw: validContent }),
          fc.constant({ text: null, contentRaw: validContent }),
          fc.constant({ text: undefined, contentRaw: validContent }),
          fc.constant({ text: validText, contentRaw: '' }),
          fc.constant({ text: validText, contentRaw: null }),
          fc.constant({ text: validText, contentRaw: undefined }),
          fc.constant({ text: '   ', contentRaw: validContent }) // whitespace-only text
        ),
        (input) => {
          const offset = BDLawExtractor.calculateOffsetInContentRaw(input.text, input.contentRaw);
          return offset === -1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Offset + marker length never exceeds content_raw length
   * Validates: Requirements 8.3, 8.5 - Offset bounds validity
   */
  it('should ensure offset + marker.length never exceeds content_raw.length', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' '), { minLength: 5, maxLength: 100 }),
        fc.integer({ min: 1, max: 10 }),
        (contentRaw, markerLength) => {
          // Extract a substring from content_raw as the marker
          const startPos = Math.floor(Math.random() * Math.max(1, contentRaw.length - markerLength));
          const marker = contentRaw.substring(startPos, startPos + markerLength).trim();
          
          if (!marker) return true; // Skip if marker is empty after trim
          
          const offset = BDLawExtractor.calculateOffsetInContentRaw(marker, contentRaw);
          
          // If found, offset + marker.length should not exceed content_raw.length
          if (offset >= 0) {
            return offset + marker.length <= contentRaw.length;
          }
          
          return true; // -1 is acceptable if not found
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Trimmed text matching - leading/trailing whitespace in text is handled
   * Validates: Requirements 8.3 - Unicode/whitespace handling
   */
  it('should handle leading/trailing whitespace in text by trimming', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ'), { minLength: 1, maxLength: 10 }),
        fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 3 }),
        fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 3 }),
        (core, leadingWs, trailingWs) => {
          const contentRaw = 'প্রিফিক্স ' + core + ' সাফিক্স';
          const textWithWhitespace = leadingWs + core + trailingWs;
          
          const offset = BDLawExtractor.calculateOffsetInContentRaw(textWithWhitespace, contentRaw);
          
          // Should find the trimmed text
          if (offset < 0) return false;
          
          // Extracted should match the core (trimmed) text
          const extracted = contentRaw.substring(offset, offset + core.length);
          return extracted === core;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple structural elements in same content_raw all have valid offsets
   * Validates: Requirements 2.4, 4.4, 5.4 - Multiple element offset validity
   */
  it('should return valid offsets for multiple structural elements in same content', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 4 }),
        (sectionNum, subsectionNum, clauseIndex) => {
          // Build content with section, subsection, and clause
          const sectionMarker = toBengaliNumeral(sectionNum) + DANDA;
          const subsectionMarker = '(' + toBengaliNumeral(subsectionNum) + ')';
          const clauseMarker = '(' + BENGALI_LETTERS[clauseIndex] + ')';
          
          const contentRaw = `${sectionMarker} শিরোনাম ${subsectionMarker} বিষয়বস্তু ${clauseMarker} ধারা`;
          
          // All three should have valid offsets
          const sectionOffset = BDLawExtractor.calculateOffsetInContentRaw(sectionMarker, contentRaw);
          const subsectionOffset = BDLawExtractor.calculateOffsetInContentRaw(subsectionMarker, contentRaw);
          const clauseOffset = BDLawExtractor.calculateOffsetInContentRaw(clauseMarker, contentRaw);
          
          // All offsets should be valid
          if (sectionOffset < 0 || subsectionOffset < 0 || clauseOffset < 0) return false;
          
          // All extractions should match
          const extractedSection = contentRaw.substring(sectionOffset, sectionOffset + sectionMarker.length);
          const extractedSubsection = contentRaw.substring(subsectionOffset, subsectionOffset + subsectionMarker.length);
          const extractedClause = contentRaw.substring(clauseOffset, clauseOffset + clauseMarker.length);
          
          return (
            extractedSection === sectionMarker &&
            extractedSubsection === subsectionMarker &&
            extractedClause === clauseMarker
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
