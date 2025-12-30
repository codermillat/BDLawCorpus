/**
 * Property-Based Tests for Queue Deduplication
 * 
 * Feature: bdlawcorpus-mode, Property 20: Queue Deduplication Uniqueness
 * Validates: Requirements 27.1, 27.2, 27.4
 * 
 * Property: For any queue containing acts, adding an act with an existing 
 * act_number SHALL be rejected, and the queue SHALL contain only unique act_numbers
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Property 20: Queue Deduplication Uniqueness', () => {
  
  // Generator for valid act numbers (numeric strings)
  const actNumberArb = fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), {
    minLength: 1,
    maxLength: 6
  });

  // Generator for act objects
  const actArb = fc.record({
    actNumber: actNumberArb,
    title: fc.string({ minLength: 1, maxLength: 100 }),
    url: fc.constant('http://bdlaws.minlaw.gov.bd/act-details-').chain(prefix => 
      actNumberArb.map(num => `${prefix}${num}.html`)
    ),
    year: fc.option(fc.stringOf(fc.constantFrom('০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'), {
      minLength: 4,
      maxLength: 4
    }), { nil: undefined })
  });

  // Generator for queue items
  const queueItemArb = fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }),
    actNumber: actNumberArb,
    title: fc.string({ minLength: 1, maxLength: 100 }),
    url: fc.webUrl(),
    status: fc.constantFrom('pending', 'processing', 'completed', 'error'),
    addedAt: fc.date().map(d => d.toISOString())
  });

  // Generator for queue arrays with unique act numbers
  const uniqueQueueArb = fc.array(queueItemArb, { minLength: 0, maxLength: 20 })
    .map(items => {
      const seen = new Set();
      return items.filter(item => {
        if (seen.has(item.actNumber)) return false;
        seen.add(item.actNumber);
        return true;
      });
    });

  /**
   * Property: Duplicate act_numbers in queue are rejected
   * Requirements: 27.1, 27.2
   */
  it('should reject duplicate act_numbers when adding to queue', () => {
    fc.assert(
      fc.property(
        uniqueQueueArb,
        actNumberArb,
        (queue, actNumber) => {
          // Add an act to the queue first
          const actToAdd = {
            actNumber: actNumber,
            title: 'Test Act',
            url: `http://bdlaws.minlaw.gov.bd/act-details-${actNumber}.html`
          };
          
          // First addition should succeed if not already in queue
          const firstResult = BDLawQueue.addSingleActToQueue(actToAdd, queue, []);
          
          if (BDLawQueue.isDuplicateInQueue(actNumber, queue)) {
            // If already in queue, should be rejected
            return firstResult.success === false && 
                   firstResult.reason === 'duplicate_in_queue';
          } else {
            // If not in queue, should succeed
            if (!firstResult.success) return false;
            
            // Now try to add the same act again - should be rejected
            const newQueue = [...queue, firstResult.item];
            const secondResult = BDLawQueue.addSingleActToQueue(actToAdd, newQueue, []);
            
            return secondResult.success === false && 
                   secondResult.reason === 'duplicate_in_queue';
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Unique act_numbers are accepted
   * Requirements: 27.1
   */
  it('should accept unique act_numbers when adding to queue', () => {
    fc.assert(
      fc.property(
        uniqueQueueArb,
        actNumberArb,
        (queue, actNumber) => {
          // Skip if the act number already exists in queue
          if (BDLawQueue.isDuplicateInQueue(actNumber, queue)) {
            return true; // Skip this case
          }
          
          const actToAdd = {
            actNumber: actNumber,
            title: 'Test Act',
            url: `http://bdlaws.minlaw.gov.bd/act-details-${actNumber}.html`
          };
          
          const result = BDLawQueue.addSingleActToQueue(actToAdd, queue, []);
          
          return result.success === true && 
                 result.item.actNumber === actNumber;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Queue always contains only unique act_numbers after operations
   * Requirements: 27.4
   */
  it('should maintain unique act_numbers in queue after adding acts', () => {
    fc.assert(
      fc.property(
        fc.array(actArb, { minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (acts, volumeNumber) => {
          const result = BDLawQueue.addActsToQueue(acts, [], [], volumeNumber);
          
          // The resulting queue should have only unique act numbers
          return BDLawQueue.hasOnlyUniqueActNumbers(result.newQueue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Skipped count is accurate when adding from volume
   * Requirements: 27.5
   */
  it('should accurately count skipped duplicates when adding from volume', () => {
    fc.assert(
      fc.property(
        fc.array(actArb, { minLength: 1, maxLength: 20 }),
        uniqueQueueArb,
        fc.string({ minLength: 1, maxLength: 5 }),
        (acts, existingQueue, volumeNumber) => {
          const result = BDLawQueue.addActsToQueue(acts, existingQueue, [], volumeNumber);
          
          // Total should equal: added + skippedInQueue + skippedCaptured
          const totalProcessed = result.added + result.skippedInQueue + result.skippedCaptured;
          
          // Total processed should equal input acts length
          if (totalProcessed !== acts.length) return false;
          
          // Skipped in queue should match acts that were already in existing queue
          const expectedSkippedInQueue = acts.filter(act => 
            BDLawQueue.isDuplicateInQueue(act.actNumber, existingQueue)
          ).length;
          
          // Note: Due to duplicates within the acts array itself, skippedInQueue 
          // may be higher than expectedSkippedInQueue
          return result.skippedInQueue >= expectedSkippedInQueue;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isDuplicateInQueue returns true only for existing act_numbers
   * Requirements: 27.1, 27.4
   */
  it('should correctly identify duplicates in queue', () => {
    fc.assert(
      fc.property(
        uniqueQueueArb,
        actNumberArb,
        (queue, actNumber) => {
          const isDuplicate = BDLawQueue.isDuplicateInQueue(actNumber, queue);
          const existsInQueue = queue.some(q => q.actNumber === actNumber);
          
          return isDuplicate === existsInQueue;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Already captured acts are rejected
   * Requirements: 27.1
   */
  it('should reject acts that are already captured', () => {
    fc.assert(
      fc.property(
        actNumberArb,
        (actNumber) => {
          const capturedActs = [{ actNumber: actNumber }];
          
          const actToAdd = {
            actNumber: actNumber,
            title: 'Test Act',
            url: `http://bdlaws.minlaw.gov.bd/act-details-${actNumber}.html`
          };
          
          const result = BDLawQueue.addSingleActToQueue(actToAdd, [], capturedActs);
          
          return result.success === false && 
                 result.reason === 'already_captured';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or invalid inputs are handled gracefully
   */
  it('should handle invalid inputs gracefully', () => {
    // Null/undefined act number
    expect(BDLawQueue.isDuplicateInQueue(null, [])).toBe(false);
    expect(BDLawQueue.isDuplicateInQueue(undefined, [])).toBe(false);
    expect(BDLawQueue.isDuplicateInQueue('', [])).toBe(false);
    
    // Null/undefined queue
    expect(BDLawQueue.isDuplicateInQueue('123', null)).toBe(false);
    expect(BDLawQueue.isDuplicateInQueue('123', undefined)).toBe(false);
    
    // Invalid act for addSingleActToQueue
    const result = BDLawQueue.addSingleActToQueue(null, [], []);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_act');
  });
});
