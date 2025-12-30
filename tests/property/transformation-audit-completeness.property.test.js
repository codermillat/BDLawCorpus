/**
 * Property-Based Tests for Transformation Audit Completeness
 * 
 * Feature: legal-integrity-enhancement, Property 4: Transformation Audit Completeness
 * Validates: Requirements 2.1, 2.5
 * 
 * For any transformation applied to content, the transformation_log SHALL contain
 * an entry with all required fields: transformation_type, original, corrected,
 * position, risk_level, applied, timestamp.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 4: Transformation Audit Completeness', () => {
  // Generator for transformation types (both non-semantic and potential-semantic)
  const transformationTypeGen = fc.constantFrom(
    // Non-semantic types
    'mojibake',
    'html_entity',
    'broken_unicode',
    'unicode_normalization',
    'encoding_fix',
    // Potential-semantic types
    'ocr_word_correction',
    'ocr_correction',
    'spelling_correction',
    'punctuation_change',
    'word_substitution',
    // Unknown type (should default to potential-semantic)
    'unknown_type'
  );

  // Generator for text strings (original and corrected)
  const textGen = fc.string({ minLength: 1, maxLength: 100 });

  // Generator for Bengali text
  const bengaliTextGen = fc.stringOf(
    fc.constantFrom(
      'আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', 'চ', 'ছ', 'জ', 'ঝ',
      'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব',
      'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', ' '
    ),
    { minLength: 1, maxLength: 50 }
  );

  // Generator for position (character offset)
  const positionGen = fc.nat({ max: 10000 });

  // Generator for complete transformation entry
  const transformationEntryGen = fc.record({
    transformation_type: transformationTypeGen,
    original: textGen,
    corrected: textGen,
    position: positionGen
  });

  /**
   * Property: Every logged transformation contains all required fields
   * Requirements: 2.1, 2.5
   */
  it('should include all required fields in every transformation log entry', () => {
    fc.assert(
      fc.property(
        transformationEntryGen,
        (entry) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, entry);

          // Log should have exactly one entry
          if (log.length !== 1) return false;

          const logEntry = log[0];

          // All required fields must exist
          const hasAllFields = (
            'transformation_type' in logEntry &&
            'original' in logEntry &&
            'corrected' in logEntry &&
            'position' in logEntry &&
            'risk_level' in logEntry &&
            'applied' in logEntry &&
            'timestamp' in logEntry
          );

          return hasAllFields;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: transformation_type is preserved exactly as provided
   * Requirements: 2.1
   */
  it('should preserve transformation_type exactly as provided', () => {
    fc.assert(
      fc.property(
        transformationEntryGen,
        (entry) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, entry);

          return log[0].transformation_type === entry.transformation_type;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: original text is preserved exactly
   * Requirements: 2.1
   */
  it('should preserve original text exactly as provided', () => {
    fc.assert(
      fc.property(
        transformationEntryGen,
        (entry) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, entry);

          return log[0].original === entry.original;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: corrected text is preserved exactly
   * Requirements: 2.1
   */
  it('should preserve corrected text exactly as provided', () => {
    fc.assert(
      fc.property(
        transformationEntryGen,
        (entry) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, entry);

          return log[0].corrected === entry.corrected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: position is preserved exactly
   * Requirements: 2.1
   */
  it('should preserve position exactly as provided', () => {
    fc.assert(
      fc.property(
        transformationEntryGen,
        (entry) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, entry);

          return log[0].position === entry.position;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: risk_level is always a valid value
   * Requirements: 2.1
   */
  it('should always have valid risk_level value', () => {
    fc.assert(
      fc.property(
        transformationEntryGen,
        (entry) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, entry);

          const validRiskLevels = ['non-semantic', 'potential-semantic'];
          return validRiskLevels.includes(log[0].risk_level);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: applied is always a boolean
   * Requirements: 2.1
   */
  it('should always have boolean applied field', () => {
    fc.assert(
      fc.property(
        transformationEntryGen,
        (entry) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, entry);

          return typeof log[0].applied === 'boolean';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: timestamp is a valid ISO string
   * Requirements: 2.1
   */
  it('should always have valid ISO timestamp', () => {
    fc.assert(
      fc.property(
        transformationEntryGen,
        (entry) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, entry);

          const timestamp = log[0].timestamp;
          // Check it's a string and can be parsed as a date
          if (typeof timestamp !== 'string') return false;
          
          const parsed = new Date(timestamp);
          return !isNaN(parsed.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple transformations are all logged
   * Requirements: 2.5 - transformation_log array in every exported act
   */
  it('should log all transformations when multiple are applied', () => {
    fc.assert(
      fc.property(
        fc.array(transformationEntryGen, { minLength: 1, maxLength: 20 }),
        (entries) => {
          const log = BDLawExtractor.createTransformationLog();
          
          entries.forEach(entry => {
            BDLawExtractor.logTransformation(log, entry);
          });

          // Log should have same number of entries as input
          return log.length === entries.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali text in transformations is preserved
   * Requirements: 2.1
   */
  it('should preserve Bengali text in original and corrected fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          transformation_type: transformationTypeGen,
          original: bengaliTextGen,
          corrected: bengaliTextGen,
          position: positionGen
        }),
        (entry) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, entry);

          return (
            log[0].original === entry.original &&
            log[0].corrected === entry.corrected
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty transformation log is valid
   * Requirements: 2.5
   */
  it('should create valid empty transformation log', () => {
    const log = BDLawExtractor.createTransformationLog();
    
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBe(0);
  });

  /**
   * Property: Log entries maintain order
   * Requirements: 2.5
   */
  it('should maintain transformation order in log', () => {
    fc.assert(
      fc.property(
        fc.array(transformationEntryGen, { minLength: 2, maxLength: 10 }),
        (entries) => {
          const log = BDLawExtractor.createTransformationLog();
          
          entries.forEach(entry => {
            BDLawExtractor.logTransformation(log, entry);
          });

          // Verify order is preserved
          for (let i = 0; i < entries.length; i++) {
            if (log[i].transformation_type !== entries[i].transformation_type) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
