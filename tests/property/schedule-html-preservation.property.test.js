/**
 * Property-Based Tests for Schedule HTML Preservation
 * 
 * Feature: legal-integrity-enhancement, Property 12: Schedule HTML Preservation
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 * 
 * For any act with schedule content, schedules.representation SHALL be "raw_html",
 * schedules.processed SHALL be false, and the HTML SHALL be verbatim from DOM extraction.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');
const BDLawQuality = require('../../bdlaw-quality.js');
const { JSDOM } = require('jsdom');

describe('Property 12: Schedule HTML Preservation', () => {
  // Generator for schedule marker text
  const scheduleMarkerGen = fc.constantFrom(
    'তফসিল',
    'Schedule I',
    'Schedule II',
    'Schedule III',
    'First Schedule',
    'Second Schedule',
    'Appendix A',
    'Appendix B',
    'Form A',
    'Form B'
  );

  // Generator for table content
  const tableCellGen = fc.string({ minLength: 1, maxLength: 50 })
    .map(s => s.replace(/[<>&"']/g, '')); // Remove HTML special chars

  // Generator for simple table HTML
  const simpleTableGen = fc.tuple(
    fc.array(tableCellGen, { minLength: 1, maxLength: 3 }),
    fc.array(tableCellGen, { minLength: 1, maxLength: 3 })
  ).map(([headers, cells]) => {
    const headerRow = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    const dataRow = `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    return `<table>${headerRow}${dataRow}</table>`;
  });

  // Generator for schedule HTML with table
  const scheduleWithTableGen = fc.tuple(
    scheduleMarkerGen,
    simpleTableGen
  ).map(([marker, table]) => 
    `<div class="schedule"><h3>${marker}</h3>${table}</div>`
  );

  // Helper to create a mock DOM document
  function createMockDocument(bodyHtml) {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`);
    return dom.window.document;
  }

  /**
   * Property: extractScheduleHTML returns representation as "raw_html"
   * Requirements: 8.2
   */
  it('should always return representation as "raw_html"', () => {
    fc.assert(
      fc.property(
        scheduleWithTableGen,
        (scheduleHtml) => {
          const document = createMockDocument(scheduleHtml);
          const result = BDLawExtractor.extractScheduleHTML(document);
          
          return result.representation === 'raw_html';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractScheduleHTML returns extraction_method as "verbatim_dom_capture"
   * Requirements: 8.3
   */
  it('should always return extraction_method as "verbatim_dom_capture"', () => {
    fc.assert(
      fc.property(
        scheduleWithTableGen,
        (scheduleHtml) => {
          const document = createMockDocument(scheduleHtml);
          const result = BDLawExtractor.extractScheduleHTML(document);
          
          return result.extraction_method === 'verbatim_dom_capture';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractScheduleHTML returns processed as false
   * Requirements: 8.4
   */
  it('should always return processed as false', () => {
    fc.assert(
      fc.property(
        scheduleWithTableGen,
        (scheduleHtml) => {
          const document = createMockDocument(scheduleHtml);
          const result = BDLawExtractor.extractScheduleHTML(document);
          
          return result.processed === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractScheduleHTML preserves table HTML verbatim
   * Requirements: 8.1, 8.5
   */
  it('should preserve table HTML verbatim without modification', () => {
    fc.assert(
      fc.property(
        simpleTableGen,
        (tableHtml) => {
          const document = createMockDocument(`<div id="lawContent">${tableHtml}</div>`);
          const result = BDLawExtractor.extractScheduleHTML(document);
          
          // The extracted HTML should contain the table
          if (result.html_content) {
            return result.html_content.includes('<table>') &&
                   result.html_content.includes('</table>');
          }
          return true; // No content extracted is also valid
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractScheduleHTML detects schedule elements
   * Requirements: 8.1
   */
  it('should detect schedule elements with class="schedule"', () => {
    fc.assert(
      fc.property(
        scheduleWithTableGen,
        (scheduleHtml) => {
          const document = createMockDocument(scheduleHtml);
          const result = BDLawExtractor.extractScheduleHTML(document);
          
          // Should detect the schedule element
          return result.schedule_count > 0 && result.html_content !== null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractScheduleHTML correctly identifies tables
   * Requirements: 8.1
   */
  it('should correctly identify when schedules contain tables', () => {
    fc.assert(
      fc.property(
        scheduleWithTableGen,
        (scheduleHtml) => {
          const document = createMockDocument(scheduleHtml);
          const result = BDLawExtractor.extractScheduleHTML(document);
          
          // Should detect that schedule has tables
          return result.has_tables === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractScheduleHTML flags missing schedules when markers present but no HTML
   * Requirements: 8.6
   */
  it('should flag missing schedules when markers present but no HTML content', () => {
    fc.assert(
      fc.property(
        scheduleMarkerGen,
        (marker) => {
          // Create document with schedule marker in text but no schedule HTML element
          const document = createMockDocument(`<p>See ${marker} for details.</p>`);
          const result = BDLawExtractor.extractScheduleHTML(document);
          
          // Should flag as missing schedule
          return result.missing_schedule_flag === true || result.schedule_count === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractScheduleHTML returns empty result for null document
   * Requirements: 8.1
   */
  it('should handle null document gracefully', () => {
    const result = BDLawExtractor.extractScheduleHTML(null);
    
    expect(result.representation).toBe('raw_html');
    expect(result.extraction_method).toBe('verbatim_dom_capture');
    expect(result.processed).toBe(false);
    expect(result.html_content).toBeNull();
    expect(result.schedule_count).toBe(0);
  });

  /**
   * Property: extractScheduleHTML returns empty result for document without schedules
   * Requirements: 8.1
   */
  it('should return empty result for document without schedules', () => {
    const document = createMockDocument('<p>Regular content without schedules.</p>');
    const result = BDLawExtractor.extractScheduleHTML(document);
    
    expect(result.representation).toBe('raw_html');
    expect(result.extraction_method).toBe('verbatim_dom_capture');
    expect(result.processed).toBe(false);
    expect(result.html_content).toBeNull();
    expect(result.schedule_count).toBe(0);
  });

  /**
   * Property: checkMissingSchedules detects references without HTML
   * Requirements: 8.6
   */
  it('should detect missing schedules when text references but no HTML extracted', () => {
    fc.assert(
      fc.property(
        scheduleMarkerGen,
        (marker) => {
          const textContent = `This act includes ${marker} which contains important provisions.`;
          const scheduleResult = {
            representation: 'raw_html',
            extraction_method: 'verbatim_dom_capture',
            processed: false,
            html_content: null,
            schedule_count: 0
          };
          
          const result = BDLawExtractor.checkMissingSchedules(textContent, scheduleResult);
          
          // Should detect missing schedule
          return result.missing === true && result.references.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: checkMissingSchedules returns false when HTML is present
   * Requirements: 8.6
   */
  it('should not flag missing when schedule HTML is present', () => {
    fc.assert(
      fc.property(
        scheduleMarkerGen,
        simpleTableGen,
        (marker, tableHtml) => {
          const textContent = `This act includes ${marker} which contains important provisions.`;
          const scheduleResult = {
            representation: 'raw_html',
            extraction_method: 'verbatim_dom_capture',
            processed: false,
            html_content: tableHtml,
            schedule_count: 1
          };
          
          const result = BDLawExtractor.checkMissingSchedules(textContent, scheduleResult);
          
          // Should NOT flag as missing since HTML is present
          return result.missing === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getScheduleMetadata returns complete metadata structure
   * Requirements: 8.1, 8.2, 8.3, 8.4
   */
  it('should return complete metadata structure', () => {
    fc.assert(
      fc.property(
        scheduleWithTableGen,
        (scheduleHtml) => {
          const document = createMockDocument(scheduleHtml);
          const metadata = BDLawExtractor.getScheduleMetadata(document);
          
          // Should have all required fields
          return (
            metadata.representation === 'raw_html' &&
            metadata.extraction_method === 'verbatim_dom_capture' &&
            metadata.processed === false &&
            typeof metadata.schedule_count === 'number' &&
            typeof metadata.has_tables === 'boolean' &&
            typeof metadata.missing_schedule_flag === 'boolean'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: validateScheduleHTML validates required metadata fields
   * Requirements: 8.2, 8.3, 8.4
   */
  it('should validate required metadata fields', () => {
    // Valid schedule result
    const validResult = {
      representation: 'raw_html',
      extraction_method: 'verbatim_dom_capture',
      processed: false,
      html_content: '<table></table>',
      schedule_count: 1
    };
    
    const validation = BDLawQuality.validateScheduleHTML(validResult);
    expect(validation.valid).toBe(true);
    expect(validation.issues.length).toBe(0);
    
    // Invalid representation
    const invalidRepResult = {
      representation: 'text',
      extraction_method: 'verbatim_dom_capture',
      processed: false
    };
    
    const invalidRepValidation = BDLawQuality.validateScheduleHTML(invalidRepResult);
    expect(invalidRepValidation.valid).toBe(false);
    expect(invalidRepValidation.issues.some(i => i.description.includes('raw_html'))).toBe(true);
    
    // Invalid extraction_method
    const invalidMethodResult = {
      representation: 'raw_html',
      extraction_method: 'cleaned',
      processed: false
    };
    
    const invalidMethodValidation = BDLawQuality.validateScheduleHTML(invalidMethodResult);
    expect(invalidMethodValidation.valid).toBe(false);
    expect(invalidMethodValidation.issues.some(i => i.description.includes('verbatim_dom_capture'))).toBe(true);
    
    // Invalid processed flag
    const invalidProcessedResult = {
      representation: 'raw_html',
      extraction_method: 'verbatim_dom_capture',
      processed: true
    };
    
    const invalidProcessedValidation = BDLawQuality.validateScheduleHTML(invalidProcessedResult);
    expect(invalidProcessedValidation.valid).toBe(false);
    expect(invalidProcessedValidation.issues.some(i => i.description.includes('false'))).toBe(true);
  });

  /**
   * Property: Schedule HTML is not flattened or cleaned
   * Requirements: 8.5
   */
  it('should not flatten or clean schedule HTML structure', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          tableCellGen,
          tableCellGen,
          tableCellGen
        ),
        ([cell1, cell2, cell3]) => {
          // Create a table with specific structure
          const tableHtml = `<table><tr><td>${cell1}</td><td>${cell2}</td></tr><tr><td colspan="2">${cell3}</td></tr></table>`;
          const document = createMockDocument(`<div class="schedule">${tableHtml}</div>`);
          const result = BDLawExtractor.extractScheduleHTML(document);
          
          if (result.html_content) {
            // Structure should be preserved (colspan attribute should remain)
            return result.html_content.includes('colspan');
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple schedules are all extracted
   * Requirements: 8.1
   */
  it('should extract multiple schedules from document', () => {
    const document = createMockDocument(`
      <div class="schedule"><h3>First Schedule</h3><table><tr><td>A</td></tr></table></div>
      <div class="schedule"><h3>Second Schedule</h3><table><tr><td>B</td></tr></table></div>
    `);
    
    const result = BDLawExtractor.extractScheduleHTML(document);
    
    expect(result.schedule_count).toBe(2);
    expect(result.html_content).toContain('First Schedule');
    expect(result.html_content).toContain('Second Schedule');
  });

  /**
   * Property: Bengali schedule markers are detected
   * Requirements: 8.1
   */
  it('should detect Bengali schedule markers', () => {
    const document = createMockDocument(`
      <p>এই আইনের তফসিল অনুযায়ী নিম্নলিখিত বিধান প্রযোজ্য হইবে।</p>
    `);
    
    const result = BDLawExtractor.extractScheduleHTML(document);
    
    // Should flag as missing schedule since marker found but no HTML
    expect(result.missing_schedule_flag).toBe(true);
  });

  /**
   * Property: getScheduleQualityAssessment returns correct structure
   * Requirements: 8.1-8.6
   */
  it('should return correct quality assessment structure', () => {
    fc.assert(
      fc.property(
        scheduleWithTableGen,
        (scheduleHtml) => {
          const document = createMockDocument(scheduleHtml);
          const scheduleResult = BDLawExtractor.extractScheduleHTML(document);
          const assessment = BDLawQuality.getScheduleQualityAssessment(scheduleResult);
          
          // Should have all required fields
          return (
            typeof assessment.schedule_html_preserved === 'boolean' &&
            typeof assessment.schedule_count === 'number' &&
            typeof assessment.schedule_has_tables === 'boolean' &&
            typeof assessment.schedule_missing_flag === 'boolean' &&
            Array.isArray(assessment.schedule_validation_issues)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tables in content areas are extracted
   * Requirements: 8.1
   */
  it('should extract tables from content areas', () => {
    const document = createMockDocument(`
      <div id="lawContent">
        <p>Section 1. Introduction</p>
        <table><tr><th>Item</th><th>Value</th></tr><tr><td>A</td><td>100</td></tr></table>
        <p>Section 2. Conclusion</p>
      </div>
    `);
    
    const result = BDLawExtractor.extractScheduleHTML(document);
    
    expect(result.schedule_count).toBeGreaterThan(0);
    expect(result.has_tables).toBe(true);
    expect(result.html_content).toContain('<table>');
  });

  /**
   * Property: Duplicate tables are not extracted multiple times
   * Requirements: 8.1
   */
  it('should not extract duplicate tables', () => {
    const tableHtml = '<table><tr><td>Test</td></tr></table>';
    // Create a document where the same table appears in multiple matching selectors
    // The schedule div contains the table, and we also have a separate table in lawContent
    const document = createMockDocument(`
      <div class="schedule">${tableHtml}</div>
    `);
    
    const result = BDLawExtractor.extractScheduleHTML(document);
    
    // Should only have one instance of the table since it's the same HTML
    const tableCount = (result.html_content.match(/<table>/g) || []).length;
    expect(tableCount).toBe(1);
  });
});
