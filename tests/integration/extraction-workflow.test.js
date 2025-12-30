/**
 * Integration Tests for BDLawCorpus Extraction Workflow
 * 
 * Tests the complete extraction workflow including:
 * - Volume page catalog extraction
 * - Act Detail page content extraction
 * - Metadata injection
 * - JSON export format
 * 
 * Requirements: 4.1, 5.1, 8.1, 12.1, 12.2
 */

const BDLawPageDetector = require('../../bdlaw-page-detector.js');
const BDLawExtractor = require('../../bdlaw-extractor.js');
const BDLawMetadata = require('../../bdlaw-metadata.js');
const BDLawExport = require('../../bdlaw-export.js');

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

describe('Extraction Workflow Integration Tests', () => {
  const ALLOWED_ORIGIN = 'http://bdlaws.minlaw.gov.bd';

  describe('Volume Page Catalog Extraction (Layer 2)', () => {
    /**
     * Test: Volume page detection and catalog extraction
     * Requirements: 4.1 - Volume page metadata extraction
     */
    it('should detect volume page and extract act catalog', () => {
      const volumeUrl = `${ALLOWED_ORIGIN}/volume-56.html`;
      
      // Step 1: Detect page type
      const pageType = BDLawPageDetector.detectPageType(volumeUrl);
      expect(pageType).toBe(BDLawPageDetector.PAGE_TYPES.VOLUME);
      expect(BDLawPageDetector.getLayerNumber(pageType)).toBe(2);
      
      // Step 2: Create mock volume page DOM
      const volumeHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Volume 56</title></head>
        <body>
          <h1>Volume 56 - Laws of Bangladesh</h1>
          <div class="act-list">
            <a href="/act-details-1514.html">বাংলাদেশ শ্রম আইন, ২০০৬</a>
            <a href="/act-details-1515.html">কোম্পানি আইন, ১৯৯৪</a>
            <a href="/act-1516.html">দণ্ডবিধি, ১৮৬০</a>
          </div>
        </body>
        </html>
      `;
      const dom = new JSDOM(volumeHtml);
      
      // Step 3: Extract volume data
      const acts = BDLawExtractor.extractVolumeData(dom.window.document);
      
      expect(Array.isArray(acts)).toBe(true);
      expect(acts.length).toBe(3);
      
      // Verify act entries have required fields
      acts.forEach(act => {
        expect(act).toHaveProperty('title');
        expect(act).toHaveProperty('actNumber');
        expect(act).toHaveProperty('url');
      });
      
      // Verify first act details
      expect(acts[0].actNumber).toBe('1514');
      expect(acts[0].url).toContain('act-details-1514.html');
    });

    /**
     * Test: Volume export with metadata injection
     * Requirements: 8.1, 12.2 - Metadata injection and volume export structure
     */
    it('should export volume catalog with complete metadata', () => {
      const volumeUrl = `${ALLOWED_ORIGIN}/volume-56.html`;
      
      // Mock extracted acts
      const acts = [
        { title: 'বাংলাদেশ শ্রম আইন, ২০০৬', year: '2006', actNumber: '1514', url: `${ALLOWED_ORIGIN}/act-details-1514.html` },
        { title: 'কোম্পানি আইন, ১৯৯৪', year: '1994', actNumber: '1515', url: `${ALLOWED_ORIGIN}/act-details-1515.html` }
      ];
      
      // Generate metadata
      const metadata = BDLawMetadata.generate(volumeUrl);
      
      // Validate metadata completeness
      const validation = BDLawMetadata.validate(metadata);
      expect(validation.valid).toBe(true);
      expect(validation.missing).toHaveLength(0);
      
      // Format export
      const jsonString = BDLawExport.formatVolumeExport(acts, metadata);
      
      // Validate JSON
      expect(BDLawExport.validateJSON(jsonString)).toBe(true);
      
      // Parse and verify structure
      const parsed = JSON.parse(jsonString);
      
      // Check _metadata object (Requirement 8.1)
      expect(parsed._metadata).toBeDefined();
      expect(parsed._metadata.source).toBe('bdlaws.minlaw.gov.bd');
      expect(parsed._metadata.source_url).toBe(volumeUrl);
      expect(parsed._metadata.tool).toBe('BDLawCorpus');
      expect(parsed._metadata.language).toBe('bn');
      expect(parsed._metadata.scraping_method).toBe('manual page-level extraction');
      
      // Check volume structure (Requirement 12.2)
      expect(parsed.volume_number).toBe('56');
      expect(Array.isArray(parsed.acts)).toBe(true);
      expect(parsed.total_count).toBe(2);
      
      // Check act entries
      expect(parsed.acts[0].title).toBe('বাংলাদেশ শ্রম আইন, ২০০৬');
      expect(parsed.acts[0].act_number).toBe('1514');
    });
  });

  describe('Act Detail Page Content Extraction (Layer 3)', () => {
    /**
     * Test: Act detail page detection and content extraction
     * Requirements: 5.1 - Act detail page full content extraction
     */
    it('should detect act detail page and extract full content', () => {
      const actUrl = `${ALLOWED_ORIGIN}/act-details-1514.html`;
      
      // Step 1: Detect page type
      const pageType = BDLawPageDetector.detectPageType(actUrl);
      expect(pageType).toBe(BDLawPageDetector.PAGE_TYPES.ACT_DETAILS);
      expect(BDLawPageDetector.getLayerNumber(pageType)).toBe(3);
      
      // Step 2: Create mock act detail page DOM
      const actHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Act Details - 1514</title></head>
        <body>
          <h1>বাংলাদেশ শ্রম আইন, ২০০৬</h1>
          <div id="lawContent">
            <p>অধ্যায় ১</p>
            <p>প্রারম্ভিক</p>
            <p>ধারা ১। সংক্ষিপ্ত শিরোনাম ও প্রবর্তন।</p>
            <p>ধারা ২। সংজ্ঞা।</p>
            <p>অধ্যায় ২</p>
            <p>ধারা ৩। শ্রমিকের সংজ্ঞা।</p>
            <p>তফসিল ১</p>
          </div>
        </body>
        </html>
      `;
      const dom = new JSDOM(actHtml);
      
      // Step 3: Extract act content
      const extracted = BDLawExtractor.extractActContent(dom.window.document);
      
      expect(extracted).toHaveProperty('title');
      expect(extracted).toHaveProperty('content');
      expect(extracted).toHaveProperty('sections');
      
      // Verify title extraction
      expect(extracted.title).toBe('বাংলাদেশ শ্রম আইন, ২০০৬');
      
      // Verify content contains Bengali text
      expect(extracted.content).toContain('ধারা');
      expect(extracted.content).toContain('অধ্যায়');
      
      // Verify section marker detection
      expect(extracted.sections.counts['ধারা']).toBeGreaterThan(0);
      expect(extracted.sections.counts['অধ্যায়']).toBeGreaterThan(0);
      expect(extracted.sections.counts['তফসিল']).toBeGreaterThan(0);
    });

    /**
     * Test: Act export with metadata injection
     * Requirements: 8.1, 12.1 - Metadata injection and act export structure
     */
    it('should export act content with complete metadata', () => {
      const actUrl = `${ALLOWED_ORIGIN}/act-details-1514.html`;
      
      // Mock extracted content
      const content = {
        title: 'বাংলাদেশ শ্রম আইন, ২০০৬',
        content: 'অধ্যায় ১\nধারা ১। সংক্ষিপ্ত শিরোনাম।\nধারা ২। সংজ্ঞা।\nতফসিল ১',
        sections: {
          counts: { 'ধারা': 2, 'অধ্যায়': 1, 'তফসিল': 1 }
        }
      };
      
      // Generate metadata
      const metadata = BDLawMetadata.generate(actUrl);
      
      // Validate metadata completeness
      const validation = BDLawMetadata.validate(metadata);
      expect(validation.valid).toBe(true);
      
      // Format export
      const jsonString = BDLawExport.formatActExport(content, metadata);
      
      // Validate JSON
      expect(BDLawExport.validateJSON(jsonString)).toBe(true);
      
      // Parse and verify structure
      const parsed = JSON.parse(jsonString);
      
      // Check _metadata object (Requirement 8.1)
      expect(parsed._metadata).toBeDefined();
      expect(parsed._metadata.source).toBe('bdlaws.minlaw.gov.bd');
      expect(parsed._metadata.source_url).toBe(actUrl);
      expect(parsed._metadata.tool).toBe('BDLawCorpus');
      expect(parsed._metadata.language).toBe('bn');
      expect(parsed._metadata.research_purpose).toBe('academic legal corpus construction');
      expect(parsed._metadata.disclaimer).toBeDefined();
      
      // Check act structure (Requirement 12.1)
      expect(parsed.title).toBe('বাংলাদেশ শ্রম আইন, ২০০৬');
      expect(parsed.act_number).toBe('1514');
      expect(parsed.content).toContain('ধারা');
      expect(parsed.sections_detected).toBeDefined();
      expect(parsed.sections_detected['ধারা']).toBe(2);
    });
  });

  describe('Metadata Injection', () => {
    /**
     * Test: All required metadata fields are present
     * Requirements: 8.1 - Mandatory metadata fields
     */
    it('should inject all required metadata fields', () => {
      const url = `${ALLOWED_ORIGIN}/act-details-1514.html`;
      const metadata = BDLawMetadata.generate(url);
      
      // Check all required fields
      expect(metadata.source).toBe('bdlaws.minlaw.gov.bd');
      expect(metadata.source_url).toBe(url);
      expect(metadata.scraped_at).toBeDefined();
      expect(metadata.scraping_method).toBe('manual page-level extraction');
      expect(metadata.tool).toBe('BDLawCorpus');
      expect(metadata.language).toBe('bn');
      expect(metadata.research_purpose).toBe('academic legal corpus construction');
      expect(metadata.disclaimer).toBeDefined();
      
      // Verify timestamp is ISO 8601 format
      expect(() => new Date(metadata.scraped_at)).not.toThrow();
      const date = new Date(metadata.scraped_at);
      expect(date.toISOString()).toBe(metadata.scraped_at);
    });

    /**
     * Test: URL preservation in metadata
     * Requirements: 8.1 - Source URL preserved exactly
     */
    it('should preserve original HTTP URL exactly in metadata', () => {
      const httpUrl = `${ALLOWED_ORIGIN}/act-details-1514.html`;
      const metadata = BDLawMetadata.generate(httpUrl);
      
      // URL should be preserved exactly (including HTTP protocol)
      expect(metadata.source_url).toBe(httpUrl);
      expect(metadata.source_url.startsWith('http://')).toBe(true);
    });
  });

  describe('JSON Export Format', () => {
    /**
     * Test: Act export JSON structure
     * Requirements: 12.1 - Act export structure
     */
    it('should produce correct act export JSON structure', () => {
      const content = {
        title: 'Test Act',
        content: 'ধারা ১। Test content',
        sections: { counts: { 'ধারা': 1, 'অধ্যায়': 0, 'তফসিল': 0 } }
      };
      const metadata = BDLawMetadata.generate(`${ALLOWED_ORIGIN}/act-details-100.html`);
      
      const jsonString = BDLawExport.formatActExport(content, metadata);
      const parsed = JSON.parse(jsonString);
      
      // Verify required fields exist
      expect(Object.keys(parsed)).toContain('_metadata');
      expect(Object.keys(parsed)).toContain('title');
      expect(Object.keys(parsed)).toContain('act_number');
      expect(Object.keys(parsed)).toContain('content');
      expect(Object.keys(parsed)).toContain('sections_detected');
    });

    /**
     * Test: Volume export JSON structure
     * Requirements: 12.2 - Volume export structure
     */
    it('should produce correct volume export JSON structure', () => {
      const acts = [
        { title: 'Act 1', year: '2020', actNumber: '100', url: `${ALLOWED_ORIGIN}/act-details-100.html` }
      ];
      const metadata = BDLawMetadata.generate(`${ALLOWED_ORIGIN}/volume-10.html`);
      
      const jsonString = BDLawExport.formatVolumeExport(acts, metadata);
      const parsed = JSON.parse(jsonString);
      
      // Verify required fields exist
      expect(Object.keys(parsed)).toContain('_metadata');
      expect(Object.keys(parsed)).toContain('volume_number');
      expect(Object.keys(parsed)).toContain('acts');
      expect(Object.keys(parsed)).toContain('total_count');
      
      // Verify acts array structure
      expect(Array.isArray(parsed.acts)).toBe(true);
      expect(parsed.acts[0]).toHaveProperty('title');
      expect(parsed.acts[0]).toHaveProperty('year');
      expect(parsed.acts[0]).toHaveProperty('act_number');
      expect(parsed.acts[0]).toHaveProperty('url');
    });

    /**
     * Test: UTF-8 encoding for Bengali characters
     * Requirements: 12.3 - UTF-8 encoding preservation
     */
    it('should preserve Bengali characters in JSON export', () => {
      const bengaliContent = {
        title: 'বাংলাদেশ শ্রম আইন',
        content: 'ধারা ১। এই আইন বাংলাদেশ শ্রম আইন, ২০০৬ নামে অভিহিত হইবে।',
        sections: { counts: { 'ধারা': 1, 'অধ্যায়': 0, 'তফসিল': 0 } }
      };
      const metadata = BDLawMetadata.generate(`${ALLOWED_ORIGIN}/act-details-1514.html`);
      
      const jsonString = BDLawExport.formatActExport(bengaliContent, metadata);
      const parsed = JSON.parse(jsonString);
      
      // Bengali characters should be preserved exactly
      expect(parsed.title).toBe('বাংলাদেশ শ্রম আইন');
      expect(parsed.content).toContain('ধারা');
      expect(parsed.content).toContain('বাংলাদেশ');
    });

    /**
     * Test: Filename generation
     * Requirements: 12.4 - Filename format
     */
    it('should generate correct filenames for exports', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z');
      
      const actFilename = BDLawExport.generateActFilename('1514', timestamp);
      expect(actFilename).toMatch(/^bdlaw_act_1514_\d{8}_\d{6}\.json$/);
      
      const volumeFilename = BDLawExport.generateVolumeFilename('56', timestamp);
      expect(volumeFilename).toMatch(/^bdlaw_volume_56_\d{8}_\d{6}\.json$/);
    });
  });

  describe('Complete Workflow Integration', () => {
    /**
     * Test: End-to-end workflow from page detection to export
     */
    it('should complete full extraction workflow for act detail page', () => {
      const actUrl = `${ALLOWED_ORIGIN}/act-details-1514.html`;
      
      // Step 1: Detect page type
      const pageType = BDLawPageDetector.detectPageType(actUrl);
      expect(pageType).toBe(BDLawPageDetector.PAGE_TYPES.ACT_DETAILS);
      
      // Step 2: Create mock DOM
      const actHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <h1>বাংলাদেশ শ্রম আইন, ২০০৬</h1>
          <div id="lawContent">
            <p>অধ্যায় ১ - প্রারম্ভিক</p>
            <p>ধারা ১। সংক্ষিপ্ত শিরোনাম।</p>
            <p>ধারা ২। সংজ্ঞা।</p>
          </div>
        </body>
        </html>
      `;
      const dom = new JSDOM(actHtml);
      
      // Step 3: Extract content
      const extracted = BDLawExtractor.extractActContent(dom.window.document);
      expect(extracted.title).toBeTruthy();
      expect(extracted.content).toBeTruthy();
      
      // Step 4: Generate metadata
      const metadata = BDLawMetadata.generate(actUrl);
      const validation = BDLawMetadata.validate(metadata);
      expect(validation.valid).toBe(true);
      
      // Step 5: Format export
      const jsonString = BDLawExport.formatActExport(extracted, metadata);
      expect(BDLawExport.validateJSON(jsonString)).toBe(true);
      
      // Step 6: Verify final output
      const parsed = JSON.parse(jsonString);
      expect(parsed._metadata.source_url).toBe(actUrl);
      expect(parsed.title).toBe('বাংলাদেশ শ্রম আইন, ২০০৬');
      expect(parsed.act_number).toBe('1514');
      expect(parsed.content).toContain('ধারা');
    });

    /**
     * Test: End-to-end workflow for volume page
     */
    it('should complete full extraction workflow for volume page', () => {
      const volumeUrl = `${ALLOWED_ORIGIN}/volume-56.html`;
      
      // Step 1: Detect page type
      const pageType = BDLawPageDetector.detectPageType(volumeUrl);
      expect(pageType).toBe(BDLawPageDetector.PAGE_TYPES.VOLUME);
      
      // Step 2: Create mock DOM
      const volumeHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <h1>Volume 56</h1>
          <a href="/act-details-1514.html">বাংলাদেশ শ্রম আইন, ২০০৬</a>
          <a href="/act-details-1515.html">কোম্পানি আইন, ১৯৯৪</a>
        </body>
        </html>
      `;
      const dom = new JSDOM(volumeHtml);
      
      // Step 3: Extract volume data
      const acts = BDLawExtractor.extractVolumeData(dom.window.document);
      expect(acts.length).toBeGreaterThan(0);
      
      // Step 4: Generate metadata
      const metadata = BDLawMetadata.generate(volumeUrl);
      expect(BDLawMetadata.validate(metadata).valid).toBe(true);
      
      // Step 5: Format export
      const jsonString = BDLawExport.formatVolumeExport(acts, metadata);
      expect(BDLawExport.validateJSON(jsonString)).toBe(true);
      
      // Step 6: Verify final output
      const parsed = JSON.parse(jsonString);
      expect(parsed._metadata.source_url).toBe(volumeUrl);
      expect(parsed.volume_number).toBe('56');
      expect(parsed.acts.length).toBe(2);
    });
  });
});
