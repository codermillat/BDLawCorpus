/**
 * Property-Based Tests for Queue Reconstruction Correctness
 * 
 * Feature: durable-persistence-hardening, Property 10: Queue Reconstruction Correctness
 * Validates: Requirements 4.1, 4.3, 4.4, 4.5, 4.6
 * 
 * For any set of queue items Q and extraction receipts R:
 * - The reconstructed pending count SHALL equal |Q| - |{q ∈ Q : q.actNumber ∈ R.act_ids}|
 * - For any item marked "completed" in Q but not in R.act_ids, the reconstructor SHALL 
 *   flag it as a discrepancy and reset it to "pending"
 */

const fc = require('fast-check');

const {
  QueueReconstructor
} = require('../../bdlaw-storage.js');

describe('Property 10: Queue Reconstruction Correctness', () => {
  // Generator for valid act numbers (numeric strings)
  const actNumberGen = fc.stringOf(
    fc.constantFrom(...'0123456789'),
    { minLength: 1, maxLength: 6 }
  );

  // Generator for queue item status
  const statusGen = fc.constantFrom('pending', 'processing', 'completed', 'done');

  // Generator for a single queue item
  const queueItemGen = fc.record({
    id: fc.uuid(),
    actNumber: actNumberGen,
    title: fc.string({ minLength: 1, maxLength: 100 }),
    url: fc.webUrl(),
    status: statusGen,
    addedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .map(d => d.toISOString())
  });

  // Generator for a single receipt
  const receiptGen = fc.record({
    receipt_id: fc.uuid(),
    act_id: actNumberGen,
    content_raw_sha256: fc.hexaString({ minLength: 64, maxLength: 64 }),
    storage_backend: fc.constantFrom('indexeddb', 'chrome_storage', 'memory'),
    persisted_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .map(d => d.toISOString()),
    schema_version: fc.constant('3.1')
  });

  // Generator for array of queue items with unique actNumbers
  const queueItemsGen = fc.array(queueItemGen, { minLength: 0, maxLength: 50 })
    .map(items => {
      // Ensure unique actNumbers
      const seen = new Set();
      return items.filter(item => {
        if (seen.has(item.actNumber)) return false;
        seen.add(item.actNumber);
        return true;
      });
    });

  // Generator for array of receipts with unique act_ids
  const receiptsGen = fc.array(receiptGen, { minLength: 0, maxLength: 50 })
    .map(receipts => {
      // Ensure unique act_ids
      const seen = new Set();
      return receipts.filter(r => {
        if (seen.has(r.act_id)) return false;
        seen.add(r.act_id);
        return true;
      });
    });

  /**
   * Property: Pending count equals total queued minus extracted
   * Requirements: 4.1 - Derive pending count as total_queued_act_ids MINUS extracted_act_ids
   */
  it('should derive pending count as total queued minus extracted', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        receiptsGen,
        (queueItems, receipts) => {
          const result = QueueReconstructor.reconstructState(queueItems, receipts);
          
          // Build set of extracted act IDs
          const extractedActIds = new Set(receipts.map(r => r.act_id));
          
          // Calculate expected pending count
          const expectedPendingCount = queueItems.filter(
            item => !extractedActIds.has(item.actNumber)
          ).length;
          
          // Verify pending count matches
          return result.pending.length === expectedPendingCount &&
                 result.stats.pendingCount === expectedPendingCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Completed list contains exactly the extracted act IDs
   * Requirements: 4.4 - Maintain extracted_act_ids as authoritative record
   */
  it('should return completed list matching extracted act IDs from receipts', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        receiptsGen,
        (queueItems, receipts) => {
          const result = QueueReconstructor.reconstructState(queueItems, receipts);
          
          // Build set of extracted act IDs from receipts
          const extractedActIds = new Set(receipts.map(r => r.act_id));
          const completedSet = new Set(result.completed);
          
          // Verify completed list matches extracted act IDs
          if (completedSet.size !== extractedActIds.size) return false;
          
          for (const actId of extractedActIds) {
            if (!completedSet.has(actId)) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Items marked completed without receipt are flagged as discrepancies
   * Requirements: 4.5, 4.6 - Trust receipts over queue state, log discrepancies
   */
  it('should flag items marked completed without receipt as discrepancies', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        receiptsGen,
        (queueItems, receipts) => {
          const result = QueueReconstructor.reconstructState(queueItems, receipts);
          
          // Build set of extracted act IDs
          const extractedActIds = new Set(receipts.map(r => r.act_id));
          
          // Find items marked completed/done but without receipt
          const expectedDiscrepancies = queueItems.filter(item => {
            const isMarkedComplete = item.status === 'completed' || item.status === 'done';
            const hasNoReceipt = !extractedActIds.has(item.actNumber);
            return isMarkedComplete && hasNoReceipt;
          });
          
          // Verify discrepancy count matches
          if (result.discrepancies.length !== expectedDiscrepancies.length) return false;
          
          // Verify each expected discrepancy is in the result
          const discrepancyActNumbers = new Set(result.discrepancies.map(d => d.actNumber));
          for (const item of expectedDiscrepancies) {
            if (!discrepancyActNumbers.has(item.actNumber)) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Discrepancies have correct issue and resolution
   * Requirements: 4.5, 4.6 - Discrepancies should indicate reset to pending
   */
  it('should set discrepancy issue to marked_complete_no_receipt and resolution to reset_to_pending', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        receiptsGen,
        (queueItems, receipts) => {
          const result = QueueReconstructor.reconstructState(queueItems, receipts);
          
          // All discrepancies should have correct issue and resolution
          for (const discrepancy of result.discrepancies) {
            if (discrepancy.issue !== 'marked_complete_no_receipt') return false;
            if (discrepancy.resolution !== 'reset_to_pending') return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pending items are not in extracted set
   * Requirements: 4.1 - Pending = total minus extracted
   */
  it('should only include items not in receipts as pending', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        receiptsGen,
        (queueItems, receipts) => {
          const result = QueueReconstructor.reconstructState(queueItems, receipts);
          
          // Build set of extracted act IDs
          const extractedActIds = new Set(receipts.map(r => r.act_id));
          
          // Verify no pending item is in extracted set
          for (const pendingItem of result.pending) {
            if (extractedActIds.has(pendingItem.actNumber)) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Stats are consistent with results
   * Requirements: 4.1, 4.4 - Stats should accurately reflect reconstruction
   */
  it('should return consistent stats', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        receiptsGen,
        (queueItems, receipts) => {
          const result = QueueReconstructor.reconstructState(queueItems, receipts);
          
          // Verify stats consistency
          if (result.stats.totalQueued !== queueItems.length) return false;
          if (result.stats.totalExtracted !== result.completed.length) return false;
          if (result.stats.pendingCount !== result.pending.length) return false;
          if (result.stats.discrepancyCount !== result.discrepancies.length) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty inputs produce empty results
   * Requirements: 4.1, 4.3 - Handle edge cases gracefully
   */
  it('should handle empty inputs gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom([], null, undefined),
        fc.constantFrom([], null, undefined),
        (queueItems, receipts) => {
          const result = QueueReconstructor.reconstructState(queueItems, receipts);
          
          // Should return valid structure with empty arrays
          return Array.isArray(result.pending) &&
                 Array.isArray(result.completed) &&
                 Array.isArray(result.discrepancies) &&
                 result.stats.totalQueued === 0 &&
                 result.stats.totalExtracted === 0 &&
                 result.stats.pendingCount === 0 &&
                 result.stats.discrepancyCount === 0;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Receipts for items not in queue are still counted as extracted
   * Requirements: 4.4 - extracted_act_ids is authoritative regardless of queue
   */
  it('should count receipts for items not in queue as extracted', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        receiptsGen,
        (queueItems, receipts) => {
          const result = QueueReconstructor.reconstructState(queueItems, receipts);
          
          // Build set of unique receipt act_ids
          const uniqueReceiptActIds = new Set(receipts.map(r => r.act_id));
          
          // totalExtracted should equal unique receipt count
          return result.stats.totalExtracted === uniqueReceiptActIds.size;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Reconstruction is deterministic
   * Requirements: 4.3 - Same inputs should produce same outputs
   */
  it('should produce deterministic results for same inputs', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        receiptsGen,
        (queueItems, receipts) => {
          const result1 = QueueReconstructor.reconstructState(queueItems, receipts);
          const result2 = QueueReconstructor.reconstructState(queueItems, receipts);
          
          // Results should be identical
          if (result1.pending.length !== result2.pending.length) return false;
          if (result1.completed.length !== result2.completed.length) return false;
          if (result1.discrepancies.length !== result2.discrepancies.length) return false;
          
          // Stats should match
          if (result1.stats.totalQueued !== result2.stats.totalQueued) return false;
          if (result1.stats.totalExtracted !== result2.stats.totalExtracted) return false;
          if (result1.stats.pendingCount !== result2.stats.pendingCount) return false;
          if (result1.stats.discrepancyCount !== result2.stats.discrepancyCount) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
