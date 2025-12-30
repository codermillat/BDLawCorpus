/**
 * Property-Based Tests for Configuration Rule Control
 * 
 * Feature: data-quality-remediation, Property 9: Configuration Rule Control
 * Validates: Requirements 8.1, 8.2, 8.3
 * 
 * For any cleaning operation, when a rule category is disabled in configuration,
 * the Text_Cleaner SHALL NOT apply transformations from that category, and the
 * cleaned content SHALL be identical to input for that category.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 9: Configuration Rule Control', () => {
  /**
   * Property: When encoding repairs are disabled, no encoding transformations should be applied
   * Validates: Requirement 8.1
   */
  it('should not apply encoding repairs when applyEncodingRepairs is false', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n'), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          // Content with encoding error (æ)
          const content = prefix + 'æ' + suffix;
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: false,
            applyOcrCorrections: false,
            applyFormatting: false
          });
          
          // Content should still contain the encoding error
          if (!result.cleaned.includes('æ')) {
            return false;
          }
          
          // No encoding_repair transformations should be recorded
          const encodingTransforms = result.transformations.filter(
            t => t.type === 'encoding_repair'
          );
          
          return encodingTransforms.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When OCR corrections are disabled, no OCR transformations should be applied
   * Validates: Requirement 8.2
   */
  it('should not apply OCR corrections when applyOcrCorrections is false', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n'), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          // Content with OCR artifact
          const content = prefix + 'প্রম্্নফ' + suffix;
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: false,
            applyOcrCorrections: false,
            applyFormatting: false
          });
          
          // Content should still contain the OCR artifact
          if (!result.cleaned.includes('প্রম্্নফ')) {
            return false;
          }
          
          // No ocr_correction transformations should be recorded
          const ocrTransforms = result.transformations.filter(
            t => t.type === 'ocr_correction'
          );
          
          return ocrTransforms.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When formatting is disabled, no formatting transformations should be applied
   * Validates: Requirement 8.3
   */
  it('should not apply formatting when applyFormatting is false', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          // Content with formatting opportunity (semicolon followed by list marker)
          const content = prefix + '; (a)' + suffix;
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: false,
            applyOcrCorrections: false,
            applyFormatting: false
          });
          
          // Content should remain unchanged (no newline inserted)
          if (result.cleaned !== content) {
            return false;
          }
          
          // No formatting transformations should be recorded
          const formattingTransforms = result.transformations.filter(
            t => t.type === 'formatting'
          );
          
          return formattingTransforms.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When all rules are enabled, all applicable transformations should be applied
   * Validates: Requirements 8.1, 8.2, 8.3
   */
  it('should apply all transformations when all rules are enabled', () => {
    const contentArbitrary = fc.record({
      separator: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 20 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ separator }) => {
          // Content with encoding error
          const content = 'æ' + separator;
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: true,
            applyFormatting: true
          });
          
          // Encoding error should be fixed
          if (result.cleaned.includes('æ')) {
            return false;
          }
          
          // Should have encoding_repair transformation
          const encodingTransforms = result.transformations.filter(
            t => t.type === 'encoding_repair'
          );
          
          return encodingTransforms.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Selective rule enabling should only apply enabled rules
   * Validates: Requirements 8.1, 8.2, 8.3
   */
  it('should only apply encoding repairs when only that rule is enabled', () => {
    const contentArbitrary = fc.record({
      separator: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 20 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ separator }) => {
          // Content with both encoding error and OCR artifact
          const content = 'æ' + separator + 'প্রম্্নফ';
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: false,
            applyFormatting: false
          });
          
          // Encoding error should be fixed
          if (result.cleaned.includes('æ')) {
            return false;
          }
          
          // OCR artifact should remain
          if (!result.cleaned.includes('প্রম্্নফ')) {
            return false;
          }
          
          // Should only have encoding_repair transformations
          const nonEncodingTransforms = result.transformations.filter(
            t => t.type !== 'encoding_repair'
          );
          
          return nonEncodingTransforms.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Selective rule enabling should only apply OCR corrections when enabled
   * Validates: Requirements 8.1, 8.2
   */
  it('should only apply OCR corrections when only that rule is enabled', () => {
    const contentArbitrary = fc.record({
      separator: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 20 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ separator }) => {
          // Content with both encoding error and OCR artifact
          const content = 'æ' + separator + 'প্রম্্নফ';
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: false,
            applyOcrCorrections: true,
            applyFormatting: false
          });
          
          // Encoding error should remain
          if (!result.cleaned.includes('æ')) {
            return false;
          }
          
          // OCR artifact should be fixed
          if (result.cleaned.includes('প্রম্্নফ')) {
            return false;
          }
          
          // Should only have ocr_correction transformations
          const nonOcrTransforms = result.transformations.filter(
            t => t.type !== 'ocr_correction'
          );
          
          return nonOcrTransforms.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Default options should enable all rules
   * Validates: Requirements 8.1, 8.2, 8.3
   */
  it('should enable all rules by default', () => {
    const contentArbitrary = fc.record({
      separator: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 20 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ separator }) => {
          // Content with encoding error
          const content = 'æ' + separator;
          
          // Call with empty options (should use defaults)
          const result = BDLawQuality.cleanContent(content, {});
          
          // Encoding error should be fixed (default is enabled)
          return !result.cleaned.includes('æ');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty content should return empty result regardless of configuration
   * Validates: Requirements 8.1, 8.2, 8.3
   */
  it('should handle empty content gracefully with any configuration', () => {
    const configArbitrary = fc.record({
      applyEncodingRepairs: fc.boolean(),
      applyOcrCorrections: fc.boolean(),
      applyFormatting: fc.boolean()
    });

    const emptyInputs = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant('')
    );

    fc.assert(
      fc.property(
        emptyInputs,
        configArbitrary,
        (content, config) => {
          const result = BDLawQuality.cleanContent(content, config);
          
          return typeof result.original === 'string' &&
                 typeof result.cleaned === 'string' &&
                 Array.isArray(result.transformations) &&
                 result.transformations.length === 0 &&
                 Array.isArray(result.flags);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Flags should indicate cleaning_applied only when transformations occur
   * Validates: Requirements 8.1, 8.2, 8.3
   */
  it('should set cleaning_applied flag only when transformations are made', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          // Content with encoding error
          const contentWithError = prefix + 'æ' + suffix;
          
          // With rules enabled - should have flag
          const resultEnabled = BDLawQuality.cleanContent(contentWithError, {
            applyEncodingRepairs: true,
            applyOcrCorrections: false,
            applyFormatting: false
          });
          
          // With rules disabled - should not have flag
          const resultDisabled = BDLawQuality.cleanContent(contentWithError, {
            applyEncodingRepairs: false,
            applyOcrCorrections: false,
            applyFormatting: false
          });
          
          const enabledHasFlag = resultEnabled.flags.includes('cleaning_applied');
          const disabledHasNoFlag = !resultDisabled.flags.includes('cleaning_applied');
          
          return enabledHasFlag && disabledHasNoFlag;
        }
      ),
      { numRuns: 100 }
    );
  });
});
