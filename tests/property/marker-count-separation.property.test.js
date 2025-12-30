/**
 * Property-Based Tests for Marker Count Separation (Dhara vs Numeral+Danda)
 * 
 * Feature: textual-fidelity-extraction, Property 5: Marker Count Separation (Dhara vs Numeral+Danda)
 * Validates: Requirements 10.5, 10.6
 * 
 * For any extracted content, the extractor SHALL maintain separate counts for "ধারা" markers
 * (dhara_count) and Bengali numeral+danda markers (numeral_danda_count). These counts SHALL
 * be independent—content with only numeral+danda patterns SHALL have dhara_count: 0 and
 * numeral_danda_count > 0.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 5: Marker Count Separation (Dhara vs Numeral+Danda)', () => {
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
   * Property: dhara_count and numeral_danda_count SHALL be maintained separately
   * Validates: Requirements 10.5, 10.6
   */
  it('should maintain separate counts for dhara and numeral+danda markers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        (dharaCount, numeralCount) => {
          // Create text with specified counts of each marker type
          let text = '';
          
          // Add ধারা markers
          for (let i = 0; i < dharaCount; i++) {
            text += `ধারা ${toBengaliNumeral(i + 1)} `;
          }
          
          // Add numeral+danda markers (using different numbers to avoid overlap)
          for (let i = 0; i < numeralCount; i++) {
            text += `${toBengaliNumeral(100 + i)}${DANDA} `;
          }

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // Counts should match exactly what we inserted
          return (
            markerFrequency.dhara_count === dharaCount &&
            markerFrequency.numeral_danda_count === numeralCount
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content with ONLY numeral+danda patterns SHALL have dhara_count: 0
   * Validates: Requirements 10.5, 10.6
   */
  it('should have dhara_count: 0 when content has only numeral+danda patterns', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 999 }), { minLength: 1, maxLength: 20 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' ', '\n'), { minLength: 0, maxLength: 30 }),
        (numbers, filler) => {
          // Create text with ONLY numeral+danda patterns, NO ধারা
          const patterns = numbers.map(n => `${toBengaliNumeral(n)}${DANDA}`);
          const text = filler + patterns.join(' ') + filler;

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // dhara_count MUST be 0, numeral_danda_count MUST be > 0
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
   * Property: Content with ONLY ধারা markers SHALL have numeral_danda_count: 0
   * Validates: Requirements 10.5, 10.6
   */
  it('should have numeral_danda_count: 0 when content has only dhara markers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' ', '\n'), { minLength: 0, maxLength: 30 }),
        (dharaCount, filler) => {
          // Create text with ONLY ধারা markers, NO numeral+danda
          let text = filler;
          for (let i = 0; i < dharaCount; i++) {
            text += `ধারা ${i + 1} `;
          }
          text += filler;

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // numeral_danda_count MUST be 0, dhara_count MUST be > 0
          return (
            markerFrequency.numeral_danda_count === 0 &&
            markerFrequency.dhara_count === dharaCount
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Counts SHALL be independent - changing one should not affect the other
   * Validates: Requirements 10.5, 10.6
   */
  it('should have independent counts - adding dhara should not change numeral_danda_count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (baseNumeralCount, additionalDharaCount) => {
          // Create base text with numeral+danda patterns
          let baseText = '';
          for (let i = 1; i <= baseNumeralCount; i++) {
            baseText += `${toBengaliNumeral(i)}${DANDA} `;
          }

          // Get counts for base text
          const baseMarkerFrequency = BDLawExtractor.countBengaliSectionMarkers(baseText);

          // Add ধারা markers to the text
          let extendedText = baseText;
          for (let i = 0; i < additionalDharaCount; i++) {
            extendedText += 'ধারা ';
          }

          // Get counts for extended text
          const extendedMarkerFrequency = BDLawExtractor.countBengaliSectionMarkers(extendedText);

          // numeral_danda_count should remain the same
          // dhara_count should increase by additionalDharaCount
          return (
            extendedMarkerFrequency.numeral_danda_count === baseMarkerFrequency.numeral_danda_count &&
            extendedMarkerFrequency.dhara_count === baseMarkerFrequency.dhara_count + additionalDharaCount
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Counts SHALL be independent - adding numeral+danda should not change dhara_count
   * Validates: Requirements 10.5, 10.6
   */
  it('should have independent counts - adding numeral+danda should not change dhara_count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (baseDharaCount, additionalNumeralCount) => {
          // Create base text with ধারা markers
          let baseText = '';
          for (let i = 0; i < baseDharaCount; i++) {
            baseText += 'ধারা ';
          }

          // Get counts for base text
          const baseMarkerFrequency = BDLawExtractor.countBengaliSectionMarkers(baseText);

          // Add numeral+danda patterns to the text
          let extendedText = baseText;
          for (let i = 1; i <= additionalNumeralCount; i++) {
            extendedText += `${toBengaliNumeral(i)}${DANDA} `;
          }

          // Get counts for extended text
          const extendedMarkerFrequency = BDLawExtractor.countBengaliSectionMarkers(extendedText);

          // dhara_count should remain the same
          // numeral_danda_count should increase by additionalNumeralCount
          return (
            extendedMarkerFrequency.dhara_count === baseMarkerFrequency.dhara_count &&
            extendedMarkerFrequency.numeral_danda_count === baseMarkerFrequency.numeral_danda_count + additionalNumeralCount
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Both counts can be non-zero simultaneously
   * Validates: Requirements 10.5, 10.6
   */
  it('should allow both dhara_count and numeral_danda_count to be non-zero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (dharaCount, numeralCount) => {
          // Create text with both marker types
          let text = '';
          for (let i = 0; i < dharaCount; i++) {
            text += 'ধারা ';
          }
          for (let i = 1; i <= numeralCount; i++) {
            text += `${toBengaliNumeral(i)}${DANDA} `;
          }

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          // Both counts should be non-zero
          return (
            markerFrequency.dhara_count > 0 &&
            markerFrequency.numeral_danda_count > 0 &&
            markerFrequency.dhara_count === dharaCount &&
            markerFrequency.numeral_danda_count === numeralCount
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Interleaved markers should be counted correctly
   * Validates: Requirements 10.5, 10.6
   */
  it('should correctly count interleaved dhara and numeral+danda markers', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constant('dhara'),
            fc.constant('numeral')
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (markerTypes) => {
          // Create text with interleaved markers
          let text = '';
          let expectedDhara = 0;
          let expectedNumeral = 0;
          let numeralCounter = 1;

          for (const type of markerTypes) {
            if (type === 'dhara') {
              text += 'ধারা ';
              expectedDhara++;
            } else {
              text += `${toBengaliNumeral(numeralCounter)}${DANDA} `;
              expectedNumeral++;
              numeralCounter++;
            }
          }

          const markerFrequency = BDLawExtractor.countBengaliSectionMarkers(text);

          return (
            markerFrequency.dhara_count === expectedDhara &&
            markerFrequency.numeral_danda_count === expectedNumeral
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
