/**
 * BDLawCorpus Storage Abstraction Layer
 * 
 * Provides durable persistence for extracted acts with crash-safe guarantees.
 * Supports IndexedDB (primary), chrome.storage (fallback), and memory (ultimate fallback).
 * 
 * Key features:
 * - Atomic per-act persistence with extraction receipts
 * - Write-ahead logging for crash recovery
 * - Queue state reconstruction from authoritative receipts
 * - Storage quota monitoring and graceful degradation
 * 
 * @module bdlaw-storage
 */

// ============================================
// STORAGE ERROR TYPES
// Requirements: 7.3, 7.4 - Explicit error classification
// ============================================

/**
 * Storage Error Type enumeration
 * Enables specific error handling and user messaging
 * Requirements: 7.3 - Distinguish between error types
 */
const StorageErrorType = {
  QUOTA_EXCEEDED: 'quota_exceeded',
  PERMISSION_DENIED: 'permission_denied',
  BACKEND_UNAVAILABLE: 'backend_unavailable',
  TRANSACTION_FAILED: 'transaction_failed',
  INTEGRITY_ERROR: 'integrity_error',
  UNKNOWN_ERROR: 'unknown_error'
};

/**
 * Storage Error class for typed error handling
 * Requirements: 7.3, 7.4 - Explicit error handling with context
 * 
 * @class StorageError
 * @extends Error
 */
class StorageError extends Error {
  /**
   * Create a StorageError
   * @param {string} type - One of StorageErrorType values
   * @param {string} message - Human-readable error message
   * @param {Object} details - Additional context for debugging
   */
  constructor(type, message, details = {}) {
    super(message);
    this.name = 'StorageError';
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Check if this error is of a specific type
   * @param {string} errorType - StorageErrorType to check
   * @returns {boolean}
   */
  isType(errorType) {
    return this.type === errorType;
  }

  /**
   * Convert to plain object for logging/serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// ============================================
// EXTRACTION RECEIPT SCHEMA
// Requirements: 1.4, 1.5, 1.6 - Immutable proof of persistence
// ============================================

/**
 * Extraction Receipt schema version
 * Used for forward compatibility during schema migrations
 */
const RECEIPT_SCHEMA_VERSION = '3.1';

/**
 * Valid storage backend values
 */
const STORAGE_BACKENDS = ['indexeddb', 'chrome_storage', 'memory'];

/**
 * ExtractionReceipt factory and validation
 * Requirements: 1.4 - Generate extraction receipts with required fields
 */
const ExtractionReceipt = {
  /**
   * Create a new extraction receipt
   * Requirements: 1.4 - Receipt contains act_id, content_hash, timestamp
   * 
   * @param {Object} params - Receipt parameters
   * @param {string} params.act_id - The act_number
   * @param {string} params.content_raw_sha256 - SHA-256 hash of content_raw
   * @param {string} params.storage_backend - Backend used for storage
   * @returns {Object} Complete extraction receipt
   */
  create(params) {
    if (!params || typeof params !== 'object') {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Invalid receipt parameters',
        { params }
      );
    }

    const { act_id, content_raw_sha256, storage_backend } = params;

    // Validate required fields
    if (!act_id || typeof act_id !== 'string' || act_id.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Receipt requires non-empty act_id',
        { act_id }
      );
    }

    if (!content_raw_sha256 || typeof content_raw_sha256 !== 'string' || 
        !/^[a-fA-F0-9]{64}$/.test(content_raw_sha256)) {
      throw new StorageError(
        StorageErrorType.INTEGRITY_ERROR,
        'Receipt requires valid SHA-256 hash (64 hex characters)',
        { content_raw_sha256 }
      );
    }

    if (!storage_backend || !STORAGE_BACKENDS.includes(storage_backend)) {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        `Receipt requires valid storage_backend: ${STORAGE_BACKENDS.join(', ')}`,
        { storage_backend }
      );
    }

    return {
      receipt_id: ExtractionReceipt.generateUUID(),
      act_id: act_id.trim(),
      content_raw_sha256: content_raw_sha256.toLowerCase(),
      storage_backend,
      persisted_at: new Date().toISOString(),
      schema_version: RECEIPT_SCHEMA_VERSION
    };
  },

  /**
   * Validate an existing receipt object
   * Requirements: 1.4 - Ensure receipt completeness
   * 
   * @param {Object} receipt - Receipt to validate
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validate(receipt) {
    const errors = [];

    if (!receipt || typeof receipt !== 'object') {
      return { valid: false, errors: ['Receipt must be an object'] };
    }

    // Check receipt_id
    if (!receipt.receipt_id || typeof receipt.receipt_id !== 'string' || 
        receipt.receipt_id.trim().length === 0) {
      errors.push('Missing or invalid receipt_id');
    }

    // Check act_id
    if (!receipt.act_id || typeof receipt.act_id !== 'string' || 
        receipt.act_id.trim().length === 0) {
      errors.push('Missing or invalid act_id');
    }

    // Check content_raw_sha256
    if (!receipt.content_raw_sha256 || typeof receipt.content_raw_sha256 !== 'string' ||
        !/^[a-fA-F0-9]{64}$/.test(receipt.content_raw_sha256)) {
      errors.push('Missing or invalid content_raw_sha256 (must be 64 hex characters)');
    }

    // Check storage_backend
    if (!receipt.storage_backend || !STORAGE_BACKENDS.includes(receipt.storage_backend)) {
      errors.push(`Missing or invalid storage_backend (must be one of: ${STORAGE_BACKENDS.join(', ')})`);
    }

    // Check persisted_at
    if (!receipt.persisted_at || typeof receipt.persisted_at !== 'string') {
      errors.push('Missing or invalid persisted_at timestamp');
    } else {
      const date = new Date(receipt.persisted_at);
      if (isNaN(date.getTime())) {
        errors.push('persisted_at is not a valid ISO-8601 timestamp');
      }
    }

    // Check schema_version
    if (!receipt.schema_version || typeof receipt.schema_version !== 'string' ||
        receipt.schema_version.trim().length === 0) {
      errors.push('Missing or invalid schema_version');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Generate a UUID v4
   * @returns {string} UUID string
   */
  generateUUID() {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// ============================================
// ERROR CLASSIFICATION HELPER
// Requirements: 7.3 - Classify storage errors accurately
// ============================================

/**
 * Classify a raw error into a StorageErrorType
 * Requirements: 7.3 - Distinguish between quota_exceeded, permission_denied, etc.
 * 
 * @param {Error} error - The raw error to classify
 * @returns {string} One of StorageErrorType values
 */
function classifyStorageError(error) {
  if (!error) {
    return StorageErrorType.UNKNOWN_ERROR;
  }

  const message = (error.message || '').toLowerCase();
  const name = (error.name || '').toLowerCase();

  // Quota exceeded detection
  if (message.includes('quota') || 
      message.includes('storage limit') ||
      message.includes('disk full') ||
      message.includes('exceeded') ||
      name === 'quotaexceedederror') {
    return StorageErrorType.QUOTA_EXCEEDED;
  }

  // Permission denied detection
  if (message.includes('permission') ||
      message.includes('access denied') ||
      message.includes('not allowed') ||
      message.includes('security') ||
      name === 'securityerror') {
    return StorageErrorType.PERMISSION_DENIED;
  }

  // Backend unavailable detection
  // Check for IndexedDB-related unavailability patterns
  if (message.includes('indexeddb') && (message.includes('unavailable') || message.includes('not supported')) ||
      message.includes('database') && message.includes('blocked') ||
      message.includes('not available') ||
      message.includes('invalidstateerror') ||  // Handle InvalidStateError in message
      name === 'invalidstateerror') {
    return StorageErrorType.BACKEND_UNAVAILABLE;
  }

  // Transaction failed detection
  if (message.includes('transaction') ||
      message.includes('abort') ||
      message.includes('commit') ||
      name === 'transactioninactiveerror' ||
      name === 'aborterror') {
    return StorageErrorType.TRANSACTION_FAILED;
  }

  // Integrity error detection
  if (message.includes('integrity') ||
      message.includes('corrupt') ||
      message.includes('hash') ||
      message.includes('mismatch')) {
    return StorageErrorType.INTEGRITY_ERROR;
  }

  return StorageErrorType.UNKNOWN_ERROR;
}

/**
 * Create a StorageError from a raw error with automatic classification
 * Requirements: 7.3, 7.4 - Classify and log errors with context
 * 
 * @param {Error} error - The raw error
 * @param {Object} context - Additional context for debugging
 * @returns {StorageError}
 */
function createStorageError(error, context = {}) {
  const type = classifyStorageError(error);
  const message = error?.message || 'Unknown storage error';
  
  return new StorageError(type, message, {
    ...context,
    originalError: error?.name,
    originalMessage: error?.message,
    originalStack: error?.stack
  });
}

// ============================================
// CHROME STORAGE BACKEND
// Requirements: 10.1 - Fallback to chrome.storage if IndexedDB unavailable
// ============================================

/**
 * ChromeStorageBackend - Fallback storage using chrome.storage.local
 * Provides the same interface as IndexedDB backend but with quota limitations
 * 
 * Requirements:
 * - 10.1: Fall back to chrome.storage.local if IndexedDB unavailable
 * - Handles quota limitations (typically 10MB for extensions)
 */
const ChromeStorageBackend = {
  // Storage keys
  ACTS_KEY: 'bdlaw_captured_acts',
  RECEIPTS_KEY: 'bdlaw_receipts',
  WAL_KEY: 'bdlaw_wal',
  AUDIT_LOG_KEY: 'bdlaw_audit_log',
  
  // Quota (10MB default for chrome.storage.local)
  QUOTA_BYTES: 10 * 1024 * 1024,

  /**
   * Check if chrome.storage is available
   * @returns {boolean}
   */
  isAvailable() {
    return typeof chrome !== 'undefined' && 
           chrome.storage && 
           chrome.storage.local &&
           typeof chrome.storage.local.get === 'function';
  },

  /**
   * Save an act to chrome.storage.local
   * Requirements: 10.1 - Fallback storage with quota handling
   * 
   * @param {Object} act - The act to save (must have act_number and content_raw)
   * @param {string} contentHash - Pre-computed SHA-256 hash
   * @returns {Promise<Object>} The saved act with persistence metadata
   * @throws {StorageError} if write fails
   */
  async saveAct(act, contentHash) {
    if (!this.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        { operation: 'saveAct' }
      );
    }

    // Prepare act record with persistence metadata
    const actRecord = {
      ...act,
      content_raw_sha256: contentHash,
      _persistence: {
        storage_backend: 'chrome_storage',
        persisted_at: new Date().toISOString(),
        schema_version: RECEIPT_SCHEMA_VERSION,
        integrity_verified: true,
        last_verified_at: new Date().toISOString()
      }
    };

    return new Promise((resolve, reject) => {
      chrome.storage.local.get([this.ACTS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'saveAct', actNumber: act.act_number }
          ));
          return;
        }

        const acts = result[this.ACTS_KEY] || [];
        
        // Find and replace existing act or add new one
        const existingIndex = acts.findIndex(a => a.act_number === act.act_number);
        if (existingIndex >= 0) {
          acts[existingIndex] = actRecord;
        } else {
          acts.push(actRecord);
        }

        chrome.storage.local.set({ [this.ACTS_KEY]: acts }, () => {
          if (chrome.runtime.lastError) {
            const error = new Error(chrome.runtime.lastError.message);
            reject(createStorageError(error, { 
              operation: 'saveAct', 
              actNumber: act.act_number 
            }));
          } else {
            resolve(actRecord);
          }
        });
      });
    });
  },

  /**
   * Load an act from chrome.storage.local by act_number
   * 
   * @param {string} actId - The act_number to look up
   * @returns {Promise<Object|null>} The act record or null if not found
   */
  async loadAct(actId) {
    if (!this.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        { operation: 'loadAct' }
      );
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get([this.ACTS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'loadAct', actId }
          ));
          return;
        }

        const acts = result[this.ACTS_KEY] || [];
        const act = acts.find(a => a.act_number === actId);
        resolve(act || null);
      });
    });
  },

  /**
   * Get all acts from chrome.storage.local
   * 
   * @returns {Promise<Object[]>} Array of acts
   */
  async getAllActs() {
    if (!this.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        { operation: 'getAllActs' }
      );
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get([this.ACTS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'getAllActs' }
          ));
          return;
        }

        resolve(result[this.ACTS_KEY] || []);
      });
    });
  },

  /**
   * Save a receipt to chrome.storage.local (append-only)
   * 
   * @param {Object} receipt - The receipt to save
   * @returns {Promise<Object>} The saved receipt
   */
  async saveReceipt(receipt) {
    if (!this.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        { operation: 'saveReceipt' }
      );
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get([this.RECEIPTS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'saveReceipt', receiptId: receipt.receipt_id }
          ));
          return;
        }

        const receipts = result[this.RECEIPTS_KEY] || [];
        
        // Check if receipt already exists (append-only)
        const exists = receipts.some(r => r.receipt_id === receipt.receipt_id);
        if (exists) {
          // Already exists, just return it (idempotent)
          resolve(receipt);
          return;
        }
        
        // Append the new receipt
        receipts.push(receipt);
        
        chrome.storage.local.set({ [this.RECEIPTS_KEY]: receipts }, () => {
          if (chrome.runtime.lastError) {
            reject(createStorageError(
              new Error(chrome.runtime.lastError.message),
              { operation: 'saveReceipt', receiptId: receipt.receipt_id }
            ));
          } else {
            resolve(receipt);
          }
        });
      });
    });
  },

  /**
   * Get receipts from chrome.storage.local
   * 
   * @param {Object} options - Filtering options
   * @param {string} options.actId - Filter by act_id
   * @returns {Promise<Object[]>} Array of receipts
   */
  async getReceipts(options = {}) {
    if (!this.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        { operation: 'getReceipts' }
      );
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get([this.RECEIPTS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'getReceipts', options }
          ));
          return;
        }
        
        let receipts = result[this.RECEIPTS_KEY] || [];
        
        // Apply filtering if actId specified
        if (options.actId) {
          receipts = receipts.filter(r => r.act_id === options.actId);
        }
        
        resolve(receipts);
      });
    });
  },

  /**
   * Get storage usage information
   * 
   * @returns {Promise<{usageBytes: number, quotaBytes: number}>}
   */
  async getUsage() {
    if (!this.isAvailable()) {
      return { usageBytes: 0, quotaBytes: this.QUOTA_BYTES };
    }

    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('Failed to get chrome.storage usage:', chrome.runtime.lastError);
          resolve({ usageBytes: 0, quotaBytes: this.QUOTA_BYTES });
          return;
        }

        const quotaBytes = chrome.storage.local.QUOTA_BYTES || this.QUOTA_BYTES;
        resolve({
          usageBytes: bytesInUse || 0,
          quotaBytes: quotaBytes
        });
      });
    });
  },

  /**
   * Clear all data (for testing)
   * 
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.isAvailable()) {
      return;
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([
        this.ACTS_KEY, 
        this.RECEIPTS_KEY, 
        this.WAL_KEY, 
        this.AUDIT_LOG_KEY
      ], () => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'clear' }
          ));
        } else {
          resolve();
        }
      });
    });
  }
};

// ============================================
// MEMORY BACKEND
// Requirements: 10.2 - Ultimate fallback to in-memory storage
// ============================================

/**
 * MemoryBackend - Ultimate fallback storage using in-memory data structures
 * Provides the same interface as other backends but data is volatile
 * 
 * Requirements:
 * - 10.2: Fall back to in-memory storage if chrome.storage unavailable
 * - Warns user about data volatility
 */
const MemoryBackend = {
  // In-memory storage
  _acts: new Map(),
  _receipts: [],
  _wal: [],
  _auditLog: [],
  
  // Soft quota limit (100MB)
  QUOTA_BYTES: 100 * 1024 * 1024,
  
  // Volatility warning flag
  _volatilityWarningShown: false,

  /**
   * Check if memory backend is available (always true)
   * @returns {boolean}
   */
  isAvailable() {
    return true;
  },

  /**
   * Show volatility warning to user
   * Requirements: 10.2 - Warn user about data volatility
   */
  showVolatilityWarning() {
    if (!this._volatilityWarningShown) {
      console.warn(
        '⚠️ MEMORY BACKEND ACTIVE: Data is stored in memory only and will be lost ' +
        'when the browser closes or the extension reloads. Please export your data frequently!'
      );
      this._volatilityWarningShown = true;
    }
  },

  /**
   * Save an act to memory
   * Requirements: 10.2 - Fallback storage with volatility warning
   * 
   * @param {Object} act - The act to save (must have act_number and content_raw)
   * @param {string} contentHash - Pre-computed SHA-256 hash
   * @returns {Promise<Object>} The saved act with persistence metadata
   */
  async saveAct(act, contentHash) {
    this.showVolatilityWarning();

    // Prepare act record with persistence metadata
    const actRecord = {
      ...act,
      content_raw_sha256: contentHash,
      _persistence: {
        storage_backend: 'memory',
        persisted_at: new Date().toISOString(),
        schema_version: RECEIPT_SCHEMA_VERSION,
        integrity_verified: true,
        last_verified_at: new Date().toISOString()
      }
    };

    // Store in memory map
    this._acts.set(act.act_number, actRecord);

    return actRecord;
  },

  /**
   * Load an act from memory by act_number
   * 
   * @param {string} actId - The act_number to look up
   * @returns {Promise<Object|null>} The act record or null if not found
   */
  async loadAct(actId) {
    return this._acts.get(actId) || null;
  },

  /**
   * Get all acts from memory
   * 
   * @returns {Promise<Object[]>} Array of acts
   */
  async getAllActs() {
    return Array.from(this._acts.values());
  },

  /**
   * Save a receipt to memory (append-only)
   * 
   * @param {Object} receipt - The receipt to save
   * @returns {Promise<Object>} The saved receipt
   */
  async saveReceipt(receipt) {
    this.showVolatilityWarning();

    // Check if receipt already exists (append-only)
    const exists = this._receipts.some(r => r.receipt_id === receipt.receipt_id);
    if (!exists) {
      this._receipts.push(receipt);
    }
    return receipt;
  },

  /**
   * Get receipts from memory
   * 
   * @param {Object} options - Filtering options
   * @param {string} options.actId - Filter by act_id
   * @returns {Promise<Object[]>} Array of receipts
   */
  async getReceipts(options = {}) {
    let receipts = [...this._receipts];
    
    // Apply filtering if actId specified
    if (options.actId) {
      receipts = receipts.filter(r => r.act_id === options.actId);
    }
    
    return receipts;
  },

  /**
   * Get storage usage estimate
   * 
   * @returns {Promise<{usageBytes: number, quotaBytes: number}>}
   */
  async getUsage() {
    let usageBytes = 0;

    // Estimate acts size
    for (const [key, act] of this._acts) {
      usageBytes += JSON.stringify(act).length * 2; // UTF-16 encoding
    }

    // Estimate receipts size
    usageBytes += JSON.stringify(this._receipts).length * 2;

    // Estimate WAL size
    usageBytes += JSON.stringify(this._wal).length * 2;

    // Estimate audit log size
    usageBytes += JSON.stringify(this._auditLog).length * 2;

    return {
      usageBytes,
      quotaBytes: this.QUOTA_BYTES
    };
  },

  /**
   * Clear all data
   * 
   * @returns {Promise<void>}
   */
  async clear() {
    this._acts.clear();
    this._receipts = [];
    this._wal = [];
    this._auditLog = [];
    this._volatilityWarningShown = false;
  },

  /**
   * Reset the volatility warning flag (for testing)
   */
  resetWarningFlag() {
    this._volatilityWarningShown = false;
  }
};

// ============================================
// STORAGE MANAGER INTERFACE
// Requirements: 1.1, 1.2, 3.1, 3.2 - Unified storage abstraction
// ============================================

/**
 * Storage Manager - Unified persistence interface
 * Handles backend selection, fallback, and atomic operations
 * 
 * Requirements:
 * - 1.1: Persist acts before marking as done
 * - 1.2: Atomic write operations
 * - 3.1: Support 50MB+ storage via IndexedDB
 * - 3.2: Use IndexedDB as default backend
 */
const StorageManager = {
  // Current active backend
  _activeBackend: null,  // 'indexeddb' | 'chrome_storage' | 'memory'
  
  // Database reference (for IndexedDB)
  _db: null,
  
  // In-memory fallback storage
  _memoryStore: {
    acts: new Map(),
    receipts: [],
    wal: [],
    audit_log: []
  },
  
  // Backend priority order
  // Requirements: 10.7 - Attempt backends in order
  BACKEND_PRIORITY: ['indexeddb', 'chrome_storage', 'memory'],
  
  // Database configuration
  DB_NAME: 'BDLawCorpusDB',
  DB_VERSION: 1,
  
  // Storage thresholds
  // Requirements: 2.2, 2.3 - Warning and critical thresholds
  WARNING_THRESHOLD: 80,
  CRITICAL_THRESHOLD: 95,

  /**
   * Initialize storage manager, selecting best available backend
   * Requirements: 3.2, 10.7 - Use IndexedDB as default, fallback chain
   * 
   * Attempts backends in order: IndexedDB → chrome.storage.local → memory
   * After IndexedDB initialization, automatically runs migration if needed.
   * 
   * @returns {Promise<{backend: string, migrated: boolean, degraded: boolean, migrationResult: Object|null}>}
   */
  async initialize() {
    // Track initialization attempts for debugging
    const attempts = [];
    
    // Try backends in priority order
    // Requirements: 10.7 - Attempt backends in order
    for (const backend of this.BACKEND_PRIORITY) {
      try {
        const available = await this._checkBackendAvailability(backend);
        
        if (!available) {
          attempts.push({ backend, status: 'unavailable', error: null });
          continue;
        }
        
        // Try to initialize the backend
        if (backend === 'indexeddb') {
          await this._initIndexedDB();
        } else if (backend === 'chrome_storage') {
          // Verify chrome.storage is actually functional
          await this._verifyChromeStorage();
        } else if (backend === 'memory') {
          // Memory backend always works, show warning
          MemoryBackend.showVolatilityWarning();
        }
        
        // Backend initialized successfully
        this._activeBackend = backend;
        
        const result = {
          backend: this._activeBackend,
          migrated: false,
          degraded: backend !== 'indexeddb',
          migrationResult: null
        };
        
        // Requirements: 3.3 - Run migration automatically on first load if IndexedDB is active
        if (backend === 'indexeddb') {
          try {
            const migrationCheck = await MigrationManager.runMigrationIfNeeded();
            result.migrated = migrationCheck.migrationRun;
            result.migrationResult = migrationCheck.result;
            
            if (migrationCheck.migrationRun) {
              console.log('Migration completed during initialization:', migrationCheck.result);
            }
          } catch (migrationError) {
            // Log migration error but don't fail initialization
            console.error('Migration failed during initialization:', migrationError);
            result.migrationResult = {
              success: false,
              error: migrationError.message || String(migrationError)
            };
          }
        }
        
        // Log successful initialization
        console.log(`Storage initialized with backend: ${backend}`, {
          attempts,
          degraded: result.degraded,
          migrated: result.migrated
        });
        
        return result;
        
      } catch (e) {
        attempts.push({ 
          backend, 
          status: 'failed', 
          error: e.message || String(e) 
        });
        console.warn(`Backend ${backend} initialization failed:`, e);
        // Continue to next backend
      }
    }
    
    // If all backends fail, throw error
    throw new StorageError(
      StorageErrorType.BACKEND_UNAVAILABLE,
      'All storage backends unavailable',
      { triedBackends: this.BACKEND_PRIORITY, attempts }
    );
  },

  /**
   * Verify chrome.storage is functional by performing a test write/read
   * 
   * @returns {Promise<void>}
   * @throws {StorageError} if chrome.storage is not functional
   */
  async _verifyChromeStorage() {
    if (!ChromeStorageBackend.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        {}
      );
    }

    // Perform a test write/read to verify functionality
    return new Promise((resolve, reject) => {
      const testKey = '_bdlaw_storage_test';
      const testValue = Date.now();
      
      chrome.storage.local.set({ [testKey]: testValue }, () => {
        if (chrome.runtime.lastError) {
          reject(new StorageError(
            StorageErrorType.BACKEND_UNAVAILABLE,
            `chrome.storage.local write test failed: ${chrome.runtime.lastError.message}`,
            {}
          ));
          return;
        }
        
        chrome.storage.local.get([testKey], (result) => {
          if (chrome.runtime.lastError) {
            reject(new StorageError(
              StorageErrorType.BACKEND_UNAVAILABLE,
              `chrome.storage.local read test failed: ${chrome.runtime.lastError.message}`,
              {}
            ));
            return;
          }
          
          if (result[testKey] !== testValue) {
            reject(new StorageError(
              StorageErrorType.BACKEND_UNAVAILABLE,
              'chrome.storage.local verification failed: read value does not match written value',
              { expected: testValue, actual: result[testKey] }
            ));
            return;
          }
          
          // Clean up test key
          chrome.storage.local.remove([testKey], () => {
            resolve();
          });
        });
      });
    });
  },

  /**
   * Check if a backend is available
   * @param {string} backend - Backend to check
   * @returns {Promise<boolean>}
   */
  async _checkBackendAvailability(backend) {
    switch (backend) {
      case 'indexeddb':
        return typeof indexedDB !== 'undefined' && indexedDB !== null;
      
      case 'chrome_storage':
        return typeof chrome !== 'undefined' && 
               chrome.storage && 
               chrome.storage.local;
      
      case 'memory':
        return true; // Always available
      
      default:
        return false;
    }
  },

  /**
   * IndexedDB Schema Definition
   * Requirements: 3.1, 3.2 - Define database schema with 4 object stores
   */
  IDB_SCHEMA: {
    // Object store for captured acts
    acts: {
      keyPath: 'act_number',
      indexes: [
        { name: 'by_volume', keyPath: 'volume_number', options: { unique: false } },
        { name: 'by_captured_at', keyPath: 'capturedAt', options: { unique: false } },
        { name: 'by_content_hash', keyPath: 'content_raw_sha256', options: { unique: false } }
      ]
    },
    // Object store for extraction receipts (append-only)
    receipts: {
      keyPath: 'receipt_id',
      indexes: [
        { name: 'by_act_id', keyPath: 'act_id', options: { unique: false } },
        { name: 'by_persisted_at', keyPath: 'persisted_at', options: { unique: false } }
      ]
    },
    // Object store for write-ahead log
    wal: {
      keyPath: 'entry_id',
      indexes: [
        { name: 'by_act_id', keyPath: 'act_id', options: { unique: false } },
        { name: 'by_type', keyPath: 'entry_type', options: { unique: false } },
        { name: 'by_timestamp', keyPath: 'timestamp', options: { unique: false } }
      ]
    },
    // Object store for audit log
    audit_log: {
      keyPath: 'log_id',
      autoIncrement: true,
      indexes: [
        { name: 'by_timestamp', keyPath: 'timestamp', options: { unique: false } },
        { name: 'by_operation', keyPath: 'operation', options: { unique: false } }
      ]
    }
  },

  /**
   * Initialize IndexedDB backend
   * Requirements: 3.1, 3.2 - IndexedDB with proper schema
   * 
   * Creates the BDLawCorpusDB database with 4 object stores:
   * - acts: Stores captured act records keyed by act_number
   * - receipts: Append-only log of extraction receipts
   * - wal: Write-ahead log for crash recovery
   * - audit_log: Complete audit trail of operations
   * 
   * @returns {Promise<IDBDatabase>}
   * @throws {StorageError} if IndexedDB initialization fails
   */
  async _initIndexedDB() {
    return new Promise((resolve, reject) => {
      // Check if IndexedDB is available
      if (typeof indexedDB === 'undefined' || indexedDB === null) {
        reject(new StorageError(
          StorageErrorType.BACKEND_UNAVAILABLE,
          'IndexedDB is not available in this environment',
          { environment: typeof window !== 'undefined' ? 'browser' : 'node' }
        ));
        return;
      }

      try {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

        // Handle database upgrade (schema creation/migration)
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          const oldVersion = event.oldVersion;

          console.log(`Upgrading IndexedDB from version ${oldVersion} to ${this.DB_VERSION}`);

          // Create object stores based on schema
          for (const [storeName, storeConfig] of Object.entries(this.IDB_SCHEMA)) {
            // Skip if store already exists
            if (db.objectStoreNames.contains(storeName)) {
              continue;
            }

            // Create object store with keyPath and optional autoIncrement
            const storeOptions = { keyPath: storeConfig.keyPath };
            if (storeConfig.autoIncrement) {
              storeOptions.autoIncrement = true;
            }

            const store = db.createObjectStore(storeName, storeOptions);

            // Create indexes
            if (storeConfig.indexes) {
              for (const indexConfig of storeConfig.indexes) {
                store.createIndex(
                  indexConfig.name,
                  indexConfig.keyPath,
                  indexConfig.options || {}
                );
              }
            }

            console.log(`Created object store: ${storeName}`);
          }
        };

        // Handle successful database open
        request.onsuccess = (event) => {
          this._db = event.target.result;

          // Handle database close events (e.g., version change from another tab)
          this._db.onversionchange = () => {
            this._db.close();
            this._db = null;
            console.warn('Database closed due to version change in another tab');
          };

          // Handle unexpected close
          this._db.onclose = () => {
            this._db = null;
            console.warn('Database connection closed unexpectedly');
          };

          console.log(`IndexedDB initialized: ${this.DB_NAME} v${this.DB_VERSION}`);
          resolve(this._db);
        };

        // Handle errors
        request.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'initIndexedDB',
            dbName: this.DB_NAME,
            dbVersion: this.DB_VERSION
          }));
        };

        // Handle blocked state (another connection is open with older version)
        request.onblocked = (event) => {
          reject(new StorageError(
            StorageErrorType.BACKEND_UNAVAILABLE,
            'IndexedDB upgrade blocked by another connection',
            {
              operation: 'initIndexedDB',
              dbName: this.DB_NAME,
              dbVersion: this.DB_VERSION
            }
          ));
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'initIndexedDB',
          dbName: this.DB_NAME
        }));
      }
    });
  },

  /**
   * Close the IndexedDB connection
   * Useful for cleanup and testing
   * 
   * @returns {void}
   */
  closeDatabase() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  },

  /**
   * Compute SHA-256 hash of content
   * Requirements: 1.2, 3.6 - Generate content_raw_sha256 hash
   * 
   * @param {string} content - The content to hash
   * @returns {Promise<string>} Lowercase hex string of SHA-256 hash
   */
  async computeSHA256(content) {
    if (typeof content !== 'string') {
      throw new StorageError(
        StorageErrorType.INTEGRITY_ERROR,
        'Content must be a string for hashing',
        { contentType: typeof content }
      );
    }

    // Use Web Crypto API if available (browser environment)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback for Node.js environment (testing)
    if (typeof require !== 'undefined') {
      try {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
      } catch (e) {
        throw new StorageError(
          StorageErrorType.BACKEND_UNAVAILABLE,
          'No crypto implementation available for hashing',
          { error: e.message }
        );
      }
    }

    throw new StorageError(
      StorageErrorType.BACKEND_UNAVAILABLE,
      'No crypto implementation available for hashing',
      {}
    );
  },

  /**
   * Check if IndexedDB is initialized and ready
   * 
   * @returns {boolean}
   */
  isIndexedDBReady() {
    return this._db !== null && this._activeBackend === 'indexeddb';
  },

  /**
   * Get the IndexedDB database instance
   * For internal use and testing
   * 
   * @returns {IDBDatabase|null}
   */
  getDatabase() {
    return this._db;
  },

  /**
   * Save an act to IndexedDB with proper transaction handling
   * Requirements: 1.2, 3.5, 3.6 - Atomic write with hash generation
   * 
   * @param {Object} act - The act to save (must have act_number and content_raw)
   * @returns {Promise<Object>} The saved act with persistence metadata
   * @throws {StorageError} if write fails
   */
  async saveActToIndexedDB(act) {
    // Validate act object
    if (!act || typeof act !== 'object') {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Act must be a non-null object',
        { act }
      );
    }

    // Validate required fields
    if (!act.act_number || typeof act.act_number !== 'string' || act.act_number.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Act must have a non-empty act_number',
        { act_number: act.act_number }
      );
    }

    if (!act.content_raw || typeof act.content_raw !== 'string') {
      throw new StorageError(
        StorageErrorType.INTEGRITY_ERROR,
        'Act must have content_raw as a string',
        { hasContentRaw: !!act.content_raw, contentRawType: typeof act.content_raw }
      );
    }

    // Ensure IndexedDB is initialized
    if (!this._db) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'IndexedDB not initialized. Call initialize() first.',
        {}
      );
    }

    // Generate content_raw_sha256 hash
    const content_raw_sha256 = await this.computeSHA256(act.content_raw);

    // Prepare act record with persistence metadata
    const actRecord = {
      ...act,
      act_number: act.act_number.trim(),
      content_raw_sha256,
      _persistence: {
        storage_backend: 'indexeddb',
        persisted_at: new Date().toISOString(),
        schema_version: RECEIPT_SCHEMA_VERSION,
        integrity_verified: true,
        last_verified_at: new Date().toISOString()
      }
    };

    // Save to IndexedDB with transaction
    return new Promise((resolve, reject) => {
      try {
        const transaction = this._db.transaction(['acts'], 'readwrite');
        const store = transaction.objectStore('acts');

        // Handle transaction completion
        transaction.oncomplete = () => {
          resolve(actRecord);
        };

        // Handle transaction error
        transaction.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'saveActToIndexedDB',
            actNumber: act.act_number
          }));
        };

        // Handle transaction abort
        transaction.onabort = (event) => {
          const error = event.target.error;
          reject(createStorageError(error || new Error('Transaction aborted'), {
            operation: 'saveActToIndexedDB',
            actNumber: act.act_number
          }));
        };

        // Put the act record (will overwrite if exists)
        const request = store.put(actRecord);

        request.onerror = (event) => {
          const error = event.target.error;
          // Don't reject here - let transaction.onerror handle it
          console.error('Put request error:', error);
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'saveActToIndexedDB',
          actNumber: act.act_number
        }));
      }
    });
  },

  /**
   * Load an act from IndexedDB by act_number
   * Requirements: 3.5, 11.1 - Retrieve act and verify content hash
   * 
   * @param {string} actId - The act_number to look up
   * @returns {Promise<Object|null>} The act record or null if not found
   * @throws {StorageError} if read fails or integrity check fails
   */
  async loadActFromIndexedDB(actId) {
    // Validate actId
    if (!actId || typeof actId !== 'string' || actId.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'actId must be a non-empty string',
        { actId }
      );
    }

    // Ensure IndexedDB is initialized
    if (!this._db) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'IndexedDB not initialized. Call initialize() first.',
        {}
      );
    }

    const normalizedActId = actId.trim();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this._db.transaction(['acts'], 'readonly');
        const store = transaction.objectStore('acts');
        const request = store.get(normalizedActId);

        request.onsuccess = async (event) => {
          const act = event.target.result;

          // Return null if not found
          if (!act) {
            resolve(null);
            return;
          }

          // Verify content hash on load (Requirements: 11.1)
          if (act.content_raw && act.content_raw_sha256) {
            try {
              const computedHash = await this.computeSHA256(act.content_raw);
              
              if (computedHash !== act.content_raw_sha256) {
                // Flag as potentially corrupted (Requirements: 11.2)
                act._persistence = act._persistence || {};
                act._persistence.integrity_verified = false;
                act._persistence.potentially_corrupted = true;
                act._persistence.last_verified_at = new Date().toISOString();
                act._persistence.integrity_error = 'Hash mismatch detected';
                
                // Log the integrity error
                console.error('Content hash mismatch for act:', normalizedActId, {
                  stored: act.content_raw_sha256,
                  computed: computedHash
                });
              } else {
                // Update verification status
                act._persistence = act._persistence || {};
                act._persistence.integrity_verified = true;
                act._persistence.potentially_corrupted = false;
                act._persistence.last_verified_at = new Date().toISOString();
              }
            } catch (hashError) {
              // If hash computation fails, mark as unverified
              act._persistence = act._persistence || {};
              act._persistence.integrity_verified = false;
              act._persistence.last_verified_at = new Date().toISOString();
              act._persistence.integrity_error = hashError.message;
            }
          }

          resolve(act);
        };

        request.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'loadActFromIndexedDB',
            actId: normalizedActId
          }));
        };

        // Handle transaction errors
        transaction.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'loadActFromIndexedDB',
            actId: normalizedActId
          }));
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'loadActFromIndexedDB',
          actId: normalizedActId
        }));
      }
    });
  },

  /**
   * Get all acts from IndexedDB
   * Requirements: 3.2 - Load all acts from IndexedDB storage
   * 
   * @returns {Promise<Object[]>} Array of all stored acts
   * @throws {StorageError} if read fails
   */
  async getAllActs() {
    // Handle based on active backend
    if (this._activeBackend === 'indexeddb') {
      return this._getAllActsFromIndexedDB();
    } else if (this._activeBackend === 'chrome_storage') {
      return ChromeStorageBackend.getAllActs();
    } else {
      return MemoryBackend.getAllActs();
    }
  },

  /**
   * Get all acts from IndexedDB
   * @returns {Promise<Object[]>} Array of all acts
   */
  async _getAllActsFromIndexedDB() {
    // Ensure IndexedDB is initialized
    if (!this._db) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'IndexedDB not initialized. Call initialize() first.',
        { operation: 'getAllActs' }
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this._db.transaction(['acts'], 'readonly');
        const store = transaction.objectStore('acts');
        const request = store.getAll();

        request.onsuccess = (event) => {
          const acts = event.target.result || [];
          resolve(acts);
        };

        request.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'getAllActsFromIndexedDB'
          }));
        };

        transaction.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'getAllActsFromIndexedDB'
          }));
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'getAllActsFromIndexedDB'
        }));
      }
    });
  },

  /**
   * Save an act with atomic write and receipt generation
   * Requirements: 1.1, 1.2, 1.6 - Atomic persistence with verification
   * 
   * This function implements the atomic save pattern:
   * 1. Save act to IndexedDB (or fallback backend)
   * 2. Generate and save extraction receipt
   * 3. Read back receipt to verify persistence
   * 4. Return receipt on success, throw on failure
   * 
   * The act is NOT considered "done" until the receipt is verified.
   * 
   * @param {Object} act - The act to save (must have act_number and content_raw)
   * @returns {Promise<Object>} ExtractionReceipt proving durable persistence
   * @throws {StorageError} if write fails or verification fails
   */
  async saveAct(act) {
    // Validate act object
    if (!act || typeof act !== 'object') {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Act must be a non-null object',
        { act }
      );
    }

    // Normalize act_number (support both act_number and actNumber)
    const actNumber = act.act_number || act.actNumber;
    if (!actNumber || typeof actNumber !== 'string' || actNumber.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Act must have a non-empty act_number or actNumber',
        { act_number: act.act_number, actNumber: act.actNumber }
      );
    }

    // Validate content_raw
    if (!act.content_raw || typeof act.content_raw !== 'string') {
      throw new StorageError(
        StorageErrorType.INTEGRITY_ERROR,
        'Act must have content_raw as a string',
        { hasContentRaw: !!act.content_raw, contentRawType: typeof act.content_raw }
      );
    }

    // Normalize the act object to use act_number consistently
    const normalizedAct = {
      ...act,
      act_number: actNumber.trim()
    };

    // Step 1: Save act to storage backend
    let savedAct;
    if (this._activeBackend === 'indexeddb') {
      savedAct = await this.saveActToIndexedDB(normalizedAct);
    } else if (this._activeBackend === 'chrome_storage') {
      savedAct = await this._saveActToChromeStorage(normalizedAct);
    } else {
      savedAct = await this._saveActToMemory(normalizedAct);
    }

    // Step 2: Generate extraction receipt
    const receipt = await this.generateReceipt(savedAct);

    // Step 3: Save receipt to storage
    await this.saveReceipt(receipt);

    // Step 4: Read back receipt to verify persistence (Requirements: 1.6)
    const receipts = await this.getReceipts({ actId: receipt.act_id });
    const verifiedReceipt = receipts.find(r => r.receipt_id === receipt.receipt_id);

    if (!verifiedReceipt) {
      throw new StorageError(
        StorageErrorType.INTEGRITY_ERROR,
        'Receipt verification failed: receipt not found after save',
        { 
          receiptId: receipt.receipt_id, 
          actId: receipt.act_id,
          receiptsFound: receipts.length
        }
      );
    }

    // Verify receipt fields match
    if (verifiedReceipt.act_id !== receipt.act_id ||
        verifiedReceipt.content_raw_sha256 !== receipt.content_raw_sha256) {
      throw new StorageError(
        StorageErrorType.INTEGRITY_ERROR,
        'Receipt verification failed: receipt fields do not match',
        {
          expected: { act_id: receipt.act_id, content_raw_sha256: receipt.content_raw_sha256 },
          actual: { act_id: verifiedReceipt.act_id, content_raw_sha256: verifiedReceipt.content_raw_sha256 }
        }
      );
    }

    // Return the verified receipt as proof of durable persistence
    return verifiedReceipt;
  },

  /**
   * Save act to chrome.storage (fallback backend)
   * Requirements: 10.1 - Fallback to chrome.storage if IndexedDB unavailable
   * 
   * @param {Object} act - The act to save
   * @returns {Promise<Object>} The saved act with persistence metadata
   */
  async _saveActToChromeStorage(act) {
    // Compute content hash
    const content_raw_sha256 = await this.computeSHA256(act.content_raw);

    // Use ChromeStorageBackend
    return ChromeStorageBackend.saveAct(act, content_raw_sha256);
  },

  /**
   * Save act to memory (ultimate fallback)
   * Requirements: 10.2 - Fallback to memory if chrome.storage unavailable
   * 
   * @param {Object} act - The act to save
   * @returns {Promise<Object>} The saved act with persistence metadata
   */
  async _saveActToMemory(act) {
    // Compute content hash
    const content_raw_sha256 = await this.computeSHA256(act.content_raw);

    // Use MemoryBackend
    return MemoryBackend.saveAct(act, content_raw_sha256);
  },

  /**
   * Load an act by ID
   * Requirements: 3.5 - Retrieve act by act_number key
   * 
   * @param {string} actId - The act_number
   * @returns {Promise<Object|null>}
   */
  async loadAct(actId) {
    // Stub - will be implemented in later tasks
    return null;
  },

  /**
   * Get all extraction receipts (append-only log)
   * Requirements: 1.5, 1.6 - Retrieve receipts for verification
   * 
   * @param {Object} options - Optional filtering options
   * @param {string} options.actId - Filter by act_id
   * @returns {Promise<Object[]>} Array of extraction receipts
   */
  async getReceipts(options = {}) {
    // Handle based on active backend
    if (this._activeBackend === 'indexeddb') {
      return this._getReceiptsFromIndexedDB(options);
    } else if (this._activeBackend === 'chrome_storage') {
      return this._getReceiptsFromChromeStorage(options);
    } else {
      // Memory fallback
      return this._getReceiptsFromMemory(options);
    }
  },

  /**
   * Get receipts from IndexedDB
   * Requirements: 1.5, 1.6 - Return all receipts, support filtering by act_id
   * 
   * @param {Object} options - Filtering options
   * @returns {Promise<Object[]>} Array of receipts
   */
  async _getReceiptsFromIndexedDB(options = {}) {
    // Ensure IndexedDB is initialized
    if (!this._db) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'IndexedDB not initialized. Call initialize() first.',
        {}
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this._db.transaction(['receipts'], 'readonly');
        const store = transaction.objectStore('receipts');
        
        let request;
        
        // If filtering by act_id, use the index
        if (options.actId) {
          const index = store.index('by_act_id');
          request = index.getAll(options.actId);
        } else {
          // Get all receipts
          request = store.getAll();
        }

        request.onsuccess = (event) => {
          const receipts = event.target.result || [];
          resolve(receipts);
        };

        request.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'getReceipts',
            options
          }));
        };

        // Handle transaction errors
        transaction.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'getReceipts',
            options
          }));
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'getReceipts',
          options
        }));
      }
    });
  },

  /**
   * Get receipts from chrome.storage (fallback)
   * Requirements: 1.5, 1.6 - Return all receipts, support filtering
   * 
   * @param {Object} options - Filtering options
   * @returns {Promise<Object[]>} Array of receipts
   */
  async _getReceiptsFromChromeStorage(options = {}) {
    return ChromeStorageBackend.getReceipts(options);
  },

  /**
   * Get receipts from memory (ultimate fallback)
   * Requirements: 1.5, 1.6 - Return all receipts, support filtering
   * 
   * @param {Object} options - Filtering options
   * @returns {Promise<Object[]>} Array of receipts
   */
  async _getReceiptsFromMemory(options = {}) {
    return MemoryBackend.getReceipts(options);
  },

  /**
   * Save an extraction receipt to IndexedDB
   * Requirements: 1.5 - Store extraction_receipts in append-only log
   * 
   * This function appends a receipt to the receipts object store.
   * Receipts are never modified after creation (append-only).
   * 
   * @param {Object} receipt - The extraction receipt to save
   * @returns {Promise<Object>} The saved receipt
   * @throws {StorageError} if receipt is invalid or save fails
   */
  async saveReceipt(receipt) {
    // Validate receipt using ExtractionReceipt.validate
    const validation = ExtractionReceipt.validate(receipt);
    if (!validation.valid) {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        `Invalid receipt: ${validation.errors.join(', ')}`,
        { receipt, errors: validation.errors }
      );
    }

    // Handle based on active backend
    if (this._activeBackend === 'indexeddb') {
      return this._saveReceiptToIndexedDB(receipt);
    } else if (this._activeBackend === 'chrome_storage') {
      return this._saveReceiptToChromeStorage(receipt);
    } else {
      // Memory fallback
      return this._saveReceiptToMemory(receipt);
    }
  },

  /**
   * Save receipt to IndexedDB
   * Requirements: 1.5 - Append to receipts object store, never modify existing
   * 
   * @param {Object} receipt - The receipt to save
   * @returns {Promise<Object>} The saved receipt
   * @throws {StorageError} if save fails
   */
  async _saveReceiptToIndexedDB(receipt) {
    // Ensure IndexedDB is initialized
    if (!this._db) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'IndexedDB not initialized. Call initialize() first.',
        {}
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this._db.transaction(['receipts'], 'readwrite');
        const store = transaction.objectStore('receipts');

        // Handle transaction completion
        transaction.oncomplete = () => {
          resolve(receipt);
        };

        // Handle transaction error
        transaction.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'saveReceipt',
            receiptId: receipt.receipt_id
          }));
        };

        // Handle transaction abort
        transaction.onabort = (event) => {
          const error = event.target.error;
          reject(createStorageError(error || new Error('Transaction aborted'), {
            operation: 'saveReceipt',
            receiptId: receipt.receipt_id
          }));
        };

        // Add the receipt (use add, not put, to ensure append-only behavior)
        // add() will fail if a record with the same key already exists
        const request = store.add(receipt);

        request.onerror = (event) => {
          const error = event.target.error;
          // Don't reject here - let transaction.onerror handle it
          console.error('Add receipt request error:', error);
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'saveReceipt',
          receiptId: receipt.receipt_id
        }));
      }
    });
  },

  /**
   * Save receipt to chrome.storage (fallback)
   * Requirements: 1.5 - Append-only storage
   * 
   * @param {Object} receipt - The receipt to save
   * @returns {Promise<Object>} The saved receipt
   */
  async _saveReceiptToChromeStorage(receipt) {
    return ChromeStorageBackend.saveReceipt(receipt);
  },

  /**
   * Save receipt to memory (ultimate fallback)
   * Requirements: 1.5 - Append-only storage
   * 
   * @param {Object} receipt - The receipt to save
   * @returns {Promise<Object>} The saved receipt
   */
  async _saveReceiptToMemory(receipt) {
    return MemoryBackend.saveReceipt(receipt);
  },

  /**
   * Log extraction intent (write-ahead log)
   * Requirements: 6.1 - Log intent before extraction
   * 
   * Creates a WAL entry with type 'intent' before starting extraction.
   * This enables crash recovery by identifying extractions that were
   * started but not completed.
   * 
   * @param {string} actId - The act_number being extracted
   * @returns {Promise<Object>} The created WAL entry
   * @throws {StorageError} if actId is invalid or write fails
   */
  async logIntent(actId) {
    // Validate actId
    if (!actId || typeof actId !== 'string' || actId.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'actId must be a non-empty string',
        { actId }
      );
    }

    const normalizedActId = actId.trim();

    // Create WAL entry
    const walEntry = {
      entry_id: ExtractionReceipt.generateUUID(),
      act_id: normalizedActId,
      entry_type: 'intent',
      timestamp: new Date().toISOString(),
      content_hash: null, // Only set for 'complete' entries
      session_id: this._sessionId || ExtractionReceipt.generateUUID(),
      pruned: false
    };

    // Store session_id for this extraction session
    if (!this._sessionId) {
      this._sessionId = walEntry.session_id;
    }

    // Handle based on active backend
    if (this._activeBackend === 'indexeddb') {
      return this._saveWALEntryToIndexedDB(walEntry);
    } else if (this._activeBackend === 'chrome_storage') {
      return this._saveWALEntryToChromeStorage(walEntry);
    } else {
      return this._saveWALEntryToMemory(walEntry);
    }
  },

  /**
   * Save WAL entry to IndexedDB
   * Requirements: 6.6 - Store write-ahead log in IndexedDB for durability
   * 
   * @param {Object} walEntry - The WAL entry to save
   * @returns {Promise<Object>} The saved WAL entry
   * @throws {StorageError} if save fails
   */
  async _saveWALEntryToIndexedDB(walEntry) {
    // Ensure IndexedDB is initialized
    if (!this._db) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'IndexedDB not initialized. Call initialize() first.',
        {}
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this._db.transaction(['wal'], 'readwrite');
        const store = transaction.objectStore('wal');

        // Handle transaction completion
        transaction.oncomplete = () => {
          resolve(walEntry);
        };

        // Handle transaction error
        transaction.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'saveWALEntry',
            entryId: walEntry.entry_id,
            entryType: walEntry.entry_type
          }));
        };

        // Handle transaction abort
        transaction.onabort = (event) => {
          const error = event.target.error;
          reject(createStorageError(error || new Error('Transaction aborted'), {
            operation: 'saveWALEntry',
            entryId: walEntry.entry_id,
            entryType: walEntry.entry_type
          }));
        };

        // Add the WAL entry
        const request = store.add(walEntry);

        request.onerror = (event) => {
          const error = event.target.error;
          console.error('Add WAL entry request error:', error);
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'saveWALEntry',
          entryId: walEntry.entry_id,
          entryType: walEntry.entry_type
        }));
      }
    });
  },

  /**
   * Save WAL entry to chrome.storage (fallback)
   * 
   * @param {Object} walEntry - The WAL entry to save
   * @returns {Promise<Object>} The saved WAL entry
   */
  async _saveWALEntryToChromeStorage(walEntry) {
    if (!ChromeStorageBackend.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        { operation: 'saveWALEntry' }
      );
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get([ChromeStorageBackend.WAL_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'saveWALEntry', entryId: walEntry.entry_id }
          ));
          return;
        }

        const walEntries = result[ChromeStorageBackend.WAL_KEY] || [];
        walEntries.push(walEntry);

        chrome.storage.local.set({ [ChromeStorageBackend.WAL_KEY]: walEntries }, () => {
          if (chrome.runtime.lastError) {
            reject(createStorageError(
              new Error(chrome.runtime.lastError.message),
              { operation: 'saveWALEntry', entryId: walEntry.entry_id }
            ));
          } else {
            resolve(walEntry);
          }
        });
      });
    });
  },

  /**
   * Save WAL entry to memory (ultimate fallback)
   * 
   * @param {Object} walEntry - The WAL entry to save
   * @returns {Promise<Object>} The saved WAL entry
   */
  async _saveWALEntryToMemory(walEntry) {
    MemoryBackend.showVolatilityWarning();
    MemoryBackend._wal.push(walEntry);
    return walEntry;
  },

  /**
   * Mark extraction complete (write-ahead log)
   * Requirements: 6.2 - Log completion after extraction
   * 
   * Creates a WAL entry with type 'complete' after successful extraction.
   * This marks the extraction as finished and includes the content hash
   * for verification.
   * 
   * @param {string} actId - The act_number that was extracted
   * @param {string} contentHash - SHA-256 hash of the extracted content
   * @returns {Promise<Object>} The created WAL entry
   * @throws {StorageError} if parameters are invalid or write fails
   */
  async logComplete(actId, contentHash) {
    // Validate actId
    if (!actId || typeof actId !== 'string' || actId.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'actId must be a non-empty string',
        { actId }
      );
    }

    // Validate contentHash
    if (!contentHash || typeof contentHash !== 'string' || 
        !/^[a-fA-F0-9]{64}$/.test(contentHash)) {
      throw new StorageError(
        StorageErrorType.INTEGRITY_ERROR,
        'contentHash must be a valid SHA-256 hash (64 hex characters)',
        { contentHash }
      );
    }

    const normalizedActId = actId.trim();

    // Create WAL entry
    const walEntry = {
      entry_id: ExtractionReceipt.generateUUID(),
      act_id: normalizedActId,
      entry_type: 'complete',
      timestamp: new Date().toISOString(),
      content_hash: contentHash.toLowerCase(),
      session_id: this._sessionId || ExtractionReceipt.generateUUID(),
      pruned: false
    };

    // Handle based on active backend
    if (this._activeBackend === 'indexeddb') {
      return this._saveWALEntryToIndexedDB(walEntry);
    } else if (this._activeBackend === 'chrome_storage') {
      return this._saveWALEntryToChromeStorage(walEntry);
    } else {
      return this._saveWALEntryToMemory(walEntry);
    }
  },

  /**
   * Get current storage status
   * Requirements: 2.1, 2.4 - Monitor storage usage and display status
   * 
   * Returns a comprehensive status object including:
   * - Current backend in use
   * - Usage bytes and quota bytes
   * - Usage percentage
   * - Warning and critical threshold flags
   * - Health status
   * 
   * @returns {Promise<Object>} Storage status object with thresholds
   */
  async getStorageStatus() {
    const status = {
      backend: this._activeBackend || 'unknown',
      usageBytes: 0,
      quotaBytes: 0,
      usagePercent: 0,
      warningThreshold: this.WARNING_THRESHOLD,
      criticalThreshold: this.CRITICAL_THRESHOLD,
      isWarning: false,
      isCritical: false,
      isHealthy: true,
      degradedMode: this._activeBackend !== 'indexeddb',
      lastChecked: new Date().toISOString()
    };

    try {
      // Get storage usage based on active backend
      if (this._activeBackend === 'indexeddb') {
        // For IndexedDB, we estimate usage via navigator.storage API if available
        // or fall back to chrome.storage.local for quota info
        const idbUsage = await this._getIndexedDBUsage();
        status.usageBytes = idbUsage.usageBytes;
        status.quotaBytes = idbUsage.quotaBytes;
      } else if (this._activeBackend === 'chrome_storage') {
        // Get chrome.storage.local usage
        const chromeUsage = await this._getChromeStorageUsage();
        status.usageBytes = chromeUsage.usageBytes;
        status.quotaBytes = chromeUsage.quotaBytes;
      } else {
        // Memory backend - estimate from in-memory store
        const memoryUsage = this._getMemoryUsage();
        status.usageBytes = memoryUsage.usageBytes;
        status.quotaBytes = memoryUsage.quotaBytes;
      }

      // Calculate usage percentage
      if (status.quotaBytes > 0) {
        status.usagePercent = (status.usageBytes / status.quotaBytes) * 100;
      }

      // Set threshold flags (Requirements: 2.2, 2.3)
      status.isWarning = status.usagePercent >= this.WARNING_THRESHOLD;
      status.isCritical = status.usagePercent >= this.CRITICAL_THRESHOLD;
      status.isHealthy = !status.isCritical && !status.degradedMode;

    } catch (e) {
      // If we can't get storage status, mark as unhealthy but don't throw
      console.error('Failed to get storage status:', e);
      status.isHealthy = false;
      status.error = e.message;
    }

    return status;
  },

  /**
   * Get IndexedDB storage usage
   * Uses navigator.storage API if available, otherwise estimates
   * 
   * @returns {Promise<{usageBytes: number, quotaBytes: number}>}
   */
  async _getIndexedDBUsage() {
    // Try navigator.storage.estimate() first (modern browsers)
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usageBytes: estimate.usage || 0,
          quotaBytes: estimate.quota || (50 * 1024 * 1024) // Default 50MB if not available
        };
      } catch (e) {
        console.warn('navigator.storage.estimate() failed:', e);
      }
    }

    // Fallback: estimate from chrome.storage.local if available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return this._getChromeStorageUsage();
    }

    // Ultimate fallback: return default values
    // IndexedDB typically has much larger quota (50% of disk space)
    return {
      usageBytes: 0,
      quotaBytes: 50 * 1024 * 1024 // 50MB default
    };
  },

  /**
   * Get chrome.storage.local usage
   * Requirements: 2.1 - Monitor chrome.storage.local usage before each write
   * 
   * @returns {Promise<{usageBytes: number, quotaBytes: number}>}
   */
  async _getChromeStorageUsage() {
    return new Promise((resolve, reject) => {
      // Check if chrome.storage is available
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        resolve({
          usageBytes: 0,
          quotaBytes: 10 * 1024 * 1024 // 10MB default for chrome.storage.local
        });
        return;
      }

      // Get bytes in use
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('Failed to get chrome.storage usage:', chrome.runtime.lastError);
          resolve({
            usageBytes: 0,
            quotaBytes: 10 * 1024 * 1024
          });
          return;
        }

        // chrome.storage.local quota is typically 10MB for extensions
        // Can be increased with "unlimitedStorage" permission
        const quotaBytes = chrome.storage.local.QUOTA_BYTES || (10 * 1024 * 1024);

        resolve({
          usageBytes: bytesInUse || 0,
          quotaBytes: quotaBytes
        });
      });
    });
  },

  /**
   * Get memory backend usage estimate
   * 
   * @returns {{usageBytes: number, quotaBytes: number}}
   */
  _getMemoryUsage() {
    // Estimate memory usage from in-memory store
    let usageBytes = 0;

    // Estimate acts size
    for (const [key, act] of this._memoryStore.acts) {
      usageBytes += JSON.stringify(act).length * 2; // UTF-16 encoding
    }

    // Estimate receipts size
    usageBytes += JSON.stringify(this._memoryStore.receipts).length * 2;

    // Estimate WAL size
    usageBytes += JSON.stringify(this._memoryStore.wal).length * 2;

    // Estimate audit log size
    usageBytes += JSON.stringify(this._memoryStore.audit_log).length * 2;

    // Memory backend has no hard quota, but we set a reasonable limit
    // to trigger warnings (100MB)
    return {
      usageBytes,
      quotaBytes: 100 * 1024 * 1024 // 100MB soft limit for memory
    };
  },

  /**
   * Check storage quota before write operation
   * Requirements: 2.2, 2.3, 2.6 - Check quota, warn at 80%, pause at 95%
   * 
   * @returns {Promise<{canWrite: boolean, status: Object}>}
   * @throws {StorageError} if quota is exceeded and write should be blocked
   */
  async checkQuotaBeforeWrite() {
    const status = await this.getStorageStatus();

    // At critical threshold (95%), block writes and throw error
    // Requirements: 2.3, 2.6 - Pause processing and display error
    if (status.isCritical) {
      throw new StorageError(
        StorageErrorType.QUOTA_EXCEEDED,
        `Storage quota critical (${status.usagePercent.toFixed(1)}% used). Please export data to free up space.`,
        {
          usageBytes: status.usageBytes,
          quotaBytes: status.quotaBytes,
          usagePercent: status.usagePercent,
          threshold: this.CRITICAL_THRESHOLD
        }
      );
    }

    // At warning threshold (80%), allow write but flag warning
    // Requirements: 2.2 - Display warning to user
    return {
      canWrite: true,
      status,
      warning: status.isWarning ? 
        `Storage usage at ${status.usagePercent.toFixed(1)}%. Consider exporting data soon.` : 
        null
    };
  },

  /**
   * Get incomplete extractions (intent logged but not complete)
   * Requirements: 6.3 - Identify incomplete extractions for retry
   * 
   * Finds all WAL entries with type 'intent' that do not have a matching
   * 'complete' entry. These represent extractions that were started but
   * not finished, likely due to a crash or side panel closure.
   * 
   * @returns {Promise<Object[]>} Array of incomplete extraction info
   *   Each object contains: { actId, timestamp, entryId }
   */
  async getIncompleteExtractions() {
    // Get all WAL entries
    let walEntries;
    
    if (this._activeBackend === 'indexeddb') {
      walEntries = await this._getWALEntriesFromIndexedDB();
    } else if (this._activeBackend === 'chrome_storage') {
      walEntries = await this._getWALEntriesFromChromeStorage();
    } else {
      walEntries = await this._getWALEntriesFromMemory();
    }

    // Build sets of intent and complete act IDs
    const intentEntries = new Map(); // actId -> entry
    const completeActIds = new Set();

    for (const entry of walEntries) {
      if (entry.pruned) continue; // Skip pruned entries
      
      if (entry.entry_type === 'intent') {
        // Store the most recent intent for each act
        const existing = intentEntries.get(entry.act_id);
        if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
          intentEntries.set(entry.act_id, entry);
        }
      } else if (entry.entry_type === 'complete') {
        completeActIds.add(entry.act_id);
      }
    }

    // Find intents without matching completes
    const incompleteExtractions = [];
    for (const [actId, intentEntry] of intentEntries) {
      if (!completeActIds.has(actId)) {
        incompleteExtractions.push({
          actId: intentEntry.act_id,
          timestamp: intentEntry.timestamp,
          entryId: intentEntry.entry_id,
          sessionId: intentEntry.session_id
        });
      }
    }

    // Sort by timestamp (oldest first)
    incompleteExtractions.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    return incompleteExtractions;
  },

  /**
   * Get all WAL entries from IndexedDB
   * 
   * @returns {Promise<Object[]>} Array of WAL entries
   */
  async _getWALEntriesFromIndexedDB() {
    // Ensure IndexedDB is initialized
    if (!this._db) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'IndexedDB not initialized. Call initialize() first.',
        {}
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this._db.transaction(['wal'], 'readonly');
        const store = transaction.objectStore('wal');
        const request = store.getAll();

        request.onsuccess = (event) => {
          resolve(event.target.result || []);
        };

        request.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'getWALEntries'
          }));
        };

        transaction.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'getWALEntries'
          }));
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'getWALEntries'
        }));
      }
    });
  },

  /**
   * Get all WAL entries from chrome.storage
   * 
   * @returns {Promise<Object[]>} Array of WAL entries
   */
  async _getWALEntriesFromChromeStorage() {
    if (!ChromeStorageBackend.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        { operation: 'getWALEntries' }
      );
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get([ChromeStorageBackend.WAL_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'getWALEntries' }
          ));
          return;
        }

        resolve(result[ChromeStorageBackend.WAL_KEY] || []);
      });
    });
  },

  /**
   * Get all WAL entries from memory
   * 
   * @returns {Promise<Object[]>} Array of WAL entries
   */
  async _getWALEntriesFromMemory() {
    return [...MemoryBackend._wal];
  },

  /**
   * Generate an extraction receipt for an act
   * Requirements: 1.4 - Generate extraction_receipt containing act_id, content_hash, and timestamp
   * 
   * @param {Object} act - The act to generate a receipt for (must have act_number and content_raw)
   * @returns {Promise<Object>} ExtractionReceipt with all required fields
   * @throws {StorageError} if act is invalid or hash computation fails
   */
  async generateReceipt(act) {
    // Validate act object
    if (!act || typeof act !== 'object') {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Act must be a non-null object',
        { act }
      );
    }

    // Validate required fields
    const actId = act.act_number || act.actNumber;
    if (!actId || typeof actId !== 'string' || actId.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Act must have a non-empty act_number or actNumber',
        { act_number: act.act_number, actNumber: act.actNumber }
      );
    }

    if (!act.content_raw || typeof act.content_raw !== 'string') {
      throw new StorageError(
        StorageErrorType.INTEGRITY_ERROR,
        'Act must have content_raw as a string for receipt generation',
        { hasContentRaw: !!act.content_raw, contentRawType: typeof act.content_raw }
      );
    }

    // Compute content_raw_sha256 hash
    const content_raw_sha256 = await this.computeSHA256(act.content_raw);

    // Determine storage backend
    const storage_backend = this._activeBackend || 'memory';

    // Create and return the receipt using ExtractionReceipt factory
    return ExtractionReceipt.create({
      act_id: actId.trim(),
      content_raw_sha256,
      storage_backend
    });
  },

  /**
   * Get the current active backend
   * @returns {string|null}
   */
  getActiveBackend() {
    return this._activeBackend;
  },

  /**
   * Check if operating in degraded mode
   * Requirements: 10.4 - Warn when not using IndexedDB
   * 
   * @returns {boolean}
   */
  isDegradedMode() {
    return this._activeBackend !== 'indexeddb';
  },

  // ============================================
  // AUDIT LOG FUNCTIONS
  // Requirements: 9.1, 9.2, 9.3, 9.4, 9.6
  // ============================================

  /**
   * Valid audit log operation types
   * Requirements: 9.2 - Log specific operation types
   */
  AUDIT_OPERATIONS: [
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
    'state_reconstruction',
    'queue_processing_started',
    'queue_processing_resumed',
    'queue_processing_paused',
    'queue_processing_completed'
  ],

  /**
   * Log an audit entry to the audit log
   * Requirements: 9.1, 9.2, 9.3 - Append-only audit log with required fields
   * 
   * Creates an audit log entry with timestamp, operation, and context.
   * Entries are append-only and never modified after creation.
   * 
   * @param {Object} entry - The audit entry to log
   * @param {string} entry.operation - The operation type (one of AUDIT_OPERATIONS)
   * @param {Object} [entry.context] - Additional context for the operation
   * @param {string} [entry.actId] - Related act ID if applicable
   * @param {string} [entry.outcome] - Outcome of the operation (success/failure/etc)
   * @param {string} [entry.contentHash] - Content hash if applicable
   * @param {string} [entry.storageLocation] - Storage location if applicable
   * @returns {Promise<Object>} The saved audit log entry with log_id and timestamp
   * @throws {StorageError} if entry is invalid or save fails
   */
  async logAuditEntry(entry) {
    // Validate entry object
    if (!entry || typeof entry !== 'object') {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Audit entry must be a non-null object',
        { entry }
      );
    }

    // Validate operation field
    if (!entry.operation || typeof entry.operation !== 'string') {
      throw new StorageError(
        StorageErrorType.UNKNOWN_ERROR,
        'Audit entry must have an operation field',
        { entry }
      );
    }

    // Warn if operation is not in known list (but don't reject - allow extensibility)
    if (!this.AUDIT_OPERATIONS.includes(entry.operation)) {
      console.warn(`Unknown audit operation type: ${entry.operation}`);
    }

    // Create the audit log entry with required fields
    const auditEntry = {
      // log_id is auto-generated by IndexedDB (autoIncrement)
      timestamp: new Date().toISOString(),
      operation: entry.operation,
      context: entry.context || {},
      // Optional fields from Requirements 9.2
      actId: entry.actId || null,
      outcome: entry.outcome || null,
      contentHash: entry.contentHash || null,
      storageLocation: entry.storageLocation || this._activeBackend || null
    };

    // Handle based on active backend
    if (this._activeBackend === 'indexeddb') {
      return this._saveAuditEntryToIndexedDB(auditEntry);
    } else if (this._activeBackend === 'chrome_storage') {
      return this._saveAuditEntryToChromeStorage(auditEntry);
    } else {
      return this._saveAuditEntryToMemory(auditEntry);
    }
  },

  /**
   * Save audit entry to IndexedDB
   * Requirements: 9.1, 9.6 - Append-only, never modify or delete
   * 
   * @param {Object} auditEntry - The audit entry to save
   * @returns {Promise<Object>} The saved entry with log_id
   * @throws {StorageError} if save fails
   */
  async _saveAuditEntryToIndexedDB(auditEntry) {
    // Ensure IndexedDB is initialized
    if (!this._db) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'IndexedDB not initialized. Call initialize() first.',
        {}
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this._db.transaction(['audit_log'], 'readwrite');
        const store = transaction.objectStore('audit_log');

        // Use add() for append-only behavior
        const request = store.add(auditEntry);

        request.onsuccess = (event) => {
          // IndexedDB returns the auto-generated key
          const logId = event.target.result;
          resolve({
            ...auditEntry,
            log_id: logId
          });
        };

        request.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'saveAuditEntry',
            auditOperation: auditEntry.operation
          }));
        };

        // Handle transaction errors
        transaction.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'saveAuditEntry',
            auditOperation: auditEntry.operation
          }));
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'saveAuditEntry',
          auditOperation: auditEntry.operation
        }));
      }
    });
  },

  /**
   * Save audit entry to chrome.storage (fallback)
   * Requirements: 9.1, 9.6 - Append-only storage
   * 
   * @param {Object} auditEntry - The audit entry to save
   * @returns {Promise<Object>} The saved entry with log_id
   */
  async _saveAuditEntryToChromeStorage(auditEntry) {
    if (!ChromeStorageBackend.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        { operation: 'saveAuditEntry' }
      );
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get([ChromeStorageBackend.AUDIT_LOG_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'saveAuditEntry', auditOperation: auditEntry.operation }
          ));
          return;
        }

        const auditLog = result[ChromeStorageBackend.AUDIT_LOG_KEY] || [];
        
        // Generate a log_id (simulate autoIncrement)
        const logId = auditLog.length > 0 
          ? Math.max(...auditLog.map(e => e.log_id || 0)) + 1 
          : 1;
        
        const entryWithId = {
          ...auditEntry,
          log_id: logId
        };
        
        // Append the new entry
        auditLog.push(entryWithId);

        chrome.storage.local.set({ [ChromeStorageBackend.AUDIT_LOG_KEY]: auditLog }, () => {
          if (chrome.runtime.lastError) {
            reject(createStorageError(
              new Error(chrome.runtime.lastError.message),
              { operation: 'saveAuditEntry', auditOperation: auditEntry.operation }
            ));
          } else {
            resolve(entryWithId);
          }
        });
      });
    });
  },

  /**
   * Save audit entry to memory (ultimate fallback)
   * Requirements: 9.1, 9.6 - Append-only storage
   * 
   * @param {Object} auditEntry - The audit entry to save
   * @returns {Promise<Object>} The saved entry with log_id
   */
  async _saveAuditEntryToMemory(auditEntry) {
    MemoryBackend.showVolatilityWarning();
    
    // Generate a log_id (simulate autoIncrement)
    const logId = MemoryBackend._auditLog.length > 0
      ? Math.max(...MemoryBackend._auditLog.map(e => e.log_id || 0)) + 1
      : 1;
    
    const entryWithId = {
      ...auditEntry,
      log_id: logId
    };
    
    // Append to memory audit log
    MemoryBackend._auditLog.push(entryWithId);
    
    return entryWithId;
  },

  /**
   * Get audit log entries with optional filtering
   * Requirements: 9.4 - Support filtering by operation type and date range
   * 
   * @param {Object} [options] - Filtering options
   * @param {string} [options.operation] - Filter by operation type
   * @param {string} [options.startDate] - Filter entries after this ISO-8601 date
   * @param {string} [options.endDate] - Filter entries before this ISO-8601 date
   * @param {string} [options.actId] - Filter by related act ID
   * @param {number} [options.limit] - Maximum number of entries to return
   * @returns {Promise<Object[]>} Array of audit log entries
   */
  async getAuditLog(options = {}) {
    // Handle based on active backend
    let entries;
    
    if (this._activeBackend === 'indexeddb') {
      entries = await this._getAuditLogFromIndexedDB(options);
    } else if (this._activeBackend === 'chrome_storage') {
      entries = await this._getAuditLogFromChromeStorage(options);
    } else {
      entries = await this._getAuditLogFromMemory(options);
    }

    // Apply additional filtering that may not be handled by backend
    return this._filterAuditEntries(entries, options);
  },

  /**
   * Get audit log from IndexedDB
   * Requirements: 9.4 - Support filtering by operation type
   * 
   * @param {Object} options - Filtering options
   * @returns {Promise<Object[]>} Array of audit log entries
   */
  async _getAuditLogFromIndexedDB(options = {}) {
    // Ensure IndexedDB is initialized
    if (!this._db) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'IndexedDB not initialized. Call initialize() first.',
        {}
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this._db.transaction(['audit_log'], 'readonly');
        const store = transaction.objectStore('audit_log');
        
        let request;
        
        // If filtering by operation, use the index
        if (options.operation) {
          const index = store.index('by_operation');
          request = index.getAll(options.operation);
        } else {
          // Get all entries
          request = store.getAll();
        }

        request.onsuccess = (event) => {
          const entries = event.target.result || [];
          resolve(entries);
        };

        request.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'getAuditLog',
            options
          }));
        };

        // Handle transaction errors
        transaction.onerror = (event) => {
          const error = event.target.error;
          reject(createStorageError(error, {
            operation: 'getAuditLog',
            options
          }));
        };
      } catch (e) {
        reject(createStorageError(e, {
          operation: 'getAuditLog',
          options
        }));
      }
    });
  },

  /**
   * Get audit log from chrome.storage (fallback)
   * Requirements: 9.4 - Support filtering
   * 
   * @param {Object} options - Filtering options
   * @returns {Promise<Object[]>} Array of audit log entries
   */
  async _getAuditLogFromChromeStorage(options = {}) {
    if (!ChromeStorageBackend.isAvailable()) {
      throw new StorageError(
        StorageErrorType.BACKEND_UNAVAILABLE,
        'chrome.storage.local is not available',
        { operation: 'getAuditLog' }
      );
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get([ChromeStorageBackend.AUDIT_LOG_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(createStorageError(
            new Error(chrome.runtime.lastError.message),
            { operation: 'getAuditLog', options }
          ));
          return;
        }

        const entries = result[ChromeStorageBackend.AUDIT_LOG_KEY] || [];
        resolve(entries);
      });
    });
  },

  /**
   * Get audit log from memory (ultimate fallback)
   * Requirements: 9.4 - Support filtering
   * 
   * @param {Object} options - Filtering options
   * @returns {Promise<Object[]>} Array of audit log entries
   */
  async _getAuditLogFromMemory(options = {}) {
    return [...MemoryBackend._auditLog];
  },

  /**
   * Filter audit entries based on options
   * Requirements: 9.4 - Support filtering by operation type and date range
   * 
   * @param {Object[]} entries - Audit log entries to filter
   * @param {Object} options - Filtering options
   * @returns {Object[]} Filtered entries
   */
  _filterAuditEntries(entries, options = {}) {
    let filtered = [...entries];

    // Filter by operation type (if not already filtered by IndexedDB index)
    if (options.operation && this._activeBackend !== 'indexeddb') {
      filtered = filtered.filter(e => e.operation === options.operation);
    }

    // Filter by date range - startDate
    if (options.startDate) {
      const startDate = new Date(options.startDate);
      if (!isNaN(startDate.getTime())) {
        filtered = filtered.filter(e => {
          const entryDate = new Date(e.timestamp);
          return !isNaN(entryDate.getTime()) && entryDate >= startDate;
        });
      }
    }

    // Filter by date range - endDate
    if (options.endDate) {
      const endDate = new Date(options.endDate);
      if (!isNaN(endDate.getTime())) {
        filtered = filtered.filter(e => {
          const entryDate = new Date(e.timestamp);
          return !isNaN(entryDate.getTime()) && entryDate <= endDate;
        });
      }
    }

    // Filter by actId
    if (options.actId) {
      filtered = filtered.filter(e => e.actId === options.actId);
    }

    // Sort by timestamp (oldest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateA - dateB;
    });

    // Apply limit
    if (options.limit && typeof options.limit === 'number' && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }
};

// ============================================
// EXPORT CHECKPOINT SYSTEM
// Requirements: 8.1, 8.2, 8.3, 8.7
// ============================================

/**
 * Export Checkpoint Manager
 * Tracks export state and prompts user to export after N acts
 * 
 * Requirements:
 * - 8.1: Prompt user to export after N acts extracted since last export
 * - 8.2: Track last_export_timestamp and acts_since_export counter
 * - 8.3: Allow dismiss but re-prompt after another N acts
 * - 8.7: Allow configuring threshold between 10 and 200 acts
 */
const ExportCheckpointManager = {
  // Storage key for export tracking state
  EXPORT_STATE_KEY: 'bdlaw_export_checkpoint_state',
  
  // Default threshold (N=50)
  DEFAULT_THRESHOLD: 50,
  
  // Threshold bounds (Requirements: 8.7)
  MIN_THRESHOLD: 10,
  MAX_THRESHOLD: 200,
  
  // In-memory cache of export state
  _state: null,
  
  // Prompt callback (set by UI)
  _promptCallback: null,
  
  /**
   * Get the current export tracking state
   * Requirements: 8.2 - Track last_export_timestamp and acts_since_export
   * 
   * @returns {Promise<{
   *   last_export_timestamp: string|null,
   *   acts_since_export: number,
   *   threshold: number,
   *   prompt_displayed: boolean,
   *   prompt_dismissed_at: string|null
   * }>}
   */
  async getState() {
    // Return cached state if available
    if (this._state) {
      return { ...this._state };
    }
    
    // Load from chrome.storage.local
    const state = await this._loadState();
    this._state = state;
    return { ...state };
  },
  
  /**
   * Load export state from chrome.storage.local
   * Requirements: 8.2 - Persist to chrome.storage.local
   * 
   * @returns {Promise<Object>}
   */
  async _loadState() {
    // Default state
    const defaultState = {
      last_export_timestamp: null,
      acts_since_export: 0,
      threshold: this.DEFAULT_THRESHOLD,
      prompt_displayed: false,
      prompt_dismissed_at: null
    };
    
    // Check if chrome.storage is available
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return defaultState;
    }
    
    return new Promise((resolve) => {
      chrome.storage.local.get([this.EXPORT_STATE_KEY], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('Failed to load export checkpoint state:', chrome.runtime.lastError);
          resolve(defaultState);
          return;
        }
        
        const stored = result[this.EXPORT_STATE_KEY];
        if (!stored || typeof stored !== 'object') {
          resolve(defaultState);
          return;
        }
        
        // Merge with defaults to ensure all fields exist
        resolve({
          ...defaultState,
          ...stored,
          // Ensure threshold is within bounds
          threshold: this._clampThreshold(stored.threshold || this.DEFAULT_THRESHOLD)
        });
      });
    });
  },
  
  /**
   * Save export state to chrome.storage.local
   * Requirements: 8.2 - Persist to chrome.storage.local
   * 
   * @param {Object} state - The state to save
   * @returns {Promise<void>}
   */
  async _saveState(state) {
    // Update cache
    this._state = { ...state };
    
    // Check if chrome.storage is available
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [this.EXPORT_STATE_KEY]: state }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('Failed to save export checkpoint state:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  },
  
  /**
   * Clamp threshold to valid range
   * Requirements: 8.7 - Threshold between 10 and 200
   * 
   * @param {number} value - The threshold value to clamp
   * @returns {number} Clamped threshold value
   */
  _clampThreshold(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      return this.DEFAULT_THRESHOLD;
    }
    return Math.max(this.MIN_THRESHOLD, Math.min(this.MAX_THRESHOLD, Math.round(value)));
  },
  
  /**
   * Set the export checkpoint threshold
   * Requirements: 8.7 - Allow configuring threshold between 10 and 200
   * 
   * @param {number} threshold - The new threshold value
   * @returns {Promise<{threshold: number, clamped: boolean}>}
   */
  async setThreshold(threshold) {
    const state = await this.getState();
    const originalValue = threshold;
    const clampedValue = this._clampThreshold(threshold);
    const clamped = clampedValue !== originalValue;
    
    state.threshold = clampedValue;
    await this._saveState(state);
    
    return {
      threshold: clampedValue,
      clamped,
      originalValue: clamped ? originalValue : undefined
    };
  },
  
  /**
   * Get the current threshold
   * Requirements: 8.7
   * 
   * @returns {Promise<number>}
   */
  async getThreshold() {
    const state = await this.getState();
    return state.threshold;
  },
  
  /**
   * Record that an act was extracted
   * Requirements: 8.1, 8.2, 8.3 - Track acts and trigger prompt
   * 
   * This should be called after each successful act extraction.
   * It increments the acts_since_export counter and checks if
   * the threshold has been reached.
   * 
   * @returns {Promise<{
   *   acts_since_export: number,
   *   threshold: number,
   *   should_prompt: boolean
   * }>}
   */
  async recordExtraction() {
    const state = await this.getState();
    
    // Increment counter
    state.acts_since_export = (state.acts_since_export || 0) + 1;
    
    // Check if threshold reached
    const shouldPrompt = state.acts_since_export >= state.threshold;
    
    // Update prompt_displayed flag if threshold reached
    if (shouldPrompt && !state.prompt_displayed) {
      state.prompt_displayed = true;
    }
    
    await this._saveState(state);
    
    // Trigger callback if prompt should be shown
    if (shouldPrompt && this._promptCallback) {
      try {
        this._promptCallback({
          acts_since_export: state.acts_since_export,
          threshold: state.threshold,
          last_export_timestamp: state.last_export_timestamp
        });
      } catch (e) {
        console.error('Export prompt callback error:', e);
      }
    }
    
    return {
      acts_since_export: state.acts_since_export,
      threshold: state.threshold,
      should_prompt: shouldPrompt
    };
  },
  
  /**
   * Check if export prompt should be displayed
   * Requirements: 8.1, 8.3 - Trigger prompt when threshold reached
   * 
   * @returns {Promise<{
   *   should_prompt: boolean,
   *   acts_since_export: number,
   *   threshold: number
   * }>}
   */
  async shouldPromptExport() {
    const state = await this.getState();
    const shouldPrompt = state.acts_since_export >= state.threshold;
    
    return {
      should_prompt: shouldPrompt,
      acts_since_export: state.acts_since_export,
      threshold: state.threshold
    };
  },
  
  /**
   * Record that user dismissed the export prompt
   * Requirements: 8.3 - Allow dismiss but re-prompt after another N acts
   * 
   * Resets the counter so the prompt will appear again after
   * another N acts are extracted.
   * 
   * @returns {Promise<{
   *   acts_since_export: number,
   *   prompt_dismissed_at: string
   * }>}
   */
  async dismissPrompt() {
    const state = await this.getState();
    
    // Reset counter for re-prompt after another N acts
    state.acts_since_export = 0;
    state.prompt_displayed = false;
    state.prompt_dismissed_at = new Date().toISOString();
    
    await this._saveState(state);
    
    return {
      acts_since_export: state.acts_since_export,
      prompt_dismissed_at: state.prompt_dismissed_at
    };
  },
  
  /**
   * Record that user completed an export
   * Requirements: 8.2, 8.3 - Track last_export_timestamp, reset counter
   * 
   * @returns {Promise<{
   *   last_export_timestamp: string,
   *   acts_since_export: number
   * }>}
   */
  async recordExport() {
    const state = await this.getState();
    
    // Update export timestamp
    state.last_export_timestamp = new Date().toISOString();
    
    // Reset counter
    state.acts_since_export = 0;
    state.prompt_displayed = false;
    state.prompt_dismissed_at = null;
    
    await this._saveState(state);
    
    return {
      last_export_timestamp: state.last_export_timestamp,
      acts_since_export: state.acts_since_export
    };
  },
  
  /**
   * Set the prompt callback function
   * Called when export prompt should be displayed
   * 
   * @param {Function} callback - Function to call when prompt should show
   */
  setPromptCallback(callback) {
    if (typeof callback === 'function') {
      this._promptCallback = callback;
    }
  },
  
  /**
   * Reset the export checkpoint state (for testing)
   * 
   * @returns {Promise<void>}
   */
  async reset() {
    const defaultState = {
      last_export_timestamp: null,
      acts_since_export: 0,
      threshold: this.DEFAULT_THRESHOLD,
      prompt_displayed: false,
      prompt_dismissed_at: null
    };
    
    await this._saveState(defaultState);
  },
  
  /**
   * Clear the in-memory cache (for testing)
   */
  clearCache() {
    this._state = null;
    this._promptCallback = null;
  }
};

// ============================================
// EXPORT PROGRESS TRACKER
// Requirements: 12.1, 12.2, 12.3, 12.5
// ============================================

/**
 * Export Progress Tracker
 * Tracks per-act export progress and enables resume capability
 * 
 * Requirements:
 * - 12.1: Track export progress per act
 * - 12.2: Allow resuming from last successful act
 * - 12.3: NOT mark acts as exported until file download is confirmed
 * - 12.5: Implement rate limiting for downloads
 */
const ExportProgressTracker = {
  // Storage key for export progress state
  EXPORT_PROGRESS_KEY: 'bdlaw_export_progress_state',
  
  // Default rate limit delay (500ms)
  DEFAULT_RATE_LIMIT_MS: 500,
  
  // Rate limit bounds
  MIN_RATE_LIMIT_MS: 100,
  MAX_RATE_LIMIT_MS: 5000,
  
  // In-memory cache of export progress state
  _state: null,
  
  // Progress callback (set by UI)
  _progressCallback: null,
  
  /**
   * Get the current export progress state
   * Requirements: 12.1 - Track export progress per act
   * 
   * @returns {Promise<{
   *   export_id: string|null,
   *   total_acts: number,
   *   current_index: number,
   *   exported_act_ids: string[],
   *   failed_act_ids: string[],
   *   status: 'idle'|'in_progress'|'paused'|'completed'|'cancelled',
   *   started_at: string|null,
   *   last_updated_at: string|null,
   *   rate_limit_ms: number
   * }>}
   */
  async getState() {
    // Return cached state if available
    if (this._state) {
      return { ...this._state };
    }
    
    // Load from chrome.storage.local
    const state = await this._loadState();
    this._state = state;
    return { ...state };
  },
  
  /**
   * Load export progress state from chrome.storage.local
   * Requirements: 12.1 - Persist progress to storage
   * 
   * @returns {Promise<Object>}
   */
  async _loadState() {
    // Default state
    const defaultState = {
      export_id: null,
      total_acts: 0,
      current_index: 0,
      exported_act_ids: [],
      failed_act_ids: [],
      status: 'idle',
      started_at: null,
      last_updated_at: null,
      rate_limit_ms: this.DEFAULT_RATE_LIMIT_MS
    };
    
    // Check if chrome.storage is available
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return defaultState;
    }
    
    return new Promise((resolve) => {
      chrome.storage.local.get([this.EXPORT_PROGRESS_KEY], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('Failed to load export progress state:', chrome.runtime.lastError);
          resolve(defaultState);
          return;
        }
        
        const stored = result[this.EXPORT_PROGRESS_KEY];
        if (!stored || typeof stored !== 'object') {
          resolve(defaultState);
          return;
        }
        
        // Merge with defaults to ensure all fields exist
        resolve({
          ...defaultState,
          ...stored,
          // Ensure arrays are arrays
          exported_act_ids: Array.isArray(stored.exported_act_ids) ? stored.exported_act_ids : [],
          failed_act_ids: Array.isArray(stored.failed_act_ids) ? stored.failed_act_ids : [],
          // Ensure rate limit is within bounds
          rate_limit_ms: this._clampRateLimit(stored.rate_limit_ms || this.DEFAULT_RATE_LIMIT_MS)
        });
      });
    });
  },
  
  /**
   * Save export progress state to chrome.storage.local
   * Requirements: 12.1 - Persist progress to storage
   * 
   * @param {Object} state - The state to save
   * @returns {Promise<void>}
   */
  async _saveState(state) {
    // Update cache
    this._state = { ...state };
    
    // Check if chrome.storage is available
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [this.EXPORT_PROGRESS_KEY]: state }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('Failed to save export progress state:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  },
  
  /**
   * Clamp rate limit to valid range
   * Requirements: 12.5 - Rate limiting for downloads
   * 
   * @param {number} value - The rate limit value to clamp
   * @returns {number} Clamped rate limit value
   */
  _clampRateLimit(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      return this.DEFAULT_RATE_LIMIT_MS;
    }
    return Math.max(this.MIN_RATE_LIMIT_MS, Math.min(this.MAX_RATE_LIMIT_MS, Math.round(value)));
  },
  
  /**
   * Generate a unique export ID
   * @returns {string} UUID string
   */
  _generateExportId() {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  
  /**
   * Start a new batch export
   * Requirements: 12.1 - Track export progress per act
   * 
   * @param {string[]} actIds - Array of act IDs to export
   * @returns {Promise<{
   *   export_id: string,
   *   total_acts: number,
   *   status: string
   * }>}
   */
  async startExport(actIds) {
    if (!Array.isArray(actIds) || actIds.length === 0) {
      throw new Error('actIds must be a non-empty array');
    }
    
    const exportId = this._generateExportId();
    const now = new Date().toISOString();
    
    const state = {
      export_id: exportId,
      total_acts: actIds.length,
      current_index: 0,
      exported_act_ids: [],
      failed_act_ids: [],
      status: 'in_progress',
      started_at: now,
      last_updated_at: now,
      rate_limit_ms: (await this.getState()).rate_limit_ms,
      // Store the full list of act IDs for resume capability
      pending_act_ids: [...actIds]
    };
    
    await this._saveState(state);
    
    // Notify progress callback
    this._notifyProgress(state);
    
    return {
      export_id: exportId,
      total_acts: actIds.length,
      status: 'in_progress'
    };
  },
  
  /**
   * Record successful export of an act
   * Requirements: 12.1, 12.3 - Track progress, only mark after download confirmed
   * 
   * @param {string} actId - The act ID that was successfully exported
   * @returns {Promise<{
   *   current_index: number,
   *   total_acts: number,
   *   progress_percent: number,
   *   status: string
   * }>}
   */
  async recordActExported(actId) {
    const state = await this.getState();
    
    if (state.status !== 'in_progress') {
      throw new Error(`Cannot record export: status is ${state.status}`);
    }
    
    // Add to exported list if not already there
    if (!state.exported_act_ids.includes(actId)) {
      state.exported_act_ids.push(actId);
    }
    
    // Remove from pending if present
    if (state.pending_act_ids) {
      state.pending_act_ids = state.pending_act_ids.filter(id => id !== actId);
    }
    
    // Update current index
    state.current_index = state.exported_act_ids.length;
    state.last_updated_at = new Date().toISOString();
    
    // Check if export is complete
    if (state.current_index >= state.total_acts) {
      state.status = 'completed';
    }
    
    await this._saveState(state);
    
    // Notify progress callback
    this._notifyProgress(state);
    
    const progressPercent = state.total_acts > 0 
      ? Math.round((state.current_index / state.total_acts) * 100) 
      : 0;
    
    return {
      current_index: state.current_index,
      total_acts: state.total_acts,
      progress_percent: progressPercent,
      status: state.status
    };
  },
  
  /**
   * Record failed export of an act
   * Requirements: 12.1 - Track progress including failures
   * 
   * @param {string} actId - The act ID that failed to export
   * @param {string} error - Error message
   * @returns {Promise<{
   *   current_index: number,
   *   total_acts: number,
   *   failed_count: number,
   *   status: string
   * }>}
   */
  async recordActFailed(actId, error) {
    const state = await this.getState();
    
    if (state.status !== 'in_progress') {
      throw new Error(`Cannot record failure: status is ${state.status}`);
    }
    
    // Add to failed list if not already there
    if (!state.failed_act_ids.includes(actId)) {
      state.failed_act_ids.push(actId);
    }
    
    // Remove from pending if present
    if (state.pending_act_ids) {
      state.pending_act_ids = state.pending_act_ids.filter(id => id !== actId);
    }
    
    // Update current index (count both exported and failed)
    state.current_index = state.exported_act_ids.length + state.failed_act_ids.length;
    state.last_updated_at = new Date().toISOString();
    
    // Check if export is complete (all acts processed, even if some failed)
    if (state.current_index >= state.total_acts) {
      state.status = 'completed';
    }
    
    await this._saveState(state);
    
    // Notify progress callback
    this._notifyProgress(state);
    
    return {
      current_index: state.current_index,
      total_acts: state.total_acts,
      failed_count: state.failed_act_ids.length,
      status: state.status
    };
  },
  
  /**
   * Check if there's an interrupted export that can be resumed
   * Requirements: 12.2 - Detect interrupted exports
   * 
   * @returns {Promise<{
   *   can_resume: boolean,
   *   export_id: string|null,
   *   remaining_count: number,
   *   exported_count: number,
   *   total_acts: number
   * }>}
   */
  async checkForInterruptedExport() {
    const state = await this.getState();
    
    // Can resume if status is 'in_progress' or 'paused' and there are remaining acts
    const canResume = (state.status === 'in_progress' || state.status === 'paused') &&
                      state.current_index < state.total_acts &&
                      state.export_id !== null;
    
    const remainingCount = canResume 
      ? state.total_acts - state.current_index 
      : 0;
    
    return {
      can_resume: canResume,
      export_id: canResume ? state.export_id : null,
      remaining_count: remainingCount,
      exported_count: state.exported_act_ids.length,
      total_acts: state.total_acts,
      pending_act_ids: canResume ? (state.pending_act_ids || []) : []
    };
  },
  
  /**
   * Resume an interrupted export
   * Requirements: 12.2 - Resume from last successful act
   * 
   * @returns {Promise<{
   *   export_id: string,
   *   remaining_act_ids: string[],
   *   current_index: number,
   *   total_acts: number
   * }>}
   */
  async resumeExport() {
    const state = await this.getState();
    
    if (state.status !== 'in_progress' && state.status !== 'paused') {
      throw new Error(`Cannot resume: status is ${state.status}`);
    }
    
    if (!state.export_id) {
      throw new Error('Cannot resume: no export_id found');
    }
    
    // Update status to in_progress
    state.status = 'in_progress';
    state.last_updated_at = new Date().toISOString();
    
    await this._saveState(state);
    
    // Notify progress callback
    this._notifyProgress(state);
    
    return {
      export_id: state.export_id,
      remaining_act_ids: state.pending_act_ids || [],
      current_index: state.current_index,
      total_acts: state.total_acts
    };
  },
  
  /**
   * Pause the current export
   * Requirements: 12.2 - Support pausing for later resume
   * 
   * @returns {Promise<{
   *   export_id: string,
   *   current_index: number,
   *   status: string
   * }>}
   */
  async pauseExport() {
    const state = await this.getState();
    
    if (state.status !== 'in_progress') {
      throw new Error(`Cannot pause: status is ${state.status}`);
    }
    
    state.status = 'paused';
    state.last_updated_at = new Date().toISOString();
    
    await this._saveState(state);
    
    // Notify progress callback
    this._notifyProgress(state);
    
    return {
      export_id: state.export_id,
      current_index: state.current_index,
      status: 'paused'
    };
  },
  
  /**
   * Cancel the current export
   * Requirements: 12.6 - Allow canceling without losing already-downloaded files
   * 
   * @returns {Promise<{
   *   export_id: string,
   *   exported_count: number,
   *   status: string
   * }>}
   */
  async cancelExport() {
    const state = await this.getState();
    
    const exportId = state.export_id;
    const exportedCount = state.exported_act_ids.length;
    
    state.status = 'cancelled';
    state.last_updated_at = new Date().toISOString();
    
    await this._saveState(state);
    
    // Notify progress callback
    this._notifyProgress(state);
    
    return {
      export_id: exportId,
      exported_count: exportedCount,
      status: 'cancelled'
    };
  },
  
  /**
   * Set the rate limit delay between downloads
   * Requirements: 12.5 - Configurable delay between downloads
   * 
   * @param {number} delayMs - Delay in milliseconds
   * @returns {Promise<{rate_limit_ms: number, clamped: boolean}>}
   */
  async setRateLimit(delayMs) {
    const state = await this.getState();
    const originalValue = delayMs;
    const clampedValue = this._clampRateLimit(delayMs);
    const clamped = clampedValue !== originalValue;
    
    state.rate_limit_ms = clampedValue;
    await this._saveState(state);
    
    return {
      rate_limit_ms: clampedValue,
      clamped,
      originalValue: clamped ? originalValue : undefined
    };
  },
  
  /**
   * Get the current rate limit delay
   * Requirements: 12.5
   * 
   * @returns {Promise<number>}
   */
  async getRateLimit() {
    const state = await this.getState();
    return state.rate_limit_ms;
  },
  
  /**
   * Wait for the rate limit delay
   * Requirements: 12.5 - Rate limiting for downloads
   * 
   * @returns {Promise<{waited_ms: number}>}
   */
  async waitForRateLimit() {
    const state = await this.getState();
    const delayMs = state.rate_limit_ms;
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    return { waited_ms: delayMs };
  },
  
  /**
   * Set the progress callback function
   * Called when export progress updates
   * 
   * @param {Function} callback - Function to call on progress update
   */
  setProgressCallback(callback) {
    if (typeof callback === 'function') {
      this._progressCallback = callback;
    }
  },
  
  /**
   * Notify progress callback
   * @param {Object} state - Current state
   */
  _notifyProgress(state) {
    if (this._progressCallback) {
      try {
        const progressPercent = state.total_acts > 0 
          ? Math.round((state.current_index / state.total_acts) * 100) 
          : 0;
        
        this._progressCallback({
          export_id: state.export_id,
          current_index: state.current_index,
          total_acts: state.total_acts,
          progress_percent: progressPercent,
          exported_count: state.exported_act_ids.length,
          failed_count: state.failed_act_ids.length,
          status: state.status
        });
      } catch (e) {
        console.error('Export progress callback error:', e);
      }
    }
  },
  
  /**
   * Reset the export progress state (for testing or after completion)
   * 
   * @returns {Promise<void>}
   */
  async reset() {
    const defaultState = {
      export_id: null,
      total_acts: 0,
      current_index: 0,
      exported_act_ids: [],
      failed_act_ids: [],
      status: 'idle',
      started_at: null,
      last_updated_at: null,
      rate_limit_ms: this.DEFAULT_RATE_LIMIT_MS,
      pending_act_ids: []
    };
    
    await this._saveState(defaultState);
  },
  
  /**
   * Clear the in-memory cache (for testing)
   */
  clearCache() {
    this._state = null;
    this._progressCallback = null;
  }
};

// ============================================
// MIGRATION MANAGER
// Requirements: 3.3 - Migrate from chrome.storage.local to IndexedDB
// ============================================

/**
 * Migration Manager
 * Handles migration of acts from chrome.storage.local to IndexedDB
 * 
 * Requirements:
 * - 3.3: Migrate existing chrome.storage.local data to IndexedDB on first load
 * 
 * Migration process:
 * 1. Load all acts from chrome.storage.local
 * 2. Save each act to IndexedDB with receipt generation
 * 3. Verify migration integrity by comparing content hashes
 * 4. Log migration results
 */
const MigrationManager = {
  // Storage key for migration state
  MIGRATION_STATE_KEY: 'bdlaw_migration_state',
  
  // Migration status values
  STATUS: {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },
  
  // In-memory cache of migration state
  _state: null,
  
  /**
   * Get the current migration state
   * 
   * @returns {Promise<{
   *   status: string,
   *   started_at: string|null,
   *   completed_at: string|null,
   *   migrated_count: number,
   *   skipped_count: number,
   *   failed_count: number,
   *   total_count: number,
   *   error: string|null
   * }>}
   */
  async getState() {
    // Return cached state if available
    if (this._state) {
      return { ...this._state };
    }
    
    // Load from chrome.storage.local
    const state = await this._loadState();
    this._state = state;
    return { ...state };
  },
  
  /**
   * Load migration state from chrome.storage.local
   * 
   * @returns {Promise<Object>}
   */
  async _loadState() {
    // Default state
    const defaultState = {
      status: this.STATUS.NOT_STARTED,
      started_at: null,
      completed_at: null,
      migrated_count: 0,
      skipped_count: 0,
      failed_count: 0,
      total_count: 0,
      failed_acts: [],
      error: null
    };
    
    // Check if chrome.storage is available
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return defaultState;
    }
    
    return new Promise((resolve) => {
      chrome.storage.local.get([this.MIGRATION_STATE_KEY], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('Failed to load migration state:', chrome.runtime.lastError);
          resolve(defaultState);
          return;
        }
        
        const stored = result[this.MIGRATION_STATE_KEY];
        if (!stored || typeof stored !== 'object') {
          resolve(defaultState);
          return;
        }
        
        // Merge with defaults to ensure all fields exist
        resolve({
          ...defaultState,
          ...stored
        });
      });
    });
  },
  
  /**
   * Save migration state to chrome.storage.local
   * 
   * @param {Object} state - The state to save
   * @returns {Promise<void>}
   */
  async _saveState(state) {
    // Update cache
    this._state = { ...state };
    
    // Check if chrome.storage is available
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [this.MIGRATION_STATE_KEY]: state }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error('Failed to save migration state:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  },
  
  /**
   * Check if migration is needed
   * Requirements: 3.3 - Detect if migration needed
   * 
   * Migration is needed if:
   * 1. Migration has not been completed
   * 2. There are acts in chrome.storage.local
   * 3. IndexedDB is available
   * 
   * @returns {Promise<{
   *   needed: boolean,
   *   reason: string,
   *   actCount: number
   * }>}
   */
  async isMigrationNeeded() {
    // Check current migration state
    const state = await this.getState();
    
    // If already completed, no migration needed
    if (state.status === this.STATUS.COMPLETED) {
      return {
        needed: false,
        reason: 'Migration already completed',
        actCount: 0
      };
    }
    
    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined' || indexedDB === null) {
      return {
        needed: false,
        reason: 'IndexedDB not available',
        actCount: 0
      };
    }
    
    // Check if there are acts in chrome.storage.local
    try {
      const acts = await ChromeStorageBackend.getAllActs();
      
      if (!acts || acts.length === 0) {
        // No acts to migrate, mark as completed
        await this._saveState({
          ...state,
          status: this.STATUS.COMPLETED,
          completed_at: new Date().toISOString(),
          total_count: 0
        });
        
        return {
          needed: false,
          reason: 'No acts in chrome.storage.local to migrate',
          actCount: 0
        };
      }
      
      return {
        needed: true,
        reason: `Found ${acts.length} act(s) in chrome.storage.local to migrate`,
        actCount: acts.length
      };
    } catch (e) {
      console.error('Error checking for acts to migrate:', e);
      return {
        needed: false,
        reason: `Error checking chrome.storage.local: ${e.message}`,
        actCount: 0
      };
    }
  },
  
  /**
   * Migrate acts from chrome.storage.local to IndexedDB
   * Requirements: 3.3 - Migrate existing data to IndexedDB
   * 
   * This function:
   * 1. Loads all acts from chrome.storage.local
   * 2. Saves each act to IndexedDB with receipt generation
   * 3. Verifies migration integrity by comparing content hashes
   * 4. Logs migration results
   * 
   * @returns {Promise<{
   *   success: boolean,
   *   migrated: number,
   *   skipped: number,
   *   failed: number,
   *   total: number,
   *   failedActs: Array<{actNumber: string, error: string}>,
   *   error: string|null
   * }>}
   */
  async migrateToIndexedDB() {
    // Log audit entry for migration start
    try {
      await StorageManager.logAuditEntry({
        operation: 'migration_start',
        context: { source: 'chrome_storage', target: 'indexeddb' }
      });
    } catch (e) {
      console.warn('Failed to log migration start audit entry:', e);
    }
    
    // Update state to in_progress
    let state = await this.getState();
    state.status = this.STATUS.IN_PROGRESS;
    state.started_at = new Date().toISOString();
    state.migrated_count = 0;
    state.skipped_count = 0;
    state.failed_count = 0;
    state.failed_acts = [];
    state.error = null;
    await this._saveState(state);
    
    // Result object
    const result = {
      success: false,
      migrated: 0,
      skipped: 0,
      failed: 0,
      total: 0,
      failedActs: [],
      error: null
    };
    
    try {
      // Ensure IndexedDB is initialized
      if (!StorageManager._db) {
        // Try to initialize IndexedDB
        await StorageManager._initIndexedDB();
      }
      
      // Load all acts from chrome.storage.local
      const acts = await ChromeStorageBackend.getAllActs();
      result.total = acts.length;
      state.total_count = acts.length;
      
      if (acts.length === 0) {
        // No acts to migrate
        state.status = this.STATUS.COMPLETED;
        state.completed_at = new Date().toISOString();
        await this._saveState(state);
        
        result.success = true;
        return result;
      }
      
      console.log(`Starting migration of ${acts.length} act(s) from chrome.storage.local to IndexedDB`);
      
      // Get existing receipts to check for already migrated acts
      const existingReceipts = await StorageManager._getReceiptsFromIndexedDB({});
      const existingActIds = new Set(existingReceipts.map(r => r.act_id));
      
      // Migrate each act
      for (const act of acts) {
        const actNumber = act.act_number || act.actNumber;
        
        if (!actNumber) {
          console.warn('Skipping act without act_number:', act);
          result.skipped++;
          state.skipped_count++;
          continue;
        }
        
        try {
          // Check if already migrated (receipt exists)
          if (existingActIds.has(actNumber)) {
            console.log(`Act ${actNumber} already migrated, skipping`);
            result.skipped++;
            state.skipped_count++;
            continue;
          }
          
          // Normalize act to ensure it has act_number field
          const normalizedAct = {
            ...act,
            act_number: actNumber
          };
          
          // Validate content_raw exists
          if (!normalizedAct.content_raw || typeof normalizedAct.content_raw !== 'string') {
            console.warn(`Act ${actNumber} has no valid content_raw, skipping`);
            result.skipped++;
            state.skipped_count++;
            continue;
          }
          
          // Save to IndexedDB (this also generates and saves receipt)
          const savedAct = await StorageManager.saveActToIndexedDB(normalizedAct);
          
          // Generate and save receipt
          const receipt = await StorageManager.generateReceipt(savedAct);
          await StorageManager._saveReceiptToIndexedDB(receipt);
          
          // Verify migration integrity
          const loadedAct = await StorageManager.loadActFromIndexedDB(actNumber);
          
          if (!loadedAct) {
            throw new Error('Act not found after save');
          }
          
          // Verify content hash matches
          if (loadedAct.content_raw_sha256 !== savedAct.content_raw_sha256) {
            throw new Error('Content hash mismatch after migration');
          }
          
          result.migrated++;
          state.migrated_count++;
          
          console.log(`Migrated act ${actNumber} (${result.migrated}/${result.total})`);
          
        } catch (actError) {
          console.error(`Failed to migrate act ${actNumber}:`, actError);
          result.failed++;
          state.failed_count++;
          result.failedActs.push({
            actNumber,
            error: actError.message || String(actError)
          });
          state.failed_acts.push({
            actNumber,
            error: actError.message || String(actError)
          });
        }
        
        // Save state periodically (every 10 acts)
        if ((result.migrated + result.skipped + result.failed) % 10 === 0) {
          await this._saveState(state);
        }
      }
      
      // Migration completed
      state.status = this.STATUS.COMPLETED;
      state.completed_at = new Date().toISOString();
      await this._saveState(state);
      
      result.success = result.failed === 0;
      
      console.log(`Migration completed: ${result.migrated} migrated, ${result.skipped} skipped, ${result.failed} failed`);
      
      // Log audit entry for migration complete
      try {
        await StorageManager.logAuditEntry({
          operation: result.success ? 'migration_complete' : 'migration_failure',
          context: {
            migrated: result.migrated,
            skipped: result.skipped,
            failed: result.failed,
            total: result.total
          },
          outcome: result.success ? 'success' : 'partial_failure'
        });
      } catch (e) {
        console.warn('Failed to log migration complete audit entry:', e);
      }
      
      return result;
      
    } catch (e) {
      console.error('Migration failed:', e);
      
      state.status = this.STATUS.FAILED;
      state.error = e.message || String(e);
      await this._saveState(state);
      
      result.error = e.message || String(e);
      
      // Log audit entry for migration failure
      try {
        await StorageManager.logAuditEntry({
          operation: 'migration_failure',
          context: {
            error: result.error,
            migrated: result.migrated,
            failed: result.failed,
            total: result.total
          },
          outcome: 'failure'
        });
      } catch (auditError) {
        console.warn('Failed to log migration failure audit entry:', auditError);
      }
      
      return result;
    }
  },
  
  /**
   * Run migration automatically on first load if needed
   * Requirements: 3.3 - Run migration automatically
   * 
   * This function should be called during StorageManager.initialize()
   * to automatically migrate data if needed.
   * 
   * @returns {Promise<{
   *   migrationRun: boolean,
   *   result: Object|null
   * }>}
   */
  async runMigrationIfNeeded() {
    const check = await this.isMigrationNeeded();
    
    if (!check.needed) {
      console.log(`Migration not needed: ${check.reason}`);
      return {
        migrationRun: false,
        result: null
      };
    }
    
    console.log(`Migration needed: ${check.reason}`);
    const result = await this.migrateToIndexedDB();
    
    return {
      migrationRun: true,
      result
    };
  },
  
  /**
   * Reset migration state (for testing)
   * 
   * @returns {Promise<void>}
   */
  async reset() {
    const defaultState = {
      status: this.STATUS.NOT_STARTED,
      started_at: null,
      completed_at: null,
      migrated_count: 0,
      skipped_count: 0,
      failed_count: 0,
      total_count: 0,
      failed_acts: [],
      error: null
    };
    
    await this._saveState(defaultState);
  },
  
  /**
   * Clear the in-memory cache (for testing)
   */
  clearCache() {
    this._state = null;
  }
};

// ============================================
// QUEUE STATE RECONSTRUCTOR
// Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 5.6
// ============================================

/**
 * Queue State Reconstructor
 * Derives queue state from authoritative sources (receipts)
 * Never trusts stored counters
 * 
 * Requirements:
 * - 4.1: Derive pending count as total_queued_act_ids MINUS extracted_act_ids
 * - 4.3: Reconstruct queue state from extraction_receipts on load
 * - 4.4: Maintain extracted_act_ids as authoritative record
 * - 4.5: Trust extraction_receipts over queue state if they disagree
 * - 4.6: Log state reconstruction discrepancies
 * - 5.6: Reset 'processing' items to 'pending' on reload
 */
const QueueReconstructor = {
  /**
   * Reconstruct queue state from receipts and queue items
   * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6
   * 
   * This function derives the authoritative queue state by:
   * 1. Building a set of extracted act IDs from receipts
   * 2. Filtering queue items to find pending (not yet extracted)
   * 3. Detecting discrepancies where items are marked complete but have no receipt
   * 
   * @param {Object[]} queueItems - Items added to queue (must have actNumber and status)
   * @param {Object[]} receipts - Extraction receipts (must have act_id)
   * @returns {{
   *   pending: Object[],
   *   completed: string[],
   *   discrepancies: Object[],
   *   stats: {
   *     totalQueued: number,
   *     totalExtracted: number,
   *     pendingCount: number,
   *     discrepancyCount: number
   *   }
   * }}
   */
  reconstructState(queueItems, receipts) {
    // Validate inputs
    const items = Array.isArray(queueItems) ? queueItems : [];
    const receiptList = Array.isArray(receipts) ? receipts : [];
    
    // Build set of extracted act IDs from receipts (authoritative source)
    // Requirements: 4.4 - extracted_act_ids as authoritative record
    const extractedActIds = new Set(
      receiptList
        .map(r => r.act_id)
        .filter(id => id && typeof id === 'string')
    );
    
    // Derive pending items: queue items not in extracted set
    // Requirements: 4.1 - pending = total_queued MINUS extracted
    const pending = items.filter(item => {
      const actId = item.actNumber || item.act_number;
      return actId && !extractedActIds.has(actId);
    });
    
    // Get completed act IDs from receipts
    const completed = Array.from(extractedActIds);
    
    // Detect discrepancies: items marked 'completed' but no receipt exists
    // Requirements: 4.5, 4.6 - Trust receipts, log discrepancies
    const discrepancies = items
      .filter(item => {
        const actId = item.actNumber || item.act_number;
        // Item is marked as completed/done but has no receipt
        const isMarkedComplete = item.status === 'completed' || item.status === 'done';
        const hasNoReceipt = actId && !extractedActIds.has(actId);
        return isMarkedComplete && hasNoReceipt;
      })
      .map(item => ({
        actNumber: item.actNumber || item.act_number,
        itemId: item.id,
        issue: 'marked_complete_no_receipt',
        resolution: 'reset_to_pending',
        originalStatus: item.status,
        timestamp: new Date().toISOString()
      }));
    
    // Log discrepancies if any found
    // Requirements: 4.6 - Log state reconstruction discrepancies
    if (discrepancies.length > 0) {
      console.warn(
        `Queue reconstruction found ${discrepancies.length} discrepancy(ies):`,
        discrepancies.map(d => `${d.actNumber}: ${d.issue}`)
      );
    }
    
    // Return reconstructed state with statistics
    return {
      pending,
      completed,
      discrepancies,
      stats: {
        totalQueued: items.length,
        totalExtracted: extractedActIds.size,
        pendingCount: pending.length,
        discrepancyCount: discrepancies.length
      }
    };
  },
  
  /**
   * Reset items with 'processing' status to 'pending'
   * Requirements: 5.6 - Reset 'processing' items to 'pending' on reload
   * 
   * When the side panel reloads, any items stuck in 'processing' status
   * should be reset to 'pending' since the processing was interrupted.
   * 
   * @param {Object[]} queueItems - Queue items to process
   * @returns {{
   *   items: Object[],
   *   resetCount: number,
   *   resetItems: Object[]
   * }}
   */
  resetProcessingStatus(queueItems) {
    // Validate input
    const items = Array.isArray(queueItems) ? queueItems : [];
    
    const resetItems = [];
    
    // Process each item, resetting 'processing' to 'pending'
    const processedItems = items.map(item => {
      if (item.status === 'processing') {
        // Log the reset action
        const resetInfo = {
          actNumber: item.actNumber || item.act_number,
          itemId: item.id,
          previousStatus: 'processing',
          newStatus: 'pending',
          resetAt: new Date().toISOString()
        };
        resetItems.push(resetInfo);
        
        // Return item with status reset to 'pending'
        return {
          ...item,
          status: 'pending',
          _resetFromProcessing: true,
          _resetAt: new Date().toISOString()
        };
      }
      return item;
    });
    
    // Log reset actions if any
    // Requirements: 5.6 - Log reset actions
    if (resetItems.length > 0) {
      console.log(
        `Reset ${resetItems.length} item(s) from 'processing' to 'pending':`,
        resetItems.map(r => r.actNumber)
      );
    }
    
    return {
      items: processedItems,
      resetCount: resetItems.length,
      resetItems
    };
  },
  
  /**
   * Full queue state reconstruction with processing status reset
   * Combines reconstructState and resetProcessingStatus for complete reconstruction
   * 
   * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 5.6
   * 
   * @param {Object[]} queueItems - Items added to queue
   * @param {Object[]} receipts - Extraction receipts
   * @returns {{
   *   pending: Object[],
   *   completed: string[],
   *   discrepancies: Object[],
   *   resetItems: Object[],
   *   stats: {
   *     totalQueued: number,
   *     totalExtracted: number,
   *     pendingCount: number,
   *     discrepancyCount: number,
   *     resetCount: number
   *   }
   * }}
   */
  fullReconstruction(queueItems, receipts) {
    // First, reset any 'processing' items to 'pending'
    const resetResult = this.resetProcessingStatus(queueItems);
    
    // Then reconstruct state from the reset items
    const reconstructResult = this.reconstructState(resetResult.items, receipts);
    
    // Combine results
    return {
      pending: reconstructResult.pending,
      completed: reconstructResult.completed,
      discrepancies: reconstructResult.discrepancies,
      resetItems: resetResult.resetItems,
      stats: {
        ...reconstructResult.stats,
        resetCount: resetResult.resetCount
      }
    };
  }
};

// ============================================
// STANDALONE INDEXEDDB INITIALIZATION
// For external use and testing
// ============================================

/**
 * Initialize IndexedDB with the BDLawCorpus schema
 * Requirements: 3.1, 3.2 - Standalone initialization function
 * 
 * This function can be called independently of StorageManager
 * for testing or direct IndexedDB access.
 * 
 * @returns {Promise<IDBDatabase>}
 * @throws {StorageError} if initialization fails
 */
async function initIndexedDB() {
  return StorageManager._initIndexedDB();
}

// ============================================
// MODULE EXPORTS
// Support both browser and Node.js environments
// ============================================

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
    RECEIPT_SCHEMA_VERSION,
    STORAGE_BACKENDS,
    classifyStorageError,
    createStorageError,
    initIndexedDB,
    // Standalone functions for direct access
    saveActToIndexedDB: (act) => StorageManager.saveActToIndexedDB(act),
    loadActFromIndexedDB: (actId) => StorageManager.loadActFromIndexedDB(actId),
    computeSHA256: (content) => StorageManager.computeSHA256(content),
    generateReceipt: (act) => StorageManager.generateReceipt(act),
    saveReceipt: (receipt) => StorageManager.saveReceipt(receipt),
    getReceipts: (options) => StorageManager.getReceipts(options),
    getStorageStatus: () => StorageManager.getStorageStatus(),
    checkQuotaBeforeWrite: () => StorageManager.checkQuotaBeforeWrite(),
    // WAL functions
    logIntent: (actId) => StorageManager.logIntent(actId),
    logComplete: (actId, contentHash) => StorageManager.logComplete(actId, contentHash),
    getIncompleteExtractions: () => StorageManager.getIncompleteExtractions(),
    // Audit log functions
    logAuditEntry: (entry) => StorageManager.logAuditEntry(entry),
    getAuditLog: (options) => StorageManager.getAuditLog(options),
    // Export checkpoint functions
    getExportCheckpointState: () => ExportCheckpointManager.getState(),
    setExportThreshold: (threshold) => ExportCheckpointManager.setThreshold(threshold),
    recordExtraction: () => ExportCheckpointManager.recordExtraction(),
    recordExport: () => ExportCheckpointManager.recordExport(),
    dismissExportPrompt: () => ExportCheckpointManager.dismissPrompt(),
    shouldPromptExport: () => ExportCheckpointManager.shouldPromptExport(),
    // Export progress functions
    getExportProgressState: () => ExportProgressTracker.getState(),
    startExport: (actIds) => ExportProgressTracker.startExport(actIds),
    recordActExported: (actId) => ExportProgressTracker.recordActExported(actId),
    recordActFailed: (actId, error) => ExportProgressTracker.recordActFailed(actId, error),
    checkForInterruptedExport: () => ExportProgressTracker.checkForInterruptedExport(),
    resumeExport: () => ExportProgressTracker.resumeExport(),
    pauseExport: () => ExportProgressTracker.pauseExport(),
    cancelExport: () => ExportProgressTracker.cancelExport(),
    setExportRateLimit: (delayMs) => ExportProgressTracker.setRateLimit(delayMs),
    getExportRateLimit: () => ExportProgressTracker.getRateLimit(),
    waitForExportRateLimit: () => ExportProgressTracker.waitForRateLimit(),
    // Migration functions
    getMigrationState: () => MigrationManager.getState(),
    isMigrationNeeded: () => MigrationManager.isMigrationNeeded(),
    migrateToIndexedDB: () => MigrationManager.migrateToIndexedDB(),
    runMigrationIfNeeded: () => MigrationManager.runMigrationIfNeeded()
  };
}

// Export for browser (Chrome extension)
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
  window.StorageError = StorageError;
  window.StorageErrorType = StorageErrorType;
  window.ExtractionReceipt = ExtractionReceipt;
  window.ChromeStorageBackend = ChromeStorageBackend;
  window.MemoryBackend = MemoryBackend;
  window.QueueReconstructor = QueueReconstructor;
  window.ExportCheckpointManager = ExportCheckpointManager;
  window.ExportProgressTracker = ExportProgressTracker;
  window.MigrationManager = MigrationManager;
}
