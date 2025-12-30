/**
 * Property-Based Tests for Extraction Reproducibility
 * 
 * Feature: bdlawcorpus-mode, Property 10: Extraction Reproducibility
 * Validates: Requirements 12.6
 * 
 * Property: For any page that has not changed, repeated extraction
 * SHALL produce identical content output
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');
const BDLawMetadata = require('../../bdlaw-metadata.js');
const BDLawExport = require('../../bdlaw-export.js');

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

describe('Property 10: Extraction Reproducibility', () => {
  const ALLOWED_ORIGIN = 'http://bdlaws.minlaw.gov.bd';

  /**
   * Generator for Bengali legal text content
   */
  const bengaliLegalTextArb = fc.array(
    fc.oneof(
      fc.constant('ধারা ১। এই আইন'),
      fc.constant('ধারা ২। সংজ্ঞা'),
      fc.constant('অধ্যায় ১'),
      fc.constant('অধ্যায় ২'),
      fc.constant('তফসিল'),
      fc.constant('বাংলাদেশ আইন'),
      fc.constant('সংবিধান'),
      fc.constant('প্রারম্ভিক'),
      fc.constant('সংক্ষিপ্ত শিরোনাম'),
      fc.unicodeString({ minLength: 1, maxLength: 50 })
    ),
    { minLength: 1, maxLength: 20 }
  ).map(arr => arr.join('\n'));

  /**
   * Generator for act titles
   */
  const actTitleArb = fc.oneof(
    fc.constant('বাংলাদেশ শ্রম আইন, ২০০৬'),
    fc.constant('দণ্ডবিধি, ১৮৬০'),
    fc.constant('কোম্পানি আইন, ১৯৯৪'),
    fc.constant('সংবিধান'),
    fc.unicodeString({ minLength: 1, maxLength: 100 })
  );

  /**
   * Generator for act numbers
   */
  const actNumberArb = fc.integer({ min: 1, max: 9999 }).map(n => n.toString());

  /**
   * Generator for mock act detail HTML documents
   */
  const actDetailHtmlArb = fc.tuple(actTitleArb, bengaliLegalTextArb).map(([title, content]) => `
    <!DOCTYPE html>
    <html>
    <head><title>Act Details</title></head>
    <body>
      <h1>${title}</h1>
      <div id="lawContent">
        ${content.split('\n').map(line => `<p>${line}</p>`).join('\n')}
      </div>
    </body>
    </html>
  `);

  /**
   * Generator for mock volume HTML documents
   */
  const volumeHtmlArb = fc.array(
    fc.tuple(actTitleArb, actNumberArb),
    { minLength: 1, maxLength: 10 }
  ).map(acts => `
    <!DOCTYPE html>
    <html>
    <head><title>Volume</title></head>
    <body>
      <h1>Volume - Laws of Bangladesh</h1>
      <div class="act-list">
        ${acts.map(([title, num]) => `<a href="/act-details-${num}.html">${title}</a>`).join('\n')}
      </div>
    </body>
    </html>
  `);

  /**
   * Property: Repeated act content extraction produces identical results
   * For any act detail page DOM, extracting content multiple times
   * should produce byte-identical output
   */
  it('should produce identical act content on repeated extraction', () => {
    fc.assert(
      fc.property(
        actDetailHtmlArb,
        (html) => {
          // Create DOM from HTML
          const dom = new JSDOM(html);
          const document = dom.window.document;
          
          // Extract content multiple times
          const extraction1 = BDLawExtractor.extractActContent(document);
          const extraction2 = BDLawExtractor.extractActContent(document);
          const extraction3 = BDLawExtractor.extractActContent(document);
          
          // All extractions should be identical
          const identical12 = (
            extraction1.title === extraction2.title &&
            extraction1.content === extraction2.content &&
            JSON.stringify(extraction1.sections.counts) === JSON.stringify(extraction2.sections.counts)
          );
          
          const identical23 = (
            extraction2.title === extraction3.title &&
            extraction2.content === extraction3.content &&
            JSON.stringify(extraction2.sections.counts) === JSON.stringify(extraction3.sections.counts)
          );
          
          return identical12 && identical23;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Repeated volume data extraction produces identical results
   * For any volume page DOM, extracting catalog multiple times
   * should produce identical output
   */
  it('should produce identical volume data on repeated extraction', () => {
    fc.assert(
      fc.property(
        volumeHtmlArb,
        (html) => {
          // Create DOM from HTML
          const dom = new JSDOM(html);
          const document = dom.window.document;
          
          // Extract volume data multiple times
          const extraction1 = BDLawExtractor.extractVolumeData(document);
          const extraction2 = BDLawExtractor.extractVolumeData(document);
          const extraction3 = BDLawExtractor.extractVolumeData(document);
          
          // All extractions should have same length
          if (extraction1.length !== extraction2.length || extraction2.length !== extraction3.length) {
            return false;
          }
          
          // All act entries should be identical
          for (let i = 0; i < extraction1.length; i++) {
            const act1 = extraction1[i];
            const act2 = extraction2[i];
            const act3 = extraction3[i];
            
            if (act1.title !== act2.title || act2.title !== act3.title) return false;
            if (act1.actNumber !== act2.actNumber || act2.actNumber !== act3.actNumber) return false;
            if (act1.url !== act2.url || act2.url !== act3.url) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section marker detection is reproducible
   * For any text, detecting section markers multiple times
   * should produce identical results
   */
  it('should produce identical section marker detection on repeated calls', () => {
    fc.assert(
      fc.property(
        bengaliLegalTextArb,
        (text) => {
          // Detect markers multiple times
          const markers1 = BDLawExtractor.detectSectionMarkers(text);
          const markers2 = BDLawExtractor.detectSectionMarkers(text);
          const markers3 = BDLawExtractor.detectSectionMarkers(text);
          
          // Same number of markers
          if (markers1.length !== markers2.length || markers2.length !== markers3.length) {
            return false;
          }
          
          // Each marker should be identical
          for (let i = 0; i < markers1.length; i++) {
            if (markers1[i].type !== markers2[i].type || markers2[i].type !== markers3[i].type) return false;
            if (markers1[i].lineNumber !== markers2[i].lineNumber || markers2[i].lineNumber !== markers3[i].lineNumber) return false;
            if (markers1[i].position !== markers2[i].position || markers2[i].position !== markers3[i].position) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Section marker counts are reproducible
   * For any text, counting section markers multiple times
   * should produce identical counts
   */
  it('should produce identical section marker counts on repeated calls', () => {
    fc.assert(
      fc.property(
        bengaliLegalTextArb,
        (text) => {
          // Count markers multiple times
          const counts1 = BDLawExtractor.countSectionMarkers(text);
          const counts2 = BDLawExtractor.countSectionMarkers(text);
          const counts3 = BDLawExtractor.countSectionMarkers(text);
          
          // All counts should be identical
          return (
            counts1['ধারা'] === counts2['ধারা'] && counts2['ধারা'] === counts3['ধারা'] &&
            counts1['অধ্যায়'] === counts2['অধ্যায়'] && counts2['অধ্যায়'] === counts3['অধ্যায়'] &&
            counts1['তফসিল'] === counts2['তফসিল'] && counts2['তফসিল'] === counts3['তফসিল']
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Full export JSON is reproducible (excluding timestamp)
   * For any extracted content, formatting as JSON multiple times
   * should produce identical output (when using same metadata)
   */
  it('should produce identical JSON export on repeated formatting', () => {
    fc.assert(
      fc.property(
        actDetailHtmlArb,
        actNumberArb,
        (html, actNumber) => {
          // Create DOM and extract content
          const dom = new JSDOM(html);
          const extracted = BDLawExtractor.extractActContent(dom.window.document);
          
          // Use fixed metadata (same timestamp) for comparison
          const fixedMetadata = {
            source: 'bdlaws.minlaw.gov.bd',
            source_url: `${ALLOWED_ORIGIN}/act-details-${actNumber}.html`,
            scraped_at: '2024-01-15T10:30:00.000Z',
            scraping_method: 'manual page-level extraction',
            tool: 'BDLawCorpus',
            language: 'bn',
            research_purpose: 'academic legal corpus construction',
            disclaimer: BDLawMetadata.DISCLAIMER
          };
          
          // Format export multiple times
          const json1 = BDLawExport.formatActExport(extracted, fixedMetadata);
          const json2 = BDLawExport.formatActExport(extracted, fixedMetadata);
          const json3 = BDLawExport.formatActExport(extracted, fixedMetadata);
          
          // All JSON outputs should be byte-identical
          return json1 === json2 && json2 === json3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Volume export JSON is reproducible (excluding timestamp)
   * For any volume data, formatting as JSON multiple times
   * should produce identical output (when using same metadata)
   */
  it('should produce identical volume JSON export on repeated formatting', () => {
    fc.assert(
      fc.property(
        volumeHtmlArb,
        fc.integer({ min: 1, max: 99 }),
        (html, volumeNum) => {
          // Create DOM and extract volume data
          const dom = new JSDOM(html);
          const acts = BDLawExtractor.extractVolumeData(dom.window.document);
          
          // Use fixed metadata for comparison
          const fixedMetadata = {
            source: 'bdlaws.minlaw.gov.bd',
            source_url: `${ALLOWED_ORIGIN}/volume-${volumeNum}.html`,
            scraped_at: '2024-01-15T10:30:00.000Z',
            scraping_method: 'manual page-level extraction',
            tool: 'BDLawCorpus',
            language: 'bn',
            research_purpose: 'academic legal corpus construction'
          };
          
          // Format export multiple times
          const json1 = BDLawExport.formatVolumeExport(acts, fixedMetadata);
          const json2 = BDLawExport.formatVolumeExport(acts, fixedMetadata);
          const json3 = BDLawExport.formatVolumeExport(acts, fixedMetadata);
          
          // All JSON outputs should be byte-identical
          return json1 === json2 && json2 === json3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Extraction from identical HTML produces identical results
   * For any HTML string, creating new DOM instances and extracting
   * should produce identical content
   */
  it('should produce identical results from identical HTML across DOM instances', () => {
    fc.assert(
      fc.property(
        actDetailHtmlArb,
        (html) => {
          // Create separate DOM instances from the same HTML
          const dom1 = new JSDOM(html);
          const dom2 = new JSDOM(html);
          const dom3 = new JSDOM(html);
          
          // Extract from each DOM instance
          const extraction1 = BDLawExtractor.extractActContent(dom1.window.document);
          const extraction2 = BDLawExtractor.extractActContent(dom2.window.document);
          const extraction3 = BDLawExtractor.extractActContent(dom3.window.document);
          
          // All extractions should be identical
          return (
            extraction1.title === extraction2.title &&
            extraction2.title === extraction3.title &&
            extraction1.content === extraction2.content &&
            extraction2.content === extraction3.content &&
            JSON.stringify(extraction1.sections.counts) === JSON.stringify(extraction2.sections.counts) &&
            JSON.stringify(extraction2.sections.counts) === JSON.stringify(extraction3.sections.counts)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
