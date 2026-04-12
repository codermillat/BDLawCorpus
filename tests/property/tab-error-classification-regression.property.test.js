const BDLawQueue = require('../../bdlaw-queue.js');

describe('Regression: tab error classification for manually analyzed failed acts', () => {
  const { FAILURE_REASONS, LEGAL_CONTENT_SIGNALS } = BDLawQueue;

  test('valid act-details-500 page is not misclassified as site_unavailable', () => {
    expect(BDLawQueue.classifyTabFailure({
      url: 'http://bdlaws.minlaw.gov.bd/act-details-500.html',
      title: 'The Appropriation Act, 1975'
    })).toBeNull();
  });

  test('valid act-details-404 page is not misclassified as act_not_found', () => {
    expect(BDLawQueue.classifyTabFailure({
      url: 'http://bdlaws.minlaw.gov.bd/act-details-404.html',
      title: "The Printing Corporation (Vesting) Order, 1972 (President's Order)"
    })).toBeNull();
  });

  test('soft 404 page is classified as ACT_NOT_FOUND', () => {
    expect(BDLawQueue.classifyTabFailure({
      url: 'http://bdlaws.minlaw.gov.bd/act-details-1082.html',
      title: '404'
    })).toBe(FAILURE_REASONS.ACT_NOT_FOUND);
  });

  test('real server error title is classified as SITE_UNAVAILABLE', () => {
    expect(BDLawQueue.classifyTabFailure({
      url: 'http://bdlaws.minlaw.gov.bd/error.html',
      title: 'HTTP Status 500 – Internal Server Error'
    })).toBe(FAILURE_REASONS.SITE_UNAVAILABLE);
  });

  test('classifyTabFailure still detects chrome error pages', () => {
    expect(BDLawQueue.classifyTabFailure({
      url: 'chrome-error://chromewebdata/',
      title: 'This site can’t be reached'
    })).toBe(FAILURE_REASONS.SITE_UNAVAILABLE);
  });

  test('readiness accepts strong DOM structure for older irregular pages', () => {
    const readiness = BDLawQueue.assessReadinessSnapshot({
      readyState: 'interactive',
      hasActTitle: true,
      hasEnactmentClause: false,
      hasFirstSection: false,
      hasStructuralSignal: true,
      hasBodyLegalSignal: false,
      contentLength: 80
    }, {
      elapsedMs: 1000,
      timeoutMs: 30000,
      minThreshold: 100
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.signalType).toBe('act_title');
  });

  test('section regex accepts old-style numbered bracket headings', () => {
    expect(
      LEGAL_CONTENT_SIGNALS.SECTION_PATTERNS.some((pattern) => pattern.test('1.[Preamble.] Rep. by the Bengal Repealing Act'))
    ).toBe(true);
  });

  test('queue title selectors include real BDLaws title hooks', () => {
    expect(LEGAL_CONTENT_SIGNALS.ACT_TITLE_SELECTORS).toEqual(
      expect.arrayContaining(['.bg-act-section h3', '.boxed-layout h3', '.text-center h3'])
    );
  });
});