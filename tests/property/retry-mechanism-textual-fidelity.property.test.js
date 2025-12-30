/**
 * Property Test: Retry Mechanism Correctness
 * Feature: textual-fidelity-extraction
 * Property 10: Retry Mechanism Correctness
 * 
 * For any extraction that fails with "content_selector_mismatch", the extractor
 * SHALL automatically retry with fallback selectors up to the configured maximum (default: 3).
 * When retry succeeds, retry_count and successful_selector SHALL be recorded.
 * When all retries fail, all_selectors_exhausted: true SHALL be set.
 * Retries SHALL NOT occur for failure reasons other than "content_selector_mismatch".
 * Retries SHALL differ only by selector choice or delay timing;
 * retries SHALL NOT alter content processing, filtering rules, or pattern detection logic.
 * 
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Feature: textual-fidelity-extraction, Property 10: Retry Mechanism Correctness', () => {
  const { FAILURE_REASONS, RETRY_CONFIG } = BDLawExtractor;

  // ============================================
  // Generators for test data
  // ============================================

  // Generator for max_retries values within valid range
  const maxRetriesArb = fc.integer({ 
    min: RETRY_CONFIG.max_retries_min, 
    max: RETRY_CONFIG.max_retries_max 
  });

  // Generator for retry counts
  const retryCountArb = fc.integer({ min: 0, max: 10 });

  // Generator for retryable failure reasons (only content_selector_mismatch)
  const retryableFailureArb = fc.constant(FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH);

  // Generator for non-retryable failure reasons
  const nonRetryableFailureArb = fc.constantFrom(
    FAILURE_REASONS.EMPTY_CONTENT,
    FAILURE_REASONS.DOM_NOT_READY,
    FAILURE_REASONS.NETWORK_ERROR,
    FAILURE_REASONS.UNKNOWN
  );

  // Generator for all failure reasons
  const allFailureReasonsArb = fc.constantFrom(
    FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
    FAILURE_REASONS.EMPTY_CONTENT,
    FAILURE_REASONS.DOM_NOT_READY,
    FAILURE_REASONS.NETWORK_ERROR,
    FAILURE_REASONS.UNKNOWN
  );

  // Generator for selector strings
  const selectorArb = fc.constantFrom(
    '#lawContent', '.law-content', '.act-details', 
    '.boxed-layout', '.content-wrapper', 'body'
  );

  // Generator for extraction methods
  const extractionMethodArb = fc.constantFrom('primary', 'fallback', 'body_fallback');

  // ============================================
  // Property Tests - Retry Configuration
  // ============================================

  test('RETRY_CONFIG SHALL have default max_retries of 3', () => {
    // Requirements 12.2 - Default max_retries is 3
    expect(RETRY_CONFIG.max_retries).toBe(3);
  });

  test('getRetryConfig SHALL return default config when no argument provided', () => {
    const config = BDLawExtractor.getRetryConfig();
    
    expect(config.max_retries).toBe(RETRY_CONFIG.max_retries);
    expect(config.retryable_failures).toEqual(RETRY_CONFIG.retryable_failures);
  });

  test('getRetryConfig SHALL clamp max_retries to valid range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        (inputMaxRetries) => {
          const config = BDLawExtractor.getRetryConfig(inputMaxRetries);
          
          // Requirements 12.2 - max_retries should be clamped to valid range
          expect(config.max_retries).toBeGreaterThanOrEqual(RETRY_CONFIG.max_retries_min);
          expect(config.max_retries).toBeLessThanOrEqual(RETRY_CONFIG.max_retries_max);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getRetryConfig SHALL preserve valid max_retries values', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        (validMaxRetries) => {
          const config = BDLawExtractor.getRetryConfig(validMaxRetries);
          
          // Valid values should be preserved
          expect(config.max_retries).toBe(validMaxRetries);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Property Tests - Retryable Failure Detection
  // ============================================

  test('isRetryableFailure SHALL return true ONLY for content_selector_mismatch', () => {
    fc.assert(
      fc.property(
        allFailureReasonsArb,
        (failureReason) => {
          const isRetryable = BDLawExtractor.isRetryableFailure(failureReason);
          
          // Requirements 12.1, 12.6 - Only content_selector_mismatch is retryable
          if (failureReason === FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH) {
            expect(isRetryable).toBe(true);
          } else {
            expect(isRetryable).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('isRetryableFailure SHALL return false for null/undefined/invalid input', () => {
    expect(BDLawExtractor.isRetryableFailure(null)).toBe(false);
    expect(BDLawExtractor.isRetryableFailure(undefined)).toBe(false);
    expect(BDLawExtractor.isRetryableFailure('')).toBe(false);
    expect(BDLawExtractor.isRetryableFailure(123)).toBe(false);
    expect(BDLawExtractor.isRetryableFailure({})).toBe(false);
  });

  // ============================================
  // Property Tests - shouldRetryExtraction
  // ============================================

  test('shouldRetryExtraction SHALL return true for retryable failure when retry_count < max_retries', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        (maxRetries) => {
          // Test all retry counts below max
          for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
            const shouldRetry = BDLawExtractor.shouldRetryExtraction(
              FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
              retryCount,
              maxRetries
            );
            
            // Requirements 12.1, 12.2 - Should retry when count < max
            expect(shouldRetry).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('shouldRetryExtraction SHALL return false when retry_count >= max_retries', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        fc.integer({ min: 0, max: 5 }), // extra retries beyond max
        (maxRetries, extra) => {
          const retryCount = maxRetries + extra;
          
          const shouldRetry = BDLawExtractor.shouldRetryExtraction(
            FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
            retryCount,
            maxRetries
          );
          
          // Requirements 12.2 - Should not retry when count >= max
          expect(shouldRetry).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('shouldRetryExtraction SHALL return false for non-retryable failures regardless of retry count', () => {
    fc.assert(
      fc.property(
        nonRetryableFailureArb,
        retryCountArb,
        maxRetriesArb,
        (failureReason, retryCount, maxRetries) => {
          const shouldRetry = BDLawExtractor.shouldRetryExtraction(
            failureReason,
            retryCount,
            maxRetries
          );
          
          // Requirements 12.6 - Do NOT retry for non-selector-mismatch failures
          expect(shouldRetry).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Property Tests - Retry Metadata
  // ============================================

  test('createRetryMetadata SHALL include all required fields', () => {
    fc.assert(
      fc.property(
        retryCountArb,
        maxRetriesArb,
        fc.option(selectorArb, { nil: null }),
        fc.boolean(),
        (retryCount, maxRetries, successfulSelector, allExhausted) => {
          const metadata = BDLawExtractor.createRetryMetadata({
            retryCount,
            maxRetries,
            successfulSelector,
            allSelectorsExhausted: allExhausted,
            retryAttempts: []
          });
          
          // Requirements 12.4, 12.5 - All required fields present
          expect(metadata).toHaveProperty('retry_count');
          expect(metadata).toHaveProperty('max_retries');
          expect(metadata).toHaveProperty('successful_selector');
          expect(metadata).toHaveProperty('all_selectors_exhausted');
          expect(metadata).toHaveProperty('retry_attempts');
          
          expect(metadata.retry_count).toBe(retryCount);
          expect(metadata.max_retries).toBe(maxRetries);
          expect(metadata.successful_selector).toBe(successfulSelector);
          expect(metadata.all_selectors_exhausted).toBe(allExhausted);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('createRetryMetadata SHALL use defaults when options not provided', () => {
    const metadata = BDLawExtractor.createRetryMetadata();
    
    expect(metadata.retry_count).toBe(0);
    expect(metadata.max_retries).toBe(RETRY_CONFIG.max_retries);
    expect(metadata.successful_selector).toBeNull();
    expect(metadata.all_selectors_exhausted).toBe(false);
    expect(metadata.retry_attempts).toEqual([]);
  });

  // ============================================
  // Property Tests - Retry Attempt Records
  // ============================================

  test('createRetryAttemptRecord SHALL include all required fields', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        selectorArb,
        extractionMethodArb,
        fc.boolean(),
        (attemptNumber, selector, method, success) => {
          const record = BDLawExtractor.createRetryAttemptRecord(
            attemptNumber,
            selector,
            method,
            success
          );
          
          // Requirements 12.3 - Log each retry attempt with selector used
          expect(record).toHaveProperty('attempt_number');
          expect(record).toHaveProperty('selector_used');
          expect(record).toHaveProperty('extraction_method');
          expect(record).toHaveProperty('success');
          expect(record).toHaveProperty('timestamp');
          
          expect(record.attempt_number).toBe(attemptNumber);
          expect(record.selector_used).toBe(selector);
          expect(record.extraction_method).toBe(method);
          expect(record.success).toBe(success);
          expect(typeof record.timestamp).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('createRetryAttemptRecord timestamp SHALL be valid ISO format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        selectorArb,
        extractionMethodArb,
        fc.boolean(),
        (attemptNumber, selector, method, success) => {
          const record = BDLawExtractor.createRetryAttemptRecord(
            attemptNumber,
            selector,
            method,
            success
          );
          
          // Timestamp should be valid ISO format
          const parsed = new Date(record.timestamp);
          expect(parsed.toISOString()).toBe(record.timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Property Tests - RETRY_CONFIG Constants
  // ============================================

  test('RETRY_CONFIG.retryable_failures SHALL contain only content_selector_mismatch', () => {
    // Requirements 12.1, 12.6 - Only content_selector_mismatch triggers retry
    expect(RETRY_CONFIG.retryable_failures).toEqual(['content_selector_mismatch']);
    expect(RETRY_CONFIG.retryable_failures.length).toBe(1);
  });

  test('RETRY_CONFIG bounds SHALL be valid', () => {
    // min should be less than or equal to default
    expect(RETRY_CONFIG.max_retries_min).toBeLessThanOrEqual(RETRY_CONFIG.max_retries);
    
    // default should be less than or equal to max
    expect(RETRY_CONFIG.max_retries).toBeLessThanOrEqual(RETRY_CONFIG.max_retries_max);
    
    // min should be at least 1
    expect(RETRY_CONFIG.max_retries_min).toBeGreaterThanOrEqual(1);
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('shouldRetryExtraction handles edge case at exact max_retries boundary', () => {
    const maxRetries = 3;
    
    // At max - 1, should retry
    expect(BDLawExtractor.shouldRetryExtraction(
      FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
      maxRetries - 1,
      maxRetries
    )).toBe(true);
    
    // At exact max, should NOT retry
    expect(BDLawExtractor.shouldRetryExtraction(
      FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
      maxRetries,
      maxRetries
    )).toBe(false);
    
    // Above max, should NOT retry
    expect(BDLawExtractor.shouldRetryExtraction(
      FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
      maxRetries + 1,
      maxRetries
    )).toBe(false);
  });

  test('shouldRetryExtraction handles invalid retry count values', () => {
    // Negative retry count
    expect(BDLawExtractor.shouldRetryExtraction(
      FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
      -1,
      3
    )).toBe(true); // -1 < 3, so should retry
    
    // Non-number retry count
    expect(BDLawExtractor.shouldRetryExtraction(
      FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
      'invalid',
      3
    )).toBe(false);
    
    // Null retry count
    expect(BDLawExtractor.shouldRetryExtraction(
      FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
      null,
      3
    )).toBe(false);
  });

  test('createRetryAttemptRecord handles missing/invalid inputs gracefully', () => {
    // Missing attempt number
    const record1 = BDLawExtractor.createRetryAttemptRecord(undefined, '#test', 'primary', true);
    expect(record1.attempt_number).toBe(1);
    
    // Missing selector
    const record2 = BDLawExtractor.createRetryAttemptRecord(1, null, 'primary', true);
    expect(record2.selector_used).toBeNull();
    
    // Missing method
    const record3 = BDLawExtractor.createRetryAttemptRecord(1, '#test', undefined, true);
    expect(record3.extraction_method).toBe('primary');
    
    // Missing success
    const record4 = BDLawExtractor.createRetryAttemptRecord(1, '#test', 'primary', undefined);
    expect(record4.success).toBe(false);
  });

  // ============================================
  // Determinism Tests
  // ============================================

  test('isRetryableFailure is deterministic for same input', () => {
    fc.assert(
      fc.property(
        allFailureReasonsArb,
        (failureReason) => {
          const result1 = BDLawExtractor.isRetryableFailure(failureReason);
          const result2 = BDLawExtractor.isRetryableFailure(failureReason);
          
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('shouldRetryExtraction is deterministic for same inputs', () => {
    fc.assert(
      fc.property(
        allFailureReasonsArb,
        retryCountArb,
        maxRetriesArb,
        (failureReason, retryCount, maxRetries) => {
          const result1 = BDLawExtractor.shouldRetryExtraction(failureReason, retryCount, maxRetries);
          const result2 = BDLawExtractor.shouldRetryExtraction(failureReason, retryCount, maxRetries);
          
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getRetryConfig is deterministic for same input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        (maxRetries) => {
          const config1 = BDLawExtractor.getRetryConfig(maxRetries);
          const config2 = BDLawExtractor.getRetryConfig(maxRetries);
          
          expect(config1.max_retries).toBe(config2.max_retries);
        }
      ),
      { numRuns: 100 }
    );
  });
});
