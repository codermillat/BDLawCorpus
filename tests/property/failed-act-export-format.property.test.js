/**
 * Property Test: Failed Act Export Format
 * Feature: robust-queue-processing
 * Property 5: Failed Act Export Format
 * 
 * For any permanently failed act, the export SHALL include extraction_status: "failed",
 * failure_reason, total attempts count, and attempt timestamps. Content fields SHALL be null
 * (no inference).
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Feature: robust-queue-processing, Property 5: Failed Act Export Format', () => {
  const { FAILURE_REASONS, EXTRACTION_STATUS } = BDLawQueue;

  // Generator for failed extraction entries
  const failedEntryArb = fc.record({
    act_id: fc.string({ minLength: 1, maxLength: 50 }),
    act_number: fc.string({ minLength: 1, maxLength: 10 }),
    url: fc.webUrl(),
    title: fc.string({ minLength: 0, maxLength: 100 }),
    failure_reason: fc.constantFrom(
      FAILURE_REASONS.CONTAINER_NOT_FOUND,
      FAILURE_REASONS.CONTENT_EMPTY,
      FAILURE_REASONS.CONTENT_BELOW_THRESHOLD,
      FAILURE_REASONS.DOM_TIMEOUT,
      FAILURE_REASONS.NETWORK_ERROR
    ),
    retry_count: fc.integer({ min: 1, max: 5 }),
    max_retries: fc.integer({ min: 1, max: 5 }),
    failed_at: fc.date().map(d => d.toISOString()),
    attempts: fc.array(
      fc.record({
        attempt_number: fc.integer({ min: 1, max: 5 }),
        timestamp: fc.date().map(d => d.toISOString()),
        reason: fc.constantFrom(
          FAILURE_REASONS.DOM_TIMEOUT,
          FAILURE_REASONS.NETWORK_ERROR,
          FAILURE_REASONS.CONTENT_EMPTY
        ),
        outcome: fc.constant('failed')
      }),
      { minLength: 1, maxLength: 5 }
    )
  });

  test('should include extraction_status: "failed" in export', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Requirements: 6.1 - extraction_status must be "failed"
          expect(exported.extraction_status).toBe(EXTRACTION_STATUS.FAILED);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should include failure_reason in export', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Requirements: 6.2 - failure_reason must be included
          expect(exported.failure_reason).toBe(entry.failure_reason);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should include total attempts count in export', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Requirements: 6.3 - attempts count must be included
          expect(exported.attempts).toBe(entry.attempts.length);
          expect(exported._metadata.total_attempts).toBe(entry.attempts.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should include attempt timestamps in export', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Requirements: 6.4 - attempt timestamps must be included
          expect(exported.attempt_history).toEqual(entry.attempts);
          expect(exported._metadata.first_attempt_at).toBe(entry.attempts[0].timestamp);
          expect(exported._metadata.last_attempt_at).toBe(entry.failed_at);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should set content fields to null (no inference)', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Requirements: 6.6 - content fields must be null, never inferred
          expect(exported.content_raw).toBeNull();
          expect(exported.content_normalized).toBeNull();
          expect(exported.content_corrected).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should preserve act identification fields', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          expect(exported.act_number).toBe(entry.act_number);
          expect(exported.title).toBe(entry.title);
          expect(exported.url).toBe(entry.url);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should include max_retries_reached flag in metadata', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          const expectedMaxReached = entry.retry_count >= entry.max_retries;
          expect(exported._metadata.max_retries_reached).toBe(expectedMaxReached);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle null/undefined entry gracefully', () => {
    const nullExport = BDLawQueue.formatFailedActForExport(null);
    expect(nullExport.extraction_status).toBe(EXTRACTION_STATUS.FAILED);
    expect(nullExport.failure_reason).toBe(FAILURE_REASONS.UNKNOWN_ERROR);
    expect(nullExport.content_raw).toBeNull();
    expect(nullExport.attempts).toBe(0);
    
    const undefinedExport = BDLawQueue.formatFailedActForExport(undefined);
    expect(undefinedExport.extraction_status).toBe(EXTRACTION_STATUS.FAILED);
    expect(undefinedExport.content_raw).toBeNull();
  });

  test('should handle entry with empty attempts array', () => {
    const entry = {
      act_id: 'test_1',
      act_number: '123',
      url: 'http://test.com',
      title: 'Test Act',
      failure_reason: FAILURE_REASONS.NETWORK_ERROR,
      retry_count: 1,
      max_retries: 3,
      failed_at: new Date().toISOString(),
      attempts: []
    };
    
    const exported = BDLawQueue.formatFailedActForExport(entry);
    
    expect(exported.attempts).toBe(0);
    expect(exported.attempt_history).toEqual([]);
    expect(exported._metadata.first_attempt_at).toBeNull();
  });

  test('EXTRACTION_STATUS constants should be defined', () => {
    expect(EXTRACTION_STATUS.SUCCESS).toBe('success');
    expect(EXTRACTION_STATUS.FAILED).toBe('failed');
    expect(EXTRACTION_STATUS.PENDING).toBe('pending');
    expect(EXTRACTION_STATUS.PROCESSING).toBe('processing');
    expect(EXTRACTION_STATUS.RETRYING).toBe('retrying');
  });

  test('exported failed act should be distinguishable from successful act', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Failed acts have these distinguishing characteristics:
          // 1. extraction_status is "failed"
          expect(exported.extraction_status).toBe(EXTRACTION_STATUS.FAILED);
          
          // 2. failure_reason is present
          expect(exported.failure_reason).toBeDefined();
          expect(exported.failure_reason).not.toBe('');
          
          // 3. content fields are null
          expect(exported.content_raw).toBeNull();
          
          // 4. _metadata includes failure information
          expect(exported._metadata.extraction_status).toBe(EXTRACTION_STATUS.FAILED);
          expect(exported._metadata.failure_reason).toBe(entry.failure_reason);
        }
      ),
      { numRuns: 100 }
    );
  });
});
