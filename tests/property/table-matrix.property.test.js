/**
 * Property-Based Tests for Table Matrix Parsing
 * 
 * Feature: bdlawcorpus-mode, Property 17: Table Matrix Parsing Integrity
 * Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.6, 24.7
 * 
 * Property: For any table with `rowspan` or `colspan` attributes, the matrix-based 
 * parser SHALL produce a 2D array where: cell positions are not shifted by merged cells, 
 * the logical grid structure is preserved, and whitespace is normalized
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

/**
 * Helper to create a mock table element with cells
 * @param {Array<Array<Object>>} rows - Array of rows, each containing cell objects
 *   Cell object: { content: string, rowspan?: number, colspan?: number, isHeader?: boolean }
 * @returns {Object} Mock table element
 */
function createMockTable(rows) {
  const mockRows = rows.map(rowCells => {
    const cells = rowCells.map(cell => ({
      textContent: cell.content,
      getAttribute: (attr) => {
        if (attr === 'rowspan' && cell.rowspan) return String(cell.rowspan);
        if (attr === 'colspan' && cell.colspan) return String(cell.colspan);
        return null;
      },
      tagName: cell.isHeader ? 'TH' : 'TD'
    }));

    return {
      querySelectorAll: (selector) => {
        if (selector === 'td, th') {
          return cells;
        }
        return [];
      }
    };
  });

  return {
    querySelectorAll: (selector) => {
      if (selector === 'tr') {
        return mockRows;
      }
      return [];
    }
  };
}

/**
 * Generator for simple cell content (no special whitespace)
 */
const cellContentArb = fc.string({ minLength: 0, maxLength: 50 });

/**
 * Generator for cell with optional rowspan/colspan
 */
const cellArb = fc.record({
  content: cellContentArb,
  rowspan: fc.option(fc.integer({ min: 1, max: 3 }), { nil: undefined }),
  colspan: fc.option(fc.integer({ min: 1, max: 3 }), { nil: undefined }),
  isHeader: fc.boolean()
});

/**
 * Generator for a simple table row (no spans)
 */
const simpleRowArb = (colCount) => fc.array(
  fc.record({
    content: cellContentArb,
    rowspan: fc.constant(undefined),
    colspan: fc.constant(undefined),
    isHeader: fc.boolean()
  }),
  { minLength: colCount, maxLength: colCount }
);

/**
 * Generator for a simple table (no merged cells)
 */
const simpleTableArb = fc.integer({ min: 1, max: 5 }).chain(colCount =>
  fc.array(simpleRowArb(colCount), { minLength: 1, maxLength: 5 })
);

describe('Property 17: Table Matrix Parsing Integrity', () => {

  /**
   * Property: Simple tables without merged cells should preserve all content
   * Requirements: 24.7 - Export table data as 2D array preserving row and column positions
   */
  it('should preserve all cell content in simple tables without merged cells', () => {
    fc.assert(
      fc.property(
        simpleTableArb,
        (tableData) => {
          const mockTable = createMockTable(tableData);
          const result = BDLawExtractor.extractTableWithMergedCells(mockTable);

          // Should have same number of rows
          if (result.rowCount !== tableData.length) return false;

          // Each cell content should be preserved (trimmed)
          for (let r = 0; r < tableData.length; r++) {
            for (let c = 0; c < tableData[r].length; c++) {
              const expected = tableData[r][c].content.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
              if (result.data[r][c] !== expected) return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tables with rowspan should not shift data in subsequent rows
   * Requirements: 24.1, 24.3 - Use matrix-based algorithm, no data shifting
   */
  it('should not shift cell data when rowspan spans multiple rows', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (cell1, cell2, cell3, cell4) => {
          // Create a 2x2 table where first cell has rowspan=2
          // Visual:
          // | cell1 (rowspan=2) | cell2 |
          // |                   | cell3 |
          // | cell4             | ...   |
          const tableData = [
            [{ content: cell1, rowspan: 2 }, { content: cell2 }],
            [{ content: cell3 }],  // Only one cell because first column is spanned
            [{ content: cell4 }, { content: 'extra' }]
          ];

          const mockTable = createMockTable(tableData);
          const result = BDLawExtractor.extractTableWithMergedCells(mockTable);

          // Row 0: cell1 in col 0, cell2 in col 1
          // Row 1: empty (merged) in col 0, cell3 in col 1
          // Row 2: cell4 in col 0, 'extra' in col 1
          const expected1 = cell1.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
          const expected2 = cell2.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
          const expected3 = cell3.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
          const expected4 = cell4.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');

          return result.data[0][0] === expected1 &&
                 result.data[0][1] === expected2 &&
                 result.data[1][0] === '' &&  // Merged cell position
                 result.data[1][1] === expected3 &&
                 result.data[2][0] === expected4;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tables with colspan should span content across columns
   * Requirements: 24.2 - Correctly span content across columns
   */
  it('should correctly span content across columns with colspan', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (cell1, cell2, cell3) => {
          // Create a table where first cell has colspan=2
          // Visual:
          // | cell1 (colspan=2)       |
          // | cell2       | cell3     |
          const tableData = [
            [{ content: cell1, colspan: 2 }],
            [{ content: cell2 }, { content: cell3 }]
          ];

          const mockTable = createMockTable(tableData);
          const result = BDLawExtractor.extractTableWithMergedCells(mockTable);

          const expected1 = cell1.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
          const expected2 = cell2.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
          const expected3 = cell3.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');

          // Row 0: cell1 in col 0, empty in col 1 (colspan)
          // Row 1: cell2 in col 0, cell3 in col 1
          return result.data[0][0] === expected1 &&
                 result.data[0][1] === '' &&  // Colspan fills with empty
                 result.data[1][0] === expected2 &&
                 result.data[1][1] === expected3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: hasMergedCells flag should be true when rowspan > 1 or colspan > 1
   * Requirements: 24.1, 24.2 - Track merged cells
   */
  it('should set hasMergedCells flag when table has rowspan or colspan', () => {
    // Table with rowspan
    const tableWithRowspan = [
      [{ content: 'A', rowspan: 2 }, { content: 'B' }],
      [{ content: 'C' }]
    ];
    const resultRowspan = BDLawExtractor.extractTableWithMergedCells(createMockTable(tableWithRowspan));
    expect(resultRowspan.hasMergedCells).toBe(true);

    // Table with colspan
    const tableWithColspan = [
      [{ content: 'A', colspan: 2 }],
      [{ content: 'B' }, { content: 'C' }]
    ];
    const resultColspan = BDLawExtractor.extractTableWithMergedCells(createMockTable(tableWithColspan));
    expect(resultColspan.hasMergedCells).toBe(true);

    // Table without merged cells
    const tableSimple = [
      [{ content: 'A' }, { content: 'B' }],
      [{ content: 'C' }, { content: 'D' }]
    ];
    const resultSimple = BDLawExtractor.extractTableWithMergedCells(createMockTable(tableSimple));
    expect(resultSimple.hasMergedCells).toBe(false);
  });

  /**
   * Property: Whitespace should be normalized (collapse multiple spaces, replace &nbsp;)
   * Requirements: 24.6 - Normalize whitespace within table cells
   */
  it('should normalize whitespace in cell content', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        (baseContent) => {
          // Add various whitespace patterns
          const contentWithSpaces = `  ${baseContent}   with   multiple   spaces  `;
          const contentWithNbsp = `${baseContent}\u00A0with\u00A0nbsp`;

          const tableData = [
            [{ content: contentWithSpaces }, { content: contentWithNbsp }]
          ];

          const mockTable = createMockTable(tableData);
          const result = BDLawExtractor.extractTableWithMergedCells(mockTable);

          // Multiple spaces should be collapsed to single space
          const hasMultipleSpaces = /\s{2,}/.test(result.data[0][0]);
          // &nbsp; should be replaced with regular space
          const hasNbsp = /\u00A0/.test(result.data[0][1]);

          return !hasMultipleSpaces && !hasNbsp;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Result should have correct rowCount and colCount
   * Requirements: 24.4, 24.7 - Preserve logical grid structure
   */
  it('should return correct rowCount and colCount', () => {
    fc.assert(
      fc.property(
        simpleTableArb,
        (tableData) => {
          const mockTable = createMockTable(tableData);
          const result = BDLawExtractor.extractTableWithMergedCells(mockTable);

          const expectedRowCount = tableData.length;
          const expectedColCount = tableData[0].length;

          return result.rowCount === expectedRowCount &&
                 result.colCount === expectedColCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All rows in result should have the same number of columns
   * Requirements: 24.4, 24.7 - Preserve logical grid structure
   */
  it('should produce rows with consistent column count', () => {
    fc.assert(
      fc.property(
        simpleTableArb,
        (tableData) => {
          const mockTable = createMockTable(tableData);
          const result = BDLawExtractor.extractTableWithMergedCells(mockTable);

          if (result.data.length === 0) return true;

          const colCount = result.colCount;
          return result.data.every(row => row.length === colCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty/null table should return empty result
   */
  it('should return empty result for null/undefined table', () => {
    const nullResult = BDLawExtractor.extractTableWithMergedCells(null);
    const undefinedResult = BDLawExtractor.extractTableWithMergedCells(undefined);

    expect(nullResult).toEqual({ data: [], hasMergedCells: false, rowCount: 0, colCount: 0 });
    expect(undefinedResult).toEqual({ data: [], hasMergedCells: false, rowCount: 0, colCount: 0 });
  });

  /**
   * Property: Combined rowspan and colspan should work correctly
   * Requirements: 24.1, 24.2 - Handle both rowspan and colspan
   */
  it('should handle combined rowspan and colspan correctly', () => {
    // Create a table with a cell that spans 2 rows and 2 columns
    // Visual:
    // | A (2x2)     |     | C |
    // |             |     | D |
    // | E           | F   | G |
    const tableData = [
      [{ content: 'A', rowspan: 2, colspan: 2 }, { content: 'C' }],
      [{ content: 'D' }],  // Only one cell, first two columns are spanned
      [{ content: 'E' }, { content: 'F' }, { content: 'G' }]
    ];

    const mockTable = createMockTable(tableData);
    const result = BDLawExtractor.extractTableWithMergedCells(mockTable);

    // Verify structure
    expect(result.rowCount).toBe(3);
    expect(result.colCount).toBe(3);
    expect(result.hasMergedCells).toBe(true);

    // Row 0: A in (0,0), empty in (0,1), C in (0,2)
    expect(result.data[0][0]).toBe('A');
    expect(result.data[0][1]).toBe('');
    expect(result.data[0][2]).toBe('C');

    // Row 1: empty in (1,0), empty in (1,1), D in (1,2)
    expect(result.data[1][0]).toBe('');
    expect(result.data[1][1]).toBe('');
    expect(result.data[1][2]).toBe('D');

    // Row 2: E in (2,0), F in (2,1), G in (2,2)
    expect(result.data[2][0]).toBe('E');
    expect(result.data[2][1]).toBe('F');
    expect(result.data[2][2]).toBe('G');
  });

  /**
   * Property: Bengali text should be preserved in table cells
   */
  it('should preserve Bengali text in table cells', () => {
    const bengaliContent = [
      [{ content: 'ধারা ১' }, { content: 'অধ্যায় ২' }],
      [{ content: 'তফসিল' }, { content: 'বিলুপ্ত' }]
    ];

    const mockTable = createMockTable(bengaliContent);
    const result = BDLawExtractor.extractTableWithMergedCells(mockTable);

    expect(result.data[0][0]).toBe('ধারা ১');
    expect(result.data[0][1]).toBe('অধ্যায় ২');
    expect(result.data[1][0]).toBe('তফসিল');
    expect(result.data[1][1]).toBe('বিলুপ্ত');
  });
});
