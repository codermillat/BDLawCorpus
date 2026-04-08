/**
 * Property-Based Tests for URL Normalization
 * 
 * Feature: bdlawcorpus-mode, Property 15: URL Normalization
 * Validates: Requirements 22.5
 * 
 * Property: For any relative URL extracted from a Volume DataTable, the normalizer
 * SHALL produce an absolute URL on bdlaws.minlaw.gov.bd with protocol-aware handling.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 15: URL Normalization', () => {
  const HTTP_BASE_URL = 'http://bdlaws.minlaw.gov.bd';
  const HTTPS_BASE_URL = 'https://bdlaws.minlaw.gov.bd';

  /**
   * Generator for relative URL paths (without leading slash)
   */
  const relativePathArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', '1', '2', '3', '-', '_', '.', 'html', 'act', 'details'),
    { minLength: 1, maxLength: 50 }
  ).filter(s => !s.startsWith('http'));

  /**
   * Generator for relative URL paths (with leading slash)
   */
  const absolutePathArb = relativePathArb.map(path => `/${path}`);

  /**
   * Property: Relative URLs without leading slash should be normalized to absolute
   * Requirements: 22.5 - Normalize relative URLs to absolute with bdlaws.minlaw.gov.bd domain
   */
  it('should normalize relative URLs without leading slash to absolute', () => {
    fc.assert(
      fc.property(
        relativePathArb,
        (path) => {
          const result = BDLawExtractor._normalizeUrl(path);
          return result.startsWith(HTTP_BASE_URL + '/');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Relative URLs with leading slash should be normalized to absolute
   * Requirements: 22.5 - Normalize relative URLs to absolute with bdlaws.minlaw.gov.bd domain
   */
  it('should normalize relative URLs with leading slash to absolute', () => {
    fc.assert(
      fc.property(
        absolutePathArb,
        (path) => {
          const result = BDLawExtractor._normalizeUrl(path);
          return result.startsWith(HTTP_BASE_URL);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Already absolute HTTP URLs should be preserved
   */
  it('should preserve already absolute HTTP URLs', () => {
    fc.assert(
      fc.property(
        relativePathArb,
        (path) => {
          const absoluteUrl = `http://example.com/${path}`;
          const result = BDLawExtractor._normalizeUrl(absoluteUrl);
          return result === absoluteUrl;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Already absolute HTTPS URLs should be preserved
   */
  it('should preserve already absolute HTTPS URLs', () => {
    fc.assert(
      fc.property(
        relativePathArb,
        (path) => {
          const absoluteUrl = `https://example.com/${path}`;
          const result = BDLawExtractor._normalizeUrl(absoluteUrl);
          return result === absoluteUrl;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: In non-browser/test context, relative inputs default to HTTP base URL
   */
  it('should default to HTTP for relative inputs without protocol context', () => {
    fc.assert(
      fc.property(
        fc.oneof(relativePathArb, absolutePathArb),
        (path) => {
          const result = BDLawExtractor._normalizeUrl(path);
          return result.startsWith(HTTP_BASE_URL);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Normalized URLs should not have double slashes in path (except protocol)
   */
  it('should not produce double slashes in path (except protocol)', () => {
    fc.assert(
      fc.property(
        fc.oneof(relativePathArb, absolutePathArb),
        (path) => {
          const result = BDLawExtractor._normalizeUrl(path);
          // Remove protocol part and check for double slashes
          const pathPart = result.replace(/^https?:\/\//, '');
          return !pathPart.includes('//');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or invalid inputs should return empty string
   */
  it('should return empty string for null, undefined, or non-string inputs', () => {
    expect(BDLawExtractor._normalizeUrl(null)).toBe('');
    expect(BDLawExtractor._normalizeUrl(undefined)).toBe('');
    expect(BDLawExtractor._normalizeUrl('')).toBe('');
  });

  /**
   * Property: The function should be deterministic
   */
  it('should return the same result for the same input (determinism)', () => {
    fc.assert(
      fc.property(
        fc.oneof(relativePathArb, absolutePathArb, fc.constant('http://example.com/test')),
        (url) => {
          const result1 = BDLawExtractor._normalizeUrl(url);
          const result2 = BDLawExtractor._normalizeUrl(url);
          return result1 === result2;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use HTTPS when context document protocol is https', () => {
    fc.assert(
      fc.property(
        fc.oneof(relativePathArb, absolutePathArb),
        (path) => {
          const contextDocument = { location: { protocol: 'https:' } };
          const result = BDLawExtractor._normalizeUrl(path, contextDocument);
          return result.startsWith(HTTPS_BASE_URL);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should normalize protocol-relative URLs using detected protocol', () => {
    const protocolRelativePathArb = relativePathArb.map(path => `//bdlaws.minlaw.gov.bd/${path}`);

    fc.assert(
      fc.property(
        protocolRelativePathArb,
        (href) => {
          const httpResult = BDLawExtractor._normalizeUrl(href, { location: { protocol: 'http:' } });
          const httpsResult = BDLawExtractor._normalizeUrl(href, { location: { protocol: 'https:' } });

          return httpResult.startsWith(HTTP_BASE_URL) && httpsResult.startsWith(HTTPS_BASE_URL);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Specific act URL patterns should be normalized correctly
   */
  it('should correctly normalize act URL patterns', () => {
    // Test specific patterns that appear in the DataTable
    const testCases = [
      { input: '/act-1514.html', expected: 'http://bdlaws.minlaw.gov.bd/act-1514.html' },
      { input: 'act-1514.html', expected: 'http://bdlaws.minlaw.gov.bd/act-1514.html' },
      { input: '/act-details-1514.html', expected: 'http://bdlaws.minlaw.gov.bd/act-details-1514.html' },
      { input: 'act-details-1514.html', expected: 'http://bdlaws.minlaw.gov.bd/act-details-1514.html' }
    ];

    testCases.forEach(({ input, expected }) => {
      expect(BDLawExtractor._normalizeUrl(input)).toBe(expected);
    });
  });

  it('should preserve relative-path normalization under HTTPS context for act URL patterns', () => {
    const contextDocument = { location: { protocol: 'https:' } };
    const testCases = [
      { input: '/act-1514.html', expected: 'https://bdlaws.minlaw.gov.bd/act-1514.html' },
      { input: 'act-1514.html', expected: 'https://bdlaws.minlaw.gov.bd/act-1514.html' },
      { input: '/act-details-1514.html', expected: 'https://bdlaws.minlaw.gov.bd/act-details-1514.html' },
      { input: 'act-details-1514.html', expected: 'https://bdlaws.minlaw.gov.bd/act-details-1514.html' }
    ];

    testCases.forEach(({ input, expected }) => {
      expect(BDLawExtractor._normalizeUrl(input, contextDocument)).toBe(expected);
    });
  });
});
