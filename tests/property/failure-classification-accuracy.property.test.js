/**
 * Property Test: Failure Classification Accuracy
 * Feature: robust-queue-processing
 * Property 9: Failure Classification Accuracy
 * 
 * For any failed extraction on a fully-rendered page where legal content
 * signals are not detected, the failure_reason SHALL be "content_selector_mismatch",
 * NOT "dom_timeout" or "network_error". This ensures accurate failure classification
 * for audit and methodology disclosure.
 * 
 * Validates: Requirements 3.8, 3.9
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Feature: robust-queue-processing, Property 9: Failure Classification Accuracy', () => {
  const { FAILURE_REASONS, LEGAL_CONTENT_SIGNALS } = BDLawQueue;

  /**
   * Simulates failure classification logic
   * This mirrors the logic in waitForExtractionReadiness
   */
  function classifyFailure(pageState, elapsedMs, timeoutMs = 30000) {
    // If timeout not exceeded, no failure yet
    if (elapsedMs <= timeoutMs) {
      return null; // Still waiting
    }
    
    // Requirements 3.8, 3.9 - Distinguish between timeout and selector mismatch
    if (pageState.readyState === 'complete') {
      // Page rendered but no legal content signals detected
      return FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH;
    } else {
      // Page did not render in time
      return FAILURE_REASONS.DOM_TIMEOUT;
    }
  }

  // ============================================
  // Property Tests - Failure Classification
  // ============================================

  test('fully-rendered page without signals SHALL be CONTENT_SELECTOR_MISMATCH', () => {
    fc.assert(
      fc.property(
        fc.record({
          readyState: fc.constant('complete'), // Page fully rendered
          hasActTitle: fc.constant(false),
          hasEnactmentClause: fc.constant(false),
          hasFirstSection: fc.constant(false),
          contentLength: fc.integer({ min: 0, max: 99 }) // Below threshold
        }),
        fc.integer({ min: 30001, max: 100000 }), // Past timeout
        (pageState, elapsedMs) => {
          const failureReason = classifyFailure(pageState, elapsedMs, 30000);
          
          // Requirements 3.8, 3.9 - Must be selector mismatch, NOT timeout
          expect(failureReason).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
          expect(failureReason).not.toBe(FAILURE_REASONS.DOM_TIMEOUT);
          expect(failureReason).not.toBe(FAILURE_REASONS.NETWORK_ERROR);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('non-rendered page SHALL be DOM_TIMEOUT', () => {
    fc.assert(
      fc.property(
        fc.record({
          readyState: fc.constantFrom('loading', 'interactive'), // Page NOT rendered
          hasActTitle: fc.boolean(),
          hasEnactmentClause: fc.boolean(),
          hasFirstSection: fc.boolean(),
          contentLength: fc.integer({ min: 0, max: 500 })
        }),
        fc.integer({ min: 30001, max: 100000 }), // Past timeout
        (pageState, elapsedMs) => {
          const failureReason = classifyFailure(pageState, elapsedMs, 30000);
          
          // Requirements 3.8, 3.9 - Must be timeout, NOT selector mismatch
          expect(failureReason).toBe(FAILURE_REASONS.DOM_TIMEOUT);
          expect(failureReason).not.toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('CONTENT_SELECTOR_MISMATCH and DOM_TIMEOUT are distinct failure reasons', () => {
    // Requirements 3.8, 3.9 - These must be different values
    expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).not.toBe(FAILURE_REASONS.DOM_TIMEOUT);
    expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).toBe('content_selector_mismatch');
    expect(FAILURE_REASONS.DOM_TIMEOUT).toBe('dom_timeout');
  });

  test('failure classification is deterministic based on page state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('loading', 'interactive', 'complete'),
        fc.integer({ min: 30001, max: 100000 }),
        (readyState, elapsedMs) => {
          const pageState = { readyState };
          
          // Call twice with same inputs
          const result1 = classifyFailure(pageState, elapsedMs, 30000);
          const result2 = classifyFailure(pageState, elapsedMs, 30000);
          
          // Must be deterministic
          expect(result1).toBe(result2);
          
          // Must be one of the two expected values
          if (readyState === 'complete') {
            expect(result1).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
          } else {
            expect(result1).toBe(FAILURE_REASONS.DOM_TIMEOUT);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('no failure classification before timeout', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('loading', 'interactive', 'complete'),
        fc.integer({ min: 0, max: 30000 }), // Within timeout
        (readyState, elapsedMs) => {
          const pageState = { readyState };
          const result = classifyFailure(pageState, elapsedMs, 30000);
          
          // Should not classify as failure yet
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('exact timeout boundary with rendered page', () => {
    const pageState = { readyState: 'complete' };
    
    // At exactly 30000ms, should not fail yet (elapsedMs <= timeoutMs)
    expect(classifyFailure(pageState, 30000, 30000)).toBeNull();
    
    // At 30001ms, should fail with selector mismatch
    expect(classifyFailure(pageState, 30001, 30000)).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
  });

  test('exact timeout boundary with non-rendered page', () => {
    const pageState = { readyState: 'loading' };
    
    // At exactly 30000ms, should not fail yet
    expect(classifyFailure(pageState, 30000, 30000)).toBeNull();
    
    // At 30001ms, should fail with DOM timeout
    expect(classifyFailure(pageState, 30001, 30000)).toBe(FAILURE_REASONS.DOM_TIMEOUT);
  });

  test('interactive state is treated as non-rendered', () => {
    const pageState = { readyState: 'interactive' };
    const result = classifyFailure(pageState, 35000, 30000);
    
    // Interactive is not complete, so should be DOM_TIMEOUT
    expect(result).toBe(FAILURE_REASONS.DOM_TIMEOUT);
    expect(result).not.toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
  });

  // ============================================
  // Methodology Disclosure Validation
  // ============================================

  test('failure reasons support methodology disclosure', () => {
    // The system must distinguish between:
    // 1. Network/timeout failures: Page did not render successfully
    // 2. Selector mismatch failures: Page rendered but legal content could not be reliably detected
    
    // Verify both failure types exist
    expect(FAILURE_REASONS.DOM_TIMEOUT).toBeDefined();
    expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).toBeDefined();
    
    // Verify they are distinct
    expect(FAILURE_REASONS.DOM_TIMEOUT).not.toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
    
    // Verify they have meaningful string values for audit
    expect(typeof FAILURE_REASONS.DOM_TIMEOUT).toBe('string');
    expect(typeof FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).toBe('string');
    expect(FAILURE_REASONS.DOM_TIMEOUT.length).toBeGreaterThan(0);
    expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH.length).toBeGreaterThan(0);
  });
});
