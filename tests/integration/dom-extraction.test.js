/**
 * Integration Tests for DOM Structure Extraction
 * 
 * Tests the new DOM extraction methods for:
 * - Volume DataTable extraction (Requirements: 22.1-22.6)
 * - Act section-row extraction (Requirements: 23.1-23.7)
 * - Table parsing with rowspan/colspan (Requirements: 24.1-24.7)
 * - Amendment marker detection (Requirements: 25.1-25.4)
 */

const BDLawExtractor = require('../../bdlaw-extractor.js');
const { JSDOM } = require('jsdom');

describe('DOM Structure Extraction Integration Tests', () => {
  const ALLOWED_ORIGIN = 'http://bdlaws.minlaw.gov.bd';

  describe('Volume DataTable Extraction (Requirements: 22.1-22.6)', () => {
    /**
     * Test: DataTable extraction with real volume page structure
     * Requirements: 22.1 - Target table.table-search tbody tr structure
     */
    it('should extract acts from DataTable structure', () => {
      const volumeHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <table class="table-search">
            <tbody>
              <tr>
                <td>২০২৫</td>
                <td><a href="/act-1514.html">মূল্য সংযোজন কর ও সম্পূরক শুল্ক (সংশোধন) অধ্যাদেশ, ২০২৫</a></td>
                <td><a href="/act-1514.html">০১</a></td>
              </tr>
              <tr>
                <td>২০২৫</td>
                <td><a href="/act-1515.html">The Excises and Salt (Amendment) Ordinance, 2025</a></td>
                <td><a href="/act-1515.html">০২</a></td>
              </tr>
              <tr>
                <td>২০২৫</td>
                <td><a href="/act-1516.html">সুপ্রীম কোর্টের বিচারক নিয়োগ অধ্যাদেশ, ২০২৫</a></td>
                <td><a href="/act-1516.html">০৩</a></td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;
      const dom = new JSDOM(volumeHtml);
      const result = BDLawExtractor.extractVolumeFromDataTable(dom.window.document);

      // Requirements: 22.1 - Should extract all rows
      expect(result.length).toBe(3);

      // Requirements: 22.2 - Should extract title from Cell 1 anchor
      expect(result[0].title).toBe('মূল্য সংযোজন কর ও সম্পূরক শুল্ক (সংশোধন) অধ্যাদেশ, ২০২৫');
      expect(result[1].title).toBe('The Excises and Salt (Amendment) Ordinance, 2025');

      // Requirements: 22.2 - Should extract act number from Cell 2
      expect(result[0].actNumber).toBe('০১');
      expect(result[1].actNumber).toBe('০২');

      // Requirements: 22.4 - Should extract act ID from URL pattern
      expect(result[0].id).toBe('1514');
      expect(result[1].id).toBe('1515');
      expect(result[2].id).toBe('1516');

      // Requirements: 22.6 - Should preserve original row order
      expect(result[0].rowIndex).toBe(0);
      expect(result[1].rowIndex).toBe(1);
      expect(result[2].rowIndex).toBe(2);
    });

    /**
     * Test: URL normalization for relative URLs
     * Requirements: 22.5 - Normalize relative URLs to absolute
     */
    it('should normalize relative URLs to absolute URLs', () => {
      const volumeHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <table class="table-search">
            <tbody>
              <tr>
                <td>২০২৫</td>
                <td><a href="/act-1514.html">Test Act 1</a></td>
                <td><a href="/act-1514.html">০১</a></td>
              </tr>
              <tr>
                <td>২০২৫</td>
                <td><a href="act-1515.html">Test Act 2</a></td>
                <td><a href="act-1515.html">০২</a></td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;
      const dom = new JSDOM(volumeHtml);
      const result = BDLawExtractor.extractVolumeFromDataTable(dom.window.document);

      // Requirements: 22.5 - All URLs should be absolute
      expect(result[0].url).toBe(`${ALLOWED_ORIGIN}/act-1514.html`);
      expect(result[1].url).toBe(`${ALLOWED_ORIGIN}/act-1515.html`);
    });

    /**
     * Test: Empty DataTable handling
     */
    it('should return empty array for empty DataTable', () => {
      const emptyHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <table class="table-search">
            <tbody></tbody>
          </table>
        </body>
        </html>
      `;
      const dom = new JSDOM(emptyHtml);
      const result = BDLawExtractor.extractVolumeFromDataTable(dom.window.document);

      expect(result).toEqual([]);
    });
  });


  describe('Act Section-Row Extraction (Requirements: 23.1-23.7)', () => {
    /**
     * Test: Section-row extraction with real act page structure
     * Requirements: 23.1-23.7 - Act Content DOM Structure Extraction
     */
    it('should extract sections from .lineremoves row structure', () => {
      const actHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="boxed-layout">
            <div class="bg-act-section">বাংলাদেশ শ্রম আইন, ২০০৬</div>
            <div class="lineremoves">
              <div class="col-sm-3 txt-head">ধারা ১</div>
              <div class="col-sm-9 txt-details">সংক্ষিপ্ত শিরোনাম ও প্রবর্তন।</div>
            </div>
            <div class="lineremoves">
              <div class="col-sm-3 txt-head">ধারা ২</div>
              <div class="col-sm-9 txt-details">সংজ্ঞা।</div>
            </div>
            <div class="lineremoves">
              <div class="col-sm-3 txt-head">ধারা ৩</div>
              <div class="col-sm-9 txt-details">শ্রমিকের সংজ্ঞা।</div>
            </div>
          </div>
        </body>
        </html>
      `;
      const dom = new JSDOM(actHtml);
      const result = BDLawExtractor.extractActFromSectionRows(dom.window.document);

      // Requirements: 23.2 - Should extract metadata from .bg-act-section
      expect(result.metadata).toBe('বাংলাদেশ শ্রম আইন, ২০০৬');

      // Requirements: 23.3 - Should extract all section rows
      expect(result.sections.length).toBe(3);

      // Requirements: 23.4 - Should extract section title from .txt-head
      expect(result.sections[0].sectionTitle).toBe('ধারা ১');
      expect(result.sections[1].sectionTitle).toBe('ধারা ২');

      // Requirements: 23.5 - Should extract section body from .txt-details
      expect(result.sections[0].sectionBody).toBe('সংক্ষিপ্ত শিরোনাম ও প্রবর্তন।');
      expect(result.sections[1].sectionBody).toBe('সংজ্ঞা।');

      // Requirements: 23.6, 23.7 - Should preserve title-body association and order
      expect(result.sections[0].index).toBe(0);
      expect(result.sections[1].index).toBe(1);
      expect(result.sections[2].index).toBe(2);
    });

    /**
     * Test: Section with table detection
     * Requirements: 23.7 - Track hasTable flag for sections containing tables
     */
    it('should detect sections containing tables', () => {
      const actHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="boxed-layout">
            <div class="lineremoves">
              <div class="col-sm-3 txt-head">ধারা ১</div>
              <div class="col-sm-9 txt-details">Text without table</div>
            </div>
            <div class="lineremoves">
              <div class="col-sm-3 txt-head">তফসিল</div>
              <div class="col-sm-9 txt-details">
                <table><tr><td>Data</td></tr></table>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      const dom = new JSDOM(actHtml);
      const result = BDLawExtractor.extractActFromSectionRows(dom.window.document);

      expect(result.sections[0].hasTable).toBe(false);
      expect(result.sections[1].hasTable).toBe(true);
    });

    /**
     * Test: Missing container handling
     */
    it('should return empty result when .boxed-layout not found', () => {
      const noContainerHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="other-container">Content</div>
        </body>
        </html>
      `;
      const dom = new JSDOM(noContainerHtml);
      const result = BDLawExtractor.extractActFromSectionRows(dom.window.document);

      expect(result.metadata).toBeNull();
      expect(result.sections).toEqual([]);
    });
  });


  describe('Table Parsing with Merged Cells (Requirements: 24.1-24.7)', () => {
    /**
     * Test: Simple table without merged cells
     * Requirements: 24.7 - Export table data as 2D array
     */
    it('should parse simple table without merged cells', () => {
      const tableHtml = `
        <table class="table-bordered">
          <tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr>
          <tr><td>A1</td><td>A2</td><td>A3</td></tr>
          <tr><td>B1</td><td>B2</td><td>B3</td></tr>
        </table>
      `;
      const dom = new JSDOM(tableHtml);
      const table = dom.window.document.querySelector('table');
      const result = BDLawExtractor.extractTableWithMergedCells(table);

      expect(result.rowCount).toBe(3);
      expect(result.colCount).toBe(3);
      expect(result.hasMergedCells).toBe(false);
      expect(result.data[0]).toEqual(['Header 1', 'Header 2', 'Header 3']);
      expect(result.data[1]).toEqual(['A1', 'A2', 'A3']);
      expect(result.data[2]).toEqual(['B1', 'B2', 'B3']);
    });

    /**
     * Test: Table with rowspan
     * Requirements: 24.1, 24.3 - Matrix-based algorithm, no data shifting
     */
    it('should handle rowspan without shifting data', () => {
      const tableHtml = `
        <table class="MsoTableGrid">
          <tr><td rowspan="2">Merged</td><td>R1C2</td></tr>
          <tr><td>R2C2</td></tr>
          <tr><td>R3C1</td><td>R3C2</td></tr>
        </table>
      `;
      const dom = new JSDOM(tableHtml);
      const table = dom.window.document.querySelector('table');
      const result = BDLawExtractor.extractTableWithMergedCells(table);

      expect(result.hasMergedCells).toBe(true);
      expect(result.rowCount).toBe(3);
      expect(result.colCount).toBe(2);

      // Row 0: Merged in col 0, R1C2 in col 1
      expect(result.data[0][0]).toBe('Merged');
      expect(result.data[0][1]).toBe('R1C2');

      // Row 1: Empty (merged) in col 0, R2C2 in col 1
      expect(result.data[1][0]).toBe('');
      expect(result.data[1][1]).toBe('R2C2');

      // Row 2: R3C1 in col 0, R3C2 in col 1
      expect(result.data[2][0]).toBe('R3C1');
      expect(result.data[2][1]).toBe('R3C2');
    });

    /**
     * Test: Table with colspan
     * Requirements: 24.2 - Correctly span content across columns
     */
    it('should handle colspan correctly', () => {
      const tableHtml = `
        <table>
          <tr><td colspan="3">Wide Header</td></tr>
          <tr><td>C1</td><td>C2</td><td>C3</td></tr>
        </table>
      `;
      const dom = new JSDOM(tableHtml);
      const table = dom.window.document.querySelector('table');
      const result = BDLawExtractor.extractTableWithMergedCells(table);

      expect(result.hasMergedCells).toBe(true);
      expect(result.colCount).toBe(3);

      // Row 0: Wide Header in col 0, empty in cols 1-2
      expect(result.data[0][0]).toBe('Wide Header');
      expect(result.data[0][1]).toBe('');
      expect(result.data[0][2]).toBe('');

      // Row 1: Normal cells
      expect(result.data[1]).toEqual(['C1', 'C2', 'C3']);
    });

    /**
     * Test: Table with combined rowspan and colspan
     * Requirements: 24.1, 24.2 - Handle both rowspan and colspan
     */
    it('should handle combined rowspan and colspan', () => {
      const tableHtml = `
        <table>
          <tr><td rowspan="2" colspan="2">Big Cell</td><td>R1C3</td></tr>
          <tr><td>R2C3</td></tr>
          <tr><td>R3C1</td><td>R3C2</td><td>R3C3</td></tr>
        </table>
      `;
      const dom = new JSDOM(tableHtml);
      const table = dom.window.document.querySelector('table');
      const result = BDLawExtractor.extractTableWithMergedCells(table);

      expect(result.hasMergedCells).toBe(true);
      expect(result.rowCount).toBe(3);
      expect(result.colCount).toBe(3);

      // Row 0: Big Cell spans (0,0), (0,1), R1C3 in (0,2)
      expect(result.data[0][0]).toBe('Big Cell');
      expect(result.data[0][1]).toBe('');
      expect(result.data[0][2]).toBe('R1C3');

      // Row 1: Empty in (1,0), (1,1), R2C3 in (1,2)
      expect(result.data[1][0]).toBe('');
      expect(result.data[1][1]).toBe('');
      expect(result.data[1][2]).toBe('R2C3');

      // Row 2: Normal cells
      expect(result.data[2]).toEqual(['R3C1', 'R3C2', 'R3C3']);
    });

    /**
     * Test: Whitespace normalization
     * Requirements: 24.6 - Normalize whitespace within table cells
     */
    it('should normalize whitespace in cell content', () => {
      const tableHtml = `
        <table>
          <tr>
            <td>  Multiple   spaces  </td>
            <td>With\u00A0nbsp</td>
            <td>
              Newlines
              and tabs
            </td>
          </tr>
        </table>
      `;
      const dom = new JSDOM(tableHtml);
      const table = dom.window.document.querySelector('table');
      const result = BDLawExtractor.extractTableWithMergedCells(table);

      // Multiple spaces collapsed to single space
      expect(result.data[0][0]).toBe('Multiple spaces');
      // &nbsp; replaced with regular space
      expect(result.data[0][1]).toBe('With nbsp');
      // Newlines and tabs normalized
      expect(result.data[0][2]).toBe('Newlines and tabs');
    });

    /**
     * Test: Bengali text preservation in tables
     */
    it('should preserve Bengali text in table cells', () => {
      const tableHtml = `
        <table>
          <tr><td>ধারা</td><td>বিবরণ</td></tr>
          <tr><td>১</td><td>সংক্ষিপ্ত শিরোনাম</td></tr>
          <tr><td>২</td><td>সংজ্ঞা</td></tr>
        </table>
      `;
      const dom = new JSDOM(tableHtml);
      const table = dom.window.document.querySelector('table');
      const result = BDLawExtractor.extractTableWithMergedCells(table);

      expect(result.data[0]).toEqual(['ধারা', 'বিবরণ']);
      expect(result.data[1]).toEqual(['১', 'সংক্ষিপ্ত শিরোনাম']);
      expect(result.data[2]).toEqual(['২', 'সংজ্ঞা']);
    });
  });


  describe('Amendment Marker Detection (Requirements: 25.1-25.4)', () => {
    /**
     * Test: Detection of all amendment marker types
     * Requirements: 25.1 - Detect Amendment_Markers in legal text
     */
    it('should detect all amendment marker types', () => {
      const legalText = `
ধারা ১। সংক্ষিপ্ত শিরোনাম।
ধারা ২। [বিলুপ্ত]
ধারা ৩। এই ধারা সংশোধিত হইয়াছে।
ধারা ৪। উপধারা (ক) প্রতিস্থাপিত হইয়াছে।
      `.trim();

      const result = BDLawExtractor.detectAmendmentMarkers(legalText);

      // Should detect all three marker types
      const types = result.map(m => m.type);
      expect(types).toContain('বিলুপ্ত');
      expect(types).toContain('সংশোধিত');
      expect(types).toContain('প্রতিস্থাপিত');
    });

    /**
     * Test: Line number accuracy
     * Requirements: 25.2 - Include line numbers in amendments array
     */
    it('should report correct line numbers for markers', () => {
      const legalText = `Line 1 - no marker
Line 2 - বিলুপ্ত here
Line 3 - no marker
Line 4 - সংশোধিত here`;

      const result = BDLawExtractor.detectAmendmentMarkers(legalText);

      const bilupto = result.find(m => m.type === 'বিলুপ্ত');
      const songshodhito = result.find(m => m.type === 'সংশোধিত');

      expect(bilupto.lineNumber).toBe(2);
      expect(songshodhito.lineNumber).toBe(4);
    });

    /**
     * Test: Position accuracy within line
     * Requirements: 25.2 - Include positions in amendments array
     */
    it('should report correct positions within lines', () => {
      const legalText = 'Start বিলুপ্ত end';
      const result = BDLawExtractor.detectAmendmentMarkers(legalText);

      expect(result.length).toBe(1);
      expect(result[0].position).toBe(6); // Position after "Start "
    });

    /**
     * Test: Context extraction
     * Requirements: 25.3 - Include context in amendments array
     */
    it('should include surrounding context for markers', () => {
      const legalText = 'পূর্ববর্তী টেক্সট বিলুপ্ত পরবর্তী টেক্সট';
      const result = BDLawExtractor.detectAmendmentMarkers(legalText);

      expect(result.length).toBe(1);
      expect(result[0].context).toContain('বিলুপ্ত');
      // Context should include surrounding text
      expect(result[0].context.length).toBeGreaterThan('বিলুপ্ত'.length);
    });

    /**
     * Test: Multiple markers on same line
     * Requirements: 25.1, 25.2 - Detect all occurrences
     */
    it('should detect multiple markers on the same line', () => {
      const legalText = 'বিলুপ্ত এবং সংশোধিত এবং প্রতিস্থাপিত';
      const result = BDLawExtractor.detectAmendmentMarkers(legalText);

      expect(result.length).toBe(3);
      // All should be on line 1
      expect(result.every(m => m.lineNumber === 1)).toBe(true);
    });

    /**
     * Test: Original text preservation
     * Requirements: 25.4 - Preserve original text unchanged
     */
    it('should preserve original line text in marker results', () => {
      const originalLine = 'ধারা ২। [বিলুপ্ত] - এই ধারা বাতিল করা হইয়াছে।';
      const result = BDLawExtractor.detectAmendmentMarkers(originalLine);

      expect(result.length).toBe(1);
      expect(result[0].line).toBe(originalLine);
    });

    /**
     * Test: Empty/null input handling
     */
    it('should return empty array for empty or null input', () => {
      expect(BDLawExtractor.detectAmendmentMarkers('')).toEqual([]);
      expect(BDLawExtractor.detectAmendmentMarkers(null)).toEqual([]);
      expect(BDLawExtractor.detectAmendmentMarkers(undefined)).toEqual([]);
    });

    /**
     * Test: Text without markers
     */
    it('should return empty array for text without markers', () => {
      const textWithoutMarkers = `
ধারা ১। সংক্ষিপ্ত শিরোনাম।
ধারা ২। সংজ্ঞা।
ধারা ৩। প্রয়োগ।
      `;
      const result = BDLawExtractor.detectAmendmentMarkers(textWithoutMarkers);
      expect(result).toEqual([]);
    });

    /**
     * Test: Real-world legal text with amendments
     */
    it('should correctly detect markers in real legal text', () => {
      const realLegalText = `
অধ্যায় ১
প্রারম্ভিক

ধারা ১। সংক্ষিপ্ত শিরোনাম ও প্রবর্তন।—(১) এই আইন বাংলাদেশ শ্রম আইন, ২০০৬ নামে অভিহিত হইবে।

ধারা ২। [বিলুপ্ত]

ধারা ৩। সংজ্ঞা।—এই আইনে, বিষয় বা প্রসঙ্গের পরিপন্থী কোন কিছু না থাকিলে,—
(ক) "কারখানা" অর্থ সংশোধিত সংজ্ঞা অনুযায়ী নির্ধারিত স্থান;
(খ) "শ্রমিক" অর্থ প্রতিস্থাপিত সংজ্ঞা অনুযায়ী কোন ব্যক্তি।
      `.trim();

      const result = BDLawExtractor.detectAmendmentMarkers(realLegalText);

      // Should find বিলুপ্ত, সংশোধিত, and প্রতিস্থাপিত
      expect(result.length).toBe(3);

      const bilupto = result.find(m => m.type === 'বিলুপ্ত');
      const songshodhito = result.find(m => m.type === 'সংশোধিত');
      const protisthapit = result.find(m => m.type === 'প্রতিস্থাপিত');

      expect(bilupto).toBeDefined();
      expect(songshodhito).toBeDefined();
      expect(protisthapit).toBeDefined();

      // Verify line numbers are reasonable
      expect(bilupto.lineNumber).toBeGreaterThan(0);
      expect(songshodhito.lineNumber).toBeGreaterThan(bilupto.lineNumber);
    });
  });
});
