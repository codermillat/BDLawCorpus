/**
 * Property-Based Tests for Page Type Classification
 * 
 * Feature: bdlawcorpus-mode
 * Property 2: Page Type Classification Determinism
 * Property 3: Layer Detection Accuracy
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

const fc = require('fast-check');
const BDLawPageDetector = require('../../bdlaw-page-detector.js');

const ALLOWED_ORIGIN = 'http://bdlaws.minlaw.gov.bd';
const { PAGE_TYPES } = BDLawPageDetector;

describe('Property 2: Page Type Classification Determinism', () => {
  /**
   * Property: Calling detectPageType() multiple times with the same URL 
   * SHALL always return the same result
   */
  it('should return the same page type for the same URL (determinism)', () => {
    // Generate valid bdlaws URLs
    const bdlawsUrls = fc.oneof(
      fc.constant(`${ALLOWED_ORIGIN}/laws-of-bangladesh.html`),
      fc.constant(`${ALLOWED_ORIGIN}/laws-of-bangladesh-chronological-index.html`),
      fc.constant(`${ALLOWED_ORIGIN}/laws-of-bangladesh-alphabetical-index.html`),
      fc.nat({ max: 100 }).map(n => `${ALLOWED_ORIGIN}/volume-${n}.html`),
      fc.nat({ max: 10000 }).map(n => `${ALLOWED_ORIGIN}/act-details-${n}.html`),
      fc.nat({ max: 10000 }).map(n => `${ALLOWED_ORIGIN}/act-${n}.html`),
      fc.webUrl()
    );

    fc.assert(
      fc.property(
        bdlawsUrls,
        (url) => {
          const result1 = BDLawPageDetector.detectPageType(url);
          const result2 = BDLawPageDetector.detectPageType(url);
          const result3 = BDLawPageDetector.detectPageType(url);
          return result1 === result2 && result2 === result3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: The result should always be one of the defined PAGE_TYPES
   */
  it('should always return a valid PAGE_TYPE value', () => {
    const validPageTypes = Object.values(PAGE_TYPES);

    fc.assert(
      fc.property(
        fc.oneof(
          fc.webUrl(),
          fc.constant(`${ALLOWED_ORIGIN}/laws-of-bangladesh.html`),
          fc.constant(`${ALLOWED_ORIGIN}/laws-of-bangladesh-chronological-index.html`),
          fc.constant(`${ALLOWED_ORIGIN}/laws-of-bangladesh-alphabetical-index.html`),
          fc.nat({ max: 100 }).map(n => `${ALLOWED_ORIGIN}/volume-${n}.html`),
          fc.nat({ max: 10000 }).map(n => `${ALLOWED_ORIGIN}/act-details-${n}.html`),
          fc.nat({ max: 10000 }).map(n => `${ALLOWED_ORIGIN}/act-${n}.html`),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('')
        ),
        (url) => {
          const result = BDLawPageDetector.detectPageType(url);
          return validPageTypes.includes(result);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 3: Layer Detection Accuracy', () => {
  /**
   * Property: URLs matching /laws-of-bangladesh.html SHALL return RANGE_INDEX
   */
  it('should detect Range Index pages (Layer 1) correctly', () => {
    const rangeIndexUrl = `${ALLOWED_ORIGIN}/laws-of-bangladesh.html`;
    
    // Test the specific URL
    expect(BDLawPageDetector.detectPageType(rangeIndexUrl)).toBe(PAGE_TYPES.RANGE_INDEX);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.RANGE_INDEX)).toBe(1);
  });

  /**
   * Property: For any positive integer N, /volume-N.html SHALL return VOLUME
   */
  it('should detect Volume pages (Layer 2) for any volume number', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1000 }).filter(n => n > 0),
        (volumeNum) => {
          const url = `${ALLOWED_ORIGIN}/volume-${volumeNum}.html`;
          const pageType = BDLawPageDetector.detectPageType(url);
          const layer = BDLawPageDetector.getLayerNumber(pageType);
          return pageType === PAGE_TYPES.VOLUME && layer === 2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any positive integer N, /act-details-N.html SHALL return ACT_DETAILS
   */
  it('should detect Act Details pages (Layer 3) for any act number', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }).filter(n => n > 0),
        (actNum) => {
          const url = `${ALLOWED_ORIGIN}/act-details-${actNum}.html`;
          const pageType = BDLawPageDetector.detectPageType(url);
          const layer = BDLawPageDetector.getLayerNumber(pageType);
          return pageType === PAGE_TYPES.ACT_DETAILS && layer === 3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any positive integer N, /act-N.html (not act-details) SHALL return ACT_SUMMARY
   */
  it('should detect Act Summary pages for any act number', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }).filter(n => n > 0),
        (actNum) => {
          const url = `${ALLOWED_ORIGIN}/act-${actNum}.html`;
          const pageType = BDLawPageDetector.detectPageType(url);
          // ACT_SUMMARY should have null layer (not a main layer)
          const layer = BDLawPageDetector.getLayerNumber(pageType);
          return pageType === PAGE_TYPES.ACT_SUMMARY && layer === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: ACT_DETAILS detection must take precedence over ACT_SUMMARY
   * This ensures /act-details-N.html is never misclassified as ACT_SUMMARY
   */
  it('should prioritize ACT_DETAILS over ACT_SUMMARY pattern', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }).filter(n => n > 0),
        (actNum) => {
          const detailsUrl = `${ALLOWED_ORIGIN}/act-details-${actNum}.html`;
          const summaryUrl = `${ALLOWED_ORIGIN}/act-${actNum}.html`;
          
          const detailsType = BDLawPageDetector.detectPageType(detailsUrl);
          const summaryType = BDLawPageDetector.detectPageType(summaryUrl);
          
          // Details URL must be ACT_DETAILS, not ACT_SUMMARY
          // Summary URL must be ACT_SUMMARY, not ACT_DETAILS
          return detailsType === PAGE_TYPES.ACT_DETAILS && 
                 summaryType === PAGE_TYPES.ACT_SUMMARY;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-bdlaws URLs should return INVALID_DOMAIN
   */
  it('should return INVALID_DOMAIN for non-bdlaws URLs', () => {
    const nonBdlawsUrls = fc.webUrl().filter(url => !url.startsWith(ALLOWED_ORIGIN));

    fc.assert(
      fc.property(
        nonBdlawsUrls,
        (url) => {
          return BDLawPageDetector.detectPageType(url) === PAGE_TYPES.INVALID_DOMAIN;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Layer numbers should be consistent with page types
   */
  it('should return correct layer numbers for each page type', () => {
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.RANGE_INDEX)).toBe(1);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.VOLUME)).toBe(2);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.CHRONOLOGICAL_INDEX)).toBe(2);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.ALPHABETICAL_INDEX)).toBe(2);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.ACT_DETAILS)).toBe(3);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.ACT_SUMMARY)).toBe(null);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.UNSUPPORTED)).toBe(null);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.INVALID_DOMAIN)).toBe(null);
  });

  /**
   * Property: Page type labels should be human-readable and non-empty
   */
  it('should return non-empty labels for all page types', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(PAGE_TYPES)),
        (pageType) => {
          const label = BDLawPageDetector.getPageTypeLabel(pageType);
          return typeof label === 'string' && label.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 4: Index Page Detection', () => {
  /**
   * Property: Chronological index URL SHALL return CHRONOLOGICAL_INDEX
   */
  it('should detect Chronological Index page correctly', () => {
    const chronologicalUrl = `${ALLOWED_ORIGIN}/laws-of-bangladesh-chronological-index.html`;
    
    expect(BDLawPageDetector.detectPageType(chronologicalUrl)).toBe(PAGE_TYPES.CHRONOLOGICAL_INDEX);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.CHRONOLOGICAL_INDEX)).toBe(2);
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.CHRONOLOGICAL_INDEX)).toBe(true);
  });

  /**
   * Property: Alphabetical index URL SHALL return ALPHABETICAL_INDEX
   */
  it('should detect Alphabetical Index page correctly', () => {
    const alphabeticalUrl = `${ALLOWED_ORIGIN}/laws-of-bangladesh-alphabetical-index.html`;
    
    expect(BDLawPageDetector.detectPageType(alphabeticalUrl)).toBe(PAGE_TYPES.ALPHABETICAL_INDEX);
    expect(BDLawPageDetector.getLayerNumber(PAGE_TYPES.ALPHABETICAL_INDEX)).toBe(2);
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.ALPHABETICAL_INDEX)).toBe(true);
  });

  /**
   * Property: Index pages should be detected before RANGE_INDEX pattern
   * This ensures /laws-of-bangladesh-chronological-index.html is not misclassified
   */
  it('should prioritize index patterns over RANGE_INDEX pattern', () => {
    const rangeUrl = `${ALLOWED_ORIGIN}/laws-of-bangladesh.html`;
    const chronologicalUrl = `${ALLOWED_ORIGIN}/laws-of-bangladesh-chronological-index.html`;
    const alphabeticalUrl = `${ALLOWED_ORIGIN}/laws-of-bangladesh-alphabetical-index.html`;
    
    // Range URL must be RANGE_INDEX
    expect(BDLawPageDetector.detectPageType(rangeUrl)).toBe(PAGE_TYPES.RANGE_INDEX);
    
    // Index URLs must NOT be RANGE_INDEX
    expect(BDLawPageDetector.detectPageType(chronologicalUrl)).toBe(PAGE_TYPES.CHRONOLOGICAL_INDEX);
    expect(BDLawPageDetector.detectPageType(alphabeticalUrl)).toBe(PAGE_TYPES.ALPHABETICAL_INDEX);
  });

  /**
   * Property: isCatalogSource should return true for all catalog page types
   */
  it('should identify catalog sources correctly', () => {
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.VOLUME)).toBe(true);
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.CHRONOLOGICAL_INDEX)).toBe(true);
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.ALPHABETICAL_INDEX)).toBe(true);
    
    // Non-catalog sources
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.RANGE_INDEX)).toBe(false);
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.ACT_DETAILS)).toBe(false);
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.ACT_SUMMARY)).toBe(false);
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.UNSUPPORTED)).toBe(false);
    expect(BDLawPageDetector.isCatalogSource(PAGE_TYPES.INVALID_DOMAIN)).toBe(false);
  });

  /**
   * Property: Index page labels should be descriptive
   */
  it('should return descriptive labels for index page types', () => {
    const chronologicalLabel = BDLawPageDetector.getPageTypeLabel(PAGE_TYPES.CHRONOLOGICAL_INDEX);
    const alphabeticalLabel = BDLawPageDetector.getPageTypeLabel(PAGE_TYPES.ALPHABETICAL_INDEX);
    
    expect(chronologicalLabel).toContain('Chronological');
    expect(alphabeticalLabel).toContain('Alphabetical');
  });
});
