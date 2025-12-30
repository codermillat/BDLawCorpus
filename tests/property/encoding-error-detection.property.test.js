/**
 * Property-Based Tests for Encoding Error Detection
 * 
 * Feature: data-quality-remediation, Property 3: Encoding Error Detection
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 * 
 * For any text containing encoding error characters (æ, ì, í, î, ï), the 
 * Quality_Validator SHALL detect all occurrences and return them with 
 * character, position, and context.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 3: Encoding Error Detection', () => {
  /**
   * Property: Corrupted quotation mark (æ) should be detected
   * Validates: Requirement 2.1
   */
  it('should detect all corrupted quotation marks (æ) with correct positions', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.'), { minLength: 0, maxLength: 50 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.'), { minLength: 0, maxLength: 50 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          const content = prefix + 'æ' + suffix;
          const expectedPosition = prefix.length;
          
          const issues = BDLawQuality.detectEncodingErrors(content);
          
          // Should detect exactly one encoding error
          if (issues.length !== 1) {
            return false;
          }
          
          const issue = issues[0];
          return issue.type === 'encoding_error' &&
                 issue.character === 'æ' &&
                 issue.position === expectedPosition;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Corrupted table border characters (ì, í, î, ï) should be detected
   * Validates: Requirement 2.2
   */
  it('should detect all corrupted table border characters with correct positions', () => {
    const tableBorderChars = ['ì', 'í', 'î', 'ï'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n'), { minLength: 0, maxLength: 50 }),
      borderChar: fc.constantFrom(...tableBorderChars),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n'), { minLength: 0, maxLength: 50 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, borderChar, suffix }) => {
          const content = prefix + borderChar + suffix;
          const expectedPosition = prefix.length;
          
          const issues = BDLawQuality.detectEncodingErrors(content);
          
          // Should detect exactly one encoding error
          if (issues.length !== 1) {
            return false;
          }
          
          const issue = issues[0];
          return issue.type === 'encoding_error' &&
                 issue.character === borderChar &&
                 issue.position === expectedPosition;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple encoding errors should all be detected
   * Validates: Requirements 2.1, 2.2
   */
  it('should detect multiple encoding errors in the same content', () => {
    const errorChars = ['æ', 'ì', 'í', 'î', 'ï'];
    
    const contentArbitrary = fc.record({
      char1: fc.constantFrom(...errorChars),
      char2: fc.constantFrom(...errorChars),
      separator: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 5, maxLength: 30 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ char1, char2, separator }) => {
          const content = char1 + separator + char2;
          
          const issues = BDLawQuality.detectEncodingErrors(content);
          
          // Should detect at least 2 encoding errors
          return issues.length >= 2 &&
                 issues.every(issue => issue.type === 'encoding_error');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context should be extracted (±20 chars around the error)
   * Validates: Requirement 2.4
   */
  it('should extract context around each encoding error (±20 chars)', () => {
    const contentArbitrary = fc.record({
      // Generate exactly 25 chars before and after to test context extraction
      prefix: fc.stringOf(fc.constantFrom('x'), { minLength: 25, maxLength: 25 }),
      suffix: fc.stringOf(fc.constantFrom('y'), { minLength: 25, maxLength: 25 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix }) => {
          const content = prefix + 'æ' + suffix;
          
          const issues = BDLawQuality.detectEncodingErrors(content);
          
          if (issues.length !== 1) {
            return false;
          }
          
          const issue = issues[0];
          
          // Context should contain the error character
          if (!issue.context.includes('æ')) {
            return false;
          }
          
          // Context should be approximately 41 chars (20 before + 1 char + 20 after)
          // Allow some flexibility for edge cases
          return issue.context.length >= 20 && issue.context.length <= 50;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each detected issue should have all required fields
   * Validates: Requirements 2.3, 2.4
   */
  it('should return issues with all required fields (type, character, position, context, description)', () => {
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
          
          const issues = BDLawQuality.detectEncodingErrors(content);
          
          if (issues.length === 0) {
            return false;
          }
          
          // Each issue should have all required fields
          return issues.every(issue => 
            issue.type === 'encoding_error' &&
            typeof issue.character === 'string' &&
            typeof issue.position === 'number' &&
            typeof issue.context === 'string' &&
            typeof issue.description === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content should return empty array
   */
  it('should return empty array for empty or null content', () => {
    const emptyInputs = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant(''),
      fc.constant('   ')
    );

    fc.assert(
      fc.property(
        emptyInputs,
        (content) => {
          const issues = BDLawQuality.detectEncodingErrors(content);
          return Array.isArray(issues) && issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without encoding errors should return empty array
   */
  it('should return empty array for content without encoding errors', () => {
    // Generate content with only safe ASCII characters
    const safeContent = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', 'd', 'e', 'A', 'B', 'C', ' ', '\n', '.', ',', '0', '1', '2'),
      { minLength: 1, maxLength: 200 }
    );

    fc.assert(
      fc.property(
        safeContent,
        (content) => {
          const issues = BDLawQuality.detectEncodingErrors(content);
          return Array.isArray(issues) && issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position should accurately reflect where the error appears in content
   */
  it('should return accurate positions for detected encoding errors', () => {
    const errorChars = ['æ', 'ì', 'í', 'î', 'ï'];
    
    const contentArbitrary = fc.record({
      prefixLength: fc.integer({ min: 0, max: 100 }),
      errorChar: fc.constantFrom(...errorChars)
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefixLength, errorChar }) => {
          const prefix = 'a'.repeat(prefixLength);
          const content = prefix + errorChar + 'suffix';
          const expectedPosition = prefixLength;
          
          const issues = BDLawQuality.detectEncodingErrors(content);
          
          if (issues.length === 0) {
            return false;
          }
          
          // Position should match where we placed the error
          return issues.some(issue => issue.position === expectedPosition);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Description should include the error character and position
   */
  it('should include error character and position in description', () => {
    const errorChars = ['æ', 'ì', 'í', 'î', 'ï'];
    
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 10, maxLength: 30 }),
      errorChar: fc.constantFrom(...errorChars)
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, errorChar }) => {
          const content = prefix + errorChar;
          
          const issues = BDLawQuality.detectEncodingErrors(content);
          
          if (issues.length === 0) {
            return false;
          }
          
          const issue = issues[0];
          // Description should mention the character and position
          return issue.description.includes(errorChar) &&
                 issue.description.includes(String(issue.position));
        }
      ),
      { numRuns: 100 }
    );
  });
});
