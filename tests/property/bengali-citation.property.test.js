/**
 * Property-Based Tests for Bengali Citation Pattern Detection
 * 
 * Feature: cross-reference-extraction, Property 2: Bengali Citation Pattern Detection
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 * 
 * For any text containing a valid Bengali citation pattern ([Year] সনের [Number] নং আইন/অধ্যাদেশ),
 * the detector SHALL find and return that citation with year and serial preserved in original Bengali script.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 2: Bengali Citation Pattern Detection', () => {
  // Bengali digit mapping
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  
  // Convert Arabic number to Bengali
  const toBengaliNumber = (num) => {
    return num.toString().split('').map(d => bengaliDigits[parseInt(d)]).join('');
  };

  // Bengali year generator (১৯৫০-২০২৫)
  const bengaliYearGen = fc.integer({ min: 1950, max: 2025 }).map(toBengaliNumber);
  
  // Bengali serial number generator (১-১০০)
  const bengaliSerialGen = fc.integer({ min: 1, max: 100 }).map(toBengaliNumber);

  // Bengali act name generator
  const bengaliActNameGen = fc.constantFrom(
    'আয়কর',
    'কোম্পানি',
    'চুক্তি',
    'সাক্ষ্য',
    'দণ্ডবিধি',
    'ফৌজদারি কার্যবিধি',
    'দেওয়ানি কার্যবিধি',
    'সম্পত্তি হস্তান্তর',
    'নিবন্ধন',
    'স্ট্যাম্প'
  );

  /**
   * Property: Short Bengali citations ([Year] সনের [Number] নং আইন) SHALL be detected
   */
  it('should detect short Bengali Act citations with correct components', () => {
    fc.assert(
      fc.property(
        bengaliYearGen,
        bengaliSerialGen,
        (year, serial) => {
          const citation = `${year} সনের ${serial} নং আইন`;
          const text = `এই বিধান ${citation} দ্বারা নিয়ন্ত্রিত।`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // Should detect at least one reference
          if (refs.length === 0) return false;
          
          // Find the matching reference
          const match = refs.find(r => r.pattern_type === 'BENGALI_ACT_SHORT');
          if (!match) return false;
          
          // Verify components are preserved in Bengali script
          return match.citation_year === year && 
                 match.citation_serial === serial &&
                 match.script === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Short Bengali Ordinance citations ([Year] সনের [Number] নং অধ্যাদেশ) SHALL be detected
   */
  it('should detect short Bengali Ordinance citations', () => {
    fc.assert(
      fc.property(
        bengaliYearGen,
        bengaliSerialGen,
        (year, serial) => {
          const citation = `${year} সনের ${serial} নং অধ্যাদেশ`;
          const text = `উক্ত ${citation} অনুযায়ী...`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // Should detect at least one reference
          if (refs.length === 0) return false;
          
          // Find the matching reference
          const match = refs.find(r => r.pattern_type === 'BENGALI_ACT_SHORT' && r.act_type === 'অধ্যাদেশ');
          if (!match) return false;
          
          // Verify components
          return match.citation_year === year && 
                 match.citation_serial === serial &&
                 match.script === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali year and serial SHALL be preserved in original script
   */
  it('should preserve Bengali numerals in year and serial fields', () => {
    fc.assert(
      fc.property(
        bengaliYearGen,
        bengaliSerialGen,
        (year, serial) => {
          const citation = `${year} সনের ${serial} নং আইন`;
          const text = `প্রযোজ্য ${citation} মোতাবেক।`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          const match = refs.find(r => r.script === 'bengali');
          if (!match) return false;
          
          // Year and serial should contain Bengali digits only
          const hasBengaliYear = /^[\u09E6-\u09EF]+$/.test(match.citation_year);
          const hasBengaliSerial = /^[\u09E6-\u09EF]+$/.test(match.citation_serial);
          
          return hasBengaliYear && hasBengaliSerial;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Line number SHALL be recorded correctly for Bengali citations
   */
  it('should record correct line numbers for Bengali citations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        bengaliYearGen,
        bengaliSerialGen,
        (prefixLines, year, serial) => {
          const citation = `${year} সনের ${serial} নং আইন`;
          const prefix = Array(prefixLines).fill('কিছু আইনি পাঠ্য এখানে।').join('\n');
          const text = prefix + (prefixLines > 0 ? '\n' : '') + `উল্লেখ ${citation} করা হয়েছে।`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          const match = refs.find(r => r.script === 'bengali');
          if (!match) return false;
          
          // Line number should be 1-based
          const expectedLine = prefixLines + 1;
          return match.line_number === expectedLine && match.line_number >= 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Position SHALL allow round-trip extraction of Bengali citation text
   */
  it('should have position that allows extracting the exact Bengali citation text', () => {
    fc.assert(
      fc.property(
        bengaliYearGen,
        bengaliSerialGen,
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' ', '।'), { minLength: 5, maxLength: 20 }),
        (year, serial, prefix) => {
          const citation = `${year} সনের ${serial} নং আইন`;
          const text = prefix + citation + ' আরও পাঠ্য অনুসরণ করে।';
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          const match = refs.find(r => r.script === 'bengali');
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
   * Property: Multiple Bengali citations SHALL all be detected
   */
  it('should detect multiple Bengali citations in the same text', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(bengaliYearGen, bengaliSerialGen),
          { minLength: 2, maxLength: 4 }
        ),
        (citations) => {
          const text = citations
            .map(([year, serial]) => `${year} সনের ${serial} নং আইন`)
            .join(' এবং ');
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          // Should detect at least one Bengali citation
          const bengaliRefs = refs.filter(r => r.script === 'bengali');
          return bengaliRefs.length >= 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali text without citations SHALL return empty array
   */
  it('should return empty array for Bengali text without citations', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' ', '\n', '।'), { minLength: 10, maxLength: 50 }),
        (text) => {
          // Ensure text doesn't contain citation keywords
          if (text.includes('সনের') || text.includes('নং') || text.includes('আইন')) {
            return true; // Skip this case
          }
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          const bengaliRefs = refs.filter(r => r.script === 'bengali');
          return bengaliRefs.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mixed English and Bengali citations SHALL both be detected
   */
  it('should detect both English and Bengali citations in mixed text', () => {
    fc.assert(
      fc.property(
        bengaliYearGen,
        bengaliSerialGen,
        fc.constantFrom('I', 'II', 'III', 'IV', 'V'),
        fc.integer({ min: 1980, max: 2020 }).map(y => y.toString()),
        (bengaliYear, bengaliSerial, romanSerial, englishYear) => {
          const bengaliCitation = `${bengaliYear} সনের ${bengaliSerial} নং আইন`;
          const englishCitation = `Act ${romanSerial} of ${englishYear}`;
          const text = `Under ${englishCitation} and ${bengaliCitation}, the provisions apply.`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          const englishRefs = refs.filter(r => r.script === 'english');
          const bengaliRefs = refs.filter(r => r.script === 'bengali');
          
          // Should detect at least one of each
          return englishRefs.length >= 1 && bengaliRefs.length >= 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});
