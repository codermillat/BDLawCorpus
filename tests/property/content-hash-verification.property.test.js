/**
 * Property-Based Tests for Content Hash Verification
 * 
 * Feature: durable-persistence-hardening, Property 18: Content Hash Verification
 * Validates: Requirements 11.1, 11.2, 11.3
 * 
 * For any act loaded from storage, computing SHA-256 of content_raw SHALL equal
 * the stored content_raw_sha256. If they differ, the act SHALL be flagged as
 * potentially_corrupted and SHALL NOT be served without warning.
 */

const fc = require('fast-check');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

const {
  StorageManager,
  StorageError,
  StorageErrorType
} = require('../../bdlaw-storage.js');

describe('Property 18: Content Hash Verification', () => {
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
   * Property: Computing SHA-256 of content_raw equals stored content_raw_sha256
   * Requirements: 11.1
   */
  it('should verify content hash matches on load for valid acts', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const savedAct = await StorageManager.saveActToIndexedDB(act);
          
          // Load the act
          const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number);
          
          if (!loadedAct) return false;
          
          // Compute hash of loaded content
          const computedHash = await StorageManager.computeSHA256(loadedAct.content_raw);
          
          // Verify hash matches stored hash
          if (computedHash !== loadedAct.content_raw_sha256) return false;
          
          // Verify integrity_verified flag is true
          if (!loadedAct._persistence) return false;
          if (loadedAct._persistence.integrity_verified !== true) return false;
          if (loadedAct._persistence.potentially_corrupted === true) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Acts with mismatched hash are flagged as potentially_corrupted
   * Requirements: 11.2
   */
  it('should flag acts with hash mismatch as potentially_corrupted', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        contentRawGen.filter(s => s.length > 0),
        async (act, corruptedContent) => {
          // Skip if corrupted content is same as original
          if (corruptedContent === act.content_raw) return true;
          
          // Save the act
          await StorageManager.saveActToIndexedDB(act);
          
          // Directly corrupt the content in IndexedDB
          const db = StorageManager.getDatabase();
          await new Promise((resolve, reject) => {
            const transaction = db.transaction(['acts'], 'readwrite');
            const store = transaction.objectStore('acts');
            const getRequest = store.get(act.act_number.trim());
            
            getRequest.onsuccess = () => {
              const storedAct = getRequest.result;
              if (storedAct) {
                // Corrupt the content but keep the old hash
                storedAct.content_raw = corruptedContent;
                store.put(storedAct);
              }
            };
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          });
          
          // Load the corrupted act
          const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number);
          
          if (!loadedAct) return false;
          
          // Verify act is flagged as potentially corrupted
          if (!loadedAct._persistence) return false;
          if (loadedAct._persistence.integrity_verified !== false) return false;
          if (loadedAct._persistence.potentially_corrupted !== true) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash verification updates last_verified_at timestamp
   * Requirements: 11.1
   */
  it('should update last_verified_at timestamp on load', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          await StorageManager.saveActToIndexedDB(act);
          
          // Wait a tiny bit to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 1));
          
          // Load the act
          const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number);
          
          if (!loadedAct) return false;
          if (!loadedAct._persistence) return false;
          if (!loadedAct._persistence.last_verified_at) return false;
          
          // Verify timestamp is a valid ISO-8601 string
          const date = new Date(loadedAct._persistence.last_verified_at);
          if (isNaN(date.getTime())) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash is deterministic for same content
   * Requirements: 11.1
   */
  it('should produce deterministic hash for same content', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentRawGen,
        async (content) => {
          // Compute hash twice
          const hash1 = await StorageManager.computeSHA256(content);
          const hash2 = await StorageManager.computeSHA256(content);
          
          // Hashes should be identical
          return hash1 === hash2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different content produces different hash
   * Requirements: 11.1
   */
  it('should produce different hash for different content', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentRawGen,
        contentRawGen,
        async (content1, content2) => {
          // Skip if contents are the same
          if (content1 === content2) return true;
          
          const hash1 = await StorageManager.computeSHA256(content1);
          const hash2 = await StorageManager.computeSHA256(content2);
          
          // Hashes should be different
          return hash1 !== hash2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash is always 64 hex characters
   * Requirements: 11.1
   */
  it('should produce 64 hex character hash', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentRawGen,
        async (content) => {
          const hash = await StorageManager.computeSHA256(content);
          
          // Verify length
          if (hash.length !== 64) return false;
          
          // Verify hex characters only
          if (!/^[a-f0-9]{64}$/.test(hash)) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Corrupted acts include integrity_error message
   * Requirements: 11.3
   */
  it('should include integrity_error message for corrupted acts', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        contentRawGen.filter(s => s.length > 0),
        async (act, corruptedContent) => {
          // Skip if corrupted content is same as original
          if (corruptedContent === act.content_raw) return true;
          
          // Save the act
          await StorageManager.saveActToIndexedDB(act);
          
          // Directly corrupt the content in IndexedDB
          const db = StorageManager.getDatabase();
          await new Promise((resolve, reject) => {
            const transaction = db.transaction(['acts'], 'readwrite');
            const store = transaction.objectStore('acts');
            const getRequest = store.get(act.act_number.trim());
            
            getRequest.onsuccess = () => {
              const storedAct = getRequest.result;
              if (storedAct) {
                storedAct.content_raw = corruptedContent;
                store.put(storedAct);
              }
            };
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          });
          
          // Load the corrupted act
          const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number);
          
          if (!loadedAct) return false;
          if (!loadedAct._persistence) return false;
          
          // Verify integrity_error message exists
          if (!loadedAct._persistence.integrity_error) return false;
          if (typeof loadedAct._persistence.integrity_error !== 'string') return false;
          if (loadedAct._persistence.integrity_error.length === 0) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
