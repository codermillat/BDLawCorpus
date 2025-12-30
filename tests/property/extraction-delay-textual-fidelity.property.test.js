/**
 * Property Test: Extraction Delay Application (Textual Fidelity)
 * Feature: textual-fidelity-extraction
 * Property 11: Extraction Delay Application
 * 
 * For any configured extraction delay, the extractor SHALL record extraction_delay_ms
 * in metadata matching the configured value. When DOM readiness is uncertain,
 * dom_readiness: "uncertain" SHALL be recorded.
 * 
 * Validates: Requirements 5.2, 5.4, 5.6
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Feature: textual-fidelity-extraction, Property 11: Extraction Delay Application', () => {
  // ============================================
  // Configuration Constants Tests
  // ============================================

  test('EXTRACTION_DELAY_CONFIG SHALL have default_delay_ms of 0 (Requirements 5.2)', () => {
    // Requirements 5.2: Default: 0ms
    expect(BDLawExtractor.EXTRACTION_DELAY_CONFIG.default_delay_ms).toBe(0);
  });

  test('EXTRACTION_DELAY_CONFIG SHALL have max_delay_ms of 5000 (Requirements 5.2)', () => {
    // Requirements 5.2: Configurable up to 5000ms
    expect(BDLawExtractor.EXTRACTION_DELAY_CONFIG.max_delay_ms).toBe(5000);
  });

  test('EXTRACTION_DELAY_CONFIG SHALL have min_delay_ms of 0', () => {
    expect(BDLawExtractor.EXTRACTION_DELAY_CONFIG.min_delay_ms).toBe(0);
  });

  test('DOM_READINESS_STATES SHALL contain all required states (Requirements 5.6)', () => {
    // Requirements 5.6: Record dom_readiness: "ready", "uncertain", or "not_ready"
    expect(BDLawExtractor.DOM_READINESS_STATES.READY).toBe('ready');
    expect(BDLawExtractor.DOM_READINESS_STATES.UNCERTAIN).toBe('uncertain');
    expect(BDLawExtractor.DOM_READINESS_STATES.NOT_READY).toBe('not_ready');
  });

  // ============================================
  // getExtractionDelayConfig Tests
  // ============================================

  test('getExtractionDelayConfig SHALL return default config when no argument provided', () => {
    const config = BDLawExtractor.getExtractionDelayConfig();
    
    expect(config.delay_ms).toBe(BDLawExtractor.EXTRACTION_DELAY_CONFIG.default_delay_ms);
    expect(config.delay_ms).toBe(0);
  });

  test('getExtractionDelayConfig SHALL clamp delay to valid range [0, 5000] (Requirements 5.2)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 20000 }),
        (inputDelay) => {
          const config = BDLawExtractor.getExtractionDelayConfig(inputDelay);
          
          // Requirements 5.2: Delay SHALL be between 0ms and 5000ms
          expect(config.delay_ms).toBeGreaterThanOrEqual(BDLawExtractor.EXTRACTION_DELAY_CONFIG.min_delay_ms);
          expect(config.delay_ms).toBeLessThanOrEqual(BDLawExtractor.EXTRACTION_DELAY_CONFIG.max_delay_ms);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getExtractionDelayConfig SHALL preserve valid delay values exactly', () => {
    fc.assert(
      fc.property(
        fc.integer({ 
          min: BDLawExtractor.EXTRACTION_DELAY_CONFIG.min_delay_ms, 
          max: BDLawExtractor.EXTRACTION_DELAY_CONFIG.max_delay_ms 
        }),
        (validDelay) => {
          const config = BDLawExtractor.getExtractionDelayConfig(validDelay);
          
          // Valid values should be preserved exactly
          expect(config.delay_ms).toBe(validDelay);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getExtractionDelayConfig SHALL clamp values below minimum to 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: -1 }),
        (belowMinDelay) => {
          const config = BDLawExtractor.getExtractionDelayConfig(belowMinDelay);
          
          // Should be clamped to minimum (0)
          expect(config.delay_ms).toBe(BDLawExtractor.EXTRACTION_DELAY_CONFIG.min_delay_ms);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getExtractionDelayConfig SHALL clamp values above maximum to 5000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5001, max: 20000 }),
        (aboveMaxDelay) => {
          const config = BDLawExtractor.getExtractionDelayConfig(aboveMaxDelay);
          
          // Should be clamped to maximum (5000)
          expect(config.delay_ms).toBe(BDLawExtractor.EXTRACTION_DELAY_CONFIG.max_delay_ms);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getExtractionDelayConfig SHALL handle non-numeric input gracefully', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.boolean(),
          fc.constant({}),
          fc.constant([])
        ),
        (invalidInput) => {
          const config = BDLawExtractor.getExtractionDelayConfig(invalidInput);
          
          // Should return default delay for non-numeric input
          expect(config.delay_ms).toBe(BDLawExtractor.EXTRACTION_DELAY_CONFIG.default_delay_ms);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getExtractionDelayConfig SHALL floor floating point values', () => {
    fc.assert(
      fc.property(
        fc.double({ 
          min: 0, 
          max: 5000,
          noNaN: true,
          noDefaultInfinity: true
        }),
        (floatDelay) => {
          const config = BDLawExtractor.getExtractionDelayConfig(floatDelay);
          
          // Should floor to integer
          expect(Number.isInteger(config.delay_ms)).toBe(true);
          expect(config.delay_ms).toBe(Math.floor(floatDelay));
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // createExtractionDelayMetadata Tests
  // ============================================

  test('createExtractionDelayMetadata SHALL include extraction_delay_ms (Requirements 5.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        (delayMs) => {
          const metadata = BDLawExtractor.createExtractionDelayMetadata({ delayMs });
          
          // Requirements 5.4: Record extraction_delay_ms in extraction metadata
          expect(metadata).toHaveProperty('extraction_delay_ms');
          expect(metadata.extraction_delay_ms).toBe(delayMs);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('createExtractionDelayMetadata SHALL include dom_readiness (Requirements 5.6)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ready', 'uncertain', 'not_ready'),
        (domReadiness) => {
          const metadata = BDLawExtractor.createExtractionDelayMetadata({ domReadiness });
          
          // Requirements 5.6: Record dom_readiness in metadata
          expect(metadata).toHaveProperty('dom_readiness');
          expect(metadata.dom_readiness).toBe(domReadiness);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('createExtractionDelayMetadata SHALL use defaults when options not provided', () => {
    const metadata = BDLawExtractor.createExtractionDelayMetadata();
    
    expect(metadata.extraction_delay_ms).toBe(BDLawExtractor.EXTRACTION_DELAY_CONFIG.default_delay_ms);
    expect(metadata.dom_readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.READY);
  });

  test('createExtractionDelayMetadata SHALL use defaults for missing options', () => {
    const metadata = BDLawExtractor.createExtractionDelayMetadata({});
    
    expect(metadata.extraction_delay_ms).toBe(BDLawExtractor.EXTRACTION_DELAY_CONFIG.default_delay_ms);
    expect(metadata.dom_readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.READY);
  });

  // ============================================
  // checkDOMReadiness Tests
  // ============================================

  test('checkDOMReadiness SHALL return "not_ready" for null document', () => {
    const readiness = BDLawExtractor.checkDOMReadiness(null);
    expect(readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.NOT_READY);
  });

  test('checkDOMReadiness SHALL return "not_ready" for undefined document', () => {
    const readiness = BDLawExtractor.checkDOMReadiness(undefined);
    expect(readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.NOT_READY);
  });

  test('checkDOMReadiness SHALL return "not_ready" when document.readyState is "loading"', () => {
    const mockDocument = {
      readyState: 'loading',
      body: { textContent: 'Some content' },
      querySelector: () => null
    };
    
    const readiness = BDLawExtractor.checkDOMReadiness(mockDocument);
    expect(readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.NOT_READY);
  });

  test('checkDOMReadiness SHALL return "not_ready" when loading indicator is present', () => {
    const mockDocument = {
      readyState: 'complete',
      body: { textContent: 'Some content that is long enough to pass the minimum threshold check' },
      querySelector: (selector) => {
        // Return a mock element for loading indicator
        if (selector === '.loading') {
          return { className: 'loading' };
        }
        return null;
      }
    };
    
    const readiness = BDLawExtractor.checkDOMReadiness(mockDocument);
    expect(readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.NOT_READY);
  });

  test('checkDOMReadiness SHALL return "not_ready" when body is missing', () => {
    const mockDocument = {
      readyState: 'complete',
      body: null,
      querySelector: () => null
    };
    
    const readiness = BDLawExtractor.checkDOMReadiness(mockDocument);
    expect(readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.NOT_READY);
  });

  test('checkDOMReadiness SHALL return "uncertain" when content is too short', () => {
    const mockDocument = {
      readyState: 'complete',
      body: { textContent: 'Short' }, // Less than min_content_length
      querySelector: () => null
    };
    
    const readiness = BDLawExtractor.checkDOMReadiness(mockDocument);
    expect(readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.UNCERTAIN);
  });

  test('checkDOMReadiness SHALL return "ready" when all checks pass', () => {
    // Create content longer than min_content_length (100 chars)
    const longContent = 'This is a test content that is long enough to pass the minimum content length threshold check for DOM readiness verification.';
    
    const mockDocument = {
      readyState: 'complete',
      body: { textContent: longContent },
      querySelector: () => null
    };
    
    const readiness = BDLawExtractor.checkDOMReadiness(mockDocument);
    expect(readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.READY);
  });

  test('checkDOMReadiness SHALL accept "interactive" readyState as valid', () => {
    const longContent = 'This is a test content that is long enough to pass the minimum content length threshold check for DOM readiness verification.';
    
    const mockDocument = {
      readyState: 'interactive',
      body: { textContent: longContent },
      querySelector: () => null
    };
    
    const readiness = BDLawExtractor.checkDOMReadiness(mockDocument);
    expect(readiness).toBe(BDLawExtractor.DOM_READINESS_STATES.READY);
  });

  // ============================================
  // Property: Metadata Recording Consistency
  // ============================================

  test('extraction_delay_ms in metadata SHALL match configured value (Requirements 5.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.constantFrom('ready', 'uncertain', 'not_ready'),
        (delayMs, domReadiness) => {
          const metadata = BDLawExtractor.createExtractionDelayMetadata({
            delayMs,
            domReadiness
          });
          
          // Requirements 5.4: extraction_delay_ms SHALL match configured value
          expect(metadata.extraction_delay_ms).toBe(delayMs);
          expect(metadata.dom_readiness).toBe(domReadiness);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('dom_readiness SHALL be one of the valid states (Requirements 5.6)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ready', 'uncertain', 'not_ready'),
        (domReadiness) => {
          const metadata = BDLawExtractor.createExtractionDelayMetadata({ domReadiness });
          
          // Requirements 5.6: dom_readiness SHALL be one of the valid states
          const validStates = Object.values(BDLawExtractor.DOM_READINESS_STATES);
          expect(validStates).toContain(metadata.dom_readiness);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Determinism Tests
  // ============================================

  test('getExtractionDelayConfig is deterministic for same input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 20000 }),
        (delayMs) => {
          const config1 = BDLawExtractor.getExtractionDelayConfig(delayMs);
          const config2 = BDLawExtractor.getExtractionDelayConfig(delayMs);
          
          expect(config1.delay_ms).toBe(config2.delay_ms);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('createExtractionDelayMetadata is deterministic for same input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.constantFrom('ready', 'uncertain', 'not_ready'),
        (delayMs, domReadiness) => {
          const metadata1 = BDLawExtractor.createExtractionDelayMetadata({ delayMs, domReadiness });
          const metadata2 = BDLawExtractor.createExtractionDelayMetadata({ delayMs, domReadiness });
          
          expect(metadata1.extraction_delay_ms).toBe(metadata2.extraction_delay_ms);
          expect(metadata1.dom_readiness).toBe(metadata2.dom_readiness);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('checkDOMReadiness is deterministic for same document state', () => {
    const longContent = 'This is a test content that is long enough to pass the minimum content length threshold check for DOM readiness verification.';
    
    const createMockDocument = (readyState, hasBody, hasLoadingIndicator) => ({
      readyState,
      body: hasBody ? { textContent: longContent } : null,
      querySelector: (selector) => {
        if (hasLoadingIndicator && selector === '.loading') {
          return { className: 'loading' };
        }
        return null;
      }
    });

    fc.assert(
      fc.property(
        fc.constantFrom('loading', 'interactive', 'complete'),
        fc.boolean(),
        fc.boolean(),
        (readyState, hasBody, hasLoadingIndicator) => {
          const doc1 = createMockDocument(readyState, hasBody, hasLoadingIndicator);
          const doc2 = createMockDocument(readyState, hasBody, hasLoadingIndicator);
          
          const readiness1 = BDLawExtractor.checkDOMReadiness(doc1);
          const readiness2 = BDLawExtractor.checkDOMReadiness(doc2);
          
          expect(readiness1).toBe(readiness2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('minimum delay (0ms) SHALL be recorded correctly', () => {
    const metadata = BDLawExtractor.createExtractionDelayMetadata({
      delayMs: 0,
      domReadiness: 'ready'
    });
    
    expect(metadata.extraction_delay_ms).toBe(0);
  });

  test('maximum delay (5000ms) SHALL be recorded correctly', () => {
    const metadata = BDLawExtractor.createExtractionDelayMetadata({
      delayMs: 5000,
      domReadiness: 'ready'
    });
    
    expect(metadata.extraction_delay_ms).toBe(5000);
  });

  test('DOM_READINESS_CONFIG SHALL have valid min_content_length', () => {
    expect(BDLawExtractor.DOM_READINESS_CONFIG.min_content_length).toBeGreaterThan(0);
    expect(typeof BDLawExtractor.DOM_READINESS_CONFIG.min_content_length).toBe('number');
  });

  test('DOM_READINESS_CONFIG SHALL have loading_indicators array', () => {
    expect(Array.isArray(BDLawExtractor.DOM_READINESS_CONFIG.loading_indicators)).toBe(true);
    expect(BDLawExtractor.DOM_READINESS_CONFIG.loading_indicators.length).toBeGreaterThan(0);
  });
});
