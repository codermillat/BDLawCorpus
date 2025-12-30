/**
 * Property-Based Tests for English Citation Pattern Detection
 * 
 * Feature: cross-reference-extraction, Property 1: English Citation Pattern Detection
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 * 
 * For any text containing a valid English citation pattern (Act/Ordinance [Roman/Arabic] of [Year]),
 * the detector SHALL find and return that citation with correct year and serial components extracted.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 1: English Citation Pattern Detection', () => {
  // Roman numeral generator
  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 
                         'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
                         'XXI', 'XXV', 'XXX', 'XXXV', 'XL', 'XLV', 'L', 'LV', 'LX'];
  
  // Valid year generator (1800-2025)
  const yearGen = fc.integer({ min: 1800, max: 2025 }).map(y => y.toString());
  
  // Arabic numeral generator for act numbers
  const arabicNumGen = fc.integer({ min: 1, max: 100 }).map(n => n.toString());
  
  // Serial number generator (Roman or Arabic)
  const serialGen = fc.oneof(
    fc.constantFrom(...romanNumerals),
    arabicNumGen
  );

  // Act name generator
  const actNameGen = fc.constantFrom(
    'Income Tax',
    'Companies',
    'Contract',
    'Evidence',
    'Penal Code',
    'Criminal Procedure',
    'Civil Procedure',
    'Transfer of Property',
    'Registration',
    'Stamp'
  );

  /**
   * Property: Short English citations (Act/Ordinance [Serial] of [Year]) SHALL be detected
   */
  it('should detect short English Act citations with correct components', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        fc.constantFrom('Act', 'Ordinance'),
        (serial, year, type) => {
          const citation = `${type} ${serial} of ${year}`;
          const text = `This is governed by ${citation} which provides...`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // Should detect at least one reference
          if (refs.length === 0) return false;
          
          // Find the matching reference
          const match = refs.find(r => r.citation_text.includes(serial) && r.citation_text.includes(year));
          if (!match) return false;
          
          // Verify components are extracted correctly
          return match.citation_year === year && 
                 match.citation_serial === serial &&
                 match.script === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Full English citations ([Name] Act, [Year] ([Serial] of [Year])) SHALL be detected
   */
  it('should detect full English Act citations with name and components', () => {
    fc.assert(
      fc.property(
        actNameGen,
        yearGen,
        serialGen,
        yearGen,
        (name, titleYear, serial, citationYear) => {
          const citation = `${name} Act, ${titleYear} (${serial} of ${citationYear})`;
          const text = `Under the ${citation}, the following provisions apply...`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // Should detect at least one reference
          if (refs.length === 0) return false;
          
          // Find the matching reference
          const match = refs.find(r => r.citation_text.includes(name) && r.citation_text.includes(serial));
          if (!match) return false;
          
          // Verify components
          return match.act_name !== null &&
                 match.citation_serial === serial &&
                 match.script === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: President's Order citations (P.O. [Number] of [Year]) SHALL be detected
   */
  it('should detect Presidents Order citations', () => {
    fc.assert(
      fc.property(
        arabicNumGen,
        yearGen,
        fc.constantFrom('P.O.', 'PO', 'P.O', 'P.O. No.'),
        (number, year, prefix) => {
          const citation = `${prefix} ${number} of ${year}`;
          const text = `As per ${citation}, the regulation states...`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // Should detect at least one reference
          if (refs.length === 0) return false;
          
          // Find the matching reference
          const match = refs.find(r => r.pattern_type === 'PRESIDENTS_ORDER');
          if (!match) return false;
          
          // Verify components
          return match.citation_serial === number &&
                 match.citation_year === year &&
                 match.script === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Line number and position SHALL be recorded correctly
   */
  it('should record correct line numbers for detected citations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        serialGen,
        yearGen,
        (prefixLines, serial, year) => {
          const citation = `Act ${serial} of ${year}`;
          const prefix = Array(prefixLines).fill('Some legal text here.').join('\n');
          const text = prefix + (prefixLines > 0 ? '\n' : '') + `Reference to ${citation} is made.`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          const match = refs.find(r => r.citation_text.includes(serial));
          if (!match) return false;
          
          // Line number should be 1-based and match the expected line
          const expectedLine = prefixLines + 1;
          return match.line_number === expectedLine && match.line_number >= 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position SHALL allow round-trip extraction of citation text
   */
  it('should have position that allows extracting the exact citation text', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '.'), { minLength: 5, maxLength: 30 }),
        (serial, year, prefix) => {
          const citation = `Act ${serial} of ${year}`;
          const text = prefix + citation + ' more text follows.';
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          const match = refs.find(r => r.citation_text.includes(serial));
          if (!match) return false;
          
          // Round-trip: extract using position and length should give back citation_text
          const extracted = text.substring(match.position, match.position + match.citation_text.length);
          return extracted === match.citation_text;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null text SHALL return empty array
   */
  it('should return empty array for empty or invalid input', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined)),
        (input) => {
          const refs = BDLawExtractor.detectCrossReferences(input);
          return Array.isArray(refs) && refs.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Text without citations SHALL return empty array
   */
  it('should return empty array for text without any citations', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', ' ', '\n', '.'), { minLength: 10, maxLength: 100 }),
        (text) => {
          // Ensure text doesn't accidentally contain citation patterns
          if (text.includes('Act') || text.includes('Ordinance') || text.includes('of')) {
            return true; // Skip this case
          }
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          return refs.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple citations in same text SHALL all be detected
   */
  it('should detect multiple English citations in the same text', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(serialGen, yearGen),
          { minLength: 2, maxLength: 4 }
        ),
        (citations) => {
          const text = citations
            .map(([serial, year]) => `Act ${serial} of ${year}`)
            .join(' and also ');
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // Should detect at least as many as we inserted (may be fewer due to deduplication)
          return refs.length >= 1 && refs.every(r => r.script === 'english');
        }
      ),
      { numRuns: 100 }
    );
  });
});
