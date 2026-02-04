/**
 * Property-Based Tests for Receipts Append-Only
 * 
 * Feature: durable-persistence-hardening, Property 4: Receipts Append-Only
 * Validates: Requirements 1.5
 * 
 * For any sequence of operations on the receipts log, the count of receipts SHALL only
 * increase or stay the same, never decrease. Additionally, for any receipt that exists
 * at time T, that same receipt (with identical fields) SHALL exist at all times T' > T.
 */

const fc = require('fast-check');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

const {
  StorageManager,
  StorageError,
  StorageErrorType,
  ExtractionReceipt,
  RECEIPT_SCHEMA_VERSION,
  STORAGE_BACKENDS
} = require('../../bdlaw-storage.js');

describe('Property 4: Receipts Append-Only', () => {
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

  // Generator for arrays of acts
  const actArrayGen = fc.array(actGen, { minLength: 1, maxLength: 10 });

  /**
   * Property: Receipt count only increases or stays the same
   * Requirements: 1.5
   */
  it('should only increase receipt count, never decrease', async () => {
    await fc.assert(
      fc.asyncProperty(
        actArrayGen,
        async (acts) => {
          let previousCount = 0;
          
          for (const act of acts) {
            // Generate and save a receipt
            const receipt = await StorageManager.generateReceipt(act);
            await StorageManager.saveReceipt(receipt);
            
            // Get current count
            const receipts = await StorageManager.getReceipts();
            const currentCount = receipts.length;
            
            // Count should only increase or stay the same
            if (currentCount < previousCount) {
              return false;
            }
            
            previousCount = currentCount;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Existing receipts persist after new receipts are added
   * Requirements: 1.5
   */
  it('should preserve existing receipts when adding new ones', async () => {
    await fc.assert(
      fc.asyncProperty(
        actArrayGen,
        async (acts) => {
          const savedReceipts = [];
          
          for (const act of acts) {
            // Generate and save a receipt
            const receipt = await StorageManager.generateReceipt(act);
            await StorageManager.saveReceipt(receipt);
            savedReceipts.push(receipt);
            
            // Verify all previously saved receipts still exist
            const currentReceipts = await StorageManager.getReceipts();
            
            for (const savedReceipt of savedReceipts) {
              const found = currentReceipts.find(r => r.receipt_id === savedReceipt.receipt_id);
              if (!found) {
                return false;
              }
              
              // Verify fields are identical
              if (found.act_id !== savedReceipt.act_id ||
                  found.content_raw_sha256 !== savedReceipt.content_raw_sha256 ||
                  found.storage_backend !== savedReceipt.storage_backend ||
                  found.persisted_at !== savedReceipt.persisted_at ||
                  found.schema_version !== savedReceipt.schema_version) {
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
   * Property: Receipt fields are immutable after save
   * Requirements: 1.5
   */
  it('should not allow modification of existing receipts', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate and save a receipt
          const receipt = await StorageManager.generateReceipt(act);
          await StorageManager.saveReceipt(receipt);
          
          // Get the receipt
          const receipts1 = await StorageManager.getReceipts();
          const savedReceipt = receipts1.find(r => r.receipt_id === receipt.receipt_id);
          
          if (!savedReceipt) return false;
          
          // Save more receipts (simulating more operations)
          const act2 = { ...act, act_number: act.act_number + '2' };
          const receipt2 = await StorageManager.generateReceipt(act2);
          await StorageManager.saveReceipt(receipt2);
          
          // Verify original receipt is unchanged
          const receipts2 = await StorageManager.getReceipts();
          const originalReceipt = receipts2.find(r => r.receipt_id === receipt.receipt_id);
          
          if (!originalReceipt) return false;
          
          // All fields should be identical
          return (
            originalReceipt.receipt_id === savedReceipt.receipt_id &&
            originalReceipt.act_id === savedReceipt.act_id &&
            originalReceipt.content_raw_sha256 === savedReceipt.content_raw_sha256 &&
            originalReceipt.storage_backend === savedReceipt.storage_backend &&
            originalReceipt.persisted_at === savedReceipt.persisted_at &&
            originalReceipt.schema_version === savedReceipt.schema_version
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Saving same receipt twice is idempotent (doesn't duplicate)
   * Requirements: 1.5
   */
  it('should handle duplicate receipt saves idempotently', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate a receipt
          const receipt = await StorageManager.generateReceipt(act);
          
          // Save it twice
          await StorageManager.saveReceipt(receipt);
          const countAfterFirst = (await StorageManager.getReceipts()).length;
          
          // Saving the same receipt again should not increase count
          // (IndexedDB add() will fail for duplicate key, which is expected)
          try {
            await StorageManager.saveReceipt(receipt);
          } catch (e) {
            // Expected - duplicate key error
          }
          
          const countAfterSecond = (await StorageManager.getReceipts()).length;
          
          // Count should not increase
          return countAfterSecond === countAfterFirst;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Final receipt count equals number of unique receipts saved
   * Requirements: 1.5
   */
  it('should have final count equal to unique receipts saved', async () => {
    await fc.assert(
      fc.asyncProperty(
        actArrayGen,
        async (acts) => {
          // Get initial count (should be 0 after beforeEach reset)
          const initialReceipts = await StorageManager.getReceipts();
          const initialCount = initialReceipts.length;
          
          const savedReceiptIds = new Set();
          
          for (const act of acts) {
            const receipt = await StorageManager.generateReceipt(act);
            await StorageManager.saveReceipt(receipt);
            savedReceiptIds.add(receipt.receipt_id);
          }
          
          const finalReceipts = await StorageManager.getReceipts();
          
          // Final count should equal initial count plus number of unique receipts saved
          return finalReceipts.length === initialCount + savedReceiptIds.size;
        }
      ),
      { numRuns: 100 }
    );
  });
});
