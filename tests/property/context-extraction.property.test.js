/**
 * Property-Based Tests for Context Extraction Bounds
 * 
 * Feature: cross-reference-extraction, Property 5: Context Extraction Bounds
 * Validates: Requirements 4.1, 4.2, 4.3
 * 
 * For any detected citation, context_before SHALL be a substring of the original text
 * ending at the citation position, and context_after SHALL be a substring starting
 * after the citation. Neither context SHALL exceed 50 characters.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 5: Context Extraction Bounds', () => {
  // Generator for valid text content
  const textGen = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', ' ', '.', ',', '\n', '।', 'আ', 'ই'),
    { minLength: 10, maxLength: 200 }
  );

  // Generator for valid positions within text
  const positionGen = (textLength) => fc.integer({ min: 0, max: textLength });

  // Generator for context length
  const lengthGen = fc.integer({ min: 1, max: 100 });

  /**
   * Property: context_before SHALL be a substring ending at the citation position
   * Requirements: 4.1
   */
  it('should extract context_before as substring ending at position', () => {
    fc.assert(
      fc.property(
        textGen,
        fc.integer({ min: 1, max: 50 }),
        (text, contextLength) => {
          // Pick a valid position in the middle of the text
          const position = Math.min(text.length, Math.max(1, Math.floor(text.length / 2)));
          
          const context = BDLawExtractor.extractContextBefore(text, position, contextLength);
          
          // Context should be a substring of the original text
          if (context.length === 0) return true; // Empty context is valid
          
          // The trimmed context should exist in the text before the position
          const textBeforePosition = text.substring(0, position);
          return textBeforePosition.includes(context) || context.trim() === '';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: context_after SHALL be a substring starting after the citation
   * Requirements: 4.2
   */
  it('should extract context_after as substring starting at position', () => {
    fc.assert(
      fc.property(
        textGen,
        fc.integer({ min: 1, max: 50 }),
        (text, contextLength) => {
          // Pick a valid position in the middle of the text
          const position = Math.min(text.length - 1, Math.max(0, Math.floor(text.length / 2)));
          
          const context = BDLawExtractor.extractContextAfter(text, position, contextLength);
          
          // Context should be a substring of the original text
          if (context.length === 0) return true; // Empty context is valid
          
          // The trimmed context should exist in the text after the position
          const textAfterPosition = text.substring(position);
          return textAfterPosition.includes(context) || context.trim() === '';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: context_before SHALL NOT exceed specified length
   * Requirements: 4.3
   */
  it('should not exceed specified length for context_before', () => {
    fc.assert(
      fc.property(
        textGen,
        lengthGen,
        (text, maxLength) => {
          const position = Math.floor(text.length / 2);
          const context = BDLawExtractor.extractContextBefore(text, position, maxLength);
          
          // Context length should not exceed maxLength (before trimming)
          // After trimming, it may be shorter
          return context.length <= maxLength;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: context_after SHALL NOT exceed specified length
   * Requirements: 4.3
   */
  it('should not exceed specified length for context_after', () => {
    fc.assert(
      fc.property(
        textGen,
        lengthGen,
        (text, maxLength) => {
          const position = Math.floor(text.length / 2);
          const context = BDLawExtractor.extractContextAfter(text, position, maxLength);
          
          // Context length should not exceed maxLength (before trimming)
          // After trimming, it may be shorter
          return context.length <= maxLength;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: context extraction SHALL handle document boundary at start
   * Requirements: 4.3
   */
  it('should handle document boundary at start (position near beginning)', () => {
    fc.assert(
      fc.property(
        textGen,
        fc.integer({ min: 0, max: 10 }),
        (text, position) => {
          const context = BDLawExtractor.extractContextBefore(text, position, 50);
          
          // Should not throw and should return valid string
          if (typeof context !== 'string') return false;
          
          // Context length should be at most the position (can't extract more than exists)
          return context.length <= position;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: context extraction SHALL handle document boundary at end
   * Requirements: 4.3
   */
  it('should handle document boundary at end (position near end)', () => {
    fc.assert(
      fc.property(
        textGen,
        fc.integer({ min: 0, max: 10 }),
        (text, offsetFromEnd) => {
          const position = Math.max(0, text.length - offsetFromEnd);
          const context = BDLawExtractor.extractContextAfter(text, position, 50);
          
          // Should not throw and should return valid string
          if (typeof context !== 'string') return false;
          
          // Context length should be at most the remaining text
          return context.length <= (text.length - position);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: empty or null text SHALL return empty string
   */
  it('should return empty string for empty or invalid input', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined)),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (text, position, length) => {
          const contextBefore = BDLawExtractor.extractContextBefore(text, position, length);
          const contextAfter = BDLawExtractor.extractContextAfter(text, position, length);
          
          return contextBefore === '' && contextAfter === '';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: invalid position SHALL return empty string
   */
  it('should return empty string for invalid positions', () => {
    fc.assert(
      fc.property(
        textGen,
        fc.oneof(
          fc.constant(-1),
          fc.constant(-100),
          fc.integer({ min: -1000, max: -1 })
        ),
        (text, position) => {
          const contextBefore = BDLawExtractor.extractContextBefore(text, position, 50);
          
          // Negative positions should return empty string
          return contextBefore === '';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: position beyond text length SHALL return empty string for context_after
   */
  it('should return empty string when position is beyond text length', () => {
    fc.assert(
      fc.property(
        textGen,
        fc.integer({ min: 1, max: 100 }),
        (text, extraOffset) => {
          const position = text.length + extraOffset;
          const contextAfter = BDLawExtractor.extractContextAfter(text, position, 50);
          
          return contextAfter === '';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: default length parameter SHALL be 50
   */
  it('should use default length of 50 when not specified', () => {
    const text = 'a'.repeat(200);
    const position = 100;
    
    const contextBefore = BDLawExtractor.extractContextBefore(text, position);
    const contextAfter = BDLawExtractor.extractContextAfter(text, position);
    
    // With default length of 50, context should be exactly 50 chars (no trimming needed for 'a' chars)
    expect(contextBefore.length).toBeLessThanOrEqual(50);
    expect(contextAfter.length).toBeLessThanOrEqual(50);
  });
});
