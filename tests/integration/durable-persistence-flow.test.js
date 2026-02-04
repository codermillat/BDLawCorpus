/**
 * Integration Tests for Durable Persistence Hardening
 * 
 * Tests the complete extraction flow with durable persistence including:
 * - Full extraction flow with receipt generation
 * - Queue reconstruction from receipts
 * - Lifecycle recovery (side panel close/reopen)
 * - Fallback chain behavior
 * 
 * Requirements: All durable persistence hardening requirements
 */

const {
  StorageManager,
  StorageError,
  StorageErrorType,
  ExtractionReceipt,
  ChromeStorageBackend,
  MemoryBackend,
  QueueReconstructor,
  ExportCheckpointManager,
  ExportProgressTracker,
  MigrationManager,
  classifyStorageError,
  createStorageError
} = require('../../bdlaw-storage.js');

// Mock IndexedDB for Node.js testing environment
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

// Set up global IndexedDB mock
global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;

// Mock crypto for Node.js
const crypto = require('crypto');
global.crypto = {
  randomUUID: () => crypto.randomUUID(),
  subtle: {
    digest: async (algorithm, data) => {
      const hash = crypto.createHash('sha256');
      hash.update(Buffer.from(data));
      return hash.digest();
    }
  }
};

// Mock chrome.storage for testing
const mockChromeStorage = {
  _data: {},
  local: {
    get: jest.fn((keys, callback) => {
      const result = {};
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach(key => {
        if (mockChromeStorage._data[key] !== undefined) {
          result[key] = mockChromeStorage._data[key];
        }
      });
      if (callback) callback(result);
      return Promise.resolve(result);
    }),
    set: jest.fn((items, callback) => {
      Object.assign(mockChromeStorage._data, items);
      if (callback) callback();
      return Promise.resolve();
    }),
    remove: jest.fn((keys, callback) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach(key => {
        delete mockChromeStorage._data[key];
      });
      if (callback) callback();
      return Promise.resolve();
    }),
    getBytesInUse: jest.fn((keys, callback) => {
      const size = JSON.stringify(mockChromeStorage._data).length;
      if (callback) callback(size);
      return Promise.resolve(size);
    }),
    QUOTA_BYTES: 10 * 1024 * 1024
  },
  runtime: {
    lastError: null
  }
};

global.chrome = mockChromeStorage;

describe('Durable Persistence Integration Tests', () => {
  
  beforeEach(async () => {
    // Reset all storage state before each test
    mockChromeStorage._data = {};
    mockChromeStorage.runtime.lastError = null;
    
    // Close existing database connection
    if (StorageManager._db) {
      StorageManager.closeDatabase();
    }
    
    // Delete the IndexedDB database to ensure clean state
    await new Promise((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase('BDLawCorpusDB');
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => resolve();
      deleteRequest.onblocked = () => resolve();
    });
    
    // Reset StorageManager state
    StorageManager._activeBackend = null;
    StorageManager._db = null;
    StorageManager._sessionId = null;
    StorageManager._memoryStore = {
      acts: new Map(),
      receipts: [],
      wal: [],
      audit_log: []
    };
    
    // Reset MemoryBackend
    MemoryBackend._acts.clear();
    MemoryBackend._receipts = [];
    MemoryBackend._wal = [];
    MemoryBackend._auditLog = [];
    MemoryBackend._volatilityWarningShown = false;
    
    // Reset managers
    ExportCheckpointManager.clearCache();
    ExportProgressTracker.clearCache();
    MigrationManager.clearCache();
  });

  afterEach(async () => {
    // Clean up IndexedDB
    if (StorageManager._db) {
      StorageManager.closeDatabase();
    }
  });

  describe('20.1 Full Extraction Flow Test', () => {
    /**
     * Test: Extract 10+ acts and verify all receipts generated
     * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6
     */
    it('should extract 10+ acts with receipts generated for each', async () => {
      // Initialize StorageManager with IndexedDB
      const initResult = await StorageManager.initialize();
      expect(initResult.backend).toBe('indexeddb');
      
      // Generate 12 test acts
      const testActs = [];
      for (let i = 1; i <= 12; i++) {
        testActs.push({
          act_number: `${1000 + i}`,
          title: `Test Act ${i} - বাংলাদেশ আইন ${i}`,
          content_raw: `This is the content of test act ${i}. ধারা ${i}। এই আইনের বিধান অনুযায়ী।`,
          url: `http://bdlaws.minlaw.gov.bd/act-details-${1000 + i}.html`,
          volume_number: '56',
          capturedAt: new Date().toISOString()
        });
      }
      
      // Extract each act and verify receipt generation
      const receipts = [];
      for (const act of testActs) {
        // Log intent before extraction (Requirements: 6.1)
        await StorageManager.logIntent(act.act_number);
        
        // Save act with atomic persistence (Requirements: 1.1, 1.2)
        const receipt = await StorageManager.saveAct(act);
        
        // Log completion after extraction (Requirements: 6.2)
        await StorageManager.logComplete(act.act_number, receipt.content_raw_sha256);
        
        receipts.push(receipt);
        
        // Verify receipt has all required fields (Requirements: 1.4)
        expect(receipt.receipt_id).toBeDefined();
        expect(receipt.act_id).toBe(act.act_number);
        expect(receipt.content_raw_sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(receipt.storage_backend).toBe('indexeddb');
        expect(receipt.persisted_at).toBeDefined();
        expect(receipt.schema_version).toBeDefined();
      }
      
      // Verify all 12 receipts were generated
      expect(receipts.length).toBe(12);
      
      // Verify receipts can be retrieved (Requirements: 1.5, 1.6)
      const allReceipts = await StorageManager.getReceipts();
      expect(allReceipts.length).toBe(12);
      
      // Verify each act can be loaded back
      for (const act of testActs) {
        const loadedAct = await StorageManager.loadActFromIndexedDB(act.act_number);
        expect(loadedAct).not.toBeNull();
        expect(loadedAct.act_number).toBe(act.act_number);
        expect(loadedAct.content_raw).toBe(act.content_raw);
        expect(loadedAct.content_raw_sha256).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    /**
     * Test: Queue reconstruction works correctly
     * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6
     */
    it('should reconstruct queue state from receipts', async () => {
      // Initialize StorageManager
      await StorageManager.initialize();
      
      // Create queue items (simulating items added to queue)
      const queueItems = [
        { actNumber: '1001', status: 'completed', id: 'q1' },
        { actNumber: '1002', status: 'completed', id: 'q2' },
        { actNumber: '1003', status: 'pending', id: 'q3' },
        { actNumber: '1004', status: 'pending', id: 'q4' },
        { actNumber: '1005', status: 'completed', id: 'q5' }, // No receipt - discrepancy
      ];
      
      // Save some acts (creating receipts for 1001, 1002 only)
      const act1 = {
        act_number: '1001',
        content_raw: 'Content for act 1001',
        title: 'Act 1001'
      };
      const act2 = {
        act_number: '1002',
        content_raw: 'Content for act 1002',
        title: 'Act 1002'
      };
      
      await StorageManager.saveAct(act1);
      await StorageManager.saveAct(act2);
      
      // Get receipts
      const receipts = await StorageManager.getReceipts();
      expect(receipts.length).toBe(2);
      
      // Reconstruct queue state
      const reconstructed = QueueReconstructor.reconstructState(queueItems, receipts);
      
      // Verify pending count (Requirements: 4.1)
      // Total queued (5) - extracted (2) = 3 pending
      expect(reconstructed.pending.length).toBe(3);
      
      // Verify completed list from receipts (Requirements: 4.4)
      expect(reconstructed.completed).toContain('1001');
      expect(reconstructed.completed).toContain('1002');
      expect(reconstructed.completed.length).toBe(2);
      
      // Verify discrepancy detected (Requirements: 4.5, 4.6)
      // Item 1005 is marked completed but has no receipt
      expect(reconstructed.discrepancies.length).toBe(1);
      expect(reconstructed.discrepancies[0].actNumber).toBe('1005');
      expect(reconstructed.discrepancies[0].issue).toBe('marked_complete_no_receipt');
      
      // Verify stats
      expect(reconstructed.stats.totalQueued).toBe(5);
      expect(reconstructed.stats.totalExtracted).toBe(2);
      expect(reconstructed.stats.pendingCount).toBe(3);
      expect(reconstructed.stats.discrepancyCount).toBe(1);
    });

    /**
     * Test: Content hash verification on load
     * Requirements: 11.1, 11.2, 11.3
     */
    it('should verify content hash when loading acts', async () => {
      // Initialize StorageManager
      await StorageManager.initialize();
      
      // Save an act
      const act = {
        act_number: '2001',
        content_raw: 'Original content for verification test',
        title: 'Verification Test Act'
      };
      
      const receipt = await StorageManager.saveAct(act);
      const originalHash = receipt.content_raw_sha256;
      
      // Load the act back
      const loadedAct = await StorageManager.loadActFromIndexedDB('2001');
      
      // Verify integrity check passed
      expect(loadedAct._persistence.integrity_verified).toBe(true);
      expect(loadedAct._persistence.potentially_corrupted).toBe(false);
      expect(loadedAct.content_raw_sha256).toBe(originalHash);
    });

    /**
     * Test: Write-ahead log tracks extraction intent and completion
     * Requirements: 6.1, 6.2, 6.3
     */
    it('should track extraction intent and completion in WAL', async () => {
      // Initialize StorageManager
      await StorageManager.initialize();
      
      // Log intent for an extraction
      const intentEntry = await StorageManager.logIntent('3001');
      expect(intentEntry.entry_type).toBe('intent');
      expect(intentEntry.act_id).toBe('3001');
      
      // Save the act
      const act = {
        act_number: '3001',
        content_raw: 'Content for WAL test',
        title: 'WAL Test Act'
      };
      const receipt = await StorageManager.saveAct(act);
      
      // Log completion
      await StorageManager.logComplete('3001', receipt.content_raw_sha256);
      
      // Verify no incomplete extractions
      const incomplete = await StorageManager.getIncompleteExtractions();
      expect(incomplete.length).toBe(0);
      
      // Now test incomplete extraction detection
      await StorageManager.logIntent('3002');
      // Don't complete this one
      
      const incompleteAfter = await StorageManager.getIncompleteExtractions();
      expect(incompleteAfter.length).toBe(1);
      expect(incompleteAfter[0].actId).toBe('3002');
    });

    /**
     * Test: Audit log records all operations
     * Requirements: 9.1, 9.2, 9.3, 9.4
     */
    it('should maintain audit log of operations', async () => {
      // Initialize StorageManager
      await StorageManager.initialize();
      
      // Log some audit entries
      await StorageManager.logAuditEntry({
        operation: 'extraction_start',
        actId: '4001',
        context: { source: 'test' }
      });
      
      await StorageManager.logAuditEntry({
        operation: 'extraction_complete',
        actId: '4001',
        outcome: 'success',
        contentHash: 'abc123'
      });
      
      await StorageManager.logAuditEntry({
        operation: 'write_success',
        actId: '4001',
        storageLocation: 'indexeddb'
      });
      
      // Get audit log
      const auditLog = await StorageManager.getAuditLog();
      expect(auditLog.length).toBe(3);
      
      // Verify entries have required fields
      for (const entry of auditLog) {
        expect(entry.log_id).toBeDefined();
        expect(entry.timestamp).toBeDefined();
        expect(entry.operation).toBeDefined();
      }
      
      // Test filtering by operation
      const extractionEntries = await StorageManager.getAuditLog({ operation: 'extraction_start' });
      expect(extractionEntries.length).toBe(1);
      expect(extractionEntries[0].actId).toBe('4001');
    });
  });


  describe('20.2 Lifecycle Recovery Test', () => {
    /**
     * Test: Processing status reset on reload
     * Requirements: 5.6
     */
    it('should reset processing items to pending on reload', async () => {
      // Create queue items with some in 'processing' status
      const queueItems = [
        { actNumber: '5001', status: 'pending', id: 'q1' },
        { actNumber: '5002', status: 'processing', id: 'q2' },
        { actNumber: '5003', status: 'processing', id: 'q3' },
        { actNumber: '5004', status: 'completed', id: 'q4' },
      ];
      
      // Reset processing status (simulating reload)
      const resetResult = QueueReconstructor.resetProcessingStatus(queueItems);
      
      // Verify no items have 'processing' status
      const processingItems = resetResult.items.filter(item => item.status === 'processing');
      expect(processingItems.length).toBe(0);
      
      // Verify reset count
      expect(resetResult.resetCount).toBe(2);
      
      // Verify items that were processing are now pending
      const item2 = resetResult.items.find(item => item.actNumber === '5002');
      const item3 = resetResult.items.find(item => item.actNumber === '5003');
      expect(item2.status).toBe('pending');
      expect(item3.status).toBe('pending');
      expect(item2._resetFromProcessing).toBe(true);
      expect(item3._resetFromProcessing).toBe(true);
      
      // Verify other items unchanged
      const item1 = resetResult.items.find(item => item.actNumber === '5001');
      const item4 = resetResult.items.find(item => item.actNumber === '5004');
      expect(item1.status).toBe('pending');
      expect(item4.status).toBe('completed');
    });

    /**
     * Test: Full reconstruction combines reset and state derivation
     * Requirements: 4.1, 4.3, 5.6
     */
    it('should perform full reconstruction with reset and state derivation', async () => {
      // Initialize StorageManager
      await StorageManager.initialize();
      
      // Save some acts to create receipts
      await StorageManager.saveAct({
        act_number: '6001',
        content_raw: 'Content 6001',
        title: 'Act 6001'
      });
      await StorageManager.saveAct({
        act_number: '6002',
        content_raw: 'Content 6002',
        title: 'Act 6002'
      });
      
      const receipts = await StorageManager.getReceipts();
      
      // Create queue items with mixed statuses
      const queueItems = [
        { actNumber: '6001', status: 'completed', id: 'q1' },
        { actNumber: '6002', status: 'processing', id: 'q2' }, // Should be reset
        { actNumber: '6003', status: 'pending', id: 'q3' },
        { actNumber: '6004', status: 'processing', id: 'q4' }, // Should be reset
      ];
      
      // Perform full reconstruction
      const result = QueueReconstructor.fullReconstruction(queueItems, receipts);
      
      // Verify reset happened
      expect(result.stats.resetCount).toBe(2);
      
      // Verify pending items (6003, 6004 after reset, 6002 after reset)
      // 6001 and 6002 have receipts, so only 6003 and 6004 are pending
      expect(result.pending.length).toBe(2);
      
      // Verify completed from receipts
      expect(result.completed).toContain('6001');
      expect(result.completed).toContain('6002');
    });

    /**
     * Test: State recovery after simulated side panel close
     * Requirements: 5.1, 5.2, 5.3
     */
    it('should recover state after side panel close simulation', async () => {
      // Initialize StorageManager
      await StorageManager.initialize();
      
      // Simulate extraction in progress
      const act = {
        act_number: '7001',
        content_raw: 'Content for recovery test',
        title: 'Recovery Test Act'
      };
      
      // Log intent (extraction started)
      await StorageManager.logIntent('7001');
      
      // Save the act
      await StorageManager.saveAct(act);
      
      // Log completion
      await StorageManager.logComplete('7001', (await StorageManager.getReceipts())[0].content_raw_sha256);
      
      // Simulate another extraction that was interrupted
      await StorageManager.logIntent('7002');
      // Don't complete this one - simulates crash
      
      // "Reopen" - check for incomplete extractions
      const incomplete = await StorageManager.getIncompleteExtractions();
      
      // Should find the incomplete extraction
      expect(incomplete.length).toBe(1);
      expect(incomplete[0].actId).toBe('7002');
      
      // Verify completed extraction is still there
      const receipts = await StorageManager.getReceipts();
      expect(receipts.length).toBe(1);
      expect(receipts[0].act_id).toBe('7001');
    });
  });

  describe('20.3 Fallback Chain Test', () => {
    /**
     * Test: Memory backend fallback works correctly
     * Requirements: 10.2, 10.7
     */
    it('should fall back to memory backend when IndexedDB unavailable', async () => {
      // Temporarily disable IndexedDB
      const originalIndexedDB = global.indexedDB;
      global.indexedDB = undefined;
      
      // Reset StorageManager
      StorageManager._activeBackend = null;
      StorageManager._db = null;
      
      try {
        // Initialize - should fall back to memory
        const initResult = await StorageManager.initialize();
        
        // Should be using memory backend
        expect(initResult.backend).toBe('memory');
        expect(initResult.degraded).toBe(true);
        
        // Verify we can still save and load acts
        const act = {
          act_number: '8001',
          content_raw: 'Content for memory backend test',
          title: 'Memory Backend Test Act'
        };
        
        const receipt = await StorageManager.saveAct(act);
        expect(receipt.storage_backend).toBe('memory');
        
        // Verify receipt was saved
        const receipts = await StorageManager.getReceipts();
        expect(receipts.length).toBe(1);
        
      } finally {
        // Restore IndexedDB
        global.indexedDB = originalIndexedDB;
      }
    });

    /**
     * Test: Backend priority order is correct
     * Requirements: 10.7
     */
    it('should attempt backends in correct priority order', () => {
      // Verify backend priority order
      expect(StorageManager.BACKEND_PRIORITY).toEqual(['indexeddb', 'chrome_storage', 'memory']);
    });

    /**
     * Test: Degraded mode detection
     * Requirements: 10.4
     */
    it('should detect degraded mode when not using IndexedDB', async () => {
      // Initialize with IndexedDB
      await StorageManager.initialize();
      
      // Should not be in degraded mode
      expect(StorageManager.isDegradedMode()).toBe(false);
      
      // Manually set to memory backend
      StorageManager._activeBackend = 'memory';
      
      // Should be in degraded mode
      expect(StorageManager.isDegradedMode()).toBe(true);
      
      // Set to chrome_storage
      StorageManager._activeBackend = 'chrome_storage';
      
      // Should still be in degraded mode
      expect(StorageManager.isDegradedMode()).toBe(true);
    });

    /**
     * Test: Storage status reporting
     * Requirements: 2.1, 2.4
     */
    it('should report storage status correctly', async () => {
      // Initialize StorageManager
      await StorageManager.initialize();
      
      // Get storage status
      const status = await StorageManager.getStorageStatus();
      
      // Verify status has required fields
      expect(status.backend).toBe('indexeddb');
      expect(typeof status.usageBytes).toBe('number');
      expect(typeof status.quotaBytes).toBe('number');
      expect(typeof status.usagePercent).toBe('number');
      expect(typeof status.isWarning).toBe('boolean');
      expect(typeof status.isCritical).toBe('boolean');
      expect(typeof status.isHealthy).toBe('boolean');
    });
  });

  describe('Export Checkpoint and Progress', () => {
    /**
     * Test: Export checkpoint threshold configuration
     * Requirements: 8.7
     */
    it('should clamp export threshold to valid range', async () => {
      // Test below minimum
      const result1 = await ExportCheckpointManager.setThreshold(5);
      expect(result1.threshold).toBe(10); // Clamped to minimum
      expect(result1.clamped).toBe(true);
      
      // Test above maximum
      const result2 = await ExportCheckpointManager.setThreshold(300);
      expect(result2.threshold).toBe(200); // Clamped to maximum
      expect(result2.clamped).toBe(true);
      
      // Test valid value
      const result3 = await ExportCheckpointManager.setThreshold(75);
      expect(result3.threshold).toBe(75);
      expect(result3.clamped).toBe(false);
    });

    /**
     * Test: Export checkpoint triggering
     * Requirements: 8.1, 8.2, 8.3
     */
    it('should trigger export prompt after threshold reached', async () => {
      // Reset state
      await ExportCheckpointManager.reset();
      
      // Set low threshold for testing
      await ExportCheckpointManager.setThreshold(10);
      
      // Record extractions
      for (let i = 0; i < 9; i++) {
        const result = await ExportCheckpointManager.recordExtraction();
        expect(result.should_prompt).toBe(false);
      }
      
      // 10th extraction should trigger prompt
      const result = await ExportCheckpointManager.recordExtraction();
      expect(result.should_prompt).toBe(true);
      expect(result.acts_since_export).toBe(10);
    });

    /**
     * Test: Export progress tracking
     * Requirements: 12.1, 12.2
     */
    it('should track export progress per act', async () => {
      // Reset state
      await ExportProgressTracker.reset();
      
      // Start export with 5 acts
      const actIds = ['9001', '9002', '9003', '9004', '9005'];
      const startResult = await ExportProgressTracker.startExport(actIds);
      
      expect(startResult.export_id).toBeDefined();
      expect(startResult.total_acts).toBe(5);
      expect(startResult.status).toBe('in_progress');
      
      // Record progress
      const progress1 = await ExportProgressTracker.recordActExported('9001');
      expect(progress1.current_index).toBe(1);
      expect(progress1.progress_percent).toBe(20);
      
      const progress2 = await ExportProgressTracker.recordActExported('9002');
      expect(progress2.current_index).toBe(2);
      expect(progress2.progress_percent).toBe(40);
      
      // Check for interrupted export
      const interruptCheck = await ExportProgressTracker.checkForInterruptedExport();
      expect(interruptCheck.can_resume).toBe(true);
      expect(interruptCheck.remaining_count).toBe(3);
    });

    /**
     * Test: Export rate limiting
     * Requirements: 12.5
     */
    it('should enforce rate limit between downloads', async () => {
      // Reset state
      await ExportProgressTracker.reset();
      
      // Set rate limit
      const setResult = await ExportProgressTracker.setRateLimit(100);
      expect(setResult.rate_limit_ms).toBe(100);
      
      // Verify rate limit is applied
      const rateLimit = await ExportProgressTracker.getRateLimit();
      expect(rateLimit).toBe(100);
      
      // Test rate limit clamping (50 is below minimum of 100)
      const clampedResult = await ExportProgressTracker.setRateLimit(50);
      expect(clampedResult.rate_limit_ms).toBe(100); // Clamped to minimum
      expect(clampedResult.clamped).toBe(true);
    });
  });

  describe('Error Classification', () => {
    /**
     * Test: Error classification accuracy
     * Requirements: 7.3, 7.4
     */
    it('should classify storage errors correctly', () => {
      // Quota exceeded
      const quotaError = new Error('QuotaExceededError: Storage quota exceeded');
      expect(classifyStorageError(quotaError)).toBe(StorageErrorType.QUOTA_EXCEEDED);
      
      // Permission denied
      const permissionError = new Error('Permission denied to access storage');
      expect(classifyStorageError(permissionError)).toBe(StorageErrorType.PERMISSION_DENIED);
      
      // Backend unavailable
      const unavailableError = new Error('IndexedDB is not available');
      expect(classifyStorageError(unavailableError)).toBe(StorageErrorType.BACKEND_UNAVAILABLE);
      
      // Transaction failed
      const transactionError = new Error('Transaction aborted');
      expect(classifyStorageError(transactionError)).toBe(StorageErrorType.TRANSACTION_FAILED);
      
      // Integrity error
      const integrityError = new Error('Content hash mismatch detected');
      expect(classifyStorageError(integrityError)).toBe(StorageErrorType.INTEGRITY_ERROR);
      
      // Unknown error
      const unknownError = new Error('Something went wrong');
      expect(classifyStorageError(unknownError)).toBe(StorageErrorType.UNKNOWN_ERROR);
    });

    /**
     * Test: StorageError creation with context
     * Requirements: 7.4
     */
    it('should create StorageError with full context', () => {
      const originalError = new Error('Test error');
      const context = { operation: 'saveAct', actNumber: '1234' };
      
      const storageError = createStorageError(originalError, context);
      
      expect(storageError).toBeInstanceOf(StorageError);
      expect(storageError.type).toBe(StorageErrorType.UNKNOWN_ERROR);
      expect(storageError.details.operation).toBe('saveAct');
      expect(storageError.details.actNumber).toBe('1234');
      expect(storageError.details.originalMessage).toBe('Test error');
      expect(storageError.timestamp).toBeDefined();
    });
  });
});
