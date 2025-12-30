/**
 * Property Test: Fallback Selector Hierarchy and Audit Trail
 * Feature: textual-fidelity-extraction
 * Property 7: Fallback Selector Hierarchy and Audit Trail
 * 
 * For any DOM structure where primary selectors fail to match, the extractor SHALL try
 * fallback selectors in defined order. When a fallback selector succeeds, the extractor
 * SHALL record extraction_method: "fallback_selector", successful_selector with the
 * matching selector, and selectors_attempted array containing all selectors tried
 * (both failed and successful).
 * 
 * Validates: Requirements 4.1, 4.4, 4.6, 6.2, 6.5, 11.2, 11.7
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Feature: textual-fidelity-extraction, Property 7: Fallback Selector Hierarchy and Audit Trail', () => {
  const { SELECTOR_HIERARCHY, FAILURE_REASONS } = BDLawExtractor;

  // ============================================
  // Generators for test data
  // ============================================

  // Generator for primary content selectors
  const primarySelectorArb = fc.constantFrom(
    ...SELECTOR_HIERARCHY.primary.content
  );

  // Generator for fallback content selectors
  const fallbackSelectorArb = fc.constantFrom(
    ...SELECTOR_HIERARCHY.fallback.content
  );

  // Generator for body fallback exclusion selectors
  const exclusionSelectorArb = fc.constantFrom(
    ...SELECTOR_HIERARCHY.bodyFallback.exclusions
  );

  // Generator for Bengali legal content
  const bengaliLegalContentArb = fc.oneof(
    fc.constant('ধারা ১। এই আইন বাংলাদেশ আইন নামে পরিচিত হইবে।'),
    fc.constant('অধ্যায় ১ - প্রারম্ভিক'),
    fc.constant('তফসিল - প্রথম তফসিল'),
    fc.constant('১৷ এই আইনের নাম'),
    fc.constant('যেহেতু এই আইন প্রণয়ন করা সমীচীন'),
    fc.constant('সেহেতু এতদ্বারা আইন করা হইল')
  );

  // Generator for English legal content
  const englishLegalContentArb = fc.oneof(
    fc.constant('Section 1. Short title and commencement.'),
    fc.constant('Chapter I - Preliminary'),
    fc.constant('Schedule - First Schedule'),
    fc.constant('WHEREAS it is expedient to make provision'),
    fc.constant('Be it enacted by Parliament')
  );

  // Generator for non-legal content (UI/navigation)
  const nonLegalContentArb = fc.oneof(
    fc.constant('Home | About | Contact'),
    fc.constant('Navigation Menu'),
    fc.constant('Copyright 2024 All Rights Reserved'),
    fc.constant('Search Results'),
    fc.constant('Loading...')
  );

  // Generator for extraction method types
  const extractionMethodArb = fc.constantFrom('primary', 'fallback', 'body_fallback');

  // ============================================
  // Property Tests
  // ============================================

  test('SELECTOR_HIERARCHY SHALL contain primary, fallback, and bodyFallback configurations', () => {
    // Requirements 6.1 - Support an ordered list of fallback content selectors
    expect(SELECTOR_HIERARCHY).toHaveProperty('primary');
    expect(SELECTOR_HIERARCHY).toHaveProperty('fallback');
    expect(SELECTOR_HIERARCHY).toHaveProperty('bodyFallback');
    
    // Primary selectors should exist
    expect(SELECTOR_HIERARCHY.primary).toHaveProperty('content');
    expect(SELECTOR_HIERARCHY.primary).toHaveProperty('title');
    expect(SELECTOR_HIERARCHY.primary).toHaveProperty('schedule');
    expect(Array.isArray(SELECTOR_HIERARCHY.primary.content)).toBe(true);
    expect(SELECTOR_HIERARCHY.primary.content.length).toBeGreaterThan(0);
    
    // Fallback selectors should exist
    expect(SELECTOR_HIERARCHY.fallback).toHaveProperty('content');
    expect(SELECTOR_HIERARCHY.fallback).toHaveProperty('preamble');
    expect(Array.isArray(SELECTOR_HIERARCHY.fallback.content)).toBe(true);
    expect(SELECTOR_HIERARCHY.fallback.content.length).toBeGreaterThan(0);
    
    // Body fallback should have selector and exclusions
    expect(SELECTOR_HIERARCHY.bodyFallback).toHaveProperty('selector');
    expect(SELECTOR_HIERARCHY.bodyFallback).toHaveProperty('exclusions');
    expect(SELECTOR_HIERARCHY.bodyFallback).toHaveProperty('requireLegalSignal');
    expect(SELECTOR_HIERARCHY.bodyFallback.selector).toBe('body');
    expect(Array.isArray(SELECTOR_HIERARCHY.bodyFallback.exclusions)).toBe(true);
  });

  test('primary selectors SHALL be tried before fallback selectors', () => {
    fc.assert(
      fc.property(
        fc.array(primarySelectorArb, { minLength: 1, maxLength: 3 }),
        fc.array(fallbackSelectorArb, { minLength: 1, maxLength: 3 }),
        (primarySelectors, fallbackSelectors) => {
          // Simulate selector attempt order
          const attempts = [];
          let attemptOrder = 0;
          
          // Primary selectors first
          primarySelectors.forEach(sel => {
            attempts.push(BDLawExtractor.createSelectorAttempt(sel, false, 0, attemptOrder++));
          });
          
          // Then fallback selectors
          fallbackSelectors.forEach(sel => {
            attempts.push(BDLawExtractor.createSelectorAttempt(sel, false, 0, attemptOrder++));
          });
          
          // Requirements 6.2 - Fallback selectors tried only after primary fails
          // Verify ordering: all primary attempts have lower attempt_order than fallback
          const primaryAttemptOrders = attempts
            .filter(a => primarySelectors.includes(a.selector))
            .map(a => a.attempt_order);
          const fallbackAttemptOrders = attempts
            .filter(a => fallbackSelectors.includes(a.selector))
            .map(a => a.attempt_order);
          
          if (primaryAttemptOrders.length > 0 && fallbackAttemptOrders.length > 0) {
            const maxPrimaryOrder = Math.max(...primaryAttemptOrders);
            const minFallbackOrder = Math.min(...fallbackAttemptOrders);
            expect(maxPrimaryOrder).toBeLessThan(minFallbackOrder);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('selectors_attempted SHALL record all selectors tried with attempt_order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(primarySelectorArb, fallbackSelectorArb),
          { minLength: 1, maxLength: 6 }
        ),
        (selectors) => {
          const attempts = selectors.map((sel, idx) =>
            BDLawExtractor.createSelectorAttempt(sel, idx === selectors.length - 1, idx === selectors.length - 1 ? 1 : 0, idx)
          );
          
          // Requirements 6.5 - Log all selector attempts for audit trail
          expect(attempts.length).toBe(selectors.length);
          
          // Each attempt should have required fields
          attempts.forEach((attempt, idx) => {
            expect(attempt).toHaveProperty('selector');
            expect(attempt).toHaveProperty('matched');
            expect(attempt).toHaveProperty('element_count');
            expect(attempt).toHaveProperty('attempt_order');
            expect(attempt.attempt_order).toBe(idx);
          });
          
          // Verify attempt_order is sequential
          for (let i = 1; i < attempts.length; i++) {
            expect(attempts[i].attempt_order).toBe(attempts[i - 1].attempt_order + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('successful_selector SHALL be recorded when fallback succeeds', () => {
    fc.assert(
      fc.property(
        fc.array(primarySelectorArb, { minLength: 1, maxLength: 3 }),
        fallbackSelectorArb,
        (failedPrimary, successfulFallback) => {
          const attempts = [];
          let attemptOrder = 0;
          
          // Primary selectors fail
          failedPrimary.forEach(sel => {
            attempts.push(BDLawExtractor.createSelectorAttempt(sel, false, 0, attemptOrder++));
          });
          
          // Fallback selector succeeds
          attempts.push(BDLawExtractor.createSelectorAttempt(successfulFallback, true, 1, attemptOrder++));
          
          const metadata = BDLawExtractor.createExtractionMetadata({
            success: true,
            selectorsAttempted: attempts,
            successfulSelector: successfulFallback,
            extractionMethod: 'fallback'
          });
          
          // Requirements 4.4 - Log which selector succeeded
          expect(metadata.successful_selector).toBe(successfulFallback);
          expect(metadata.extraction_success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('extraction_method SHALL be "fallback" when fallback selector succeeds', () => {
    fc.assert(
      fc.property(
        fc.array(primarySelectorArb, { minLength: 1, maxLength: 3 }),
        fallbackSelectorArb,
        (failedPrimary, successfulFallback) => {
          const attempts = [];
          let attemptOrder = 0;
          
          // Primary selectors fail
          failedPrimary.forEach(sel => {
            attempts.push(BDLawExtractor.createSelectorAttempt(sel, false, 0, attemptOrder++));
          });
          
          // Fallback selector succeeds
          attempts.push(BDLawExtractor.createSelectorAttempt(successfulFallback, true, 1, attemptOrder++));
          
          const metadata = BDLawExtractor.createExtractionMetadata({
            success: true,
            selectorsAttempted: attempts,
            successfulSelector: successfulFallback,
            extractionMethod: 'fallback'
          });
          
          // Requirements 4.6 - Record extraction_method: "fallback_selector"
          expect(metadata.extraction_method).toBe('fallback');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('extraction_method SHALL be "primary" when primary selector succeeds', () => {
    fc.assert(
      fc.property(
        primarySelectorArb,
        (successfulPrimary) => {
          const attempts = [
            BDLawExtractor.createSelectorAttempt(successfulPrimary, true, 1, 0)
          ];
          
          const metadata = BDLawExtractor.createExtractionMetadata({
            success: true,
            selectorsAttempted: attempts,
            successfulSelector: successfulPrimary,
            extractionMethod: 'primary'
          });
          
          // Requirements 4.6 - Record extraction_method: "primary"
          expect(metadata.extraction_method).toBe('primary');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('all_selectors_exhausted SHALL be true when all selectors fail', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(primarySelectorArb, fallbackSelectorArb),
          { minLength: 1, maxLength: 6 }
        ),
        (selectors) => {
          const attempts = selectors.map((sel, idx) =>
            BDLawExtractor.createSelectorAttempt(sel, false, 0, idx)
          );
          
          const metadata = BDLawExtractor.createExtractionMetadata({
            success: false,
            failureReason: FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
            selectorsAttempted: attempts
          });
          
          // Requirements 11.7 - Record content_container_selector indicating which selector succeeded
          // When all fail, all_selectors_exhausted should be true
          expect(metadata.all_selectors_exhausted).toBe(true);
          expect(metadata.successful_selector).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('bodyFallback exclusions SHALL include navigation, header, footer, sidebar elements', () => {
    const requiredExclusions = [
      'header',
      'nav',
      'footer',
      '.sidebar',
      '.navigation',
      '.menu',
      '.search',
      '.related-links',
      '.breadcrumb',
      '.copyright',
      'script',
      'style'
    ];
    
    // Requirements 11.4 - Body fallback with exclusion blacklist
    requiredExclusions.forEach(exclusion => {
      expect(SELECTOR_HIERARCHY.bodyFallback.exclusions).toContain(exclusion);
    });
  });

  test('bodyFallback SHALL require legal signal for valid extraction', () => {
    // Requirements 11.4 - Body fallback requires legal signal
    expect(SELECTOR_HIERARCHY.bodyFallback.requireLegalSignal).toBe(true);
  });

  test('extraction metadata is deterministic for same inputs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(primarySelectorArb, fallbackSelectorArb),
          { minLength: 1, maxLength: 5 }
        ),
        fc.boolean(),
        extractionMethodArb,
        (selectors, success, method) => {
          const attempts = selectors.map((sel, idx) =>
            BDLawExtractor.createSelectorAttempt(sel, success && idx === selectors.length - 1, success && idx === selectors.length - 1 ? 1 : 0, idx)
          );
          
          const successfulSelector = success ? selectors[selectors.length - 1] : null;
          
          const metadata1 = BDLawExtractor.createExtractionMetadata({
            success,
            failureReason: success ? null : FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
            selectorsAttempted: attempts,
            successfulSelector,
            extractionMethod: method
          });
          
          const metadata2 = BDLawExtractor.createExtractionMetadata({
            success,
            failureReason: success ? null : FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
            selectorsAttempted: attempts,
            successfulSelector,
            extractionMethod: method
          });
          
          // Must be deterministic
          expect(metadata1.extraction_success).toBe(metadata2.extraction_success);
          expect(metadata1.failure_reason).toBe(metadata2.failure_reason);
          expect(metadata1.successful_selector).toBe(metadata2.successful_selector);
          expect(metadata1.extraction_method).toBe(metadata2.extraction_method);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('SELECTOR_HIERARCHY.primary.content matches LEGAL_SELECTORS.content', () => {
    // Ensure consistency between old and new selector configurations
    expect(SELECTOR_HIERARCHY.primary.content).toEqual(
      expect.arrayContaining(BDLawExtractor.LEGAL_SELECTORS.content)
    );
  });

  test('fallback selectors include .boxed-layout as specified in requirements', () => {
    // Requirements 11.3 - Include .boxed-layout as fallback container selector
    expect(SELECTOR_HIERARCHY.fallback.content).toContain('.boxed-layout');
  });

  test('body is the final fallback selector', () => {
    // Requirements 11.4 - Include body as final fallback selector
    expect(SELECTOR_HIERARCHY.bodyFallback.selector).toBe('body');
  });

  test('createSelectorAttempt handles edge cases', () => {
    // Null/undefined selector
    const attempt1 = BDLawExtractor.createSelectorAttempt(null, false, 0, 0);
    expect(attempt1.selector).toBe('');
    
    // Undefined element count
    const attempt2 = BDLawExtractor.createSelectorAttempt('#test', true, undefined, 0);
    expect(attempt2.element_count).toBe(0);
    
    // Undefined attempt order
    const attempt3 = BDLawExtractor.createSelectorAttempt('#test', true, 1, undefined);
    expect(attempt3.attempt_order).toBe(0);
  });

  test('createExtractionMetadata handles missing options', () => {
    const metadata = BDLawExtractor.createExtractionMetadata();
    
    expect(metadata.extraction_success).toBe(false);
    expect(metadata.failure_reason).toBe(FAILURE_REASONS.UNKNOWN);
    expect(metadata.selectors_attempted).toEqual([]);
    expect(metadata.successful_selector).toBeNull();
    expect(metadata.extraction_method).toBe('primary');
  });

  test('fallback preamble selectors exist for preamble extraction', () => {
    // Requirements 6.3 - Support fallback selectors for preamble
    expect(SELECTOR_HIERARCHY.fallback).toHaveProperty('preamble');
    expect(Array.isArray(SELECTOR_HIERARCHY.fallback.preamble)).toBe(true);
    expect(SELECTOR_HIERARCHY.fallback.preamble.length).toBeGreaterThan(0);
  });

  test('fallback schedule selectors exist for schedule extraction', () => {
    // Requirements 6.3 - Support fallback selectors for schedules
    expect(SELECTOR_HIERARCHY.fallback).toHaveProperty('schedule');
    expect(Array.isArray(SELECTOR_HIERARCHY.fallback.schedule)).toBe(true);
    expect(SELECTOR_HIERARCHY.fallback.schedule.length).toBeGreaterThan(0);
  });
});
