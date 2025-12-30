/**
 * Property-Based Tests for Volume Number Extraction
 * 
 * Feature: bdlawcorpus-mode, Property 21: Volume Number Extraction Accuracy
 * Validates: Requirements 29.2, 29.5
 * 
 * Property: For any URL matching /volume-{XX}.html, the extractor SHALL correctly 
 * parse and return the volume number; for non-volume URLs, SHALL return "unknown"
 */

const fc = require('fast-check');
const BDLawQueue = require('../../bdlaw-queue.js');

describe('Property 21: Volume Number Extraction Accuracy', () => {
  
  // Generator for valid volume numbers (1-99)
  const volumeNumberArb = fc.integer({ min: 1, max: 99 }).map(n => n.toString());

  // Generator for valid volume URLs
  const validVolumeUrlArb = volumeNumberArb.map(num => 
    `http://bdlaws.minlaw.gov.bd/volume-${num}.html`
  );

  // Generator for volume URLs with different base paths
  const volumeUrlWithPathArb = fc.tuple(
    fc.constantFrom('http://bdlaws.minlaw.gov.bd', 'https://bdlaws.minlaw.gov.bd'),
    volumeNumberArb
  ).map(([base, num]) => `${base}/volume-${num}.html`);

  // Generator for non-volume URLs (act pages, range index, etc.)
  const nonVolumeUrlArb = fc.oneof(
    // Act details URLs
    fc.integer({ min: 1, max: 9999 }).map(n => 
      `http://bdlaws.minlaw.gov.bd/act-details-${n}.html`
    ),
    // Act summary URLs
    fc.integer({ min: 1, max: 9999 }).map(n => 
      `http://bdlaws.minlaw.gov.bd/act-${n}.html`
    ),
    // Range index URL
    fc.constant('http://bdlaws.minlaw.gov.bd/laws-of-bangladesh.html'),
    // Random URLs that don't contain volume pattern
    fc.webUrl().filter(url => !url.includes('/volume-')),
    // Empty or invalid strings (excluding relative volume URLs)
    fc.constantFrom('', 'not-a-url', 'volume-56', 'volume-56.html')
  );

  /**
   * Property: Valid volume URLs return correct volume number
   * Requirements: 29.2 - Extract volume_number from URL pattern /volume-{XX}.html
   */
  it('should extract correct volume number from valid volume URLs', () => {
    fc.assert(
      fc.property(
        volumeNumberArb,
        (volumeNum) => {
          const url = `http://bdlaws.minlaw.gov.bd/volume-${volumeNum}.html`;
          const extracted = BDLawQueue.extractVolumeNumber(url);
          
          return extracted === volumeNum;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Volume URLs with different protocols still extract correctly
   * Requirements: 29.2
   */
  it('should extract volume number regardless of protocol', () => {
    fc.assert(
      fc.property(
        volumeNumberArb,
        fc.constantFrom('http', 'https'),
        (volumeNum, protocol) => {
          const url = `${protocol}://bdlaws.minlaw.gov.bd/volume-${volumeNum}.html`;
          const extracted = BDLawQueue.extractVolumeNumber(url);
          
          return extracted === volumeNum;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-volume URLs return "unknown"
   * Requirements: 29.5 - Return "unknown" for non-volume URLs
   */
  it('should return "unknown" for non-volume URLs', () => {
    fc.assert(
      fc.property(
        nonVolumeUrlArb,
        (url) => {
          const extracted = BDLawQueue.extractVolumeNumber(url);
          
          return extracted === 'unknown';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Act detail URLs return "unknown"
   * Requirements: 29.5 - Direct Act_Detail_Page captures should get "unknown"
   */
  it('should return "unknown" for act detail URLs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999 }),
        (actNum) => {
          const url = `http://bdlaws.minlaw.gov.bd/act-details-${actNum}.html`;
          const extracted = BDLawQueue.extractVolumeNumber(url);
          
          return extracted === 'unknown';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Null/undefined inputs return "unknown"
   * Requirements: 29.5 - Handle invalid inputs gracefully
   */
  it('should return "unknown" for null/undefined inputs', () => {
    expect(BDLawQueue.extractVolumeNumber(null)).toBe('unknown');
    expect(BDLawQueue.extractVolumeNumber(undefined)).toBe('unknown');
    expect(BDLawQueue.extractVolumeNumber('')).toBe('unknown');
  });

  /**
   * Property: Non-string inputs return "unknown"
   * Requirements: 29.5 - Handle invalid inputs gracefully
   */
  it('should return "unknown" for non-string inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.boolean(),
          fc.object(),
          fc.array(fc.anything())
        ),
        (input) => {
          const extracted = BDLawQueue.extractVolumeNumber(input);
          
          return extracted === 'unknown';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Volume number extraction is deterministic
   * Requirements: 29.2 - Same URL always returns same volume number
   */
  it('should be deterministic - same URL always returns same result', () => {
    fc.assert(
      fc.property(
        validVolumeUrlArb,
        (url) => {
          const result1 = BDLawQueue.extractVolumeNumber(url);
          const result2 = BDLawQueue.extractVolumeNumber(url);
          const result3 = BDLawQueue.extractVolumeNumber(url);
          
          return result1 === result2 && result2 === result3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Volume numbers with leading zeros are preserved
   * Requirements: 29.2 - Correctly parse volume number
   */
  it('should handle volume numbers correctly (no leading zeros in pattern)', () => {
    // The regex pattern /volume-(\d+)\.html/ captures digits as-is
    // Volume URLs typically don't have leading zeros, but if they did,
    // the extraction should still work
    const url1 = 'http://bdlaws.minlaw.gov.bd/volume-1.html';
    const url2 = 'http://bdlaws.minlaw.gov.bd/volume-01.html';
    const url3 = 'http://bdlaws.minlaw.gov.bd/volume-56.html';
    
    expect(BDLawQueue.extractVolumeNumber(url1)).toBe('1');
    expect(BDLawQueue.extractVolumeNumber(url2)).toBe('01');
    expect(BDLawQueue.extractVolumeNumber(url3)).toBe('56');
  });

  /**
   * Property: URLs with query parameters still extract volume number
   * Requirements: 29.2 - Extract from URL pattern
   */
  it('should extract volume number from URLs with query parameters', () => {
    fc.assert(
      fc.property(
        volumeNumberArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        (volumeNum, queryValue) => {
          // Filter out characters that would break the URL
          const safeQueryValue = queryValue.replace(/[&=?#]/g, '');
          const url = `http://bdlaws.minlaw.gov.bd/volume-${volumeNum}.html?param=${safeQueryValue}`;
          const extracted = BDLawQueue.extractVolumeNumber(url);
          
          return extracted === volumeNum;
        }
      ),
      { numRuns: 100 }
    );
  });
});
