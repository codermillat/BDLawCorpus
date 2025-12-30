/**
 * Property-Based Tests for Position Accuracy Round-Trip
 * 
 * Feature: cross-reference-extraction, Property 3: Position Accuracy Round-Trip
 * Validates: Requirements 1.5, 4.4
 * 
 * For any detected citation, using the reported position and citation_text length
 * to extract a substring from the original text SHALL return the exact citation_text.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 3: Position Accuracy Round-Trip', () => {
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
   * Property: Position round-trip for English short citations
   * Using position and citation_text.length to extract substring SHALL return exact citation_text
   */
  it('should have accurate position for English short citations (round-trip)', () => {
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
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return true; // No detection is acceptable for some edge cases
          
          // Find the matching reference
          const match = refs.find(r => r.citation_text.includes(serial) && r.citation_text.includes(year));
          if (!match) return true; // Skip if not found
          
          // Round-trip: extract using position and length should give back citation_text
          const extracted = text.substring(match.position, match.position + match.citation_text.length);
          return extracted === match.citation_text;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position round-trip for English full citations
   */
  it('should have accurate position for English full citations (round-trip)', () => {
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
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return true;
          
          const match = refs.find(r => r.citation_text.includes(name));
          if (!match) return true;
          
          // Round-trip verification
          const extracted = text.substring(match.position, match.position + match.citation_text.length);
          return extracted === match.citation_text;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position round-trip for Bengali short citations
   */
  it('should have accurate position for Bengali short citations (round-trip)', () => {
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
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return true;
          
          const match = refs.find(r => r.citation_text.includes(year));
          if (!match) return true;
          
          // Round-trip verification
          const extracted = text.substring(match.position, match.position + match.citation_text.length);
          return extracted === match.citation_text;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position round-trip for President's Order citations
   */
  it('should have accurate position for Presidents Order citations (round-trip)', () => {
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
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return true;
          
          const match = refs.find(r => r.pattern_type === 'PRESIDENTS_ORDER');
          if (!match) return true;
          
          // Round-trip verification
          const extracted = text.substring(match.position, match.position + match.citation_text.length);
          return extracted === match.citation_text;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position SHALL be non-negative for all detected citations
   */
  it('should have non-negative position for all detected citations', () => {
    fc.assert(
      fc.property(
        prefixGen,
        serialGen,
        yearGen,
        suffixGen,
        (prefix, serial, year, suffix) => {
          const citation = `Act ${serial} of ${year}`;
          const text = prefix + citation + suffix;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // All positions should be non-negative
          return refs.every(r => r.position >= 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position + citation_text.length SHALL NOT exceed text length
   */
  it('should have position + length within text bounds', () => {
    fc.assert(
      fc.property(
        prefixGen,
        serialGen,
        yearGen,
        suffixGen,
        (prefix, serial, year, suffix) => {
          const citation = `Act ${serial} of ${year}`;
          const text = prefix + citation + suffix;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // Position + length should not exceed text length
          return refs.every(r => r.position + r.citation_text.length <= text.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple citations on different lines SHALL have correct positions
   */
  it('should have accurate positions for citations on multiple lines', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(serialGen, yearGen),
          { minLength: 2, maxLength: 4 }
        ),
        (citations) => {
          const lines = citations.map(([serial, year]) => `Reference to Act ${serial} of ${year} here.`);
          const text = lines.join('\n');
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // All detected citations should pass round-trip
          return refs.every(r => {
            const extracted = text.substring(r.position, r.position + r.citation_text.length);
            return extracted === r.citation_text;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Line number SHALL be 1-indexed and accurate
   */
  it('should have accurate 1-indexed line numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        serialGen,
        yearGen,
        (prefixLines, serial, year) => {
          const citation = `Act ${serial} of ${year}`;
          const prefix = Array(prefixLines).fill('Some text here.').join('\n');
          const text = prefix + (prefixLines > 0 ? '\n' : '') + `Reference to ${citation} is made.`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return true;
          
          const match = refs.find(r => r.citation_text.includes(serial));
          if (!match) return true;
          
          // Line number should be 1-based
          const expectedLine = prefixLines + 1;
          return match.line_number === expectedLine && match.line_number >= 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position SHALL be consistent with line_number
   * The position should point to a location within the correct line
   */
  it('should have position consistent with line_number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        serialGen,
        yearGen,
        (prefixLines, serial, year) => {
          const citation = `Act ${serial} of ${year}`;
          const lines = Array(prefixLines).fill('Some text here.');
          lines.push(`Reference to ${citation} is made.`);
          const text = lines.join('\n');
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return true;
          
          const match = refs.find(r => r.citation_text.includes(serial));
          if (!match) return true;
          
          // Calculate expected position range for the line
          let charOffset = 0;
          for (let i = 0; i < match.line_number - 1; i++) {
            charOffset += lines[i].length + 1; // +1 for newline
          }
          const lineEnd = charOffset + lines[match.line_number - 1].length;
          
          // Position should be within the line bounds
          return match.position >= charOffset && match.position < lineEnd;
        }
      ),
      { numRuns: 100 }
    );
  });
});
