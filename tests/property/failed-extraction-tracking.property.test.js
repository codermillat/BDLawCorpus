/**
 * Property Test: Failed Extraction Tracking
 * Feature: robust-queue-processing
 * Property 3: Failed Extraction Tracking
 * 
 * For any failed extraction, the failed_extractions list SHALL contain an entry
 * with act_id, url, failure_reason, retry_count, and failed_at timestamp.
 * Failed extractions SHALL persist until explicitly cleared.
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.6
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Feature: robust-queue-processing, Property 3: Failed Extraction Tracking', () => {
  const { FAILURE_REASONS } = BDLawQueue;

  // Generator for queue items
  const queueItemArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    actNumber: fc.string({ minLength: 1, maxLength: 10 }),
    title: fc.string({ minLength: 0, maxLength: 100 }),
    url: fc.webUrl(),
    status: fc.constant('pending')
  });

  // Generator for failure reasons
  const failureReasonArb = fc.constantFrom(
    FAILURE_REASONS.CONTAINER_NOT_FOUND,
    FAILURE_REASONS.CONTENT_EMPTY,
    FAILURE_REASONS.CONTENT_BELOW_THRESHOLD,
    FAILURE_REASONS.DOM_TIMEOUT,
    FAILURE_REASONS.NETWORK_ERROR,
    FAILURE_REASONS.NAVIGATION_ERROR,
    FAILURE_REASONS.EXTRACTION_ERROR,
    FAILURE_REASONS.UNKNOWN_ERROR
  );

  test('should create failed extraction entry with all required fields', () => {
    fc.assert(
      fc.property(
        queueItemArb,
        failureReasonArb,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (item, reason, attemptNumber, maxRetries) => {
          const failedExtractions = [];
          const result = BDLawQueue.addFailedExtraction(
            failedExtractions, 
            item, 
            reason, 
            attemptNumber,
            maxRetries
          );
          
          expect(result.length).toBe(1);
          
          const entry = result[0];
          
          // Requirements: 4.2 - Required fields
          expect(entry.act_id).toBe(item.id);
          expect(entry.act_number).toBe(item.actNumber);
          expect(entry.url).toBe(item.url);
          expect(entry.title).toBe(item.title);
          expect(entry.failure_reason).toBe(reason);
          expect(entry.retry_count).toBe(attemptNumber);
          expect(entry.max_retries).toBe(maxRetries);
          expect(entry.failed_at).toBeDefined();
          expect(entry.attempts).toBeInstanceOf(Array);
          expect(entry.attempts.length).toBe(1);
          
          // Verify attempt entry
          const attempt = entry.attempts[0];
          expect(attempt.attempt_number).toBe(attemptNumber);
          expect(attempt.timestamp).toBeDefined();
          expect(attempt.reason).toBe(reason);
          expect(attempt.outcome).toBe('failed');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should update existing entry on subsequent failures', () => {
    fc.assert(
      fc.property(
        queueItemArb,
        failureReasonArb,
        failureReasonArb,
        (item, reason1, reason2) => {
          // First failure
          let failedExtractions = BDLawQueue.addFailedExtraction([], item, reason1, 1, 3);
          expect(failedExtractions.length).toBe(1);
          
          // Second failure (same item)
          failedExtractions = BDLawQueue.addFailedExtraction(failedExtractions, item, reason2, 2, 3);
          
          // Should still be one entry (updated, not duplicated)
          expect(failedExtractions.length).toBe(1);
          
          const entry = failedExtractions[0];
          expect(entry.retry_count).toBe(2);
          expect(entry.failure_reason).toBe(reason2);
          expect(entry.attempts.length).toBe(2);
          
          // Verify both attempts are recorded
          expect(entry.attempts[0].attempt_number).toBe(1);
          expect(entry.attempts[0].reason).toBe(reason1);
          expect(entry.attempts[1].attempt_number).toBe(2);
          expect(entry.attempts[1].reason).toBe(reason2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should track multiple different failed extractions separately', () => {
    fc.assert(
      fc.property(
        fc.array(queueItemArb, { minLength: 2, maxLength: 10 }),
        failureReasonArb,
        (items, reason) => {
          // Ensure unique IDs
          const uniqueItems = items.map((item, i) => ({
            ...item,
            id: `unique_${i}_${item.id}`
          }));
          
          let failedExtractions = [];
          
          for (const item of uniqueItems) {
            failedExtractions = BDLawQueue.addFailedExtraction(
              failedExtractions, 
              item, 
              reason, 
              1, 
              3
            );
          }
          
          // Should have one entry per unique item
          expect(failedExtractions.length).toBe(uniqueItems.length);
          
          // Each entry should have correct act_id
          for (let i = 0; i < uniqueItems.length; i++) {
            const entry = failedExtractions.find(f => f.act_id === uniqueItems[i].id);
            expect(entry).toBeDefined();
            expect(entry.act_id).toBe(uniqueItems[i].id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should preserve failed_at timestamp format', () => {
    fc.assert(
      fc.property(
        queueItemArb,
        failureReasonArb,
        (item, reason) => {
          const result = BDLawQueue.addFailedExtraction([], item, reason, 1, 3);
          const entry = result[0];
          
          // Verify ISO 8601 timestamp format
          const timestamp = new Date(entry.failed_at);
          expect(timestamp.toISOString()).toBe(entry.failed_at);
          
          // Verify attempt timestamp
          const attemptTimestamp = new Date(entry.attempts[0].timestamp);
          expect(attemptTimestamp.toISOString()).toBe(entry.attempts[0].timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle empty or invalid failedExtractions input', () => {
    const item = { id: 'test_1', actNumber: '123', url: 'http://test.com', title: 'Test' };
    const reason = FAILURE_REASONS.NETWORK_ERROR;
    
    // Test with null
    const result1 = BDLawQueue.addFailedExtraction(null, item, reason, 1, 3);
    expect(result1.length).toBe(1);
    
    // Test with undefined
    const result2 = BDLawQueue.addFailedExtraction(undefined, item, reason, 1, 3);
    expect(result2.length).toBe(1);
    
    // Test with non-array
    const result3 = BDLawQueue.addFailedExtraction('invalid', item, reason, 1, 3);
    expect(result3.length).toBe(1);
  });

  test('should not mutate original failedExtractions array', () => {
    fc.assert(
      fc.property(
        queueItemArb,
        failureReasonArb,
        (item, reason) => {
          const original = [];
          const result = BDLawQueue.addFailedExtraction(original, item, reason, 1, 3);
          
          // Original should be unchanged
          expect(original.length).toBe(0);
          
          // Result should be new array
          expect(result).not.toBe(original);
          expect(result.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should record complete attempt history across multiple retries', () => {
    const item = { id: 'test_1', actNumber: '123', url: 'http://test.com', title: 'Test' };
    const reasons = [
      FAILURE_REASONS.DOM_TIMEOUT,
      FAILURE_REASONS.NETWORK_ERROR,
      FAILURE_REASONS.CONTENT_EMPTY
    ];
    
    let failedExtractions = [];
    
    for (let i = 0; i < reasons.length; i++) {
      failedExtractions = BDLawQueue.addFailedExtraction(
        failedExtractions, 
        item, 
        reasons[i], 
        i + 1, 
        3
      );
    }
    
    expect(failedExtractions.length).toBe(1);
    
    const entry = failedExtractions[0];
    expect(entry.attempts.length).toBe(3);
    
    // Verify each attempt is recorded with correct details
    for (let i = 0; i < reasons.length; i++) {
      expect(entry.attempts[i].attempt_number).toBe(i + 1);
      expect(entry.attempts[i].reason).toBe(reasons[i]);
      expect(entry.attempts[i].outcome).toBe('failed');
    }
  });
});
