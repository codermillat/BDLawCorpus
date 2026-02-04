/**
 * Property-Based Tests for Persist-Before-Done Invariant
 * 
 * Feature: durable-persistence-hardening, Property 1: Persist-Before-Done Invariant
 * Validates: Requirements 1.1, 1.3
 * 
 * For any act marked as "completed" in the queue, there SHALL exist a corresponding
 * extraction_receipt with a `persisted_at` timestamp that is earlier than or equal
 * to the time the act was marked complete.
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

describe('Property 1: Persist-Before-Done Invariant', () => {
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

  /**
   * Property: saveAct returns a receipt before the function completes
   * Requirements: 1.1 - Persist before marking as done
   * 
   * This tests that when saveAct completes successfully, a receipt already exists.
   * The receipt's persisted_at timestamp must be <= the time saveAct returns.
   */
  it('should have receipt persisted_at timestamp before or at completion time', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Record time before save
          const beforeSave = new Date();
          
          // Save the act
          const receipt = await StorageManager.saveAct(act);
          
          // Record time after save
          const afterSave = new Date();
          
          // Parse the persisted_at timestamp
          const persistedAt = new Date(receipt.persisted_at);
          
          // The persisted_at timestamp should be between beforeSave and afterSave
          // (allowing for some clock tolerance)
          return persistedAt >= new Date(beforeSave.getTime() - 1000) &&
                 persistedAt <= new Date(afterSave.getTime() + 1000);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt exists in storage when saveAct returns
   * Requirements: 1.1, 1.3 - Receipt must exist before marking complete
   * 
   * When saveAct returns successfully, the receipt must already be persisted
   * and retrievable from storage.
   */
  it('should have receipt in storage when saveAct returns', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const receipt = await StorageManager.saveAct(act);
          
          // Immediately check that receipt exists in storage
          const receipts = await StorageManager.getReceipts();
          const foundReceipt = receipts.find(r => r.receipt_id === receipt.receipt_id);
          
          // Receipt must exist
          return foundReceipt !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt act_id matches the saved act
   * Requirements: 1.1 - Receipt corresponds to the persisted act
   */
  it('should have receipt act_id matching the saved act', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const receipt = await StorageManager.saveAct(act);
          
          // Receipt act_id should match the act's act_number (trimmed)
          return receipt.act_id === act.act_number.trim();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt content_raw_sha256 matches the act's content hash
   * Requirements: 1.1 - Receipt contains correct content hash
   */
  it('should have receipt content_raw_sha256 matching act content', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const receipt = await StorageManager.saveAct(act);
          
          // Compute expected hash
          const expectedHash = await StorageManager.computeSHA256(act.content_raw);
          
          // Receipt hash should match
          return receipt.content_raw_sha256 === expectedHash;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple acts each get their own receipt before completion
   * Requirements: 1.1, 1.3 - Each act has receipt before marked done
   */
  it('should create receipt for each act before completion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actGen, { minLength: 1, maxLength: 5 }),
        async (acts) => {
          // Make act_numbers unique
          const uniqueActs = acts.map((act, i) => ({
            ...act,
            act_number: `${act.act_number}_${i}`
          }));
          
          const receipts = [];
          
          // Save each act and collect receipts
          for (const act of uniqueActs) {
            const receipt = await StorageManager.saveAct(act);
            receipts.push(receipt);
          }
          
          // Verify all receipts exist in storage
          const storedReceipts = await StorageManager.getReceipts();
          
          for (const receipt of receipts) {
            const found = storedReceipts.find(r => r.receipt_id === receipt.receipt_id);
            if (!found) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt persisted_at is a valid ISO-8601 timestamp
   * Requirements: 1.1 - Receipt has valid timestamp
   */
  it('should have valid ISO-8601 persisted_at timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const receipt = await StorageManager.saveAct(act);
          
          // Check that persisted_at is a valid ISO-8601 timestamp
          const date = new Date(receipt.persisted_at);
          return !isNaN(date.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Simulated queue completion only happens after receipt exists
   * Requirements: 1.1, 1.3 - Act not marked done until persisted
   * 
   * This simulates the queue workflow where an act is only marked "completed"
   * after saveAct returns successfully with a receipt.
   */
  it('should only allow marking complete after receipt exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Simulate queue state
          const queueState = {
            status: 'pending',
            completedAt: null
          };
          
          // Save the act (this is the persist step)
          const receipt = await StorageManager.saveAct(act);
          
          // Only now mark as completed (simulating queue behavior)
          queueState.status = 'completed';
          queueState.completedAt = new Date().toISOString();
          
          // Verify: receipt persisted_at <= completedAt
          const persistedAt = new Date(receipt.persisted_at);
          const completedAt = new Date(queueState.completedAt);
          
          // Allow 1 second tolerance for timing
          return persistedAt <= new Date(completedAt.getTime() + 1000);
        }
      ),
      { numRuns: 100 }
    );
  });
});
