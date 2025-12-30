/**
 * Property-Based Tests for Potential-Semantic Flag-Only Mode
 * 
 * Feature: legal-integrity-enhancement, Property 6: Potential-Semantic Flag-Only Mode
 * Validates: Requirements 2.4
 * 
 * For any transformation with risk_level "potential-semantic", the applied field
 * SHALL be false and content_corrected SHALL NOT contain the correction.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 6: Potential-Semantic Flag-Only Mode', () => {
  // Generator for potential-semantic transformation types
  const potentialSemanticTypeGen = fc.constantFrom(
    'ocr_word_correction',
    'ocr_correction',
    'spelling_correction',
    'punctuation_change',
    'word_substitution'
  );

  // Generator for non-semantic transformation types
  const nonSemanticTypeGen = fc.constantFrom(
    'mojibake',
    'html_entity',
    'broken_unicode',
    'unicode_normalization',
    'encoding_fix'
  );

  // Generator for text strings
  const textGen = fc.string({ minLength: 1, maxLength: 100 });

  // Generator for Bengali text
  const bengaliTextGen = fc.stringOf(
    fc.constantFrom(
      'আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', 'চ', 'ছ', 'জ', 'ঝ',
      'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব',
      'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', ' '
    ),
    { minLength: 5, maxLength: 50 }
  );

  // Generator for position
  const positionGen = fc.nat({ max: 10000 });

  /**
   * Property: Potential-semantic transformations have applied=false
   * Requirements: 2.4
   */
  it('should set applied=false for all potential-semantic transformations', () => {
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

          // applied must be false for potential-semantic
          return log[0].applied === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-semantic transformations have applied=true
   * Requirements: 2.4 (inverse - non-semantic should be applied)
   */
  it('should set applied=true for all non-semantic transformations', () => {
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

          // applied must be true for non-semantic
          return log[0].applied === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: logTransformation returns false for potential-semantic
   * Requirements: 2.4
   */
  it('should return false from logTransformation for potential-semantic types', () => {
    fc.assert(
      fc.property(
        potentialSemanticTypeGen,
        textGen,
        textGen,
        positionGen,
        (type, original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          const shouldApply = BDLawExtractor.logTransformation(log, {
            transformation_type: type,
            original,
            corrected,
            position
          });

          // Return value should be false (do not apply)
          return shouldApply === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: logTransformation returns true for non-semantic
   * Requirements: 2.4 (inverse)
   */
  it('should return true from logTransformation for non-semantic types', () => {
    fc.assert(
      fc.property(
        nonSemanticTypeGen,
        textGen,
        textGen,
        positionGen,
        (type, original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          const shouldApply = BDLawExtractor.logTransformation(log, {
            transformation_type: type,
            original,
            corrected,
            position
          });

          // Return value should be true (apply)
          return shouldApply === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: applyTransformation does NOT modify content_corrected for potential-semantic
   * Requirements: 2.4 - content_corrected SHALL NOT contain the correction
   */
  it('should NOT modify content_corrected for potential-semantic transformations', () => {
    fc.assert(
      fc.property(
        potentialSemanticTypeGen,
        fc.string({ minLength: 10, maxLength: 100 }),
        (type, baseContent) => {
          // Create three-version content
          const threeVersion = BDLawExtractor.createThreeVersionContent(baseContent);
          const log = BDLawExtractor.createTransformationLog();
          
          // Store original content_corrected
          const originalCorrected = threeVersion.content_corrected;
          
          // Try to apply a potential-semantic transformation
          const position = Math.min(5, baseContent.length - 1);
          const original = baseContent.substring(position, position + 3);
          const corrected = 'XXX'; // Different text
          
          BDLawExtractor.applyTransformation(threeVersion, log, {
            type: type,
            original: original,
            corrected: corrected,
            position: position
          });

          // content_corrected should NOT be modified
          return threeVersion.content_corrected === originalCorrected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: applyTransformation DOES modify content_corrected for non-semantic
   * Requirements: 2.4 (inverse - non-semantic should be applied)
   */
  it('should modify content_corrected for non-semantic transformations', () => {
    fc.assert(
      fc.property(
        nonSemanticTypeGen,
        fc.string({ minLength: 10, maxLength: 100 }),
        (type, baseContent) => {
          // Create three-version content
          const threeVersion = BDLawExtractor.createThreeVersionContent(baseContent);
          const log = BDLawExtractor.createTransformationLog();
          
          // Store original content_corrected
          const originalCorrected = threeVersion.content_corrected;
          
          // Apply a non-semantic transformation
          const position = Math.min(5, baseContent.length - 1);
          const originalText = baseContent.substring(position, Math.min(position + 3, baseContent.length));
          const correctedText = 'YYY'; // Different text
          
          // Only test if we have something to replace
          if (originalText.length === 0) return true;
          
          BDLawExtractor.applyTransformation(threeVersion, log, {
            type: type,
            original: originalText,
            corrected: correctedText,
            position: position
          });

          // content_corrected SHOULD be modified (different from original)
          return threeVersion.content_corrected !== originalCorrected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw is NEVER modified regardless of transformation type
   * Requirements: 2.4, 1.2 - content_raw immutability
   */
  it('should NEVER modify content_raw for any transformation type', () => {
    fc.assert(
      fc.property(
        fc.oneof(potentialSemanticTypeGen, nonSemanticTypeGen),
        fc.string({ minLength: 10, maxLength: 100 }),
        (type, baseContent) => {
          // Create three-version content
          const threeVersion = BDLawExtractor.createThreeVersionContent(baseContent);
          const log = BDLawExtractor.createTransformationLog();
          
          // Store original content_raw
          const originalRaw = threeVersion.content_raw;
          
          // Apply transformation
          const position = Math.min(5, baseContent.length - 1);
          const original = baseContent.substring(position, position + 3);
          
          BDLawExtractor.applyTransformation(threeVersion, log, {
            type: type,
            original: original,
            corrected: 'ZZZ',
            position: position
          });

          // content_raw must NEVER change
          return threeVersion.content_raw === originalRaw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getFlaggedTransformations returns only potential-semantic entries
   * Requirements: 2.4
   */
  it('should return only flagged (not applied) transformations from getFlaggedTransformations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            transformation_type: fc.oneof(potentialSemanticTypeGen, nonSemanticTypeGen),
            original: textGen,
            corrected: textGen,
            position: positionGen
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (entries) => {
          const log = BDLawExtractor.createTransformationLog();
          
          entries.forEach(entry => {
            BDLawExtractor.logTransformation(log, entry);
          });

          const flagged = BDLawExtractor.getFlaggedTransformations(log);
          
          // All flagged entries should have applied=false
          return flagged.every(entry => entry.applied === false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getAppliedTransformations returns only non-semantic entries
   * Requirements: 2.4
   */
  it('should return only applied transformations from getAppliedTransformations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            transformation_type: fc.oneof(potentialSemanticTypeGen, nonSemanticTypeGen),
            original: textGen,
            corrected: textGen,
            position: positionGen
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (entries) => {
          const log = BDLawExtractor.createTransformationLog();
          
          entries.forEach(entry => {
            BDLawExtractor.logTransformation(log, entry);
          });

          const applied = BDLawExtractor.getAppliedTransformations(log);
          
          // All applied entries should have applied=true
          return applied.every(entry => entry.applied === true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali text in potential-semantic transformations is preserved in log but not applied
   * Requirements: 2.4
   */
  it('should preserve Bengali text in flagged transformations without applying', () => {
    fc.assert(
      fc.property(
        potentialSemanticTypeGen,
        bengaliTextGen,
        bengaliTextGen,
        positionGen,
        (type, original, corrected, position) => {
          const log = BDLawExtractor.createTransformationLog();
          BDLawExtractor.logTransformation(log, {
            transformation_type: type,
            original,
            corrected,
            position
          });

          // Text should be preserved in log
          const preserved = log[0].original === original && log[0].corrected === corrected;
          // But not applied
          const notApplied = log[0].applied === false;
          
          return preserved && notApplied;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Flagged + Applied transformations sum equals total log entries
   * Requirements: 2.4
   */
  it('should have flagged + applied transformations equal total log entries', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            transformation_type: fc.oneof(potentialSemanticTypeGen, nonSemanticTypeGen),
            original: textGen,
            corrected: textGen,
            position: positionGen
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (entries) => {
          const log = BDLawExtractor.createTransformationLog();
          
          entries.forEach(entry => {
            BDLawExtractor.logTransformation(log, entry);
          });

          const flagged = BDLawExtractor.getFlaggedTransformations(log);
          const applied = BDLawExtractor.getAppliedTransformations(log);
          
          // Sum should equal total
          return flagged.length + applied.length === log.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});
