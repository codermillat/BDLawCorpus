/**
 * Property-Based Tests for Receipt Round-Trip
 * 
 * Feature: durable-persistence-hardening, Property 5: Receipt Round-Trip
 * Validates: Requirements 1.6
 * 
 * For any act that is successfully saved via saveAct(), immediately reading back
 * the receipt via getReceipts() SHALL return a receipt with matching act_id and
 * content_raw_sha256.
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

describe('Property 5: Receipt Round-Trip', () => {
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

  /**
   * Property: Saved receipt can be retrieved with matching act_id
   * Requirements: 1.6
   */
  it('should retrieve saved receipt with matching act_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate and save a receipt
          const receipt = await StorageManager.generateReceipt(act);
          await StorageManager.saveReceipt(receipt);
          
          // Read back receipts
          const receipts = await StorageManager.getReceipts();
          
          // Find the receipt by receipt_id
          const foundReceipt = receipts.find(r => r.receipt_id === receipt.receipt_id);
          
          if (!foundReceipt) return false;
          
          // Verify act_id matches
          return foundReceipt.act_id === receipt.act_id;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Saved receipt can be retrieved with matching content_raw_sha256
   * Requirements: 1.6
   */
  it('should retrieve saved receipt with matching content_raw_sha256', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate and save a receipt
          const receipt = await StorageManager.generateReceipt(act);
          await StorageManager.saveReceipt(receipt);
          
          // Read back receipts
          const receipts = await StorageManager.getReceipts();
          
          // Find the receipt by receipt_id
          const foundReceipt = receipts.find(r => r.receipt_id === receipt.receipt_id);
          
          if (!foundReceipt) return false;
          
          // Verify content_raw_sha256 matches
          return foundReceipt.content_raw_sha256 === receipt.content_raw_sha256;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt can be filtered by act_id
   * Requirements: 1.6
   */
  it('should filter receipts by act_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate and save a receipt
          const receipt = await StorageManager.generateReceipt(act);
          await StorageManager.saveReceipt(receipt);
          
          // Read back receipts filtered by act_id
          const filteredReceipts = await StorageManager.getReceipts({ actId: receipt.act_id });
          
          // Should find at least one receipt
          if (filteredReceipts.length === 0) return false;
          
          // All returned receipts should have matching act_id
          return filteredReceipts.every(r => r.act_id === receipt.act_id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All receipt fields are preserved in round-trip
   * Requirements: 1.6
   */
  it('should preserve all receipt fields in round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate and save a receipt
          const receipt = await StorageManager.generateReceipt(act);
          await StorageManager.saveReceipt(receipt);
          
          // Read back receipts
          const receipts = await StorageManager.getReceipts();
          
          // Find the receipt by receipt_id
          const foundReceipt = receipts.find(r => r.receipt_id === receipt.receipt_id);
          
          if (!foundReceipt) return false;
          
          // Verify all fields match
          return (
            foundReceipt.receipt_id === receipt.receipt_id &&
            foundReceipt.act_id === receipt.act_id &&
            foundReceipt.content_raw_sha256 === receipt.content_raw_sha256 &&
            foundReceipt.storage_backend === receipt.storage_backend &&
            foundReceipt.persisted_at === receipt.persisted_at &&
            foundReceipt.schema_version === receipt.schema_version
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple receipts for same act_id can be retrieved
   * Requirements: 1.6
   */
  it('should retrieve multiple receipts for same act_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        fc.integer({ min: 2, max: 5 }),
        async (act, count) => {
          const savedReceipts = [];
          
          // Generate and save multiple receipts for the same act
          for (let i = 0; i < count; i++) {
            const receipt = await StorageManager.generateReceipt(act);
            await StorageManager.saveReceipt(receipt);
            savedReceipts.push(receipt);
          }
          
          // Read back receipts filtered by act_id
          const filteredReceipts = await StorageManager.getReceipts({ actId: act.act_number.trim() });
          
          // Should find all saved receipts
          if (filteredReceipts.length < count) return false;
          
          // All saved receipts should be found
          for (const saved of savedReceipts) {
            const found = filteredReceipts.find(r => r.receipt_id === saved.receipt_id);
            if (!found) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt content_raw_sha256 matches computed hash of act content
   * Requirements: 1.6
   */
  it('should have receipt hash matching computed hash of act content', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate and save a receipt
          const receipt = await StorageManager.generateReceipt(act);
          await StorageManager.saveReceipt(receipt);
          
          // Compute hash of original content
          const computedHash = await StorageManager.computeSHA256(act.content_raw);
          
          // Read back receipts
          const receipts = await StorageManager.getReceipts();
          
          // Find the receipt by receipt_id
          const foundReceipt = receipts.find(r => r.receipt_id === receipt.receipt_id);
          
          if (!foundReceipt) return false;
          
          // Verify hash matches computed hash
          return foundReceipt.content_raw_sha256 === computedHash;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Immediate read after save returns the receipt
   * Requirements: 1.6
   */
  it('should return receipt immediately after save', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate and save a receipt
          const receipt = await StorageManager.generateReceipt(act);
          await StorageManager.saveReceipt(receipt);
          
          // Immediately read back
          const receipts = await StorageManager.getReceipts();
          
          // Should find the receipt
          const found = receipts.some(r => r.receipt_id === receipt.receipt_id);
          
          return found;
        }
      ),
      { numRuns: 100 }
    );
  });
});
