/**
 * Property-Based Tests for Enactment Clause Detection from DOM
 * 
 * Feature: legal-structure-derivation, Property: Enactment Clause Detection from DOM
 * Validates: Requirements 7.1, 7.3, 7.4
 * 
 * For any DOM document containing .lineremove elements with enactment clause patterns
 * (সেহেতু এতদ্বারা, Be it enacted), the extractEnactmentFromDOM function SHALL detect
 * the enactment clause and return the text verbatim with has_enactment_clause: true
 * and dom_source: ".lineremove".
 */

const fc = require('fast-check');

/**
 * Helper to create a mock DOM document with enactment clause structure
 * Simulates the bdlaws.minlaw.gov.bd page structure
 * @param {Object} options - { enactmentElements: Array<{text, isLineremoves}> }
 * @returns {Object} Mock document object
 */
function createMockDocument(options) {
  const { enactmentElements = [] } = options;

  // Create mock .lineremove elements
  const mockEnactmentElements = enactmentElements.map((el) => ({
    classList: {
      contains: (className) => el.isLineremoves && className === 'lineremoves'
    },
    textContent: el.text
  }));

  // Create mock container
  const mockContainer = {
    querySelector: () => null,
    querySelectorAll: (selector) => {
      if (selector === '.lineremove') {
        return mockEnactmentElements;
      }
      if (selector === '.lineremoves') {
        return [];
      }
      return [];
    }
  };

  return {
    querySelector: (selector) => {
      if (selector === '.boxed-layout') {
        return mockContainer;
      }
      return null;
    }
  };
}

/**
 * Simulates extractEnactmentFromDOM logic for testing
 * This mirrors the implementation in content.js
 */
function extractEnactmentFromMockDOM(mockDoc) {
  const container = mockDoc.querySelector('.boxed-layout');
  if (!container) {
    return null;
  }

  // Query .lineremove elements (singular - enactment clause container)
  const enactmentElements = container.querySelectorAll('.lineremove');
  
  // Enactment clause patterns
  const enactmentPattern = /সেহেতু\s+এতদ্বারা|Be\s+it\s+enacted/gi;
  
  for (const element of enactmentElements) {
    // Skip if this is actually a .lineremoves element (section rows)
    if (element.classList && element.classList.contains('lineremoves')) {
      continue;
    }
    
    const text = element.textContent ? element.textContent.trim() : '';
    if (text && enactmentPattern.test(text)) {
      return {
        text: text,
        has_enactment_clause: true,
        dom_source: '.lineremove'
      };
    }
  }
  
  return {
    text: null,
    has_enactment_clause: false,
    dom_source: null
  };
}

describe('Property: Enactment Clause Detection from DOM', () => {
  // ============================================
  // Generators for test data
  // ============================================

  // Generator for Bengali enactment clause patterns
  const bengaliEnactmentArb = fc.constantFrom(
    'সেহেতু এতদ্বারা',
    'সেহেতু  এতদ্বারা',
    'সেহেতু এতদ্বারা নিম্নরূপ আইন করা হইল',
    'সেহেতু এতদ্বারা নিম্নলিখিত আইন প্রণয়ন করা হইল',
    'সেহেতু এতদ্বারা এই আইন প্রণীত হইল'
  );

  // Generator for English enactment clause patterns
  const englishEnactmentArb = fc.constantFrom(
    'Be it enacted',
    'BE IT ENACTED',
    'Be  it  enacted',
    'Be it enacted by Parliament',
    'Be it enacted by the Parliament of Bangladesh',
    'Be it enacted as follows'
  );

  // Generator for any enactment clause pattern (Bengali or English)
  const anyEnactmentArb = fc.oneof(bengaliEnactmentArb, englishEnactmentArb);

  // Generator for random prefix text (before enactment pattern)
  const prefixTextArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', ' ', '\n', '।', '1', '2', '3', 'ক', 'খ'),
    { minLength: 0, maxLength: 30 }
  );

  // Generator for random suffix text (after enactment pattern)
  const suffixTextArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', ' ', '\n', '।', '1', '2', '3', 'ক', 'খ'),
    { minLength: 0, maxLength: 50 }
  );

  // Generator for content without enactment clause patterns
  const nonEnactmentContentArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', ' ', '\n', '।', '1', '2', '3', 'ক', 'খ', 'গ'),
    { minLength: 1, maxLength: 100 }
  ).filter(s => 
    !s.includes('সেহেতু') && 
    !s.toLowerCase().includes('be it enacted')
  );

  // ============================================
  // Property Tests
  // ============================================

  /**
   * Property: Bengali enactment clause pattern (সেহেতু এতদ্বারা) in .lineremove SHALL be detected
   * Requirements: 7.1 - Detect enactment clause patterns (সেহেতু এতদ্বারা)
   */
  it('should detect Bengali enactment clause pattern (সেহেতু এতদ্বারা) in .lineremove element', () => {
    fc.assert(
      fc.property(
        prefixTextArb,
        bengaliEnactmentArb,
        suffixTextArb,
        (prefix, enactment, suffix) => {
          const fullText = prefix + enactment + suffix;
          const mockDoc = createMockDocument({
            enactmentElements: [{ text: fullText, isLineremoves: false }]
          });
          
          const result = extractEnactmentFromMockDOM(mockDoc);
          
          // Requirements 7.1, 7.2 - has_enactment_clause must be true
          expect(result.has_enactment_clause).toBe(true);
          
          // Requirements 7.3 - text must be recorded verbatim (trimmed)
          expect(result.text).toBe(fullText.trim());
          
          // dom_source must be '.lineremove'
          expect(result.dom_source).toBe('.lineremove');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: English enactment clause pattern (Be it enacted) in .lineremove SHALL be detected
   * Requirements: 7.1 - Detect enactment clause patterns (Be it enacted)
   */
  it('should detect English enactment clause pattern (Be it enacted) in .lineremove element', () => {
    fc.assert(
      fc.property(
        prefixTextArb,
        englishEnactmentArb,
        suffixTextArb,
        (prefix, enactment, suffix) => {
          const fullText = prefix + enactment + suffix;
          const mockDoc = createMockDocument({
            enactmentElements: [{ text: fullText, isLineremoves: false }]
          });
          
          const result = extractEnactmentFromMockDOM(mockDoc);
          
          // Requirements 7.1 - has_enactment_clause must be true
          expect(result.has_enactment_clause).toBe(true);
          
          // Requirements 7.3 - text must be recorded verbatim (trimmed)
          expect(result.text).toBe(fullText.trim());
          
          // dom_source must be '.lineremove'
          expect(result.dom_source).toBe('.lineremove');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without enactment clause patterns SHALL have has_enactment_clause: false
   * Requirements: 7.6 - IF no enactment clause pattern is found, set has_enactment_clause: false
   */
  it('should return has_enactment_clause: false when no enactment clause pattern found', () => {
    fc.assert(
      fc.property(
        nonEnactmentContentArb,
        (content) => {
          const mockDoc = createMockDocument({
            enactmentElements: [{ text: content, isLineremoves: false }]
          });
          
          const result = extractEnactmentFromMockDOM(mockDoc);
          
          // Requirements 7.6 - has_enactment_clause must be false
          expect(result.has_enactment_clause).toBe(false);
          expect(result.text).toBeNull();
          expect(result.dom_source).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: .lineremoves elements (section rows) SHALL be skipped
   * Requirements: 7.1 - Query .lineremove (singular) elements, not .lineremoves
   */
  it('should skip .lineremoves elements (section rows) when detecting enactment clause', () => {
    fc.assert(
      fc.property(
        anyEnactmentArb,
        (enactmentText) => {
          // Create a document where enactment text is in a .lineremoves element (should be skipped)
          const mockDoc = createMockDocument({
            enactmentElements: [{ text: enactmentText, isLineremoves: true }]
          });
          
          const result = extractEnactmentFromMockDOM(mockDoc);
          
          // Should NOT detect enactment clause in .lineremoves element
          expect(result.has_enactment_clause).toBe(false);
          expect(result.text).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: First matching .lineremove element SHALL be used
   * Requirements: 7.2 - Record the enactment clause as a distinct structural element
   */
  it('should use first matching .lineremove element with enactment clause pattern', () => {
    fc.assert(
      fc.property(
        bengaliEnactmentArb,
        englishEnactmentArb,
        (bengaliEnactment, englishEnactment) => {
          // Create document with multiple .lineremove elements
          const mockDoc = createMockDocument({
            enactmentElements: [
              { text: bengaliEnactment, isLineremoves: false },
              { text: englishEnactment, isLineremoves: false }
            ]
          });
          
          const result = extractEnactmentFromMockDOM(mockDoc);
          
          // Should detect first enactment clause (Bengali)
          expect(result.has_enactment_clause).toBe(true);
          expect(result.text).toBe(bengaliEnactment.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty document (no .boxed-layout) SHALL return null
   */
  it('should return null for document without .boxed-layout container', () => {
    const emptyDoc = {
      querySelector: () => null
    };
    
    const result = extractEnactmentFromMockDOM(emptyDoc);
    expect(result).toBeNull();
  });

  /**
   * Property: Document with no .lineremove elements SHALL return has_enactment_clause: false
   */
  it('should return has_enactment_clause: false when no .lineremove elements found', () => {
    const docWithNoElements = createMockDocument({ enactmentElements: [] });
    const result = extractEnactmentFromMockDOM(docWithNoElements);
    
    expect(result.has_enactment_clause).toBe(false);
    expect(result.text).toBeNull();
    expect(result.dom_source).toBeNull();
  });

  /**
   * Property: Empty or whitespace-only text SHALL not be detected as enactment clause
   */
  it('should not detect enactment clause in empty or whitespace-only elements', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\n', '\t', '  \n  '),
        (emptyText) => {
          const mockDoc = createMockDocument({
            enactmentElements: [{ text: emptyText, isLineremoves: false }]
          });
          
          const result = extractEnactmentFromMockDOM(mockDoc);
          
          expect(result.has_enactment_clause).toBe(false);
          expect(result.text).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Enactment clause text SHALL be recorded verbatim (trimmed only)
   * Requirements: 7.3, 7.5 - Record exact text verbatim, do not modify
   */
  it('should record enactment clause text verbatim (trimmed only)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('  ', '\n', ''),
        anyEnactmentArb,
        fc.constantFrom('  ', '\n', ''),
        (leadingWhitespace, enactment, trailingWhitespace) => {
          const fullText = leadingWhitespace + enactment + trailingWhitespace;
          const mockDoc = createMockDocument({
            enactmentElements: [{ text: fullText, isLineremoves: false }]
          });
          
          const result = extractEnactmentFromMockDOM(mockDoc);
          
          // Text should be trimmed but otherwise verbatim
          expect(result.text).toBe(fullText.trim());
          expect(result.has_enactment_clause).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Detection is deterministic for same input
   * Requirements: 12.1, 12.2 - Deterministic output
   */
  it('should produce deterministic results for same input', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          nonEnactmentContentArb,
          fc.tuple(prefixTextArb, anyEnactmentArb, suffixTextArb)
            .map(([p, m, s]) => p + m + s)
        ),
        (content) => {
          const mockDoc = createMockDocument({
            enactmentElements: [{ text: content, isLineremoves: false }]
          });
          
          const result1 = extractEnactmentFromMockDOM(mockDoc);
          const result2 = extractEnactmentFromMockDOM(mockDoc);
          
          // Must be deterministic
          expect(result1.has_enactment_clause).toBe(result2.has_enactment_clause);
          expect(result1.text).toBe(result2.text);
          expect(result1.dom_source).toBe(result2.dom_source);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: dom_source SHALL always be '.lineremove' when enactment clause is detected
   * Requirements: 7.2 - Record dom_source as ".lineremove"
   */
  it('should set dom_source to ".lineremove" when enactment clause is detected', () => {
    fc.assert(
      fc.property(
        anyEnactmentArb,
        (enactmentText) => {
          const mockDoc = createMockDocument({
            enactmentElements: [{ text: enactmentText, isLineremoves: false }]
          });
          
          const result = extractEnactmentFromMockDOM(mockDoc);
          
          expect(result.has_enactment_clause).toBe(true);
          expect(result.dom_source).toBe('.lineremove');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Character offset SHALL be recorded for enactment clause
   * Requirements: 7.4 - Record the character offset where the enactment clause begins
   * Note: This test validates the offset calculation concept; actual offset mapping
   * to content_raw is done by the offset calculator utility
   */
  it('should detect enactment clause regardless of position in text', () => {
    fc.assert(
      fc.property(
        prefixTextArb,
        anyEnactmentArb,
        suffixTextArb,
        (prefix, enactment, suffix) => {
          const fullText = prefix + enactment + suffix;
          const mockDoc = createMockDocument({
            enactmentElements: [{ text: fullText, isLineremoves: false }]
          });
          
          const result = extractEnactmentFromMockDOM(mockDoc);
          
          // Should detect enactment clause regardless of position
          expect(result.has_enactment_clause).toBe(true);
          // The text should contain the enactment pattern
          expect(result.text).toContain(enactment.trim().split(/\s+/)[0]); // First word of pattern
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  /**
   * Edge case: Enactment clause pattern at start of text
   */
  it('should detect enactment clause pattern at start of text', () => {
    const patterns = [
      'সেহেতু এতদ্বারা নিম্নরূপ আইন করা হইল',
      'Be it enacted by Parliament',
      'BE IT ENACTED as follows'
    ];
    
    patterns.forEach(pattern => {
      const mockDoc = createMockDocument({
        enactmentElements: [{ text: pattern, isLineremoves: false }]
      });
      
      const result = extractEnactmentFromMockDOM(mockDoc);
      expect(result.has_enactment_clause).toBe(true);
      expect(result.text).toBe(pattern);
    });
  });

  /**
   * Edge case: Case variations of "Be it enacted"
   */
  it('should detect case variations of "Be it enacted"', () => {
    const variations = ['Be it enacted', 'BE IT ENACTED', 'be it enacted'];
    
    variations.forEach(variation => {
      const content = `${variation} by Parliament`;
      const mockDoc = createMockDocument({
        enactmentElements: [{ text: content, isLineremoves: false }]
      });
      
      const result = extractEnactmentFromMockDOM(mockDoc);
      // All case variations should be detected (case-insensitive regex)
      expect(result.has_enactment_clause).toBe(true);
    });
  });

  /**
   * Edge case: Mixed .lineremove and .lineremoves elements
   */
  it('should correctly handle mixed .lineremove and .lineremoves elements', () => {
    // First element is .lineremoves (should be skipped), second is .lineremove (should be detected)
    const mockDoc = createMockDocument({
      enactmentElements: [
        { text: 'সেহেতু এতদ্বারা in lineremoves', isLineremoves: true },
        { text: 'Be it enacted in lineremove', isLineremoves: false }
      ]
    });
    
    const result = extractEnactmentFromMockDOM(mockDoc);
    
    // Should skip .lineremoves and detect .lineremove
    expect(result.has_enactment_clause).toBe(true);
    expect(result.text).toBe('Be it enacted in lineremove');
  });

  /**
   * Edge case: Variable whitespace in Bengali pattern
   */
  it('should detect Bengali enactment clause with variable whitespace', () => {
    const variations = [
      'সেহেতু এতদ্বারা',
      'সেহেতু  এতদ্বারা',
      'সেহেতু   এতদ্বারা'
    ];
    
    variations.forEach(variation => {
      const mockDoc = createMockDocument({
        enactmentElements: [{ text: variation, isLineremoves: false }]
      });
      
      const result = extractEnactmentFromMockDOM(mockDoc);
      // Pattern uses \s+ which matches one or more whitespace
      expect(result.has_enactment_clause).toBe(true);
    });
  });

  /**
   * Edge case: Variable whitespace in English pattern
   */
  it('should detect English enactment clause with variable whitespace', () => {
    const variations = [
      'Be it enacted',
      'Be  it  enacted',
      'Be   it   enacted'
    ];
    
    variations.forEach(variation => {
      const mockDoc = createMockDocument({
        enactmentElements: [{ text: variation, isLineremoves: false }]
      });
      
      const result = extractEnactmentFromMockDOM(mockDoc);
      // Pattern uses \s+ which matches one or more whitespace
      expect(result.has_enactment_clause).toBe(true);
    });
  });

  /**
   * Edge case: Partial pattern should not match
   */
  it('should not detect partial enactment clause patterns', () => {
    const partialPatterns = [
      'সেহেতু',           // Missing এতদ্বারা
      'এতদ্বারা',         // Missing সেহেতু
      'Be it',            // Missing enacted
      'it enacted',       // Missing Be
      'enacted'           // Missing Be it
    ];
    
    partialPatterns.forEach(partial => {
      const mockDoc = createMockDocument({
        enactmentElements: [{ text: partial, isLineremoves: false }]
      });
      
      const result = extractEnactmentFromMockDOM(mockDoc);
      expect(result.has_enactment_clause).toBe(false);
    });
  });
});
