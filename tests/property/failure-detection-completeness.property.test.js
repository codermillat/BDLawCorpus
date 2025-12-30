/**
 * Property Test: Failure Detection Completeness
 * Feature: robust-queue-processing
 * Property 2: Failure Detection Completeness
 * 
 * For any extraction attempt, if no legal content signals are detected, content is empty,
 * content is below threshold, timeout is exceeded, or network error occurs, the
 * extraction SHALL be marked as failed with the appropriate failure_reason.
 * Selector mismatch failures SHALL NOT be classified as timeout failures.
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Feature: robust-queue-processing, Property 2: Failure Detection Completeness', () => {
  const { FAILURE_REASONS } = BDLawQueue;

  test('should detect extraction error when result is null or undefined', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        (result) => {
          const validation = BDLawQueue.validateExtraction(result);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe(FAILURE_REASONS.EXTRACTION_ERROR);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('should detect extraction error when success is false', () => {
    fc.assert(
      fc.property(
        fc.record({
          success: fc.constant(false),
          error: fc.option(fc.string(), { nil: undefined })
        }),
        (result) => {
          const validation = BDLawQueue.validateExtraction(result);
          
          expect(validation.valid).toBe(false);
          // Should use provided error or default to EXTRACTION_ERROR
          if (result.error) {
            expect(validation.reason).toBe(result.error);
          } else {
            expect(validation.reason).toBe(FAILURE_REASONS.EXTRACTION_ERROR);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should detect container not found when content is missing', () => {
    fc.assert(
      fc.property(
        fc.record({
          success: fc.constant(true),
          // No content or content_raw field
          title: fc.option(fc.string(), { nil: undefined })
        }),
        (result) => {
          const validation = BDLawQueue.validateExtraction(result);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe(FAILURE_REASONS.CONTAINER_NOT_FOUND);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should detect empty content', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { success: true, content: '' },
          { success: true, content_raw: '' },
          { success: true, content: '', content_raw: '' }
        ),
        (result) => {
          const validation = BDLawQueue.validateExtraction(result);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe(FAILURE_REASONS.CONTENT_EMPTY);
        }
      ),
      { numRuns: 10 }
    );
  });

  test('should detect content below threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }), // threshold
        fc.integer({ min: 1, max: 99 }),     // content length (below default threshold of 100)
        (threshold, contentLength) => {
          // Generate content shorter than threshold
          const actualLength = Math.min(contentLength, threshold - 1);
          const content = 'x'.repeat(actualLength);
          
          const result = { success: true, content };
          const validation = BDLawQueue.validateExtraction(result, threshold);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe(FAILURE_REASONS.CONTENT_BELOW_THRESHOLD);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should accept valid content at or above threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 500 }),   // threshold
        fc.integer({ min: 0, max: 1000 }),   // extra length above threshold
        (threshold, extraLength) => {
          const content = 'x'.repeat(threshold + extraLength);
          
          const result = { success: true, content };
          const validation = BDLawQueue.validateExtraction(result, threshold);
          
          expect(validation.valid).toBe(true);
          expect(validation.reason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should use content_raw when content is not present', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        (contentLength) => {
          const content_raw = 'y'.repeat(contentLength);
          
          const result = { success: true, content_raw };
          const validation = BDLawQueue.validateExtraction(result, 100);
          
          expect(validation.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should prefer content_raw over content when both present', () => {
    // This tests that content_raw is checked first (as per design)
    const result = {
      success: true,
      content: 'short',  // 5 chars, below threshold
      content_raw: 'x'.repeat(200)  // 200 chars, above threshold
    };
    
    const validation = BDLawQueue.validateExtraction(result, 100);
    
    // Should use content_raw which is above threshold
    expect(validation.valid).toBe(true);
  });

  test('should use default threshold of 100 when not specified', () => {
    // Content of exactly 99 chars should fail
    const result99 = { success: true, content: 'x'.repeat(99) };
    const validation99 = BDLawQueue.validateExtraction(result99);
    expect(validation99.valid).toBe(false);
    expect(validation99.reason).toBe(FAILURE_REASONS.CONTENT_BELOW_THRESHOLD);
    
    // Content of exactly 100 chars should pass
    const result100 = { success: true, content: 'x'.repeat(100) };
    const validation100 = BDLawQueue.validateExtraction(result100);
    expect(validation100.valid).toBe(true);
  });

  test('should record specific failure_reason for each failure type', () => {
    // Test all failure scenarios have distinct reasons
    const scenarios = [
      { input: null, expectedReason: FAILURE_REASONS.EXTRACTION_ERROR },
      { input: { success: false }, expectedReason: FAILURE_REASONS.EXTRACTION_ERROR },
      { input: { success: true }, expectedReason: FAILURE_REASONS.CONTAINER_NOT_FOUND },
      { input: { success: true, content: '' }, expectedReason: FAILURE_REASONS.CONTENT_EMPTY },
      { input: { success: true, content: 'short' }, expectedReason: FAILURE_REASONS.CONTENT_BELOW_THRESHOLD }
    ];
    
    for (const scenario of scenarios) {
      const validation = BDLawQueue.validateExtraction(scenario.input);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe(scenario.expectedReason);
    }
  });

  test('FAILURE_REASONS constants should be defined', () => {
    expect(FAILURE_REASONS.CONTAINER_NOT_FOUND).toBe('container_not_found');
    expect(FAILURE_REASONS.CONTENT_EMPTY).toBe('content_empty');
    expect(FAILURE_REASONS.CONTENT_BELOW_THRESHOLD).toBe('content_below_threshold');
    expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).toBe('content_selector_mismatch');
    expect(FAILURE_REASONS.DOM_TIMEOUT).toBe('dom_timeout');
    expect(FAILURE_REASONS.NETWORK_ERROR).toBe('network_error');
    expect(FAILURE_REASONS.NAVIGATION_ERROR).toBe('navigation_error');
    expect(FAILURE_REASONS.EXTRACTION_ERROR).toBe('extraction_error');
    expect(FAILURE_REASONS.UNKNOWN_ERROR).toBe('unknown_error');
  });

  // ============================================
  // Requirements 3.8, 3.9 - Selector Mismatch Tests
  // ============================================

  test('should detect CONTENT_SELECTOR_MISMATCH when readinessResult indicates selector mismatch', () => {
    fc.assert(
      fc.property(
        fc.record({
          success: fc.constant(true),
          // No content or content_raw field - container not found scenario
          title: fc.option(fc.string(), { nil: undefined })
        }),
        (result) => {
          // When readinessResult indicates selector mismatch, should use CONTENT_SELECTOR_MISMATCH
          const readinessResult = { 
            ready: false, 
            reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH 
          };
          
          const validation = BDLawQueue.validateExtraction(result, 100, readinessResult);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should detect CONTAINER_NOT_FOUND when no readinessResult provided', () => {
    fc.assert(
      fc.property(
        fc.record({
          success: fc.constant(true),
          // No content or content_raw field
          title: fc.option(fc.string(), { nil: undefined })
        }),
        (result) => {
          // Without readinessResult, should default to CONTAINER_NOT_FOUND
          const validation = BDLawQueue.validateExtraction(result, 100, null);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe(FAILURE_REASONS.CONTAINER_NOT_FOUND);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should detect CONTAINER_NOT_FOUND when readinessResult has different reason', () => {
    fc.assert(
      fc.property(
        fc.record({
          success: fc.constant(true),
          // No content or content_raw field
          title: fc.option(fc.string(), { nil: undefined })
        }),
        fc.constantFrom(
          { ready: false, reason: FAILURE_REASONS.DOM_TIMEOUT },
          { ready: false, reason: FAILURE_REASONS.NETWORK_ERROR },
          { ready: true, signalType: 'act_title' }
        ),
        (result, readinessResult) => {
          // When readinessResult has a different reason (not selector mismatch),
          // should use CONTAINER_NOT_FOUND
          const validation = BDLawQueue.validateExtraction(result, 100, readinessResult);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe(FAILURE_REASONS.CONTAINER_NOT_FOUND);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should NOT classify selector mismatch as timeout (Requirements 3.8, 3.9)', () => {
    // This test ensures that selector mismatch failures are never misclassified as timeout
    fc.assert(
      fc.property(
        fc.record({
          success: fc.constant(true),
          // No content field - triggers container check
          title: fc.option(fc.string(), { nil: undefined })
        }),
        (result) => {
          // Selector mismatch readiness result
          const selectorMismatchReadiness = { 
            ready: false, 
            reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH 
          };
          
          const validation = BDLawQueue.validateExtraction(result, 100, selectorMismatchReadiness);
          
          // Must be selector mismatch, NOT timeout
          expect(validation.reason).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
          expect(validation.reason).not.toBe(FAILURE_REASONS.DOM_TIMEOUT);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should distinguish selector mismatch from timeout for fully rendered pages', () => {
    // Simulates the scenario where page rendered but no legal content anchors detected
    const scenarios = [
      {
        // Page rendered but no legal content signals - selector mismatch
        readinessResult: { ready: false, reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH },
        expectedReason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH
      },
      {
        // Page did not render in time - timeout
        readinessResult: { ready: false, reason: FAILURE_REASONS.DOM_TIMEOUT },
        expectedReason: FAILURE_REASONS.CONTAINER_NOT_FOUND // Falls back to container not found
      }
    ];
    
    for (const scenario of scenarios) {
      const result = { success: true }; // No content field
      const validation = BDLawQueue.validateExtraction(result, 100, scenario.readinessResult);
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe(scenario.expectedReason);
    }
  });

  test('readinessResult should not affect validation when content is present', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        fc.constantFrom(
          null,
          { ready: false, reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH },
          { ready: false, reason: FAILURE_REASONS.DOM_TIMEOUT },
          { ready: true, signalType: 'act_title' }
        ),
        (contentLength, readinessResult) => {
          const content = 'x'.repeat(contentLength);
          const result = { success: true, content };
          
          // When content is present and valid, readinessResult should not affect outcome
          const validation = BDLawQueue.validateExtraction(result, 100, readinessResult);
          
          expect(validation.valid).toBe(true);
          expect(validation.reason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
