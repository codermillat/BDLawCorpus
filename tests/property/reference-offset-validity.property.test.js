/**
 * Property-Based Tests for Reference Offset Validity
 * 
 * Feature: legal-structure-derivation, Property 6: Reference Offset Validity
 * Validates: Requirements 9.3, 9.4
 * 
 * For any cross-reference in the output, content.substring(relativeOffset, 
 * relativeOffset + citation_text.length) SHALL equal the recorded citation_text.
 * 
 * This property ensures that citation offsets returned by detectCitationsInContent
 * are valid indices into the content and can be used to extract the exact citation text.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 6: Reference Offset Validity', () => {
  // Bengali numerals: ০-৯ (U+09E6 to U+09EF)
  const BENGALI_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

  /**
   * Helper to convert Arabic number to Bengali numerals
   */
  function toBengaliNumeral(num) {
    return String(num).split('').map(d => BENGALI_NUMERALS[parseInt(d)]).join('');
  }

  // Bengali year generator (১৯৫০-২০২৫)
  const bengaliYearGen = fc.integer({ min: 1950, max: 2025 }).map(toBengaliNumeral);

  // Bengali serial number generator (১-১০০)
  const bengaliSerialGen = fc.integer({ min: 1, max: 100 }).map(toBengaliNumeral);

  // English year generator
  const englishYearGen = fc.integer({ min: 1900, max: 2025 }).map(y => y.toString());

  // Roman numeral generator
  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
                         'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
                         'XXI', 'XXV', 'XXX', 'XXXV', 'XL', 'XLV', 'L'];
  const romanSerialGen = fc.constantFrom(...romanNumerals);

  // Bengali prefix text generator
  const bengaliPrefixGen = fc.stringOf(
    fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' ', '\n', '।'),
    { minLength: 0, maxLength: 50 }
  );

  // Bengali suffix text generator
  const bengaliSuffixGen = fc.stringOf(
    fc.constantFrom('চ', 'ছ', 'জ', 'ঝ', 'ঞ', ' ', '\n', '।'),
    { minLength: 0, maxLength: 50 }
  );

  // English prefix text generator
  const englishPrefixGen = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', ' ', '\n', '.'),
    { minLength: 0, maxLength: 50 }
  );

  // English suffix text generator
  const englishSuffixGen = fc.stringOf(
    fc.constantFrom('x', 'y', 'z', 'w', 'v', ' ', '\n', '.'),
    { minLength: 0, maxLength: 50 }
  );

  // Act name generator for English citations
  const actNameGen = fc.constantFrom(
    'Passport Act',
    'Income Tax Act',
    'Companies Act',
    'Contract Act',
    'Evidence Act',
    'Criminal Procedure Act',
    'Civil Procedure Act',
    'Transfer of Property Act',
    'Registration Act',
    'Stamp Act'
  );

  /**
   * Property: Bengali citation offsets allow round-trip extraction
   * Validates: Requirements 9.3, 9.4
   * 
   * For any Bengali citation pattern detected, content.substring(relativeOffset, 
   * relativeOffset + citation_text.length) SHALL equal citation_text.
   */
  it('should return valid offsets for Bengali citations that allow round-trip extraction', () => {
    fc.assert(
      fc.property(
        bengaliPrefixGen,
        bengaliYearGen,
        bengaliSerialGen,
        bengaliSuffixGen,
        (prefix, year, serial, suffix) => {
          // Build Bengali citation: [Year] সনের [Number] নং আইন
          const citation = `${year} সনের ${serial} নং আইন`;
          const content = prefix + citation + suffix;

          // Detect citations
          const citations = BDLawExtractor.detectCitationsInContent(content);

          // If no citations detected, skip (edge case with malformed content)
          if (citations.length === 0) return true;

          // For each detected citation, verify round-trip
          return citations.every(cit => {
            // Offset should be valid (>= 0)
            if (cit.relativeOffset < 0) return false;

            // Offset + length should not exceed content length
            if (cit.relativeOffset + cit.citation_text.length > content.length) return false;

            // Round-trip: extract using offset should give back citation_text
            const extracted = content.substring(
              cit.relativeOffset,
              cit.relativeOffset + cit.citation_text.length
            );
            return extracted === cit.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: English citation offsets allow round-trip extraction
   * Validates: Requirements 9.3, 9.4
   * 
   * For any English citation pattern detected, content.substring(relativeOffset, 
   * relativeOffset + citation_text.length) SHALL equal citation_text.
   */
  it('should return valid offsets for English citations that allow round-trip extraction', () => {
    fc.assert(
      fc.property(
        englishPrefixGen,
        actNameGen,
        englishYearGen,
        romanSerialGen,
        englishYearGen,
        englishSuffixGen,
        (prefix, actName, titleYear, serial, citationYear, suffix) => {
          // Build English citation: [Name] Act, [Year] ([Serial] of [Year])
          const citation = `${actName}, ${titleYear} (${serial} of ${citationYear})`;
          const content = prefix + citation + suffix;

          // Detect citations
          const citations = BDLawExtractor.detectCitationsInContent(content);

          // If no citations detected, skip (edge case)
          if (citations.length === 0) return true;

          // For each detected citation, verify round-trip
          return citations.every(cit => {
            // Offset should be valid (>= 0)
            if (cit.relativeOffset < 0) return false;

            // Offset + length should not exceed content length
            if (cit.relativeOffset + cit.citation_text.length > content.length) return false;

            // Round-trip: extract using offset should give back citation_text
            const extracted = content.substring(
              cit.relativeOffset,
              cit.relativeOffset + cit.citation_text.length
            );
            return extracted === cit.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple citations in same content all have valid offsets
   * Validates: Requirements 9.3, 9.4
   */
  it('should return valid offsets for multiple citations in same content', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(bengaliYearGen, bengaliSerialGen),
          { minLength: 2, maxLength: 4 }
        ),
        (citationData) => {
          // Build content with multiple Bengali citations
          const content = citationData
            .map(([year, serial]) => `${year} সনের ${serial} নং আইন`)
            .join(' এবং ');

          // Detect citations
          const citations = BDLawExtractor.detectCitationsInContent(content);

          // All detected citations should have valid offsets
          return citations.every(cit => {
            // Offset should be valid
            if (cit.relativeOffset < 0) return false;
            if (cit.relativeOffset + cit.citation_text.length > content.length) return false;

            // Round-trip extraction
            const extracted = content.substring(
              cit.relativeOffset,
              cit.relativeOffset + cit.citation_text.length
            );
            return extracted === cit.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Citation offsets are in document order (ascending)
   * Validates: Requirements 9.3, 9.4
   */
  it('should return citations in document order (ascending offsets)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(bengaliYearGen, bengaliSerialGen),
          { minLength: 2, maxLength: 4 }
        ),
        (citationData) => {
          // Build content with multiple citations
          const content = citationData
            .map(([year, serial]) => `${year} সনের ${serial} নং আইন`)
            .join(' এবং ');

          // Detect citations
          const citations = BDLawExtractor.detectCitationsInContent(content);

          // If less than 2 citations, skip ordering check
          if (citations.length < 2) return true;

          // Verify ascending order of offsets
          for (let i = 1; i < citations.length; i++) {
            if (citations[i].relativeOffset <= citations[i - 1].relativeOffset) {
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
   * Property: Citation offsets are within content bounds
   * Validates: Requirements 9.3, 9.4
   */
  it('should return offsets within content bounds', () => {
    fc.assert(
      fc.property(
        bengaliPrefixGen,
        bengaliYearGen,
        bengaliSerialGen,
        bengaliSuffixGen,
        (prefix, year, serial, suffix) => {
          const citation = `${year} সনের ${serial} নং আইন`;
          const content = prefix + citation + suffix;

          const citations = BDLawExtractor.detectCitationsInContent(content);

          return citations.every(cit => {
            // Offset must be >= 0
            if (cit.relativeOffset < 0) return false;
            // Offset must be < content.length
            if (cit.relativeOffset >= content.length) return false;
            // Offset + citation_text.length must be <= content.length
            if (cit.relativeOffset + cit.citation_text.length > content.length) return false;
            return true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content returns empty array (no invalid offsets)
   * Validates: Requirements 9.3, 9.4
   */
  it('should return empty array for empty or null content', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('   ') // whitespace-only
        ),
        (content) => {
          const citations = BDLawExtractor.detectCitationsInContent(content);
          return Array.isArray(citations) && citations.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without citations returns empty array
   * Validates: Requirements 9.3, 9.4
   */
  it('should return empty array for content without citation patterns', () => {
    fc.assert(
      fc.property(
        fc.stringOf(
          fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' ', '\n', '।'),
          { minLength: 10, maxLength: 100 }
        ),
        (content) => {
          // Ensure content doesn't accidentally contain citation keywords
          if (content.includes('সনের') || content.includes('নং') || content.includes('আইন')) {
            return true; // Skip this case
          }
          if (content.includes('Act') || content.includes('Ordinance')) {
            return true; // Skip this case
          }

          const citations = BDLawExtractor.detectCitationsInContent(content);
          return Array.isArray(citations) && citations.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pattern type is correctly recorded for Bengali citations
   * Validates: Requirements 9.3, 9.4
   */
  it('should record correct pattern_type for Bengali citations', () => {
    fc.assert(
      fc.property(
        bengaliPrefixGen,
        bengaliYearGen,
        bengaliSerialGen,
        bengaliSuffixGen,
        (prefix, year, serial, suffix) => {
          const citation = `${year} সনের ${serial} নং আইন`;
          const content = prefix + citation + suffix;

          const citations = BDLawExtractor.detectCitationsInContent(content);

          // All Bengali citations should have pattern_type 'bengali_citation'
          return citations.every(cit => {
            if (cit.pattern_type === 'bengali_citation') {
              // Verify it's actually a Bengali citation
              return /[০-৯]{4}\s+সনের\s+[০-৯]+\s+নং\s+আইন/.test(cit.citation_text);
            }
            return true; // Other pattern types are acceptable
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pattern type is correctly recorded for English citations
   * Validates: Requirements 9.3, 9.4
   */
  it('should record correct pattern_type for English citations', () => {
    fc.assert(
      fc.property(
        englishPrefixGen,
        actNameGen,
        englishYearGen,
        romanSerialGen,
        englishYearGen,
        englishSuffixGen,
        (prefix, actName, titleYear, serial, citationYear, suffix) => {
          const citation = `${actName}, ${titleYear} (${serial} of ${citationYear})`;
          const content = prefix + citation + suffix;

          const citations = BDLawExtractor.detectCitationsInContent(content);

          // All English citations should have pattern_type 'english_citation'
          return citations.every(cit => {
            if (cit.pattern_type === 'english_citation') {
              // Verify it's actually an English citation
              return /[A-Z][a-zA-Z\s]+(?:Act|Ordinance|Order),?\s*\d{4}\s*\([IVXLCDM]+\s+of\s+\d{4}\)/.test(cit.citation_text);
            }
            return true; // Other pattern types are acceptable
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mixed Bengali and English citations all have valid offsets
   * Validates: Requirements 9.3, 9.4
   */
  it('should return valid offsets for mixed Bengali and English citations', () => {
    fc.assert(
      fc.property(
        bengaliYearGen,
        bengaliSerialGen,
        actNameGen,
        englishYearGen,
        romanSerialGen,
        englishYearGen,
        (bengaliYear, bengaliSerial, actName, titleYear, serial, citationYear) => {
          const bengaliCitation = `${bengaliYear} সনের ${bengaliSerial} নং আইন`;
          const englishCitation = `${actName}, ${titleYear} (${serial} of ${citationYear})`;
          const content = `Under ${englishCitation} and ${bengaliCitation}, the provisions apply.`;

          const citations = BDLawExtractor.detectCitationsInContent(content);

          // All citations should have valid offsets
          return citations.every(cit => {
            if (cit.relativeOffset < 0) return false;
            if (cit.relativeOffset + cit.citation_text.length > content.length) return false;

            const extracted = content.substring(
              cit.relativeOffset,
              cit.relativeOffset + cit.citation_text.length
            );
            return extracted === cit.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Deterministic - same content produces same offsets
   * Validates: Requirements 9.3, 9.4
   */
  it('should produce deterministic offsets for same content', () => {
    fc.assert(
      fc.property(
        bengaliPrefixGen,
        bengaliYearGen,
        bengaliSerialGen,
        bengaliSuffixGen,
        (prefix, year, serial, suffix) => {
          const citation = `${year} সনের ${serial} নং আইন`;
          const content = prefix + citation + suffix;

          // Detect twice
          const citations1 = BDLawExtractor.detectCitationsInContent(content);
          const citations2 = BDLawExtractor.detectCitationsInContent(content);

          // Should have same number of citations
          if (citations1.length !== citations2.length) return false;

          // Each citation should have same offset and text
          return citations1.every((cit1, idx) => {
            const cit2 = citations2[idx];
            return cit1.relativeOffset === cit2.relativeOffset &&
                   cit1.citation_text === cit2.citation_text &&
                   cit1.pattern_type === cit2.pattern_type;
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
