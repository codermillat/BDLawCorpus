/**
 * Property Test: Failure Reason Classification Accuracy
 * Feature: textual-fidelity-extraction
 * Property 8: Failure Reason Classification Accuracy
 * 
 * For any failed extraction, the failure_reason SHALL be one of:
 * "content_selector_mismatch", "empty_content", "dom_not_ready", "network_error", "unknown".
 * When failure_reason is "content_selector_mismatch", the selectors_attempted array SHALL be non-empty.
 * A DOM with visible legal text but no matching selectors SHALL be classified as
 * "content_selector_mismatch", NOT "empty_content".
 * 
 * Validates: Requirements 4.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Feature: textual-fidelity-extraction, Property 8: Failure Reason Classification Accuracy', () => {
  const { FAILURE_REASONS, LEGAL_SIGNAL_PATTERNS } = BDLawExtractor;

  // ============================================
  // Generators for test data
  // ============================================

  // Generator for Bengali legal content with markers
  const bengaliLegalContentArb = fc.oneof(
    fc.constant('ধারা ১। এই আইন বাংলাদেশ আইন নামে পরিচিত হইবে।'),
    fc.constant('অধ্যায় ১ - প্রারম্ভিক'),
    fc.constant('তফসিল - প্রথম তফসিল'),
    fc.constant('১৷ এই আইনের নাম'),
    fc.constant('২৷ সংজ্ঞা'),
    fc.constant('যেহেতু এই আইন প্রণয়ন করা সমীচীন'),
    fc.constant('সেহেতু এতদ্বারা আইন করা হইল'),
    fc.tuple(
      fc.constantFrom('ধারা', 'অধ্যায়', 'তফসিল'),
      fc.integer({ min: 1, max: 100 })
    ).map(([marker, num]) => `${marker} ${num}। আইনের বিধান`)
  );

  // Generator for English legal content with markers
  const englishLegalContentArb = fc.oneof(
    fc.constant('Section 1. Short title and commencement.'),
    fc.constant('Chapter I - Preliminary'),
    fc.constant('Schedule - First Schedule'),
    fc.constant('WHEREAS it is expedient to make provision'),
    fc.constant('Be it enacted by Parliament'),
    fc.tuple(
      fc.constantFrom('Section', 'Chapter', 'Schedule'),
      fc.integer({ min: 1, max: 100 })
    ).map(([marker, num]) => `${marker} ${num}. Legal provision text.`)
  );

  // Generator for content without legal signals (UI/navigation content)
  const nonLegalContentArb = fc.oneof(
    fc.constant('Home | About | Contact'),
    fc.constant('Navigation Menu'),
    fc.constant('Copyright 2024 All Rights Reserved'),
    fc.constant('Search Results'),
    fc.constant('Loading...'),
    fc.constant('Click here to continue'),
    fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '1', '2', '3'), { minLength: 10, maxLength: 100 })
  );

  // Generator for selector arrays
  const selectorArrayArb = fc.array(
    fc.constantFrom('#lawContent', '.law-content', '.act-details', '#content', '.main'),
    { minLength: 1, maxLength: 5 }
  );

  // Generator for empty selector arrays
  const emptySelectorArrayArb = fc.constant([]);

  // ============================================
  // Property Tests
  // ============================================

  test('failure_reason SHALL be one of the defined failure reason codes', () => {
    const validReasons = Object.values(FAILURE_REASONS);

    fc.assert(
      fc.property(
        fc.record({
          selectorsAttempted: fc.oneof(selectorArrayArb, emptySelectorArrayArb),
          domReady: fc.boolean(),
          networkError: fc.boolean(),
          contentFound: fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            nonLegalContentArb,
            bengaliLegalContentArb,
            englishLegalContentArb
          )
        }),
        (context) => {
          const result = BDLawExtractor.classifyFailure(context);
          
          // Requirements 7.1 - failure_reason must be one of defined codes
          expect(validReasons).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('network_error SHALL be classified when networkError is true', () => {
    fc.assert(
      fc.property(
        fc.record({
          selectorsAttempted: fc.oneof(selectorArrayArb, emptySelectorArrayArb),
          domReady: fc.boolean(),
          networkError: fc.constant(true),
          contentFound: fc.oneof(fc.constant(''), nonLegalContentArb, bengaliLegalContentArb)
        }),
        (context) => {
          const result = BDLawExtractor.classifyFailure(context);
          
          // Requirements 7.1 - network_error takes precedence
          expect(result).toBe(FAILURE_REASONS.NETWORK_ERROR);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('dom_not_ready SHALL be classified when domReady is false (and no network error)', () => {
    fc.assert(
      fc.property(
        fc.record({
          selectorsAttempted: fc.oneof(selectorArrayArb, emptySelectorArrayArb),
          domReady: fc.constant(false),
          networkError: fc.constant(false),
          contentFound: fc.oneof(fc.constant(''), nonLegalContentArb, bengaliLegalContentArb)
        }),
        (context) => {
          const result = BDLawExtractor.classifyFailure(context);
          
          // Requirements 7.1 - dom_not_ready when DOM not ready
          expect(result).toBe(FAILURE_REASONS.DOM_NOT_READY);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('content_selector_mismatch SHALL be classified when selectors tried but no content found', () => {
    fc.assert(
      fc.property(
        fc.record({
          selectorsAttempted: selectorArrayArb, // Non-empty selector array
          domReady: fc.constant(true),
          networkError: fc.constant(false),
          contentFound: fc.constantFrom('', '   ', null, undefined)
        }),
        (context) => {
          const result = BDLawExtractor.classifyFailure(context);
          
          // Requirements 7.3 - selector mismatch when selectors tried but no content
          expect(result).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('content_selector_mismatch SHALL be classified when content has no legal signal', () => {
    fc.assert(
      fc.property(
        fc.record({
          selectorsAttempted: selectorArrayArb,
          domReady: fc.constant(true),
          networkError: fc.constant(false),
          contentFound: nonLegalContentArb // Content without legal markers
        }),
        (context) => {
          const result = BDLawExtractor.classifyFailure(context);
          
          // Requirements 7.4, 7.5 - content without legal signal is selector mismatch
          expect(result).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
          expect(result).not.toBe(FAILURE_REASONS.EMPTY_CONTENT);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('empty_content SHALL be classified when content is whitespace only (no selectors tried)', () => {
    fc.assert(
      fc.property(
        fc.record({
          selectorsAttempted: emptySelectorArrayArb, // No selectors tried
          domReady: fc.constant(true),
          networkError: fc.constant(false),
          contentFound: fc.stringOf(fc.constant(' '), { minLength: 1, maxLength: 10 })
        }),
        (context) => {
          const result = BDLawExtractor.classifyFailure(context);
          
          // Requirements 7.1 - empty_content when content is whitespace
          expect(result).toBe(FAILURE_REASONS.EMPTY_CONTENT);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hasLegalSignal SHALL return true for Bengali legal markers', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentArb,
        (content) => {
          const result = BDLawExtractor.hasLegalSignal(content);
          
          // Requirements 7.4 - Bengali markers should be detected
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hasLegalSignal SHALL return true for English legal markers', () => {
    fc.assert(
      fc.property(
        englishLegalContentArb,
        (content) => {
          const result = BDLawExtractor.hasLegalSignal(content);
          
          // Requirements 7.4 - English markers should be detected
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hasLegalSignal SHALL return false for non-legal content', () => {
    fc.assert(
      fc.property(
        nonLegalContentArb,
        (content) => {
          const result = BDLawExtractor.hasLegalSignal(content);
          
          // Requirements 7.5 - Non-legal content should not have signal
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hasLegalSignal SHALL return false for empty or null content', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', null, undefined),
        (content) => {
          const result = BDLawExtractor.hasLegalSignal(content);
          
          // Empty/null content has no legal signal
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('failure classification is deterministic for same inputs', () => {
    fc.assert(
      fc.property(
        fc.record({
          selectorsAttempted: fc.oneof(selectorArrayArb, emptySelectorArrayArb),
          domReady: fc.boolean(),
          networkError: fc.boolean(),
          contentFound: fc.oneof(fc.constant(''), nonLegalContentArb, bengaliLegalContentArb)
        }),
        (context) => {
          // Call twice with same inputs
          const result1 = BDLawExtractor.classifyFailure(context);
          const result2 = BDLawExtractor.classifyFailure(context);
          
          // Must be deterministic
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('selectors_attempted metadata SHALL be recorded in extraction metadata', () => {
    fc.assert(
      fc.property(
        selectorArrayArb,
        fc.boolean(),
        (selectors, success) => {
          const attempts = selectors.map((sel, idx) => 
            BDLawExtractor.createSelectorAttempt(sel, false, 0, idx)
          );
          
          const metadata = BDLawExtractor.createExtractionMetadata({
            success,
            failureReason: success ? null : FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
            selectorsAttempted: attempts
          });
          
          // Requirements 7.6 - selectors_attempted should be recorded
          expect(metadata.selectors_attempted).toEqual(attempts);
          expect(metadata.selectors_attempted.length).toBe(selectors.length);
          
          // Each attempt should have required fields
          metadata.selectors_attempted.forEach((attempt, idx) => {
            expect(attempt).toHaveProperty('selector');
            expect(attempt).toHaveProperty('matched');
            expect(attempt).toHaveProperty('element_count');
            expect(attempt).toHaveProperty('attempt_order');
            expect(attempt.attempt_order).toBe(idx);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('Bengali numeral+danda patterns are detected as legal signal', () => {
    const numeralDandaPatterns = ['১৷', '২৷', '১০৷', '২৫৷', '১০০৷'];
    
    numeralDandaPatterns.forEach(pattern => {
      const content = `${pattern} এই ধারার বিধান`;
      expect(BDLawExtractor.hasLegalSignal(content)).toBe(true);
    });
  });

  test('preamble patterns are detected as legal signal', () => {
    const preamblePatterns = [
      'যেহেতু এই আইন প্রণয়ন করা সমীচীন',
      'WHEREAS it is expedient to make provision',
      'Whereas the Parliament has enacted'
    ];
    
    preamblePatterns.forEach(pattern => {
      expect(BDLawExtractor.hasLegalSignal(pattern)).toBe(true);
    });
  });

  test('enactment clause patterns are detected as legal signal', () => {
    const enactmentPatterns = [
      'সেহেতু এতদ্বারা আইন করা হইল',
      'Be it enacted by Parliament',
      'BE IT ENACTED by the Legislature'
    ];
    
    enactmentPatterns.forEach(pattern => {
      expect(BDLawExtractor.hasLegalSignal(pattern)).toBe(true);
    });
  });

  test('FAILURE_REASONS constants are all distinct', () => {
    const reasons = Object.values(FAILURE_REASONS);
    const uniqueReasons = new Set(reasons);
    
    expect(uniqueReasons.size).toBe(reasons.length);
  });

  test('createSelectorAttempt creates valid attempt records', () => {
    const attempt = BDLawExtractor.createSelectorAttempt('#test', true, 5, 0);
    
    expect(attempt.selector).toBe('#test');
    expect(attempt.matched).toBe(true);
    expect(attempt.element_count).toBe(5);
    expect(attempt.attempt_order).toBe(0);
  });

  test('createExtractionMetadata creates valid metadata for failed extraction', () => {
    const attempts = [
      BDLawExtractor.createSelectorAttempt('#lawContent', false, 0, 0),
      BDLawExtractor.createSelectorAttempt('.law-content', false, 0, 1)
    ];
    
    const metadata = BDLawExtractor.createExtractionMetadata({
      success: false,
      failureReason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
      selectorsAttempted: attempts
    });
    
    expect(metadata.extraction_success).toBe(false);
    expect(metadata.failure_reason).toBe(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);
    expect(metadata.selectors_attempted).toEqual(attempts);
    expect(metadata.all_selectors_exhausted).toBe(true);
  });

  test('createExtractionMetadata creates valid metadata for successful extraction', () => {
    const attempts = [
      BDLawExtractor.createSelectorAttempt('#lawContent', true, 1, 0)
    ];
    
    const metadata = BDLawExtractor.createExtractionMetadata({
      success: true,
      selectorsAttempted: attempts,
      successfulSelector: '#lawContent',
      extractionMethod: 'primary'
    });
    
    expect(metadata.extraction_success).toBe(true);
    expect(metadata.failure_reason).toBeNull();
    expect(metadata.successful_selector).toBe('#lawContent');
    expect(metadata.extraction_method).toBe('primary');
    expect(metadata.all_selectors_exhausted).toBe(false);
  });
});
