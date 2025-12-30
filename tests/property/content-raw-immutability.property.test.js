/**
 * Property-Based Tests for Content Raw Immutability
 * 
 * Feature: legal-integrity-enhancement, Property 1: Content Raw Immutability
 * Validates: Requirements 1.1, 1.2
 * 
 * For any act processed through the pipeline, content_raw SHALL be byte-identical
 * to the originally extracted text. No operation SHALL modify content_raw after
 * initial extraction.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 1: Content Raw Immutability', () => {
  // Generator for content strings (various lengths and character types)
  const contentGen = fc.string({ minLength: 1, maxLength: 5000 });

  // Generator for Bengali content
  const bengaliContentGen = fc.stringOf(
    fc.constantFrom(
      'আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', 'চ', 'ছ', 'জ', 'ঝ', 
      'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 
      'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', ' ', '\n', '।', '০', 
      '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'
    ),
    { minLength: 10, maxLength: 2000 }
  );

  // Generator for mixed content (English + Bengali)
  const mixedContentGen = fc.tuple(contentGen, bengaliContentGen)
    .map(([eng, ben]) => eng + ben);

  // Generator for content with encoding issues (mojibake simulation)
  const encodingIssueGen = fc.tuple(
    contentGen,
    fc.constantFrom('à¦¬à¦¾à¦‚à¦²à¦¾', 'Ã ', 'â€™', 'Ã¢â‚¬â„¢', 'Ã¯Â¿Â½')
  ).map(([base, mojibake]) => base + mojibake);

  /**
   * Property: content_raw is byte-identical to input
   * Requirements: 1.1, 1.2
   */
  it('should preserve content_raw as byte-identical to input', () => {
    fc.assert(
      fc.property(
        contentGen,
        (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          // content_raw must be exactly equal to input
          return threeVersion.content_raw === inputText;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw preserves Bengali text exactly
   * Requirements: 1.1, 1.2
   */
  it('should preserve Bengali content_raw exactly as input', () => {
    fc.assert(
      fc.property(
        bengaliContentGen,
        (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          // content_raw must be exactly equal to Bengali input
          return threeVersion.content_raw === inputText;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw preserves mixed content exactly
   * Requirements: 1.1, 1.2
   */
  it('should preserve mixed English/Bengali content_raw exactly', () => {
    fc.assert(
      fc.property(
        mixedContentGen,
        (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          // content_raw must be exactly equal to mixed input
          return threeVersion.content_raw === inputText;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw preserves encoding issues (mojibake)
   * Requirements: 1.1, 1.2 - content_raw includes any encoding corruption
   */
  it('should preserve encoding issues in content_raw without modification', () => {
    fc.assert(
      fc.property(
        encodingIssueGen,
        (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          // content_raw must preserve encoding issues exactly
          return threeVersion.content_raw === inputText;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw length equals input length
   * Requirements: 1.1, 1.2
   */
  it('should have content_raw length equal to input length', () => {
    fc.assert(
      fc.property(
        contentGen,
        (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          return threeVersion.content_raw.length === inputText.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw is immutable across multiple calls
   * Requirements: 1.2 - NEVER modify content_raw after initial extraction
   */
  it('should produce identical content_raw for same input across multiple calls', () => {
    fc.assert(
      fc.property(
        contentGen,
        (inputText) => {
          const threeVersion1 = BDLawExtractor.createThreeVersionContent(inputText);
          const threeVersion2 = BDLawExtractor.createThreeVersionContent(inputText);
          
          // Both calls should produce identical content_raw
          return threeVersion1.content_raw === threeVersion2.content_raw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw preserves whitespace exactly
   * Requirements: 1.1, 1.2
   */
  it('should preserve all whitespace in content_raw', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          contentGen,
          fc.constantFrom(' ', '\t', '\n', '\r\n', '  ', '\t\t', '\n\n')
        ).map(([text, ws]) => text + ws + text),
        (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          return threeVersion.content_raw === inputText;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw preserves special characters
   * Requirements: 1.1, 1.2
   */
  it('should preserve special characters in content_raw', () => {
    const specialChars = ['\u09F3', '$', '%', '\u0964', '\u0965', '\u2014', '\u2013', '\u201C', '\u201D', '\u2018', '\u2019'];
    fc.assert(
      fc.property(
        fc.tuple(
          contentGen,
          fc.constantFrom(...specialChars)
        ).map(([text, special]) => text + special),
        (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          return threeVersion.content_raw === inputText;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: empty input produces empty content_raw
   * Requirements: 1.1
   */
  it('should handle empty input correctly', () => {
    const threeVersionEmpty = BDLawExtractor.createThreeVersionContent('');
    const threeVersionNull = BDLawExtractor.createThreeVersionContent(null);
    const threeVersionUndefined = BDLawExtractor.createThreeVersionContent(undefined);
    
    expect(threeVersionEmpty.content_raw).toBe('');
    expect(threeVersionNull.content_raw).toBe('');
    expect(threeVersionUndefined.content_raw).toBe('');
  });

  /**
   * Property: three-version structure is always complete
   * Requirements: 1.1, 1.3, 1.4
   */
  it('should always return complete three-version structure', () => {
    fc.assert(
      fc.property(
        contentGen,
        (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          // All three fields must exist
          return (
            'content_raw' in threeVersion &&
            'content_normalized' in threeVersion &&
            'content_corrected' in threeVersion &&
            typeof threeVersion.content_raw === 'string' &&
            typeof threeVersion.content_normalized === 'string' &&
            typeof threeVersion.content_corrected === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
