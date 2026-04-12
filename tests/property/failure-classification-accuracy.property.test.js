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
    const result = BDLawQueue.assessReadinessSnapshot(pageState, {
      elapsedMs,
      timeoutMs,
      minThreshold: 100
    });

    return result.reason || null;
  }

  // ============================================
  // Property Tests - Failure Classification
  // ============================================

  test('fully-rendered page without signals SHALL be CONTENT_SELECTOR_MISMATCH', () => {
    fc.assert(
      fc.property(
        fc.record({
          readyState: fc.constantFrom('interactive', 'complete'), // Page rendered enough for extraction
          hasActTitle: fc.constant(false),
          hasEnactmentClause: fc.constant(false),
          hasFirstSection: fc.constant(false),
          hasStructuralSignal: fc.constant(false),
          hasBodyLegalSignal: fc.constant(false),
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
          readyState: fc.constant('loading'), // Page NOT rendered
          hasActTitle: fc.boolean(),
          hasEnactmentClause: fc.boolean(),
          hasFirstSection: fc.boolean(),
          hasStructuralSignal: fc.boolean(),
          hasBodyLegalSignal: fc.boolean(),
          contentLength: fc.integer({ min: 0, max: 500 })
        }),
        fc.integer({ min: 30001, max: 100000 }), // Past timeout
        (pageState, elapsedMs) => {
          const failureReason = classifyFailure(pageState, elapsedMs, 30000);
          
          // Requirements 3.8, 3.9 - Must be DOM-not-ready, NOT selector mismatch
          expect(failureReason).toBe(FAILURE_REASONS.DOM_NOT_READY);
          expect(failureReason).not.toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('CONTENT_SELECTOR_MISMATCH and DOM_NOT_READY are distinct failure reasons', () => {
    // Requirements 3.8, 3.9 - These must be different values
    expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).not.toBe(FAILURE_REASONS.DOM_NOT_READY);
    expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).toBe('content_selector_mismatch');
    expect(FAILURE_REASONS.DOM_NOT_READY).toBe('dom_not_ready');
  });

  test('failure classification is deterministic based on page state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('loading', 'interactive', 'complete'),
        fc.integer({ min: 30001, max: 100000 }),
        (readyState, elapsedMs) => {
          const pageState = {
            readyState,
            hasActTitle: false,
            hasEnactmentClause: false,
            hasFirstSection: false,
            hasStructuralSignal: false,
            hasBodyLegalSignal: false,
            contentLength: 0
          };
          
          // Call twice with same inputs
          const result1 = classifyFailure(pageState, elapsedMs, 30000);
          const result2 = classifyFailure(pageState, elapsedMs, 30000);
          
          // Must be deterministic
          expect(result1).toBe(result2);
          
          // Must be one of the two expected values
          if (readyState === 'complete' || readyState === 'interactive') {
            expect(result1).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
          } else {
            expect(result1).toBe(FAILURE_REASONS.DOM_NOT_READY);
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
          const pageState = {
            readyState,
            hasActTitle: false,
            hasEnactmentClause: false,
            hasFirstSection: false,
            hasStructuralSignal: false,
            hasBodyLegalSignal: false,
            contentLength: 0
          };
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
    const pageState = { readyState: 'complete', hasActTitle: false, hasEnactmentClause: false, hasFirstSection: false, hasStructuralSignal: false, hasBodyLegalSignal: false, contentLength: 0 };
    
    // At exactly 30000ms, should not fail yet (elapsedMs <= timeoutMs)
    expect(classifyFailure(pageState, 30000, 30000)).toBeNull();
    
    // At 30001ms, should fail with selector mismatch
    expect(classifyFailure(pageState, 30001, 30000)).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
  });

  test('exact timeout boundary with non-rendered page', () => {
    const pageState = { readyState: 'loading', hasActTitle: false, hasEnactmentClause: false, hasFirstSection: false, hasStructuralSignal: false, hasBodyLegalSignal: false, contentLength: 0 };
    
    // At exactly 30000ms, should not fail yet
    expect(classifyFailure(pageState, 30000, 30000)).toBeNull();
    
    // At 30001ms, should fail with DOM timeout
    expect(classifyFailure(pageState, 30001, 30000)).toBe(FAILURE_REASONS.DOM_NOT_READY);
  });

  test('interactive state is treated as rendered for selector mismatch classification', () => {
    const pageState = { readyState: 'interactive', hasActTitle: false, hasEnactmentClause: false, hasFirstSection: false, hasStructuralSignal: false, hasBodyLegalSignal: false, contentLength: 0 };
    const result = classifyFailure(pageState, 35000, 30000);
    
    // Interactive is rendered enough, so should be selector mismatch once timed out.
    expect(result).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
    expect(result).not.toBe(FAILURE_REASONS.DOM_NOT_READY);
  });

  // ============================================
  // Methodology Disclosure Validation
  // ============================================

  test('failure reasons support methodology disclosure', () => {
    // The system must distinguish between:
    // 1. Network/timeout failures: Page did not render successfully
    // 2. Selector mismatch failures: Page rendered but legal content could not be reliably detected
    
    // Verify both failure types exist
    expect(FAILURE_REASONS.DOM_NOT_READY).toBeDefined();
    expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).toBeDefined();
    
    // Verify they are distinct
    expect(FAILURE_REASONS.DOM_NOT_READY).not.toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
    
    // Verify they have meaningful string values for audit
    expect(typeof FAILURE_REASONS.DOM_NOT_READY).toBe('string');
    expect(typeof FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).toBe('string');
    expect(FAILURE_REASONS.DOM_NOT_READY.length).toBeGreaterThan(0);
    expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH.length).toBeGreaterThan(0);
  });
});
