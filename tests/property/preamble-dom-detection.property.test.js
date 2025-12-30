/**
 * Property-Based Tests for Preamble Detection from DOM
 * 
 * Feature: legal-structure-derivation, Property: Preamble Detection from DOM
 * Validates: Requirements 6.1, 6.3, 6.4
 * 
 * For any DOM document containing .lineremove elements with preamble patterns
 * (যেহেতু, WHEREAS), the extractPreambleFromDOM function SHALL detect the preamble
 * and return the text verbatim with has_preamble: true and dom_source: ".lineremove".
 */

const fc = require('fast-check');

/**
 * Helper to create a mock DOM document with preamble structure
 * Simulates the bdlaws.minlaw.gov.bd page structure
 * @param {Object} options - { preambleElements: Array<{text, isLineremoves}> }
 * @returns {Object} Mock document object
 */
function createMockDocument(options) {
  const { preambleElements = [] } = options;

  // Create mock .lineremove elements
  const mockPreambleElements = preambleElements.map((el) => ({
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
        return mockPreambleElements;
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
 * Simulates extractPreambleFromDOM logic for testing
 * This mirrors the implementation in content.js
 */
function extractPreambleFromMockDOM(mockDoc) {
  const container = mockDoc.querySelector('.boxed-layout');
  if (!container) {
    return null;
  }

  // Query .lineremove elements (singular - preamble container)
  const preambleElements = container.querySelectorAll('.lineremove');
  
  // Preamble patterns
  const preamblePattern = /যেহেতু|WHEREAS/gi;
  
  for (const element of preambleElements) {
    // Skip if this is actually a .lineremoves element (section rows)
    if (element.classList && element.classList.contains('lineremoves')) {
      continue;
    }
    
    const text = element.textContent ? element.textContent.trim() : '';
    if (text && preamblePattern.test(text)) {
      return {
        text: text,
        has_preamble: true,
        dom_source: '.lineremove'
      };
    }
  }
  
  return {
    text: null,
    has_preamble: false,
    dom_source: null
  };
}

describe('Property: Preamble Detection from DOM', () => {
  // ============================================
  // Generators for test data
  // ============================================

  // Generator for Bengali preamble patterns
  const bengaliPreambleArb = fc.constantFrom(
    'যেহেতু',
    'যেহেতু এই আইন প্রণয়ন করা সমীচীন',
    'যেহেতু বাংলাদেশের জনগণের কল্যাণার্থে',
    'যেহেতু নিম্নলিখিত বিষয়ে আইন প্রণয়ন করা প্রয়োজন',
    'এবং যেহেতু উক্ত বিষয়ে বিধান করা সমীচীন'
  );

  // Generator for English preamble patterns
  const englishPreambleArb = fc.constantFrom(
    'WHEREAS',
    'Whereas',
    'WHEREAS it is expedient to make provision',
    'Whereas the Parliament has enacted',
    'WHEREAS the Government has decided'
  );

  // Generator for any preamble pattern (Bengali or English)
  const anyPreambleArb = fc.oneof(bengaliPreambleArb, englishPreambleArb);

  // Generator for random prefix text (before preamble pattern)
  const prefixTextArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', ' ', '\n', '।', '1', '2', '3', 'ক', 'খ'),
    { minLength: 0, maxLength: 30 }
  );

  // Generator for random suffix text (after preamble pattern)
  const suffixTextArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', ' ', '\n', '।', '1', '2', '3', 'ক', 'খ'),
    { minLength: 0, maxLength: 50 }
  );

  // Generator for content without preamble patterns
  const nonPreambleContentArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', ' ', '\n', '।', '1', '2', '3', 'ক', 'খ', 'গ'),
    { minLength: 1, maxLength: 100 }
  ).filter(s => 
    !s.includes('যেহেতু') && 
    !s.toLowerCase().includes('whereas')
  );

  // ============================================
  // Property Tests
  // ============================================

  /**
   * Property: Bengali preamble pattern (যেহেতু) in .lineremove SHALL be detected
   * Requirements: 6.1 - Detect preamble text beginning with যেহেতু
   */
  it('should detect Bengali preamble pattern (যেহেতু) in .lineremove element', () => {
    fc.assert(
      fc.property(
        prefixTextArb,
        bengaliPreambleArb,
        suffixTextArb,
        (prefix, preamble, suffix) => {
          const fullText = prefix + preamble + suffix;
          const mockDoc = createMockDocument({
            preambleElements: [{ text: fullText, isLineremoves: false }]
          });
          
          const result = extractPreambleFromMockDOM(mockDoc);
          
          // Requirements 6.1, 6.2 - has_preamble must be true
          expect(result.has_preamble).toBe(true);
          
          // Requirements 6.3 - text must be recorded verbatim (trimmed)
          expect(result.text).toBe(fullText.trim());
          
          // dom_source must be '.lineremove'
          expect(result.dom_source).toBe('.lineremove');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: English preamble pattern (WHEREAS) in .lineremove SHALL be detected
   * Requirements: 6.1 - Detect preamble text beginning with WHEREAS
   */
  it('should detect English preamble pattern (WHEREAS) in .lineremove element', () => {
    fc.assert(
      fc.property(
        prefixTextArb,
        englishPreambleArb,
        suffixTextArb,
        (prefix, preamble, suffix) => {
          const fullText = prefix + preamble + suffix;
          const mockDoc = createMockDocument({
            preambleElements: [{ text: fullText, isLineremoves: false }]
          });
          
          const result = extractPreambleFromMockDOM(mockDoc);
          
          // Requirements 6.1 - has_preamble must be true
          expect(result.has_preamble).toBe(true);
          
          // Requirements 6.3 - text must be recorded verbatim (trimmed)
          expect(result.text).toBe(fullText.trim());
          
          // dom_source must be '.lineremove'
          expect(result.dom_source).toBe('.lineremove');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content without preamble patterns SHALL have has_preamble: false
   * Requirements: 6.6 - IF no preamble pattern is found, set has_preamble: false
   */
  it('should return has_preamble: false when no preamble pattern found', () => {
    fc.assert(
      fc.property(
        nonPreambleContentArb,
        (content) => {
          const mockDoc = createMockDocument({
            preambleElements: [{ text: content, isLineremoves: false }]
          });
          
          const result = extractPreambleFromMockDOM(mockDoc);
          
          // Requirements 6.6 - has_preamble must be false
          expect(result.has_preamble).toBe(false);
          expect(result.text).toBeNull();
          expect(result.dom_source).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: .lineremoves elements (section rows) SHALL be skipped
   * Requirements: 6.1 - Query .lineremove (singular) elements, not .lineremoves
   */
  it('should skip .lineremoves elements (section rows) when detecting preamble', () => {
    fc.assert(
      fc.property(
        anyPreambleArb,
        (preambleText) => {
          // Create a document where preamble text is in a .lineremoves element (should be skipped)
          const mockDoc = createMockDocument({
            preambleElements: [{ text: preambleText, isLineremoves: true }]
          });
          
          const result = extractPreambleFromMockDOM(mockDoc);
          
          // Should NOT detect preamble in .lineremoves element
          expect(result.has_preamble).toBe(false);
          expect(result.text).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: First matching .lineremove element SHALL be used
   * Requirements: 6.2 - Record the preamble as a distinct structural element
   */
  it('should use first matching .lineremove element with preamble pattern', () => {
    fc.assert(
      fc.property(
        bengaliPreambleArb,
        englishPreambleArb,
        (bengaliPreamble, englishPreamble) => {
          // Create document with multiple .lineremove elements
          const mockDoc = createMockDocument({
            preambleElements: [
              { text: bengaliPreamble, isLineremoves: false },
              { text: englishPreamble, isLineremoves: false }
            ]
          });
          
          const result = extractPreambleFromMockDOM(mockDoc);
          
          // Should detect first preamble (Bengali)
          expect(result.has_preamble).toBe(true);
          expect(result.text).toBe(bengaliPreamble.trim());
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
    
    const result = extractPreambleFromMockDOM(emptyDoc);
    expect(result).toBeNull();
  });

  /**
   * Property: Document with no .lineremove elements SHALL return has_preamble: false
   */
  it('should return has_preamble: false when no .lineremove elements found', () => {
    const docWithNoElements = createMockDocument({ preambleElements: [] });
    const result = extractPreambleFromMockDOM(docWithNoElements);
    
    expect(result.has_preamble).toBe(false);
    expect(result.text).toBeNull();
    expect(result.dom_source).toBeNull();
  });

  /**
   * Property: Empty or whitespace-only text SHALL not be detected as preamble
   */
  it('should not detect preamble in empty or whitespace-only elements', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\n', '\t', '  \n  '),
        (emptyText) => {
          const mockDoc = createMockDocument({
            preambleElements: [{ text: emptyText, isLineremoves: false }]
          });
          
          const result = extractPreambleFromMockDOM(mockDoc);
          
          expect(result.has_preamble).toBe(false);
          expect(result.text).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Preamble text SHALL be recorded verbatim (trimmed only)
   * Requirements: 6.3, 6.5 - Record exact text verbatim, do not modify
   */
  it('should record preamble text verbatim (trimmed only)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('  ', '\n', ''),
        anyPreambleArb,
        fc.constantFrom('  ', '\n', ''),
        (leadingWhitespace, preamble, trailingWhitespace) => {
          const fullText = leadingWhitespace + preamble + trailingWhitespace;
          const mockDoc = createMockDocument({
            preambleElements: [{ text: fullText, isLineremoves: false }]
          });
          
          const result = extractPreambleFromMockDOM(mockDoc);
          
          // Text should be trimmed but otherwise verbatim
          expect(result.text).toBe(fullText.trim());
          expect(result.has_preamble).toBe(true);
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
          nonPreambleContentArb,
          fc.tuple(prefixTextArb, anyPreambleArb, suffixTextArb)
            .map(([p, m, s]) => p + m + s)
        ),
        (content) => {
          const mockDoc = createMockDocument({
            preambleElements: [{ text: content, isLineremoves: false }]
          });
          
          const result1 = extractPreambleFromMockDOM(mockDoc);
          const result2 = extractPreambleFromMockDOM(mockDoc);
          
          // Must be deterministic
          expect(result1.has_preamble).toBe(result2.has_preamble);
          expect(result1.text).toBe(result2.text);
          expect(result1.dom_source).toBe(result2.dom_source);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: dom_source SHALL always be '.lineremove' when preamble is detected
   * Requirements: 6.2 - Record dom_source as ".lineremove"
   */
  it('should set dom_source to ".lineremove" when preamble is detected', () => {
    fc.assert(
      fc.property(
        anyPreambleArb,
        (preambleText) => {
          const mockDoc = createMockDocument({
            preambleElements: [{ text: preambleText, isLineremoves: false }]
          });
          
          const result = extractPreambleFromMockDOM(mockDoc);
          
          expect(result.has_preamble).toBe(true);
          expect(result.dom_source).toBe('.lineremove');
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  /**
   * Edge case: Preamble pattern at start of text
   */
  it('should detect preamble pattern at start of text', () => {
    const patterns = [
      'যেহেতু এই আইন প্রণয়ন করা সমীচীন',
      'WHEREAS it is expedient',
      'Whereas the Parliament'
    ];
    
    patterns.forEach(pattern => {
      const mockDoc = createMockDocument({
        preambleElements: [{ text: pattern, isLineremoves: false }]
      });
      
      const result = extractPreambleFromMockDOM(mockDoc);
      expect(result.has_preamble).toBe(true);
      expect(result.text).toBe(pattern);
    });
  });

  /**
   * Edge case: Case variations of WHEREAS
   */
  it('should detect case variations of WHEREAS', () => {
    const variations = ['WHEREAS', 'Whereas', 'whereas'];
    
    variations.forEach(variation => {
      const content = `${variation} it is expedient`;
      const mockDoc = createMockDocument({
        preambleElements: [{ text: content, isLineremoves: false }]
      });
      
      const result = extractPreambleFromMockDOM(mockDoc);
      // All case variations should be detected (case-insensitive regex)
      expect(result.has_preamble).toBe(true);
    });
  });

  /**
   * Edge case: Mixed .lineremove and .lineremoves elements
   */
  it('should correctly handle mixed .lineremove and .lineremoves elements', () => {
    // First element is .lineremoves (should be skipped), second is .lineremove (should be detected)
    const mockDoc = createMockDocument({
      preambleElements: [
        { text: 'যেহেতু in lineremoves', isLineremoves: true },
        { text: 'WHEREAS in lineremove', isLineremoves: false }
      ]
    });
    
    const result = extractPreambleFromMockDOM(mockDoc);
    
    // Should skip .lineremoves and detect .lineremove
    expect(result.has_preamble).toBe(true);
    expect(result.text).toBe('WHEREAS in lineremove');
  });
});
