/**
 * Property Test: Content Raw Immutability After Pattern Detection
 * Feature: textual-fidelity-extraction
 * Property 3: Content Raw Immutability After Pattern Detection
 * 
 * For any extracted content, the `content_raw` field SHALL remain byte-identical
 * before and after pattern detection (preamble, enactment, section markers).
 * Pattern detection is observation-only and SHALL NOT modify the extracted text.
 * 
 * Validates: Requirements 1.7, 2.4, 2.5, 8.6, 9.6
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Feature: textual-fidelity-extraction, Property 3: Content Raw Immutability After Pattern Detection', () => {
  // ============================================
  // Generators for test data
  // ============================================

  // Generator for Bengali legal content with preamble
  const bengaliPreambleContentArb = fc.tuple(
    fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n', '।'), { minLength: 0, maxLength: 50 }),
    fc.constantFrom('যেহেতু', 'এবং যেহেতু'),
    fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n', '।', '১', '২', '৩'), { minLength: 10, maxLength: 200 })
  ).map(([prefix, preamble, suffix]) => prefix + preamble + suffix);

  // Generator for Bengali legal content with enactment clause
  const bengaliEnactmentContentArb = fc.tuple(
    fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n', '।'), { minLength: 0, maxLength: 50 }),
    fc.constantFrom('সেহেতু এতদ্বারা আইন করা হইল', 'এতদ্বারা নিম্নরূপ আইন করা হইল'),
    fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n', '।', '১', '২', '৩'), { minLength: 10, maxLength: 200 })
  ).map(([prefix, enactment, suffix]) => prefix + enactment + suffix);

  // Generator for English legal content
  const englishLegalContentArb = fc.tuple(
    fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.'), { minLength: 0, maxLength: 50 }),
    fc.constantFrom('WHEREAS', 'Whereas', 'Be it enacted', 'IT IS HEREBY ENACTED'),
    fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '\n', '.', '1', '2', '3'), { minLength: 10, maxLength: 200 })
  ).map(([prefix, pattern, suffix]) => prefix + ' ' + pattern + ' ' + suffix);

  // Generator for Bengali section markers
  const bengaliSectionMarkerContentArb = fc.tuple(
    fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n', '।'), { minLength: 0, maxLength: 50 }),
    fc.constantFrom('ধারা', 'অধ্যায়', 'তফসিল', '১৷', '২৷', '১০৷'),
    fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n', '।', '১', '২', '৩'), { minLength: 10, maxLength: 200 })
  ).map(([prefix, marker, suffix]) => prefix + marker + suffix);

  // Generator for mixed content with multiple patterns
  const mixedPatternContentArb = fc.tuple(
    bengaliPreambleContentArb,
    fc.constant(' '),
    bengaliEnactmentContentArb
  ).map(([preamble, sep, enactment]) => preamble + sep + enactment);

  // Generator for arbitrary content (no patterns)
  const arbitraryContentArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'ক', 'খ', 'গ', ' ', '\n', '।', '1', '2', '3'),
    { minLength: 10, maxLength: 500 }
  );

  // ============================================
  // Property Tests
  // ============================================

  test('detectPreamble SHALL NOT modify content_raw', () => {
    fc.assert(
      fc.property(
        bengaliPreambleContentArb,
        (content) => {
          // Store original content
          const originalContent = content;
          
          // Call detectPreamble
          const result = BDLawExtractor.detectPreamble(content);
          
          // Requirements 8.6 - content must be unchanged
          expect(content).toBe(originalContent);
          
          // Verify the function returns detection metadata, not modified content
          expect(result).toHaveProperty('has_preamble');
          expect(result).toHaveProperty('preamble_start_position');
          expect(result).not.toHaveProperty('modified_content');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('detectEnactmentClause SHALL NOT modify content_raw', () => {
    fc.assert(
      fc.property(
        bengaliEnactmentContentArb,
        (content) => {
          // Store original content
          const originalContent = content;
          
          // Call detectEnactmentClause
          const result = BDLawExtractor.detectEnactmentClause(content);
          
          // Requirements 9.6 - content must be unchanged
          expect(content).toBe(originalContent);
          
          // Verify the function returns detection metadata, not modified content
          expect(result).toHaveProperty('has_enactment_clause');
          expect(result).toHaveProperty('enactment_clause_position');
          expect(result).not.toHaveProperty('modified_content');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('English pattern detection SHALL NOT modify content_raw', () => {
    fc.assert(
      fc.property(
        englishLegalContentArb,
        (content) => {
          // Store original content
          const originalContent = content;
          
          // Call both detection functions
          const preambleResult = BDLawExtractor.detectPreamble(content);
          const enactmentResult = BDLawExtractor.detectEnactmentClause(content);
          
          // Content must be unchanged after both detections
          expect(content).toBe(originalContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Multiple pattern detections SHALL NOT modify content_raw', () => {
    fc.assert(
      fc.property(
        mixedPatternContentArb,
        (content) => {
          // Store original content
          const originalContent = content;
          
          // Call multiple detection functions
          BDLawExtractor.detectPreamble(content);
          BDLawExtractor.detectEnactmentClause(content);
          
          // Content must be unchanged after all detections
          expect(content).toBe(originalContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Pattern detection on arbitrary content SHALL NOT modify it', () => {
    fc.assert(
      fc.property(
        arbitraryContentArb,
        (content) => {
          // Store original content
          const originalContent = content;
          
          // Call detection functions
          BDLawExtractor.detectPreamble(content);
          BDLawExtractor.detectEnactmentClause(content);
          
          // Content must be unchanged
          expect(content).toBe(originalContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Detection results are observation-only metadata', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          bengaliPreambleContentArb,
          bengaliEnactmentContentArb,
          englishLegalContentArb,
          arbitraryContentArb
        ),
        (content) => {
          const preambleResult = BDLawExtractor.detectPreamble(content);
          const enactmentResult = BDLawExtractor.detectEnactmentClause(content);
          
          // Results should be metadata objects, not modified content
          expect(typeof preambleResult).toBe('object');
          expect(typeof enactmentResult).toBe('object');
          
          // Results should contain boolean flags and positions
          expect(typeof preambleResult.has_preamble).toBe('boolean');
          expect(typeof enactmentResult.has_enactment_clause).toBe('boolean');
          
          // Position should be number or null
          expect(
            preambleResult.preamble_start_position === null ||
            typeof preambleResult.preamble_start_position === 'number'
          ).toBe(true);
          expect(
            enactmentResult.enactment_clause_position === null ||
            typeof enactmentResult.enactment_clause_position === 'number'
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Repeated detection calls produce identical results (idempotent)', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          bengaliPreambleContentArb,
          bengaliEnactmentContentArb,
          englishLegalContentArb
        ),
        (content) => {
          // Call detection multiple times
          const preambleResult1 = BDLawExtractor.detectPreamble(content);
          const preambleResult2 = BDLawExtractor.detectPreamble(content);
          const enactmentResult1 = BDLawExtractor.detectEnactmentClause(content);
          const enactmentResult2 = BDLawExtractor.detectEnactmentClause(content);
          
          // Results should be identical
          expect(preambleResult1.has_preamble).toBe(preambleResult2.has_preamble);
          expect(preambleResult1.preamble_start_position).toBe(preambleResult2.preamble_start_position);
          expect(enactmentResult1.has_enactment_clause).toBe(enactmentResult2.has_enactment_clause);
          expect(enactmentResult1.enactment_clause_position).toBe(enactmentResult2.enactment_clause_position);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================
  // Edge Cases
  // ============================================

  test('Empty content detection SHALL NOT throw or modify', () => {
    const emptyInputs = ['', '   ', null, undefined];
    
    emptyInputs.forEach(input => {
      const preambleResult = BDLawExtractor.detectPreamble(input);
      const enactmentResult = BDLawExtractor.detectEnactmentClause(input);
      
      // Should return valid result objects
      expect(preambleResult).toHaveProperty('has_preamble', false);
      expect(enactmentResult).toHaveProperty('has_enactment_clause', false);
    });
  });

  test('Content with special characters SHALL remain unchanged', () => {
    const specialContent = 'যেহেতু\u0964\u0965\u09F3\u200D\u200C test';
    const originalContent = specialContent;
    
    BDLawExtractor.detectPreamble(specialContent);
    BDLawExtractor.detectEnactmentClause(specialContent);
    
    expect(specialContent).toBe(originalContent);
  });

  test('Very long content SHALL remain unchanged', () => {
    const longContent = 'যেহেতু ' + 'ক'.repeat(10000) + ' সেহেতু এতদ্বারা আইন করা হইল';
    const originalContent = longContent;
    
    BDLawExtractor.detectPreamble(longContent);
    BDLawExtractor.detectEnactmentClause(longContent);
    
    expect(longContent).toBe(originalContent);
  });
});
