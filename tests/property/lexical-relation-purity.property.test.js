/**
 * Property-Based Tests for Lexical Relation Purity
 * 
 * Feature: legal-integrity-enhancement, Property 10: Lexical Relation Purity
 * Validates: Requirements 5.1, 5.2
 * 
 * For any exported act, the field name SHALL be lexical_relation_type (not reference_type),
 * and the export SHALL include the disclaimer "Detected via pattern matching. No legal
 * force or applicability implied."
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 10: Lexical Relation Purity', () => {
  // Generator for citation patterns
  const citationGen = fc.constantFrom(
    'Act XV of 1984',
    'Income Tax Ordinance, 1984 (XXXVI of 1984)',
    '১৯৮৪ সনের ৩৬ নং আইন',
    'Ordinance 5 of 1990',
    'P.O. No. 12 of 1972',
    'Companies Act, 1994 (XVIII of 1994)',
    'Bangladesh Labour Act, 2006 (XLII of 2006)'
  );

  // Generator for context text
  const contextGen = fc.constantFrom(
    'এই আইনে',
    'উক্ত ধারায়',
    'প্রযোজ্য হইবে',
    'বলবৎ থাকিবে',
    'কার্যকর হইবে',
    'pursuant to',
    'subject to',
    'under the provisions of'
  );

  // Generator for legal text with citations
  const legalTextWithCitationGen = fc.tuple(
    contextGen,
    citationGen,
    contextGen
  ).map(([before, citation, after]) => `${before} ${citation} ${after}`);

  /**
   * Property: detectCrossReferences uses lexical_relation_type field
   * Requirements: 5.1
   */
  it('should use lexical_relation_type field name in detected references', () => {
    fc.assert(
      fc.property(
        legalTextWithCitationGen,
        (text) => {
          const references = BDLawExtractor.detectCrossReferences(text);
          
          // All references should have lexical_relation_type, not reference_type
          return references.every(ref => 
            'lexical_relation_type' in ref &&
            typeof ref.lexical_relation_type === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectCrossReferences does NOT use reference_type field
   * Requirements: 5.1
   */
  it('should NOT use reference_type field name in detected references', () => {
    fc.assert(
      fc.property(
        legalTextWithCitationGen,
        (text) => {
          const references = BDLawExtractor.detectCrossReferences(text);
          
          // No reference should have reference_type field
          return references.every(ref => !('reference_type' in ref));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: LEXICAL_RELATION_DISCLAIMER constant exists and has correct text
   * Requirements: 5.2
   */
  it('should have LEXICAL_RELATION_DISCLAIMER constant with correct text', () => {
    expect(BDLawExtractor.LEXICAL_RELATION_DISCLAIMER).toBeDefined();
    expect(BDLawExtractor.LEXICAL_RELATION_DISCLAIMER).toBe(
      'Detected via pattern matching. No legal force or applicability implied.'
    );
  });

  /**
   * Property: getLexicalReferencesMetadata includes disclaimer
   * Requirements: 5.2
   */
  it('should include disclaimer in getLexicalReferencesMetadata', () => {
    fc.assert(
      fc.property(
        legalTextWithCitationGen,
        (text) => {
          const references = BDLawExtractor.detectCrossReferences(text);
          const metadata = BDLawExtractor.getLexicalReferencesMetadata(references);
          
          return metadata.disclaimer === BDLawExtractor.LEXICAL_RELATION_DISCLAIMER;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getLexicalReferencesMetadata includes relationship_inference prohibition
   * Requirements: 5.3, 5.4, 5.5
   */
  it('should include relationship_inference: explicitly_prohibited', () => {
    fc.assert(
      fc.property(
        legalTextWithCitationGen,
        (text) => {
          const references = BDLawExtractor.detectCrossReferences(text);
          const metadata = BDLawExtractor.getLexicalReferencesMetadata(references);
          
          return metadata.relationship_inference === 'explicitly_prohibited';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getLexicalReferencesMetadata includes method description
   * Requirements: 5.2
   */
  it('should include method: pattern-based detection', () => {
    fc.assert(
      fc.property(
        legalTextWithCitationGen,
        (text) => {
          const references = BDLawExtractor.detectCrossReferences(text);
          const metadata = BDLawExtractor.getLexicalReferencesMetadata(references);
          
          return metadata.method === 'pattern-based detection';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getLexicalReferencesMetadata includes correct count
   * Requirements: 5.2
   */
  it('should include correct reference count in metadata', () => {
    fc.assert(
      fc.property(
        legalTextWithCitationGen,
        (text) => {
          const references = BDLawExtractor.detectCrossReferences(text);
          const metadata = BDLawExtractor.getLexicalReferencesMetadata(references);
          
          return metadata.count === references.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getLexicalReferencesMetadata includes references array
   * Requirements: 5.2
   */
  it('should include references array in metadata', () => {
    fc.assert(
      fc.property(
        legalTextWithCitationGen,
        (text) => {
          const references = BDLawExtractor.detectCrossReferences(text);
          const metadata = BDLawExtractor.getLexicalReferencesMetadata(references);
          
          return Array.isArray(metadata.references) &&
                 metadata.references.length === references.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: LEXICAL_RELATION_KEYWORDS constant exists
   * Requirements: 5.1
   */
  it('should have LEXICAL_RELATION_KEYWORDS constant defined', () => {
    expect(BDLawExtractor.LEXICAL_RELATION_KEYWORDS).toBeDefined();
    expect(typeof BDLawExtractor.LEXICAL_RELATION_KEYWORDS).toBe('object');
    
    // Should have expected relation types
    expect(BDLawExtractor.LEXICAL_RELATION_KEYWORDS.amendment).toBeDefined();
    expect(BDLawExtractor.LEXICAL_RELATION_KEYWORDS.repeal).toBeDefined();
    expect(BDLawExtractor.LEXICAL_RELATION_KEYWORDS.substitution).toBeDefined();
    expect(BDLawExtractor.LEXICAL_RELATION_KEYWORDS.dependency).toBeDefined();
    expect(BDLawExtractor.LEXICAL_RELATION_KEYWORDS.incorporation).toBeDefined();
  });

  /**
   * Property: REFERENCE_TYPE_KEYWORDS is aliased to LEXICAL_RELATION_KEYWORDS
   * Requirements: 5.1 (backward compatibility)
   */
  it('should have REFERENCE_TYPE_KEYWORDS aliased for backward compatibility', () => {
    expect(BDLawExtractor.REFERENCE_TYPE_KEYWORDS).toBeDefined();
    expect(BDLawExtractor.REFERENCE_TYPE_KEYWORDS).toBe(BDLawExtractor.LEXICAL_RELATION_KEYWORDS);
  });

  /**
   * Property: lexical_relation_type values are valid
   * Requirements: 5.1
   */
  it('should only produce valid lexical_relation_type values', () => {
    const validTypes = ['amendment', 'repeal', 'substitution', 'dependency', 'incorporation', 'mention'];
    
    fc.assert(
      fc.property(
        legalTextWithCitationGen,
        (text) => {
          const references = BDLawExtractor.detectCrossReferences(text);
          
          return references.every(ref => 
            validTypes.includes(ref.lexical_relation_type)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: classifyLexicalRelation returns lexical_relation_type field
   * Requirements: 5.1
   */
  it('should return lexical_relation_type from classifyLexicalRelation', () => {
    fc.assert(
      fc.property(
        contextGen,
        (context) => {
          const negationCheck = { negation_present: false };
          const result = BDLawExtractor.classifyLexicalRelation(context, negationCheck);
          
          return 'lexical_relation_type' in result &&
                 typeof result.lexical_relation_type === 'string';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty references array produces valid metadata
   * Requirements: 5.2
   */
  it('should handle empty references array in metadata', () => {
    const metadata = BDLawExtractor.getLexicalReferencesMetadata([]);
    
    expect(metadata.count).toBe(0);
    expect(metadata.disclaimer).toBe(BDLawExtractor.LEXICAL_RELATION_DISCLAIMER);
    expect(metadata.relationship_inference).toBe('explicitly_prohibited');
    expect(metadata.method).toBe('pattern-based detection');
    expect(metadata.references).toEqual([]);
  });

  /**
   * Property: Null/undefined references produces valid metadata
   * Requirements: 5.2
   */
  it('should handle null/undefined references in metadata', () => {
    const metadataNull = BDLawExtractor.getLexicalReferencesMetadata(null);
    const metadataUndefined = BDLawExtractor.getLexicalReferencesMetadata(undefined);
    
    expect(metadataNull.count).toBe(0);
    expect(metadataNull.references).toEqual([]);
    expect(metadataNull.disclaimer).toBe(BDLawExtractor.LEXICAL_RELATION_DISCLAIMER);
    
    expect(metadataUndefined.count).toBe(0);
    expect(metadataUndefined.references).toEqual([]);
    expect(metadataUndefined.disclaimer).toBe(BDLawExtractor.LEXICAL_RELATION_DISCLAIMER);
  });

  /**
   * Property: All detected references include negation_present field
   * Requirements: 5.1 (complete field structure)
   */
  it('should include negation_present field in all detected references', () => {
    fc.assert(
      fc.property(
        legalTextWithCitationGen,
        (text) => {
          const references = BDLawExtractor.detectCrossReferences(text);
          
          return references.every(ref => 
            'negation_present' in ref &&
            typeof ref.negation_present === 'boolean'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Disclaimer text is exactly as specified
   * Requirements: 5.2
   */
  it('should have disclaimer text exactly as specified in requirements', () => {
    const expectedDisclaimer = 'Detected via pattern matching. No legal force or applicability implied.';
    
    expect(BDLawExtractor.LEXICAL_RELATION_DISCLAIMER).toBe(expectedDisclaimer);
    
    // Also verify it's used in metadata
    const metadata = BDLawExtractor.getLexicalReferencesMetadata([]);
    expect(metadata.disclaimer).toBe(expectedDisclaimer);
  });
});
