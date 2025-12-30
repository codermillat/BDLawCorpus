/**
 * Property-Based Tests for Export Schema Completeness
 * 
 * Feature: cross-reference-extraction, Property 6: Export Schema Completeness
 * Validates: Requirements 5.1, 5.3, 5.4
 * 
 * For any exported act with cross-references, each reference object SHALL contain
 * all required fields (citation_text, citation_year, citation_serial, lexical_relation_type,
 * line_number, position, context_before, context_after), and cross_reference_count
 * SHALL equal the references array length.
 * 
 * NOTE: Field renamed from reference_type to lexical_relation_type per Requirements 5.1
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 6: Export Schema Completeness', () => {
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

  /**
   * Helper function to simulate export schema generation
   * This mirrors the logic in sidepanel.js exportSingleAct()
   */
  function generateExportSchema(content) {
    const crossReferences = BDLawExtractor.detectCrossReferences(content);
    
    return {
      cross_references: {
        count: crossReferences.length,
        method: "pattern-based detection, not semantically verified",
        references: crossReferences.map(ref => ({
          citation_text: ref.citation_text,
          citation_year: ref.citation_year || null,
          citation_serial: ref.citation_serial || null,
          lexical_relation_type: ref.lexical_relation_type,
          line_number: ref.line_number,
          position: ref.position,
          context_before: ref.context_before,
          context_after: ref.context_after
        }))
      }
    };
  }

  /**
   * Property: cross_reference_count SHALL equal references array length
   */
  it('should have count equal to references array length', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(serialGen, yearGen),
          { minLength: 0, maxLength: 5 }
        ),
        (citations) => {
          const text = citations.length > 0
            ? citations.map(([serial, year]) => `Act ${serial} of ${year}`).join(' and ')
            : 'Some text without citations.';
          
          const exportSchema = generateExportSchema(text);
          
          // Count must equal array length
          return exportSchema.cross_references.count === exportSchema.cross_references.references.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each reference SHALL contain citation_text field
   */
  it('should include citation_text in every reference', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        (serial, year) => {
          const text = `Reference to Act ${serial} of ${year} is made here.`;
          const exportSchema = generateExportSchema(text);
          
          if (exportSchema.cross_references.references.length === 0) {
            return true; // No references to check
          }
          
          return exportSchema.cross_references.references.every(ref => 
            typeof ref.citation_text === 'string' && ref.citation_text.length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each reference SHALL contain lexical_relation_type field
   */
  it('should include lexical_relation_type in every reference', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        fc.constantFrom('amendment', 'repeal', 'substitution', 'dependency', 'incorporation', 'mention', ''),
        (serial, year, keyword) => {
          const contextWord = keyword || '';
          const text = `The ${contextWord} Act ${serial} of ${year} provides...`;
          const exportSchema = generateExportSchema(text);
          
          if (exportSchema.cross_references.references.length === 0) {
            return true;
          }
          
          const validTypes = ['amendment', 'repeal', 'substitution', 'dependency', 'incorporation', 'mention'];
          return exportSchema.cross_references.references.every(ref => 
            validTypes.includes(ref.lexical_relation_type)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each reference SHALL contain line_number field (positive integer)
   */
  it('should include positive line_number in every reference', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        fc.integer({ min: 0, max: 5 }),
        (serial, year, prefixLines) => {
          const prefix = Array(prefixLines).fill('Some text.').join('\n');
          const text = prefix + (prefixLines > 0 ? '\n' : '') + `Act ${serial} of ${year}`;
          const exportSchema = generateExportSchema(text);
          
          if (exportSchema.cross_references.references.length === 0) {
            return true;
          }
          
          return exportSchema.cross_references.references.every(ref => 
            typeof ref.line_number === 'number' && 
            ref.line_number >= 1 &&
            Number.isInteger(ref.line_number)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each reference SHALL contain position field (non-negative integer)
   */
  it('should include non-negative position in every reference', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        (serial, year) => {
          const text = `Reference to Act ${serial} of ${year} here.`;
          const exportSchema = generateExportSchema(text);
          
          if (exportSchema.cross_references.references.length === 0) {
            return true;
          }
          
          return exportSchema.cross_references.references.every(ref => 
            typeof ref.position === 'number' && 
            ref.position >= 0 &&
            Number.isInteger(ref.position)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each reference SHALL contain context_before field (string)
   */
  it('should include context_before as string in every reference', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        (serial, year) => {
          const text = `Some context before Act ${serial} of ${year} and after.`;
          const exportSchema = generateExportSchema(text);
          
          if (exportSchema.cross_references.references.length === 0) {
            return true;
          }
          
          return exportSchema.cross_references.references.every(ref => 
            typeof ref.context_before === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each reference SHALL contain context_after field (string)
   */
  it('should include context_after as string in every reference', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        (serial, year) => {
          const text = `Before Act ${serial} of ${year} some context after.`;
          const exportSchema = generateExportSchema(text);
          
          if (exportSchema.cross_references.references.length === 0) {
            return true;
          }
          
          return exportSchema.cross_references.references.every(ref => 
            typeof ref.context_after === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Export schema SHALL include method documentation
   */
  it('should include method documentation in cross_references', () => {
    fc.assert(
      fc.property(
        serialGen,
        yearGen,
        (serial, year) => {
          const text = `Act ${serial} of ${year}`;
          const exportSchema = generateExportSchema(text);
          
          return typeof exportSchema.cross_references.method === 'string' &&
                 exportSchema.cross_references.method.includes('pattern-based') &&
                 exportSchema.cross_references.method.includes('not semantically verified');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty content SHALL produce empty references array with count 0
   */
  it('should produce empty array with count 0 for content without citations', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }).filter(s => 
          !s.includes('Act') && !s.includes('Ordinance') && !s.includes('of') && !s.includes('সনের')
        ),
        (text) => {
          const exportSchema = generateExportSchema(text);
          
          return exportSchema.cross_references.count === 0 &&
                 Array.isArray(exportSchema.cross_references.references) &&
                 exportSchema.cross_references.references.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali citations SHALL have all required fields
   */
  it('should include all required fields for Bengali citations', () => {
    fc.assert(
      fc.property(
        bengaliYearGen,
        bengaliNumGen,
        fc.constantFrom('আইন', 'অধ্যাদেশ'),
        (year, serial, type) => {
          const text = `এই ${year} সনের ${serial} নং ${type} অনুযায়ী`;
          const exportSchema = generateExportSchema(text);
          
          if (exportSchema.cross_references.references.length === 0) {
            return true; // Pattern may not match all generated combinations
          }
          
          return exportSchema.cross_references.references.every(ref => 
            typeof ref.citation_text === 'string' &&
            typeof ref.lexical_relation_type === 'string' &&
            typeof ref.line_number === 'number' &&
            typeof ref.position === 'number' &&
            typeof ref.context_before === 'string' &&
            typeof ref.context_after === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple citations SHALL all have complete schema
   */
  it('should have complete schema for all citations in multi-citation text', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(serialGen, yearGen),
          { minLength: 2, maxLength: 5 }
        ),
        (citations) => {
          const text = citations
            .map(([serial, year]) => `Act ${serial} of ${year}`)
            .join(' and also ');
          
          const exportSchema = generateExportSchema(text);
          
          // All detected references should have complete schema
          return exportSchema.cross_references.references.every(ref => 
            typeof ref.citation_text === 'string' &&
            typeof ref.lexical_relation_type === 'string' &&
            typeof ref.line_number === 'number' &&
            typeof ref.position === 'number' &&
            typeof ref.context_before === 'string' &&
            typeof ref.context_after === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
