/**
 * Property-Based Tests for Audit Log Entry Completeness
 * 
 * Feature: durable-persistence-hardening, Property 17: Audit Log Entry Completeness
 * Validates: Requirements 9.2, 9.3
 * 
 * For any entry in the audit log, it SHALL contain: log_id, timestamp (valid ISO-8601),
 * operation (one of defined operation types), and appropriate context fields based on
 * operation type.
 */

const fc = require('fast-check');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

const {
  StorageManager,
  StorageError,
  StorageErrorType,
  MemoryBackend
} = require('../../bdlaw-storage.js');

describe('Property 17: Audit Log Entry Completeness', () => {
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
    StorageManager._memoryStore.audit_log = [];
    
    // Reset MemoryBackend state
    MemoryBackend._auditLog = [];
    MemoryBackend._volatilityWarningShown = false;
    
    // Initialize with fake IndexedDB
    await StorageManager.initialize();
  });

  afterEach(() => {
    // Close database connection
    StorageManager.closeDatabase();
    
    // Clean up global
    delete global.indexedDB;
  });

  // Generator for valid audit operations
  const auditOperationGen = fc.constantFrom(
    'write_attempt',
    'write_success',
    'write_failure',
    'read_attempt',
    'read_success',
    'read_failure',
    'extraction_start',
    'extraction_complete',
    'extraction_failure',
    'migration_start',
    'migration_complete',
    'migration_failure',
    'export_start',
    'export_complete',
    'export_failure',
    'integrity_check',
    'integrity_failure',
    'quota_warning',
    'quota_critical',
    'backend_switch',
    'state_reconstruction'
  );

  // Generator for act IDs
  const actIdGen = fc.stringOf(
    fc.constantFrom(...'0123456789'),
    { minLength: 1, maxLength: 6 }
  );

  // Generator for outcomes
  const outcomeGen = fc.constantFrom('success', 'failure', 'partial', null);

  // Generator for content hashes (64 hex characters)
  const contentHashGen = fc.hexaString({ minLength: 64, maxLength: 64 });

  // Generator for valid audit entries
  const auditEntryGen = fc.record({
    operation: auditOperationGen,
    actId: fc.option(actIdGen, { nil: null }),
    outcome: outcomeGen,
    contentHash: fc.option(contentHashGen, { nil: null }),
    context: fc.record({
      message: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
      errorCode: fc.option(fc.integer({ min: 0, max: 999 }), { nil: undefined }),
      bytesWritten: fc.option(fc.integer({ min: 0, max: 1000000 }), { nil: undefined })
    })
  });

  // Generator for arrays of audit entries
  const auditEntryArrayGen = fc.array(auditEntryGen, { minLength: 1, maxLength: 10 });

  /**
   * Helper function to validate ISO-8601 timestamp
   */
  function isValidISO8601(timestamp) {
    if (!timestamp || typeof timestamp !== 'string') return false;
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && timestamp.includes('T');
  }


  /**
   * Property: Every audit entry has a valid log_id
   * Requirements: 9.2
   */
  it('should assign a valid log_id to every entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryArrayGen,
        async (entries) => {
          for (const entry of entries) {
            const savedEntry = await StorageManager.logAuditEntry(entry);
            
            // log_id must exist and be a positive number
            if (savedEntry.log_id === undefined || 
                savedEntry.log_id === null ||
                typeof savedEntry.log_id !== 'number' ||
                savedEntry.log_id <= 0) {
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
   * Property: Every audit entry has a valid ISO-8601 timestamp
   * Requirements: 9.2
   */
  it('should have valid ISO-8601 timestamp on every entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryArrayGen,
        async (entries) => {
          for (const entry of entries) {
            const savedEntry = await StorageManager.logAuditEntry(entry);
            
            // timestamp must be a valid ISO-8601 string
            if (!isValidISO8601(savedEntry.timestamp)) {
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
   * Property: Every audit entry has an operation field
   * Requirements: 9.2
   */
  it('should have operation field on every entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryArrayGen,
        async (entries) => {
          for (const entry of entries) {
            const savedEntry = await StorageManager.logAuditEntry(entry);
            
            // operation must exist and be a non-empty string
            if (!savedEntry.operation || 
                typeof savedEntry.operation !== 'string' ||
                savedEntry.operation.trim().length === 0) {
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
   * Property: Operation field matches input operation
   * Requirements: 9.2
   */
  it('should preserve the operation field from input', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryGen,
        async (entry) => {
          const savedEntry = await StorageManager.logAuditEntry(entry);
          
          // operation should match input
          return savedEntry.operation === entry.operation;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context fields are preserved in saved entry
   * Requirements: 9.3
   */
  it('should preserve context fields in saved entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryGen,
        async (entry) => {
          const savedEntry = await StorageManager.logAuditEntry(entry);
          
          // context should be an object
          if (!savedEntry.context || typeof savedEntry.context !== 'object') {
            return false;
          }
          
          // Check that input context fields are preserved
          if (entry.context) {
            for (const [key, value] of Object.entries(entry.context)) {
              if (value !== undefined && savedEntry.context[key] !== value) {
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
   * Property: Optional fields (actId, outcome, contentHash) are preserved when provided
   * Requirements: 9.2, 9.3
   */
  it('should preserve optional fields when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryGen,
        async (entry) => {
          const savedEntry = await StorageManager.logAuditEntry(entry);
          
          // actId should match input (or be null if not provided)
          if (entry.actId !== undefined && savedEntry.actId !== entry.actId) {
            return false;
          }
          
          // outcome should match input (or be null if not provided)
          if (entry.outcome !== undefined && savedEntry.outcome !== entry.outcome) {
            return false;
          }
          
          // contentHash should match input (or be null if not provided)
          if (entry.contentHash !== undefined && savedEntry.contentHash !== entry.contentHash) {
            return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: storageLocation is set to current backend
   * Requirements: 9.3
   */
  it('should set storageLocation to current backend', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryGen,
        async (entry) => {
          const savedEntry = await StorageManager.logAuditEntry(entry);
          
          // storageLocation should be set to the active backend
          const activeBackend = StorageManager.getActiveBackend();
          return savedEntry.storageLocation === activeBackend;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Retrieved entries have all required fields
   * Requirements: 9.2, 9.3
   */
  it('should have all required fields when retrieved from audit log', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryArrayGen,
        async (entries) => {
          // Log all entries
          for (const entry of entries) {
            await StorageManager.logAuditEntry(entry);
          }
          
          // Retrieve all entries
          const auditLog = await StorageManager.getAuditLog();
          
          // Check each entry has required fields
          for (const entry of auditLog) {
            // log_id is required
            if (entry.log_id === undefined || entry.log_id === null) {
              return false;
            }
            
            // timestamp is required and must be valid ISO-8601
            if (!isValidISO8601(entry.timestamp)) {
              return false;
            }
            
            // operation is required
            if (!entry.operation || typeof entry.operation !== 'string') {
              return false;
            }
            
            // context should be an object
            if (typeof entry.context !== 'object') {
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
   * Property: Entries are retrievable by operation type filter
   * Requirements: 9.4
   */
  it('should filter entries by operation type', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryArrayGen,
        auditOperationGen,
        async (entries, filterOperation) => {
          // Log all entries
          for (const entry of entries) {
            await StorageManager.logAuditEntry(entry);
          }
          
          // Retrieve filtered entries
          const filteredLog = await StorageManager.getAuditLog({ operation: filterOperation });
          
          // All returned entries should have the filtered operation
          for (const entry of filteredLog) {
            if (entry.operation !== filterOperation) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
