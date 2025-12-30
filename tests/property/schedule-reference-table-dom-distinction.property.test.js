/**
 * Property-Based Tests for Schedule Reference vs Table DOM Distinction
 * 
 * Feature: textual-fidelity-extraction, Property 6: Schedule Reference vs Table DOM Distinction
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 * 
 * For any DOM structure, if text contains "তফসিল" or "Schedule" references but no <table> DOM 
 * element exists, the extractor SHALL set missing_schedule: true and SHALL NOT classify the 
 * reference as a table_schedule numeric region. The schedule_reference_count and 
 * schedule_table_count SHALL be recorded separately and may differ.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');
const { JSDOM } = require('jsdom');

describe('Property 6: Schedule Reference vs Table DOM Distinction', () => {
  // Generator for Bengali schedule reference patterns
  const bengaliScheduleRefGen = fc.constantFrom(
    'তফসিল',
    'প্রথম তফসিল',
    'দ্বিতীয় তফসিল',
    'তৃতীয় তফসিল'
  );

  // Generator for English schedule reference patterns
  const englishScheduleRefGen = fc.constantFrom(
    'Schedule',
    'Schedule I',
    'Schedule II',
    'Schedule III',
    'First Schedule',
    'Second Schedule',
    'Third Schedule',
    'Appendix A',
    'Appendix B'
  );

  // Combined schedule reference generator
  const scheduleRefGen = fc.oneof(bengaliScheduleRefGen, englishScheduleRefGen);

  // Generator for simple table HTML
  const simpleTableGen = fc.tuple(
    fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[<>&"']/g, '')),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[<>&"']/g, ''))
  ).map(([cell1, cell2]) => 
    `<table><tr><td>${cell1}</td><td>${cell2}</td></tr></table>`
  );

  // Generator for legal text without schedule references
  const legalTextWithoutScheduleGen = fc.stringOf(
    fc.constantFrom('ধারা', 'অধ্যায়', 'Section', 'Chapter', ' ', '\n', '।', '.', '১', '২', '৩'),
    { minLength: 10, maxLength: 100 }
  );

  // Helper to create a mock DOM document
  function createMockDocument(bodyHtml) {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`);
    return dom.window.document;
  }

  /**
   * Property: Text references to schedules should be counted separately from table DOM
   * Requirements: 3.1, 3.5
   */
  it('should count schedule text references separately from table DOM elements', () => {
    fc.assert(
      fc.property(
        scheduleRefGen,
        fc.boolean(), // Whether to include a table
        (scheduleRef, includeTable) => {
          // Create content with schedule reference
          const textContent = `এই আইনের ${scheduleRef} অনুযায়ী নিম্নলিখিত বিধান প্রযোজ্য হইবে।`;
          
          // Create DOM with or without table
          let bodyHtml = `<div id="lawContent"><p>${textContent}</p>`;
          if (includeTable) {
            bodyHtml += '<table><tr><td>Data</td></tr></table>';
          }
          bodyHtml += '</div>';
          
          const document = createMockDocument(bodyHtml);
          const result = BDLawExtractor.detectScheduleDistinction(document, textContent);
          
          // Reference count should be at least 1 (we included a schedule reference)
          const hasReference = result.schedule_reference_count >= 1;
          
          // Table count should match whether we included a table
          const tableCountCorrect = includeTable 
            ? result.schedule_table_count >= 1 
            : result.schedule_table_count === 0;
          
          return hasReference && tableCountCorrect;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: missing_schedule should be true when references exist but no table DOM
   * Requirements: 3.2, 3.3
   */
  it('should set missing_schedule true when references exist but no table DOM', () => {
    fc.assert(
      fc.property(
        scheduleRefGen,
        (scheduleRef) => {
          // Create content with schedule reference but NO table in DOM
          const textContent = `See ${scheduleRef} for the complete list of items.`;
          const bodyHtml = `<div id="lawContent"><p>${textContent}</p></div>`;
          
          const document = createMockDocument(bodyHtml);
          const result = BDLawExtractor.detectScheduleDistinction(document, textContent);
          
          // Should have reference count > 0
          // Should have table count = 0
          // Should have missing_schedule = true
          return result.schedule_reference_count > 0 &&
                 result.schedule_table_count === 0 &&
                 result.missing_schedule === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: missing_schedule should be false when both references and tables exist
   * Requirements: 3.2
   */
  it('should set missing_schedule false when both references and tables exist', () => {
    fc.assert(
      fc.property(
        scheduleRefGen,
        simpleTableGen,
        (scheduleRef, tableHtml) => {
          // Create content with schedule reference AND table in DOM
          const textContent = `See ${scheduleRef} for details.`;
          const bodyHtml = `<div id="lawContent"><p>${textContent}</p>${tableHtml}</div>`;
          
          const document = createMockDocument(bodyHtml);
          const result = BDLawExtractor.detectScheduleDistinction(document, textContent);
          
          // Should have reference count > 0
          // Should have table count > 0
          // Should have missing_schedule = false
          return result.schedule_reference_count > 0 &&
                 result.schedule_table_count > 0 &&
                 result.missing_schedule === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: missing_schedule should be false when no references exist (regardless of tables)
   * Requirements: 3.2
   */
  it('should set missing_schedule false when no schedule references exist', () => {
    fc.assert(
      fc.property(
        legalTextWithoutScheduleGen,
        fc.boolean(), // Whether to include a table
        (legalText, includeTable) => {
          // Create content WITHOUT schedule reference
          let bodyHtml = `<div id="lawContent"><p>${legalText}</p>`;
          if (includeTable) {
            bodyHtml += '<table><tr><td>Data</td></tr></table>';
          }
          bodyHtml += '</div>';
          
          const document = createMockDocument(bodyHtml);
          const result = BDLawExtractor.detectScheduleDistinction(document, legalText);
          
          // If no references, missing_schedule should be false
          if (result.schedule_reference_count === 0) {
            return result.missing_schedule === false;
          }
          // If references were somehow detected, that's also valid
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: schedule_reference_count and schedule_table_count should be recorded separately
   * Requirements: 3.5, 3.6
   */
  it('should record schedule_reference_count and schedule_table_count as separate fields', () => {
    fc.assert(
      fc.property(
        fc.array(scheduleRefGen, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 3 }), // Number of tables to include
        (scheduleRefs, tableCount) => {
          // Create content with multiple schedule references
          const textContent = scheduleRefs.map(ref => `See ${ref} for details.`).join(' ');
          
          // Create DOM with specified number of tables
          let bodyHtml = `<div id="lawContent"><p>${textContent}</p>`;
          for (let i = 0; i < tableCount; i++) {
            bodyHtml += `<table><tr><td>Table ${i + 1}</td></tr></table>`;
          }
          bodyHtml += '</div>';
          
          const document = createMockDocument(bodyHtml);
          const result = BDLawExtractor.detectScheduleDistinction(document, textContent);
          
          // Both counts should be numbers
          const hasReferenceCount = typeof result.schedule_reference_count === 'number';
          const hasTableCount = typeof result.schedule_table_count === 'number';
          
          // Counts can differ (this is the key property)
          // Reference count should be >= 1 (we included references)
          // Table count should match what we added
          const referenceCountValid = result.schedule_reference_count >= 1;
          const tableCountValid = result.schedule_table_count === tableCount;
          
          return hasReferenceCount && hasTableCount && referenceCountValid && tableCountValid;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Text references should be tracked separately from table_schedule numeric regions
   * Requirements: 3.3, 3.6
   * 
   * This test verifies that schedule text references are tracked via schedule_reference_count
   * which is separate from numeric region detection. The distinction allows downstream
   * consumers to differentiate between text mentions and actual table content.
   */
  it('should track text references separately via schedule_reference_count', () => {
    fc.assert(
      fc.property(
        scheduleRefGen,
        (scheduleRef) => {
          // Create content with schedule reference but NO actual table
          const textContent = `According to ${scheduleRef}, the following rates apply.`;
          const bodyHtml = `<div id="lawContent"><p>${textContent}</p></div>`;
          
          const document = createMockDocument(bodyHtml);
          const result = BDLawExtractor.detectScheduleDistinction(document, textContent);
          
          // Text references should be counted in schedule_reference_count
          // Table count should be 0 (no actual tables)
          // missing_schedule should be true (reference exists but no table)
          return result.schedule_reference_count > 0 &&
                 result.schedule_table_count === 0 &&
                 result.missing_schedule === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: countScheduleReferences should return accurate positions
   * Requirements: 3.1
   */
  it('should return accurate positions for detected schedule references', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\n', '.', ','), { minLength: 5, maxLength: 50 }),
        scheduleRefGen,
        fc.stringOf(fc.constantFrom(' ', '\n', '.', ','), { minLength: 5, maxLength: 50 }),
        (prefix, scheduleRef, suffix) => {
          const content = prefix + scheduleRef + suffix;
          const expectedPosition = prefix.length;
          
          const result = BDLawExtractor.countScheduleReferences(content);
          
          // Should detect the reference
          if (result.schedule_reference_count === 0) {
            return false;
          }
          
          // Position should be accurate (within a small tolerance for pattern variations)
          const positionAccurate = result.references.some(
            ref => Math.abs(ref.position - expectedPosition) <= 5
          );
          
          return positionAccurate;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: countScheduleTableDOM should count unique tables only
   * Requirements: 3.5
   */
  it('should count unique table DOM elements without duplicates', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (tableCount) => {
          // Create DOM with specified number of unique tables
          let bodyHtml = '<div id="lawContent">';
          for (let i = 0; i < tableCount; i++) {
            bodyHtml += `<table id="table${i}"><tr><td>Unique ${i}</td></tr></table>`;
          }
          bodyHtml += '</div>';
          
          const document = createMockDocument(bodyHtml);
          const result = BDLawExtractor.countScheduleTableDOM(document);
          
          // Should count exactly the number of unique tables
          return result.schedule_table_count === tableCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null inputs should return zero counts
   * Requirements: 3.1, 3.5
   */
  it('should return zero counts for empty or null inputs', () => {
    // Test countScheduleReferences with empty/null
    const emptyRefResult = BDLawExtractor.countScheduleReferences('');
    const nullRefResult = BDLawExtractor.countScheduleReferences(null);
    
    expect(emptyRefResult.schedule_reference_count).toBe(0);
    expect(nullRefResult.schedule_reference_count).toBe(0);
    
    // Test countScheduleTableDOM with null
    const nullTableResult = BDLawExtractor.countScheduleTableDOM(null);
    expect(nullTableResult.schedule_table_count).toBe(0);
    
    // Test detectScheduleDistinction with null document
    const nullDistinctionResult = BDLawExtractor.detectScheduleDistinction(null, 'তফসিল');
    expect(nullDistinctionResult.schedule_table_count).toBe(0);
    expect(nullDistinctionResult.schedule_reference_count).toBeGreaterThan(0);
    expect(nullDistinctionResult.missing_schedule).toBe(true);
  });

  /**
   * Property: Bengali schedule references should be detected correctly
   * Requirements: 3.1
   */
  it('should detect Bengali schedule references correctly', () => {
    fc.assert(
      fc.property(
        bengaliScheduleRefGen,
        (scheduleRef) => {
          const content = `এই আইনের ${scheduleRef} দেখুন।`;
          const result = BDLawExtractor.countScheduleReferences(content);
          
          return result.schedule_reference_count >= 1 &&
                 result.references.some(ref => ref.text.includes('তফসিল'));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: English schedule references should be detected correctly
   * Requirements: 3.1
   */
  it('should detect English schedule references correctly', () => {
    fc.assert(
      fc.property(
        englishScheduleRefGen,
        (scheduleRef) => {
          const content = `Please refer to ${scheduleRef} for more details.`;
          const result = BDLawExtractor.countScheduleReferences(content);
          
          return result.schedule_reference_count >= 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple schedule references in same content should all be counted
   * Requirements: 3.1, 3.5
   */
  it('should count multiple schedule references in same content', () => {
    fc.assert(
      fc.property(
        fc.tuple(bengaliScheduleRefGen, englishScheduleRefGen),
        ([bengaliRef, englishRef]) => {
          // Create content with both Bengali and English references
          const content = `See ${englishRef} and also ${bengaliRef} for complete information.`;
          const result = BDLawExtractor.countScheduleReferences(content);
          
          // Should detect at least 2 references (one Bengali, one English)
          // Note: Some patterns may overlap, so we check for >= 2
          return result.schedule_reference_count >= 2;
        }
      ),
      { numRuns: 100 }
    );
  });
});
