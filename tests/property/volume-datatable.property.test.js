/**
 * Property-Based Tests for Volume DataTable Extraction
 * 
 * Feature: bdlawcorpus-mode, Property 14: Volume DataTable Extraction Accuracy
 * Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.6
 * 
 * Property: For any Volume page with a `table.table-search` DataTable, the extractor 
 * SHALL extract all rows preserving: Cell 0 (year/ID), Cell 1 (title with URL from anchor), 
 * Cell 2 (act number), and the original row order
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

/**
 * Helper to create a mock DOM document with DataTable structure
 * @param {Array} rows - Array of row data { title, actNumber, actId }
 * @returns {Object} Mock document object
 */
function createMockDocument(rows) {
  const mockRows = rows.map((row, index) => {
    const cells = [
      // Cell 0: Hidden year/ID
      { 
        querySelector: () => null,
        textContent: row.year || ''
      },
      // Cell 1: Title with anchor link
      {
        querySelector: (selector) => {
          if (selector === 'a') {
            return {
              getAttribute: (attr) => {
                if (attr === 'href') return row.href || `/act-${row.actId}.html`;
                return null;
              },
              textContent: row.title
            };
          }
          return null;
        },
        textContent: row.title
      },
      // Cell 2: Act number
      {
        querySelector: (selector) => {
          if (selector === 'a') {
            return {
              textContent: row.actNumber
            };
          }
          return null;
        },
        textContent: row.actNumber
      }
    ];

    return {
      querySelectorAll: (selector) => {
        if (selector === 'td') return cells;
        return [];
      }
    };
  });

  return {
    querySelectorAll: (selector) => {
      if (selector === 'table.table-search tbody tr') {
        return mockRows;
      }
      return [];
    }
  };
}

describe('Property 14: Volume DataTable Extraction Accuracy', () => {
  /**
   * Generator for valid act data
   */
  const actDataArb = fc.record({
    title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    actNumber: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    actId: fc.integer({ min: 1, max: 99999 }).map(n => n.toString()),
    year: fc.integer({ min: 1900, max: 2100 }).map(n => n.toString())
  });

  /**
   * Property: All rows from DataTable should be extracted
   * Requirements: 22.1 - Target table.table-search tbody tr structure
   */
  it('should extract all rows from DataTable', () => {
    fc.assert(
      fc.property(
        fc.array(actDataArb, { minLength: 1, maxLength: 20 }),
        (rowsData) => {
          const mockDoc = createMockDocument(rowsData);
          const result = BDLawExtractor.extractVolumeFromDataTable(mockDoc);
          
          // Should extract same number of rows
          return result.length === rowsData.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Extracted titles should match input titles (after trimming)
   * Requirements: 22.2 - Extract Cell 1 (title with anchor)
   */
  it('should preserve titles from Cell 1 anchor text', () => {
    fc.assert(
      fc.property(
        fc.array(actDataArb, { minLength: 1, maxLength: 20 }),
        (rowsData) => {
          const mockDoc = createMockDocument(rowsData);
          const result = BDLawExtractor.extractVolumeFromDataTable(mockDoc);
          
          // Each extracted title should match input (trimmed)
          return result.every((act, index) => act.title === rowsData[index].title.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Extracted act numbers should match input (after trimming)
   * Requirements: 22.2 - Extract Cell 2 (act number)
   */
  it('should preserve act numbers from Cell 2', () => {
    fc.assert(
      fc.property(
        fc.array(actDataArb, { minLength: 1, maxLength: 20 }),
        (rowsData) => {
          const mockDoc = createMockDocument(rowsData);
          const result = BDLawExtractor.extractVolumeFromDataTable(mockDoc);
          
          // Each extracted actNumber should match input (trimmed)
          return result.every((act, index) => act.actNumber === rowsData[index].actNumber.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Act ID should be extracted from URL pattern
   * Requirements: 22.4 - Extract act ID from href attribute pattern /act-{ID}.html
   */
  it('should extract act ID from URL pattern /act-{ID}.html', () => {
    fc.assert(
      fc.property(
        fc.array(actDataArb, { minLength: 1, maxLength: 20 }),
        (rowsData) => {
          const mockDoc = createMockDocument(rowsData);
          const result = BDLawExtractor.extractVolumeFromDataTable(mockDoc);
          
          // Each extracted ID should match the actId from input
          return result.every((act, index) => act.id === rowsData[index].actId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Original row order should be preserved via rowIndex
   * Requirements: 22.6 - Preserve original row order from DataTable
   */
  it('should preserve original row order with rowIndex property', () => {
    fc.assert(
      fc.property(
        fc.array(actDataArb, { minLength: 1, maxLength: 20 }),
        (rowsData) => {
          const mockDoc = createMockDocument(rowsData);
          const result = BDLawExtractor.extractVolumeFromDataTable(mockDoc);
          
          // Each rowIndex should match the original position
          return result.every((act, index) => act.rowIndex === index);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty document should return empty array
   */
  it('should return empty array for null/undefined document', () => {
    expect(BDLawExtractor.extractVolumeFromDataTable(null)).toEqual([]);
    expect(BDLawExtractor.extractVolumeFromDataTable(undefined)).toEqual([]);
  });

  /**
   * Property: Document with no matching table should return empty array
   */
  it('should return empty array when no DataTable found', () => {
    const emptyDoc = {
      querySelectorAll: () => []
    };
    expect(BDLawExtractor.extractVolumeFromDataTable(emptyDoc)).toEqual([]);
  });

  /**
   * Property: Rows with fewer than 3 cells should be skipped
   */
  it('should skip rows with fewer than 3 cells', () => {
    const mockDoc = {
      querySelectorAll: (selector) => {
        if (selector === 'table.table-search tbody tr') {
          return [
            { querySelectorAll: () => [{ querySelector: () => null }] }, // 1 cell
            { querySelectorAll: () => [{ querySelector: () => null }, { querySelector: () => null }] } // 2 cells
          ];
        }
        return [];
      }
    };
    
    expect(BDLawExtractor.extractVolumeFromDataTable(mockDoc)).toEqual([]);
  });

  /**
   * Property: Rows without anchor in Cell 1 should be skipped
   */
  it('should skip rows without anchor in Cell 1', () => {
    const mockDoc = {
      querySelectorAll: (selector) => {
        if (selector === 'table.table-search tbody tr') {
          return [{
            querySelectorAll: (sel) => {
              if (sel === 'td') {
                return [
                  { querySelector: () => null },
                  { querySelector: () => null }, // No anchor
                  { querySelector: () => ({ textContent: '123' }) }
                ];
              }
              return [];
            }
          }];
        }
        return [];
      }
    };
    
    expect(BDLawExtractor.extractVolumeFromDataTable(mockDoc)).toEqual([]);
  });
});
