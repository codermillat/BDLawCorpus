/**
 * Property-Based Tests for OCR Artifact Detection
 * 
 * Feature: data-quality-remediation, Property 4: OCR Artifact Detection
 * Validates: Requirements 3.1, 3.3, 3.4
 * 
 * For any text containing known OCR artifacts from the configured dictionary,
 * the Quality_Validator SHALL detect all occurrences and return them with
 * incorrect text, correct text, and position.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 4: OCR Artifact Detection', () => {
  // Get the OCR corrections from the config for testing
  const ocrCorrections = BDLawQuality.QUALITY_CONFIG.ocrCorrections;

  /**
   * Property: Known OCR artifacts should be detected with correct positions
   * Validates: Requirements 3.1, 3.4
   */
  it('should detect all known OCR artifacts with correct positions', () => {
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
          const expectedPosition = prefix.length;
          
          const issues = BDLawQuality.detectOcrArtifacts(content);
          
          // Should detect exactly one OCR artifact
          if (issues.length !== 1) {
            return false;
          }
          
          const issue = issues[0];
          return issue.type === 'ocr_artifact' &&
                 issue.incorrect === correction.incorrect &&
                 issue.correct === correction.correct &&
                 issue.position === expectedPosition;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each detected OCR artifact should have all required fields
   * Validates: Requirements 3.3, 3.4
   */
  it('should return issues with all required fields (type, incorrect, correct, position, context, description)', () => {
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
          
          const issues = BDLawQuality.detectOcrArtifacts(content);
          
          if (issues.length === 0) {
            return false;
          }
          
          // Each issue should have all required fields
          return issues.every(issue => 
            issue.type === 'ocr_artifact' &&
            typeof issue.incorrect === 'string' &&
            typeof issue.correct === 'string' &&
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
   * Property: Multiple OCR artifacts should all be detected
   * Validates: Requirements 3.1, 3.4
   */
  it('should detect multiple OCR artifacts in the same content', () => {
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
          
          const issues = BDLawQuality.detectOcrArtifacts(content);
          
          // Should detect exactly 2 OCR artifacts
          return issues.length === 2 &&
                 issues.every(issue => issue.type === 'ocr_artifact');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position should accurately reflect where the artifact appears in content
   * Validates: Requirement 3.4
   */
  it('should return accurate positions for detected OCR artifacts', () => {
    const contentArbitrary = fc.record({
      prefixLength: fc.integer({ min: 0, max: 100 }),
      correctionIndex: fc.integer({ min: 0, max: ocrCorrections.length - 1 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefixLength, correctionIndex }) => {
          const correction = ocrCorrections[correctionIndex];
          const prefix = 'a'.repeat(prefixLength);
          const content = prefix + correction.incorrect + 'suffix';
          const expectedPosition = prefixLength;
          
          const issues = BDLawQuality.detectOcrArtifacts(content);
          
          if (issues.length === 0) {
            return false;
          }
          
          // Position should match where we placed the artifact
          return issues.some(issue => issue.position === expectedPosition);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Description should include the incorrect and correct text
   * Validates: Requirement 3.4
   */
  it('should include incorrect and correct text in description', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 10, maxLength: 30 }),
      correctionIndex: fc.integer({ min: 0, max: ocrCorrections.length - 1 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, correctionIndex }) => {
          const correction = ocrCorrections[correctionIndex];
          const content = prefix + correction.incorrect;
          
          const issues = BDLawQuality.detectOcrArtifacts(content);
          
          if (issues.length === 0) {
            return false;
          }
          
          const issue = issues[0];
          // Description should mention the incorrect and correct text
          return issue.description.includes(correction.incorrect) &&
                 issue.description.includes(correction.correct);
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
          const issues = BDLawQuality.detectOcrArtifacts(content);
          return Array.isArray(issues) && issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without OCR artifacts should return empty array
   */
  it('should return empty array for content without OCR artifacts', () => {
    // Generate content with only safe ASCII characters that won't match OCR patterns
    const safeContent = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', 'd', 'e', 'A', 'B', 'C', ' ', '\n', '.', ',', '0', '1', '2'),
      { minLength: 1, maxLength: 200 }
    );

    fc.assert(
      fc.property(
        safeContent,
        (content) => {
          const issues = BDLawQuality.detectOcrArtifacts(content);
          return Array.isArray(issues) && issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context field should contain the correction context from config
   * Validates: Requirement 3.4
   */
  it('should include context from the OCR correction config', () => {
    const contentArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 5, maxLength: 20 }),
      suffix: fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 5, maxLength: 20 }),
      correctionIndex: fc.integer({ min: 0, max: ocrCorrections.length - 1 })
    });

    fc.assert(
      fc.property(
        contentArbitrary,
        ({ prefix, suffix, correctionIndex }) => {
          const correction = ocrCorrections[correctionIndex];
          const content = prefix + correction.incorrect + suffix;
          
          const issues = BDLawQuality.detectOcrArtifacts(content);
          
          if (issues.length === 0) {
            return false;
          }
          
          const issue = issues[0];
          // Context should match the correction's context from config
          return issue.context === correction.context;
        }
      ),
      { numRuns: 100 }
    );
  });
});
