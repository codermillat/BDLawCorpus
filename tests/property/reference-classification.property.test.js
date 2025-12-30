/**
 * Property-Based Tests for Reference Type Classification
 * 
 * Feature: cross-reference-extraction, Property 4: Reference Type Classification
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 * 
 * For any citation with a classification keyword (amendment/repeal/substitution/dependency/incorporation)
 * within 50 characters, the lexical_relation_type SHALL match the keyword category.
 * Citations without keywords SHALL have type "mention".
 * 
 * NOTE: Field renamed from reference_type to lexical_relation_type per Requirements 5.1
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 4: Reference Type Classification', () => {
  // Reference type keywords from the design document
  const REFERENCE_KEYWORDS = {
    amendment: ['সংশোধন', 'সংশোধিত', 'amendment', 'amended', 'amending'],
    repeal: ['রহিত', 'রহিতকরণ', 'বিলুপ্ত', 'repeal', 'repealed', 'repealing'],
    substitution: ['প্রতিস্থাপিত', 'প্রতিস্থাপন', 'substituted', 'substitution', 'replaced'],
    dependency: ['সাপেক্ষে', 'অধীন', 'অনুসারে', 'subject to', 'under', 'pursuant to'],
    incorporation: ['সন্নিবেশিত', 'অন্তর্ভুক্ত', 'inserted', 'incorporated', 'added']
  };

  // Generator for reference types
  const refTypeGen = fc.constantFrom('amendment', 'repeal', 'substitution', 'dependency', 'incorporation');

  // Generator for a keyword of a specific type
  const keywordForType = (type) => fc.constantFrom(...REFERENCE_KEYWORDS[type]);

  // Generator for citation patterns
  const citationGen = fc.tuple(
    fc.constantFrom('I', 'II', 'III', 'IV', 'V', 'X', 'XV', 'XX'),
    fc.integer({ min: 1900, max: 2025 }).map(y => y.toString())
  ).map(([serial, year]) => `Act ${serial} of ${year}`);

  // Generator for neutral filler text (no classification keywords)
  const neutralTextGen = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', ' ', '.', ','),
    { minLength: 5, maxLength: 20 }
  );

  /**
   * Property: Context with amendment keywords SHALL classify as 'amendment'
   * Validates: Requirement 3.1
   */
  it('should classify references with amendment keywords as amendment', () => {
    fc.assert(
      fc.property(
        keywordForType('amendment'),
        citationGen,
        (keyword, citation) => {
          const text = `The ${keyword} to ${citation} provides that...`;
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          return refs.every(r => r.lexical_relation_type === 'amendment');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context with repeal keywords SHALL classify as 'repeal'
   * Validates: Requirement 3.2
   */
  it('should classify references with repeal keywords as repeal', () => {
    fc.assert(
      fc.property(
        keywordForType('repeal'),
        citationGen,
        (keyword, citation) => {
          const text = `The ${keyword} of ${citation} means that...`;
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          return refs.every(r => r.lexical_relation_type === 'repeal');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context with substitution keywords SHALL classify as 'substitution'
   * Validates: Requirement 3.3
   */
  it('should classify references with substitution keywords as substitution', () => {
    fc.assert(
      fc.property(
        keywordForType('substitution'),
        citationGen,
        (keyword, citation) => {
          const text = `Section 5 was ${keyword} by ${citation} to read...`;
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          return refs.every(r => r.lexical_relation_type === 'substitution');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context with dependency keywords SHALL classify as 'dependency'
   * Validates: Requirement 3.4
   */
  it('should classify references with dependency keywords as dependency', () => {
    fc.assert(
      fc.property(
        keywordForType('dependency'),
        citationGen,
        (keyword, citation) => {
          const text = `This provision is ${keyword} ${citation} which governs...`;
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          return refs.every(r => r.lexical_relation_type === 'dependency');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context with incorporation keywords SHALL classify as 'incorporation'
   * Validates: Requirement 3.4 (incorporation is part of classification)
   */
  it('should classify references with incorporation keywords as incorporation', () => {
    fc.assert(
      fc.property(
        keywordForType('incorporation'),
        citationGen,
        (keyword, citation) => {
          const text = `The clause was ${keyword} from ${citation} into this act...`;
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          return refs.every(r => r.lexical_relation_type === 'incorporation');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Context without classification keywords SHALL classify as 'mention'
   * Validates: Requirement 3.5
   */
  it('should classify references without keywords as mention', () => {
    fc.assert(
      fc.property(
        citationGen,
        neutralTextGen,
        (citation, filler) => {
          // Ensure filler doesn't accidentally contain keywords
          const allKeywords = Object.values(REFERENCE_KEYWORDS).flat();
          const lowerFiller = filler.toLowerCase();
          if (allKeywords.some(k => lowerFiller.includes(k.toLowerCase()))) {
            return true; // Skip this case
          }
          
          const text = `See ${filler} ${citation} ${filler} for details.`;
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          return refs.every(r => r.lexical_relation_type === 'mention');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null context SHALL return 'mention'
   * Validates: Requirement 3.5 (default behavior)
   */
  it('should return mention for empty or null context', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined)),
        (context) => {
          const result = BDLawExtractor._classifyReferenceType(context);
          return result === 'mention';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Classification SHALL be case-insensitive for English keywords
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   */
  it('should classify case-insensitively for English keywords', () => {
    const englishKeywords = [
      { keyword: 'AMENDMENT', expected: 'amendment' },
      { keyword: 'Amendment', expected: 'amendment' },
      { keyword: 'REPEAL', expected: 'repeal' },
      { keyword: 'Repealed', expected: 'repeal' },
      { keyword: 'SUBSTITUTED', expected: 'substitution' },
      { keyword: 'Subject To', expected: 'dependency' },
      { keyword: 'INSERTED', expected: 'incorporation' }
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...englishKeywords),
        citationGen,
        ({ keyword, expected }, citation) => {
          const text = `This ${keyword} to ${citation} states...`;
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          return refs.every(r => r.lexical_relation_type === expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali keywords SHALL be detected correctly
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   */
  it('should classify Bengali keywords correctly', () => {
    const bengaliKeywords = [
      { keyword: 'সংশোধন', expected: 'amendment' },
      { keyword: 'সংশোধিত', expected: 'amendment' },
      { keyword: 'রহিত', expected: 'repeal' },
      { keyword: 'বিলুপ্ত', expected: 'repeal' },
      { keyword: 'প্রতিস্থাপিত', expected: 'substitution' },
      { keyword: 'সাপেক্ষে', expected: 'dependency' },
      { keyword: 'সন্নিবেশিত', expected: 'incorporation' }
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...bengaliKeywords),
        citationGen,
        ({ keyword, expected }, citation) => {
          const text = `এই ${keyword} ${citation} অনুযায়ী...`;
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          return refs.every(r => r.lexical_relation_type === expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: First matching keyword type SHALL determine classification
   * (Tests priority order when multiple keywords could match)
   */
  it('should use first matching keyword type for classification', () => {
    fc.assert(
      fc.property(
        refTypeGen,
        citationGen,
        (refType, citation) => {
          const keyword = REFERENCE_KEYWORDS[refType][0];
          const text = `The ${keyword} provision in ${citation} applies...`;
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          // The reference type should match the keyword we used
          return refs.every(r => r.lexical_relation_type === refType);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Keywords in context_before or context_after SHALL affect classification
   * Validates: Requirements 3.1-3.5 (context-based classification)
   */
  it('should detect keywords in surrounding context', () => {
    fc.assert(
      fc.property(
        refTypeGen,
        citationGen,
        fc.boolean(),
        (refType, citation, keywordBefore) => {
          const keyword = REFERENCE_KEYWORDS[refType][0];
          
          // Place keyword either before or after the citation
          const text = keywordBefore
            ? `The ${keyword} to ${citation} provides...`
            : `See ${citation} for the ${keyword} details...`;
          
          const refs = BDLawExtractor.detectCrossReferences(text);
          
          if (refs.length === 0) return false;
          
          return refs.every(r => r.lexical_relation_type === refType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
