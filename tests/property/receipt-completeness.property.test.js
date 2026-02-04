/**
 * Property-Based Tests for Receipt Completeness
 * 
 * Feature: durable-persistence-hardening, Property 3: Receipt Completeness
 * Validates: Requirements 1.4
 * 
 * For any extraction_receipt in the receipts log, it SHALL contain all required fields:
 * - receipt_id (non-empty string)
 * - act_id (non-empty string)
 * - content_raw_sha256 (valid hex string, 64 characters)
 * - storage_backend (one of 'indexeddb', 'chrome_storage', 'memory')
 * - persisted_at (valid ISO-8601 timestamp)
 * - schema_version (non-empty string)
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

describe('Property 3: Receipt Completeness', () => {
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
   * Property: Generated receipts contain all required fields
   * Requirements: 1.4
   */
  it('should generate receipts with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate a receipt for the act
          const receipt = await StorageManager.generateReceipt(act);
          
          // Verify receipt_id exists and is non-empty string
          if (!receipt.receipt_id || typeof receipt.receipt_id !== 'string' || 
              receipt.receipt_id.trim().length === 0) {
            return false;
          }
          
          // Verify act_id exists and is non-empty string
          if (!receipt.act_id || typeof receipt.act_id !== 'string' || 
              receipt.act_id.trim().length === 0) {
            return false;
          }
          
          // Verify content_raw_sha256 is valid 64-character hex string
          if (!receipt.content_raw_sha256 || typeof receipt.content_raw_sha256 !== 'string' ||
              !/^[a-f0-9]{64}$/.test(receipt.content_raw_sha256)) {
            return false;
          }
          
          // Verify storage_backend is one of valid values
          if (!receipt.storage_backend || !STORAGE_BACKENDS.includes(receipt.storage_backend)) {
            return false;
          }
          
          // Verify persisted_at is valid ISO-8601 timestamp
          if (!receipt.persisted_at || typeof receipt.persisted_at !== 'string') {
            return false;
          }
          const date = new Date(receipt.persisted_at);
          if (isNaN(date.getTime())) {
            return false;
          }
          
          // Verify schema_version exists and is non-empty string
          if (!receipt.schema_version || typeof receipt.schema_version !== 'string' ||
              receipt.schema_version.trim().length === 0) {
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt act_id matches the act's act_number
   * Requirements: 1.4
   */
  it('should set act_id to match the act act_number', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          const receipt = await StorageManager.generateReceipt(act);
          
          // act_id should match the trimmed act_number
          return receipt.act_id === act.act_number.trim();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt content_raw_sha256 is deterministic for same content
   * Requirements: 1.4
   */
  it('should generate deterministic content_raw_sha256 for same content', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate two receipts for the same act
          const receipt1 = await StorageManager.generateReceipt(act);
          const receipt2 = await StorageManager.generateReceipt(act);
          
          // content_raw_sha256 should be identical
          return receipt1.content_raw_sha256 === receipt2.content_raw_sha256;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt storage_backend reflects active backend
   * Requirements: 1.4
   */
  it('should set storage_backend to active backend', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          const receipt = await StorageManager.generateReceipt(act);
          const activeBackend = StorageManager.getActiveBackend();
          
          return receipt.storage_backend === activeBackend;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Receipt schema_version matches current version
   * Requirements: 1.4
   */
  it('should set schema_version to current version', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          const receipt = await StorageManager.generateReceipt(act);
          
          return receipt.schema_version === RECEIPT_SCHEMA_VERSION;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each generated receipt has unique receipt_id
   * Requirements: 1.4
   */
  it('should generate unique receipt_id for each receipt', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Generate multiple receipts
          const receipt1 = await StorageManager.generateReceipt(act);
          const receipt2 = await StorageManager.generateReceipt(act);
          const receipt3 = await StorageManager.generateReceipt(act);
          
          // All receipt_ids should be unique
          const ids = [receipt1.receipt_id, receipt2.receipt_id, receipt3.receipt_id];
          const uniqueIds = new Set(ids);
          
          return uniqueIds.size === ids.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: ExtractionReceipt.validate passes for generated receipts
   * Requirements: 1.4
   */
  it('should generate receipts that pass validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          const receipt = await StorageManager.generateReceipt(act);
          const validation = ExtractionReceipt.validate(receipt);
          
          return validation.valid === true && validation.errors.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: persisted_at timestamp is recent (within last minute)
   * Requirements: 1.4
   */
  it('should set persisted_at to current time', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          const beforeTime = new Date();
          const receipt = await StorageManager.generateReceipt(act);
          const afterTime = new Date();
          
          const persistedAt = new Date(receipt.persisted_at);
          
          // persisted_at should be between before and after times
          return persistedAt >= beforeTime && persistedAt <= afterTime;
        }
      ),
      { numRuns: 100 }
    );
  });
});
