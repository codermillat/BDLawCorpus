/**
 * Property-Based Tests for Citation Position Round-Trip
 * 
 * Feature: legal-integrity-enhancement, Property 3: Citation Position Round-Trip
 * Validates: Requirements 1.6
 * 
 * For any detected lexical reference, extracting content_raw.substring(position, 
 * position + citation_text.length) SHALL return exactly citation_text.
 * 
 * This property ensures that citation positions are anchored to content_raw
 * and can be used to accurately extract the original citation text.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 3: Citation Position Round-Trip', () => {
  // Roman numeral generator
  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 
                         'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
                         'XXI', 'XXV', 'XXX', 'XXXV', 'XL', 'XLV', 'L'];
  
  // Valid year generator (1800-2025)
  const yearGen = fc.integer({ min: 1800, max: 2025 }).map(y => y.toString());
  
  // Arabic numeral generator for act numbers
  const arabicNumGen = fc.integer({ min: 1, max: 100 }).map(n => n.toString());
  
  // Serial number generator (Roman or Arabic)
  const serialGen = fc.oneof(
    fc.constantFrom(...romanNumerals),
    arabicNumGen
  );

  // Bengali year generator (১৯৮০-২০২৫)
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const bengaliYearGen = fc.integer({ min: 1980, max: 2025 }).map(y => {
    return y.toString().split('').map(d => bengaliDigits[parseInt(d)]).join('');
  });
  
  // Bengali number generator
  const bengaliNumGen = fc.integer({ min: 1, max: 99 }).map(n => {
    return n.toString().split('').map(d => bengaliDigits[parseInt(d)]).join('');
  });

  // Prefix text generator (random text before citation)
  const prefixGen = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', ' ', '.', ',', '\n'),
    { minLength: 0, maxLength: 100 }
  );

  // Suffix text generator (random text after citation)
  const suffixGen = fc.stringOf(
    fc.constantFrom('x', 'y', 'z', ' ', '.', ',', '\n'),
    { minLength: 0, maxLength: 100 }
  );

  /**
   * Property: Citation position round-trip with three-version content model
   * Requirements: 1.6 - Anchor all citation positions to content_raw character offsets
   * 
   * For any detected lexical reference, extracting content_raw.substring(position, 
   * position + citation_text.length) SHALL return exactly citation_text.
   */
  it('should extract exact citation_text from content_raw using position (English short)', () => {
    fc.assert(
      fc.property(
        prefixGen,
        serialGen,
        yearGen,
        suffixGen,
        fc.constantFrom('Act', 'Ordinance'),
        (prefix, serial, year, suffix, type) => {
          const citation = `${type} ${serial} of ${year}`;
          const text = prefix + citation + suffix;
          
          // Create three-version content model
          const threeVersion = BDLawExtractor.createThreeVersionContent(text);
          
          // Detect cross-references using content_raw
          const refs = BDLawExtractor.detectCrossReferences(threeVersion.content_raw);
          
          if (refs.length === 0) return true; // No detection is acceptable for some edge cases
          
          // For each detected reference, verify round-trip from content_raw
          return refs.every(ref => {
            const extracted = threeVersion.content_raw.substring(
              ref.position, 
              ref.position + ref.citation_text.length
            );
            return extracted === ref.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Citation position round-trip for English full citations
   * Requirements: 1.6
   */
  it('should extract exact citation_text from content_raw using position (English full)', () => {
    fc.assert(
      fc.property(
        prefixGen,
        fc.constantFrom('Income Tax', 'Companies', 'Contract', 'Evidence'),
        yearGen,
        serialGen,
        yearGen,
        suffixGen,
        (prefix, name, titleYear, serial, citationYear, suffix) => {
          const citation = `${name} Act, ${titleYear} (${serial} of ${citationYear})`;
          const text = prefix + citation + suffix;
          
          // Create three-version content model
          const threeVersion = BDLawExtractor.createThreeVersionContent(text);
          
          // Detect cross-references using content_raw
          const refs = BDLawExtractor.detectCrossReferences(threeVersion.content_raw);
          
          if (refs.length === 0) return true;
          
          // For each detected reference, verify round-trip from content_raw
          return refs.every(ref => {
            const extracted = threeVersion.content_raw.substring(
              ref.position, 
              ref.position + ref.citation_text.length
            );
            return extracted === ref.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Citation position round-trip for Bengali short citations
   * Requirements: 1.6
   */
  it('should extract exact citation_text from content_raw using position (Bengali short)', () => {
    fc.assert(
      fc.property(
        prefixGen,
        bengaliYearGen,
        bengaliNumGen,
        suffixGen,
        fc.constantFrom('আইন', 'অধ্যাদেশ'),
        (prefix, year, serial, suffix, type) => {
          const citation = `${year} সনের ${serial} নং ${type}`;
          const text = prefix + citation + suffix;
          
          // Create three-version content model
          const threeVersion = BDLawExtractor.createThreeVersionContent(text);
          
          // Detect cross-references using content_raw
          const refs = BDLawExtractor.detectCrossReferences(threeVersion.content_raw);
          
          if (refs.length === 0) return true;
          
          // For each detected reference, verify round-trip from content_raw
          return refs.every(ref => {
            const extracted = threeVersion.content_raw.substring(
              ref.position, 
              ref.position + ref.citation_text.length
            );
            return extracted === ref.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Citation position round-trip for President's Order citations
   * Requirements: 1.6
   */
  it('should extract exact citation_text from content_raw using position (Presidents Order)', () => {
    fc.assert(
      fc.property(
        prefixGen,
        arabicNumGen,
        yearGen,
        suffixGen,
        fc.constantFrom('P.O.', 'PO', 'P.O'),
        (prefix, number, year, suffix, poPrefix) => {
          const citation = `${poPrefix} ${number} of ${year}`;
          const text = prefix + citation + suffix;
          
          // Create three-version content model
          const threeVersion = BDLawExtractor.createThreeVersionContent(text);
          
          // Detect cross-references using content_raw
          const refs = BDLawExtractor.detectCrossReferences(threeVersion.content_raw);
          
          if (refs.length === 0) return true;
          
          // For each detected reference, verify round-trip from content_raw
          return refs.every(ref => {
            const extracted = threeVersion.content_raw.substring(
              ref.position, 
              ref.position + ref.citation_text.length
            );
            return extracted === ref.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position is anchored to content_raw, not content_normalized or content_corrected
   * Requirements: 1.6 - Positions MUST be anchored to content_raw
   * 
   * Even when content_normalized differs from content_raw (due to Unicode normalization),
   * the position should still correctly extract from content_raw.
   */
  it('should anchor positions to content_raw even when normalized differs', () => {
    fc.assert(
      fc.property(
        prefixGen,
        serialGen,
        yearGen,
        suffixGen,
        (prefix, serial, year, suffix) => {
          const citation = `Act ${serial} of ${year}`;
          const text = prefix + citation + suffix;
          
          // Create three-version content model
          const threeVersion = BDLawExtractor.createThreeVersionContent(text);
          
          // Detect cross-references
          const refs = BDLawExtractor.detectCrossReferences(threeVersion.content_raw);
          
          if (refs.length === 0) return true;
          
          // Verify that position extracts correctly from content_raw
          // (not from content_normalized or content_corrected)
          return refs.every(ref => {
            const extractedFromRaw = threeVersion.content_raw.substring(
              ref.position, 
              ref.position + ref.citation_text.length
            );
            return extractedFromRaw === ref.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple citations on different lines have correct positions
   * Requirements: 1.6
   */
  it('should have accurate positions for multiple citations across lines', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(serialGen, yearGen),
          { minLength: 2, maxLength: 4 }
        ),
        (citations) => {
          const lines = citations.map(([serial, year]) => `Reference to Act ${serial} of ${year} here.`);
          const text = lines.join('\n');
          
          // Create three-version content model
          const threeVersion = BDLawExtractor.createThreeVersionContent(text);
          
          // Detect cross-references
          const refs = BDLawExtractor.detectCrossReferences(threeVersion.content_raw);
          
          // All detected citations should pass round-trip from content_raw
          return refs.every(ref => {
            const extracted = threeVersion.content_raw.substring(
              ref.position, 
              ref.position + ref.citation_text.length
            );
            return extracted === ref.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position bounds are valid for content_raw
   * Requirements: 1.6
   */
  it('should have position within content_raw bounds', () => {
    fc.assert(
      fc.property(
        prefixGen,
        serialGen,
        yearGen,
        suffixGen,
        (prefix, serial, year, suffix) => {
          const citation = `Act ${serial} of ${year}`;
          const text = prefix + citation + suffix;
          
          // Create three-version content model
          const threeVersion = BDLawExtractor.createThreeVersionContent(text);
          
          // Detect cross-references
          const refs = BDLawExtractor.detectCrossReferences(threeVersion.content_raw);
          
          // All positions should be within content_raw bounds
          return refs.every(ref => {
            return ref.position >= 0 && 
                   ref.position + ref.citation_text.length <= threeVersion.content_raw.length;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position is consistent across multiple detections of same content
   * Requirements: 1.6
   */
  it('should produce consistent positions for same content_raw', () => {
    fc.assert(
      fc.property(
        prefixGen,
        serialGen,
        yearGen,
        suffixGen,
        (prefix, serial, year, suffix) => {
          const citation = `Act ${serial} of ${year}`;
          const text = prefix + citation + suffix;
          
          // Create three-version content model twice
          const threeVersion1 = BDLawExtractor.createThreeVersionContent(text);
          const threeVersion2 = BDLawExtractor.createThreeVersionContent(text);
          
          // Detect cross-references twice
          const refs1 = BDLawExtractor.detectCrossReferences(threeVersion1.content_raw);
          const refs2 = BDLawExtractor.detectCrossReferences(threeVersion2.content_raw);
          
          // Should have same number of references
          if (refs1.length !== refs2.length) return false;
          
          // Each reference should have same position
          return refs1.every((ref1, idx) => {
            const ref2 = refs2[idx];
            return ref1.position === ref2.position && 
                   ref1.citation_text === ref2.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position round-trip works with Bengali content containing citations
   * Requirements: 1.6
   */
  it('should extract exact citation_text from Bengali content_raw', () => {
    fc.assert(
      fc.property(
        fc.stringOf(
          fc.constantFrom('আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', ' ', '।'),
          { minLength: 5, maxLength: 50 }
        ),
        bengaliYearGen,
        bengaliNumGen,
        fc.stringOf(
          fc.constantFrom('ম', 'ন', 'প', 'ব', 'র', 'ল', 'শ', 'স', ' ', '।'),
          { minLength: 5, maxLength: 50 }
        ),
        (prefix, year, serial, suffix) => {
          const citation = `${year} সনের ${serial} নং আইন`;
          const text = prefix + citation + suffix;
          
          // Create three-version content model
          const threeVersion = BDLawExtractor.createThreeVersionContent(text);
          
          // Detect cross-references
          const refs = BDLawExtractor.detectCrossReferences(threeVersion.content_raw);
          
          if (refs.length === 0) return true;
          
          // Verify round-trip from content_raw
          return refs.every(ref => {
            const extracted = threeVersion.content_raw.substring(
              ref.position, 
              ref.position + ref.citation_text.length
            );
            return extracted === ref.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position is preserved through content model creation
   * Requirements: 1.6 - content_raw is byte-identical to input
   */
  it('should preserve position accuracy through three-version content creation', () => {
    fc.assert(
      fc.property(
        prefixGen,
        serialGen,
        yearGen,
        suffixGen,
        (prefix, serial, year, suffix) => {
          const citation = `Act ${serial} of ${year}`;
          const originalText = prefix + citation + suffix;
          
          // Create three-version content model
          const threeVersion = BDLawExtractor.createThreeVersionContent(originalText);
          
          // content_raw should be identical to original
          if (threeVersion.content_raw !== originalText) return false;
          
          // Detect from original text
          const refsFromOriginal = BDLawExtractor.detectCrossReferences(originalText);
          
          // Detect from content_raw
          const refsFromContentRaw = BDLawExtractor.detectCrossReferences(threeVersion.content_raw);
          
          // Should have same results
          if (refsFromOriginal.length !== refsFromContentRaw.length) return false;
          
          // Positions should be identical
          return refsFromOriginal.every((ref, idx) => {
            return ref.position === refsFromContentRaw[idx].position &&
                   ref.citation_text === refsFromContentRaw[idx].citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
