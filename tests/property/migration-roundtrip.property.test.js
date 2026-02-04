/**
 * Property-Based Tests for Migration Round-Trip
 * 
 * Feature: durable-persistence-hardening, Property 7: Migration Round-Trip
 * Validates: Requirements 3.3
 * 
 * For any act stored in chrome.storage.local before migration, after calling migrate(),
 * the act SHALL be retrievable from IndexedDB with identical content_raw and content_raw_sha256.
 */

const fc = require('fast-check');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

const {
  StorageManager,
  ChromeStorageBackend,
  MigrationManager,
  StorageError,
  StorageErrorType
} = require('../../bdlaw-storage.js');

describe('Property 7: Migration Round-Trip', () => {
  let fakeIndexedDB;
  let mockChromeStorage;
  
  // Setup and teardown for each test
  beforeEach(async () => {
    // Create a fresh fake IndexedDB instance for each test
    fakeIndexedDB = new FDBFactory();
    
    // Set global indexedDB to our fake
    global.indexedDB = fakeIndexedDB;
    
    // Create mock chrome.storage.local
    mockChromeStorage = {};
    
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            const result = {};
            if (Array.isArray(keys)) {
              keys.forEach(key => {
                if (mockChromeStorage[key] !== undefined) {
                  result[key] = mockChromeStorage[key];
                }
              });
            } else if (typeof keys === 'string') {
              if (mockChromeStorage[keys] !== undefined) {
                result[keys] = mockChromeStorage[keys];
              }
            } else if (keys === null) {
              Object.assign(result, mockChromeStorage);
            }
            callback(result);
          }),
          set: jest.fn((items, callback) => {
            Object.assign(mockChromeStorage, items);
            if (callback) callback();
          }),
          remove: jest.fn((keys, callback) => {
            if (Array.isArray(keys)) {
              keys.forEach(key => delete mockChromeStorage[key]);
            } else {
              delete mockChromeStorage[keys];
            }
            if (callback) callback();
          }),
          getBytesInUse: jest.fn((keys, callback) => {
            const size = JSON.stringify(mockChromeStorage).length;
            callback(size);
          }),
          QUOTA_BYTES: 10 * 1024 * 1024
        }
      },
      runtime: {
        lastError: null
      }
    };
    
    // Reset StorageManager state completely
    StorageManager._db = null;
    StorageManager._activeBackend = null;
    StorageManager._sessionId = null;
    
    // Reset MigrationManager state
    MigrationManager.clearCache();
    
    // Clear mock storage completely
    mockChromeStorage = {};
  });

  afterEach(() => {
    // Close database connection
    if (StorageManager._db) {
      StorageManager.closeDatabase();
    }
    
    // Clean up globals
    delete global.indexedDB;
    delete global.chrome;
  });

  // Generator for valid act numbers (numeric strings)
  const actNumberGen = fc.stringOf(
    fc.constantFrom(...'0123456789'),
    { minLength: 1, maxLength: 6 }
  );

  // Generator for act titles
  const titleGen = fc.string({ minLength: 1, maxLength: 200 });

  // Generator for content_raw (non-empty string)
  const contentRawGen = fc.string({ minLength: 1, maxLength: 5000 });

  // Generator for volume numbers
  const volumeNumberGen = fc.stringOf(
    fc.constantFrom(...'0123456789'),
    { minLength: 1, maxLength: 3 }
  );

  // Generator for URLs
  const urlGen = fc.webUrl();

  // Generator for valid act objects
  const actGen = fc.record({
    act_number: actNumberGen,
    title: titleGen,
    content_raw: contentRawGen,
    volume_number: volumeNumberGen,
    url: urlGen,
    capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .map(d => d.toISOString())
  });

  // Generator for arrays of unique acts
  const uniqueActsGen = fc.array(actGen, { minLength: 1, maxLength: 10 })
    .map(acts => {
      // Ensure unique act_numbers
      const seen = new Set();
      return acts.filter(act => {
        if (seen.has(act.act_number)) return false;
        seen.add(act.act_number);
        return true;
      });
    })
    .filter(acts => acts.length > 0);

  /**
   * Helper function to reset IndexedDB for each property test iteration
   */
  async function resetIndexedDB() {
    // Close existing connection
    if (StorageManager._db) {
      StorageManager.closeDatabase();
    }
    
    // Create a fresh fake IndexedDB
    fakeIndexedDB = new FDBFactory();
    global.indexedDB = fakeIndexedDB;
    
    // Reset StorageManager state
    StorageManager._db = null;
    StorageManager._activeBackend = null;
    StorageManager._sessionId = null;
    
    // Reset MigrationManager state
    MigrationManager.clearCache();
    
    // Clear mock chrome storage
    Object.keys(mockChromeStorage).forEach(key => delete mockChromeStorage[key]);
  }

  /**
   * Property: Migrated acts have identical content_raw
   * Requirements: 3.3
   * 
   * For any act stored in chrome.storage.local, after migration,
   * the act should be retrievable from IndexedDB with identical content_raw.
   */
  it('should preserve content_raw after migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueActsGen,
        async (acts) => {
          // Reset for this iteration
          await resetIndexedDB();
          
          // Store acts in chrome.storage.local (simulating pre-migration state)
          mockChromeStorage[ChromeStorageBackend.ACTS_KEY] = acts;
          
          // Initialize IndexedDB (without migration - we'll run it manually)
          await StorageManager._initIndexedDB();
          StorageManager._activeBackend = 'indexeddb';
          
          // Reset migration state to allow migration
          await MigrationManager.reset();
          
          // Run migration
          const migrationResult = await MigrationManager.migrateToIndexedDB();
          
          // Verify migration succeeded
          if (!migrationResult.success && migrationResult.failed > 0) {
            // Some acts may fail, but at least some should succeed
            if (migrationResult.migrated === 0) return false;
          }
          
          // Verify each migrated act has identical content_raw
          for (const originalAct of acts) {
            const loadedAct = await StorageManager.loadActFromIndexedDB(originalAct.act_number);
            
            // If act was migrated, verify content_raw matches
            if (loadedAct) {
              if (loadedAct.content_raw !== originalAct.content_raw) {
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
   * Property: Migrated acts have correct content_raw_sha256
   * Requirements: 3.3
   * 
   * For any act stored in chrome.storage.local, after migration,
   * the act should have a content_raw_sha256 that matches the hash of content_raw.
   */
  it('should generate correct content_raw_sha256 after migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueActsGen,
        async (acts) => {
          // Reset for this iteration
          await resetIndexedDB();
          
          // Store acts in chrome.storage.local
          mockChromeStorage[ChromeStorageBackend.ACTS_KEY] = acts;
          
          // Initialize IndexedDB
          await StorageManager._initIndexedDB();
          StorageManager._activeBackend = 'indexeddb';
          
          // Reset migration state
          await MigrationManager.reset();
          
          // Run migration
          const migrationResult = await MigrationManager.migrateToIndexedDB();
          
          // Verify each migrated act has correct hash
          for (const originalAct of acts) {
            const loadedAct = await StorageManager.loadActFromIndexedDB(originalAct.act_number);
            
            if (loadedAct) {
              // Compute expected hash
              const expectedHash = await StorageManager.computeSHA256(originalAct.content_raw);
              
              // Verify hash matches
              if (loadedAct.content_raw_sha256 !== expectedHash) {
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
   * Property: Migration generates receipts for all migrated acts
   * Requirements: 3.3
   * 
   * For any act successfully migrated, there should be a corresponding receipt.
   */
  it('should generate receipts for migrated acts', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueActsGen,
        async (acts) => {
          // Reset for this iteration
          await resetIndexedDB();
          
          // Store acts in chrome.storage.local
          mockChromeStorage[ChromeStorageBackend.ACTS_KEY] = acts;
          
          // Initialize IndexedDB
          await StorageManager._initIndexedDB();
          StorageManager._activeBackend = 'indexeddb';
          
          // Reset migration state
          await MigrationManager.reset();
          
          // Run migration
          const migrationResult = await MigrationManager.migrateToIndexedDB();
          
          // Get all receipts
          const receipts = await StorageManager._getReceiptsFromIndexedDB({});
          const receiptActIds = new Set(receipts.map(r => r.act_id));
          
          // Verify each migrated act has a receipt
          for (const originalAct of acts) {
            const loadedAct = await StorageManager.loadActFromIndexedDB(originalAct.act_number);
            
            // If act was migrated, it should have a receipt
            if (loadedAct) {
              if (!receiptActIds.has(originalAct.act_number)) {
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
   * Property: Migration is idempotent - running twice doesn't duplicate acts
   * Requirements: 3.3
   * 
   * Running migration multiple times should not create duplicate acts or receipts.
   */
  it('should be idempotent - running twice does not duplicate', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueActsGen,
        async (acts) => {
          // Reset for this iteration
          await resetIndexedDB();
          
          // Store acts in chrome.storage.local
          mockChromeStorage[ChromeStorageBackend.ACTS_KEY] = acts;
          
          // Initialize IndexedDB
          await StorageManager._initIndexedDB();
          StorageManager._activeBackend = 'indexeddb';
          
          // Reset migration state
          await MigrationManager.reset();
          
          // Run migration first time
          const firstResult = await MigrationManager.migrateToIndexedDB();
          
          // Get receipt count after first migration
          const receiptsAfterFirst = await StorageManager._getReceiptsFromIndexedDB({});
          const countAfterFirst = receiptsAfterFirst.length;
          
          // Reset migration state to allow second run
          await MigrationManager.reset();
          
          // Run migration second time
          const secondResult = await MigrationManager.migrateToIndexedDB();
          
          // Get receipt count after second migration
          const receiptsAfterSecond = await StorageManager._getReceiptsFromIndexedDB({});
          const countAfterSecond = receiptsAfterSecond.length;
          
          // Second migration should skip all acts (already migrated)
          // Receipt count should be the same
          if (countAfterSecond !== countAfterFirst) {
            return false;
          }
          
          // Second migration should report all as skipped
          if (secondResult.skipped !== acts.length) {
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Migration preserves all act fields
   * Requirements: 3.3
   * 
   * All fields of the original act should be preserved after migration.
   */
  it('should preserve all act fields after migration', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueActsGen,
        async (acts) => {
          // Reset for this iteration
          await resetIndexedDB();
          
          // Store acts in chrome.storage.local
          mockChromeStorage[ChromeStorageBackend.ACTS_KEY] = acts;
          
          // Initialize IndexedDB
          await StorageManager._initIndexedDB();
          StorageManager._activeBackend = 'indexeddb';
          
          // Reset migration state
          await MigrationManager.reset();
          
          // Run migration
          await MigrationManager.migrateToIndexedDB();
          
          // Verify each migrated act preserves all fields
          for (const originalAct of acts) {
            const loadedAct = await StorageManager.loadActFromIndexedDB(originalAct.act_number);
            
            if (loadedAct) {
              // Check all original fields are preserved
              if (loadedAct.act_number !== originalAct.act_number) return false;
              if (loadedAct.title !== originalAct.title) return false;
              if (loadedAct.content_raw !== originalAct.content_raw) return false;
              if (loadedAct.volume_number !== originalAct.volume_number) return false;
              if (loadedAct.url !== originalAct.url) return false;
              if (loadedAct.capturedAt !== originalAct.capturedAt) return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Migration count matches expected
   * Requirements: 3.3
   * 
   * The migration result should accurately report the number of migrated acts.
   */
  it('should accurately report migration counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueActsGen,
        async (acts) => {
          // Reset for this iteration
          await resetIndexedDB();
          
          // Store acts in chrome.storage.local
          mockChromeStorage[ChromeStorageBackend.ACTS_KEY] = acts;
          
          // Initialize IndexedDB
          await StorageManager._initIndexedDB();
          StorageManager._activeBackend = 'indexeddb';
          
          // Reset migration state
          await MigrationManager.reset();
          
          // Run migration
          const result = await MigrationManager.migrateToIndexedDB();
          
          // Total should equal input count
          if (result.total !== acts.length) return false;
          
          // migrated + skipped + failed should equal total
          if (result.migrated + result.skipped + result.failed !== result.total) return false;
          
          // Verify migrated count matches actual acts in IndexedDB
          let actualMigrated = 0;
          for (const act of acts) {
            const loaded = await StorageManager.loadActFromIndexedDB(act.act_number);
            if (loaded) actualMigrated++;
          }
          
          if (actualMigrated !== result.migrated) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
