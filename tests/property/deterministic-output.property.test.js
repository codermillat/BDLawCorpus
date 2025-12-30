/**
 * Property-Based Tests for Deterministic Output
 * 
 * Feature: legal-structure-derivation, Property 8: Deterministic Output
 * Validates: Requirements 12.1, 12.2, 12.3
 * 
 * For any DOM document and content_raw input, calling extractStructureFromDOM()
 * and extractReferencesFromDOM() multiple times SHALL produce byte-identical
 * output each time.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 8: Deterministic Output', () => {
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
   * Helper to create a section marker
   */
  function createSectionMarker(num) {
    return toBengaliNumeral(num) + DANDA;
  }

  /**
   * Helper to create a subsection marker
   */
  function createSubsectionMarker(num) {
    return '(' + toBengaliNumeral(num) + ')';
  }

  /**
   * Helper to create a clause marker
   */
  function createClauseMarker(index) {
    return '(' + BENGALI_LETTERS[index % BENGALI_LETTERS.length] + ')';
  }

  /**
   * Generator for structure data with sections, subsections, and clauses
   */
  const structureDataGen = fc.record({
    sectionCount: fc.integer({ min: 1, max: 5 }),
    hasSubsections: fc.boolean(),
    hasClauses: fc.boolean(),
    hasPreamble: fc.boolean(),
    hasEnactment: fc.boolean()
  }).chain(config => {
    return fc.record({
      sectionNums: fc.uniqueArray(fc.integer({ min: 1, max: 50 }), { 
        minLength: config.sectionCount, 
        maxLength: config.sectionCount 
      }),
      headings: fc.array(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', 'ঘ', 'ঙ', ' '), { minLength: 3, maxLength: 15 }),
        { minLength: config.sectionCount, maxLength: config.sectionCount }
      ),
      subsectionCounts: fc.array(
        fc.integer({ min: 0, max: config.hasSubsections ? 3 : 0 }),
        { minLength: config.sectionCount, maxLength: config.sectionCount }
      ),
      clauseCounts: fc.array(
        fc.integer({ min: 0, max: config.hasClauses ? 4 : 0 }),
        { minLength: config.sectionCount, maxLength: config.sectionCount }
      ),
      hasPreamble: fc.constant(config.hasPreamble),
      hasEnactment: fc.constant(config.hasEnactment)
    });
  }).map(data => {
    // Build sections
    const sections = data.sectionNums.map((num, index) => {
      const sectionMarker = createSectionMarker(num);
      const heading = data.headings[index] || 'শিরোনাম';
      
      // Build subsections
      const subsections = [];
      for (let i = 0; i < data.subsectionCounts[index]; i++) {
        subsections.push({
          marker: createSubsectionMarker(i + 1),
          relativeOffset: i * 20,
          clauses: []
        });
      }
      
      // Build clauses
      const clauses = [];
      for (let i = 0; i < data.clauseCounts[index]; i++) {
        clauses.push({
          marker: createClauseMarker(i),
          relativeOffset: i * 15
        });
      }
      
      return {
        dom_index: index,
        section_number: sectionMarker,
        heading: heading,
        body_text: 'বিষয়বস্তু ' + toBengaliNumeral(index + 1),
        subsections: subsections,
        clauses: clauses
      };
    });
    
    // Build content_raw
    let contentRaw = '';
    
    // Add preamble if present
    const preamble = data.hasPreamble ? {
      text: 'যেহেতু বাংলাদেশের জনগণের কল্যাণে',
      has_preamble: true,
      dom_source: '.lineremove'
    } : null;
    
    if (preamble) {
      contentRaw += preamble.text + '\n';
    }
    
    // Add enactment if present
    const enactment = data.hasEnactment ? {
      text: 'সেহেতু এতদ্বারা নিম্নরূপ আইন করা হইল',
      has_enactment_clause: true,
      dom_source: '.lineremove'
    } : null;
    
    if (enactment) {
      contentRaw += enactment.text + '\n';
    }
    
    // Add sections
    contentRaw += sections.map(s => {
      let sectionText = s.heading + ' ' + s.section_number + ' ' + s.body_text;
      
      // Add subsections
      for (const sub of s.subsections) {
        sectionText += ' ' + sub.marker + ' উপধারা';
      }
      
      // Add clauses
      for (const clause of s.clauses) {
        sectionText += ' ' + clause.marker + ' দফা';
      }
      
      return sectionText;
    }).join('\n');
    
    return {
      preamble: preamble,
      enactment: enactment,
      sections: sections,
      linkReferences: [],
      patternReferences: [],
      contentRaw: contentRaw
    };
  });

  /**
   * Generator for structure data with cross-references
   */
  const structureWithReferencesGen = structureDataGen.chain(structureData => {
    return fc.record({
      linkRefCount: fc.integer({ min: 0, max: 3 }),
      patternRefCount: fc.integer({ min: 0, max: 3 })
    }).map(refConfig => {
      const linkReferences = [];
      const patternReferences = [];
      
      // Generate link references
      for (let i = 0; i < refConfig.linkRefCount; i++) {
        const offset = Math.min(i * 50, structureData.contentRaw.length - 1);
        linkReferences.push({
          citation_text: 'Passport Act, 1920',
          character_offset: offset,
          href: `http://bdlaws.minlaw.gov.bd/act-details-${100 + i}.html`,
          act_id: String(100 + i),
          dom_section_index: 0
        });
      }
      
      // Generate pattern references
      for (let i = 0; i < refConfig.patternRefCount; i++) {
        const offset = Math.min((i + refConfig.linkRefCount) * 50 + 25, structureData.contentRaw.length - 1);
        patternReferences.push({
          citation_text: '১৯৯০ সনের ২০ নং আইন',
          character_offset: offset,
          dom_section_index: 0
        });
      }
      
      return {
        ...structureData,
        linkReferences: linkReferences,
        patternReferences: patternReferences
      };
    });
  });

  /**
   * Property: buildStructureTree produces identical output on repeated calls
   * Requirements: 12.1 - Same content_raw produces byte-identical structure
   */
  it('should produce byte-identical structure output on repeated buildStructureTree calls', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          // Call buildStructureTree multiple times with same input
          const structure1 = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          const structure2 = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          const structure3 = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          // Convert to JSON for byte-identical comparison
          const json1 = JSON.stringify(structure1);
          const json2 = JSON.stringify(structure2);
          const json3 = JSON.stringify(structure3);
          
          return json1 === json2 && json2 === json3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: buildCrossReferences produces identical output on repeated calls
   * Requirements: 12.2 - Same content_raw produces byte-identical cross_references
   */
  it('should produce byte-identical cross_references output on repeated buildCrossReferences calls', () => {
    fc.assert(
      fc.property(
        structureWithReferencesGen,
        (structureData) => {
          // Build structure first
          const structure = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          // Call buildCrossReferences multiple times with same input
          const refs1 = BDLawExtractor.buildCrossReferences({
            linkReferences: structureData.linkReferences,
            patternReferences: structureData.patternReferences,
            structure: structure,
            contentRaw: structureData.contentRaw
          });
          
          const refs2 = BDLawExtractor.buildCrossReferences({
            linkReferences: structureData.linkReferences,
            patternReferences: structureData.patternReferences,
            structure: structure,
            contentRaw: structureData.contentRaw
          });
          
          const refs3 = BDLawExtractor.buildCrossReferences({
            linkReferences: structureData.linkReferences,
            patternReferences: structureData.patternReferences,
            structure: structure,
            contentRaw: structureData.contentRaw
          });
          
          // Convert to JSON for byte-identical comparison
          const json1 = JSON.stringify(refs1);
          const json2 = JSON.stringify(refs2);
          const json3 = JSON.stringify(refs3);
          
          return json1 === json2 && json2 === json3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: deriveStructureAndReferences produces identical output on repeated calls
   * Requirements: 12.1, 12.2 - Full derivation is deterministic
   */
  it('should produce byte-identical output on repeated deriveStructureAndReferences calls', () => {
    fc.assert(
      fc.property(
        structureWithReferencesGen,
        (structureData) => {
          const extractionResult = {
            content: structureData.contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          // Call deriveStructureAndReferences multiple times
          const result1 = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          const result2 = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          const result3 = BDLawExtractor.deriveStructureAndReferences(extractionResult, structureData);
          
          // Compare structure JSON
          const structureJson1 = JSON.stringify(result1.structure);
          const structureJson2 = JSON.stringify(result2.structure);
          const structureJson3 = JSON.stringify(result3.structure);
          
          // Compare cross_references JSON
          const refsJson1 = JSON.stringify(result1.cross_references);
          const refsJson2 = JSON.stringify(result2.cross_references);
          const refsJson3 = JSON.stringify(result3.cross_references);
          
          return structureJson1 === structureJson2 && 
                 structureJson2 === structureJson3 &&
                 refsJson1 === refsJson2 &&
                 refsJson2 === refsJson3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Structure output contains no timestamps
   * Requirements: 12.3 - No timestamps in derived outputs
   */
  it('should not include timestamps in structure output', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          const structure = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          const json = JSON.stringify(structure);
          
          // Check for common timestamp patterns
          const hasTimestamp = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(json);
          const hasDateField = /"(?:timestamp|created_at|updated_at|date|time)"/.test(json);
          
          return !hasTimestamp && !hasDateField;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cross-references output contains no timestamps
   * Requirements: 12.3 - No timestamps in derived outputs
   */
  it('should not include timestamps in cross_references output', () => {
    fc.assert(
      fc.property(
        structureWithReferencesGen,
        (structureData) => {
          const structure = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          const refs = BDLawExtractor.buildCrossReferences({
            linkReferences: structureData.linkReferences,
            patternReferences: structureData.patternReferences,
            structure: structure,
            contentRaw: structureData.contentRaw
          });
          
          const json = JSON.stringify(refs);
          
          // Check for common timestamp patterns
          const hasTimestamp = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(json);
          const hasDateField = /"(?:timestamp|created_at|updated_at|date|time)"/.test(json);
          
          return !hasTimestamp && !hasDateField;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Structure output contains no random values
   * Requirements: 12.3 - No random values in derived outputs
   */
  it('should not include random values (UUIDs, random IDs) in structure output', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          // Call multiple times and compare
          const structure1 = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          const structure2 = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          // If there were random values, the outputs would differ
          // Check specific fields that might contain random values
          const json1 = JSON.stringify(structure1);
          const json2 = JSON.stringify(structure2);
          
          // Check for UUID patterns
          const hasUUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(json1);
          
          return json1 === json2 && !hasUUID;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Metadata deterministic flag is always true
   * Requirements: 12.3 - Deterministic metadata
   */
  it('should always set metadata.deterministic to true', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          const structure = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          return structure.metadata && structure.metadata.deterministic === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section ordering is consistent across calls
   * Requirements: 12.1 - Consistent ordering (DOM order preserved)
   */
  it('should maintain consistent section ordering across repeated calls', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          const structure1 = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          const structure2 = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          // Verify section order is identical
          if (structure1.sections.length !== structure2.sections.length) {
            return false;
          }
          
          for (let i = 0; i < structure1.sections.length; i++) {
            if (structure1.sections[i].dom_index !== structure2.sections[i].dom_index) {
              return false;
            }
            if (structure1.sections[i].section_number !== structure2.sections[i].section_number) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cross-reference ordering is consistent across calls
   * Requirements: 12.2 - Consistent ordering for cross_references
   */
  it('should maintain consistent cross-reference ordering across repeated calls', () => {
    fc.assert(
      fc.property(
        structureWithReferencesGen,
        (structureData) => {
          const structure = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          const refs1 = BDLawExtractor.buildCrossReferences({
            linkReferences: structureData.linkReferences,
            patternReferences: structureData.patternReferences,
            structure: structure,
            contentRaw: structureData.contentRaw
          });
          
          const refs2 = BDLawExtractor.buildCrossReferences({
            linkReferences: structureData.linkReferences,
            patternReferences: structureData.patternReferences,
            structure: structure,
            contentRaw: structureData.contentRaw
          });
          
          // Verify reference order is identical
          if (refs1.length !== refs2.length) {
            return false;
          }
          
          for (let i = 0; i < refs1.length; i++) {
            if (refs1[i].character_offset !== refs2[i].character_offset) {
              return false;
            }
            if (refs1[i].citation_text !== refs2[i].citation_text) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty input produces deterministic empty output
   * Requirements: 12.1, 12.2 - Edge case determinism
   */
  it('should produce deterministic output for empty input', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const emptyStructureData = {
            preamble: null,
            enactment: null,
            sections: [],
            linkReferences: [],
            patternReferences: [],
            contentRaw: ''
          };
          
          const extractionResult = {
            content: '',
            title: 'Empty Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-0.html'
          };
          
          // Call multiple times
          const result1 = BDLawExtractor.deriveStructureAndReferences(extractionResult, emptyStructureData);
          const result2 = BDLawExtractor.deriveStructureAndReferences(extractionResult, emptyStructureData);
          const result3 = BDLawExtractor.deriveStructureAndReferences(extractionResult, emptyStructureData);
          
          const json1 = JSON.stringify({ structure: result1.structure, cross_references: result1.cross_references });
          const json2 = JSON.stringify({ structure: result2.structure, cross_references: result2.cross_references });
          const json3 = JSON.stringify({ structure: result3.structure, cross_references: result3.cross_references });
          
          return json1 === json2 && json2 === json3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Null structureData produces deterministic null structure
   * Requirements: 12.1 - Edge case determinism
   */
  it('should produce deterministic null structure for null structureData', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom('ক', 'খ', 'গ', ' '), { minLength: 10, maxLength: 100 }),
        (contentRaw) => {
          const extractionResult = {
            content: contentRaw,
            title: 'Test Act',
            url: 'http://bdlaws.minlaw.gov.bd/act-details-123.html'
          };
          
          // Call multiple times with null structureData
          const result1 = BDLawExtractor.deriveStructureAndReferences(extractionResult, null);
          const result2 = BDLawExtractor.deriveStructureAndReferences(extractionResult, null);
          const result3 = BDLawExtractor.deriveStructureAndReferences(extractionResult, null);
          
          // All should have null structure and empty cross_references
          return result1.structure === null && 
                 result2.structure === null && 
                 result3.structure === null &&
                 Array.isArray(result1.cross_references) && result1.cross_references.length === 0 &&
                 Array.isArray(result2.cross_references) && result2.cross_references.length === 0 &&
                 Array.isArray(result3.cross_references) && result3.cross_references.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Subsection and clause ordering is deterministic
   * Requirements: 12.1 - Nested element ordering determinism
   */
  it('should maintain deterministic ordering for nested subsections and clauses', () => {
    fc.assert(
      fc.property(
        structureDataGen,
        (structureData) => {
          const structure1 = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          const structure2 = BDLawExtractor.buildStructureTree({
            preamble: structureData.preamble,
            enactment: structureData.enactment,
            sections: structureData.sections,
            contentRaw: structureData.contentRaw
          });
          
          // Check each section's subsections and clauses
          for (let i = 0; i < structure1.sections.length; i++) {
            const section1 = structure1.sections[i];
            const section2 = structure2.sections[i];
            
            // Check subsections
            if (section1.subsections.length !== section2.subsections.length) {
              return false;
            }
            for (let j = 0; j < section1.subsections.length; j++) {
              if (section1.subsections[j].marker !== section2.subsections[j].marker) {
                return false;
              }
            }
            
            // Check clauses
            if (section1.clauses.length !== section2.clauses.length) {
              return false;
            }
            for (let j = 0; j < section1.clauses.length; j++) {
              if (section1.clauses[j].marker !== section2.clauses[j].marker) {
                return false;
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
