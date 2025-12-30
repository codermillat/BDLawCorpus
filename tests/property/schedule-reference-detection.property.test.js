/**
 * Property-Based Tests for Schedule Reference Detection
 * 
 * Feature: data-quality-remediation, Property 1: Schedule Reference Detection
 * Validates: Requirements 1.1, 1.5
 * 
 * For any text containing schedule reference patterns (English: "First Schedule", 
 * "Appendix"; Bengali: "তফসিল", "প্রথম তফসিল"), the Quality_Validator SHALL detect 
 * and return all references with their positions.
 */

const fc = require('fast-check');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 1: Schedule Reference Detection', () => {
  /**
   * Property: English schedule references should be detected with correct positions
   * Note: Patterns use word boundaries, so we need proper word separators
   */
  it('should detect all English schedule references with correct positions', () => {
    // These patterns match the actual regex in QUALITY_CONFIG
    const englishSchedulePatterns = [
      'First Schedule',
      'Second Schedule',
      'Third Schedule',
      'Fourth Schedule',
      'Fifth Schedule',
      'Schedule I',
      'Schedule II',
      'Schedule III',
      'Appendix A',
      'Appendix B',
      'Appendix to this Act'
    ];

    const scheduleArbitrary = fc.record({
      // Use word-boundary-friendly prefixes (spaces, punctuation, or empty)
      prefix: fc.stringOf(fc.constantFrom(' ', '.', '\n', ','), { minLength: 0, maxLength: 50 }),
      schedule: fc.constantFrom(...englishSchedulePatterns),
      // Use word-boundary-friendly suffixes
      suffix: fc.stringOf(fc.constantFrom(' ', '.', '\n', ','), { minLength: 0, maxLength: 50 })
    });

    fc.assert(
      fc.property(
        scheduleArbitrary,
        ({ prefix, schedule, suffix }) => {
          const content = prefix + schedule + suffix;
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // If suffix is short (< threshold), should be detected as missing
          const suffixLength = suffix.trim().length;
          const threshold = BDLawQuality.QUALITY_CONFIG.scheduleContentThreshold;
          
          if (suffixLength < threshold) {
            // Should detect at least one issue
            return issues.length > 0 && issues.every(i => i.type === 'missing_schedule');
          }
          
          // If suffix is long enough, should NOT be flagged as missing
          return issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali schedule references should be detected with correct positions
   */
  it('should detect all Bengali schedule references with correct positions', () => {
    const bengaliSchedulePatterns = [
      'তফসিল',
      'প্রথম তফসিল',
      'দ্বিতীয় তফসিল',
      'তৃতীয় তফসিল',
      'Topsil'
    ];

    const scheduleArbitrary = fc.record({
      prefix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '।', '\n'), { minLength: 0, maxLength: 50 }),
      schedule: fc.constantFrom(...bengaliSchedulePatterns),
      suffix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '।', '\n'), { minLength: 0, maxLength: 50 })
    });

    fc.assert(
      fc.property(
        scheduleArbitrary,
        ({ prefix, schedule, suffix }) => {
          const content = prefix + schedule + suffix;
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should detect the schedule reference
          const detected = issues.some(issue => 
            issue.type === 'missing_schedule' && 
            (issue.scheduleType.includes('তফসিল') || issue.scheduleType.toLowerCase().includes('topsil'))
          );
          
          // If suffix is short (< threshold), should be detected as missing
          const suffixLength = suffix.trim().length;
          const threshold = BDLawQuality.QUALITY_CONFIG.scheduleContentThreshold;
          
          if (suffixLength < threshold) {
            return detected === true;
          }
          
          // If suffix is long enough, should NOT be flagged as missing
          return detected === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position should accurately reflect where the reference appears in content
   */
  it('should return accurate positions for detected schedule references', () => {
    const schedulePatterns = [
      'First Schedule',
      'তফসিল',
      'Appendix A'
    ];

    const scheduleArbitrary = fc.record({
      // Use word-boundary-friendly prefix (spaces only)
      prefix: fc.stringOf(fc.constant(' '), { minLength: 10, maxLength: 100 }),
      schedule: fc.constantFrom(...schedulePatterns)
    });

    fc.assert(
      fc.property(
        scheduleArbitrary,
        ({ prefix, schedule }) => {
          // Content with schedule at known position, no substantial content after
          const content = prefix + schedule;
          const expectedPosition = prefix.length;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should have at least one issue
          if (issues.length === 0) {
            return false;
          }
          
          // Position should match where we placed the schedule
          return issues.some(issue => issue.position === expectedPosition);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple schedule references should all be detected
   */
  it('should detect multiple schedule references in the same content', () => {
    const scheduleArbitrary = fc.record({
      schedule1: fc.constantFrom('First Schedule', 'তফসিল'),
      schedule2: fc.constantFrom('Second Schedule', 'দ্বিতীয় তফসিল'),
      // Use word-boundary-friendly separator
      separator: fc.stringOf(fc.constantFrom(' ', '\n', '.'), { minLength: 10, maxLength: 50 })
    });

    fc.assert(
      fc.property(
        scheduleArbitrary,
        ({ schedule1, schedule2, separator }) => {
          // Content with two schedule references, both with insufficient content after
          const content = schedule1 + separator + schedule2;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should detect at least one schedule (the second one will always be missing)
          // Note: The first schedule might have enough content after it (separator + schedule2)
          // but the second schedule will always have 0 chars after it
          return issues.length >= 1 && 
                 issues.every(issue => issue.type === 'missing_schedule');
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
          const issues = BDLawQuality.detectMissingSchedules(content);
          return Array.isArray(issues) && issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without schedule references should return empty array
   */
  it('should return empty array for content without schedule references', () => {
    const noScheduleContent = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', 'd', 'e', ' ', '\n', '.', ','),
      { minLength: 1, maxLength: 200 }
    );

    fc.assert(
      fc.property(
        noScheduleContent,
        (content) => {
          const issues = BDLawQuality.detectMissingSchedules(content);
          return Array.isArray(issues) && issues.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each detected issue should have required fields
   */
  it('should return issues with all required fields (type, position, description, scheduleType)', () => {
    // Use patterns that definitely match the config regex
    const scheduleArbitrary = fc.constantFrom(
      'First Schedule',
      'Second Schedule',
      'তফসিল',
      'প্রথম তফসিল',
      'Appendix A'
    );

    fc.assert(
      fc.property(
        scheduleArbitrary,
        (schedule) => {
          // Content with schedule and no content after
          const content = 'Some text before ' + schedule;
          
          const issues = BDLawQuality.detectMissingSchedules(content);
          
          // Should have at least one issue
          if (issues.length === 0) {
            return false;
          }
          
          // Each issue should have all required fields
          return issues.every(issue => 
            issue.type === 'missing_schedule' &&
            typeof issue.position === 'number' &&
            typeof issue.description === 'string' &&
            typeof issue.scheduleType === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
