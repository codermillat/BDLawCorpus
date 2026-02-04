/**
 * Property-Based Tests for Processing Status Reset on Reload
 * 
 * Feature: durable-persistence-hardening, Property 11: Processing Status Reset on Reload
 * Validates: Requirements 5.6
 * 
 * For any queue state loaded from storage, there SHALL be zero items with 
 * status === 'processing'. All such items SHALL have been reset to status === 'pending'.
 */

const fc = require('fast-check');

const {
  QueueReconstructor
} = require('../../bdlaw-storage.js');

describe('Property 11: Processing Status Reset on Reload', () => {
  // Generator for valid act numbers (numeric strings)
  const actNumberGen = fc.stringOf(
    fc.constantFrom(...'0123456789'),
    { minLength: 1, maxLength: 6 }
  );

  // Generator for queue item status (including 'processing')
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

  // Generator for queue items that always have at least one 'processing' item
  const queueWithProcessingGen = fc.tuple(
    queueItemsGen,
    fc.integer({ min: 1, max: 10 })
  ).map(([items, processingCount]) => {
    // Ensure we have at least processingCount items with 'processing' status
    const result = [...items];
    let added = 0;
    
    // First, set some existing items to 'processing'
    for (let i = 0; i < result.length && added < processingCount; i++) {
      if (result[i].status !== 'processing') {
        result[i] = { ...result[i], status: 'processing' };
        added++;
      }
    }
    
    // If we still need more, add new items
    while (added < processingCount) {
      const newActNumber = String(Math.floor(Math.random() * 1000000));
      if (!result.some(item => item.actNumber === newActNumber)) {
        result.push({
          id: `${Date.now()}_${newActNumber}`,
          actNumber: newActNumber,
          title: `Test Act ${newActNumber}`,
          url: `https://example.com/act/${newActNumber}`,
          status: 'processing',
          addedAt: new Date().toISOString()
        });
        added++;
      }
    }
    
    return result;
  });

  /**
   * Property: No items with 'processing' status after reset
   * Requirements: 5.6 - Reset 'processing' items to 'pending' on reload
   */
  it('should have zero items with processing status after reset', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        (queueItems) => {
          const result = QueueReconstructor.resetProcessingStatus(queueItems);
          
          // Verify no items have 'processing' status
          const processingItems = result.items.filter(item => item.status === 'processing');
          return processingItems.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All 'processing' items are reset to 'pending'
   * Requirements: 5.6 - Reset 'processing' items to 'pending' on reload
   */
  it('should reset all processing items to pending status', () => {
    fc.assert(
      fc.property(
        queueWithProcessingGen,
        (queueItems) => {
          // Count original processing items
          const originalProcessingCount = queueItems.filter(
            item => item.status === 'processing'
          ).length;
          
          const result = QueueReconstructor.resetProcessingStatus(queueItems);
          
          // Verify reset count matches original processing count
          return result.resetCount === originalProcessingCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-processing items retain their original status
   * Requirements: 5.6 - Only reset 'processing' items
   */
  it('should not change status of non-processing items', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        (queueItems) => {
          const result = QueueReconstructor.resetProcessingStatus(queueItems);
          
          // For each original item that was not 'processing', verify status unchanged
          for (let i = 0; i < queueItems.length; i++) {
            const original = queueItems[i];
            const processed = result.items[i];
            
            if (original.status !== 'processing') {
              if (processed.status !== original.status) {
                return false;
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Reset items are tracked in resetItems array
   * Requirements: 5.6 - Log reset actions
   */
  it('should track all reset items in resetItems array', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        (queueItems) => {
          const result = QueueReconstructor.resetProcessingStatus(queueItems);
          
          // Count original processing items
          const originalProcessingActNumbers = queueItems
            .filter(item => item.status === 'processing')
            .map(item => item.actNumber);
          
          // Verify resetItems contains all originally processing items
          const resetActNumbers = result.resetItems.map(r => r.actNumber);
          
          if (resetActNumbers.length !== originalProcessingActNumbers.length) {
            return false;
          }
          
          for (const actNumber of originalProcessingActNumbers) {
            if (!resetActNumbers.includes(actNumber)) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Reset items have correct metadata
   * Requirements: 5.6 - Log reset actions with proper metadata
   */
  it('should set correct metadata on reset items', () => {
    fc.assert(
      fc.property(
        queueWithProcessingGen,
        (queueItems) => {
          const result = QueueReconstructor.resetProcessingStatus(queueItems);
          
          // Verify each reset item has correct metadata
          for (const resetInfo of result.resetItems) {
            if (resetInfo.previousStatus !== 'processing') return false;
            if (resetInfo.newStatus !== 'pending') return false;
            if (!resetInfo.resetAt) return false;
            if (!resetInfo.actNumber) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Items array length is preserved
   * Requirements: 5.6 - Reset should not add or remove items
   */
  it('should preserve items array length', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        (queueItems) => {
          const result = QueueReconstructor.resetProcessingStatus(queueItems);
          
          return result.items.length === queueItems.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Reset items have _resetFromProcessing flag
   * Requirements: 5.6 - Mark reset items for debugging
   */
  it('should mark reset items with _resetFromProcessing flag', () => {
    fc.assert(
      fc.property(
        queueWithProcessingGen,
        (queueItems) => {
          const result = QueueReconstructor.resetProcessingStatus(queueItems);
          
          // Find items that were originally 'processing'
          const originalProcessingActNumbers = new Set(
            queueItems
              .filter(item => item.status === 'processing')
              .map(item => item.actNumber)
          );
          
          // Verify reset items have the flag
          for (const item of result.items) {
            if (originalProcessingActNumbers.has(item.actNumber)) {
              if (!item._resetFromProcessing) return false;
              if (!item._resetAt) return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty input produces empty result
   * Requirements: 5.6 - Handle edge cases gracefully
   */
  it('should handle empty inputs gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom([], null, undefined),
        (queueItems) => {
          const result = QueueReconstructor.resetProcessingStatus(queueItems);
          
          return Array.isArray(result.items) &&
                 result.items.length === 0 &&
                 result.resetCount === 0 &&
                 Array.isArray(result.resetItems) &&
                 result.resetItems.length === 0;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Idempotent - running reset twice produces same result
   * Requirements: 5.6 - Reset should be idempotent
   */
  it('should be idempotent - running reset twice produces same result', () => {
    fc.assert(
      fc.property(
        queueItemsGen,
        (queueItems) => {
          const result1 = QueueReconstructor.resetProcessingStatus(queueItems);
          const result2 = QueueReconstructor.resetProcessingStatus(result1.items);
          
          // Second run should have no resets (all already pending)
          if (result2.resetCount !== 0) return false;
          
          // Items should be identical (except for _resetAt timestamps)
          if (result1.items.length !== result2.items.length) return false;
          
          for (let i = 0; i < result1.items.length; i++) {
            if (result1.items[i].status !== result2.items[i].status) return false;
            if (result1.items[i].actNumber !== result2.items[i].actNumber) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: fullReconstruction resets processing items before reconstruction
   * Requirements: 5.6 - Full reconstruction includes processing reset
   */
  it('should reset processing items in fullReconstruction', () => {
    // Generator for receipts
    const receiptGen = fc.record({
      receipt_id: fc.uuid(),
      act_id: actNumberGen,
      content_raw_sha256: fc.hexaString({ minLength: 64, maxLength: 64 }),
      storage_backend: fc.constantFrom('indexeddb', 'chrome_storage', 'memory'),
      persisted_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
        .map(d => d.toISOString()),
      schema_version: fc.constant('3.1')
    });

    const receiptsGen = fc.array(receiptGen, { minLength: 0, maxLength: 20 });

    fc.assert(
      fc.property(
        queueWithProcessingGen,
        receiptsGen,
        (queueItems, receipts) => {
          const result = QueueReconstructor.fullReconstruction(queueItems, receipts);
          
          // Verify no pending items have 'processing' status
          const processingInPending = result.pending.filter(
            item => item.status === 'processing'
          );
          
          // Verify resetCount is tracked in stats
          const originalProcessingCount = queueItems.filter(
            item => item.status === 'processing'
          ).length;
          
          return processingInPending.length === 0 &&
                 result.stats.resetCount === originalProcessingCount;
        }
      ),
      { numRuns: 100 }
    );
  });
});
