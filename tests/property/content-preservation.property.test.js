/**
 * Property-Based Tests for Content Preservation
 * 
 * Feature: bdlawcorpus-mode, Property 8: Content Preservation
 * Validates: Requirements 9.4, 9.5
 * 
 * For any extracted legal text, the content field in the export SHALL be
 * byte-identical to the source text (no modification, summarization, or restructuring).
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

// Mock DOM for testing
class MockElement {
  constructor(textContent) {
    this.textContent = textContent;
  }
}

class MockDocument {
  constructor(elements = {}) {
    this.elements = elements;
  }

  querySelector(selector) {
    return this.elements[selector] || null;
  }

  querySelectorAll(selector) {
    const element = this.elements[selector];
    if (element) {
      return [element];
    }
    return [];
  }
}

describe('Property 8: Content Preservation', () => {
  /**
   * Property: Extracted content should preserve original Bengali text exactly
   */
  it('should preserve Bengali text exactly as provided in the DOM', () => {
    // Generate random Bengali legal text
    const bengaliText = fc.stringOf(
      fc.constantFrom(
        'ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ',
        'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন',
        'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ',
        'স', 'হ', 'ড়', 'ঢ়', 'য়', 'া', 'ি', 'ী', 'ু', 'ূ',
        'ে', 'ৈ', 'ো', 'ৌ', '্', 'ং', 'ঃ', 'ঁ',
        ' ', '\n', '।', '০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'
      ),
      { minLength: 1, maxLength: 200 }
    );

    fc.assert(
      fc.property(
        bengaliText,
        (originalText) => {
          // Create a mock document with the text in #lawContent
          const mockDoc = new MockDocument({
            '#lawContent': new MockElement(originalText)
          });

          const result = BDLawExtractor.extractActContent(mockDoc);
          
          // Content should be trimmed but otherwise identical
          return result.content === originalText.trim();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section markers in content should not be modified or removed
   */
  it('should preserve section markers in extracted content', () => {
    const SECTION_MARKERS = ['ধারা', 'অধ্যায়', 'তফসিল'];
    
    const textWithMarkers = fc.array(
      fc.tuple(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '।'), { minLength: 0, maxLength: 20 }),
        fc.constantFrom(...SECTION_MARKERS)
      ),
      { minLength: 1, maxLength: 10 }
    );

    fc.assert(
      fc.property(
        textWithMarkers,
        (parts) => {
          const originalText = parts.map(([prefix, marker]) => prefix + marker).join(' ');
          
          const mockDoc = new MockDocument({
            '#lawContent': new MockElement(originalText)
          });

          const result = BDLawExtractor.extractActContent(mockDoc);
          
          // All markers should still be present in the extracted content
          return SECTION_MARKERS.every(marker => {
            const originalCount = (originalText.match(new RegExp(marker, 'g')) || []).length;
            const extractedCount = (result.content.match(new RegExp(marker, 'g')) || []).length;
            return originalCount === extractedCount;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Whitespace structure should be preserved (except leading/trailing trim)
   */
  it('should preserve internal whitespace structure', () => {
    const textWithWhitespace = fc.tuple(
      fc.stringOf(fc.constantFrom('ক', 'খ', 'গ'), { minLength: 1, maxLength: 10 }),
      fc.stringOf(fc.constantFrom(' ', '\n', '\t'), { minLength: 1, maxLength: 5 }),
      fc.stringOf(fc.constantFrom('ক', 'খ', 'গ'), { minLength: 1, maxLength: 10 })
    );

    fc.assert(
      fc.property(
        textWithWhitespace,
        ([part1, whitespace, part2]) => {
          const originalText = part1 + whitespace + part2;
          
          const mockDoc = new MockDocument({
            '#lawContent': new MockElement(originalText)
          });

          const result = BDLawExtractor.extractActContent(mockDoc);
          
          // Internal whitespace should be preserved
          return result.content.includes(whitespace.trim() || whitespace);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali numerals should be preserved exactly
   */
  it('should preserve Bengali numerals exactly', () => {
    const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    
    const textWithNumerals = fc.array(
      fc.constantFrom(...bengaliNumerals),
      { minLength: 1, maxLength: 20 }
    );

    fc.assert(
      fc.property(
        textWithNumerals,
        (numerals) => {
          const originalText = 'ধারা ' + numerals.join('') + '।';
          
          const mockDoc = new MockDocument({
            '#lawContent': new MockElement(originalText)
          });

          const result = BDLawExtractor.extractActContent(mockDoc);
          
          // All numerals should be present in the same order
          const numeralString = numerals.join('');
          return result.content.includes(numeralString);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty content should return empty string, not null or undefined
   */
  it('should return empty string for empty or missing content', () => {
    const emptyInputs = fc.oneof(
      fc.constant(new MockDocument({})),
      fc.constant(new MockDocument({ '#lawContent': new MockElement('') })),
      fc.constant(new MockDocument({ '#lawContent': new MockElement('   ') })),
      fc.constant(null)
    );

    fc.assert(
      fc.property(
        emptyInputs,
        (mockDoc) => {
          const result = BDLawExtractor.extractActContent(mockDoc);
          
          // Content should be empty string, not null or undefined
          return result.content === '' && typeof result.content === 'string';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Title extraction should preserve Bengali title text
   */
  it('should preserve Bengali title text exactly', () => {
    const bengaliTitle = fc.stringOf(
      fc.constantFrom(
        'ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ',
        'া', 'ি', 'ী', 'ু', 'ূ', 'ে', 'ৈ', 'ো', 'ৌ', '্',
        ' ', '।', '০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'
      ),
      { minLength: 1, maxLength: 50 }
    );

    fc.assert(
      fc.property(
        bengaliTitle,
        (originalTitle) => {
          const mockDoc = new MockDocument({
            'h1': new MockElement(originalTitle),
            '#lawContent': new MockElement('কিছু বিষয়বস্তু')
          });

          const result = BDLawExtractor.extractActContent(mockDoc);
          
          // Title should be trimmed but otherwise identical
          return result.title === originalTitle.trim();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Extraction should not add any characters not in the original
   */
  it('should not add any characters not present in the original content', () => {
    const bengaliText = fc.stringOf(
      fc.constantFrom(
        'ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ',
        ' ', '\n', '।', 'ধারা', 'অধ্যায়'
      ),
      { minLength: 1, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        bengaliText,
        (originalText) => {
          const mockDoc = new MockDocument({
            '#lawContent': new MockElement(originalText)
          });

          const result = BDLawExtractor.extractActContent(mockDoc);
          
          // Every character in the result should be in the original (after trim)
          const trimmedOriginal = originalText.trim();
          return [...result.content].every(char => trimmedOriginal.includes(char));
        }
      ),
      { numRuns: 100 }
    );
  });
});
