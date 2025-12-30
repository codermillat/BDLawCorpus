/**
 * Property-Based Tests for URL Preservation
 * 
 * Feature: bdlawcorpus-mode, Property 11: URL Preservation
 * Validates: Requirements 1.5
 * 
 * Property: For any extraction, the source_url in metadata SHALL exactly match
 * the original HTTP URL as served by the website
 */

const fc = require('fast-check');
const BDLawMetadata = require('../../bdlaw-metadata.js');

describe('Property 11: URL Preservation', () => {
  const ALLOWED_ORIGIN = 'http://bdlaws.minlaw.gov.bd';

  /**
   * Property: source_url in generated metadata SHALL exactly match the input URL
   */
  it('should preserve the original URL exactly in source_url field', () => {
    // Generate random valid bdlaws URLs with various path patterns
    const validPaths = fc.stringOf(
      fc.constantFrom(
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
        'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        '-', '_', '/', '.', 'A', 'B', 'C'
      ),
      { minLength: 1, maxLength: 50 }
    );

    fc.assert(
      fc.property(
        validPaths,
        (path) => {
          const originalUrl = `${ALLOWED_ORIGIN}/${path}`;
          const metadata = BDLawMetadata.generate(originalUrl);
          
          // source_url must be byte-identical to the input URL
          return metadata.source_url === originalUrl;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: HTTP protocol should be preserved (not converted to HTTPS)
   */
  it('should preserve HTTP protocol without converting to HTTPS', () => {
    const pageTypes = fc.constantFrom(
      '/laws-of-bangladesh.html',
      '/volume-1.html',
      '/volume-56.html',
      '/act-details-1514.html',
      '/act-details-100.html',
      '/act-1.html'
    );

    fc.assert(
      fc.property(
        pageTypes,
        (path) => {
          const httpUrl = `http://bdlaws.minlaw.gov.bd${path}`;
          const metadata = BDLawMetadata.generate(httpUrl);
          
          // URL must start with http:// not https://
          return (
            metadata.source_url.startsWith('http://') &&
            !metadata.source_url.startsWith('https://')
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: URL with query parameters should be preserved exactly
   */
  it('should preserve URLs with query parameters exactly', () => {
    const queryParams = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', '=', '&'),
      { minLength: 1, maxLength: 20 }
    );

    fc.assert(
      fc.property(
        queryParams,
        (params) => {
          const urlWithQuery = `${ALLOWED_ORIGIN}/act-details-1514.html?${params}`;
          const metadata = BDLawMetadata.generate(urlWithQuery);
          
          return metadata.source_url === urlWithQuery;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: URL with hash fragments should be preserved exactly
   */
  it('should preserve URLs with hash fragments exactly', () => {
    const fragments = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', '-', '_'),
      { minLength: 1, maxLength: 20 }
    );

    fc.assert(
      fc.property(
        fragments,
        (fragment) => {
          const urlWithHash = `${ALLOWED_ORIGIN}/act-details-1514.html#${fragment}`;
          const metadata = BDLawMetadata.generate(urlWithHash);
          
          return metadata.source_url === urlWithHash;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: URL preservation should be deterministic
   */
  it('should produce identical source_url for the same input URL (determinism)', () => {
    const validPaths = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', '-', '_', '/', '.', 'h', 't', 'm', 'l'),
      { minLength: 1, maxLength: 30 }
    );

    fc.assert(
      fc.property(
        validPaths,
        (path) => {
          const url = `${ALLOWED_ORIGIN}/${path}`;
          const metadata1 = BDLawMetadata.generate(url);
          const metadata2 = BDLawMetadata.generate(url);
          
          return metadata1.source_url === metadata2.source_url;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali characters in URL should be preserved
   */
  it('should preserve URLs with encoded Bengali characters', () => {
    // Common URL-encoded Bengali patterns
    const encodedPatterns = fc.constantFrom(
      '%E0%A6%A7%E0%A6%BE%E0%A6%B0%E0%A6%BE',  // ধারা encoded
      '%E0%A6%85%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%AF%E0%A6%BC',  // অধ্যায় encoded
      '%E0%A6%A4%E0%A6%AB%E0%A6%B8%E0%A6%BF%E0%A6%B2'  // তফসিল encoded
    );

    fc.assert(
      fc.property(
        encodedPatterns,
        (encoded) => {
          const urlWithEncoded = `${ALLOWED_ORIGIN}/search?q=${encoded}`;
          const metadata = BDLawMetadata.generate(urlWithEncoded);
          
          return metadata.source_url === urlWithEncoded;
        }
      ),
      { numRuns: 100 }
    );
  });
});
