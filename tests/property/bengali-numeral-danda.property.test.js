/**
 * Property-Based Tests for Bengali Numeral+Danda Section Marker Detection
 * 
 * Feature: textual-fidelity-extraction, Property 4: Bengali Numeral+Danda Section Marker Detection
 * Validates: Requirements 2.1, 2.2, 2.3, 2.6, 10.1, 10.2, 10.3, 10.4
 * 
 * For any Bengali text containing numeral+danda patterns (০৷ through ৯৷, including multi-digit
 * like ১০৷, ২৫৷, ১০০৷), the extractor SHALL detect all occurrences and count them in
 * marker_frequency.numeral_danda_count. Detection SHALL NOT require the presence of "ধারা"
 * in the text. Marker detection counts raw pattern occurrences and does not imply section boundaries.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 4: Bengali Numeral+Danda Section Marker Detection', () => {
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
   * Property: For any text with known numeral+danda insertions, all patterns SHALL be detected
   * Validates: Requirements 2.1, 2.2, 10.1, 10.2
   */
  it('should detect all Bengali numeral+danda patterns inserted into random text', () => {
    // Generate random Bengali-like text
    const bengaliChars = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', ' ', '\n'),
      { minLength: 0, maxLength: 50 }
    );

    fc.assert(
      fc.property(
        bengaliChars,
        fc.array(fc.integer({ min: 1, max: 999 }), { minLength: 1, maxLength: 10 }),
        (baseText, numbers) => {
          // Insert numeral+danda patterns at known positions
          let text = baseText;
          for (const num of numbers) {
            const bengaliNum = toBengaliNumeral(num);
            text += ` ${bengaliNum}${DANDA} `;
          }

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // numeral_danda_count should match the number of insertions
          return markerFrequency.numeral_danda_count >= numbers.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Single-digit Bengali numerals followed by danda SHALL be detected
   * Validates: Requirements 2.1, 10.1
   */
  it('should detect single-digit Bengali numeral+danda patterns (১৷ through ৯৷)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 20 }),
        (digit, prefix) => {
          const bengaliDigit = BENGALI_NUMERALS[digit];
          const text = `${prefix}${bengaliDigit}${DANDA}`;

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // Should detect exactly one numeral+danda pattern
          return markerFrequency.numeral_danda_count === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multi-digit Bengali numerals followed by danda SHALL be detected
   * Validates: Requirements 2.2, 10.2
   */
  it('should detect multi-digit Bengali numeral+danda patterns (১০৷, ২৫৷, ১০০৷)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 999 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 20 }),
        (number, prefix) => {
          const bengaliNum = toBengaliNumeral(number);
          const text = `${prefix}${bengaliNum}${DANDA}`;

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // Should detect exactly one numeral+danda pattern
          return markerFrequency.numeral_danda_count === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Detection SHALL NOT require "ধারা" in the text
   * Validates: Requirements 2.6, 10.4
   */
  it('should detect numeral+danda patterns without requiring ধারা', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
        (numbers) => {
          // Create text with ONLY numeral+danda patterns, NO ধারা
          const text = numbers.map(n => `${toBengaliNumeral(n)}${DANDA}`).join(' ');

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // dhara_count should be 0 (no ধারা in text)
          // numeral_danda_count should match the number of patterns
          return (
            markerFrequency.dhara_count === 0 &&
            markerFrequency.numeral_danda_count === numbers.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: bengali_numbered_sections SHALL be the sum of dhara_count and numeral_danda_count
   * Validates: Requirements 2.3, 10.3
   */
  it('should compute bengali_numbered_sections as sum of dhara_count and numeral_danda_count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        (dharaCount, numeralCount) => {
          // Create text with specified counts
          let text = '';
          for (let i = 0; i < dharaCount; i++) {
            text += 'ধারা ';
          }
          for (let i = 1; i <= numeralCount; i++) {
            text += `${toBengaliNumeral(i)}${DANDA} `;
          }

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // bengali_numbered_sections should equal dhara_count + numeral_danda_count
          return (
            markerFrequency.bengali_numbered_sections ===
            markerFrequency.dhara_count + markerFrequency.numeral_danda_count
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null text should return zero counts
   * Validates: Edge case handling
   */
  it('should return zero counts for empty or invalid input', () => {
    const invalidInputs = fc.oneof(
      fc.constant(''),
      fc.constant(null),
      fc.constant(undefined)
    );

    fc.assert(
      fc.property(
        invalidInputs,
        (input) => {
          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(input);

          return (
            markerFrequency.dhara_count === 0 &&
            markerFrequency.numeral_danda_count === 0 &&
            markerFrequency.bengali_numbered_sections === 0 &&
            markerFrequency.chapter_count === 0 &&
            markerFrequency.schedule_count === 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Text without any markers should return zero counts
   * Validates: Edge case handling
   */
  it('should return zero counts for text without any section markers', () => {
    // Generate text that definitely doesn't contain markers
    const textWithoutMarkers = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', ' ', '\n', '.'),
      { minLength: 0, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        textWithoutMarkers,
        (text) => {
          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          return (
            markerFrequency.dhara_count === 0 &&
            markerFrequency.numeral_danda_count === 0 &&
            markerFrequency.bengali_numbered_sections === 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple numeral+danda patterns on the same line should all be detected
   * Validates: Requirements 10.1, 10.2
   */
  it('should detect multiple numeral+danda patterns on the same line', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 2, maxLength: 10 }),
        (numbers) => {
          // Put all patterns on a single line
          const text = numbers.map(n => `${toBengaliNumeral(n)}${DANDA}`).join(' ');
          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // Should detect all patterns
          return markerFrequency.numeral_danda_count === numbers.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Chapter and schedule markers should also be counted
   * Validates: Comprehensive marker frequency tracking
   */
  it('should count chapter (অধ্যায়) and schedule (তফসিল) markers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        (chapterCount, scheduleCount) => {
          let text = '';
          for (let i = 0; i < chapterCount; i++) {
            text += 'অধ্যায় ';
          }
          for (let i = 0; i < scheduleCount; i++) {
            text += 'তফসিল ';
          }

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          return (
            markerFrequency.chapter_count === chapterCount &&
            markerFrequency.schedule_count === scheduleCount
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
