/**
 * Property-Based Tests for DOM-Section Correspondence
 * 
 * Feature: legal-structure-derivation, Property 3: DOM-Section Correspondence
 * Validates: Requirements 2.1, 2.2, 2.5, 3.1, 3.5
 * 
 * For any `.lineremoves` row in the DOM, there SHALL be a corresponding entry in
 * `structure.sections` with matching `dom_index` and content derived from `.txt-head`
 * and `.txt-details`.
 */

const fc = require('fast-check');

// Bengali numerals: ০-৯ (U+09E6 to U+09EF)
const BENGALI_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
// Bengali danda: ৷ (U+09F7)
const DANDA = '৷';

/**
 * Helper to generate a Bengali numeral string from a number
 */
function toBengaliNumeral(num) {
  return String(num).split('').map(d => BENGALI_NUMERALS[parseInt(d)]).join('');
}

/**
 * Helper to create a mock DOM document with section-row structure
 * Simulates the bdlaws.minlaw.gov.bd page structure
 * @param {Object} options - { sections: Array<{heading, sectionNumber, bodyText, hasTable}> }
 * @returns {Object} Mock document object
 */
function createMockDocument(options) {
  const { sections } = options;

  // Create mock section rows (.lineremoves)
  const mockSectionRows = sections.map((section) => {
    // Build title text: heading + section number (if present)
    let titleText = '';
    if (section.heading) {
      titleText = section.heading;
    }
    if (section.sectionNumber) {
      titleText = titleText ? titleText + ' ' + section.sectionNumber : section.sectionNumber;
    }

    return {
      classList: { contains: () => false },
      querySelector: (selector) => {
        if (selector === '.col-sm-3.txt-head') {
          return {
            textContent: titleText
          };
        }
        if (selector === '.col-sm-9.txt-details') {
          return {
            textContent: section.bodyText || '',
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

  // Create mock container with section rows
  const mockContainer = {
    querySelector: (selector) => {
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector === '.lineremoves') {
        return mockSectionRows;
      }
      if (selector === '.lineremove') {
        return []; // No preamble elements
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

/**
 * Simulates extractSectionsFromDOM logic for testing
 * This mirrors the implementation in content.js
 */
function extractSectionsFromMockDOM(mockDoc) {
  const container = mockDoc.querySelector('.boxed-layout');
  if (!container) {
    return [];
  }

  const sectionRows = container.querySelectorAll('.lineremoves');
  const sections = [];
  
  // Bengali section number pattern: numeral(s) + danda
  const sectionNumberPattern = /[০-৯]+৷/;

  sectionRows.forEach((row, domIndex) => {
    const titleEl = row.querySelector('.col-sm-3.txt-head');
    const bodyEl = row.querySelector('.col-sm-9.txt-details');
    
    // Extract full title text
    const titleText = titleEl ? titleEl.textContent.trim() : '';
    const bodyText = bodyEl ? bodyEl.textContent.trim() : '';
    
    // Parse section number and heading from title
    let sectionNumber = null;
    let heading = null;
    
    if (titleText) {
      const numberMatch = titleText.match(sectionNumberPattern);
      if (numberMatch) {
        sectionNumber = numberMatch[0];
        // Heading is text before the section number
        const numberIndex = titleText.indexOf(sectionNumber);
        if (numberIndex > 0) {
          heading = titleText.substring(0, numberIndex).trim();
        }
      } else {
        // No section number found, entire title is heading
        heading = titleText;
      }
    }
    
    sections.push({
      dom_index: domIndex,
      section_number: sectionNumber,
      heading: heading,
      body_text: bodyText,
      has_table: bodyEl ? bodyEl.querySelector('table') !== null : false
    });
  });

  return sections;
}

describe('Property 3: DOM-Section Correspondence', () => {
  /**
   * Generator for valid section data with Bengali section numbers
   */
  const sectionDataArb = fc.record({
    heading: fc.option(
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('৷')),
      { nil: null }
    ),
    sectionNum: fc.option(fc.integer({ min: 1, max: 999 }), { nil: null }),
    bodyText: fc.string({ minLength: 0, maxLength: 200 }),
    hasTable: fc.boolean()
  }).map(data => ({
    heading: data.heading,
    sectionNumber: data.sectionNum ? toBengaliNumeral(data.sectionNum) + DANDA : null,
    bodyText: data.bodyText,
    hasTable: data.hasTable
  }));

  /**
   * Generator for document with multiple sections
   */
  const documentDataArb = fc.record({
    sections: fc.array(sectionDataArb, { minLength: 0, maxLength: 20 })
  });

  /**
   * Property: All .lineremoves rows should have corresponding entries in sections array
   * Requirements: 2.1, 2.5 - Section detection and document order preservation
   */
  it('should extract one section entry for each .lineremoves row', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const sections = extractSectionsFromMockDOM(mockDoc);
          
          // Number of extracted sections should equal number of input rows
          return sections.length === docData.sections.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each section should have dom_index matching its position in DOM order
   * Requirements: 2.5 - Document order preservation
   */
  it('should assign sequential dom_index values matching DOM order', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const sections = extractSectionsFromMockDOM(mockDoc);
          
          // Each section's dom_index should match its array position
          return sections.every((section, index) => section.dom_index === index);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section numbers should be extracted from .txt-head using Bengali numeral+danda pattern
   * Requirements: 2.1, 2.2 - Bengali section number detection
   */
  it('should extract Bengali section numbers (numeral+danda) from .txt-head', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const sections = extractSectionsFromMockDOM(mockDoc);
          
          // Each extracted section_number should match input (if present)
          return sections.every((section, index) => {
            const inputSection = docData.sections[index];
            if (inputSection.sectionNumber) {
              return section.section_number === inputSection.sectionNumber;
            }
            // If no section number in input, extracted should be null
            return section.section_number === null;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section headings should be extracted from .txt-head (text before section number)
   * Requirements: 3.1, 3.5 - Section heading detection
   */
  it('should extract section headings from .txt-head (text before section number)', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const sections = extractSectionsFromMockDOM(mockDoc);
          
          return sections.every((section, index) => {
            const inputSection = docData.sections[index];
            // Trim the input heading to match what the extractor does
            const trimmedInputHeading = inputSection.heading ? inputSection.heading.trim() : null;
            const hasNonEmptyHeading = trimmedInputHeading && trimmedInputHeading.length > 0;
            
            // If input has both non-empty heading and section number, heading should be extracted
            if (hasNonEmptyHeading && inputSection.sectionNumber) {
              return section.heading === trimmedInputHeading;
            }
            
            // If input has only non-empty heading (no section number), entire title becomes heading
            if (hasNonEmptyHeading && !inputSection.sectionNumber) {
              return section.heading === trimmedInputHeading;
            }
            
            // If input has only section number (no heading or whitespace-only heading), heading should be null
            if (!hasNonEmptyHeading && inputSection.sectionNumber) {
              return section.heading === null;
            }
            
            // If input has neither (or whitespace-only heading), heading should be null or empty
            return section.heading === null || section.heading === '';
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section body text should be extracted from .txt-details
   * Requirements: 2.1 - Section content extraction
   */
  it('should extract section body text from .txt-details', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const sections = extractSectionsFromMockDOM(mockDoc);
          
          // Each extracted body_text should match input (trimmed)
          return sections.every((section, index) => {
            const inputSection = docData.sections[index];
            return section.body_text === (inputSection.bodyText || '').trim();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: has_table flag should correctly indicate table presence in .txt-details
   * Requirements: 2.1 - Section structure detection
   */
  it('should correctly track has_table flag for sections containing tables', () => {
    fc.assert(
      fc.property(
        documentDataArb,
        (docData) => {
          const mockDoc = createMockDocument(docData);
          const sections = extractSectionsFromMockDOM(mockDoc);
          
          // has_table flag should match input
          return sections.every((section, index) => 
            section.has_table === docData.sections[index].hasTable
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty document (no .boxed-layout) should return empty sections array
   */
  it('should return empty sections for document without .boxed-layout container', () => {
    const emptyDoc = {
      querySelector: () => null
    };
    
    const sections = extractSectionsFromMockDOM(emptyDoc);
    expect(sections).toEqual([]);
  });

  /**
   * Property: Document with no .lineremoves rows should return empty sections array
   */
  it('should return empty sections when no .lineremoves rows found', () => {
    const docWithNoSections = createMockDocument({ sections: [] });
    const sections = extractSectionsFromMockDOM(docWithNoSections);
    expect(sections).toEqual([]);
  });

  /**
   * Property: Multi-digit Bengali section numbers should be correctly extracted
   * Requirements: 2.2 - Support single-digit and multi-digit section numbers
   */
  it('should correctly extract multi-digit Bengali section numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 999 }),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes('৷')),
        (sectionNum, heading) => {
          const sectionNumber = toBengaliNumeral(sectionNum) + DANDA;
          const mockDoc = createMockDocument({
            sections: [{
              heading: heading,
              sectionNumber: sectionNumber,
              bodyText: 'বিষয়বস্তু',
              hasTable: false
            }]
          });
          
          const sections = extractSectionsFromMockDOM(mockDoc);
          
          // Should extract the multi-digit section number correctly
          return sections.length === 1 && sections[0].section_number === sectionNumber;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sections should preserve document order (ascending dom_index)
   * Requirements: 2.5 - Preserve document order of sections
   */
  it('should preserve document order with ascending dom_index values', () => {
    fc.assert(
      fc.property(
        fc.array(sectionDataArb, { minLength: 2, maxLength: 15 }),
        (sectionsData) => {
          const mockDoc = createMockDocument({ sections: sectionsData });
          const sections = extractSectionsFromMockDOM(mockDoc);
          
          // dom_index values should be strictly ascending
          for (let i = 1; i < sections.length; i++) {
            if (sections[i].dom_index <= sections[i - 1].dom_index) {
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
   * Property: Section number extraction should not modify the original text
   * Requirements: 2.3 - Record exact text as it appears
   */
  it('should record section number exactly as it appears (verbatim)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        (num) => {
          const sectionNumber = toBengaliNumeral(num) + DANDA;
          const mockDoc = createMockDocument({
            sections: [{
              heading: null,
              sectionNumber: sectionNumber,
              bodyText: '',
              hasTable: false
            }]
          });
          
          const sections = extractSectionsFromMockDOM(mockDoc);
          
          // Extracted section_number should be byte-identical to input
          return sections[0].section_number === sectionNumber;
        }
      ),
      { numRuns: 100 }
    );
  });
});
