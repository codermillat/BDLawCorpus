/**
 * Property-Based Tests for Write-Ahead Log Integrity
 * 
 * Feature: durable-persistence-hardening, Property 12: Write-Ahead Log Integrity
 * Validates: Requirements 6.1, 6.2, 6.3
 * 
 * For any extraction that starts, an intent entry SHALL exist in the WAL before extraction begins.
 * For any extraction that completes successfully, a complete entry SHALL exist in the WAL with
 * matching act_id and content_hash.
 * For any act with an intent entry but no complete entry, it SHALL be identified as an
 * incomplete extraction.
 */

const fc = require('fast-check');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

const {
  StorageManager,
  StorageError,
  StorageErrorType,
  ExtractionReceipt,
  MemoryBackend
} = require('../../bdlaw-storage.js');

describe('Property 12: Write-Ahead Log Integrity', () => {
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
    StorageManager._sessionId = null;
    StorageManager._memoryStore.wal = [];
    StorageManager._memoryStore.receipts = [];
    StorageManager._memoryStore.acts = new Map();
    
    // Reset MemoryBackend WAL
    MemoryBackend._wal = [];
    MemoryBackend._receipts = [];
    MemoryBackend._acts = new Map();
    
    // Initialize with fake IndexedDB
    await StorageManager.initialize();
  });

  afterEach(() => {
    // Close database connection
    StorageManager.closeDatabase();
    
    // Clean up global
    delete global.indexedDB;
  });

  // Helper to clear WAL entries between property runs
  async function clearWAL() {
    if (StorageManager._activeBackend === 'indexeddb' && StorageManager._db) {
      return new Promise((resolve, reject) => {
        try {
          const transaction = StorageManager._db.transaction(['wal'], 'readwrite');
          const store = transaction.objectStore('wal');
          const request = store.clear();
          
          transaction.oncomplete = () => resolve();
          transaction.onerror = (e) => reject(e.target.error);
        } catch (e) {
          reject(e);
        }
      });
    }
    // For memory backend
    MemoryBackend._wal = [];
    StorageManager._memoryStore.wal = [];
  }

  // Generator for valid act numbers (numeric strings)
  const actNumberGen = fc.stringOf(
    fc.constantFrom(...'0123456789'),
    { minLength: 1, maxLength: 6 }
  );

  // Generator for valid SHA-256 hashes (64 hex characters)
  const sha256Gen = fc.hexaString({ minLength: 64, maxLength: 64 });

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
   * Property: logIntent creates a WAL entry with type 'intent'
   * Requirements: 6.1
   */
  it('should create intent entry before extraction', async () => {
    await fc.assert(
      fc.asyncProperty(
        actNumberGen,
        async (actId) => {
          // Log intent for the act
          const walEntry = await StorageManager.logIntent(actId);
          
          // Verify entry has correct type
          if (walEntry.entry_type !== 'intent') {
            return false;
          }
          
          // Verify entry has correct act_id
          if (walEntry.act_id !== actId.trim()) {
            return false;
          }
          
          // Verify entry has required fields
          if (!walEntry.entry_id || typeof walEntry.entry_id !== 'string') {
            return false;
          }
          
          if (!walEntry.timestamp || typeof walEntry.timestamp !== 'string') {
            return false;
          }
          
          // Verify timestamp is valid ISO-8601
          const date = new Date(walEntry.timestamp);
          if (isNaN(date.getTime())) {
            return false;
          }
          
          // Verify content_hash is null for intent entries
          if (walEntry.content_hash !== null) {
            return false;
          }
          
          // Verify session_id exists
          if (!walEntry.session_id || typeof walEntry.session_id !== 'string') {
            return false;
          }
          
          // Verify pruned is false
          if (walEntry.pruned !== false) {
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: logComplete creates a WAL entry with type 'complete' and content_hash
   * Requirements: 6.2
   */
  it('should create complete entry after extraction with content_hash', async () => {
    await fc.assert(
      fc.asyncProperty(
        actNumberGen,
        sha256Gen,
        async (actId, contentHash) => {
          // Log complete for the act
          const walEntry = await StorageManager.logComplete(actId, contentHash);
          
          // Verify entry has correct type
          if (walEntry.entry_type !== 'complete') {
            return false;
          }
          
          // Verify entry has correct act_id
          if (walEntry.act_id !== actId.trim()) {
            return false;
          }
          
          // Verify entry has correct content_hash (lowercase)
          if (walEntry.content_hash !== contentHash.toLowerCase()) {
            return false;
          }
          
          // Verify entry has required fields
          if (!walEntry.entry_id || typeof walEntry.entry_id !== 'string') {
            return false;
          }
          
          if (!walEntry.timestamp || typeof walEntry.timestamp !== 'string') {
            return false;
          }
          
          // Verify timestamp is valid ISO-8601
          const date = new Date(walEntry.timestamp);
          if (isNaN(date.getTime())) {
            return false;
          }
          
          // Verify session_id exists
          if (!walEntry.session_id || typeof walEntry.session_id !== 'string') {
            return false;
          }
          
          // Verify pruned is false
          if (walEntry.pruned !== false) {
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Acts with intent but no complete are identified as incomplete
   * Requirements: 6.3
   */
  it('should identify acts with intent but no complete as incomplete', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actNumberGen, { minLength: 1, maxLength: 10 }),
        async (actIds) => {
          // Clear WAL and reset session ID for each property run
          await clearWAL();
          StorageManager._sessionId = null;
          
          // Ensure unique act IDs
          const uniqueActIds = [...new Set(actIds.map(id => id.trim()))];
          if (uniqueActIds.length === 0) return true;
          
          // Log intent for all acts
          for (const actId of uniqueActIds) {
            await StorageManager.logIntent(actId);
          }
          
          // Get incomplete extractions
          const incomplete = await StorageManager.getIncompleteExtractions();
          
          // All acts should be identified as incomplete
          const incompleteActIds = new Set(incomplete.map(i => i.actId));
          
          for (const actId of uniqueActIds) {
            if (!incompleteActIds.has(actId)) {
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
   * Property: Acts with both intent and complete are NOT identified as incomplete
   * Requirements: 6.3
   */
  it('should not identify completed acts as incomplete', async () => {
    await fc.assert(
      fc.asyncProperty(
        actNumberGen,
        sha256Gen,
        async (actId, contentHash) => {
          // Clear WAL and reset session ID for each property run
          await clearWAL();
          StorageManager._sessionId = null;
          
          // Log intent
          await StorageManager.logIntent(actId);
          
          // Log complete
          await StorageManager.logComplete(actId, contentHash);
          
          // Get incomplete extractions
          const incomplete = await StorageManager.getIncompleteExtractions();
          
          // The act should NOT be in incomplete list
          const incompleteActIds = incomplete.map(i => i.actId);
          
          return !incompleteActIds.includes(actId.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mixed complete and incomplete acts are correctly identified
   * Requirements: 6.3
   */
  it('should correctly distinguish complete from incomplete acts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actNumberGen, { minLength: 2, maxLength: 10 }),
        fc.array(sha256Gen, { minLength: 1, maxLength: 5 }),
        async (actIds, hashes) => {
          // Clear WAL and reset session ID for each property run
          await clearWAL();
          StorageManager._sessionId = null;
          
          // Ensure unique act IDs
          const uniqueActIds = [...new Set(actIds.map(id => id.trim()))];
          if (uniqueActIds.length < 2) return true;
          
          // Split into complete and incomplete groups
          const midpoint = Math.floor(uniqueActIds.length / 2);
          const completeActIds = uniqueActIds.slice(0, midpoint);
          const incompleteActIds = uniqueActIds.slice(midpoint);
          
          // Log intent for all acts
          for (const actId of uniqueActIds) {
            await StorageManager.logIntent(actId);
          }
          
          // Log complete only for complete group
          for (let i = 0; i < completeActIds.length; i++) {
            const hash = hashes[i % hashes.length];
            await StorageManager.logComplete(completeActIds[i], hash);
          }
          
          // Get incomplete extractions
          const incomplete = await StorageManager.getIncompleteExtractions();
          const incompleteSet = new Set(incomplete.map(i => i.actId));
          
          // Verify complete acts are NOT in incomplete list
          for (const actId of completeActIds) {
            if (incompleteSet.has(actId)) {
              return false;
            }
          }
          
          // Verify incomplete acts ARE in incomplete list
          for (const actId of incompleteActIds) {
            if (!incompleteSet.has(actId)) {
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
   * Property: Each WAL entry has a unique entry_id
   * Requirements: 6.1, 6.2
   */
  it('should generate unique entry_id for each WAL entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actNumberGen, { minLength: 2, maxLength: 10 }),
        async (actIds) => {
          // Clear WAL and reset session ID for each property run
          await clearWAL();
          StorageManager._sessionId = null;
          
          const entryIds = new Set();
          
          // Log intent for all acts
          for (const actId of actIds) {
            const entry = await StorageManager.logIntent(actId);
            if (entryIds.has(entry.entry_id)) {
              return false; // Duplicate entry_id found
            }
            entryIds.add(entry.entry_id);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: logIntent rejects empty or invalid actId
   * Requirements: 6.1
   */
  it('should reject empty actId for logIntent', async () => {
    const invalidActIds = ['', '   ', null, undefined];
    
    for (const actId of invalidActIds) {
      try {
        await StorageManager.logIntent(actId);
        // Should have thrown
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeInstanceOf(StorageError);
      }
    }
  });

  /**
   * Property: logComplete rejects invalid contentHash
   * Requirements: 6.2
   */
  it('should reject invalid contentHash for logComplete', async () => {
    const invalidHashes = [
      '',
      '   ',
      'abc', // Too short
      'xyz123', // Invalid characters
      'a'.repeat(63), // Too short
      'a'.repeat(65), // Too long
      null,
      undefined
    ];
    
    for (const hash of invalidHashes) {
      try {
        await StorageManager.logComplete('123', hash);
        // Should have thrown
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeInstanceOf(StorageError);
      }
    }
  });

  /**
   * Property: Incomplete extractions include timestamp and entryId
   * Requirements: 6.3
   */
  it('should include timestamp and entryId in incomplete extractions', async () => {
    await fc.assert(
      fc.asyncProperty(
        actNumberGen,
        async (actId) => {
          // Clear WAL and reset session ID for each property run
          await clearWAL();
          StorageManager._sessionId = null;
          
          // Log intent
          const intentEntry = await StorageManager.logIntent(actId);
          
          // Get incomplete extractions
          const incomplete = await StorageManager.getIncompleteExtractions();
          
          // Find our act
          const found = incomplete.find(i => i.actId === actId.trim());
          
          if (!found) {
            return false;
          }
          
          // Verify timestamp exists and is valid
          if (!found.timestamp || typeof found.timestamp !== 'string') {
            return false;
          }
          
          // Verify entryId exists
          if (!found.entryId || typeof found.entryId !== 'string') {
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Session ID is consistent within a session
   * Requirements: 6.1, 6.2
   */
  it('should maintain consistent session_id within a session', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actNumberGen, { minLength: 2, maxLength: 5 }),
        async (actIds) => {
          // Clear WAL and reset session ID for each property run
          await clearWAL();
          StorageManager._sessionId = null;
          
          const sessionIds = new Set();
          
          // Log intent for all acts
          for (const actId of actIds) {
            const entry = await StorageManager.logIntent(actId);
            sessionIds.add(entry.session_id);
          }
          
          // All entries should have the same session_id
          return sessionIds.size === 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});
