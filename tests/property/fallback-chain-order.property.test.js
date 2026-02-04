/**
 * Property-Based Tests for Fallback Chain Order
 * 
 * Feature: durable-persistence-hardening, Property 9: Fallback Chain Order
 * Validates: Requirements 3.7, 10.1, 10.2, 10.7
 * 
 * For any initialization sequence, the system SHALL attempt backends in order:
 * IndexedDB first, then chrome.storage.local if IndexedDB fails, then memory
 * if chrome.storage.local fails. The active backend SHALL be the first available
 * backend in this order.
 */

const fc = require('fast-check');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

const {
  StorageManager,
  StorageError,
  StorageErrorType,
  MemoryBackend,
  ChromeStorageBackend
} = require('../../bdlaw-storage.js');

describe('Property 9: Fallback Chain Order', () => {
  // Store original globals to restore after tests
  let originalIndexedDB;
  let originalChrome;
  
  beforeEach(() => {
    // Store original globals
    originalIndexedDB = global.indexedDB;
    originalChrome = global.chrome;
    
    // Reset StorageManager state
    StorageManager._db = null;
    StorageManager._activeBackend = null;
    
    // Reset MemoryBackend state
    MemoryBackend.clear();
    MemoryBackend.resetWarningFlag();
  });

  afterEach(() => {
    // Close database connection if open
    StorageManager.closeDatabase();
    
    // Restore original globals
    if (originalIndexedDB !== undefined) {
      global.indexedDB = originalIndexedDB;
    } else {
      delete global.indexedDB;
    }
    
    if (originalChrome !== undefined) {
      global.chrome = originalChrome;
    } else {
      delete global.chrome;
    }
    
    // Reset StorageManager state
    StorageManager._db = null;
    StorageManager._activeBackend = null;
  });

  /**
   * Helper to create a mock chrome.storage.local
   */
  function createMockChromeStorage() {
    const storage = {};
    return {
      storage: {
        local: {
          get: (keys, callback) => {
            const result = {};
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach(key => {
              if (storage[key] !== undefined) {
                result[key] = storage[key];
              }
            });
            callback(result);
          },
          set: (items, callback) => {
            Object.assign(storage, items);
            callback();
          },
          remove: (keys, callback) => {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach(key => delete storage[key]);
            callback();
          },
          getBytesInUse: (keys, callback) => {
            callback(JSON.stringify(storage).length);
          },
          QUOTA_BYTES: 10 * 1024 * 1024
        }
      },
      runtime: {
        lastError: null
      }
    };
  }

  /**
   * Property: When IndexedDB is available, it is selected as the active backend
   * Requirements: 3.2, 10.7
   */
  it('should select IndexedDB when available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No input needed, just run the test
        async () => {
          // Setup: Make IndexedDB available
          global.indexedDB = new FDBFactory();
          delete global.chrome; // Ensure chrome.storage is not available
          
          // Initialize StorageManager
          const result = await StorageManager.initialize();
          
          // Verify IndexedDB was selected
          if (result.backend !== 'indexeddb') return false;
          if (StorageManager.getActiveBackend() !== 'indexeddb') return false;
          if (result.degraded !== false) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When IndexedDB is unavailable but chrome.storage is available,
   * chrome.storage is selected as the active backend
   * Requirements: 10.1, 10.7
   */
  it('should fall back to chrome.storage when IndexedDB is unavailable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Setup: Make IndexedDB unavailable, chrome.storage available
          delete global.indexedDB;
          global.chrome = createMockChromeStorage();
          
          // Initialize StorageManager
          const result = await StorageManager.initialize();
          
          // Verify chrome.storage was selected
          if (result.backend !== 'chrome_storage') return false;
          if (StorageManager.getActiveBackend() !== 'chrome_storage') return false;
          if (result.degraded !== true) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When both IndexedDB and chrome.storage are unavailable,
   * memory backend is selected as the active backend
   * Requirements: 10.2, 10.7
   */
  it('should fall back to memory when IndexedDB and chrome.storage are unavailable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Setup: Make both IndexedDB and chrome.storage unavailable
          delete global.indexedDB;
          delete global.chrome;
          
          // Initialize StorageManager
          const result = await StorageManager.initialize();
          
          // Verify memory was selected
          if (result.backend !== 'memory') return false;
          if (StorageManager.getActiveBackend() !== 'memory') return false;
          if (result.degraded !== true) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Backend priority order is always IndexedDB > chrome.storage > memory
   * Requirements: 10.7
   */
  it('should maintain backend priority order: indexeddb > chrome_storage > memory', async () => {
    // Verify the BACKEND_PRIORITY constant is correct
    const expectedOrder = ['indexeddb', 'chrome_storage', 'memory'];
    
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Verify priority order matches expected
          if (StorageManager.BACKEND_PRIORITY.length !== expectedOrder.length) return false;
          
          for (let i = 0; i < expectedOrder.length; i++) {
            if (StorageManager.BACKEND_PRIORITY[i] !== expectedOrder[i]) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: IndexedDB is preferred over chrome.storage when both are available
   * Requirements: 3.2, 10.7
   */
  it('should prefer IndexedDB over chrome.storage when both are available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Setup: Make both IndexedDB and chrome.storage available
          global.indexedDB = new FDBFactory();
          global.chrome = createMockChromeStorage();
          
          // Initialize StorageManager
          const result = await StorageManager.initialize();
          
          // Verify IndexedDB was selected (not chrome.storage)
          if (result.backend !== 'indexeddb') return false;
          if (StorageManager.getActiveBackend() !== 'indexeddb') return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: chrome.storage is preferred over memory when IndexedDB is unavailable
   * Requirements: 10.1, 10.7
   */
  it('should prefer chrome.storage over memory when IndexedDB is unavailable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Setup: Make IndexedDB unavailable, chrome.storage available
          delete global.indexedDB;
          global.chrome = createMockChromeStorage();
          
          // Initialize StorageManager
          const result = await StorageManager.initialize();
          
          // Verify chrome.storage was selected (not memory)
          if (result.backend !== 'chrome_storage') return false;
          if (StorageManager.getActiveBackend() !== 'chrome_storage') return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Degraded mode is true when not using IndexedDB
   * Requirements: 10.4
   */
  it('should report degraded mode when not using IndexedDB', async () => {
    // Generator for backend availability scenarios (excluding IndexedDB-available)
    const degradedScenarioGen = fc.constantFrom(
      { indexedDB: false, chrome: true },  // chrome.storage only
      { indexedDB: false, chrome: false }  // memory only
    );

    await fc.assert(
      fc.asyncProperty(
        degradedScenarioGen,
        async (scenario) => {
          // Setup based on scenario
          if (scenario.indexedDB) {
            global.indexedDB = new FDBFactory();
          } else {
            delete global.indexedDB;
          }
          
          if (scenario.chrome) {
            global.chrome = createMockChromeStorage();
          } else {
            delete global.chrome;
          }
          
          // Initialize StorageManager
          const result = await StorageManager.initialize();
          
          // Verify degraded mode is true when not using IndexedDB
          if (result.backend === 'indexeddb') {
            // Should not happen in this test
            return false;
          }
          
          if (result.degraded !== true) return false;
          if (StorageManager.isDegradedMode() !== true) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-degraded mode when using IndexedDB
   * Requirements: 3.2
   */
  it('should report non-degraded mode when using IndexedDB', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Setup: Make IndexedDB available
          global.indexedDB = new FDBFactory();
          
          // Initialize StorageManager
          const result = await StorageManager.initialize();
          
          // Verify not in degraded mode
          if (result.backend !== 'indexeddb') return false;
          if (result.degraded !== false) return false;
          if (StorageManager.isDegradedMode() !== false) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Memory backend is always available as ultimate fallback
   * Requirements: 10.2
   */
  it('should always have memory backend available as ultimate fallback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Verify MemoryBackend.isAvailable() always returns true
          if (MemoryBackend.isAvailable() !== true) return false;
          
          // Setup: Make all other backends unavailable
          delete global.indexedDB;
          delete global.chrome;
          
          // Initialize should succeed with memory backend
          try {
            const result = await StorageManager.initialize();
            if (result.backend !== 'memory') return false;
          } catch (e) {
            // Should not throw - memory is always available
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Initialization returns consistent backend information
   * Requirements: 10.3
   */
  it('should return consistent backend information after initialization', async () => {
    // Generator for all possible backend availability scenarios
    const scenarioGen = fc.constantFrom(
      { indexedDB: true, chrome: true },   // All available
      { indexedDB: true, chrome: false },  // IndexedDB only
      { indexedDB: false, chrome: true },  // chrome.storage only
      { indexedDB: false, chrome: false }  // memory only
    );

    await fc.assert(
      fc.asyncProperty(
        scenarioGen,
        async (scenario) => {
          // Setup based on scenario
          if (scenario.indexedDB) {
            global.indexedDB = new FDBFactory();
          } else {
            delete global.indexedDB;
          }
          
          if (scenario.chrome) {
            global.chrome = createMockChromeStorage();
          } else {
            delete global.chrome;
          }
          
          // Initialize StorageManager
          const result = await StorageManager.initialize();
          
          // Verify consistency between result and getActiveBackend()
          if (result.backend !== StorageManager.getActiveBackend()) return false;
          
          // Verify degraded flag is consistent
          const expectedDegraded = result.backend !== 'indexeddb';
          if (result.degraded !== expectedDegraded) return false;
          if (StorageManager.isDegradedMode() !== expectedDegraded) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: First available backend in priority order is selected
   * Requirements: 10.7
   */
  it('should select the first available backend in priority order', async () => {
    // Generator for all possible backend availability scenarios with expected result
    const scenarioGen = fc.constantFrom(
      { indexedDB: true, chrome: true, expected: 'indexeddb' },
      { indexedDB: true, chrome: false, expected: 'indexeddb' },
      { indexedDB: false, chrome: true, expected: 'chrome_storage' },
      { indexedDB: false, chrome: false, expected: 'memory' }
    );

    await fc.assert(
      fc.asyncProperty(
        scenarioGen,
        async (scenario) => {
          // Setup based on scenario
          if (scenario.indexedDB) {
            global.indexedDB = new FDBFactory();
          } else {
            delete global.indexedDB;
          }
          
          if (scenario.chrome) {
            global.chrome = createMockChromeStorage();
          } else {
            delete global.chrome;
          }
          
          // Initialize StorageManager
          const result = await StorageManager.initialize();
          
          // Verify the expected backend was selected
          if (result.backend !== scenario.expected) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
