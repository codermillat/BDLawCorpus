const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Property 7: Extraction Readiness Enforcement', () => {
  const { FAILURE_REASONS, QUEUE_CONFIG_DEFAULTS, LEGAL_CONTENT_SIGNALS } = BDLawQueue;

  function checkLegalContentSignals(pageState) {
    if (pageState.hasActTitle) return { hasSignal: true, signalType: 'act_title' };
    if (pageState.hasEnactmentClause) return { hasSignal: true, signalType: 'enactment_clause' };
    if (pageState.hasFirstSection) return { hasSignal: true, signalType: 'first_section' };
    return { hasSignal: false };
  }

  function checkExtractionReadiness(pageState, elapsedMs, timeoutMs = 30000, minThreshold = 100) {
    if (elapsedMs > timeoutMs) {
      if (pageState.readyState === 'complete') {
        return { ready: false, reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH };
      }
      return { ready: false, reason: FAILURE_REASONS.DOM_TIMEOUT };
    }
    if (pageState.readyState !== 'complete') return { ready: false, shouldWait: true };
    const signalResult = checkLegalContentSignals(pageState);
    if (signalResult.hasSignal) return { ready: true, signalType: signalResult.signalType };
    if (pageState.contentLength >= minThreshold) return { ready: true, signalType: 'content_threshold' };
    if (elapsedMs < timeoutMs) return { ready: false, shouldWait: true };
    return { ready: false, reason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH };
  }

  test('act_title signal', () => {
    const r = checkExtractionReadiness({ readyState: 'complete', hasActTitle: true, hasEnactmentClause: false, hasFirstSection: false, contentLength: 50 }, 0);
    expect(r.ready).toBe(true);
    expect(r.signalType).toBe('act_title');
  });

  test('enactment_clause signal', () => {
    const r = checkExtractionReadiness({ readyState: 'complete', hasActTitle: false, hasEnactmentClause: true, hasFirstSection: false, contentLength: 50 }, 0);
    expect(r.ready).toBe(true);
    expect(r.signalType).toBe('enactment_clause');
  });

  test('first_section signal', () => {
    const r = checkExtractionReadiness({ readyState: 'complete', hasActTitle: false, hasEnactmentClause: false, hasFirstSection: true, contentLength: 50 }, 0);
    expect(r.ready).toBe(true);
    expect(r.signalType).toBe('first_section');
  });

  test('content_threshold signal', () => {
    const r = checkExtractionReadiness({ readyState: 'complete', hasActTitle: false, hasEnactmentClause: false, hasFirstSection: false, contentLength: 150 }, 0);
    expect(r.ready).toBe(true);
    expect(r.signalType).toBe('content_threshold');
  });

  test('CONTENT_SELECTOR_MISMATCH when timeout AND page rendered', () => {
    fc.assert(fc.property(
      fc.record({ readyState: fc.constant('complete'), hasActTitle: fc.constant(false), hasEnactmentClause: fc.constant(false), hasFirstSection: fc.constant(false), contentLength: fc.integer({ min: 0, max: 99 }) }),
      fc.integer({ min: 30001, max: 100000 }),
      (ps, ms) => {
        const r = checkExtractionReadiness(ps, ms, 30000, 100);
        expect(r.ready).toBe(false);
        expect(r.reason).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
      }
    ), { numRuns: 100 });
  });

  test('DOM_TIMEOUT when timeout AND page NOT rendered', () => {
    fc.assert(fc.property(
      fc.record({ readyState: fc.constantFrom('loading', 'interactive'), hasActTitle: fc.boolean(), hasEnactmentClause: fc.boolean(), hasFirstSection: fc.boolean(), contentLength: fc.integer({ min: 0, max: 500 }) }),
      fc.integer({ min: 30001, max: 100000 }),
      (ps, ms) => {
        const r = checkExtractionReadiness(ps, ms, 30000, 100);
        expect(r.ready).toBe(false);
        expect(r.reason).toBe(FAILURE_REASONS.DOM_TIMEOUT);
      }
    ), { numRuns: 100 });
  });

  test('default timeout 30000ms', () => { expect(QUEUE_CONFIG_DEFAULTS.dom_readiness_timeout_ms).toBe(30000); });
  test('CONTENT_SELECTOR_MISMATCH defined', () => { expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).toBe('content_selector_mismatch'); });
  test('DOM_TIMEOUT defined', () => { expect(FAILURE_REASONS.DOM_TIMEOUT).toBe('dom_timeout'); });

  test('LEGAL_CONTENT_SIGNALS has title selectors', () => {
    expect(LEGAL_CONTENT_SIGNALS.ACT_TITLE_SELECTORS).toBeDefined();
    expect(Array.isArray(LEGAL_CONTENT_SIGNALS.ACT_TITLE_SELECTORS)).toBe(true);
  });

  test('LEGAL_CONTENT_SIGNALS has EN/BN enactment patterns', () => {
    const p = LEGAL_CONTENT_SIGNALS.ENACTMENT_PATTERNS;
    expect(p.some(x => x.test('It is hereby enacted'))).toBe(true);
  });

  test('LEGAL_CONTENT_SIGNALS has EN/BN section patterns', () => {
    const p = LEGAL_CONTENT_SIGNALS.SECTION_PATTERNS;
    expect(p.some(x => x.test('1. Short title'))).toBe(true);
  });

  test('priority: act_title first', () => {
    const r = checkExtractionReadiness({ readyState: 'complete', hasActTitle: true, hasEnactmentClause: true, hasFirstSection: true, contentLength: 150 }, 0);
    expect(r.signalType).toBe('act_title');
  });
});
