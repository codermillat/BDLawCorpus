/**
 * Property-Based Tests for Safe For ML Training Logic
 * 
 * Feature: legal-integrity-enhancement, Property 11: Safe For ML Training Logic
 * Validates: Requirements 9.5
 * 
 * For any act with numeric corruption risk, encoding ambiguity, missing schedules,
 * or heavy OCR correction, data_quality.safe_for_ml_training SHALL be false.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 11: Safe For ML Training Logic', () => {
  /**
   * Property: Content with encoding errors should NOT be safe for ML training
   * Validates: Requirement 9.5 - encoding ambiguity
   */
  it('should set safe_for_ml_training to false when encoding errors are detected', () => {
    // Generate content with encoding error patterns
    const encodingErrorPatterns = [
      'æ',  // Corrupted quotation mark
      'ì',  // Corrupted table border
      'í',
      'î',
      'ï'
    ];
    
    const errorArbitrary = fc.constantFrom(...encodingErrorPatterns);
    const prefixArbitrary = fc.string({ minLength: 0, maxLength: 50 });
    const suffixArbitrary = fc.string({ minLength: 0, maxLength: 50 });

    fc.assert(
      fc.property(
        prefixArbitrary,
        errorArbitrary,
        suffixArbitrary,
        (prefix, error, suffix) => {
          const content = `${prefix}${error}${suffix}`;
          const result = BDLawQuality.validateContentQuality(content);
          
          // If encoding_error flag is present, safe_for_ml_training should be false
          if (result.flags.includes('encoding_error')) {
            return result.safe_for_ml_training === false;
          }
          return true; // Skip if error wasn't detected
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content with missing schedules should NOT be safe for ML training
   * Validates: Requirement 9.5 - missing schedules
   */
  it('should set safe_for_ml_training to false when missing schedules are detected', () => {
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
          
          // If missing_schedule flag is present, safe_for_ml_training should be false
          if (result.flags.includes('missing_schedule')) {
            return result.safe_for_ml_training === false;
          }
          return true; // Skip if schedule wasn't detected as missing
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content with numeric corruption risk option should NOT be safe for ML training
   * Validates: Requirement 9.5 - numeric corruption risk
   */
  it('should set safe_for_ml_training to false when numeric corruption risk is flagged', () => {
    const contentArbitrary = fc.string({ minLength: 1, maxLength: 200 });

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content, null, {
            hasNumericCorruptionRisk: true
          });
          
          return result.safe_for_ml_training === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content with heavy OCR correction option should NOT be safe for ML training
   * Validates: Requirement 9.5 - heavy OCR correction
   */
  it('should set safe_for_ml_training to false when heavy OCR correction is flagged', () => {
    const contentArbitrary = fc.string({ minLength: 1, maxLength: 200 });

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content, null, {
            hasHeavyOcrCorrection: true
          });
          
          return result.safe_for_ml_training === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content with encoding ambiguity option should NOT be safe for ML training
   * Validates: Requirement 9.5 - encoding ambiguity
   */
  it('should set safe_for_ml_training to false when encoding ambiguity is flagged via options', () => {
    const contentArbitrary = fc.string({ minLength: 1, maxLength: 200 });

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content, null, {
            hasEncodingAmbiguity: true
          });
          
          return result.safe_for_ml_training === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content with missing schedules option should NOT be safe for ML training
   * Validates: Requirement 9.5 - missing schedules
   */
  it('should set safe_for_ml_training to false when missing schedules is flagged via options', () => {
    const contentArbitrary = fc.string({ minLength: 1, maxLength: 200 });

    fc.assert(
      fc.property(
        contentArbitrary,
        (content) => {
          const result = BDLawQuality.validateContentQuality(content, null, {
            hasMissingSchedules: true
          });
          
          return result.safe_for_ml_training === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Clean content without any risk factors should be safe for ML training
   * Validates: Requirement 9.5 - safe when none of the conditions apply
   */
  it('should set safe_for_ml_training to true when no risk factors are present', () => {
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
          
          // If no flags, safe_for_ml_training should be true
          if (result.flags.length === 0) {
            return result.safe_for_ml_training === true;
          }
          return true; // Skip if content happened to trigger issues
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple risk factors should all result in safe_for_ml_training being false
   * Validates: Requirement 9.5 - any of the conditions
   */
  it('should set safe_for_ml_training to false when multiple risk factors are present', () => {
    const riskCombinations = fc.record({
      hasNumericCorruptionRisk: fc.boolean(),
      hasEncodingAmbiguity: fc.boolean(),
      hasMissingSchedules: fc.boolean(),
      hasHeavyOcrCorrection: fc.boolean()
    });

    fc.assert(
      fc.property(
        riskCombinations,
        (options) => {
          const hasAnyRisk = options.hasNumericCorruptionRisk ||
                            options.hasEncodingAmbiguity ||
                            options.hasMissingSchedules ||
                            options.hasHeavyOcrCorrection;
          
          const result = BDLawQuality.validateContentQuality('Clean content', null, options);
          
          if (hasAnyRisk) {
            return result.safe_for_ml_training === false;
          } else {
            return result.safe_for_ml_training === true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: safe_for_ml_training should always be a boolean
   * Validates: Requirement 9.4
   */
  it('should always return safe_for_ml_training as a boolean regardless of input', () => {
    const contentArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant(''),
      fc.string({ minLength: 0, maxLength: 500 })
    );

    const optionsArbitrary = fc.oneof(
      fc.constant({}),
      fc.constant({ hasNumericCorruptionRisk: true }),
      fc.constant({ hasEncodingAmbiguity: true }),
      fc.constant({ hasMissingSchedules: true }),
      fc.constant({ hasHeavyOcrCorrection: true })
    );

    fc.assert(
      fc.property(
        contentArbitrary,
        optionsArbitrary,
        (content, options) => {
          const result = BDLawQuality.validateContentQuality(content, null, options);
          return typeof result.safe_for_ml_training === 'boolean';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: risks array should contain appropriate risk when safe_for_ml_training is false
   * Validates: Requirements 9.2, 9.5
   */
  it('should include appropriate risks in risks array when safe_for_ml_training is false', () => {
    const riskOptions = fc.record({
      hasNumericCorruptionRisk: fc.boolean(),
      hasEncodingAmbiguity: fc.boolean(),
      hasMissingSchedules: fc.boolean(),
      hasHeavyOcrCorrection: fc.boolean()
    });

    fc.assert(
      fc.property(
        riskOptions,
        (options) => {
          const result = BDLawQuality.validateContentQuality('Clean content', null, options);
          
          // Check that risks array contains expected risks
          if (options.hasNumericCorruptionRisk) {
            if (!result.risks.includes('numeric_corruption_risk')) return false;
          }
          if (options.hasHeavyOcrCorrection) {
            if (!result.risks.includes('heavy_ocr_correction')) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
