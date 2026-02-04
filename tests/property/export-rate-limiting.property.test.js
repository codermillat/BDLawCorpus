/**
 * Property-Based Tests for Export Rate Limiting
 * 
 * Feature: durable-persistence-hardening, Property 20: Export Rate Limiting
 * Validates: Requirements 12.5
 * 
 * For any batch export, the time between consecutive file downloads SHALL be
 * at least the configured rate limit delay (default: 500ms).
 */

const fc = require('fast-check');

const {
  ExportProgressTracker
} = require('../../bdlaw-storage.js');

describe('Property 20: Export Rate Limiting', () => {
  beforeEach(async () => {
    // Reset the ExportProgressTracker state before each test
    ExportProgressTracker.clearCache();
    // Reset to default state
    ExportProgressTracker._state = {
      export_id: null,
      total_acts: 0,
      current_index: 0,
      exported_act_ids: [],
      failed_act_ids: [],
      status: 'idle',
      started_at: null,
      last_updated_at: null,
      rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
      pending_act_ids: []
    };
  });

  afterEach(() => {
    // Clean up
    ExportProgressTracker.clearCache();
  });

  // Generator for valid rate limit values (100-5000ms)
  const rateLimitGen = fc.integer({ min: 100, max: 5000 });

  // Generator for rate limit values that need clamping
  const outOfBoundsRateLimitGen = fc.oneof(
    fc.integer({ min: -1000, max: 99 }),  // Below minimum
    fc.integer({ min: 5001, max: 10000 }) // Above maximum
  );

  /**
   * Property: Default rate limit is 500ms
   * Requirements: 12.5
   */
  it('should have default rate limit of 500ms', async () => {
    // Reset state
    ExportProgressTracker._state = {
      export_id: null,
      total_acts: 0,
      current_index: 0,
      exported_act_ids: [],
      failed_act_ids: [],
      status: 'idle',
      started_at: null,
      last_updated_at: null,
      rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
      pending_act_ids: []
    };

    const rateLimit = await ExportProgressTracker.getRateLimit();
    expect(rateLimit).toBe(500);
    expect(ExportProgressTracker.DEFAULT_RATE_LIMIT_MS).toBe(500);
  });

  /**
   * Property: Rate limit can be set within valid range
   * Requirements: 12.5
   */
  it('should accept rate limit values within valid range (100-5000ms)', async () => {
    await fc.assert(
      fc.asyncProperty(
        rateLimitGen,
        async (rateLimit) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Set rate limit
          const result = await ExportProgressTracker.setRateLimit(rateLimit);

          // Verify rate limit was set correctly (not clamped)
          if (result.clamped) return false;
          if (result.rate_limit_ms !== rateLimit) return false;

          // Verify state reflects the new rate limit
          const state = await ExportProgressTracker.getState();
          return state.rate_limit_ms === rateLimit;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rate limit values below minimum are clamped to 100ms
   * Requirements: 12.5
   */
  it('should clamp rate limit values below minimum to 100ms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -1000, max: 99 }),
        async (rateLimit) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Set rate limit below minimum
          const result = await ExportProgressTracker.setRateLimit(rateLimit);

          // Verify rate limit was clamped to minimum
          if (!result.clamped) return false;
          if (result.rate_limit_ms !== ExportProgressTracker.MIN_RATE_LIMIT_MS) return false;
          if (result.rate_limit_ms !== 100) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rate limit values above maximum are clamped to 5000ms
   * Requirements: 12.5
   */
  it('should clamp rate limit values above maximum to 5000ms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5001, max: 10000 }),
        async (rateLimit) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Set rate limit above maximum
          const result = await ExportProgressTracker.setRateLimit(rateLimit);

          // Verify rate limit was clamped to maximum
          if (!result.clamped) return false;
          if (result.rate_limit_ms !== ExportProgressTracker.MAX_RATE_LIMIT_MS) return false;
          if (result.rate_limit_ms !== 5000) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: waitForRateLimit waits at least the configured delay
   * Requirements: 12.5
   * 
   * Note: We use a small delay for testing to avoid slow tests
   */
  it('should wait at least the configured rate limit delay', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 200 }), // Use small delays for fast tests
        async (rateLimit) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: rateLimit,
            pending_act_ids: []
          };

          // Measure time for waitForRateLimit
          const startTime = Date.now();
          const result = await ExportProgressTracker.waitForRateLimit();
          const endTime = Date.now();
          const elapsed = endTime - startTime;

          // Verify waited at least the configured delay
          // Allow small tolerance for timing variations
          if (elapsed < rateLimit - 10) return false;
          if (result.waited_ms !== rateLimit) return false;

          return true;
        }
      ),
      { numRuns: 10 } // Fewer runs due to actual waiting
    );
  });

  /**
   * Property: Rate limit persists across state reloads
   * Requirements: 12.5
   */
  it('should persist rate limit in state', async () => {
    await fc.assert(
      fc.asyncProperty(
        rateLimitGen,
        async (rateLimit) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
            pending_act_ids: []
          };

          // Set rate limit
          await ExportProgressTracker.setRateLimit(rateLimit);

          // Get rate limit via different method
          const retrievedRateLimit = await ExportProgressTracker.getRateLimit();

          // Verify rate limit matches
          return retrievedRateLimit === rateLimit;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rate limit is preserved when starting new export
   * Requirements: 12.5
   */
  it('should preserve rate limit when starting new export', async () => {
    await fc.assert(
      fc.asyncProperty(
        rateLimitGen,
        fc.array(fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 10 })
          .map(ids => [...new Set(ids)])
          .filter(ids => ids.length > 0),
        async (rateLimit, actIds) => {
          // Reset state
          ExportProgressTracker._state = {
            export_id: null,
            total_acts: 0,
            current_index: 0,
            exported_act_ids: [],
            failed_act_ids: [],
            status: 'idle',
            started_at: null,
            last_updated_at: null,
            rate_limit_ms: rateLimit, // Set custom rate limit
            pending_act_ids: []
          };

          // Start export
          await ExportProgressTracker.startExport(actIds);

          // Verify rate limit is preserved
          const state = await ExportProgressTracker.getState();
          return state.rate_limit_ms === rateLimit;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid rate limit types are handled gracefully
   * Requirements: 12.5
   */
  it('should handle invalid rate limit types gracefully', async () => {
    // Reset state
    ExportProgressTracker._state = {
      export_id: null,
      total_acts: 0,
      current_index: 0,
      exported_act_ids: [],
      failed_act_ids: [],
      status: 'idle',
      started_at: null,
      last_updated_at: null,
      rate_limit_ms: ExportProgressTracker.DEFAULT_RATE_LIMIT_MS,
      pending_act_ids: []
    };

    // Test with NaN
    let result = await ExportProgressTracker.setRateLimit(NaN);
    expect(result.rate_limit_ms).toBe(ExportProgressTracker.DEFAULT_RATE_LIMIT_MS);
    expect(result.clamped).toBe(true);

    // Test with undefined (will be treated as NaN)
    result = await ExportProgressTracker.setRateLimit(undefined);
    expect(result.rate_limit_ms).toBe(ExportProgressTracker.DEFAULT_RATE_LIMIT_MS);
    expect(result.clamped).toBe(true);

    // Test with string (will be treated as NaN)
    result = await ExportProgressTracker.setRateLimit('invalid');
    expect(result.rate_limit_ms).toBe(ExportProgressTracker.DEFAULT_RATE_LIMIT_MS);
    expect(result.clamped).toBe(true);
  });

  /**
   * Property: Rate limit bounds are correctly defined
   * Requirements: 12.5
   */
  it('should have correct rate limit bounds', () => {
    expect(ExportProgressTracker.MIN_RATE_LIMIT_MS).toBe(100);
    expect(ExportProgressTracker.MAX_RATE_LIMIT_MS).toBe(5000);
    expect(ExportProgressTracker.DEFAULT_RATE_LIMIT_MS).toBe(500);
    
    // Default should be within bounds
    expect(ExportProgressTracker.DEFAULT_RATE_LIMIT_MS).toBeGreaterThanOrEqual(ExportProgressTracker.MIN_RATE_LIMIT_MS);
    expect(ExportProgressTracker.DEFAULT_RATE_LIMIT_MS).toBeLessThanOrEqual(ExportProgressTracker.MAX_RATE_LIMIT_MS);
  });
});
