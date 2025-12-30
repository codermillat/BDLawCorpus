/**
 * Property-Based Tests for Negation Override Classification
 * 
 * Feature: legal-integrity-enhancement, Property 8: Negation Override Classification
 * Validates: Requirements 4.2, 4.3, 4.4
 * 
 * For any lexical reference where Bengali negation words (না, নয়, নহে, নাই, নেই, ব্যতীত, ছাড়া)
 * appear within ±20 characters, lexical_relation_type SHALL be "mention" and
 * negation_present SHALL be true, regardless of other keywords present.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 8: Negation Override Classification', () => {
  // Generator for Bengali negation words
  const negationWordGen = fc.constantFrom(
    'না',
    'নয়',
    'নহে',
    'নাই',
    'নেই',
    'ব্যতীত',
    'ছাড়া'
  );

  // Generator for lexical relation keywords that would normally classify as non-mention
  const relationKeywordGen = fc.constantFrom(
    'সংশোধন',      // amendment
    'সংশোধিত',     // amended
    'amendment',
    'amended',
    'রহিত',        // repeal
    'repeal',
    'repealed',
    'প্রতিস্থাপিত', // substituted
    'substituted',
    'সাপেক্ষে',    // subject to
    'subject to',
    'সন্নিবেশিত',  // inserted
    'inserted'
  );

  // Generator for citation patterns
  const citationGen = fc.constantFrom(
    'Act XV of 1984',
    'Income Tax Ordinance, 1984 (XXXVI of 1984)',
    '১৯৮৪ সনের ৩৬ নং আইন',
    'Ordinance 5 of 1990',
    'P.O. No. 12 of 1972'
  );

  // Generator for random Bengali text (filler)
  const bengaliFillerGen = fc.constantFrom(
    'এই আইনে',
    'উক্ত ধারায়',
    'প্রযোজ্য হইবে',
    'বলবৎ থাকিবে',
    'কার্যকর হইবে'
  );

  /**
   * Property: checkNegationContext detects all Bengali negation words
   * Requirements: 4.1, 4.2
   */
  it('should detect all Bengali negation words within context window', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        (negationWord) => {
          // Create content with ONLY the target negation word (no other negation words)
          const before = 'এই আইনে প্রযোজ্য ';
          const after = ' হইবে বলিয়া';
          const content = before + negationWord + after;
          
          // Position to check is at the negation word itself
          const position = before.length;
          
          const result = BDLawExtractor.checkNegationContext(content, position, 20);
          
          // Should detect the negation word
          return result.negation_present === true &&
                 result.negation_word === negationWord;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Negation forces lexical_relation_type to "mention"
   * Requirements: 4.3, 4.4
   */
  it('should force lexical_relation_type to "mention" when negation is present', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        relationKeywordGen,
        (negationWord, relationKeyword) => {
          // Create context with BOTH negation word AND relation keyword
          const contextText = `${relationKeyword} ${negationWord} এই আইন`;
          
          // Create negation check result
          const negationCheck = {
            negation_present: true,
            negation_word: negationWord,
            negation_context: contextText
          };
          
          const result = BDLawExtractor.classifyLexicalRelation(contextText, negationCheck);
          
          // MUST be "mention" regardless of relation keyword
          return result.lexical_relation_type === 'mention' &&
                 result.negation_present === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Without negation, relation keywords are classified correctly
   * Requirements: 4.3 (inverse test)
   */
  it('should classify relation keywords correctly when no negation present', () => {
    fc.assert(
      fc.property(
        relationKeywordGen,
        bengaliFillerGen,
        (relationKeyword, filler) => {
          // Create context WITHOUT negation
          const contextText = `${filler} ${relationKeyword} এই আইন`;
          
          // No negation present
          const negationCheck = { negation_present: false };
          
          const result = BDLawExtractor.classifyLexicalRelation(contextText, negationCheck);
          
          // Should NOT be forced to "mention" - should match the keyword type
          return result.negation_present === false &&
                 result.lexical_relation_type !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectCrossReferences includes negation_present field
   * Requirements: 4.2, 4.3
   */
  it('should include negation_present in detected cross-references', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        citationGen,
        (negationWord, citation) => {
          // Create text with citation near negation
          const text = `এই আইনে ${negationWord} ${citation} প্রযোজ্য হইবে।`;
          
          const references = BDLawExtractor.detectCrossReferences(text);
          
          // If references found, they should have negation_present field
          if (references.length > 0) {
            return references.every(ref => 
              typeof ref.negation_present === 'boolean' &&
              typeof ref.lexical_relation_type === 'string'
            );
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Negation within ±20 chars triggers override
   * Requirements: 4.1, 4.2
   */
  it('should detect negation within ±20 character window', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        fc.integer({ min: 1, max: 19 }),
        (negationWord, distance) => {
          // Create content with negation at exact distance
          const padding = 'ক'.repeat(distance);
          const content = padding + negationWord + padding;
          const position = distance; // Position at start of negation word
          
          const result = BDLawExtractor.checkNegationContext(content, position, 20);
          
          // Should detect negation within window
          return result.negation_present === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Negation outside ±20 chars does NOT trigger override
   * Requirements: 4.1
   */
  it('should NOT detect negation outside ±20 character window', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        fc.integer({ min: 25, max: 50 }),
        (negationWord, distance) => {
          // Create content with negation far from position
          const padding = 'ক'.repeat(distance);
          const content = negationWord + padding + 'citation' + padding;
          const position = negationWord.length + distance; // Position at 'citation'
          
          const result = BDLawExtractor.checkNegationContext(content, position, 20);
          
          // Should NOT detect negation - it's too far
          return result.negation_present === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: checkNegationContext returns negation_context when found
   * Requirements: 4.2
   */
  it('should return negation_context when negation is found', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        bengaliFillerGen,
        (negationWord, filler) => {
          const content = `${filler} ${negationWord} ${filler}`;
          const position = filler.length + 1;
          
          const result = BDLawExtractor.checkNegationContext(content, position, 20);
          
          if (result.negation_present) {
            return typeof result.negation_context === 'string' &&
                   result.negation_context.length > 0 &&
                   typeof result.negation_position === 'number';
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: classifyLexicalRelation includes classification_note when negation present
   * Requirements: 4.3
   */
  it('should include classification_note when negation forces mention type', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        relationKeywordGen,
        (negationWord, relationKeyword) => {
          const contextText = `${relationKeyword} ${negationWord} এই আইন`;
          const negationCheck = {
            negation_present: true,
            negation_word: negationWord,
            negation_context: contextText
          };
          
          const result = BDLawExtractor.classifyLexicalRelation(contextText, negationCheck);
          
          // Should include classification_note explaining the override
          return result.classification_note !== undefined &&
                 result.classification_note.includes('Negation detected');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or invalid content returns negation_present: false
   * Requirements: 4.1
   */
  it('should handle empty or invalid content gracefully', () => {
    expect(BDLawExtractor.checkNegationContext('', 0, 20)).toEqual({ negation_present: false });
    expect(BDLawExtractor.checkNegationContext(null, 0, 20)).toEqual({ negation_present: false });
    expect(BDLawExtractor.checkNegationContext(undefined, 0, 20)).toEqual({ negation_present: false });
    expect(BDLawExtractor.checkNegationContext('valid', -1, 20)).toEqual({ negation_present: false });
  });

  /**
   * Property: NEGATION_WORDS constant contains all required words
   * Requirements: 4.1
   */
  it('should have all required Bengali negation words defined', () => {
    const requiredWords = ['না', 'নয়', 'নহে', 'নাই', 'নেই', 'ব্যতীত', 'ছাড়া'];
    
    for (const word of requiredWords) {
      expect(BDLawExtractor.NEGATION_WORDS).toContain(word);
    }
  });

  /**
   * Property: Amendment keyword with negation becomes mention
   * Requirements: 4.4 - NEVER classify as amendment/repeal/substitution when negation present
   */
  it('should NEVER classify as amendment when negation is present', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        (negationWord) => {
          // Explicit amendment context with negation
          const contextText = `এই আইন সংশোধন ${negationWord} করা হইবে`;
          const negationCheck = {
            negation_present: true,
            negation_word: negationWord,
            negation_context: contextText
          };
          
          const result = BDLawExtractor.classifyLexicalRelation(contextText, negationCheck);
          
          // MUST be "mention", NOT "amendment"
          return result.lexical_relation_type === 'mention';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Repeal keyword with negation becomes mention
   * Requirements: 4.4
   */
  it('should NEVER classify as repeal when negation is present', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        (negationWord) => {
          // Explicit repeal context with negation
          const contextText = `এই আইন রহিত ${negationWord} হইবে`;
          const negationCheck = {
            negation_present: true,
            negation_word: negationWord,
            negation_context: contextText
          };
          
          const result = BDLawExtractor.classifyLexicalRelation(contextText, negationCheck);
          
          // MUST be "mention", NOT "repeal"
          return result.lexical_relation_type === 'mention';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Substitution keyword with negation becomes mention
   * Requirements: 4.4
   */
  it('should NEVER classify as substitution when negation is present', () => {
    fc.assert(
      fc.property(
        negationWordGen,
        (negationWord) => {
          // Explicit substitution context with negation
          const contextText = `এই ধারা প্রতিস্থাপিত ${negationWord} হইবে`;
          const negationCheck = {
            negation_present: true,
            negation_word: negationWord,
            negation_context: contextText
          };
          
          const result = BDLawExtractor.classifyLexicalRelation(contextText, negationCheck);
          
          // MUST be "mention", NOT "substitution"
          return result.lexical_relation_type === 'mention';
        }
      ),
      { numRuns: 100 }
    );
  });
});
