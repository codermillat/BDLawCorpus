const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Property 7: Extraction Readiness Enforcement', () => {
  const { FAILURE_REASONS, QUEUE_CONFIG_DEFAULTS, LEGAL_CONTENT_SIGNALS } = BDLawQueue;

  function checkExtractionReadiness(pageState, elapsedMs, timeoutMs = 30000, minThreshold = 100) {
    return BDLawQueue.assessReadinessSnapshot(pageState, { elapsedMs, timeoutMs, minThreshold });
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
    const r = checkExtractionReadiness({ readyState: 'complete', hasActTitle: false, hasEnactmentClause: false, hasFirstSection: false, hasStructuralSignal: false, hasBodyLegalSignal: true, contentLength: 150 }, 0);
    expect(r.ready).toBe(true);
    expect(r.signalType).toBe('content_threshold_with_signal');
  });

  test('CONTENT_SELECTOR_MISMATCH when timeout AND page rendered', () => {
    fc.assert(fc.property(
      fc.record({ readyState: fc.constantFrom('interactive', 'complete'), hasActTitle: fc.constant(false), hasEnactmentClause: fc.constant(false), hasFirstSection: fc.constant(false), hasStructuralSignal: fc.constant(false), hasBodyLegalSignal: fc.constant(false), contentLength: fc.integer({ min: 0, max: 99 }) }),
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
      fc.record({ readyState: fc.constant('loading'), hasActTitle: fc.boolean(), hasEnactmentClause: fc.boolean(), hasFirstSection: fc.boolean(), hasStructuralSignal: fc.boolean(), hasBodyLegalSignal: fc.boolean(), contentLength: fc.integer({ min: 0, max: 500 }) }),
      fc.integer({ min: 30001, max: 100000 }),
      (ps, ms) => {
        const r = checkExtractionReadiness(ps, ms, 30000, 100);
        expect(r.ready).toBe(false);
        expect(r.reason).toBe(FAILURE_REASONS.DOM_NOT_READY);
      }
    ), { numRuns: 100 });
  });

  test('default timeout 30000ms', () => { expect(QUEUE_CONFIG_DEFAULTS.dom_readiness_timeout_ms).toBe(30000); });
  test('CONTENT_SELECTOR_MISMATCH defined', () => { expect(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH).toBe('content_selector_mismatch'); });
  test('DOM_NOT_READY defined', () => { expect(FAILURE_REASONS.DOM_NOT_READY).toBe('dom_not_ready'); });

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
    const r = checkExtractionReadiness({ readyState: 'complete', hasActTitle: true, hasEnactmentClause: true, hasFirstSection: true, hasStructuralSignal: true, hasBodyLegalSignal: true, contentLength: 150 }, 0);
    expect(r.signalType).toBe('act_title');
  });

  test('structural DOM signals make interactive pages extractable', () => {
    const r = checkExtractionReadiness({ readyState: 'interactive', hasActTitle: false, hasEnactmentClause: false, hasFirstSection: false, hasStructuralSignal: true, hasBodyLegalSignal: false, contentLength: 40 }, 0);
    expect(r.ready).toBe(true);
    expect(r.signalType).toBe('dom_structure');
  });

  test('section patterns accept old-style bracketed section headings', () => {
    expect(LEGAL_CONTENT_SIGNALS.SECTION_PATTERNS.some(x => x.test('1.[Preamble.]'))).toBe(true);
  });
});
