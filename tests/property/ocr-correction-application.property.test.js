/**
 * Property-Based Tests for OCR Correction Application
 * 
 * Feature: data-quality-remediation, Property 6: OCR Correction Application
 * Validates: Requirements 5.1, 5.5
 * 
 * For any text with OCR artifacts, when the Text_Cleaner applies corrections,
 * the cleaned content SHALL have all known typos replaced with correct text,
 * and the transformation count SHALL equal the number of replacements made.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 6: OCR Correction Application', () => {
  // Get the OCR corrections from the config for testing
  const ocrCorrections = BDLawQuality.QUALITY_CONFIG.ocrCorrections;

  /**
   * Property: Known OCR typos should be replaced with correct text
   * Validates: Requirement 5.1
   */
  it('should replace all known OCR typos with correct text', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.'), { minLength: 0, maxLength: 50 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.'), { minLength: 0, maxLength: 50 }),
      correctionIndex: fc.integer({ min: 0, max: ocrCorrections.length - 1 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix, correctionIndex }) => {
          const correction = ocrCorrections[correctionIndex];
          const content = prefix + correction.incorrect + suffix;
          
          const result = BDLawQuality.applyOcrCorrectionRules(content);
          
          // Cleaned content should not contain the incorrect text
          if (result.content.includes(correction.incorrect)) {
            return false;
          }
          
          // Cleaned content should contain the correct text where incorrect was
          const expectedContent = prefix + correction.correct + suffix;
          return result.content === expectedContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Transformation count should equal the number of replacements made
   * Validates: Requirement 5.5
   */
  it('should accurately count the number of corrections made', () => {
    const countArbitrary = fc.integer({ min: 1, max: 5 });
    const correctionIndexArbitrary = fc.integer({ min: 0, max: ocrCorrections.length - 1 });

    fc.assert(
      fc.property(
        countArbitrary,
        correctionIndexArbitrary,
        (count, correctionIndex) => {
          const correction = ocrCorrections[correctionIndex];
          // Create content with exactly 'count' occurrences of the incorrect text
          const separator = ' text ';
          const content = Array(count).fill(correction.incorrect).join(separator);
          
          const result = BDLawQuality.applyOcrCorrectionRules(content);
          
          // Find the transformation for this correction
          const transform = result.transformations.find(
            t => t.incorrect === correction.incorrect
          );
          
          if (!transform) {
            return false;
          }
          
          // Count should match the number of occurrences
          return transform.count === count;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Transformations should track type, incorrect, correct, count, and context
   * Validates: Requirements 5.1, 5.5
   */
  it('should track transformations with type, incorrect, correct, count, and context', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      correctionIndex: fc.integer({ min: 0, max: ocrCorrections.length - 1 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix, correctionIndex }) => {
          const correction = ocrCorrections[correctionIndex];
          const content = prefix + correction.incorrect + suffix;
          
          const result = BDLawQuality.applyOcrCorrectionRules(content);
          
          if (result.transformations.length === 0) {
            return false;
          }
          
          // Each transformation should have required fields
          return result.transformations.every(t => 
            t.type === 'ocr_correction' &&
            typeof t.incorrect === 'string' &&
            typeof t.correct === 'string' &&
            typeof t.count === 'number' &&
            t.count > 0 &&
            typeof t.context === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: dryRun mode should detect but not modify content
   * Validates: Requirement 5.5
   */
  it('should not modify content when dryRun is true', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      correctionIndex: fc.integer({ min: 0, max: ocrCorrections.length - 1 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix, correctionIndex }) => {
          const correction = ocrCorrections[correctionIndex];
          const content = prefix + correction.incorrect + suffix;
          
          const result = BDLawQuality.applyOcrCorrectionRules(content, null, true);
          
          // Content should remain unchanged in dryRun mode
          if (result.content !== content) {
            return false;
          }
          
          // But transformations should still be recorded
          return result.transformations.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple OCR artifacts should all be corrected
   * Validates: Requirement 5.1
   */
  it('should correct multiple OCR artifacts in the same content', () => {
    const contentArbitrary = fc.record({
      separator: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 10, maxLength: 30 }),
      correctionIndex: fc.integer({ min: 0, max: ocrCorrections.length - 1 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ separator, correctionIndex }) => {
          const correction = ocrCorrections[correctionIndex];
          // Insert the same OCR artifact twice
          const content = correction.incorrect + separator + correction.incorrect;
          
          const result = BDLawQuality.applyOcrCorrectionRules(content);
          
          // Should not contain any OCR artifacts
          if (result.content.includes(correction.incorrect)) {
            return false;
          }
          
          // Should have transformations recorded
          return result.transformations.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without OCR artifacts should return unchanged
   */
  it('should return unchanged content when no OCR artifacts present', () => {
    // Generate content with only safe ASCII characters
    const safeContent = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', 'd', 'e', 'A', 'B', 'C', ' ', '\n', '.', ',', '0', '1', '2'),
      { minLength: 1, maxLength: 200 }
    );

    fc.assert(
      fc.property(
        safeContent,
        (content) => {
          const result = BDLawQuality.applyOcrCorrectionRules(content);
          
          // Content should be unchanged
          if (result.content !== content) {
            return false;
          }
          
          // No transformations should be recorded
          return result.transformations.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content should return empty content with no transformations
   */
  it('should handle empty or null content gracefully', () => {
    const emptyInputs = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant('')
    );

    fc.assert(
      fc.property(
        emptyInputs,
        (content) => {
          const result = BDLawQuality.applyOcrCorrectionRules(content);
          
          return typeof result.content === 'string' &&
                 Array.isArray(result.transformations) &&
                 result.transformations.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Original content should remain unchanged (preserved separately)
   * Validates: Requirement 5.1
   */
  it('should preserve original content when dryRun is false', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      correctionIndex: fc.integer({ min: 0, max: ocrCorrections.length - 1 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix, correctionIndex }) => {
          const correction = ocrCorrections[correctionIndex];
          const originalContent = prefix + correction.incorrect + suffix;
          
          // Make a copy to verify original is not mutated
          const contentCopy = originalContent.slice();
          
          BDLawQuality.applyOcrCorrectionRules(originalContent);
          
          // Original string should not be mutated (strings are immutable in JS)
          return originalContent === contentCopy;
        }
      ),
      { numRuns: 100 }
    );
  });
});
