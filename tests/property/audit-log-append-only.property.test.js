/**
 * Property-Based Tests for Audit Log Append-Only
 * 
 * Feature: durable-persistence-hardening, Property 16: Audit Log Append-Only
 * Validates: Requirements 9.1, 9.6
 * 
 * For any sequence of operations on the audit log, the count of entries SHALL only
 * increase or stay the same, never decrease. Existing entries SHALL never be modified.
 */

const fc = require('fast-check');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');

const {
  StorageManager,
  StorageError,
  StorageErrorType,
  MemoryBackend
} = require('../../bdlaw-storage.js');

describe('Property 16: Audit Log Append-Only', () => {
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
    'integrity_check'
  );

  // Generator for act IDs
  const actIdGen = fc.stringOf(
    fc.constantFrom(...'0123456789'),
    { minLength: 1, maxLength: 6 }
  );

  // Generator for outcomes
  const outcomeGen = fc.constantFrom('success', 'failure', 'partial', null);

  // Generator for valid audit entries
  const auditEntryGen = fc.record({
    operation: auditOperationGen,
    actId: fc.option(actIdGen, { nil: null }),
    outcome: outcomeGen,
    context: fc.record({
      message: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
      errorCode: fc.option(fc.integer({ min: 0, max: 999 }), { nil: undefined })
    })
  });

  // Generator for arrays of audit entries
  const auditEntryArrayGen = fc.array(auditEntryGen, { minLength: 1, maxLength: 15 });


  /**
   * Property: Audit log count only increases or stays the same
   * Requirements: 9.1, 9.6
   */
  it('should only increase audit log count, never decrease', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryArrayGen,
        async (entries) => {
          let previousCount = 0;
          
          for (const entry of entries) {
            // Log the audit entry
            await StorageManager.logAuditEntry(entry);
            
            // Get current count
            const auditLog = await StorageManager.getAuditLog();
            const currentCount = auditLog.length;
            
            // Count should only increase or stay the same
            if (currentCount < previousCount) {
              return false;
            }
            
            previousCount = currentCount;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Existing audit entries persist after new entries are added
   * Requirements: 9.1, 9.6
   */
  it('should preserve existing audit entries when adding new ones', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryArrayGen,
        async (entries) => {
          const savedEntries = [];
          
          for (const entry of entries) {
            // Log the audit entry
            const savedEntry = await StorageManager.logAuditEntry(entry);
            savedEntries.push(savedEntry);
            
            // Verify all previously saved entries still exist
            const currentLog = await StorageManager.getAuditLog();
            
            for (const saved of savedEntries) {
              const found = currentLog.find(e => e.log_id === saved.log_id);
              if (!found) {
                return false;
              }
              
              // Verify key fields are identical
              if (found.operation !== saved.operation ||
                  found.timestamp !== saved.timestamp ||
                  found.actId !== saved.actId ||
                  found.outcome !== saved.outcome) {
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
   * Property: Audit entry fields are immutable after save
   * Requirements: 9.6
   */
  it('should not allow modification of existing audit entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryGen,
        auditEntryGen,
        async (entry1, entry2) => {
          // Log the first entry
          const savedEntry1 = await StorageManager.logAuditEntry(entry1);
          
          // Get the entry
          const log1 = await StorageManager.getAuditLog();
          const originalEntry = log1.find(e => e.log_id === savedEntry1.log_id);
          
          if (!originalEntry) return false;
          
          // Log more entries (simulating more operations)
          await StorageManager.logAuditEntry(entry2);
          
          // Verify original entry is unchanged
          const log2 = await StorageManager.getAuditLog();
          const unchangedEntry = log2.find(e => e.log_id === savedEntry1.log_id);
          
          if (!unchangedEntry) return false;
          
          // All fields should be identical
          return (
            unchangedEntry.log_id === originalEntry.log_id &&
            unchangedEntry.operation === originalEntry.operation &&
            unchangedEntry.timestamp === originalEntry.timestamp &&
            unchangedEntry.actId === originalEntry.actId &&
            unchangedEntry.outcome === originalEntry.outcome
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Final audit log count equals number of entries logged
   * Requirements: 9.1
   */
  it('should have final count equal to entries logged', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryArrayGen,
        async (entries) => {
          // Get initial count (should be 0 after beforeEach reset)
          const initialLog = await StorageManager.getAuditLog();
          const initialCount = initialLog.length;
          
          // Log all entries
          for (const entry of entries) {
            await StorageManager.logAuditEntry(entry);
          }
          
          const finalLog = await StorageManager.getAuditLog();
          
          // Final count should equal initial count plus number of entries logged
          return finalLog.length === initialCount + entries.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each logged entry gets a unique log_id
   * Requirements: 9.1
   */
  it('should assign unique log_id to each entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        auditEntryArrayGen,
        async (entries) => {
          const logIds = new Set();
          
          for (const entry of entries) {
            const savedEntry = await StorageManager.logAuditEntry(entry);
            
            // Check for duplicate log_id
            if (logIds.has(savedEntry.log_id)) {
              return false;
            }
            
            logIds.add(savedEntry.log_id);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
