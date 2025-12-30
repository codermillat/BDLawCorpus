/**
 * Property-Based Tests for Backward Compatibility
 * 
 * Feature: legal-structure-derivation, Property 11: Backward Compatibility
 * Validates: Requirements 13.1, 13.2, 13.5
 * 
 * For any extraction result processed through structure derivation, all existing
 * fields (content_raw, content_normalized, content_corrected, lexical_references)
 * SHALL remain unchanged.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');
const BDLawExport = require('../../bdlaw-export.js');

describe('Property 11: Backward Compatibility', () => {
  // Bengali numerals: ০-৯ (U+09E6 to U+09EF)
  const BENGALI_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  // Bengali danda: ৷ (U+09F7)
  const DANDA = '৷';
  // Bengali letters for clauses
  const BENGALI_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'];

  /**
   * Helper to generate a Bengali numeral string from a number
   */
  function toBengaliNumeral(num) {
    return String(num).split('').map(d => BENGALI_NUMERALS[parseInt(d)]).join('');
  }

  /**
   * Generator for Bengali content with legal structure markers
   */
  const bengaliLegalContentGen = fc.record({
    sectionNum: fc.integer({ min: 1, max: 99 }),
    heading: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' '), { minLength: 1, maxLength: 20 }),
    bodyText: fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', 'ঝ', 'ঞ', ' ', '\n'), { minLength: 10, maxLength: 100 }),
    hasSubsection: fc.boolean(),
    subsectionNum: fc.integer({ min: 1, max: 9 }),
    hasClause: fc.boolean(),
    clauseIndex: fc.integer({ min: 0, max: 4 })
  }).map(data => {
    const sectionMarker = toBengaliNumeral(data.sectionNum) + DANDA;
    let content = data.heading + ' ' + sectionMarker + ' ' + data.bodyText;
    
    if (data.hasSubsection) {
      const subsectionMarker = '(' + toBengaliNumeral(data.subsectionNum) + ')';
      content += ' ' + subsectionMarker + ' উপধারা বিষয়বস্তু';
    }
    
    if (data.hasClause) {
      const clauseMarker = '(' + BENGALI_LETTERS[data.clauseIndex] + ')';
      content += ' ' + clauseMarker + ' দফা বিষয়বস্তু';
    }
    
    return content;
  });

  /**
   * Generator for complete extraction result with all existing fields
   */
  const extractionResultGen = fc.record({
    content: bengaliLegalContentGen,
    title: fc.string({ minLength: 1, maxLength: 50 }),
    url: fc.constant('http://bdlaws.minlaw.gov.bd/act-details-123.html'),
    content_normalized: fc.option(bengaliLegalContentGen, { nil: undefined }),
    content_corrected: fc.option(bengaliLegalContentGen, { nil: undefined }),
    lexical_references: fc.option(
      fc.array(fc.record({
        citation_text: fc.string({ minLength: 5, maxLength: 50 }),
        position: fc.integer({ min: 0, max: 1000 }),
        reference_type: fc.constantFrom('mention', 'amendment', 'repeal')
      }), { minLength: 0, maxLength: 5 }),
      { nil: undefined }
    ),
    sections: fc.option(
      fc.record({
        detected: fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
        counts: fc.record({
          'ধারা': fc.integer({ min: 0, max: 10 }),
          'অধ্যায়': fc.integer({ min: 0, max: 5 }),
          'তফসিল': fc.integer({ min: 0, max: 3 })
        })
      }),
      { nil: undefined }
    ),
    extraction_metadata: fc.option(
      fc.record({
        extraction_success: fc.boolean(),
        dom_readiness: fc.constantFrom('ready', 'uncertain', 'not_ready')
      }),
      { nil: undefined }
    ),
    marker_frequency: fc.option(
      fc.record({
        dhara_count: fc.integer({ min: 0, max: 20 }),
        numeral_danda_count: fc.integer({ min: 0, max: 20 })
      }),
      { nil: undefined }
    )
  });

  /**
   * Generator for structure data (simulating DOM extraction)
   */
  const structureDataGen = fc.record({
    sectionNum: fc.integer({ min: 1, max: 99 }),
    heading: fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' '), { minLength: 1, maxLength: 20 }),
    bodyText: fc.stringOf(fc.constantFrom('চ', 'ছ', 'জ', 'ঝ', 'ঞ', ' '), { minLength: 5, maxLength: 50 })
  }).map(data => {
    const sectionMarker = toBengaliNumeral(data.sectionNum) + DANDA;
    const contentRaw = data.heading + ' ' + sectionMarker + ' ' + data.bodyText;
    
    return {
      preamble: null,
      enactment: null,
      sections: [{
        dom_index: 0,
        section_number: sectionMarker,
        heading: data.heading,
        body_text: data.bodyText,
        subsections: [],
        clauses: []
      }],
      linkReferences: [],
      patternReferences: [],
      contentRaw: contentRaw
    };
  });

  /**
   * Property: Existing fields remain unchanged after structure derivation
   * Requirements: 13.1 - SHALL NOT modify existing fields
   */
  it('should preserve all existing fields unchanged after structure derivation', () => {
    fc.assert(
      fc.property(
        extractionResultGen,
        structureDataGen,
        (extractionResult, structureData) => {
          // Deep clone original values for comparison
          const originalContent = extractionResult.content;
          const originalTitle = extractionResult.title;
          const originalUrl = extractionResult.url;
          const originalContentNormalized = extractionResult.content_normalized;
          const originalContentCorrected = extractionResult.content_corrected;
          const originalLexicalReferences = extractionResult.lexical_references 
            ? JSON.stringify(extractionResult.lexical_references) 
            : undefined;
          const originalSections = extractionResult.sections 
            ? JSON.stringify(extractionResult.sections) 
            : undefined;
          const originalExtractionMetadata = extractionResult.extraction_metadata 
            ? JSON.stringify(extractionResult.extraction_metadata) 
            : undefined;
          const originalMarkerFrequency = extractionResult.marker_frequency 
            ? JSON.stringify(extractionResult.marker_frequency) 
            : undefined;
          
          // Call deriveStructureAndReferences
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // Verify all existing fields are unchanged
          const contentUnchanged = result.content === originalContent;
          const titleUnchanged = result.title === originalTitle;
          const urlUnchanged = result.url === originalUrl;
          const contentNormalizedUnchanged = result.content_normalized === originalContentNormalized;
          const contentCorrectedUnchanged = result.content_corrected === originalContentCorrected;
          const lexicalReferencesUnchanged = result.lexical_references === undefined 
            ? originalLexicalReferences === undefined 
            : JSON.stringify(result.lexical_references) === originalLexicalReferences;
          const sectionsUnchanged = result.sections === undefined 
            ? originalSections === undefined 
            : JSON.stringify(result.sections) === originalSections;
          const extractionMetadataUnchanged = result.extraction_metadata === undefined 
            ? originalExtractionMetadata === undefined 
            : JSON.stringify(result.extraction_metadata) === originalExtractionMetadata;
          const markerFrequencyUnchanged = result.marker_frequency === undefined 
            ? originalMarkerFrequency === undefined 
            : JSON.stringify(result.marker_frequency) === originalMarkerFrequency;
          
          return contentUnchanged && 
                 titleUnchanged && 
                 urlUnchanged && 
                 contentNormalizedUnchanged && 
                 contentCorrectedUnchanged && 
                 lexicalReferencesUnchanged &&
                 sectionsUnchanged &&
                 extractionMetadataUnchanged &&
                 markerFrequencyUnchanged;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: structure and cross_references are added as new top-level fields
   * Requirements: 13.2 - SHALL add structure and cross_references as new top-level fields only
   */
  it('should add structure and cross_references as new top-level fields', () => {
    fc.assert(
      fc.property(
        extractionResultGen,
        structureDataGen,
        (extractionResult, structureData) => {
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // Verify structure and cross_references are present as top-level fields
          const hasStructure = 'structure' in result;
          const hasCrossReferences = 'cross_references' in result;
          
          // Verify they are at the top level (not nested)
          const structureIsTopLevel = result.structure === null || 
            (typeof result.structure === 'object' && !Array.isArray(result.structure));
          const crossReferencesIsTopLevel = Array.isArray(result.cross_references);
          
          return hasStructure && hasCrossReferences && structureIsTopLevel && crossReferencesIsTopLevel;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When structure derivation fails, structure is null without affecting other fields
   * Requirements: 13.3 - WHEN structure derivation fails, SHALL set structure: null
   */
  it('should set structure to null when structureData is null without affecting other fields', () => {
    fc.assert(
      fc.property(
        extractionResultGen,
        (extractionResult) => {
          // Deep clone original values
          const originalContent = extractionResult.content;
          const originalTitle = extractionResult.title;
          
          // Call with null structureData
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, null);
          
          // Verify structure is null
          const structureIsNull = result.structure === null;
          
          // Verify other fields unchanged
          const contentUnchanged = result.content === originalContent;
          const titleUnchanged = result.title === originalTitle;
          
          return structureIsNull && contentUnchanged && titleUnchanged;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When reference detection fails, cross_references is empty array
   * Requirements: 13.4 - WHEN reference detection fails, SHALL set cross_references: []
   */
  it('should set cross_references to empty array when no references found', () => {
    fc.assert(
      fc.property(
        extractionResultGen,
        (extractionResult) => {
          // Create structureData with no references
          const structureDataNoRefs = {
            preamble: null,
            enactment: null,
            sections: [],
            linkReferences: [],
            patternReferences: [],
            contentRaw: extractionResult.content
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureDataNoRefs);
          
          // Verify cross_references is an empty array
          return Array.isArray(result.cross_references) && result.cross_references.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Export format maintains backward compatibility
   * Requirements: 13.5 - SHALL maintain compatibility with existing export formats
   */
  it('should maintain export format compatibility with structure and cross_references', () => {
    fc.assert(
      fc.property(
        extractionResultGen,
        structureDataGen,
        (extractionResult, structureData) => {
          // Derive structure and references
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // Create metadata for export
          const metadata = {
            source_url: extractionResult.url,
            extraction_timestamp: new Date().toISOString()
          };
          
          // Format for export
          const jsonString = BDLawExport.formatActExport(result, metadata);
          
          // Validate JSON is parseable
          const isValidJson = BDLawExport.validateJSON(jsonString);
          
          // Parse and verify structure
          const parsed = JSON.parse(jsonString);
          
          // Verify existing fields are present
          const hasMetadata = '_metadata' in parsed;
          const hasTitle = 'title' in parsed;
          const hasContent = 'content' in parsed;
          const hasSectionsDetected = 'sections_detected' in parsed;
          
          // Verify new fields are present
          const hasStructure = 'structure' in parsed;
          const hasCrossReferences = 'cross_references' in parsed;
          
          return isValidJson && 
                 hasMetadata && 
                 hasTitle && 
                 hasContent && 
                 hasSectionsDetected &&
                 hasStructure && 
                 hasCrossReferences;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_raw field is preserved byte-identical
   * Requirements: 13.1 - content_raw must remain unchanged
   */
  it('should preserve content_raw byte-identical after structure derivation', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentGen,
        structureDataGen,
        (contentRaw, structureData) => {
          const extractionResult = {
            content: contentRaw,
            content_raw: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // content_raw should be byte-identical
          return result.content_raw === contentRaw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: lexical_references field is preserved unchanged
   * Requirements: 13.1 - lexical_references must remain unchanged
   */
  it('should preserve lexical_references unchanged after structure derivation', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          citation_text: fc.string({ minLength: 5, maxLength: 50 }),
          position: fc.integer({ min: 0, max: 1000 }),
          reference_type: fc.constantFrom('mention', 'amendment', 'repeal')
        }), { minLength: 1, maxLength: 5 }),
        structureDataGen,
        (lexicalReferences, structureData) => {
          const extractionResult = {
            content: 'Test content',
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html',
            lexical_references: lexicalReferences
          };
          
          const originalJson = JSON.stringify(lexicalReferences);
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // lexical_references should be unchanged
          return JSON.stringify(result.lexical_references) === originalJson;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty extraction result returns structure: null and cross_references: []
   * Requirements: 13.3, 13.4 - Graceful handling of empty input
   */
  it('should handle empty extraction result gracefully', () => {
    const emptyResult = {};
    const result = BDLawExtractor.deriveStructureAndReferences(emptyResult, null);
    
    expect(result.structure).toBeNull();
    expect(result.cross_references).toEqual([]);
  });

  /**
   * Property: Extraction result without content returns structure: null
   * Requirements: 13.3 - Graceful handling of missing content
   */
  it('should handle extraction result without content gracefully', () => {
    const resultWithoutContent = {
      title: 'Test Act',
      url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
    };
    
    const result = BDLawExtractor.deriveStructureAndReferences(resultWithoutContent, null);
    
    expect(result.structure).toBeNull();
    expect(result.cross_references).toEqual([]);
    // Original fields should still be present
    expect(result.title).toBe('Test Act');
    expect(result.url).toBe('http://bdlaws.minlaw.gov.bd/act-details-123.html');
  });

  /**
   * Property: Multiple derivation calls don't accumulate changes
   * Requirements: 13.1 - Fields should not be modified by repeated calls
   */
  it('should not accumulate changes across multiple derivation calls', () => {
    fc.assert(
      fc.property(
        extractionResultGen,
        structureDataGen,
        (extractionResult, structureData) => {
          // Call deriveStructureAndReferences multiple times
          const result1 = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          const result2 = BDLawExtractor.deriveStructureAndReferences(result1, structureData);
          const result3 = BDLawExtractor.deriveStructureAndReferences(result2, structureData);
          
          // Original content should be unchanged across all calls
          const contentUnchanged = result1.content === result2.content && 
                                   result2.content === result3.content;
          
          // Structure should be consistent
          const structureConsistent = JSON.stringify(result1.structure) === JSON.stringify(result2.structure) &&
                                      JSON.stringify(result2.structure) === JSON.stringify(result3.structure);
          
          return contentUnchanged && structureConsistent;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_normalized is preserved if present
   * Requirements: 13.1 - content_normalized must remain unchanged
   */
  it('should preserve content_normalized if present', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentGen,
        bengaliLegalContentGen,
        structureDataGen,
        (contentRaw, contentNormalized, structureData) => {
          const extractionResult = {
            content: contentRaw,
            content_normalized: contentNormalized,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return result.content_normalized === contentNormalized;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: content_corrected is preserved if present
   * Requirements: 13.1 - content_corrected must remain unchanged
   */
  it('should preserve content_corrected if present', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentGen,
        bengaliLegalContentGen,
        structureDataGen,
        (contentRaw, contentCorrected, structureData) => {
          const extractionResult = {
            content: contentRaw,
            content_corrected: contentCorrected,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return result.content_corrected === contentCorrected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: sections field is preserved if present
   * Requirements: 13.1 - sections must remain unchanged
   */
  it('should preserve sections field if present', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentGen,
        fc.record({
          detected: fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
          counts: fc.record({
            'ধারা': fc.integer({ min: 0, max: 10 }),
            'অধ্যায়': fc.integer({ min: 0, max: 5 }),
            'তফসিল': fc.integer({ min: 0, max: 3 })
          })
        }),
        structureDataGen,
        (contentRaw, sections, structureData) => {
          const extractionResult = {
            content: contentRaw,
            sections: sections,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const originalSectionsJson = JSON.stringify(sections);
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return JSON.stringify(result.sections) === originalSectionsJson;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extraction_metadata field is preserved if present
   * Requirements: 13.1 - extraction_metadata must remain unchanged
   */
  it('should preserve extraction_metadata field if present', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentGen,
        fc.record({
          extraction_success: fc.boolean(),
          dom_readiness: fc.constantFrom('ready', 'uncertain', 'not_ready'),
          selectors_attempted: fc.array(fc.string(), { minLength: 0, maxLength: 3 })
        }),
        structureDataGen,
        (contentRaw, extractionMetadata, structureData) => {
          const extractionResult = {
            content: contentRaw,
            extraction_metadata: extractionMetadata,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const originalMetadataJson = JSON.stringify(extractionMetadata);
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return JSON.stringify(result.extraction_metadata) === originalMetadataJson;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: marker_frequency field is preserved if present
   * Requirements: 13.1 - marker_frequency must remain unchanged
   */
  it('should preserve marker_frequency field if present', () => {
    fc.assert(
      fc.property(
        bengaliLegalContentGen,
        fc.record({
          dhara_count: fc.integer({ min: 0, max: 20 }),
          numeral_danda_count: fc.integer({ min: 0, max: 20 }),
          bengali_numbered_sections: fc.integer({ min: 0, max: 20 })
        }),
        structureDataGen,
        (contentRaw, markerFrequency, structureData) => {
          const extractionResult = {
            content: contentRaw,
            marker_frequency: markerFrequency,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          const originalMarkerFrequencyJson = JSON.stringify(markerFrequency);
          
          const result = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          return JSON.stringify(result.marker_frequency) === originalMarkerFrequencyJson;
        }
      ),
      { numRuns: 100 }
    );
  });
});
