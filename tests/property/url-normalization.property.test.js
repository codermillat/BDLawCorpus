/**
 * Property-Based Tests for URL Normalization
 * 
 * Feature: bdlawcorpus-mode, Property 15: URL Normalization
 * Validates: Requirements 22.5
 * 
 * Property: For any relative URL extracted from a Volume DataTable, the normalizer 
 * SHALL produce an absolute URL starting with http://bdlaws.minlaw.gov.bd/
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 15: URL Normalization', () => {
  const BASE_URL = 'http://bdlaws.minlaw.gov.bd';

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
          return result.startsWith(BASE_URL + '/');
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
          return result.startsWith(BASE_URL);
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
   * Property: Normalized URLs should always start with http://bdlaws.minlaw.gov.bd
   * for relative inputs
   */
  it('should always produce URLs starting with http://bdlaws.minlaw.gov.bd for relative inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(relativePathArb, absolutePathArb),
        (path) => {
          const result = BDLawExtractor._normalizeUrl(path);
          return result.startsWith(BASE_URL);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Normalized URLs should not have double slashes (except in protocol)
   */
  it('should not produce double slashes in path (except protocol)', () => {
    fc.assert(
      fc.property(
        fc.oneof(relativePathArb, absolutePathArb),
        (path) => {
          const result = BDLawExtractor._normalizeUrl(path);
          // Remove protocol part and check for double slashes
          const pathPart = result.replace('http://', '');
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
});
