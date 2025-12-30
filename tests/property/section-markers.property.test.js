/**
 * Property-Based Tests for Section Marker Detection
 * 
 * Feature: bdlawcorpus-mode, Property 7: Section Marker Detection Completeness
 * Validates: Requirements 9.1, 9.2
 * 
 * For any text containing Bengali section markers (ধারা, অধ্যায়, তফসিল),
 * the detector SHALL identify all occurrences with correct line numbers and positions.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 7: Section Marker Detection Completeness', () => {
  const SECTION_MARKERS = ['ধারা', 'অধ্যায়', 'তফসিল'];

  /**
   * Property: For any text with known marker insertions, all markers SHALL be detected
   */
  it('should detect all section markers inserted into random text', () => {
    // Generate random Bengali-like text with markers inserted at known positions
    const bengaliChars = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', ' ', '\n'),
      { minLength: 0, maxLength: 50 }
    );

    fc.assert(
      fc.property(
        bengaliChars,
        fc.constantFrom(...SECTION_MARKERS),
        fc.integer({ min: 1, max: 5 }),
        (baseText, marker, insertCount) => {
          // Insert the marker a known number of times
          let text = baseText;
          for (let i = 0; i < insertCount; i++) {
            text += ` ${marker} `;
          }

          const detected = BDLawExtractor.detectSectionMarkers(text);
          const counts = BDLawExtractor.countSectionMarkers(text);

          // Count should match the number of insertions
          return counts[marker] >= insertCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Detected markers should have correct type matching the marker text
   */
  it('should correctly identify marker types for all detected markers', () => {
    const textWithMarkers = fc.array(
      fc.record({
        prefix: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '\n'), { minLength: 0, maxLength: 20 }),
        marker: fc.constantFrom(...SECTION_MARKERS)
      }),
      { minLength: 1, maxLength: 10 }
    );

    fc.assert(
      fc.property(
        textWithMarkers,
        (parts) => {
          const text = parts.map(p => p.prefix + p.marker).join('');
          const detected = BDLawExtractor.detectSectionMarkers(text);

          // Every detected marker should have a valid type
          return detected.every(m => SECTION_MARKERS.includes(m.type));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Line numbers should be positive integers starting from 1
   */
  it('should assign valid line numbers (1-based) to all detected markers', () => {
    const multiLineText = fc.array(
      fc.tuple(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 20 }),
        fc.constantFrom(...SECTION_MARKERS, '')
      ),
      { minLength: 1, maxLength: 10 }
    );

    fc.assert(
      fc.property(
        multiLineText,
        (lines) => {
          const text = lines.map(([prefix, marker]) => prefix + marker).join('\n');
          const detected = BDLawExtractor.detectSectionMarkers(text);
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
   */
  it('should assign valid positions within the line for all detected markers', () => {
    const textWithMarkers = fc.array(
      fc.tuple(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 0, maxLength: 15 }),
        fc.constantFrom(...SECTION_MARKERS)
      ),
      { minLength: 1, maxLength: 5 }
    );

    fc.assert(
      fc.property(
        textWithMarkers,
        (parts) => {
          const text = parts.map(([prefix, marker]) => prefix + marker).join('\n');
          const detected = BDLawExtractor.detectSectionMarkers(text);

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
   * Property: Count totals should match the number of detected markers by type
   */
  it('should have consistent counts between detectSectionMarkers and countSectionMarkers', () => {
    const randomText = fc.stringOf(
      fc.constantFrom('ক', 'খ', 'গ', 'ধারা', 'অধ্যায়', 'তফসিল', ' ', '\n', '।'),
      { minLength: 0, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        randomText,
        (text) => {
          const detected = BDLawExtractor.detectSectionMarkers(text);
          const counts = BDLawExtractor.countSectionMarkers(text);

          // Count detected markers by type
          const detectedCounts = { 'ধারা': 0, 'অধ্যায়': 0, 'তফসিল': 0 };
          for (const marker of detected) {
            if (marker.type in detectedCounts) {
              detectedCounts[marker.type]++;
            }
          }

          // Counts should match
          return (
            detectedCounts['ধারা'] === counts['ধারা'] &&
            detectedCounts['অধ্যায়'] === counts['অধ্যায়'] &&
            detectedCounts['তফসিল'] === counts['তফসিল']
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null text should return empty results
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
          const detected = BDLawExtractor.detectSectionMarkers(input);
          const counts = BDLawExtractor.countSectionMarkers(input);

          return (
            detected.length === 0 &&
            counts['ধারা'] === 0 &&
            counts['অধ্যায়'] === 0 &&
            counts['তফসিল'] === 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Text without markers should return zero counts
   */
  it('should return zero counts for text without any section markers', () => {
    // Generate text that definitely doesn't contain markers
    const textWithoutMarkers = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', ' ', '\n', '.'),
      { minLength: 0, maxLength: 100 }
    );

    fc.assert(
      fc.property(
        textWithoutMarkers,
        (text) => {
          const detected = BDLawExtractor.detectSectionMarkers(text);
          const counts = BDLawExtractor.countSectionMarkers(text);

          return (
            detected.length === 0 &&
            counts['ধারা'] === 0 &&
            counts['অধ্যায়'] === 0 &&
            counts['তফসিল'] === 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple markers on the same line should all be detected
   */
  it('should detect multiple markers on the same line', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...SECTION_MARKERS), { minLength: 2, maxLength: 5 }),
        (markers) => {
          // Put all markers on a single line
          const text = markers.join(' ');
          const detected = BDLawExtractor.detectSectionMarkers(text);

          // All markers should be on line 1
          const allOnLine1 = detected.every(m => m.lineNumber === 1);
          
          // Should detect at least as many as we inserted
          return allOnLine1 && detected.length >= markers.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});
