/**
 * Property-Based Tests for Risk Level Classification
 * 
 * Feature: legal-integrity-enhancement, Property 5: Risk Level Classification
 * Validates: Requirements 2.2, 2.3
 * 
 * For any encoding fix (mojibake, HTML entity, broken Unicode), risk_level SHALL
 * be "non-semantic". For any OCR word correction, risk_level SHALL be "potential-semantic".
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 5: Risk Level Classification', () => {
  // Generator for non-semantic transformation types (encoding fixes)
  // Requirements: 2.2 - Encoding fixes are non-semantic
  const nonSemanticTypeGen = fc.constantFrom(
    'mojibake',
    'html_entity',
    'broken_unicode',
    'unicode_normalization',
    'encoding_fix'
  );

  // Generator for potential-semantic transformation types (OCR corrections)
  // Requirements: 2.3 - OCR corrections are potential-semantic
  const potentialSemanticTypeGen = fc.constantFrom(
    'ocr_word_correction',
    'ocr_correction',
    'spelling_correction',
    'punctuation_change',
    'word_substitution'
  );

  // Generator for unknown transformation types
  // Filter out known types and JavaScript reserved property names
  const jsReservedProps = ['constructor', 'prototype', '__proto__', 'hasOwnProperty', 'toString', 'valueOf'];
  const unknownTypeGen = fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => 
      !Object.keys(BDLawExtractor.RISK_CLASSIFICATION).includes(s) &&
      !jsReservedProps.includes(s)
    );

  // Generator for text strings
  const textGen = fc.string({ minLength: 1, maxLength: 100 });

  // Generator for position
  const positionGen = fc.nat({ max: 10000 });

  /**
   * Property: Encoding fixes (mojibake) are classified as non-semantic
   * Requirements: 2.2
   */
  it('should classify mojibake as non-semantic', () => {
    fc.assert(
      fc.property(
        textGen,
        textGen,
        positionGen,
        (original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: 'mojibake',
            original,
            corrected,
            position
          });

          return log[0].risk_level === 'non-semantic';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: HTML entity fixes are classified as non-semantic
   * Requirements: 2.2
   */
  it('should classify html_entity as non-semantic', () => {
    fc.assert(
      fc.property(
        textGen,
        textGen,
        positionGen,
        (original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: 'html_entity',
            original,
            corrected,
            position
          });

          return log[0].risk_level === 'non-semantic';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Broken Unicode fixes are classified as non-semantic
   * Requirements: 2.2
   */
  it('should classify broken_unicode as non-semantic', () => {
    fc.assert(
      fc.property(
        textGen,
        textGen,
        positionGen,
        (original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: 'broken_unicode',
            original,
            corrected,
            position
          });

          return log[0].risk_level === 'non-semantic';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All non-semantic types are classified correctly
   * Requirements: 2.2
   */
  it('should classify all encoding fix types as non-semantic', () => {
    fc.assert(
      fc.property(
        nonSemanticTypeGen,
        textGen,
        textGen,
        positionGen,
        (type, original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: type,
            original,
            corrected,
            position
          });

          return log[0].risk_level === 'non-semantic';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: OCR word corrections are classified as potential-semantic
   * Requirements: 2.3
   */
  it('should classify ocr_word_correction as potential-semantic', () => {
    fc.assert(
      fc.property(
        textGen,
        textGen,
        positionGen,
        (original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: 'ocr_word_correction',
            original,
            corrected,
            position
          });

          return log[0].risk_level === 'potential-semantic';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: OCR corrections are classified as potential-semantic
   * Requirements: 2.3
   */
  it('should classify ocr_correction as potential-semantic', () => {
    fc.assert(
      fc.property(
        textGen,
        textGen,
        positionGen,
        (original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: 'ocr_correction',
            original,
            corrected,
            position
          });

          return log[0].risk_level === 'potential-semantic';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Spelling corrections are classified as potential-semantic
   * Requirements: 2.3
   */
  it('should classify spelling_correction as potential-semantic', () => {
    fc.assert(
      fc.property(
        textGen,
        textGen,
        positionGen,
        (original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: 'spelling_correction',
            original,
            corrected,
            position
          });

          return log[0].risk_level === 'potential-semantic';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All potential-semantic types are classified correctly
   * Requirements: 2.3
   */
  it('should classify all OCR/spelling types as potential-semantic', () => {
    fc.assert(
      fc.property(
        potentialSemanticTypeGen,
        textGen,
        textGen,
        positionGen,
        (type, original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: type,
            original,
            corrected,
            position
          });

          return log[0].risk_level === 'potential-semantic';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Unknown transformation types default to potential-semantic
   * Requirements: 2.3 - Conservative default for safety
   */
  it('should classify unknown types as potential-semantic (conservative default)', () => {
    fc.assert(
      fc.property(
        unknownTypeGen,
        textGen,
        textGen,
        positionGen,
        (type, original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: type,
            original,
            corrected,
            position
          });

          // Unknown types should default to potential-semantic for safety
          return log[0].risk_level === 'potential-semantic';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getRiskLevel returns correct classification
   * Requirements: 2.2, 2.3
   */
  it('should return correct risk level via getRiskLevel helper', () => {
    fc.assert(
      fc.property(
        fc.oneof(nonSemanticTypeGen, potentialSemanticTypeGen),
        (type) => {
          const riskLevel = BDLawExtractor.getRiskLevel(type);
          const expectedLevel = BDLawExtractor.RISK_CLASSIFICATION[type];
          
          return riskLevel === expectedLevel;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isTransformationSafe returns true only for non-semantic
   * Requirements: 2.2, 2.3
   */
  it('should return true from isTransformationSafe only for non-semantic types', () => {
    fc.assert(
      fc.property(
        nonSemanticTypeGen,
        (type) => {
          return BDLawExtractor.isTransformationSafe(type) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isTransformationSafe returns false for potential-semantic
   * Requirements: 2.2, 2.3
   */
  it('should return false from isTransformationSafe for potential-semantic types', () => {
    fc.assert(
      fc.property(
        potentialSemanticTypeGen,
        (type) => {
          return BDLawExtractor.isTransformationSafe(type) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: RISK_CLASSIFICATION mapping is complete for known types
   * Requirements: 2.2, 2.3
   */
  it('should have complete RISK_CLASSIFICATION mapping', () => {
    const expectedNonSemantic = ['mojibake', 'html_entity', 'broken_unicode', 'unicode_normalization', 'encoding_fix'];
    const expectedPotentialSemantic = ['ocr_word_correction', 'ocr_correction', 'spelling_correction', 'punctuation_change', 'word_substitution'];

    // All non-semantic types should be in mapping
    for (const type of expectedNonSemantic) {
      expect(BDLawExtractor.RISK_CLASSIFICATION[type]).toBe('non-semantic');
    }

    // All potential-semantic types should be in mapping
    for (const type of expectedPotentialSemantic) {
      expect(BDLawExtractor.RISK_CLASSIFICATION[type]).toBe('potential-semantic');
    }
  });
});
