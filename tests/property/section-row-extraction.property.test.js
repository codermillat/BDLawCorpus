/**
 * Property-Based Tests for Act Section-Row Extraction
 * 
 * Feature: bdlawcorpus-mode, Property 16: Section Row Extraction Completeness
 * Validates: Requirements 23.3, 23.4, 23.5, 23.6, 23.7
 * 
 * Property: For any Act Detail page with `.lineremoves` section rows, the extractor 
 * SHALL extract all sections preserving: section title from `.txt-head`, section body 
 * from `.txt-details`, title-body association, and original document order
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

/**
 * Helper to create a mock DOM document with section-row structure
 * @param {Object} options - { metadata, sections }
 * @returns {Object} Mock document object
 */
function createMockDocument(options) {
  const { metadata, sections } = options;

  // Create mock section rows
  const mockSectionRows = sections.map((section) => {
    return {
      querySelector: (selector) => {
        if (selector === '.col-sm-3.txt-head') {
          return {
            textContent: section.sectionTitle
          };
        }
        if (selector === '.col-sm-9.txt-details') {
          return {
            textContent: section.sectionBody,
            innerHTML: section.sectionBodyHtml || section.sectionBody,
            querySelector: (sel) => {
              if (sel === 'table') {
                return section.hasTable ? { tagName: 'TABLE' } : null;
              }
              return null;
            }
          };
        }
        return null;
      }
    };
  });

  // Create mock container with metadata and section rows
  const mockContainer = {
    querySelector: (selector) => {
      // Check for metadata selectors
      if (selector === '.bg-act-section' || selector === '.act-role-style') {
        if (metadata && selector === '.bg-act-section') {
          return { textContent: metadata };
        }
        return null;
      }
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector === '.lineremoves') {
        return mockSectionRows;
      }
      return [];
    }
  };

  return {
    querySelector: (selector) => {
      if (selector === '.boxed-layout') {
        return mockContainer;
      }
      return null;
    }
  };
}

describe('Property 16: Section Row Extraction Completeness', () => {
  /**
   * Generator for valid section data
   */
  const sectionDataArb = fc.record({
    sectionTitle: fc.string({ minLength: 0, maxLength: 100 }),
    sectionBody: fc.string({ minLength: 0, maxLength: 500 }),
    sectionBodyHtml: fc.string({ minLength: 0, maxLength: 500 }),
    hasTable: fc.boolean()
  });

  /**
   * Generator for document with sections
   */
  const documentDataArb = fc.record({
    metadata: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
    sections: fc.array(sectionDataArb, { minLength: 0, maxLength: 20 })
  });

  /**
   * Property: All section rows should be extracted
   * Requirements: 23.3 - Iterate through .lineremoves rows
   */
  it('should extract all section rows from document', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const result = BDLawExtractor.extractActFromSectionRows(mockDoc);
          
          // Should extract same number of sections
          return result.sections.length === docData.sections.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section titles should be preserved from .txt-head
   * Requirements: 23.4 - Extract section title from .col-sm-3.txt-head
   */
  it('should preserve section titles from .txt-head column', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const result = BDLawExtractor.extractActFromSectionRows(mockDoc);
          
          // Each extracted title should match input (trimmed)
          return result.sections.every((section, index) => 
            section.sectionTitle === docData.sections[index].sectionTitle.trim()
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section bodies should be preserved from .txt-details
   * Requirements: 23.5 - Extract section body from .col-sm-9.txt-details
   */
  it('should preserve section bodies from .txt-details column', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const result = BDLawExtractor.extractActFromSectionRows(mockDoc);
          
          // Each extracted body should match input (trimmed)
          return result.sections.every((section, index) => 
            section.sectionBody === docData.sections[index].sectionBody.trim()
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Title-body association should be preserved
   * Requirements: 23.6 - Preserve title-body association
   */
  it('should preserve title-body association for each section', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const result = BDLawExtractor.extractActFromSectionRows(mockDoc);
          
          // Each section should have both title and body from the same input row
          return result.sections.every((section, index) => {
            const inputSection = docData.sections[index];
            return section.sectionTitle === inputSection.sectionTitle.trim() &&
                   section.sectionBody === inputSection.sectionBody.trim();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Original document order should be preserved via index
   * Requirements: 23.7 - Maintain original document order
   */
  it('should preserve original document order with index property', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const result = BDLawExtractor.extractActFromSectionRows(mockDoc);
          
          // Each index should match the original position
          return result.sections.every((section, index) => section.index === index);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: hasTable flag should correctly indicate table presence
   * Requirements: 23.7 - Track hasTable flag for sections containing tables
   */
  it('should correctly track hasTable flag for sections', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const result = BDLawExtractor.extractActFromSectionRows(mockDoc);
          
          // hasTable flag should match input
          return result.sections.every((section, index) => 
            section.hasTable === docData.sections[index].hasTable
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty document should return empty sections array
   */
  it('should return empty sections for null/undefined document', () => {
    const nullResult = BDLawExtractor.extractActFromSectionRows(null);
    const undefinedResult = BDLawExtractor.extractActFromSectionRows(undefined);
    
    expect(nullResult).toEqual({ preambleContent: null, metadata: null, sections: [] });
    expect(undefinedResult).toEqual({ preambleContent: null, metadata: null, sections: [] });
  });

  /**
   * Property: Document without .boxed-layout container should return empty result
   */
  it('should return empty result when no .boxed-layout container found', () => {
    const emptyDoc = {
      querySelector: () => null
    };
    
    const result = BDLawExtractor.extractActFromSectionRows(emptyDoc);
    expect(result).toEqual({ preambleContent: null, metadata: null, sections: [] });
  });

  /**
   * Property: Metadata should be extracted from .bg-act-section
   */
  it('should extract metadata from .bg-act-section element', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(sectionDataArb, { minLength: 0, maxLength: 5 }),
        (metadata, sections) => {
          const mockDoc = createMockDocument({ metadata, sections });
          const result = BDLawExtractor.extractActFromSectionRows(mockDoc);
          
          // Metadata should be extracted and trimmed
          return result.metadata === metadata.trim();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: sectionBodyHtml should be preserved for table parsing
   */
  it('should preserve sectionBodyHtml for table parsing', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const result = BDLawExtractor.extractActFromSectionRows(mockDoc);
          
          // Each section should have sectionBodyHtml property
          return result.sections.every(section => 
            typeof section.sectionBodyHtml === 'string'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
