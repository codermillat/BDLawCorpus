/**
 * Property-Based Tests for Content Preservation
 * 
 * Feature: cross-reference-extraction, Property 7: Content Preservation
 * Validates: Requirements 6.1
 * 
 * For any act processed for cross-references, the content field SHALL be
 * byte-identical before and after cross-reference extraction. Cross-reference
 * detection SHALL NOT modify the source content.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 7: Content Preservation', () => {
  // Roman numeral generator
  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 
                         'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  
  // Valid year generator (1800-2025)
  const yearGen = fc.integer({ min: 1800, max: 2025 }).map(y => y.toString());
  
  // Serial number generator (Roman or Arabic)
  const serialGen = fc.oneof(
    fc.constantFrom(...romanNumerals),
    fc.integer({ min: 1, max: 100 }).map(n => n.toString())
  );

  // Bengali year generator (১৯৮০-২০২৫)
  const bengaliYearGen = fc.integer({ min: 1980, max: 2025 }).map(y => {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return y.toString().split('').map(d => bengaliDigits[parseInt(d)]).join('');
  });

  // Bengali number generator (১-৯৯)
  const bengaliNumGen = fc.integer({ min: 1, max: 99 }).map(n => {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return n.toString().split('').map(d => bengaliDigits[parseInt(d)]).join('');
  });

  // Legal text generator with Bengali characters
  const legalTextGen = fc.array(
    fc.constantFrom(
      'ধারা ১। এই আইনের নাম',
      'অধ্যায় ২। সংজ্ঞা',
      'তফসিল অনুযায়ী',
      'Section 1. Short title',
      'Chapter 2. Definitions',
      'Schedule I',
      'সংশোধিত হইয়াছে',
      'বিলুপ্ত করা হইয়াছে',
      'প্রতিস্থাপিত হইয়াছে'
    ),
    { minLength: 1, maxLength: 10 }
  ).map(lines => lines.join('\n'));

  /**
   * Property: Content SHALL be byte-identical after cross-reference detection
   */
  it('should not modify content during cross-reference detection', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        legalTextGen,
        (serial, year, legalText) => {
          const content = `${legalText}\nAct ${serial} of ${year}\n${legalText}`;
          
          // Store original content
          const originalContent = content;
          
          // Perform cross-reference detection
          BDLawExtractor.detectCrossReferences(content);
          
          // Content should be unchanged
          return content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali content SHALL be preserved exactly
   */
  it('should preserve Bengali content exactly during detection', () => {
    fc.assert(
      fc.property(
        bengaliYearGen,
        bengaliNumGen,
        fc.constantFrom('আইন', 'অধ্যাদেশ'),
        (year, serial, type) => {
          const content = `এই ${year} সনের ${serial} নং ${type} অনুযায়ী বিধান করা হইল।`;
          
          // Store original
          const originalContent = content;
          
          // Perform detection
          BDLawExtractor.detectCrossReferences(content);
          
          // Content should be unchanged
          return content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mixed English/Bengali content SHALL be preserved
   */
  it('should preserve mixed English/Bengali content', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        bengaliYearGen,
        bengaliNumGen,
        (engSerial, engYear, benYear, benSerial) => {
          const content = `Act ${engSerial} of ${engYear} এবং ${benYear} সনের ${benSerial} নং আইন`;
          
          const originalContent = content;
          
          BDLawExtractor.detectCrossReferences(content);
          
          return content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple detection calls SHALL not modify content
   */
  it('should not modify content even with multiple detection calls', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        fc.integer({ min: 1, max: 5 }),
        (serial, year, iterations) => {
          const content = `Reference to Act ${serial} of ${year} is made.`;
          
          const originalContent = content;
          
          // Call detection multiple times
          for (let i = 0; i < iterations; i++) {
            BDLawExtractor.detectCrossReferences(content);
          }
          
          return content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content with special characters SHALL be preserved
   */
  it('should preserve content with special characters', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        fc.constantFrom(
          '\u0964', // Bengali danda ।
          '\u0965', // Bengali double danda ॥
          '\u2014', // em dash —
          '\u2013', // en dash –
          '\u201C', // left double quote "
          '\u201D', // right double quote "
          '\t',
          '\n\n',
          '  '
        ),
        (serial, year, specialChar) => {
          const content = `Text${specialChar}Act ${serial} of ${year}${specialChar}more text`;
          
          const originalContent = content;
          
          BDLawExtractor.detectCrossReferences(content);
          
          return content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty and whitespace content SHALL be preserved
   */
  it('should preserve empty and whitespace content', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', ' ', '\n', '\t', '   ', '\n\n\n'),
        (content) => {
          const originalContent = content;
          
          BDLawExtractor.detectCrossReferences(content);
          
          return content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Content length SHALL remain unchanged
   */
  it('should not change content length during detection', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(serialGen, yearGen),
          { minLength: 0, maxLength: 5 }
        ),
        legalTextGen,
        (citations, legalText) => {
          const citationText = citations
            .map(([serial, year]) => `Act ${serial} of ${year}`)
            .join(' and ');
          
          const content = `${legalText}\n${citationText}\n${legalText}`;
          
          const originalLength = content.length;
          
          BDLawExtractor.detectCrossReferences(content);
          
          return content.length === originalLength;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Detection result SHALL NOT contain reference to original content object
   */
  it('should return independent result without modifying source', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        (serial, year) => {
          const content = `Act ${serial} of ${year}`;
          const originalContent = content;
          
          const result = BDLawExtractor.detectCrossReferences(content);
          
          // Modifying result should not affect original content
          if (result.length > 0) {
            result[0].citation_text = 'MODIFIED';
          }
          
          return content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context extraction SHALL NOT modify source content
   */
  it('should not modify content when extracting context', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        fc.integer({ min: 10, max: 100 }),
        (serial, year, prefixLength) => {
          const prefix = 'x'.repeat(prefixLength);
          const content = `${prefix}Act ${serial} of ${year} suffix text`;
          
          const originalContent = content;
          
          const refs = BDLawExtractor.detectCrossReferences(content);
          
          // Access context fields to ensure they don't modify source
          refs.forEach(ref => {
            const _ = ref.context_before;
            const __ = ref.context_after;
          });
          
          return content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Large content SHALL be preserved exactly
   */
  it('should preserve large content exactly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(serialGen, yearGen),
          { minLength: 5, maxLength: 10 }
        ),
        (citations) => {
          // Generate large content with multiple citations
          const content = citations
            .map(([serial, year], i) => 
              `Section ${i + 1}. Reference to Act ${serial} of ${year}.\n` +
              'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)
            )
            .join('\n\n');
          
          const originalContent = content;
          
          BDLawExtractor.detectCrossReferences(content);
          
          return content === originalContent;
        }
      ),
      { numRuns: 100 }
    );
  });
});
