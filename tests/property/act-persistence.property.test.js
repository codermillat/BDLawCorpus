/**
 * Property-Based Tests for Act Persistence
 * 
 * Feature: durable-persistence-hardening, Property 8: Act Lookup by Key
 * Validates: Requirements 3.5
 * 
 * For any act stored via saveActToIndexedDB(act), calling loadActFromIndexedDB(act.act_number)
 * SHALL return an object with identical content_raw, title, and act_number fields.
 */

const fc = require('fast-check');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

const {
  StorageManager,
  StorageError,
  StorageErrorType
} = require('../../bdlaw-storage.js');

describe('Property 8: Act Lookup by Key', () => {
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

  /**
   * Property: Saved acts can be retrieved by act_number with identical core fields
   * Requirements: 3.5
   */
  it('should retrieve saved acts with identical content_raw, title, and act_number', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const savedAct = await StorageManager.saveActToIndexedDB(act);
          
          // Load the act by act_number
          const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number);
          
          // Verify act was found
          if (!loadedAct) return false;
          
          // Verify core fields are identical
          if (loadedAct.act_number !== act.act_number.trim()) return false;
          if (loadedAct.title !== act.title) return false;
          if (loadedAct.content_raw !== act.content_raw) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Loading non-existent act returns null
   * Requirements: 3.5
   */
  it('should return null for non-existent act_number', async () => {
    await fc.assert(
      fc.asyncProperty(
        actNumberGen,
        async (actNumber) => {
          // Try to load an act that was never saved
          const loadedAct = await StorageManager.loadActFromIndexedDB(actNumber);
          
          // Should return null
          return loadedAct === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Saved acts have content_raw_sha256 hash generated
   * Requirements: 3.6
   */
  it('should generate content_raw_sha256 hash when saving', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const savedAct = await StorageManager.saveActToIndexedDB(act);
          
          // Verify hash was generated
          if (!savedAct.content_raw_sha256) return false;
          
          // Verify hash is valid (64 hex characters)
          if (!/^[a-f0-9]{64}$/.test(savedAct.content_raw_sha256)) return false;
          
          // Load and verify hash is preserved
          const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number);
          if (!loadedAct) return false;
          if (loadedAct.content_raw_sha256 !== savedAct.content_raw_sha256) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Saved acts have persistence metadata
   * Requirements: 1.2, 3.5
   */
  it('should include persistence metadata when saving', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Save the act
          const savedAct = await StorageManager.saveActToIndexedDB(act);
          
          // Verify persistence metadata exists
          if (!savedAct._persistence) return false;
          if (savedAct._persistence.storage_backend !== 'indexeddb') return false;
          if (!savedAct._persistence.persisted_at) return false;
          if (!savedAct._persistence.schema_version) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Overwriting an act preserves the new content
   * Requirements: 3.5
   */
  it('should overwrite existing act with new content', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        contentRawGen,
        async (act, newContent) => {
          // Save the original act
          await StorageManager.saveActToIndexedDB(act);
          
          // Create updated act with same act_number but different content
          const updatedAct = {
            ...act,
            content_raw: newContent,
            title: 'Updated Title'
          };
          
          // Save the updated act
          await StorageManager.saveActToIndexedDB(updatedAct);
          
          // Load and verify new content
          const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number);
          if (!loadedAct) return false;
          if (loadedAct.content_raw !== newContent) return false;
          if (loadedAct.title !== 'Updated Title') return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Act number is trimmed on save and lookup
   * Requirements: 3.5
   */
  it('should trim act_number on save and lookup', async () => {
    await fc.assert(
      fc.asyncProperty(
        actGen,
        async (act) => {
          // Add whitespace to act_number
          const actWithWhitespace = {
            ...act,
            act_number: '  ' + act.act_number + '  '
          };
          
          // Save the act
          await StorageManager.saveActToIndexedDB(actWithWhitespace);
          
          // Load with trimmed act_number
          const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number);
          if (!loadedAct) return false;
          
          // Verify act_number is trimmed
          if (loadedAct.act_number !== act.act_number.trim()) return false;
          
          // Load with whitespace should also work
          const loadedWithWhitespace = await StorageManager.loadActFromIndexedDB('  ' + act.act_number + '  ');
          if (!loadedWithWhitespace) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
