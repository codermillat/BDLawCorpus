/**
 * Property Test: Research Integrity Preservation
 * Feature: robust-queue-processing
 * Property 8: Research Integrity Preservation
 * 
 * For any extraction (successful or failed), the system SHALL use element.textContent
 * exclusively. Failed extractions SHALL NOT have inferred or auto-corrected content.
 * 
 * Validates: Requirements 9.4, 9.5, 6.6
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Feature: robust-queue-processing, Property 8: Research Integrity Preservation', () => {
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

  test('failed acts SHALL have null content_raw (no inference)', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Requirements: 9.5, 6.6 - No content inference for failures
          expect(exported.content_raw).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('failed acts SHALL have null content_normalized (no inference)', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Requirements: 9.5, 6.6 - No content inference for failures
          expect(exported.content_normalized).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('failed acts SHALL have null content_corrected (no auto-correction)', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Requirements: 9.5, 6.6 - No auto-correction for failures
          expect(exported.content_corrected).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('failed acts SHALL NOT have any inferred content fields', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // All content fields must be null
          expect(exported.content_raw).toBeNull();
          expect(exported.content_normalized).toBeNull();
          expect(exported.content_corrected).toBeNull();
          
          // Should not have any other content-like fields
          expect(exported.content).toBeUndefined();
          expect(exported.text).toBeUndefined();
          expect(exported.body).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('extraction validation SHALL NOT modify or infer content', () => {
    fc.assert(
      fc.property(
        fc.record({
          success: fc.boolean(),
          content: fc.option(fc.string(), { nil: undefined }),
          content_raw: fc.option(fc.string(), { nil: undefined }),
          error: fc.option(fc.string(), { nil: undefined })
        }),
        (result) => {
          const validation = BDLawQueue.validateExtraction(result);
          
          // Validation should only return valid/invalid status and reason
          // It should NOT modify the result or add inferred content
          expect(validation).toHaveProperty('valid');
          expect(typeof validation.valid).toBe('boolean');
          
          if (!validation.valid) {
            expect(validation).toHaveProperty('reason');
            expect(typeof validation.reason).toBe('string');
          }
          
          // Validation result should not contain content
          expect(validation.content).toBeUndefined();
          expect(validation.content_raw).toBeUndefined();
          expect(validation.inferred_content).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('addFailedExtraction SHALL NOT add any content to failed entry', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          actNumber: fc.string({ minLength: 1, maxLength: 10 }),
          url: fc.webUrl(),
          title: fc.string({ minLength: 0, maxLength: 100 })
        }),
        fc.constantFrom(...Object.values(FAILURE_REASONS)),
        (item, reason) => {
          const result = BDLawQueue.addFailedExtraction([], item, reason, 1, 3);
          const entry = result[0];
          
          // Failed entry should not have any content fields
          expect(entry.content).toBeUndefined();
          expect(entry.content_raw).toBeUndefined();
          expect(entry.content_normalized).toBeUndefined();
          expect(entry.content_corrected).toBeUndefined();
          
          // Should only have tracking metadata
          expect(entry.act_id).toBe(item.id);
          expect(entry.failure_reason).toBe(reason);
          expect(entry.retry_count).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('failed extraction tracking SHALL preserve original failure reason without modification', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          actNumber: fc.string({ minLength: 1, maxLength: 10 }),
          url: fc.webUrl(),
          title: fc.string({ minLength: 0, maxLength: 100 })
        }),
        fc.constantFrom(...Object.values(FAILURE_REASONS)),
        (item, reason) => {
          const result = BDLawQueue.addFailedExtraction([], item, reason, 1, 3);
          const entry = result[0];
          
          // Failure reason should be preserved exactly as provided
          expect(entry.failure_reason).toBe(reason);
          expect(entry.attempts[0].reason).toBe(reason);
          
          // Should not have any "corrected" or "inferred" reason
          expect(entry.corrected_reason).toBeUndefined();
          expect(entry.inferred_reason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('exported failed act SHALL clearly indicate failed status', () => {
    fc.assert(
      fc.property(
        failedEntryArb,
        (entry) => {
          const exported = BDLawQueue.formatFailedActForExport(entry);
          
          // Must be clearly marked as failed
          expect(exported.extraction_status).toBe(EXTRACTION_STATUS.FAILED);
          expect(exported._metadata.extraction_status).toBe(EXTRACTION_STATUS.FAILED);
          
          // Must include failure reason
          expect(exported.failure_reason).toBeDefined();
          expect(exported._metadata.failure_reason).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('FAILURE_REASONS constants SHALL be immutable string values', () => {
    // Verify all failure reasons are defined and are strings
    const reasons = Object.values(FAILURE_REASONS);
    
    expect(reasons.length).toBeGreaterThan(0);
    
    for (const reason of reasons) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
    }
    
    // Verify specific required reasons exist
    expect(FAILURE_REASONS.CONTAINER_NOT_FOUND).toBeDefined();
    expect(FAILURE_REASONS.CONTENT_EMPTY).toBeDefined();
    expect(FAILURE_REASONS.CONTENT_BELOW_THRESHOLD).toBeDefined();
    expect(FAILURE_REASONS.DOM_TIMEOUT).toBeDefined();
    expect(FAILURE_REASONS.NETWORK_ERROR).toBeDefined();
  });

  test('EXTRACTION_STATUS constants SHALL be immutable string values', () => {
    // Verify all statuses are defined and are strings
    const statuses = Object.values(EXTRACTION_STATUS);
    
    expect(statuses.length).toBeGreaterThan(0);
    
    for (const status of statuses) {
      expect(typeof status).toBe('string');
      expect(status.length).toBeGreaterThan(0);
    }
    
    // Verify specific required statuses exist
    expect(EXTRACTION_STATUS.SUCCESS).toBeDefined();
    expect(EXTRACTION_STATUS.FAILED).toBeDefined();
    expect(EXTRACTION_STATUS.PENDING).toBeDefined();
  });
});
