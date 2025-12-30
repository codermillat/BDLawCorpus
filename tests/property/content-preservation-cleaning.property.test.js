/**
 * Property-Based Tests for Content Preservation
 * 
 * Feature: data-quality-remediation, Property 10: Content Preservation
 * Validates: Requirements 9.1, 9.4, 9.5
 * 
 * For any quality assessment or cleaning operation, the original content field
 * SHALL remain byte-identical before and after the operation, regardless of
 * what transformations are applied.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 10: Content Preservation', () => {
  /**
   * Property: Original content should remain byte-identical after cleaning
   * Validates: Requirement 9.1
   */
  it('should preserve original content byte-identical after cleaning', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n'), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          // Content with encoding error
          const content = prefix + 'æ' + suffix;
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: true,
            applyFormatting: true
          });
          
          // Original field should be byte-identical to input
          return result.original === content;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Original content should be preserved even with multiple transformations
   * Validates: Requirement 9.1
   */
  it('should preserve original content with multiple transformations', () => {
    const contentArbitrary = fc.record({
      separator: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 20 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ separator }) => {
          // Content with multiple issues
          const content = 'æ' + separator + 'ì' + separator + 'প্রম্্নফ';
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: true,
            applyFormatting: true
          });
          
          // Original should be preserved exactly
          return result.original === content;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: dryRun mode should return original as cleaned content
   * Validates: Requirement 9.4
   */
  it('should return original as cleaned content in dryRun mode', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          // Content with encoding error
          const content = prefix + 'æ' + suffix;
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: true,
            applyFormatting: true,
            dryRun: true
          });
          
          // In dryRun mode, cleaned should equal original
          return result.cleaned === result.original && result.cleaned === content;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: dryRun mode should still detect and record transformations
   * Validates: Requirement 9.4
   */
  it('should detect transformations in dryRun mode without modifying content', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          // Content with encoding error
          const content = prefix + 'æ' + suffix;
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: false,
            applyFormatting: false,
            dryRun: true
          });
          
          // Should have transformations recorded
          if (result.transformations.length === 0) {
            return false;
          }
          
          // But content should be unchanged
          return result.cleaned === content;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Original content should be preserved for audit purposes
   * Validates: Requirement 9.5
   */
  it('should maintain byte-identical original content for audit purposes', () => {
    // Generate content with various characters including Unicode
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.'), { minLength: 5, maxLength: 30 }),
      errorChar: fc.constantFrom('æ', 'ì', 'í', 'î', 'ï'),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, errorChar, suffix }) => {
          const content = prefix + errorChar + suffix;
          
          // Store original bytes for comparison
          const originalBytes = Buffer.from(content, 'utf8');
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: true,
            applyFormatting: true
          });
          
          // Compare bytes of original field
          const resultOriginalBytes = Buffer.from(result.original, 'utf8');
          
          return originalBytes.equals(resultOriginalBytes);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cleaned content should differ from original when transformations are applied
   * Validates: Requirements 9.1, 9.4
   */
  it('should produce different cleaned content when transformations are applied', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          // Content with encoding error
          const content = prefix + 'æ' + suffix;
          
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: false,
            applyFormatting: false,
            dryRun: false
          });
          
          // Original should be preserved
          if (result.original !== content) {
            return false;
          }
          
          // Cleaned should be different (æ replaced with ")
          return result.cleaned !== result.original;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without issues should have identical original and cleaned
   * Validates: Requirement 9.1
   */
  it('should have identical original and cleaned when no issues present', () => {
    // Generate content with only safe ASCII characters
    const safeContent = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', 'd', 'e', 'A', 'B', 'C', ' ', '\n', '.', ',', '0', '1', '2'),
      { minLength: 10, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        safeContent,
        (content) => {
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: true,
            applyFormatting: true
          });
          
          // Both should be identical when no transformations needed
          return result.original === content && result.cleaned === content;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Transformations should document all changes made
   * Validates: Requirement 9.5
   */
  it('should document all transformations for audit trail', () => {
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
            applyOcrCorrections: false,
            applyFormatting: false
          });
          
          // Should have transformation documented
          if (result.transformations.length === 0) {
            return false;
          }
          
          // Each transformation should have required audit fields
          return result.transformations.every(t => 
            typeof t.type === 'string' &&
            typeof t.count === 'number' &&
            t.count > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content should return empty strings for both original and cleaned
   * Validates: Requirement 9.1
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
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: true,
            applyFormatting: true
          });
          
          return typeof result.original === 'string' &&
                 typeof result.cleaned === 'string' &&
                 result.original === result.cleaned;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Quality assessment should not modify original content
   * Validates: Requirement 9.1
   */
  it('should not modify content during quality assessment', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          // Content with encoding error
          const content = prefix + 'æ' + suffix;
          const contentCopy = content.slice();
          
          // Run quality assessment
          BDLawQuality.validateContentQuality(content);
          
          // Original string should not be mutated
          return content === contentCopy;
        }
      ),
      { numRuns: 100 }
    );
  });
});
