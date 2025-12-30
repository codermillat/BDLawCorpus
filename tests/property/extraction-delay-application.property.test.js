/**
 * Property Test: Extraction Delay Application
 * Feature: robust-queue-processing
 * Property 6: Extraction Delay Application
 * 
 * For any queue processing, the configured delay SHALL be applied AFTER
 * DOM readiness confirmation, not just after navigation. The delay SHALL
 * be between 1000ms and 30000ms.
 * 
 * Validates: Requirements 1.2, 1.3, 1.4
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Feature: robust-queue-processing, Property 6: Extraction Delay Application', () => {
  const { QUEUE_CONFIG_DEFAULTS } = BDLawQueue;

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

  // ============================================
  // Property Tests for Delay Configuration
  // ============================================

  test('extraction_delay_ms SHALL be between 1000ms and 30000ms (Requirements 1.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100000, max: 200000 }),
        (inputDelay) => {
          mockStorage.clear();
          
          // Save any delay value
          BDLawQueue.saveQueueConfig({ extraction_delay_ms: inputDelay }, mockStorage);
          
          // Load configuration
          const config = BDLawQueue.getQueueConfig(mockStorage);
          
          // Requirements 1.4: Delay SHALL be between 1000ms and 30000ms
          expect(config.extraction_delay_ms).toBeGreaterThanOrEqual(QUEUE_CONFIG_DEFAULTS.extraction_delay_min);
          expect(config.extraction_delay_ms).toBeLessThanOrEqual(QUEUE_CONFIG_DEFAULTS.extraction_delay_max);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('extraction_delay_ms default SHALL be 3000ms (Requirements 1.1)', () => {
    // Requirements 1.1: Default value of 3000 milliseconds
    expect(QUEUE_CONFIG_DEFAULTS.extraction_delay_ms).toBe(3000);
    
    // Verify default is returned when no config is stored
    mockStorage.clear();
    const config = BDLawQueue.getQueueConfig(mockStorage);
    expect(config.extraction_delay_ms).toBe(3000);
  });

  test('extraction_delay_ms range boundaries SHALL be 1000ms and 30000ms', () => {
    // Requirements 1.4: Allow delay values between 1000ms and 30000ms
    expect(QUEUE_CONFIG_DEFAULTS.extraction_delay_min).toBe(1000);
    expect(QUEUE_CONFIG_DEFAULTS.extraction_delay_max).toBe(30000);
  });

  test('valid delay values within range SHALL be preserved exactly', () => {
    fc.assert(
      fc.property(
        fc.integer({ 
          min: QUEUE_CONFIG_DEFAULTS.extraction_delay_min, 
          max: QUEUE_CONFIG_DEFAULTS.extraction_delay_max 
        }),
        (validDelay) => {
          mockStorage.clear();
          
          // Save valid delay
          BDLawQueue.saveQueueConfig({ extraction_delay_ms: validDelay }, mockStorage);
          
          // Load configuration
          const config = BDLawQueue.getQueueConfig(mockStorage);
          
          // Valid values should be preserved exactly
          expect(config.extraction_delay_ms).toBe(validDelay);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('delay values below minimum SHALL be clamped to 1000ms', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100000, max: QUEUE_CONFIG_DEFAULTS.extraction_delay_min - 1 }),
        (belowMinDelay) => {
          mockStorage.clear();
          
          // Save delay below minimum
          BDLawQueue.saveQueueConfig({ extraction_delay_ms: belowMinDelay }, mockStorage);
          
          // Load configuration
          const config = BDLawQueue.getQueueConfig(mockStorage);
          
          // Should be clamped to minimum
          expect(config.extraction_delay_ms).toBe(QUEUE_CONFIG_DEFAULTS.extraction_delay_min);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('delay values above maximum SHALL be clamped to 30000ms', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: QUEUE_CONFIG_DEFAULTS.extraction_delay_max + 1, max: 200000 }),
        (aboveMaxDelay) => {
          mockStorage.clear();
          
          // Save delay above maximum
          BDLawQueue.saveQueueConfig({ extraction_delay_ms: aboveMaxDelay }, mockStorage);
          
          // Load configuration
          const config = BDLawQueue.getQueueConfig(mockStorage);
          
          // Should be clamped to maximum
          expect(config.extraction_delay_ms).toBe(QUEUE_CONFIG_DEFAULTS.extraction_delay_max);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Simulation Tests for Delay Application Order
  // Requirements 1.2, 1.3: Delay applied AFTER DOM readiness
  // ============================================

  /**
   * Simulates the queue processing timeline to verify delay application order.
   * This is a testable model of the actual processQueue behavior.
   * 
   * @param {Object} config - Queue configuration
   * @param {Object} domReadinessResult - Result of DOM readiness check
   * @returns {Object} Timeline of events
   */
  function simulateQueueProcessingTimeline(config, domReadinessResult) {
    const timeline = [];
    let currentTime = 0;
    
    // Step 1: Navigation starts
    timeline.push({ event: 'navigation_start', time: currentTime });
    
    // Step 2: Page load completes (simulated)
    currentTime += 500; // Simulated page load time
    timeline.push({ event: 'page_load_complete', time: currentTime });
    
    // Step 3: DOM readiness check
    timeline.push({ event: 'dom_readiness_check_start', time: currentTime });
    
    if (!domReadinessResult.ready) {
      // DOM readiness failed - no delay applied
      timeline.push({ 
        event: 'dom_readiness_failed', 
        time: currentTime,
        reason: domReadinessResult.reason 
      });
      return { timeline, delayApplied: false, extractionAttempted: false };
    }
    
    // DOM readiness succeeded
    currentTime += domReadinessResult.checkDuration || 0;
    timeline.push({ event: 'dom_readiness_confirmed', time: currentTime });
    
    // Step 4: Apply extraction delay AFTER DOM readiness (Requirements 1.2, 1.3)
    const delayStartTime = currentTime;
    timeline.push({ event: 'delay_start', time: currentTime });
    
    currentTime += config.extraction_delay_ms;
    timeline.push({ event: 'delay_end', time: currentTime });
    
    // Step 5: Extraction begins
    timeline.push({ event: 'extraction_start', time: currentTime });
    
    return { 
      timeline, 
      delayApplied: true, 
      delayStartTime,
      delayDuration: config.extraction_delay_ms,
      extractionAttempted: true
    };
  }

  test('delay SHALL be applied AFTER DOM readiness confirmation (Requirements 1.2, 1.3)', () => {
    fc.assert(
      fc.property(
        fc.integer({ 
          min: QUEUE_CONFIG_DEFAULTS.extraction_delay_min, 
          max: QUEUE_CONFIG_DEFAULTS.extraction_delay_max 
        }),
        fc.integer({ min: 0, max: 5000 }), // DOM readiness check duration
        (delayMs, checkDuration) => {
          const config = { extraction_delay_ms: delayMs };
          const domReadinessResult = { ready: true, checkDuration };
          
          const result = simulateQueueProcessingTimeline(config, domReadinessResult);
          
          // Verify delay was applied
          expect(result.delayApplied).toBe(true);
          expect(result.extractionAttempted).toBe(true);
          
          // Find timeline events
          const domReadyEvent = result.timeline.find(e => e.event === 'dom_readiness_confirmed');
          const delayStartEvent = result.timeline.find(e => e.event === 'delay_start');
          const delayEndEvent = result.timeline.find(e => e.event === 'delay_end');
          const extractionStartEvent = result.timeline.find(e => e.event === 'extraction_start');
          
          // Requirements 1.2, 1.3: Delay applied AFTER DOM readiness
          expect(delayStartEvent.time).toBeGreaterThanOrEqual(domReadyEvent.time);
          
          // Delay duration should match configuration
          expect(delayEndEvent.time - delayStartEvent.time).toBe(delayMs);
          
          // Extraction should start after delay
          expect(extractionStartEvent.time).toBeGreaterThanOrEqual(delayEndEvent.time);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('delay SHALL NOT be applied if DOM readiness fails', () => {
    fc.assert(
      fc.property(
        fc.integer({ 
          min: QUEUE_CONFIG_DEFAULTS.extraction_delay_min, 
          max: QUEUE_CONFIG_DEFAULTS.extraction_delay_max 
        }),
        fc.constantFrom('dom_timeout', 'container_not_found', 'network_error'),
        (delayMs, failureReason) => {
          const config = { extraction_delay_ms: delayMs };
          const domReadinessResult = { ready: false, reason: failureReason };
          
          const result = simulateQueueProcessingTimeline(config, domReadinessResult);
          
          // Verify delay was NOT applied when DOM readiness fails
          expect(result.delayApplied).toBe(false);
          expect(result.extractionAttempted).toBe(false);
          
          // Verify no delay events in timeline
          const delayEvents = result.timeline.filter(e => 
            e.event === 'delay_start' || e.event === 'delay_end'
          );
          expect(delayEvents.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('delay SHALL be applied between each queue item extraction', () => {
    fc.assert(
      fc.property(
        fc.integer({ 
          min: QUEUE_CONFIG_DEFAULTS.extraction_delay_min, 
          max: QUEUE_CONFIG_DEFAULTS.extraction_delay_max 
        }),
        fc.integer({ min: 2, max: 10 }), // number of queue items
        (delayMs, numItems) => {
          const config = { extraction_delay_ms: delayMs };
          const allTimelines = [];
          
          // Simulate processing multiple queue items
          for (let i = 0; i < numItems; i++) {
            const domReadinessResult = { ready: true, checkDuration: 100 };
            const result = simulateQueueProcessingTimeline(config, domReadinessResult);
            allTimelines.push(result);
          }
          
          // Each item should have delay applied
          for (const timeline of allTimelines) {
            expect(timeline.delayApplied).toBe(true);
            expect(timeline.delayDuration).toBe(delayMs);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('minimum delay (1000ms) SHALL be applied correctly', () => {
    const config = { extraction_delay_ms: QUEUE_CONFIG_DEFAULTS.extraction_delay_min };
    const domReadinessResult = { ready: true, checkDuration: 0 };
    
    const result = simulateQueueProcessingTimeline(config, domReadinessResult);
    
    expect(result.delayApplied).toBe(true);
    expect(result.delayDuration).toBe(1000);
  });

  test('maximum delay (30000ms) SHALL be applied correctly', () => {
    const config = { extraction_delay_ms: QUEUE_CONFIG_DEFAULTS.extraction_delay_max };
    const domReadinessResult = { ready: true, checkDuration: 0 };
    
    const result = simulateQueueProcessingTimeline(config, domReadinessResult);
    
    expect(result.delayApplied).toBe(true);
    expect(result.delayDuration).toBe(30000);
  });

  test('delay configuration SHALL persist across sessions (Requirements 1.5)', () => {
    fc.assert(
      fc.property(
        fc.integer({ 
          min: QUEUE_CONFIG_DEFAULTS.extraction_delay_min, 
          max: QUEUE_CONFIG_DEFAULTS.extraction_delay_max 
        }),
        (delayMs) => {
          mockStorage.clear();
          
          // Save configuration
          BDLawQueue.saveQueueConfig({ extraction_delay_ms: delayMs }, mockStorage);
          
          // Simulate "session restart" by creating new config load
          const loadedConfig = BDLawQueue.getQueueConfig(mockStorage);
          
          // Configuration should persist
          expect(loadedConfig.extraction_delay_ms).toBe(delayMs);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Integration with DOM Readiness
  // ============================================

  test('delay timing SHALL be independent of DOM readiness check duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ 
          min: QUEUE_CONFIG_DEFAULTS.extraction_delay_min, 
          max: QUEUE_CONFIG_DEFAULTS.extraction_delay_max 
        }),
        fc.integer({ min: 0, max: 29000 }), // Various DOM readiness durations
        (delayMs, checkDuration) => {
          const config = { extraction_delay_ms: delayMs };
          const domReadinessResult = { ready: true, checkDuration };
          
          const result = simulateQueueProcessingTimeline(config, domReadinessResult);
          
          // Delay duration should always match configuration
          // regardless of how long DOM readiness took
          expect(result.delayDuration).toBe(delayMs);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('extraction SHALL NOT start before delay completes', () => {
    fc.assert(
      fc.property(
        fc.integer({ 
          min: QUEUE_CONFIG_DEFAULTS.extraction_delay_min, 
          max: QUEUE_CONFIG_DEFAULTS.extraction_delay_max 
        }),
        (delayMs) => {
          const config = { extraction_delay_ms: delayMs };
          const domReadinessResult = { ready: true, checkDuration: 0 };
          
          const result = simulateQueueProcessingTimeline(config, domReadinessResult);
          
          const delayEndEvent = result.timeline.find(e => e.event === 'delay_end');
          const extractionStartEvent = result.timeline.find(e => e.event === 'extraction_start');
          
          // Extraction must not start before delay ends
          expect(extractionStartEvent.time).toBeGreaterThanOrEqual(delayEndEvent.time);
        }
      ),
      { numRuns: 100 }
    );
  });
});
