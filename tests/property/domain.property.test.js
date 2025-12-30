/**
 * Property-Based Tests for Domain Restriction
 * 
 * Feature: bdlawcorpus-mode, Property 1: Domain Restriction Enforcement
 * Validates: Requirements 1.1, 1.2
 * 
 * Property: For any URL string, the page detector SHALL return 
 * isAllowedDomain() = true if and only if the URL starts with 
 * http://bdlaws.minlaw.gov.bd/
 */

const fc = require('fast-check');
const BDLawPageDetector = require('../../bdlaw-page-detector.js');

describe('Property 1: Domain Restriction Enforcement', () => {
  const ALLOWED_ORIGIN = 'http://bdlaws.minlaw.gov.bd';

  /**
   * Property: URLs starting with the allowed origin should return true
   */
  it('should return true for any URL starting with http://bdlaws.minlaw.gov.bd/', () => {
    fc.assert(
      fc.property(
        // Generate random valid paths
        fc.stringOf(fc.constantFrom(
          'a', 'b', 'c', '1', '2', '3', '-', '_', '/', '.', 'html'
        ), { minLength: 1, maxLength: 50 }),
        (path) => {
          const url = `${ALLOWED_ORIGIN}/${path}`;
          return BDLawPageDetector.isAllowedDomain(url) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: URLs NOT starting with the allowed origin should return false
   */
  it('should return false for any URL not starting with http://bdlaws.minlaw.gov.bd/', () => {
    // Generate various non-matching domains
    const otherDomains = fc.oneof(
      fc.constant('http://example.com'),
      fc.constant('https://bdlaws.minlaw.gov.bd'),  // HTTPS instead of HTTP
      fc.constant('http://www.bdlaws.minlaw.gov.bd'),  // www subdomain
      fc.constant('http://bdlaws.gov.bd'),
      fc.constant('http://minlaw.gov.bd'),
      fc.constant('https://google.com'),
      fc.constant('http://localhost'),
      fc.constant('http://bdlaws.minlaw.gov.bd.fake.com'),  // Domain spoofing attempt
      fc.webUrl()  // Random web URLs
    );

    fc.assert(
      fc.property(
        otherDomains,
        (url) => {
          // Skip if the random URL happens to match our allowed origin
          if (url.startsWith(ALLOWED_ORIGIN)) {
            return true;  // Skip this case
          }
          return BDLawPageDetector.isAllowedDomain(url) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid inputs should return false
   */
  it('should return false for any invalid input (null, undefined, non-string)', () => {
    const invalidInputs = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.integer(),
      fc.boolean(),
      fc.array(fc.string()),
      fc.object()
    );

    fc.assert(
      fc.property(
        invalidInputs,
        (input) => {
          return BDLawPageDetector.isAllowedDomain(input) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty strings should return false
   */
  it('should return false for empty strings', () => {
    expect(BDLawPageDetector.isAllowedDomain('')).toBe(false);
  });

  /**
   * Property: The function should be deterministic
   */
  it('should return the same result for the same URL (determinism)', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (url) => {
          const result1 = BDLawPageDetector.isAllowedDomain(url);
          const result2 = BDLawPageDetector.isAllowedDomain(url);
          return result1 === result2;
        }
      ),
      { numRuns: 100 }
    );
  });
});
