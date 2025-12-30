/**
 * Property Test: Preamble Pattern Detection Accuracy
 * Feature: textual-fidelity-extraction
 * Property 1: Preamble Pattern Detection Accuracy
 * 
 * For any Bengali or English legal text content, if the content contains a preamble
 * pattern ("যেহেতু", "এবং যেহেতু", "WHEREAS", "Whereas"), the extractor SHALL detect
 * it and set `has_preamble: true` with accurate `preamble_start_position` matching
 * the character offset of the first pattern occurrence.
 * 
 * Validates: Requirements 1.1, 1.2, 8.1, 8.2, 8.3, 8.4, 8.5
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Feature: textual-fidelity-extraction, Property 1: Preamble Pattern Detection Accuracy', () => {
  // ============================================
  // Generators for test data
  // ============================================

  // Generator for Bengali preamble start patterns
  const bengaliPreambleStartArb = fc.constantFrom(
    'যেহেতু',
    'যেহেতু এই আইন প্রণয়ন করা সমীচীন',
    'যেহেতু বাংলাদেশের জনগণের কল্যাণার্থে',
    'যেহেতু নিম্নলিখিত বিষয়ে আইন প্রণয়ন করা প্রয়োজন'
  );

  // Generator for Bengali preamble continuation patterns
  const bengaliPreambleContinuationArb = fc.constantFrom(
    'এবং যেহেতু',
    'এবং যেহেতু উক্ত বিষয়ে বিধান করা সমীচীন',
    'এবং যেহেতু এই আইন সংশোধন করা প্রয়োজন'
  );

  // Generator for English preamble patterns
  const englishPreambleArb = fc.constantFrom(
    'WHEREAS',
    'Whereas',
    'WHEREAS it is expedient to make provision',
    'Whereas the Parliament has enacted',
    'WHEREAS the Government has decided'
  );

  // Generator for random prefix text (before preamble) - must end with word boundary for English patterns
  // For Bengali patterns, word boundaries work differently, so we use space/newline
  const prefixTextArb = fc.tuple(
    fc.stringOf(
      fc.constantFrom('a', 'b', 'c', ' ', '\n', '।', '1', '2', '3'),
      { minLength: 0, maxLength: 50 }
    ),
    fc.constantFrom(' ', '\n', '.', ',', ';', ':', '।')  // Always include a boundary character
  ).map(([text, boundary]) => text + boundary);
  
  // Generator for prefix that can be empty (for position 0 tests)
  const emptyOrBoundaryPrefixArb = fc.oneof(
    fc.constant(''),
    prefixTextArb
  );

  // Generator for random suffix text (after preamble) - must start with word boundary for English patterns
  const suffixTextArb = fc.tuple(
    fc.constantFrom(' ', '\n', '.', ',', ';', ':', '।'),  // Always include a boundary character
    fc.stringOf(
      fc.constantFrom('a', 'b', 'c', ' ', '\n', '।', '1', '2', '3'),
      { minLength: 0, maxLength: 100 }
    )
  ).map(([boundary, rest]) => boundary + rest);
  
  // Generator for suffix that can be empty (for end of content tests)
  const emptyOrBoundarySuffixArb = fc.oneof(
    fc.constant(''),
    suffixTextArb
  );

  // Generator for content without preamble patterns
  const nonPreambleContentArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', ' ', '\n', '।', '1', '2', '3', 'ক', 'খ', 'গ'),
    { minLength: 10, maxLength: 200 }
  ).filter(s => 
    !s.includes('যেহেতু') && 
    !s.toLowerCase().includes('whereas') &&
    !s.includes('Preamble') &&
    !s.includes('প্রস্তাবনা')
  );

  // ============================================
  // Property Tests
  // ============================================

  test('Bengali preamble start pattern (যেহেতু) SHALL be detected with accurate position', () => {
    fc.assert(
      fc.property(
        prefixTextArb,
        bengaliPreambleStartArb,
        suffixTextArb,
        (prefix, preamble, suffix) => {
          const content = prefix + preamble + suffix;
          const expectedPosition = prefix.length;
          
          const result = BDLawExtractor.detectPreamble(content);
          
          // Requirements 8.1, 8.4 - has_preamble must be true
          expect(result.has_preamble).toBe(true);
          
          // Requirements 8.4 - preamble_captured must be true
          expect(result.preamble_captured).toBe(true);
          
          // Requirements 8.5 - preamble_start_position must match character offset
          expect(result.preamble_start_position).toBe(expectedPosition);
          
          // Legacy compatibility
          expect(result.preamble_present).toBe(true);
          expect(result.preamble_markers.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Bengali preamble continuation pattern (এবং যেহেতু) SHALL be detected', () => {
    fc.assert(
      fc.property(
        prefixTextArb,
        bengaliPreambleContinuationArb,
        suffixTextArb,
        (prefix, preamble, suffix) => {
          const content = prefix + preamble + suffix;
          const expectedPosition = prefix.length;
          
          const result = BDLawExtractor.detectPreamble(content);
          
          // Requirements 8.2, 8.4 - has_preamble must be true
          expect(result.has_preamble).toBe(true);
          expect(result.preamble_captured).toBe(true);
          
          // Position should be at the start of the continuation pattern
          expect(result.preamble_start_position).toBe(expectedPosition);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('English preamble patterns (WHEREAS, Whereas) SHALL be detected with accurate position', () => {
    fc.assert(
      fc.property(
        emptyOrBoundaryPrefixArb,
        englishPreambleArb,
        emptyOrBoundarySuffixArb,
        (prefix, preamble, suffix) => {
          const content = prefix + preamble + suffix;
          const expectedPosition = prefix.length;
          
          const result = BDLawExtractor.detectPreamble(content);
          
          // Requirements 8.3, 8.4 - has_preamble must be true
          expect(result.has_preamble).toBe(true);
          expect(result.preamble_captured).toBe(true);
          
          // Requirements 8.5 - preamble_start_position must match character offset
          expect(result.preamble_start_position).toBe(expectedPosition);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Content without preamble patterns SHALL have has_preamble: false', () => {
    fc.assert(
      fc.property(
        nonPreambleContentArb,
        (content) => {
          const result = BDLawExtractor.detectPreamble(content);
          
          // No preamble pattern present
          expect(result.has_preamble).toBe(false);
          expect(result.preamble_captured).toBe(false);
          expect(result.preamble_start_position).toBeNull();
          expect(result.preamble_markers).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Multiple preamble patterns SHALL record earliest position', () => {
    fc.assert(
      fc.property(
        prefixTextArb,
        bengaliPreambleStartArb,
        fc.stringOf(fc.constantFrom(' ', '\n', '।'), { minLength: 5, maxLength: 20 }),
        englishPreambleArb,
        suffixTextArb,
        (prefix, bengaliPreamble, middle, englishPreamble, suffix) => {
          const content = prefix + bengaliPreamble + middle + englishPreamble + suffix;
          const expectedPosition = prefix.length; // Bengali comes first
          
          const result = BDLawExtractor.detectPreamble(content);
          
          // Should detect both patterns
          expect(result.has_preamble).toBe(true);
          expect(result.preamble_markers.length).toBeGreaterThanOrEqual(1);
          
          // Position should be the earliest occurrence
          expect(result.preamble_start_position).toBe(expectedPosition);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Empty or null content SHALL return has_preamble: false', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', null, undefined),
        (content) => {
          const result = BDLawExtractor.detectPreamble(content);
          
          expect(result.has_preamble).toBe(false);
          expect(result.preamble_captured).toBe(false);
          expect(result.preamble_start_position).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Detection is deterministic for same input', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          nonPreambleContentArb,
          fc.tuple(prefixTextArb, bengaliPreambleStartArb, suffixTextArb)
            .map(([p, m, s]) => p + m + s),
          fc.tuple(prefixTextArb, englishPreambleArb, suffixTextArb)
            .map(([p, m, s]) => p + m + s)
        ),
        (content) => {
          const result1 = BDLawExtractor.detectPreamble(content);
          const result2 = BDLawExtractor.detectPreamble(content);
          
          // Must be deterministic
          expect(result1.has_preamble).toBe(result2.has_preamble);
          expect(result1.preamble_start_position).toBe(result2.preamble_start_position);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('Preamble at position 0 SHALL have preamble_start_position: 0', () => {
    const patterns = [
      'যেহেতু এই আইন প্রণয়ন করা সমীচীন',
      'WHEREAS it is expedient',
      'Whereas the Parliament'
    ];
    
    patterns.forEach(pattern => {
      const result = BDLawExtractor.detectPreamble(pattern);
      expect(result.has_preamble).toBe(true);
      expect(result.preamble_start_position).toBe(0);
    });
  });

  test('Case variations of WHEREAS SHALL be detected', () => {
    const variations = ['WHEREAS', 'Whereas', 'whereas'];
    
    variations.forEach(variation => {
      const content = `Some text ${variation} it is expedient`;
      const result = BDLawExtractor.detectPreamble(content);
      
      // WHEREAS and Whereas should be detected (case-insensitive)
      if (variation === 'WHEREAS' || variation === 'Whereas') {
        expect(result.has_preamble).toBe(true);
      }
    });
  });

  test('BengaliLegalPatterns.preamble patterns are accessible', () => {
    expect(BDLawExtractor.BengaliLegalPatterns).toBeDefined();
    expect(BDLawExtractor.BengaliLegalPatterns.preamble).toBeDefined();
    expect(BDLawExtractor.BengaliLegalPatterns.preamble.start).toBeDefined();
    expect(BDLawExtractor.BengaliLegalPatterns.preamble.continuation).toBeDefined();
    expect(BDLawExtractor.BengaliLegalPatterns.preamble.english).toBeDefined();
  });

  test('Result object has all required fields', () => {
    const content = 'যেহেতু এই আইন';
    const result = BDLawExtractor.detectPreamble(content);
    
    // New fields per Requirements 8.4, 8.5
    expect(result).toHaveProperty('has_preamble');
    expect(result).toHaveProperty('preamble_captured');
    expect(result).toHaveProperty('preamble_start_position');
    
    // Legacy fields for backward compatibility
    expect(result).toHaveProperty('preamble_present');
    expect(result).toHaveProperty('preamble_markers');
  });
});
