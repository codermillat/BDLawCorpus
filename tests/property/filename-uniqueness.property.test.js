/**
 * Property-Based Tests for Filename Uniqueness
 * 
 * Feature: bdlawcorpus-mode, Property 9: Filename Uniqueness
 * Validates: Requirements 5.6, 12.4
 * 
 * Property: For any two exports with different act numbers or timestamps,
 * the generated filenames SHALL be different
 */

const fc = require('fast-check');
const BDLawExport = require('../../bdlaw-export.js');

describe('Property 9: Filename Uniqueness', () => {
  /**
   * Generator for act numbers (1-6 digits)
   */
  const actNumberArb = fc.stringMatching(/^[0-9]{1,6}$/);

  /**
   * Generator for volume numbers (1-3 digits)
   */
  const volumeNumberArb = fc.stringMatching(/^[0-9]{1,3}$/);

  /**
   * Generator for valid timestamps (Date objects within reasonable range)
   */
  const timestampArb = fc.date({
    min: new Date('2020-01-01T00:00:00Z'),
    max: new Date('2030-12-31T23:59:59Z')
  });

  /**
   * Property: Different act numbers produce different filenames (same timestamp)
   */
  it('should generate different filenames for different act numbers with same timestamp', () => {
    fc.assert(
      fc.property(
        actNumberArb,
        actNumberArb,
        timestampArb,
        (actNum1, actNum2, timestamp) => {
          // Skip if act numbers are the same
          if (actNum1 === actNum2) return true;
          
          const filename1 = BDLawExport.generateActFilename(actNum1, timestamp);
          const filename2 = BDLawExport.generateActFilename(actNum2, timestamp);
          
          return filename1 !== filename2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different timestamps produce different filenames (same act number)
   */
  it('should generate different filenames for different timestamps with same act number', () => {
    fc.assert(
      fc.property(
        actNumberArb,
        timestampArb,
        timestampArb,
        (actNum, timestamp1, timestamp2) => {
          // Skip if timestamps are the same (to the second)
          const ts1 = BDLawExport._formatTimestampForFilename(timestamp1);
          const ts2 = BDLawExport._formatTimestampForFilename(timestamp2);
          if (ts1 === ts2) return true;
          
          const filename1 = BDLawExport.generateActFilename(actNum, timestamp1);
          const filename2 = BDLawExport.generateActFilename(actNum, timestamp2);
          
          return filename1 !== filename2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different volume numbers produce different filenames (same timestamp)
   */
  it('should generate different filenames for different volume numbers with same timestamp', () => {
    fc.assert(
      fc.property(
        volumeNumberArb,
        volumeNumberArb,
        timestampArb,
        (volNum1, volNum2, timestamp) => {
          // Skip if volume numbers are the same
          if (volNum1 === volNum2) return true;
          
          const filename1 = BDLawExport.generateVolumeFilename(volNum1, timestamp);
          const filename2 = BDLawExport.generateVolumeFilename(volNum2, timestamp);
          
          return filename1 !== filename2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different timestamps produce different volume filenames (same volume number)
   */
  it('should generate different volume filenames for different timestamps with same volume number', () => {
    fc.assert(
      fc.property(
        volumeNumberArb,
        timestampArb,
        timestampArb,
        (volNum, timestamp1, timestamp2) => {
          // Skip if timestamps are the same (to the second)
          const ts1 = BDLawExport._formatTimestampForFilename(timestamp1);
          const ts2 = BDLawExport._formatTimestampForFilename(timestamp2);
          if (ts1 === ts2) return true;
          
          const filename1 = BDLawExport.generateVolumeFilename(volNum, timestamp1);
          const filename2 = BDLawExport.generateVolumeFilename(volNum, timestamp2);
          
          return filename1 !== filename2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Act and volume filenames are always different (even with same number)
   */
  it('should generate different filenames for act vs volume with same number and timestamp', () => {
    fc.assert(
      fc.property(
        actNumberArb,
        timestampArb,
        (num, timestamp) => {
          const actFilename = BDLawExport.generateActFilename(num, timestamp);
          const volumeFilename = BDLawExport.generateVolumeFilename(num, timestamp);
          
          return actFilename !== volumeFilename;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filenames follow the expected format
   */
  it('should generate act filenames matching expected format', () => {
    fc.assert(
      fc.property(
        actNumberArb,
        timestampArb,
        (actNum, timestamp) => {
          const filename = BDLawExport.generateActFilename(actNum, timestamp);
          
          // Should match pattern: bdlaw_act_{num}_{timestamp}.json
          const pattern = /^bdlaw_act_[0-9]+_[0-9]{8}_[0-9]{6}\.json$/;
          return pattern.test(filename);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Volume filenames follow the expected format
   */
  it('should generate volume filenames matching expected format', () => {
    fc.assert(
      fc.property(
        volumeNumberArb,
        timestampArb,
        (volNum, timestamp) => {
          const filename = BDLawExport.generateVolumeFilename(volNum, timestamp);
          
          // Should match pattern: bdlaw_volume_{num}_{timestamp}.json
          const pattern = /^bdlaw_volume_[0-9]+_[0-9]{8}_[0-9]{6}\.json$/;
          return pattern.test(filename);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filenames are deterministic (same inputs produce same output)
   */
  it('should generate deterministic filenames for same inputs', () => {
    fc.assert(
      fc.property(
        actNumberArb,
        timestampArb,
        (actNum, timestamp) => {
          const filename1 = BDLawExport.generateActFilename(actNum, timestamp);
          const filename2 = BDLawExport.generateActFilename(actNum, timestamp);
          
          return filename1 === filename2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filenames contain no invalid characters
   */
  it('should generate filenames with no invalid filesystem characters', () => {
    const invalidChars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    
    fc.assert(
      fc.property(
        actNumberArb,
        timestampArb,
        (actNum, timestamp) => {
          const filename = BDLawExport.generateActFilename(actNum, timestamp);
          
          // Check no invalid characters are present
          for (const char of invalidChars) {
            if (filename.includes(char)) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Handles edge case inputs gracefully
   */
  it('should handle edge case inputs and still produce unique filenames', () => {
    const edgeCaseNumbers = fc.oneof(
      fc.constant(''),
      fc.constant(null),
      fc.constant(undefined),
      fc.constant('0'),
      fc.constant('000001'),
      actNumberArb
    );

    fc.assert(
      fc.property(
        edgeCaseNumbers,
        edgeCaseNumbers,
        timestampArb,
        (num1, num2, timestamp) => {
          const filename1 = BDLawExport.generateActFilename(num1, timestamp);
          const filename2 = BDLawExport.generateActFilename(num2, timestamp);
          
          // Both should be valid filenames
          const pattern = /^bdlaw_act_[a-z0-9]+_[0-9]{8}_[0-9]{6}\.json$/;
          if (!pattern.test(filename1) || !pattern.test(filename2)) {
            return false;
          }
          
          // If inputs are effectively different, filenames should be different
          const sanitized1 = BDLawExport._sanitizeForFilename(num1);
          const sanitized2 = BDLawExport._sanitizeForFilename(num2);
          if (sanitized1 !== sanitized2) {
            return filename1 !== filename2;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
