/**
 * Property-Based Tests for Content Noise Filtering
 * 
 * Feature: bdlawcorpus-mode, Property 19: Content Noise Filtering Preservation
 * Validates: Requirements 28.1, 28.2, 28.3, 28.5, 28.6
 * 
 * For any extracted content containing UI noise patterns ("প্রিন্ট ভিউ", "Top", "Copyright ©"),
 * the filter SHALL remove these patterns while preserving all Bengali legal text and
 * section markers (ধারা, অধ্যায়, তফসিল).
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 19: Content Noise Filtering Preservation', () => {
  const SECTION_MARKERS = ['ধারা', 'অধ্যায়', 'তফসিল'];
  const UI_NOISE_STRINGS = ['প্রিন্ট ভিউ'];

  /**
   * Property: Legal text without noise should be preserved exactly (except trimming)
   * Validates: Requirements 28.5, 28.6
   */
  it('should preserve legal text without noise exactly', () => {
    const bengaliLegalText = fc.stringOf(
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
        bengaliLegalText,
        (text) => {
          const filtered = BDLawExtractor.filterContentNoise(text);
          // Text without noise should be preserved (except leading/trailing whitespace)
          return filtered === text.replace(/^[\s\n]+/, '').replace(/[\s\n]+$/, '');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section markers should never be filtered out
   * Validates: Requirements 28.6
   */
  it('should never filter out section markers', () => {
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
          const text = parts.map(([prefix, marker]) => prefix + marker).join(' ');
          const filtered = BDLawExtractor.filterContentNoise(text);

          // All section markers should still be present
          return SECTION_MARKERS.every(marker => {
            const originalCount = (text.match(new RegExp(marker, 'g')) || []).length;
            const filteredCount = (filtered.match(new RegExp(marker, 'g')) || []).length;
            return originalCount === filteredCount;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: UI noise pattern "প্রিন্ট ভিউ" should be removed
   * Validates: Requirements 28.1
   */
  it('should remove "প্রিন্ট ভিউ" (Print View) from content', () => {
    const legalText = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' ', '\n', '।'),
      { minLength: 10, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        legalText,
        fc.integer({ min: 1, max: 3 }),
        (text, insertCount) => {
          // Insert noise pattern
          let textWithNoise = text;
          for (let i = 0; i < insertCount; i++) {
            textWithNoise += '\nপ্রিন্ট ভিউ\n';
          }

          const filtered = BDLawExtractor.filterContentNoise(textWithNoise);

          // Noise should be removed
          return !filtered.includes('প্রিন্ট ভিউ');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: "Top" navigation links should be removed
   * Validates: Requirements 28.2
   */
  it('should remove "Top" navigation links from content', () => {
    const legalText = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' ', '।'),
      { minLength: 10, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        legalText,
        (text) => {
          // Insert "Top" on its own line
          const textWithNoise = text + '\nTop\n' + text;

          const filtered = BDLawExtractor.filterContentNoise(textWithNoise);

          // "Top" on its own line should be removed
          const lines = filtered.split('\n');
          return !lines.some(line => line.trim() === 'Top');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Copyright notices should be removed
   * Validates: Requirements 28.3
   */
  it('should remove copyright notices from content', () => {
    const legalText = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' ', '\n', '।'),
      { minLength: 10, maxLength: 100 }
    );

    const year = fc.integer({ min: 2000, max: 2030 });

    fc.assert(
      fc.property(
        legalText,
        year,
        (text, yr) => {
          // Insert copyright notice
          const textWithNoise = text + `\nCopyright © ${yr}\n`;

          const filtered = BDLawExtractor.filterContentNoise(textWithNoise);

          // Copyright notice should be removed
          return !filtered.includes(`Copyright © ${yr}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty whitespace-only lines at beginning should be trimmed
   * Validates: Requirements 28.4
   */
  it('should trim empty whitespace-only lines at beginning', () => {
    const leadingWhitespace = fc.stringOf(
      fc.constantFrom(' ', '\t', '\n'),
      { minLength: 1, maxLength: 10 }
    );

    const legalText = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', ' ', '।'),
      { minLength: 5, maxLength: 50 }
    );

    fc.assert(
      fc.property(
        leadingWhitespace,
        legalText,
        (whitespace, text) => {
          const textWithLeadingWhitespace = whitespace + text;
          const filtered = BDLawExtractor.filterContentNoise(textWithLeadingWhitespace);

          // Should not start with whitespace/newlines
          return filtered.length === 0 || !/^[\s\n]/.test(filtered);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty whitespace-only lines at end should be trimmed
   * Validates: Requirements 28.4
   */
  it('should trim empty whitespace-only lines at end', () => {
    const trailingWhitespace = fc.stringOf(
      fc.constantFrom(' ', '\t', '\n'),
      { minLength: 1, maxLength: 10 }
    );

    const legalText = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', ' ', '।'),
      { minLength: 5, maxLength: 50 }
    );

    fc.assert(
      fc.property(
        legalText,
        trailingWhitespace,
        (text, whitespace) => {
          const textWithTrailingWhitespace = text + whitespace;
          const filtered = BDLawExtractor.filterContentNoise(textWithTrailingWhitespace);

          // Should not end with whitespace/newlines
          return filtered.length === 0 || !/[\s\n]$/.test(filtered);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali legal text should be preserved after noise removal
   * Validates: Requirements 28.5
   */
  it('should preserve Bengali legal text after removing noise', () => {
    const legalText = fc.stringOf(
      fc.constantFrom(
        'ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ',
        'া', 'ি', 'ী', 'ু', 'ূ', 'ে', 'ৈ', 'ো', 'ৌ', '্',
        ' ', '।', '০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'
      ),
      { minLength: 20, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        legalText,
        (text) => {
          // Add noise around legal text
          const textWithNoise = 'প্রিন্ট ভিউ\n' + text + '\nCopyright © 2019';

          const filtered = BDLawExtractor.filterContentNoise(textWithNoise);

          // Legal text should be preserved (trimmed)
          return filtered.includes(text.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null input should return the same value
   * Validates: Requirements 28.5
   */
  it('should handle empty or invalid input gracefully', () => {
    const invalidInputs = fc.oneof(
      fc.constant(''),
      fc.constant(null),
      fc.constant(undefined)
    );

    fc.assert(
      fc.property(
        invalidInputs,
        (input) => {
          const filtered = BDLawExtractor.filterContentNoise(input);
          // Should return the input unchanged for invalid inputs
          return filtered === input;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Legislative footer text should be removed
   * Validates: Requirements 28.3
   */
  it('should remove Legislative and Parliamentary Affairs Division footer', () => {
    const legalText = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' ', '\n', '।'),
      { minLength: 10, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        legalText,
        (text) => {
          // Insert footer text
          const textWithNoise = text + '\nLegislative and Parliamentary Affairs Division\n';

          const filtered = BDLawExtractor.filterContentNoise(textWithNoise);

          // Footer should be removed
          return !filtered.includes('Legislative and Parliamentary Affairs Division');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple noise patterns should all be removed
   * Validates: Requirements 28.1, 28.2, 28.3
   */
  it('should remove all noise patterns when multiple are present', () => {
    const legalText = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' ', '।'),
      { minLength: 20, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        legalText,
        (text) => {
          // Insert multiple noise patterns
          const textWithNoise = 
            'প্রিন্ট ভিউ\n' + 
            text + 
            '\nTop\n' + 
            'Copyright © 2019\n' +
            'Legislative and Parliamentary Affairs Division';

          const filtered = BDLawExtractor.filterContentNoise(textWithNoise);

          // All noise should be removed
          return !filtered.includes('প্রিন্ট ভিউ') &&
                 !filtered.split('\n').some(line => line.trim() === 'Top') &&
                 !filtered.includes('Copyright © 2019') &&
                 !filtered.includes('Legislative and Parliamentary Affairs Division');
        }
      ),
      { numRuns: 100 }
    );
  });
});
