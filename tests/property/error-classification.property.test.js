/**
 * Property-Based Tests for Error Classification Accuracy
 * 
 * Feature: durable-persistence-hardening, Property 13: Error Classification Accuracy
 * Validates: Requirements 7.3, 7.4
 * 
 * For any storage error, the system SHALL classify it as exactly one of:
 * quota_exceeded, permission_denied, backend_unavailable, transaction_failed,
 * integrity_error, or unknown_error. The classification SHALL be logged with error context.
 */

const fc = require('fast-check');
const {
  StorageError,
  StorageErrorType,
  classifyStorageError,
  createStorageError,
  ExtractionReceipt
} = require('../../bdlaw-storage.js');

describe('Property 13: Error Classification Accuracy', () => {
  // All valid error types
  const VALID_ERROR_TYPES = [
    StorageErrorType.QUOTA_EXCEEDED,
    StorageErrorType.PERMISSION_DENIED,
    StorageErrorType.BACKEND_UNAVAILABLE,
    StorageErrorType.TRANSACTION_FAILED,
    StorageErrorType.INTEGRITY_ERROR,
    StorageErrorType.UNKNOWN_ERROR
  ];

  // Generator for error messages that should classify as quota_exceeded
  const quotaErrorMessageGen = fc.constantFrom(
    'QuotaExceededError: Storage quota exceeded',
    'Storage limit reached',
    'Disk full - cannot write',
    'Quota exceeded for storage',
    'exceeded the storage limit'
  );

  // Generator for error messages that should classify as permission_denied
  const permissionErrorMessageGen = fc.constantFrom(
    'Permission denied',
    'Access denied to storage',
    'SecurityError: Not allowed',
    'Operation not allowed',
    'Security violation'
  );

  // Generator for error messages that should classify as backend_unavailable
  const backendErrorMessageGen = fc.constantFrom(
    'IndexedDB unavailable',
    'IndexedDB not supported',
    'Database blocked',
    'Storage not available',
    'InvalidStateError: Database closed'
  );

  // Generator for error messages that should classify as transaction_failed
  const transactionErrorMessageGen = fc.constantFrom(
    'Transaction failed',
    'Transaction aborted',
    'TransactionInactiveError',
    'AbortError: Transaction was aborted',
    'Failed to commit transaction'
  );

  // Generator for error messages that should classify as integrity_error
  const integrityErrorMessageGen = fc.constantFrom(
    'Integrity check failed',
    'Data corruption detected',
    'Hash mismatch',
    'Content integrity error',
    'Corrupt data found'
  );

  // Generator for random error messages (should classify as unknown_error)
  const randomErrorMessageGen = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => {
      const lower = s.toLowerCase();
      // Filter out messages that would match known patterns
      return !lower.includes('quota') &&
             !lower.includes('exceeded') &&
             !lower.includes('permission') &&
             !lower.includes('denied') &&
             !lower.includes('security') &&
             !lower.includes('indexeddb') &&
             !lower.includes('unavailable') &&
             !lower.includes('blocked') &&
             !lower.includes('transaction') &&
             !lower.includes('abort') &&
             !lower.includes('integrity') &&
             !lower.includes('corrupt') &&
             !lower.includes('hash') &&
             !lower.includes('mismatch');
    });

  // Generator for error names
  const errorNameGen = fc.constantFrom(
    'Error',
    'TypeError',
    'RangeError',
    'QuotaExceededError',
    'SecurityError',
    'InvalidStateError',
    'TransactionInactiveError',
    'AbortError'
  );

  /**
   * Property: Every error is classified as exactly one valid type
   * Requirements: 7.3
   */
  it('should classify every error as exactly one valid type', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        errorNameGen,
        (message, name) => {
          const error = new Error(message);
          error.name = name;
          
          const classification = classifyStorageError(error);
          
          // Must be exactly one of the valid types
          return VALID_ERROR_TYPES.includes(classification);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Quota-related errors are classified as quota_exceeded
   * Requirements: 7.3
   */
  it('should classify quota-related errors as quota_exceeded', () => {
    fc.assert(
      fc.property(
        quotaErrorMessageGen,
        (message) => {
          const error = new Error(message);
          const classification = classifyStorageError(error);
          
          return classification === StorageErrorType.QUOTA_EXCEEDED;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Permission-related errors are classified as permission_denied
   * Requirements: 7.3
   */
  it('should classify permission-related errors as permission_denied', () => {
    fc.assert(
      fc.property(
        permissionErrorMessageGen,
        (message) => {
          const error = new Error(message);
          const classification = classifyStorageError(error);
          
          return classification === StorageErrorType.PERMISSION_DENIED;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Backend unavailability errors are classified correctly
   * Requirements: 7.3
   */
  it('should classify backend unavailability errors as backend_unavailable', () => {
    fc.assert(
      fc.property(
        backendErrorMessageGen,
        (message) => {
          const error = new Error(message);
          const classification = classifyStorageError(error);
          
          return classification === StorageErrorType.BACKEND_UNAVAILABLE;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Transaction-related errors are classified as transaction_failed
   * Requirements: 7.3
   */
  it('should classify transaction-related errors as transaction_failed', () => {
    fc.assert(
      fc.property(
        transactionErrorMessageGen,
        (message) => {
          const error = new Error(message);
          const classification = classifyStorageError(error);
          
          return classification === StorageErrorType.TRANSACTION_FAILED;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Integrity-related errors are classified as integrity_error
   * Requirements: 7.3
   */
  it('should classify integrity-related errors as integrity_error', () => {
    fc.assert(
      fc.property(
        integrityErrorMessageGen,
        (message) => {
          const error = new Error(message);
          const classification = classifyStorageError(error);
          
          return classification === StorageErrorType.INTEGRITY_ERROR;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Unrecognized errors are classified as unknown_error
   * Requirements: 7.3
   */
  it('should classify unrecognized errors as unknown_error', () => {
    fc.assert(
      fc.property(
        randomErrorMessageGen,
        (message) => {
          const error = new Error(message);
          const classification = classifyStorageError(error);
          
          return classification === StorageErrorType.UNKNOWN_ERROR;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Null/undefined errors are classified as unknown_error
   * Requirements: 7.3
   */
  it('should classify null/undefined errors as unknown_error', () => {
    expect(classifyStorageError(null)).toBe(StorageErrorType.UNKNOWN_ERROR);
    expect(classifyStorageError(undefined)).toBe(StorageErrorType.UNKNOWN_ERROR);
  });

  /**
   * Property: StorageError preserves type and context
   * Requirements: 7.4
   */
  it('should preserve error type and context in StorageError', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_ERROR_TYPES),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.record({
          operation: fc.string({ minLength: 1, maxLength: 50 }),
          actId: fc.string({ minLength: 1, maxLength: 20 })
        }),
        (type, message, details) => {
          const error = new StorageError(type, message, details);
          
          // Type is preserved
          if (error.type !== type) return false;
          
          // Message is preserved
          if (error.message !== message) return false;
          
          // Details are preserved
          if (error.details.operation !== details.operation) return false;
          if (error.details.actId !== details.actId) return false;
          
          // Timestamp is set
          if (!error.timestamp) return false;
          
          // isType method works
          if (!error.isType(type)) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: createStorageError correctly classifies and wraps errors
   * Requirements: 7.3, 7.4
   */
  it('should correctly classify and wrap errors with createStorageError', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.record({
          operation: fc.string({ minLength: 1, maxLength: 50 })
        }),
        (message, context) => {
          const originalError = new Error(message);
          const storageError = createStorageError(originalError, context);
          
          // Should be a StorageError instance
          if (!(storageError instanceof StorageError)) return false;
          
          // Type should be one of valid types
          if (!VALID_ERROR_TYPES.includes(storageError.type)) return false;
          
          // Context should be preserved
          if (storageError.details.operation !== context.operation) return false;
          
          // Original error info should be captured
          if (storageError.details.originalMessage !== message) return false;
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: StorageError.toJSON produces valid JSON object
   * Requirements: 7.4
   */
  it('should produce valid JSON from StorageError.toJSON', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_ERROR_TYPES),
        fc.string({ minLength: 1, maxLength: 100 }),
        (type, message) => {
          const error = new StorageError(type, message, { test: 'value' });
          const json = error.toJSON();
          
          // Should have all required fields
          if (json.name !== 'StorageError') return false;
          if (json.type !== type) return false;
          if (json.message !== message) return false;
          if (!json.timestamp) return false;
          if (json.details.test !== 'value') return false;
          
          // Should be serializable
          try {
            JSON.stringify(json);
            return true;
          } catch (e) {
            return false;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error name-based classification works correctly
   * Requirements: 7.3
   */
  it('should classify errors based on error name when message is generic', () => {
    // QuotaExceededError name
    const quotaError = new Error('Generic error');
    quotaError.name = 'QuotaExceededError';
    expect(classifyStorageError(quotaError)).toBe(StorageErrorType.QUOTA_EXCEEDED);

    // SecurityError name
    const securityError = new Error('Generic error');
    securityError.name = 'SecurityError';
    expect(classifyStorageError(securityError)).toBe(StorageErrorType.PERMISSION_DENIED);

    // InvalidStateError name
    const stateError = new Error('Generic error');
    stateError.name = 'InvalidStateError';
    expect(classifyStorageError(stateError)).toBe(StorageErrorType.BACKEND_UNAVAILABLE);

    // TransactionInactiveError name
    const txError = new Error('Generic error');
    txError.name = 'TransactionInactiveError';
    expect(classifyStorageError(txError)).toBe(StorageErrorType.TRANSACTION_FAILED);

    // AbortError name
    const abortError = new Error('Generic error');
    abortError.name = 'AbortError';
    expect(classifyStorageError(abortError)).toBe(StorageErrorType.TRANSACTION_FAILED);
  });
});
