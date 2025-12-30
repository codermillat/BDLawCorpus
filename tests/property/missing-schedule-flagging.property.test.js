/**
 * Property-Based Tests for Missing Schedule Flagging
 * 
 * Feature: data-quality-remediation, Property 2: Missing Schedule Flagging
 * Validates: Requirements 1.3, 1.4
 * 
 * For any text where a schedule is referenced but content after the reference is 
 * less than 500 characters, the Quality_Validator SHALL flag as "missing_schedule" 
 * and record the schedule type and position.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 2: Missing Schedule Flagging', () => {
  const THRESHOLD = BDLawQuality.QUALITY_CONFIG.scheduleContentThreshold; // 500 chars

  /**
   * Property: Content below threshold should be flagged as missing_schedule
   */
  it('should flag as missing_schedule when content after reference is below threshold', () => {
    const schedulePatterns = [
      'First Schedule',
      'Second Schedule',
      'তফসিল',
      'প্রথম তফসিল',
      'Appendix A'
    ];

    const scheduleArbitrary = fc.record({
      schedule: fc.constantFrom(...schedulePatterns),
      // Generate suffix shorter than threshold (0 to 499 chars)
      suffixLength: fc.integer({ min: 0, max: THRESHOLD - 1 })
    });

    fc.assert(
      fc.property(
        scheduleArbitrary,
        ({ schedule, suffixLength }) => {
          // Create content with schedule and suffix below threshold
          const suffix = ' '.repeat(suffixLength);
          const content = 'Some legal text. ' + schedule + suffix;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should flag as missing_schedule
          return issues.length > 0 && 
                 issues.some(issue => issue.type === 'missing_schedule');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content at or above threshold should NOT be flagged as missing
   */
  it('should NOT flag when content after reference meets or exceeds threshold', () => {
    const schedulePatterns = [
      'First Schedule',
      'Second Schedule',
      'তফসিল',
      'Appendix A'
    ];

    const scheduleArbitrary = fc.record({
      schedule: fc.constantFrom(...schedulePatterns),
      // Generate suffix at or above threshold (500 to 1000 chars)
      suffixLength: fc.integer({ min: THRESHOLD, max: THRESHOLD + 500 })
    });

    fc.assert(
      fc.property(
        scheduleArbitrary,
        ({ schedule, suffixLength }) => {
          // Create content with schedule and sufficient content after
          // Use 'a' instead of 'x' to avoid matching Roman numeral pattern
          const suffix = 'a'.repeat(suffixLength);
          const content = 'Some legal text. ' + schedule + ' ' + suffix;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should NOT flag as missing_schedule
          return issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Flagged issues should record schedule type correctly
   */
  it('should record the schedule type in the issue', () => {
    const schedulePatterns = [
      'First Schedule',
      'Second Schedule',
      'Third Schedule',
      'তফসিল',
      'প্রথম তফসিল',
      'দ্বিতীয় তফসিল',
      'Appendix A',
      'Appendix B'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...schedulePatterns),
        (schedule) => {
          // Content with schedule and no content after
          const content = 'Legal text referencing ' + schedule;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should have at least one issue with the schedule type recorded
          return issues.length > 0 && 
                 issues.some(issue => 
                   issue.scheduleType !== undefined && 
                   issue.scheduleType.length > 0
                 );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Flagged issues should record position correctly
   */
  it('should record the reference position in the issue', () => {
    const schedulePatterns = [
      'First Schedule',
      'তফসিল',
      'Appendix A'
    ];

    const scheduleArbitrary = fc.record({
      // Use word-boundary-friendly prefix
      prefixLength: fc.integer({ min: 0, max: 100 }),
      schedule: fc.constantFrom(...schedulePatterns)
    });

    fc.assert(
      fc.property(
        scheduleArbitrary,
        ({ prefixLength, schedule }) => {
          // Create content with known prefix length
          const prefix = ' '.repeat(prefixLength);
          const content = prefix + schedule;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should have at least one issue with position recorded
          if (issues.length === 0) {
            return false;
          }
          
          // Position should be a non-negative number
          return issues.every(issue => 
            typeof issue.position === 'number' && 
            issue.position >= 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Description should include character count information
   */
  it('should include character count in the description', () => {
    const schedulePatterns = [
      'First Schedule',
      'তফসিল',
      'Appendix A'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...schedulePatterns),
        (schedule) => {
          // Content with schedule and minimal content after
          const content = 'Text before ' + schedule + ' short';
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should have description mentioning character count
          return issues.length > 0 && 
                 issues.every(issue => 
                   issue.description.includes('chars') || 
                   issue.description.includes('character')
                 );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Boundary test - exactly at threshold should NOT be flagged
   */
  it('should NOT flag when content after reference is exactly at threshold', () => {
    const schedulePatterns = [
      'First Schedule',
      'তফসিল',
      'Appendix A'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...schedulePatterns),
        (schedule) => {
          // Create content with exactly threshold characters after schedule
          // Use 'a' instead of 'x' to avoid matching Roman numeral pattern
          const suffix = 'a'.repeat(THRESHOLD);
          const content = 'Text ' + schedule + ' ' + suffix;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should NOT flag as missing (threshold is met)
          return issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Boundary test - one below threshold should be flagged
   */
  it('should flag when content after reference is one below threshold', () => {
    const schedulePatterns = [
      'First Schedule',
      'তফসিল',
      'Appendix A'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...schedulePatterns),
        (schedule) => {
          // Create content with one less than threshold characters after schedule
          // Use 'a' instead of 'x' to avoid matching Roman numeral pattern
          const suffix = 'a'.repeat(THRESHOLD - 1);
          const content = 'Text ' + schedule + ' ' + suffix;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should flag as missing (threshold not met)
          return issues.length > 0 && 
                 issues.some(issue => issue.type === 'missing_schedule');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All flagged issues should have type 'missing_schedule'
   */
  it('should always use type missing_schedule for flagged issues', () => {
    const schedulePatterns = [
      'First Schedule',
      'Second Schedule',
      'Third Schedule',
      'তফসিল',
      'প্রথম তফসিল',
      'Appendix A',
      'Appendix B'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...schedulePatterns),
        (schedule) => {
          // Content with schedule and no content after
          const content = schedule;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // All issues should have type 'missing_schedule'
          return issues.every(issue => issue.type === 'missing_schedule');
        }
      ),
      { numRuns: 100 }
    );
  });
});
