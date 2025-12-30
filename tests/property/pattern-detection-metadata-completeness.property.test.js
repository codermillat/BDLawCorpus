/**
 * Property Test: Pattern Detection Metadata Completeness
 * Feature: textual-fidelity-extraction
 * Property 12: Pattern Detection Metadata Completeness
 * 
 * For any extraction result, the metadata SHALL include boolean fields
 * `preamble_captured` and `enactment_clause_captured`. When patterns are detected,
 * `has_preamble` and `has_enactment_clause` SHALL be set to `true`.
 * These fields SHALL always be present (never undefined or null).
 * 
 * Validates: Requirements 1.5, 1.6, 8.4, 9.4
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Feature: textual-fidelity-extraction, Property 12: Pattern Detection Metadata Completeness', () => {
  // ============================================
  // Generators for test data
  // ============================================

  // Generator for content with preamble patterns
  const preambleContentArb = fc.oneof(
    fc.constant('যেহেতু এই আইন প্রণয়ন করা সমীচীন'),
    fc.constant('এবং যেহেতু উক্ত বিষয়ে বিধান করা সমীচীন'),
    fc.constant('WHEREAS it is expedient to make provision'),
    fc.constant('Whereas the Parliament has enacted'),
    fc.tuple(
      fc.stringOf(fc.constantFrom('a', 'b', ' ', '\n'), { minLength: 0, maxLength: 50 }),
      fc.constantFrom('যেহেতু', 'WHEREAS', 'Whereas'),
      fc.stringOf(fc.constantFrom('a', 'b', ' ', '\n'), { minLength: 0, maxLength: 50 })
    ).map(([p, m, s]) => p + ' ' + m + ' ' + s)
  );

  // Generator for content with enactment patterns
  const enactmentContentArb = fc.oneof(
    fc.constant('সেহেতু এতদ্বারা আইন করা হইল'),
    fc.constant('এতদ্বারা নিম্নরূপ আইন করা হইল'),
    fc.constant('Be it enacted by Parliament'),
    fc.constant('IT IS HEREBY ENACTED'),
    fc.tuple(
      fc.stringOf(fc.constantFrom('a', 'b', ' ', '\n'), { minLength: 0, maxLength: 50 }),
      fc.constantFrom('সেহেতু এতদ্বারা আইন করা হইল', 'Be it enacted'),
      fc.stringOf(fc.constantFrom('a', 'b', ' ', '\n'), { minLength: 0, maxLength: 50 })
    ).map(([p, m, s]) => p + ' ' + m + ' ' + s)
  );

  // Generator for content without patterns
  const noPatternContentArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'ক', 'খ', 'গ', ' ', '\n', '।', '1', '2', '3'),
    { minLength: 10, maxLength: 200 }
  ).filter(s => 
    !s.includes('যেহেতু') && 
    !s.toLowerCase().includes('whereas') &&
    !s.includes('সেহেতু') &&
    !s.includes('এতদ্বারা') &&
    !s.toLowerCase().includes('enacted')
  );

  // Generator for arbitrary content
  const arbitraryContentArb = fc.oneof(
    preambleContentArb,
    enactmentContentArb,
    noPatternContentArb,
    fc.constant(''),
    fc.constant('   ')
  );

  // ============================================
  // Property Tests
  // ============================================

  test('detectPreamble result SHALL always have has_preamble field (never undefined)', () => {
    fc.assert(
      fc.property(
        arbitraryContentArb,
        (content) => {
          const result = BDLawExtractor.detectPreamble(content);
          
          // Requirements 8.4 - has_preamble must always be present
          expect(result.has_preamble).toBeDefined();
          expect(result.has_preamble).not.toBeNull();
          expect(typeof result.has_preamble).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('detectPreamble result SHALL always have preamble_captured field (never undefined)', () => {
    fc.assert(
      fc.property(
        arbitraryContentArb,
        (content) => {
          const result = BDLawExtractor.detectPreamble(content);
          
          // Requirements 1.5 - preamble_captured must always be present
          expect(result.preamble_captured).toBeDefined();
          expect(result.preamble_captured).not.toBeNull();
          expect(typeof result.preamble_captured).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('detectEnactmentClause result SHALL always have has_enactment_clause field (never undefined)', () => {
    fc.assert(
      fc.property(
        arbitraryContentArb,
        (content) => {
          const result = BDLawExtractor.detectEnactmentClause(content);
          
          // Requirements 9.4 - has_enactment_clause must always be present
          expect(result.has_enactment_clause).toBeDefined();
          expect(result.has_enactment_clause).not.toBeNull();
          expect(typeof result.has_enactment_clause).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('detectEnactmentClause result SHALL always have enactment_clause_captured field (never undefined)', () => {
    fc.assert(
      fc.property(
        arbitraryContentArb,
        (content) => {
          const result = BDLawExtractor.detectEnactmentClause(content);
          
          // Requirements 1.6 - enactment_clause_captured must always be present
          expect(result.enactment_clause_captured).toBeDefined();
          expect(result.enactment_clause_captured).not.toBeNull();
          expect(typeof result.enactment_clause_captured).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('When preamble pattern detected, has_preamble SHALL be true', () => {
    fc.assert(
      fc.property(
        preambleContentArb,
        (content) => {
          const result = BDLawExtractor.detectPreamble(content);
          
          // Requirements 8.4 - has_preamble must be true when pattern detected
          expect(result.has_preamble).toBe(true);
          expect(result.preamble_captured).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('When enactment pattern detected, has_enactment_clause SHALL be true', () => {
    fc.assert(
      fc.property(
        enactmentContentArb,
        (content) => {
          const result = BDLawExtractor.detectEnactmentClause(content);
          
          // Requirements 9.4 - has_enactment_clause must be true when pattern detected
          expect(result.has_enactment_clause).toBe(true);
          expect(result.enactment_clause_captured).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('When no preamble pattern, has_preamble SHALL be false', () => {
    fc.assert(
      fc.property(
        noPatternContentArb,
        (content) => {
          const result = BDLawExtractor.detectPreamble(content);
          
          // No pattern means false
          expect(result.has_preamble).toBe(false);
          expect(result.preamble_captured).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('When no enactment pattern, has_enactment_clause SHALL be false', () => {
    fc.assert(
      fc.property(
        noPatternContentArb,
        (content) => {
          const result = BDLawExtractor.detectEnactmentClause(content);
          
          // No pattern means false
          expect(result.has_enactment_clause).toBe(false);
          expect(result.enactment_clause_captured).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('preamble_start_position SHALL be number when detected, null otherwise', () => {
    fc.assert(
      fc.property(
        arbitraryContentArb,
        (content) => {
          const result = BDLawExtractor.detectPreamble(content);
          
          if (result.has_preamble) {
            // When detected, position must be a number
            expect(typeof result.preamble_start_position).toBe('number');
            expect(result.preamble_start_position).toBeGreaterThanOrEqual(0);
          } else {
            // When not detected, position must be null
            expect(result.preamble_start_position).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('enactment_clause_position SHALL be number when detected, null otherwise', () => {
    fc.assert(
      fc.property(
        arbitraryContentArb,
        (content) => {
          const result = BDLawExtractor.detectEnactmentClause(content);
          
          if (result.has_enactment_clause) {
            // When detected, position must be a number
            expect(typeof result.enactment_clause_position).toBe('number');
            expect(result.enactment_clause_position).toBeGreaterThanOrEqual(0);
          } else {
            // When not detected, position must be null
            expect(result.enactment_clause_position).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('has_preamble and preamble_captured SHALL be consistent', () => {
    fc.assert(
      fc.property(
        arbitraryContentArb,
        (content) => {
          const result = BDLawExtractor.detectPreamble(content);
          
          // These fields should always be equal
          expect(result.has_preamble).toBe(result.preamble_captured);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('has_enactment_clause and enactment_clause_captured SHALL be consistent', () => {
    fc.assert(
      fc.property(
        arbitraryContentArb,
        (content) => {
          const result = BDLawExtractor.detectEnactmentClause(content);
          
          // These fields should always be equal
          expect(result.has_enactment_clause).toBe(result.enactment_clause_captured);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('Empty and null inputs SHALL return complete metadata with false values', () => {
    const emptyInputs = ['', '   ', null, undefined];
    
    emptyInputs.forEach(input => {
      const preambleResult = BDLawExtractor.detectPreamble(input);
      const enactmentResult = BDLawExtractor.detectEnactmentClause(input);
      
      // All fields must be present
      expect(preambleResult.has_preamble).toBe(false);
      expect(preambleResult.preamble_captured).toBe(false);
      expect(preambleResult.preamble_start_position).toBeNull();
      
      expect(enactmentResult.has_enactment_clause).toBe(false);
      expect(enactmentResult.enactment_clause_captured).toBe(false);
      expect(enactmentResult.enactment_clause_position).toBeNull();
    });
  });

  test('Legacy fields SHALL be present for backward compatibility', () => {
    const content = 'যেহেতু এই আইন';
    const preambleResult = BDLawExtractor.detectPreamble(content);
    const enactmentResult = BDLawExtractor.detectEnactmentClause(content);
    
    // Legacy preamble fields
    expect(preambleResult).toHaveProperty('preamble_present');
    expect(preambleResult).toHaveProperty('preamble_markers');
    expect(Array.isArray(preambleResult.preamble_markers)).toBe(true);
    
    // Legacy enactment fields
    expect(enactmentResult).toHaveProperty('enactment_clause_present');
    expect(enactmentResult).toHaveProperty('enactment_markers');
    expect(Array.isArray(enactmentResult.enactment_markers)).toBe(true);
  });

  test('preamble_markers SHALL contain detected patterns', () => {
    const content = 'যেহেতু এই আইন WHEREAS it is expedient';
    const result = BDLawExtractor.detectPreamble(content);
    
    expect(result.preamble_markers.length).toBeGreaterThan(0);
    // Should contain at least one of the patterns
    const hasPattern = result.preamble_markers.some(m => 
      m.includes('যেহেতু') || m.includes('WHEREAS') || m.includes('Whereas')
    );
    expect(hasPattern).toBe(true);
  });

  test('enactment_markers SHALL contain detected patterns', () => {
    const content = 'সেহেতু এতদ্বারা আইন করা হইল Be it enacted';
    const result = BDLawExtractor.detectEnactmentClause(content);
    
    expect(result.enactment_markers.length).toBeGreaterThan(0);
  });
});
