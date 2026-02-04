/**
 * Property-Based Tests for Export Threshold Configuration
 * 
 * Feature: durable-persistence-hardening, Property 15: Export Threshold Configuration
 * Validates: Requirements 8.7
 * 
 * For any attempt to set the export checkpoint threshold, values less than 10 SHALL be
 * rejected (clamped to 10), and values greater than 200 SHALL be rejected (clamped to 200).
 */

const fc = require('fast-check');

const {
  ExportCheckpointManager
} = require('../../bdlaw-storage.js');

describe('Property 15: Export Threshold Configuration', () => {
  beforeEach(async () => {
    // Reset the ExportCheckpointManager state before each test
    ExportCheckpointManager.clearCache();
    // Reset to default state
    ExportCheckpointManager._state = {
      last_export_timestamp: null,
      acts_since_export: 0,
      threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
      prompt_displayed: false,
      prompt_dismissed_at: null
    };
  });

  afterEach(() => {
    // Clean up
    ExportCheckpointManager.clearCache();
  });

  // Generator for values below minimum threshold
  const belowMinGen = fc.integer({ min: -1000, max: 9 });

  // Generator for values above maximum threshold
  const aboveMaxGen = fc.integer({ min: 201, max: 1000 });

  // Generator for valid threshold values (10-200)
  const validThresholdGen = fc.integer({ min: 10, max: 200 });

  // Generator for any integer
  const anyIntGen = fc.integer({ min: -10000, max: 10000 });

  /**
   * Property: Values below 10 are clamped to 10
   * Requirements: 8.7
   */
  it('should clamp values below 10 to 10', async () => {
    await fc.assert(
      fc.asyncProperty(
        belowMinGen,
        async (value) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Set threshold with value below minimum
          const result = await ExportCheckpointManager.setThreshold(value);

          // Verify threshold is clamped to 10
          if (result.threshold !== 10) return false;
          
          // Verify clamped flag is set
          if (!result.clamped) return false;

          // Verify state is updated
          const state = await ExportCheckpointManager.getState();
          return state.threshold === 10;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Values above 200 are clamped to 200
   * Requirements: 8.7
   */
  it('should clamp values above 200 to 200', async () => {
    await fc.assert(
      fc.asyncProperty(
        aboveMaxGen,
        async (value) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Set threshold with value above maximum
          const result = await ExportCheckpointManager.setThreshold(value);

          // Verify threshold is clamped to 200
          if (result.threshold !== 200) return false;
          
          // Verify clamped flag is set
          if (!result.clamped) return false;

          // Verify state is updated
          const state = await ExportCheckpointManager.getState();
          return state.threshold === 200;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Valid values (10-200) are accepted without clamping
   * Requirements: 8.7
   */
  it('should accept valid values (10-200) without clamping', async () => {
    await fc.assert(
      fc.asyncProperty(
        validThresholdGen,
        async (value) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Set threshold with valid value
          const result = await ExportCheckpointManager.setThreshold(value);

          // Verify threshold is set to exact value
          if (result.threshold !== value) return false;
          
          // Verify clamped flag is NOT set
          if (result.clamped) return false;

          // Verify state is updated
          const state = await ExportCheckpointManager.getState();
          return state.threshold === value;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Threshold is always within valid range after any set operation
   * Requirements: 8.7
   */
  it('should always result in threshold within 10-200 range', async () => {
    await fc.assert(
      fc.asyncProperty(
        anyIntGen,
        async (value) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Set threshold with any value
          const result = await ExportCheckpointManager.setThreshold(value);

          // Verify threshold is within valid range
          if (result.threshold < 10) return false;
          if (result.threshold > 200) return false;

          // Verify state is consistent
          const state = await ExportCheckpointManager.getState();
          return state.threshold >= 10 && state.threshold <= 200;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Threshold persists correctly
   * Requirements: 8.7
   */
  it('should persist threshold correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        validThresholdGen,
        async (value) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Set threshold
          await ExportCheckpointManager.setThreshold(value);

          // Get threshold via getThreshold
          const threshold = await ExportCheckpointManager.getThreshold();

          // Verify threshold matches
          return threshold === value;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Default threshold is 50
   * Requirements: 8.7
   */
  it('should have default threshold of 50', async () => {
    // Reset state
    ExportCheckpointManager._state = {
      last_export_timestamp: null,
      acts_since_export: 0,
      threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
      prompt_displayed: false,
      prompt_dismissed_at: null
    };

    // Get threshold without setting
    const threshold = await ExportCheckpointManager.getThreshold();

    // Verify default is 50
    expect(threshold).toBe(50);
    expect(ExportCheckpointManager.DEFAULT_THRESHOLD).toBe(50);
  });

  /**
   * Property: Boundary values are handled correctly
   * Requirements: 8.7
   */
  it('should handle boundary values correctly', async () => {
    // Test minimum boundary (10)
    ExportCheckpointManager._state = {
      last_export_timestamp: null,
      acts_since_export: 0,
      threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
      prompt_displayed: false,
      prompt_dismissed_at: null
    };

    let result = await ExportCheckpointManager.setThreshold(10);
    expect(result.threshold).toBe(10);
    expect(result.clamped).toBe(false);

    // Test maximum boundary (200)
    ExportCheckpointManager._state.threshold = ExportCheckpointManager.DEFAULT_THRESHOLD;
    result = await ExportCheckpointManager.setThreshold(200);
    expect(result.threshold).toBe(200);
    expect(result.clamped).toBe(false);

    // Test just below minimum (9)
    ExportCheckpointManager._state.threshold = ExportCheckpointManager.DEFAULT_THRESHOLD;
    result = await ExportCheckpointManager.setThreshold(9);
    expect(result.threshold).toBe(10);
    expect(result.clamped).toBe(true);

    // Test just above maximum (201)
    ExportCheckpointManager._state.threshold = ExportCheckpointManager.DEFAULT_THRESHOLD;
    result = await ExportCheckpointManager.setThreshold(201);
    expect(result.threshold).toBe(200);
    expect(result.clamped).toBe(true);
  });

  /**
   * Property: Non-integer values are rounded
   * Requirements: 8.7
   */
  it('should round non-integer values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 10, max: 200, noNaN: true }),
        async (value) => {
          // Reset state
          ExportCheckpointManager._state = {
            last_export_timestamp: null,
            acts_since_export: 0,
            threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
            prompt_displayed: false,
            prompt_dismissed_at: null
          };

          // Set threshold with float value
          const result = await ExportCheckpointManager.setThreshold(value);

          // Verify threshold is an integer
          if (!Number.isInteger(result.threshold)) return false;

          // Verify threshold is within valid range
          return result.threshold >= 10 && result.threshold <= 200;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid types default to DEFAULT_THRESHOLD
   * Requirements: 8.7
   */
  it('should handle invalid types gracefully', async () => {
    // Reset state
    ExportCheckpointManager._state = {
      last_export_timestamp: null,
      acts_since_export: 0,
      threshold: ExportCheckpointManager.DEFAULT_THRESHOLD,
      prompt_displayed: false,
      prompt_dismissed_at: null
    };

    // Test with NaN
    let result = await ExportCheckpointManager.setThreshold(NaN);
    expect(result.threshold).toBe(ExportCheckpointManager.DEFAULT_THRESHOLD);

    // Test with undefined
    ExportCheckpointManager._state.threshold = ExportCheckpointManager.DEFAULT_THRESHOLD;
    result = await ExportCheckpointManager.setThreshold(undefined);
    expect(result.threshold).toBe(ExportCheckpointManager.DEFAULT_THRESHOLD);

    // Test with null
    ExportCheckpointManager._state.threshold = ExportCheckpointManager.DEFAULT_THRESHOLD;
    result = await ExportCheckpointManager.setThreshold(null);
    expect(result.threshold).toBe(ExportCheckpointManager.DEFAULT_THRESHOLD);

    // Test with string
    ExportCheckpointManager._state.threshold = ExportCheckpointManager.DEFAULT_THRESHOLD;
    result = await ExportCheckpointManager.setThreshold('invalid');
    expect(result.threshold).toBe(ExportCheckpointManager.DEFAULT_THRESHOLD);
  });
});
