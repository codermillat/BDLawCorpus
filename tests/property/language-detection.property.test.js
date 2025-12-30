/**
 * Property-Based Tests for Language Detection
 * 
 * Feature: cross-reference-extraction, Property 14: Language Detection Accuracy
 * Validates: Requirements 11.1
 * 
 * For any act content, the language detector SHALL correctly identify Bengali content
 * (containing Bengali Unicode characters [\u0980-\u09FF]) as "bengali" and content
 * without Bengali characters as "english".
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 14: Language Detection Accuracy', () => {
  // Bengali character generator (U+0980 to U+09FF)
  const bengaliCharGen = fc.integer({ min: 0x0980, max: 0x09FF })
    .map(code => String.fromCharCode(code));

  // Bengali text generator
  const bengaliTextGen = fc.stringOf(bengaliCharGen, { minLength: 1, maxLength: 100 });

  // English/ASCII text generator (no Bengali characters)
  const englishTextGen = fc.stringOf(
    fc.integer({ min: 0x0020, max: 0x007E }).map(code => String.fromCharCode(code)),
    { minLength: 1, maxLength: 100 }
  );

  // Common Bengali legal terms
  const bengaliLegalTerms = [
    'ধারা', 'অধ্যায়', 'তফসিল', 'আইন', 'অধ্যাদেশ',
    'সংশোধন', 'রহিত', 'প্রতিস্থাপিত', 'সাপেক্ষে',
    'বিলুপ্ত', 'সংশোধিত', 'অনুসারে'
  ];

  /**
   * Property: Content with Bengali characters SHALL be detected as 'bengali'
   */
  it('should detect content with Bengali characters as bengali', () => {
    fc.assert(
      fc.property(
        bengaliTextGen,
        (bengaliText) => {
          const result = BDLawExtractor.detectContentLanguage(bengaliText);
          return result === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without Bengali characters SHALL be detected as 'english'
   */
  it('should detect content without Bengali characters as english', () => {
    fc.assert(
      fc.property(
        englishTextGen,
        (englishText) => {
          // Ensure no Bengali characters in the generated text
          const hasBengali = /[\u0980-\u09FF]/.test(englishText);
          if (hasBengali) return true; // Skip if accidentally contains Bengali
          
          const result = BDLawExtractor.detectContentLanguage(englishText);
          return result === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mixed content with at least one Bengali character SHALL be detected as 'bengali'
   */
  it('should detect mixed content with Bengali characters as bengali', () => {
    fc.assert(
      fc.property(
        englishTextGen,
        bengaliCharGen,
        englishTextGen,
        (prefix, bengaliChar, suffix) => {
          const mixedText = prefix + bengaliChar + suffix;
          const result = BDLawExtractor.detectContentLanguage(mixedText);
          return result === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content SHALL default to 'english'
   */
  it('should return english for empty or invalid content', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, '', '   '),
        (invalidContent) => {
          const result = BDLawExtractor.detectContentLanguage(invalidContent);
          // Empty string with only whitespace still returns 'english' (no Bengali chars)
          // null/undefined should return 'english' as default
          return result === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali legal terms SHALL be detected as 'bengali'
   */
  it('should detect Bengali legal terms as bengali', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...bengaliLegalTerms),
        (legalTerm) => {
          const result = BDLawExtractor.detectContentLanguage(legalTerm);
          return result === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali legal document content SHALL be detected as 'bengali'
   */
  it('should detect realistic Bengali legal content as bengali', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...bengaliLegalTerms),
        fc.integer({ min: 1, max: 100 }),
        (term, number) => {
          // Create realistic legal content
          const content = `${term} ${number}। এই আইনের বিধান অনুযায়ী...`;
          const result = BDLawExtractor.detectContentLanguage(content);
          return result === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: English legal document content SHALL be detected as 'english'
   */
  it('should detect realistic English legal content as english', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Act', 'Ordinance', 'Section', 'Chapter', 'Schedule'),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1950, max: 2025 }),
        (type, number, year) => {
          // Create realistic English legal content
          const content = `${type} ${number} of ${year}. The provisions of this Act shall apply...`;
          const result = BDLawExtractor.detectContentLanguage(content);
          return result === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Single Bengali character anywhere in text SHALL trigger 'bengali' detection
   */
  it('should detect bengali even with single Bengali character in large English text', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', ' ', '.'), { minLength: 50, maxLength: 200 }),
        bengaliCharGen,
        fc.integer({ min: 0, max: 1 }),
        (englishText, bengaliChar, position) => {
          // Insert Bengali character at beginning or end
          const text = position === 0 
            ? bengaliChar + englishText 
            : englishText + bengaliChar;
          
          const result = BDLawExtractor.detectContentLanguage(text);
          return result === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-string inputs SHALL return 'english' as default
   */
  it('should return english for non-string inputs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(123, {}, [], true, false),
        (nonStringInput) => {
          const result = BDLawExtractor.detectContentLanguage(nonStringInput);
          return result === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Detection SHALL be consistent (idempotent)
   */
  it('should return consistent results for the same content', () => {
    fc.assert(
      fc.property(
        fc.oneof(bengaliTextGen, englishTextGen),
        (content) => {
          const result1 = BDLawExtractor.detectContentLanguage(content);
          const result2 = BDLawExtractor.detectContentLanguage(content);
          const result3 = BDLawExtractor.detectContentLanguage(content);
          return result1 === result2 && result2 === result3;
        }
      ),
      { numRuns: 100 }
    );
  });
});
