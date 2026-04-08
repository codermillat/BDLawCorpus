/**
 * Property Test: Retry Mechanism Correctness
 * Feature: robust-queue-processing
 * Property 4: Retry Mechanism Correctness
 * 
 * For any failed extraction with retry_count < max_retry_attempts, the system
 * SHALL retry with exponential backoff delay (base_delay * 2^retry_count).
 * Retry_count SHALL increment with each attempt. When retry_count >= max_retry_attempts,
 * the act SHALL be marked as permanently failed.
 * 
 * UPDATED: shouldRetry is classification-driven.
 * Retry is allowed only when:
 *   1) retry_count < max_retries
 *   2) failure_reason is TRANSIENT (environmental/recoverable)
 *
 * TRANSIENT examples: site_unavailable, network_error, dom_not_ready
 * PERMANENT examples: act_not_found, content_selector_mismatch
 * 
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Feature: robust-queue-processing, Property 4: Retry Mechanism Correctness', () => {
  const { FAILURE_REASONS, QUEUE_CONFIG_DEFAULTS } = BDLawQueue;

  // Transient (retryable) failure reasons
  const RETRYABLE_REASONS = [
    FAILURE_REASONS.SITE_UNAVAILABLE,
    FAILURE_REASONS.NETWORK_ERROR,
    FAILURE_REASONS.DOM_NOT_READY,
    FAILURE_REASONS.DOM_TIMEOUT,
    FAILURE_REASONS.NAVIGATION_ERROR,
    FAILURE_REASONS.UNKNOWN_ERROR
  ];

  // Permanent (non-retryable) failure reasons
  const NON_RETRYABLE_REASONS = [
    FAILURE_REASONS.ACT_NOT_FOUND,
    FAILURE_REASONS.CONTENT_SELECTOR_MISMATCH,
    FAILURE_REASONS.CONTAINER_NOT_FOUND,
    FAILURE_REASONS.CONTENT_EMPTY,
    FAILURE_REASONS.CONTENT_BELOW_THRESHOLD,
    FAILURE_REASONS.EXTRACTION_ERROR
  ];

  test('shouldRetry returns true when retry_count < max_retries AND failure is retryable', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),  // max_retries
        fc.constantFrom(...RETRYABLE_REASONS), // retryable failure reason
        (maxRetries, failureReason) => {
          // Test all retry counts below max
          for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
            const entry = {
              retry_count: retryCount,
              max_retries: maxRetries,
              failure_reason: failureReason
            };
            
            expect(BDLawQueue.shouldRetry(entry)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('shouldRetry returns false when retry_count >= max_retries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),  // max_retries
        fc.integer({ min: 0, max: 5 }),   // extra retries beyond max
        fc.constantFrom(...RETRYABLE_REASONS), // retryable failure reason
        (maxRetries, extra, failureReason) => {
          const entry = {
            retry_count: maxRetries + extra,
            max_retries: maxRetries,
            failure_reason: failureReason
          };
          
          expect(BDLawQueue.shouldRetry(entry)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('shouldRetry handles edge cases', () => {
    // Null entry
    expect(BDLawQueue.shouldRetry(null)).toBe(false);
    
    // Undefined entry
    expect(BDLawQueue.shouldRetry(undefined)).toBe(false);
    
    // Entry at exact max (with retryable/transient reason)
    expect(BDLawQueue.shouldRetry({ 
      retry_count: 3, 
      max_retries: 3,
      failure_reason: FAILURE_REASONS.SITE_UNAVAILABLE 
    })).toBe(false);
    
    // Entry one below max (with retryable/transient reason)
    expect(BDLawQueue.shouldRetry({ 
      retry_count: 2, 
      max_retries: 3,
      failure_reason: FAILURE_REASONS.SITE_UNAVAILABLE 
    })).toBe(true);
    
    // Entry below max with transient reason is retryable
    expect(BDLawQueue.shouldRetry({ 
      retry_count: 0, 
      max_retries: 3,
      failure_reason: FAILURE_REASONS.NETWORK_ERROR 
    })).toBe(true);
    
    // Entry below max with another transient reason remains retryable
    expect(BDLawQueue.shouldRetry({ 
      retry_count: 0, 
      max_retries: 3,
      failure_reason: FAILURE_REASONS.DOM_NOT_READY 
    })).toBe(true);

    // Entry below max but with permanent reason is never retryable
    expect(BDLawQueue.shouldRetry({
      retry_count: 0,
      max_retries: 3,
      failure_reason: FAILURE_REASONS.ACT_NOT_FOUND
    })).toBe(false);
  });

  test('calculateRetryDelay implements exponential backoff correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),    // retry count
        fc.integer({ min: 1000, max: 10000 }), // base delay
        (retryCount, baseDelay) => {
          const delay = BDLawQueue.calculateRetryDelay(retryCount, baseDelay);
          
          // Expected: base_delay * 2^(retry_count - 1)
          const expected = baseDelay * Math.pow(2, retryCount - 1);
          
          expect(delay).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('calculateRetryDelay uses default base delay when not specified', () => {
    // Default base delay is 5000ms
    expect(BDLawQueue.calculateRetryDelay(1)).toBe(5000);      // 5000 * 2^0 = 5000
    expect(BDLawQueue.calculateRetryDelay(2)).toBe(10000);     // 5000 * 2^1 = 10000
    expect(BDLawQueue.calculateRetryDelay(3)).toBe(20000);     // 5000 * 2^2 = 20000
  });

  test('calculateRetryDelay handles edge cases', () => {
    // Zero retry count should use 2^0 = 1
    expect(BDLawQueue.calculateRetryDelay(0, 5000)).toBe(5000);
    
    // Negative retry count should be treated as 0
    expect(BDLawQueue.calculateRetryDelay(-1, 5000)).toBe(5000);
  });

  test('exponential backoff delay increases with each retry', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000 }), // base delay
        fc.integer({ min: 1, max: 5 }),        // max retries
        (baseDelay, maxRetries) => {
          let previousDelay = 0;
          
          for (let retry = 1; retry <= maxRetries; retry++) {
            const delay = BDLawQueue.calculateRetryDelay(retry, baseDelay);
            
            // Each delay should be greater than the previous
            expect(delay).toBeGreaterThan(previousDelay);
            
            // Each delay should be exactly double the previous (for retry > 1)
            if (retry > 1) {
              expect(delay).toBe(previousDelay * 2);
            }
            
            previousDelay = delay;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('retry count increments correctly through addFailedExtraction', () => {
    const item = { id: 'test_1', actNumber: '123', url: 'http://test.com', title: 'Test' };
    const maxRetries = 3;
    
    let failedExtractions = [];
    
    // Simulate multiple retry attempts with a TRANSIENT failure reason
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      failedExtractions = BDLawQueue.addFailedExtraction(
        failedExtractions,
        item,
        FAILURE_REASONS.SITE_UNAVAILABLE, // transient reason
        attempt,
        maxRetries
      );
      
      const entry = failedExtractions[0];
      
      // Verify retry_count matches attempt number
      expect(entry.retry_count).toBe(attempt);
      
      // Verify shouldRetry logic - only true if below max AND transient reason
      if (attempt < maxRetries) {
        expect(BDLawQueue.shouldRetry(entry)).toBe(true);
      } else {
        expect(BDLawQueue.shouldRetry(entry)).toBe(false);
      }
    }
  });

  test('transient failures are retried while below max_retries', () => {
    const item = { id: 'test_1', actNumber: '123', url: 'http://test.com', title: 'Test' };
    const maxRetries = 3;
    
    // Test with network_error - transient, should be retryable below max
    const failedExtractions = BDLawQueue.addFailedExtraction(
      [],
      item,
      FAILURE_REASONS.NETWORK_ERROR,
      1,
      maxRetries
    );
    
    const entry = failedExtractions[0];
    expect(entry.retry_count).toBe(1);
    expect(BDLawQueue.shouldRetry(entry)).toBe(true);
  });

  test('permanent failures are never retried regardless of retry_count', () => {
    const item = { id: 'test_1', actNumber: '123', url: 'http://test.com', title: 'Test' };
    const maxRetries = 3;

    const failedExtractions = BDLawQueue.addFailedExtraction(
      [],
      item,
      FAILURE_REASONS.ACT_NOT_FOUND,
      1,
      maxRetries
    );

    const entry = failedExtractions[0];
    expect(entry.retry_count).toBe(1);
    expect(BDLawQueue.shouldRetry(entry)).toBe(false);
  });

  test('classifyFailure maps reasons to transient/permanent taxonomy', () => {
    RETRYABLE_REASONS.forEach((reason) => {
      expect(BDLawQueue.classifyFailure(reason)).toBe('transient');
    });

    NON_RETRYABLE_REASONS.forEach((reason) => {
      expect(BDLawQueue.classifyFailure(reason)).toBe('permanent');
    });
  });

  test('permanently failed acts have retry_count >= max_retries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),  // max_retries
        (maxRetries) => {
          const item = { id: 'test_1', actNumber: '123', url: 'http://test.com', title: 'Test' };
          
          // Add failed extraction at max retries
          const failedExtractions = BDLawQueue.addFailedExtraction(
            [],
            item,
            FAILURE_REASONS.DOM_TIMEOUT,
            maxRetries,
            maxRetries
          );
          
          const entry = failedExtractions[0];
          
          // Should be permanently failed
          expect(BDLawQueue.shouldRetry(entry)).toBe(false);
          expect(entry.retry_count).toBe(maxRetries);
          expect(entry.max_retries).toBe(maxRetries);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('retry delay sequence follows exponential pattern', () => {
    const baseDelay = QUEUE_CONFIG_DEFAULTS.retry_base_delay_ms;
    
    // Verify the sequence: 5000, 10000, 20000, 40000, 80000...
    const expectedSequence = [
      baseDelay * 1,   // 2^0 = 1
      baseDelay * 2,   // 2^1 = 2
      baseDelay * 4,   // 2^2 = 4
      baseDelay * 8,   // 2^3 = 8
      baseDelay * 16   // 2^4 = 16
    ];
    
    for (let i = 0; i < expectedSequence.length; i++) {
      const delay = BDLawQueue.calculateRetryDelay(i + 1, baseDelay);
      expect(delay).toBe(expectedSequence[i]);
    }
  });

  test('max_retries from config defaults is respected', () => {
    const defaultMaxRetries = QUEUE_CONFIG_DEFAULTS.max_retry_attempts;
    
    expect(defaultMaxRetries).toBe(3);
    expect(QUEUE_CONFIG_DEFAULTS.max_retry_attempts_min).toBe(1);
    expect(QUEUE_CONFIG_DEFAULTS.max_retry_attempts_max).toBe(5);
  });
});
