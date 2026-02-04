/**
 * Property-Based Tests for Storage Threshold Behavior
 * 
 * Feature: durable-persistence-hardening, Property 6: Storage Threshold Behavior
 * Validates: Requirements 2.2, 2.3, 2.6
 * 
 * For any storage state where usagePercent >= 80, the system SHALL set isWarning = true.
 * For any storage state where usagePercent >= 95, the system SHALL set isCritical = true
 * AND throw a QUOTA_EXCEEDED error when attempting to write.
 */

const fc = require('fast-check');

const {
  StorageManager,
  StorageError,
  StorageErrorType
} = require('../../bdlaw-storage.js');

describe('Property 6: Storage Threshold Behavior', () => {
  // Store original methods to restore after tests
  let originalGetIndexedDBUsage;
  let originalGetChromeStorageUsage;
  let originalGetMemoryUsage;

  beforeEach(() => {
    // Store original methods
    originalGetIndexedDBUsage = StorageManager._getIndexedDBUsage;
    originalGetChromeStorageUsage = StorageManager._getChromeStorageUsage;
    originalGetMemoryUsage = StorageManager._getMemoryUsage;
    
    // Reset StorageManager state
    StorageManager._db = null;
    StorageManager._activeBackend = 'memory'; // Use memory backend for testing
  });

  afterEach(() => {
    // Restore original methods
    StorageManager._getIndexedDBUsage = originalGetIndexedDBUsage;
    StorageManager._getChromeStorageUsage = originalGetChromeStorageUsage;
    StorageManager._getMemoryUsage = originalGetMemoryUsage;
    
    // Reset state
    StorageManager._activeBackend = null;
  });

  // Generator for storage usage scenarios
  // usageBytes and quotaBytes where quotaBytes > 0
  const storageStateGen = fc.record({
    usageBytes: fc.integer({ min: 0, max: 100 * 1024 * 1024 }), // 0 to 100MB
    quotaBytes: fc.integer({ min: 1, max: 100 * 1024 * 1024 })  // 1 byte to 100MB
  }).filter(s => s.quotaBytes > 0);

  // Generator for usage percentages (0-100)
  const usagePercentGen = fc.integer({ min: 0, max: 100 });

  // Helper to create storage state with specific percentage
  // Uses ceiling to ensure we meet or exceed the target percentage
  const createStorageStateWithPercent = (percent, quotaBytes = 10 * 1024 * 1024) => {
    const usageBytes = Math.ceil((percent / 100) * quotaBytes);
    return { usageBytes, quotaBytes };
  };

  /**
   * Property: Warning flag is set when usage >= 80%
   * Requirements: 2.2
   */
  it('should set isWarning = true when usagePercent >= 80%', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 80, max: 100 }), // Percentages at or above warning threshold
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // Quota bytes
        async (percent, quotaBytes) => {
          // Mock the memory usage to return specific values
          const state = createStorageStateWithPercent(percent, quotaBytes);
          StorageManager._getMemoryUsage = () => state;
          
          // Get storage status
          const status = await StorageManager.getStorageStatus();
          
          // Verify warning flag is set
          return status.isWarning === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Warning flag is NOT set when usage < 80%
   * Requirements: 2.2
   */
  it('should set isWarning = false when usagePercent < 80%', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 79 }), // Percentages below warning threshold
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // Quota bytes
        async (percent, quotaBytes) => {
          // Mock the memory usage to return specific values
          const state = createStorageStateWithPercent(percent, quotaBytes);
          StorageManager._getMemoryUsage = () => state;
          
          // Get storage status
          const status = await StorageManager.getStorageStatus();
          
          // Verify warning flag is NOT set
          return status.isWarning === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Critical flag is set when usage >= 95%
   * Requirements: 2.3
   */
  it('should set isCritical = true when usagePercent >= 95%', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 95, max: 100 }), // Percentages at or above critical threshold
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // Quota bytes
        async (percent, quotaBytes) => {
          // Mock the memory usage to return specific values
          const state = createStorageStateWithPercent(percent, quotaBytes);
          StorageManager._getMemoryUsage = () => state;
          
          // Get storage status
          const status = await StorageManager.getStorageStatus();
          
          // Verify critical flag is set
          return status.isCritical === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Critical flag is NOT set when usage < 95%
   * Requirements: 2.3
   */
  it('should set isCritical = false when usagePercent < 95%', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 94 }), // Percentages below critical threshold
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // Quota bytes
        async (percent, quotaBytes) => {
          // Mock the memory usage to return specific values
          const state = createStorageStateWithPercent(percent, quotaBytes);
          StorageManager._getMemoryUsage = () => state;
          
          // Get storage status
          const status = await StorageManager.getStorageStatus();
          
          // Verify critical flag is NOT set
          return status.isCritical === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: checkQuotaBeforeWrite throws QUOTA_EXCEEDED when usage >= 95%
   * Requirements: 2.3, 2.6
   */
  it('should throw QUOTA_EXCEEDED error when checking quota at >= 95%', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 95, max: 100 }), // Percentages at or above critical threshold
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // Quota bytes
        async (percent, quotaBytes) => {
          // Mock the memory usage to return specific values
          const state = createStorageStateWithPercent(percent, quotaBytes);
          StorageManager._getMemoryUsage = () => state;
          
          // Attempt to check quota before write
          try {
            await StorageManager.checkQuotaBeforeWrite();
            // Should have thrown - test fails
            return false;
          } catch (error) {
            // Verify it's a StorageError with QUOTA_EXCEEDED type
            if (!(error instanceof StorageError)) return false;
            if (error.type !== StorageErrorType.QUOTA_EXCEEDED) return false;
            return true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: checkQuotaBeforeWrite allows write when usage < 95%
   * Requirements: 2.2, 2.3
   */
  it('should allow write when checking quota at < 95%', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 94 }), // Percentages below critical threshold
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // Quota bytes
        async (percent, quotaBytes) => {
          // Mock the memory usage to return specific values
          const state = createStorageStateWithPercent(percent, quotaBytes);
          StorageManager._getMemoryUsage = () => state;
          
          // Attempt to check quota before write
          try {
            const result = await StorageManager.checkQuotaBeforeWrite();
            // Should succeed and return canWrite: true
            return result.canWrite === true;
          } catch (error) {
            // Should not throw - test fails
            return false;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: checkQuotaBeforeWrite returns warning message when usage >= 80% but < 95%
   * Requirements: 2.2
   */
  it('should return warning message when checking quota at >= 80% but < 95%', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 80, max: 94 }), // Percentages in warning range
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // Quota bytes
        async (percent, quotaBytes) => {
          // Mock the memory usage to return specific values
          const state = createStorageStateWithPercent(percent, quotaBytes);
          StorageManager._getMemoryUsage = () => state;
          
          // Check quota before write
          const result = await StorageManager.checkQuotaBeforeWrite();
          
          // Should succeed with warning
          if (!result.canWrite) return false;
          if (!result.warning) return false;
          if (typeof result.warning !== 'string') return false;
          if (result.warning.length === 0) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: checkQuotaBeforeWrite returns no warning when usage < 80%
   * Requirements: 2.2
   */
  it('should return no warning when checking quota at < 80%', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 79 }), // Percentages below warning threshold
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // Quota bytes
        async (percent, quotaBytes) => {
          // Mock the memory usage to return specific values
          const state = createStorageStateWithPercent(percent, quotaBytes);
          StorageManager._getMemoryUsage = () => state;
          
          // Check quota before write
          const result = await StorageManager.checkQuotaBeforeWrite();
          
          // Should succeed without warning
          if (!result.canWrite) return false;
          if (result.warning !== null) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Storage status includes correct threshold values
   * Requirements: 2.2, 2.3
   */
  it('should include correct threshold values in status', async () => {
    await fc.assert(
      fc.asyncProperty(
        storageStateGen,
        async (state) => {
          // Mock the memory usage
          StorageManager._getMemoryUsage = () => state;
          
          // Get storage status
          const status = await StorageManager.getStorageStatus();
          
          // Verify threshold values are correct
          if (status.warningThreshold !== 80) return false;
          if (status.criticalThreshold !== 95) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Usage percentage is calculated correctly
   * Requirements: 2.1
   */
  it('should calculate usagePercent correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        storageStateGen,
        async (state) => {
          // Mock the memory usage
          StorageManager._getMemoryUsage = () => state;
          
          // Get storage status
          const status = await StorageManager.getStorageStatus();
          
          // Calculate expected percentage
          const expectedPercent = (state.usageBytes / state.quotaBytes) * 100;
          
          // Verify percentage is correct (within floating point tolerance)
          const diff = Math.abs(status.usagePercent - expectedPercent);
          return diff < 0.001;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isHealthy is false when isCritical is true
   * Requirements: 2.3
   */
  it('should set isHealthy = false when isCritical = true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 95, max: 100 }), // Critical percentages
        fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // Quota bytes
        async (percent, quotaBytes) => {
          // Mock the memory usage
          const state = createStorageStateWithPercent(percent, quotaBytes);
          StorageManager._getMemoryUsage = () => state;
          
          // Get storage status
          const status = await StorageManager.getStorageStatus();
          
          // Verify isHealthy is false when critical
          return status.isHealthy === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});
