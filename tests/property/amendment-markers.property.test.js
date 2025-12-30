/**
 * Property-Based Tests for Amendment Marker Detection
 * 
 * Feature: bdlawcorpus-mode, Property 18: Amendment Marker Detection Completeness
 * Validates: Requirements 25.1, 25.2, 25.3, 25.4
 * 
 * For any text containing amendment markers ("বিলুপ্ত", "সংশোধিত", "প্রতিস্থাপিত"),
 * the detector SHALL identify all occurrences with line numbers and positions,
 * include them in the amendments array, and preserve the original text unchanged.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 18: Amendment Marker Detection Completeness', () => {
  const AMENDMENT_MARKERS = ['বিলুপ্ত', 'সংশোধিত', 'প্রতিস্থাপিত'];

  /**
   * Property: For any text with known marker insertions, all markers SHALL be detected
   * Validates: Requirements 25.1, 25.2
   */
  it('should detect all amendment markers inserted into random text', () => {
    const bengaliChars = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', ' ', '\n'),
      { minLength: 0, maxLength: 50 }
    );

    fc.assert(
      fc.property(
        bengaliChars,
        fc.constantFrom(...AMENDMENT_MARKERS),
        fc.integer({ min: 1, max: 5 }),
        (baseText, marker, insertCount) => {
          // Insert the marker a known number of times
          let text = baseText;
          for (let i = 0; i < insertCount; i++) {
            text += ` ${marker} `;
          }

          const detected = BDLawExtractor.detectAmendmentMarkers(text);

          // Count detected markers of this type
          const countOfType = detected.filter(m => m.type === marker).length;

          // Should detect at least the number we inserted
          return countOfType >= insertCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Detected markers should have correct type matching the marker text
   * Validates: Requirements 25.1
   */
  it('should correctly identify marker types for all detected markers', () => {
    const textWithMarkers = fc.array(
      fc.record({
        prefix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n'), { minLength: 0, maxLength: 20 }),
        marker: fc.constantFrom(...AMENDMENT_MARKERS)
      }),
      { minLength: 1, maxLength: 10 }
    );

    fc.assert(
      fc.property(
        textWithMarkers,
        (parts) => {
          const text = parts.map(p => p.prefix + p.marker).join('');
          const detected = BDLawExtractor.detectAmendmentMarkers(text);

          // Every detected marker should have a valid type
          return detected.every(m => AMENDMENT_MARKERS.includes(m.type));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Line numbers should be positive integers starting from 1
   * Validates: Requirements 25.2
   */
  it('should assign valid line numbers (1-based) to all detected markers', () => {
    const multiLineText = fc.array(
      fc.tuple(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 20 }),
        fc.constantFrom(...AMENDMENT_MARKERS, '')
      ),
      { minLength: 1, maxLength: 10 }
    );

    fc.assert(
      fc.property(
        multiLineText,
        (lines) => {
          const text = lines.map(([prefix, marker]) => prefix + marker).join('\n');
          const detected = BDLawExtractor.detectAmendmentMarkers(text);
          const totalLines = text.split('\n').length;

          // All line numbers should be valid
          return detected.every(m => 
            Number.isInteger(m.lineNumber) && 
            m.lineNumber >= 1 && 
            m.lineNumber <= totalLines
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position should be a valid index within the line
   * Validates: Requirements 25.2
   */
  it('should assign valid positions within the line for all detected markers', () => {
    const textWithMarkers = fc.array(
      fc.tuple(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 15 }),
        fc.constantFrom(...AMENDMENT_MARKERS)
      ),
      { minLength: 1, maxLength: 5 }
    );

    fc.assert(
      fc.property(
        textWithMarkers,
        (parts) => {
          const text = parts.map(([prefix, marker]) => prefix + marker).join('\n');
          const detected = BDLawExtractor.detectAmendmentMarkers(text);

          // All positions should be valid indices
          return detected.every(m => 
            Number.isInteger(m.position) && 
            m.position >= 0 &&
            m.position < m.line.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context should contain the marker and surrounding text
   * Validates: Requirements 25.3
   */
  it('should include context with surrounding text for all detected markers', () => {
    const textWithMarkers = fc.array(
      fc.tuple(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' '), { minLength: 5, maxLength: 30 }),
        fc.constantFrom(...AMENDMENT_MARKERS),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', ' '), { minLength: 5, maxLength: 30 })
      ),
      { minLength: 1, maxLength: 5 }
    );

    fc.assert(
      fc.property(
        textWithMarkers,
        (parts) => {
          const text = parts.map(([prefix, marker, suffix]) => prefix + marker + suffix).join('\n');
          const detected = BDLawExtractor.detectAmendmentMarkers(text);

          // Every detected marker should have context containing the marker
          return detected.every(m => 
            typeof m.context === 'string' &&
            m.context.includes(m.type)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null text should return empty results
   * Validates: Requirements 25.1
   */
  it('should return empty results for empty or invalid input', () => {
    const invalidInputs = fc.oneof(
      fc.constant(''),
      fc.constant(null),
      fc.constant(undefined)
    );

    fc.assert(
      fc.property(
        invalidInputs,
        (input) => {
          const detected = BDLawExtractor.detectAmendmentMarkers(input);
          return detected.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Text without markers should return empty array
   * Validates: Requirements 25.1
   */
  it('should return empty array for text without any amendment markers', () => {
    // Generate text that definitely doesn't contain amendment markers
    const textWithoutMarkers = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', ' ', '\n', '.', 'ক', 'খ', 'গ'),
      { minLength: 0, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        textWithoutMarkers,
        (text) => {
          const detected = BDLawExtractor.detectAmendmentMarkers(text);
          return detected.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple markers on the same line should all be detected
   * Validates: Requirements 25.1, 25.2
   */
  it('should detect multiple markers on the same line', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...AMENDMENT_MARKERS), { minLength: 2, maxLength: 5 }),
        (markers) => {
          // Put all markers on a single line
          const text = markers.join(' ');
          const detected = BDLawExtractor.detectAmendmentMarkers(text);

          // All markers should be on line 1
          const allOnLine1 = detected.every(m => m.lineNumber === 1);
          
          // Should detect at least as many as we inserted
          return allOnLine1 && detected.length >= markers.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Original text should be preserved unchanged (line field)
   * Validates: Requirements 25.4
   */
  it('should preserve original line text unchanged in detected markers', () => {
    const textWithMarkers = fc.array(
      fc.tuple(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 20 }),
        fc.constantFrom(...AMENDMENT_MARKERS),
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 20 })
      ),
      { minLength: 1, maxLength: 5 }
    );

    fc.assert(
      fc.property(
        textWithMarkers,
        (parts) => {
          const lines = parts.map(([prefix, marker, suffix]) => prefix + marker + suffix);
          const text = lines.join('\n');
          const detected = BDLawExtractor.detectAmendmentMarkers(text);

          // Each detected marker's line should match the original line
          return detected.every(m => {
            const originalLine = lines[m.lineNumber - 1];
            return m.line === originalLine;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each marker type should be correctly distinguished
   * Validates: Requirements 25.1
   */
  it('should distinguish between different amendment marker types', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(AMENDMENT_MARKERS, { minLength: 1, maxLength: 3 }),
        (selectedMarkers) => {
          const text = selectedMarkers.join('\n');
          const detected = BDLawExtractor.detectAmendmentMarkers(text);

          // Each selected marker should be detected with correct type
          return selectedMarkers.every(marker => 
            detected.some(d => d.type === marker)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
