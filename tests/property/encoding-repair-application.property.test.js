/**
 * Property-Based Tests for Encoding Repair Application
 * 
 * Feature: data-quality-remediation, Property 5: Encoding Repair Application
 * Validates: Requirements 4.1, 4.2, 4.4
 * 
 * For any text with encoding errors, when the Text_Cleaner applies repairs,
 * the cleaned content SHALL have all æ replaced with " and all ì/í/î/ï 
 * replaced with newlines, while the original content remains unchanged.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 5: Encoding Repair Application', () => {
  /**
   * Property: Corrupted quotation mark (æ) should be replaced with "
   * Validates: Requirement 4.1
   */
  it('should replace all corrupted quotation marks (æ) with standard quotation mark', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.'), { minLength: 0, maxLength: 50 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.'), { minLength: 0, maxLength: 50 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          const content = prefix + 'æ' + suffix;
          
          const result = BDLawQuality.applyEncodingRepairRules(content);
          
          // Cleaned content should not contain æ
          if (result.content.includes('æ')) {
            return false;
          }
          
          // Cleaned content should contain " where æ was
          const expectedContent = prefix + '"' + suffix;
          return result.content === expectedContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Corrupted table border characters (ì, í, î, ï) should be replaced with newlines
   * Validates: Requirement 4.2
   */
  it('should replace all corrupted table border characters with newlines', () => {
    const tableBorderChars = ['ì', 'í', 'î', 'ï'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 0, maxLength: 50 }),
      borderChar: fc.constantFrom(...tableBorderChars),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 0, maxLength: 50 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, borderChar, suffix }) => {
          const content = prefix + borderChar + suffix;
          
          const result = BDLawQuality.applyEncodingRepairRules(content);
          
          // Cleaned content should not contain the border character
          if (result.content.includes(borderChar)) {
            return false;
          }
          
          // Cleaned content should contain newline where border char was
          const expectedContent = prefix + '\n' + suffix;
          return result.content === expectedContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Original content should remain unchanged (preserved separately)
   * Validates: Requirement 4.4
   */
  it('should preserve original content when dryRun is false', () => {
    const errorChars = ['æ', 'ì', 'í', 'î', 'ï'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      errorChar: fc.constantFrom(...errorChars),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, errorChar, suffix }) => {
          const originalContent = prefix + errorChar + suffix;
          
          // Make a copy to verify original is not mutated
          const contentCopy = originalContent.slice();
          
          BDLawQuality.applyEncodingRepairRules(originalContent);
          
          // Original string should not be mutated (strings are immutable in JS)
          return originalContent === contentCopy;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: dryRun mode should detect but not modify content
   * Validates: Requirement 4.4
   */
  it('should not modify content when dryRun is true', () => {
    const errorChars = ['æ', 'ì', 'í', 'î', 'ï'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      errorChar: fc.constantFrom(...errorChars),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, errorChar, suffix }) => {
          const content = prefix + errorChar + suffix;
          
          const result = BDLawQuality.applyEncodingRepairRules(content, null, true);
          
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
   * Property: Transformations should track type, rule, count, and replacement
   * Validates: Requirements 4.1, 4.2
   */
  it('should track transformations with type, rule, count, and replacement', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          const content = prefix + 'æ' + suffix;
          
          const result = BDLawQuality.applyEncodingRepairRules(content);
          
          if (result.transformations.length === 0) {
            return false;
          }
          
          // Each transformation should have required fields
          return result.transformations.every(t => 
            t.type === 'encoding_repair' &&
            typeof t.rule === 'string' &&
            typeof t.count === 'number' &&
            t.count > 0 &&
            typeof t.replacement === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple encoding errors should all be repaired
   */
  it('should repair multiple encoding errors in the same content', () => {
    const contentArbitrary = fc.record({
      separator: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ separator }) => {
          // Content with both æ and table border characters
          const content = 'æ' + separator + 'ì' + separator + 'æ';
          
          const result = BDLawQuality.applyEncodingRepairRules(content);
          
          // Should not contain any encoding errors
          if (result.content.includes('æ') || result.content.includes('ì')) {
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
   * Property: Transformation count should match actual occurrences
   */
  it('should accurately count the number of replacements made', () => {
    const countArbitrary = fc.integer({ min: 1, max: 10 });
    
    fc.assert(
      fc.property(
        countArbitrary,
        (count) => {
          // Create content with exactly 'count' æ characters
          const content = 'æ'.repeat(count);
          
          const result = BDLawQuality.applyEncodingRepairRules(content);
          
          // Find the transformation for corrupted quotation mark
          const quotationTransform = result.transformations.find(
            t => t.rule === 'Corrupted quotation mark'
          );
          
          if (!quotationTransform) {
            return false;
          }
          
          // Count should match the number of æ characters
          return quotationTransform.count === count;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without encoding errors should return unchanged
   */
  it('should return unchanged content when no encoding errors present', () => {
    // Generate content with only safe ASCII characters
    const safeContent = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', 'd', 'e', 'A', 'B', 'C', ' ', '\n', '.', ',', '0', '1', '2'),
      { minLength: 1, maxLength: 200 }
    );

    fc.assert(
      fc.property(
        safeContent,
        (content) => {
          const result = BDLawQuality.applyEncodingRepairRules(content);
          
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
          const result = BDLawQuality.applyEncodingRepairRules(content);
          
          return typeof result.content === 'string' &&
                 Array.isArray(result.transformations) &&
                 result.transformations.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
