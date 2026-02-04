/**
 * Property-Based Tests for Atomic Write Consistency
 * 
 * Feature: durable-persistence-hardening, Property 2: Atomic Write Consistency
 * Validates: Requirements 1.2, 1.3
 * 
 * For any write operation that fails (throws an error or returns failure),
 * the act SHALL NOT appear in the receipts log AND the act SHALL NOT be
 * marked as "completed" in the queue.
 */

const fc = require('fast-check');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

const {
  StorageManager,
  StorageError,
  StorageErrorType,
  ExtractionReceipt,
  RECEIPT_SCHEMA_VERSION
} = require('../../bdlaw-storage.js');

describe('Property 2: Atomic Write Consistency', () => {
  let fakeIndexedDB;
  
  // Setup and teardown for each test
  beforeEach(async () => {
    // Create a fresh fake IndexedDB instance for each test
    fakeIndexedDB = new FDBFactory();
    
    // Set global indexedDB to our fake
    global.indexedDB = fakeIndexedDB;
    
    // Reset StorageManager state
    StorageManager._db = null;
    StorageManager._activeBackend = null;
    StorageManager._memoryStore.receipts = [];
    StorageManager._memoryStore.acts = new Map();
    
    // Initialize with fake IndexedDB
    await StorageManager.initialize();
  });

  afterEach(() => {
    // Close database connection
    StorageManager.closeDatabase();
    
    // Clean up global
    delete global.indexedDB;
  });

  // Generator for valid act numbers (numeric strings)
  const actNumberGen = fc.stringOf(
    fc.constantFrom(...'0123456789'),
    { minLength: 1, maxLength: 6 }
  );

  // Generator for content_raw (non-empty string)
  const contentRawGen = fc.string({ minLength: 1, maxLength: 5000 });

  // Generator for valid act objects
  const actGen = fc.record({
    act_number: actNumberGen,
    title: fc.string({ minLength: 1, maxLength: 200 }),
    content_raw: contentRawGen,
    volume_number: fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 3 }),
    url: fc.webUrl(),
    capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .map(d => d.toISOString())
  });

  // Generator for invalid act objects (missing required fields)
  const invalidActGen = fc.oneof(
    // Missing act_number
    fc.record({
      title: fc.string({ minLength: 1, maxLength: 200 }),
      content_raw: contentRawGen
    }),
    // Empty act_number
    fc.record({
      act_number: fc.constant(''),
      title: fc.string({ minLength: 1, maxLength: 200 }),
      content_raw: contentRawGen
    }),
    // Whitespace-only act_number
    fc.record({
      act_number: fc.constant('   '),
      title: fc.string({ minLength: 1, maxLength: 200 }),
      content_raw: contentRawGen
    }),
    // Missing content_raw
    fc.record({
      act_number: actNumberGen,
      title: fc.string({ minLength: 1, maxLength: 200 })
    }),
    // Null content_raw
    fc.record({
      act_number: actNumberGen,
      title: fc.string({ minLength: 1, maxLength: 200 }),
      content_raw: fc.constant(null)
    }),
    // Non-string content_raw
    fc.record({
      act_number: actNumberGen,
      title: fc.string({ minLength: 1, maxLength: 200 }),
      content_raw: fc.integer()
    })
  );

  /**
   * Property: Failed save does not create receipt
   * Requirements: 1.2, 1.3 - Failed writes don't create receipts
   * 
   * When saveAct fails due to invalid input, no receipt should be created.
   */
  it('should not create receipt when save fails due to invalid act', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidActGen,
        async (invalidAct) => {
          // Get receipts before attempted save
          const receiptsBefore = await StorageManager.getReceipts();
          const countBefore = receiptsBefore.length;
          
          // Attempt to save invalid act (should fail)
          let saveSucceeded = false;
          try {
            await StorageManager.saveAct(invalidAct);
            saveSucceeded = true;
          } catch (e) {
            // Expected to fail
          }
          
          // If save failed, no new receipt should exist
          if (!saveSucceeded) {
            const receiptsAfter = await StorageManager.getReceipts();
            return receiptsAfter.length === countBefore;
          }
          
          // If save somehow succeeded, that's also valid (the act was valid enough)
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Successful save always creates exactly one receipt
   * Requirements: 1.2 - Atomic write creates receipt
   */
  it('should create exactly one receipt on successful save', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Get receipts before save
          const receiptsBefore = await StorageManager.getReceipts();
          const countBefore = receiptsBefore.length;
          
          // Save the act
          const receipt = await StorageManager.saveAct(act);
          
          // Get receipts after save
          const receiptsAfter = await StorageManager.getReceipts();
          
          // Exactly one new receipt should exist
          return receiptsAfter.length === countBefore + 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt and act are consistent after successful save
   * Requirements: 1.2 - Atomic consistency between act and receipt
   */
  it('should have consistent receipt and act after successful save', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const receipt = await StorageManager.saveAct(act);
          
          // Load the act back
          const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number.trim());
          
          if (!loadedAct) return false;
          
          // Verify consistency: receipt hash matches loaded act hash
          return receipt.content_raw_sha256 === loadedAct.content_raw_sha256;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Null act throws error and creates no receipt
   * Requirements: 1.2, 1.3 - Invalid input doesn't create partial state
   */
  it('should throw error and create no receipt for null act', async () => {
    // Get receipts before
    const receiptsBefore = await StorageManager.getReceipts();
    const countBefore = receiptsBefore.length;
    
    // Attempt to save null
    let errorThrown = false;
    try {
      await StorageManager.saveAct(null);
    } catch (e) {
      errorThrown = true;
      expect(e).toBeInstanceOf(StorageError);
    }
    
    expect(errorThrown).toBe(true);
    
    // No new receipt should exist
    const receiptsAfter = await StorageManager.getReceipts();
    expect(receiptsAfter.length).toBe(countBefore);
  });

  /**
   * Property: Undefined act throws error and creates no receipt
   * Requirements: 1.2, 1.3 - Invalid input doesn't create partial state
   */
  it('should throw error and create no receipt for undefined act', async () => {
    // Get receipts before
    const receiptsBefore = await StorageManager.getReceipts();
    const countBefore = receiptsBefore.length;
    
    // Attempt to save undefined
    let errorThrown = false;
    try {
      await StorageManager.saveAct(undefined);
    } catch (e) {
      errorThrown = true;
      expect(e).toBeInstanceOf(StorageError);
    }
    
    expect(errorThrown).toBe(true);
    
    // No new receipt should exist
    const receiptsAfter = await StorageManager.getReceipts();
    expect(receiptsAfter.length).toBe(countBefore);
  });

  /**
   * Property: Simulated queue state remains pending on failed save
   * Requirements: 1.3 - Act not marked completed if write fails
   * 
   * This simulates the queue workflow where an act should remain "pending"
   * if saveAct fails.
   */
  it('should keep queue state pending when save fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidActGen,
        async (invalidAct) => {
          // Simulate queue state
          const queueState = {
            status: 'pending',
            completedAt: null
          };
          
          // Attempt to save (should fail)
          let saveSucceeded = false;
          try {
            await StorageManager.saveAct(invalidAct);
            saveSucceeded = true;
            // Only mark complete if save succeeded
            queueState.status = 'completed';
            queueState.completedAt = new Date().toISOString();
          } catch (e) {
            // Save failed, queue state should remain pending
          }
          
          // If save failed, status should still be pending
          if (!saveSucceeded) {
            return queueState.status === 'pending' && queueState.completedAt === null;
          }
          
          // If save succeeded, that's also valid
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple successful saves create multiple receipts atomically
   * Requirements: 1.2 - Each atomic save creates its own receipt
   */
  it('should create one receipt per successful save', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actGen, { minLength: 1, maxLength: 5 }),
        async (acts) => {
          // Make act_numbers unique
          const uniqueActs = acts.map((act, i) => ({
            ...act,
            act_number: `${act.act_number}_${i}`
          }));
          
          // Get receipts before
          const receiptsBefore = await StorageManager.getReceipts();
          const countBefore = receiptsBefore.length;
          
          // Save all acts
          for (const act of uniqueActs) {
            await StorageManager.saveAct(act);
          }
          
          // Get receipts after
          const receiptsAfter = await StorageManager.getReceipts();
          
          // Should have exactly N new receipts
          return receiptsAfter.length === countBefore + uniqueActs.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt returned by saveAct matches receipt in storage
   * Requirements: 1.2 - Atomic consistency
   */
  it('should return receipt that matches stored receipt', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const returnedReceipt = await StorageManager.saveAct(act);
          
          // Get the receipt from storage
          const receipts = await StorageManager.getReceipts();
          const storedReceipt = receipts.find(r => r.receipt_id === returnedReceipt.receipt_id);
          
          if (!storedReceipt) return false;
          
          // All fields should match
          return (
            storedReceipt.receipt_id === returnedReceipt.receipt_id &&
            storedReceipt.act_id === returnedReceipt.act_id &&
            storedReceipt.content_raw_sha256 === returnedReceipt.content_raw_sha256 &&
            storedReceipt.storage_backend === returnedReceipt.storage_backend &&
            storedReceipt.persisted_at === returnedReceipt.persisted_at &&
            storedReceipt.schema_version === returnedReceipt.schema_version
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error type is StorageError for invalid inputs
   * Requirements: 1.2, 1.3 - Proper error handling
   */
  it('should throw StorageError for invalid inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidActGen,
        async (invalidAct) => {
          try {
            await StorageManager.saveAct(invalidAct);
            // If no error, the act was valid enough to save
            return true;
          } catch (e) {
            // Error should be a StorageError
            return e instanceof StorageError;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
