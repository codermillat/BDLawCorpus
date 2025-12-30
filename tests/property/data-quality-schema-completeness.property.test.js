/**
 * Property-Based Tests for Data Quality Schema Completeness
 * 
 * Feature: data-quality-remediation, Property 8: Data Quality Schema Completeness
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 9.1-9.6, 10.1-10.4
 * 
 * For any exported act, the data_quality object SHALL contain completeness 
 * (one of "complete", "textual_partial", "uncertain"), flags (array of valid flag strings), 
 * issues (array of strings), risks, known_limitations, safe_for_ml_training, and intended_ml_use.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 8: Data Quality Schema Completeness', () => {
  // Valid completeness values per schema
  // Requirements: 10.1 - "partial" renamed to "textual_partial"
  const VALID_COMPLETENESS_VALUES = ['complete', 'textual_partial', 'uncertain'];
  
  // Valid flag values per schema
  const VALID_FLAG_VALUES = [
    'missing_schedule',
    'encoding_error',
    'ocr_artifact',
    'formatting_density',
    'cleaning_applied'
  ];

  /**
   * Property: data_quality object should always contain completeness field
   * Validates: Requirement 7.2
   */
  it('should always return data_quality with completeness field', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 500 })
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          return result !== null &&
                 result !== undefined &&
                 typeof result === 'object' &&
                 'completeness' in result;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: completeness should be one of valid enum values
   * Validates: Requirement 7.2, 10.1
   */
  it('should return completeness as one of: complete, textual_partial, uncertain', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(''),
      fc.string({ minLength: 1, maxLength: 200 }),
      fc.constant('First Schedule mentioned here'),
      fc.constant('Content with æ encoding error'),
      fc.constant('Content with প্রম্্নফ OCR artifact')
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          return VALID_COMPLETENESS_VALUES.includes(result.completeness);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: data_quality object should always contain flags array
   * Validates: Requirement 7.3
   */
  it('should always return data_quality with flags array', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 500 })
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          return 'flags' in result &&
                 Array.isArray(result.flags);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: flags array should only contain valid flag strings
   * Validates: Requirement 7.3
   */
  it('should only contain valid flag strings in flags array', () => {
    // Generate content that may trigger various flags
    const contentArbitrary = fc.oneof(
      fc.constant('Clean content without issues'),
      fc.constant('First Schedule referenced here'),
      fc.constant('Content with æ corrupted quote'),
      fc.constant('Content with ì table border'),
      fc.constant('Content with প্রম্্নফ OCR typo'),
      fc.constant('First Schedule æ প্রম্্নফ combined issues')
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          // All flags should be valid flag values
          return result.flags.every(flag => VALID_FLAG_VALUES.includes(flag));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: data_quality object should always contain issues array
   * Validates: Requirement 7.4
   */
  it('should always return data_quality with issues array', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 500 })
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          return 'issues' in result &&
                 Array.isArray(result.issues);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: issues array should contain only strings
   * Validates: Requirement 7.4
   */
  it('should only contain strings in issues array', () => {
    // Generate content that triggers issues
    const contentArbitrary = fc.oneof(
      fc.constant('First Schedule referenced here'),
      fc.constant('Content with æ corrupted quote'),
      fc.constant('Content with প্রম্্নফ OCR typo'),
      fc.constant('Multiple issues: First Schedule æ প্রম্্নফ')
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          // All issues should be strings
          return result.issues.every(issue => typeof issue === 'string');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When no issues detected, completeness should be "complete" and flags empty
   * Validates: Requirement 7.5
   */
  it('should set completeness to "complete" and flags to empty when no issues detected', () => {
    // Generate clean content without any issues
    const cleanContentArbitrary = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', 'd', 'e', 'A', 'B', 'C', ' ', '\n', '.', ','),
      { minLength: 1, maxLength: 200 }
    );

    fc.assert(
      fc.property(
        cleanContentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          // If no flags, completeness should be "complete"
          if (result.flags.length === 0) {
            return result.completeness === 'complete' &&
                   result.issues.length === 0;
          }
          return true; // Skip if content happened to trigger issues
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When missing_schedule flag is present, completeness should be "textual_partial"
   * Validates: Requirement 7.2, 10.1
   */
  it('should set completeness to "textual_partial" when missing_schedule flag is present', () => {
    // Generate content with schedule references but insufficient content after
    const schedulePatterns = [
      'First Schedule',
      'Second Schedule',
      'Appendix A',
      'তফসিল',
      'প্রথম তফসিল'
    ];
    
    const scheduleArbitrary = fc.constantFrom(...schedulePatterns);

    fc.assert(
      fc.property(
        scheduleArbitrary,
        (scheduleRef) => {
          // Content with schedule reference but less than 500 chars after
          const content = `Some text before ${scheduleRef} and short content after.`;
          const result = BDLawQuality.validateContentQuality(content);
          
          // If missing_schedule flag is present, completeness should be textual_partial
          if (result.flags.includes('missing_schedule')) {
            return result.completeness === 'textual_partial';
          }
          return true; // Skip if schedule wasn't detected as missing
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: encoding_error and ocr_artifact flags should not affect completeness
   * Validates: Requirement 7.2
   */
  it('should keep completeness as "complete" when only encoding_error or ocr_artifact flags present', () => {
    // Generate content with encoding errors but no missing schedules
    const errorContentArbitrary = fc.oneof(
      fc.constant('Content with æ encoding error only'),
      fc.constant('Content with ì table border only'),
      fc.constant('Content with প্রম্্নফ OCR artifact only'),
      fc.constant('Multiple errors: æ ì í î ï')
    );

    fc.assert(
      fc.property(
        errorContentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          // If only encoding_error or ocr_artifact flags (no missing_schedule)
          const hasOnlyQualityFlags = result.flags.every(
            flag => flag === 'encoding_error' || flag === 'ocr_artifact'
          );
          
          if (hasOnlyQualityFlags && result.flags.length > 0) {
            return result.completeness === 'complete';
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Number of issues should match number of detected problems
   * Validates: Requirements 7.3, 7.4
   */
  it('should have consistent relationship between flags and issues', () => {
    const contentArbitrary = fc.oneof(
      fc.constant('Clean content'),
      fc.constant('Content with æ error'),
      fc.constant('First Schedule short'),
      fc.constant('Multiple: æ ì First Schedule প্রম্্নফ')
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          // If there are flags, there should be issues
          if (result.flags.length > 0) {
            return result.issues.length > 0;
          }
          
          // If no flags, there should be no issues
          return result.issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content should return valid empty assessment
   * Validates: Requirements 7.1, 7.5
   */
  it('should return valid empty assessment for empty or null content', () => {
    const emptyInputs = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant('')
    );

    fc.assert(
      fc.property(
        emptyInputs,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          
          return result.completeness === 'complete' &&
                 Array.isArray(result.flags) &&
                 result.flags.length === 0 &&
                 Array.isArray(result.issues) &&
                 result.issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Result object should have all required fields for enhanced schema
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 9.1-9.6, 10.1-10.4
   */
  it('should return object with all required enhanced data quality fields', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(''),
      fc.string({ minLength: 1, maxLength: 300 }),
      fc.constant('First Schedule æ প্রম্্নফ')
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          const keys = Object.keys(result);
          
          // Requirements: 9.1-9.6, 10.1-10.4 - Enhanced schema fields
          return keys.includes('completeness') &&
                 keys.includes('completeness_disclaimer') &&
                 keys.includes('flags') &&
                 keys.includes('issues') &&
                 keys.includes('risks') &&
                 keys.includes('known_limitations') &&
                 keys.includes('safe_for_ml_training') &&
                 keys.includes('intended_ml_use');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: risks should be an array
   * Validates: Requirement 9.2
   */
  it('should always return risks as an array', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 500 })
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          return Array.isArray(result.risks);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: known_limitations should be an array
   * Validates: Requirement 9.3
   */
  it('should always return known_limitations as an array', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 500 })
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          return Array.isArray(result.known_limitations);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: safe_for_ml_training should be a boolean
   * Validates: Requirement 9.4
   */
  it('should always return safe_for_ml_training as a boolean', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 500 })
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          return typeof result.safe_for_ml_training === 'boolean';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: intended_ml_use should be an array with expected values
   * Validates: Requirement 9.6
   */
  it('should always return intended_ml_use as an array with retrieval and extractive_question_answering', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 500 })
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          return Array.isArray(result.intended_ml_use) &&
                 result.intended_ml_use.includes('retrieval') &&
                 result.intended_ml_use.includes('extractive_question_answering');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: completeness_disclaimer should always be present
   * Validates: Requirement 10.2
   */
  it('should always include completeness_disclaimer', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 500 })
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content);
          return typeof result.completeness_disclaimer === 'string' &&
                 result.completeness_disclaimer.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
