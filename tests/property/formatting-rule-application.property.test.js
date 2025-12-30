/**
 * Property-Based Tests for Formatting Rule Application
 * 
 * Feature: data-quality-remediation, Property 7: Formatting Rule Application
 * Validates: Requirements 6.1, 6.2, 6.4
 * 
 * For any text with list markers following semicolons or dandas, when formatting
 * rules are enabled, the Text_Cleaner SHALL insert line breaks before the markers
 * without changing any other content.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 7: Formatting Rule Application', () => {
  /**
   * Property: Bengali list markers following semicolons or dandas should have line breaks inserted
   * Validates: Requirement 6.1
   */
  it('should insert line breaks before Bengali list markers following semicolons or dandas', () => {
    const bengaliMarkers = ['(ক)', '(খ)', '(গ)', '(ঘ)', '(ঙ)', '(চ)', '(ছ)', '(জ)', '(ঝ)'];
    const separators = [';', '।'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 }),
      separator: fc.constantFrom(...separators),
      marker: fc.constantFrom(...bengaliMarkers),
      suffix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, separator, marker, suffix }) => {
          const content = prefix + separator + ' ' + marker + suffix;
          
          const result = BDLawQuality.applyFormattingRules(content);
          
          // The result should contain a newline before the marker
          const expectedPattern = separator + '\n' + marker;
          return result.content.includes(expectedPattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: English list markers following semicolons should have line breaks inserted
   * Validates: Requirement 6.2
   */
  it('should insert line breaks before English list markers following semicolons', () => {
    const englishMarkers = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(i)', '(j)'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', 'x', 'y'), { minLength: 5, maxLength: 30 }),
      marker: fc.constantFrom(...englishMarkers),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', 'x', 'y'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, marker, suffix }) => {
          const content = prefix + '; ' + marker + suffix;
          
          const result = BDLawQuality.applyFormattingRules(content);
          
          // The result should contain a newline before the marker
          const expectedPattern = ';\n' + marker;
          return result.content.includes(expectedPattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Formatting should preserve legal meaning (no content loss)
   * Validates: Requirement 6.4
   */
  it('should preserve all content except whitespace before list markers', () => {
    const bengaliMarkers = ['(ক)', '(খ)', '(গ)'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 }),
      marker: fc.constantFrom(...bengaliMarkers),
      suffix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, marker, suffix }) => {
          const content = prefix + '; ' + marker + suffix;
          
          const result = BDLawQuality.applyFormattingRules(content);
          
          // All original content parts should still be present
          const hasPrefix = result.content.includes(prefix);
          const hasMarker = result.content.includes(marker);
          const hasSuffix = result.content.includes(suffix);
          
          return hasPrefix && hasMarker && hasSuffix;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: dryRun mode should detect but not modify content
   * Validates: Requirement 6.4
   */
  it('should not modify content when dryRun is true', () => {
    const bengaliMarkers = ['(ক)', '(খ)', '(গ)'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 }),
      marker: fc.constantFrom(...bengaliMarkers),
      suffix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, marker, suffix }) => {
          const content = prefix + '; ' + marker + suffix;
          
          const result = BDLawQuality.applyFormattingRules(content, null, true);
          
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
   * Property: Transformations should track type, rule, and count
   * Validates: Requirements 6.1, 6.2
   */
  it('should track transformations with type, rule, and count', () => {
    const bengaliMarkers = ['(ক)', '(খ)', '(গ)'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 }),
      marker: fc.constantFrom(...bengaliMarkers),
      suffix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, marker, suffix }) => {
          const content = prefix + '; ' + marker + suffix;
          
          const result = BDLawQuality.applyFormattingRules(content);
          
          if (result.transformations.length === 0) {
            return false;
          }
          
          // Each transformation should have required fields
          return result.transformations.every(t => 
            t.type === 'formatting' &&
            typeof t.rule === 'string' &&
            typeof t.count === 'number' &&
            t.count > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Disabled rules should not apply transformations
   * Validates: Requirement 6.3
   */
  it('should not apply transformations when rules are disabled', () => {
    const bengaliMarkers = ['(ক)', '(খ)', '(গ)'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 }),
      marker: fc.constantFrom(...bengaliMarkers),
      suffix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', 'a', 'b'), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, marker, suffix }) => {
          const content = prefix + '; ' + marker + suffix;
          
          // Create config with disabled formatting rules
          const disabledConfig = {
            ...BDLawQuality.QUALITY_CONFIG,
            formattingRules: {
              bengaliListSeparation: {
                enabled: false,
                pattern: BDLawQuality.QUALITY_CONFIG.formattingRules.bengaliListSeparation.pattern,
                replacement: BDLawQuality.QUALITY_CONFIG.formattingRules.bengaliListSeparation.replacement
              },
              englishListSeparation: {
                enabled: false,
                pattern: BDLawQuality.QUALITY_CONFIG.formattingRules.englishListSeparation.pattern,
                replacement: BDLawQuality.QUALITY_CONFIG.formattingRules.englishListSeparation.replacement
              }
            }
          };
          
          const result = BDLawQuality.applyFormattingRules(content, disabledConfig);
          
          // Content should remain unchanged when rules are disabled
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
   * Property: Content without list markers should return unchanged
   */
  it('should return unchanged content when no list markers present', () => {
    // Generate content without list markers
    const safeContent = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', 'd', 'e', 'A', 'B', 'C', ' ', '\n', '.', ',', '0', '1', '2'),
      { minLength: 1, maxLength: 200 }
    );

    fc.assert(
      fc.property(
        safeContent,
        (content) => {
          const result = BDLawQuality.applyFormattingRules(content);
          
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
          const result = BDLawQuality.applyFormattingRules(content);
          
          return typeof result.content === 'string' &&
                 Array.isArray(result.transformations) &&
                 result.transformations.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple list markers should all be formatted
   */
  it('should format multiple list markers in the same content', () => {
    const contentArbitrary = fc.record({
      separator: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 20 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ separator }) => {
          // Content with multiple Bengali list markers
          const content = 'text; (ক)' + separator + '; (খ)' + separator + '; (গ)end';
          
          const result = BDLawQuality.applyFormattingRules(content);
          
          // Should have newlines before each marker
          const hasFirstNewline = result.content.includes(';\n(ক)');
          const hasSecondNewline = result.content.includes(';\n(খ)');
          const hasThirdNewline = result.content.includes(';\n(গ)');
          
          return hasFirstNewline && hasSecondNewline && hasThirdNewline;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Transformation count should match actual occurrences
   */
  it('should accurately count the number of formatting changes made', () => {
    const countArbitrary = fc.integer({ min: 1, max: 5 });
    
    fc.assert(
      fc.property(
        countArbitrary,
        (count) => {
          // Create content with exactly 'count' Bengali list markers after semicolons
          const markers = ['(ক)', '(খ)', '(গ)', '(ঘ)', '(ঙ)'];
          let content = 'start';
          for (let i = 0; i < count; i++) {
            content += '; ' + markers[i] + ' text';
          }
          
          const result = BDLawQuality.applyFormattingRules(content);
          
          // Find the transformation for Bengali list separation
          const bengaliTransform = result.transformations.find(
            t => t.rule === 'bengali_list_separation'
          );
          
          if (!bengaliTransform) {
            return false;
          }
          
          // Count should match the number of markers
          return bengaliTransform.count === count;
        }
      ),
      { numRuns: 100 }
    );
  });
});
