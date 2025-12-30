/**
 * Property Test: Queue Configuration Persistence
 * Feature: robust-queue-processing
 * Property 1: Configuration Persistence
 * 
 * For any queue configuration saved, loading the configuration SHALL return
 * the same values. Configuration values SHALL be clamped to valid ranges.
 * 
 * Validates: Requirements 1.1, 1.4, 1.5, 10.1-10.5
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Feature: robust-queue-processing, Property 1: Configuration Persistence', () => {
  // Mock localStorage for testing
  let mockStorage;
  
  beforeEach(() => {
    mockStorage = {
      data: {},
      getItem(key) {
        return this.data[key] || null;
      },
      setItem(key, value) {
        this.data[key] = value;
      },
      clear() {
        this.data = {};
      }
    };
  });

  const { QUEUE_CONFIG_DEFAULTS } = BDLawQueue;

  test('should return default values when no config is stored', () => {
    const config = BDLawQueue.getQueueConfig(mockStorage);
    
    expect(config.extraction_delay_ms).toBe(QUEUE_CONFIG_DEFAULTS.extraction_delay_ms);
    expect(config.minimum_content_threshold).toBe(QUEUE_CONFIG_DEFAULTS.minimum_content_threshold);
    expect(config.max_retry_attempts).toBe(QUEUE_CONFIG_DEFAULTS.max_retry_attempts);
    expect(config.retry_base_delay_ms).toBe(QUEUE_CONFIG_DEFAULTS.retry_base_delay_ms);
    expect(config.dom_readiness_timeout_ms).toBe(QUEUE_CONFIG_DEFAULTS.dom_readiness_timeout_ms);
  });

  test('should persist and load valid configuration values', () => {
    fc.assert(
      fc.property(
        fc.record({
          extraction_delay_ms: fc.integer({ 
            min: QUEUE_CONFIG_DEFAULTS.extraction_delay_min, 
            max: QUEUE_CONFIG_DEFAULTS.extraction_delay_max 
          }),
          minimum_content_threshold: fc.integer({ 
            min: QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_min, 
            max: QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_max 
          }),
          max_retry_attempts: fc.integer({ 
            min: QUEUE_CONFIG_DEFAULTS.max_retry_attempts_min, 
            max: QUEUE_CONFIG_DEFAULTS.max_retry_attempts_max 
          }),
          retry_base_delay_ms: fc.integer({ 
            min: QUEUE_CONFIG_DEFAULTS.retry_base_delay_min, 
            max: QUEUE_CONFIG_DEFAULTS.retry_base_delay_max 
          })
        }),
        (inputConfig) => {
          // Clear storage before each iteration
          mockStorage.clear();
          
          // Save configuration
          BDLawQueue.saveQueueConfig(inputConfig, mockStorage);
          
          // Load configuration
          const loadedConfig = BDLawQueue.getQueueConfig(mockStorage);
          
          // Verify round-trip persistence
          expect(loadedConfig.extraction_delay_ms).toBe(inputConfig.extraction_delay_ms);
          expect(loadedConfig.minimum_content_threshold).toBe(inputConfig.minimum_content_threshold);
          expect(loadedConfig.max_retry_attempts).toBe(inputConfig.max_retry_attempts);
          expect(loadedConfig.retry_base_delay_ms).toBe(inputConfig.retry_base_delay_ms);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should clamp extraction_delay_ms to valid range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100000, max: 100000 }),
        (delay) => {
          mockStorage.clear();
          
          BDLawQueue.saveQueueConfig({ extraction_delay_ms: delay }, mockStorage);
          const config = BDLawQueue.getQueueConfig(mockStorage);
          
          // Value should be clamped to valid range
          expect(config.extraction_delay_ms).toBeGreaterThanOrEqual(QUEUE_CONFIG_DEFAULTS.extraction_delay_min);
          expect(config.extraction_delay_ms).toBeLessThanOrEqual(QUEUE_CONFIG_DEFAULTS.extraction_delay_max);
          
          // If within range, should be exact value
          if (delay >= QUEUE_CONFIG_DEFAULTS.extraction_delay_min && 
              delay <= QUEUE_CONFIG_DEFAULTS.extraction_delay_max) {
            expect(config.extraction_delay_ms).toBe(delay);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should clamp minimum_content_threshold to valid range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 10000 }),
        (threshold) => {
          mockStorage.clear();
          
          BDLawQueue.saveQueueConfig({ minimum_content_threshold: threshold }, mockStorage);
          const config = BDLawQueue.getQueueConfig(mockStorage);
          
          expect(config.minimum_content_threshold).toBeGreaterThanOrEqual(QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_min);
          expect(config.minimum_content_threshold).toBeLessThanOrEqual(QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_max);
          
          if (threshold >= QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_min && 
              threshold <= QUEUE_CONFIG_DEFAULTS.minimum_content_threshold_max) {
            expect(config.minimum_content_threshold).toBe(threshold);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should clamp max_retry_attempts to valid range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 100 }),
        (attempts) => {
          mockStorage.clear();
          
          BDLawQueue.saveQueueConfig({ max_retry_attempts: attempts }, mockStorage);
          const config = BDLawQueue.getQueueConfig(mockStorage);
          
          expect(config.max_retry_attempts).toBeGreaterThanOrEqual(QUEUE_CONFIG_DEFAULTS.max_retry_attempts_min);
          expect(config.max_retry_attempts).toBeLessThanOrEqual(QUEUE_CONFIG_DEFAULTS.max_retry_attempts_max);
          
          if (attempts >= QUEUE_CONFIG_DEFAULTS.max_retry_attempts_min && 
              attempts <= QUEUE_CONFIG_DEFAULTS.max_retry_attempts_max) {
            expect(config.max_retry_attempts).toBe(attempts);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should clamp retry_base_delay_ms to valid range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 100000 }),
        (delay) => {
          mockStorage.clear();
          
          BDLawQueue.saveQueueConfig({ retry_base_delay_ms: delay }, mockStorage);
          const config = BDLawQueue.getQueueConfig(mockStorage);
          
          expect(config.retry_base_delay_ms).toBeGreaterThanOrEqual(QUEUE_CONFIG_DEFAULTS.retry_base_delay_min);
          expect(config.retry_base_delay_ms).toBeLessThanOrEqual(QUEUE_CONFIG_DEFAULTS.retry_base_delay_max);
          
          if (delay >= QUEUE_CONFIG_DEFAULTS.retry_base_delay_min && 
              delay <= QUEUE_CONFIG_DEFAULTS.retry_base_delay_max) {
            expect(config.retry_base_delay_ms).toBe(delay);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle partial configuration (missing fields use defaults)', () => {
    fc.assert(
      fc.property(
        fc.record({
          extraction_delay_ms: fc.option(fc.integer({ min: 1000, max: 30000 }), { nil: undefined }),
          minimum_content_threshold: fc.option(fc.integer({ min: 50, max: 1000 }), { nil: undefined })
        }),
        (partialConfig) => {
          mockStorage.clear();
          
          // Filter out undefined values
          const configToSave = {};
          if (partialConfig.extraction_delay_ms !== undefined) {
            configToSave.extraction_delay_ms = partialConfig.extraction_delay_ms;
          }
          if (partialConfig.minimum_content_threshold !== undefined) {
            configToSave.minimum_content_threshold = partialConfig.minimum_content_threshold;
          }
          
          BDLawQueue.saveQueueConfig(configToSave, mockStorage);
          const config = BDLawQueue.getQueueConfig(mockStorage);
          
          // Saved values should be preserved
          if (partialConfig.extraction_delay_ms !== undefined) {
            expect(config.extraction_delay_ms).toBe(partialConfig.extraction_delay_ms);
          } else {
            expect(config.extraction_delay_ms).toBe(QUEUE_CONFIG_DEFAULTS.extraction_delay_ms);
          }
          
          if (partialConfig.minimum_content_threshold !== undefined) {
            expect(config.minimum_content_threshold).toBe(partialConfig.minimum_content_threshold);
          } else {
            expect(config.minimum_content_threshold).toBe(QUEUE_CONFIG_DEFAULTS.minimum_content_threshold);
          }
          
          // Unsaved values should use defaults
          expect(config.max_retry_attempts).toBe(QUEUE_CONFIG_DEFAULTS.max_retry_attempts);
          expect(config.retry_base_delay_ms).toBe(QUEUE_CONFIG_DEFAULTS.retry_base_delay_ms);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('clamp function should work correctly for all values', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        fc.integer(),
        (value, min, max) => {
          // Ensure min <= max for valid range
          const actualMin = Math.min(min, max);
          const actualMax = Math.max(min, max);
          
          const result = BDLawQueue.clamp(value, actualMin, actualMax);
          
          expect(result).toBeGreaterThanOrEqual(actualMin);
          expect(result).toBeLessThanOrEqual(actualMax);
          
          if (value >= actualMin && value <= actualMax) {
            expect(result).toBe(value);
          } else if (value < actualMin) {
            expect(result).toBe(actualMin);
          } else {
            expect(result).toBe(actualMax);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
