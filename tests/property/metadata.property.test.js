/**
 * Property-Based Tests for Metadata Completeness and Validation
 * 
 * Feature: bdlawcorpus-mode, Property 4: Metadata Completeness
 * Feature: bdlawcorpus-mode, Property 5: Metadata Validation Rejection
 * Validates: Requirements 8.1, 8.2
 */

const fc = require('fast-check');
const BDLawMetadata = require('../../bdlaw-metadata.js');

describe('Property 4: Metadata Completeness', () => {
  const ALLOWED_ORIGIN = 'http://bdlaws.minlaw.gov.bd';

  /**
   * Property: For any generated metadata object, all required fields SHALL be present and non-empty
   */
  it('should generate metadata with all required fields present and non-empty for any valid URL', () => {
    // Generate random valid bdlaws URLs
    const validPaths = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', '-', '_', '/', '.', 'h', 't', 'm', 'l'),
      { minLength: 1, maxLength: 30 }
    );

    fc.assert(
      fc.property(
        validPaths,
        (path) => {
          const url = `${ALLOWED_ORIGIN}/${path}`;
          const metadata = BDLawMetadata.generate(url);
          
          // Check all required fields are present and non-empty
          for (const field of BDLawMetadata.REQUIRED_FIELDS) {
            if (!(field in metadata)) {
              return false;
            }
            if (metadata[field] === null || metadata[field] === undefined || metadata[field] === '') {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Generated metadata should always pass validation
   */
  it('should generate metadata that always passes validation', () => {
    const validPaths = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', '-', '_', '/', '.', 'h', 't', 'm', 'l'),
      { minLength: 1, maxLength: 30 }
    );

    fc.assert(
      fc.property(
        validPaths,
        (path) => {
          const url = `${ALLOWED_ORIGIN}/${path}`;
          const metadata = BDLawMetadata.generate(url);
          const validation = BDLawMetadata.validate(metadata);
          
          return validation.valid === true && validation.missing.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Metadata should contain correct static values
   */
  it('should generate metadata with correct static field values', () => {
    const validPaths = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', '-', '_', '/', '.', 'h', 't', 'm', 'l'),
      { minLength: 1, maxLength: 30 }
    );

    fc.assert(
      fc.property(
        validPaths,
        (path) => {
          const url = `${ALLOWED_ORIGIN}/${path}`;
          const metadata = BDLawMetadata.generate(url);
          
          return (
            metadata.source === 'bdlaws.minlaw.gov.bd' &&
            metadata.scraping_method === 'manual page-level extraction' &&
            metadata.tool === 'BDLawCorpus' &&
            metadata.language === 'bn' &&
            metadata.research_purpose === 'academic legal corpus construction'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: scraped_at should be a valid ISO 8601 timestamp
   */
  it('should generate scraped_at as valid ISO 8601 timestamp', () => {
    const validPaths = fc.stringOf(
      fc.constantFrom('a', 'b', 'c', '1', '2', '3', '-', '_', '/', '.', 'h', 't', 'm', 'l'),
      { minLength: 1, maxLength: 30 }
    );

    fc.assert(
      fc.property(
        validPaths,
        (path) => {
          const url = `${ALLOWED_ORIGIN}/${path}`;
          const metadata = BDLawMetadata.generate(url);
          
          // Check if scraped_at is a valid ISO 8601 date
          const date = new Date(metadata.scraped_at);
          return !isNaN(date.getTime()) && metadata.scraped_at.includes('T');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 5: Metadata Validation Rejection', () => {
  /**
   * Property: For any metadata object missing one or more required fields,
   * the validator SHALL return valid: false and list all missing fields
   */
  it('should reject metadata missing any required field and list the missing field', () => {
    // Generate metadata with one field removed
    fc.assert(
      fc.property(
        fc.constantFrom(...BDLawMetadata.REQUIRED_FIELDS),
        (fieldToRemove) => {
          const metadata = BDLawMetadata.generate('http://bdlaws.minlaw.gov.bd/test.html');
          delete metadata[fieldToRemove];
          
          const validation = BDLawMetadata.validate(metadata);
          
          return (
            validation.valid === false &&
            validation.missing.includes(fieldToRemove)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Metadata with empty string values should be rejected
   */
  it('should reject metadata with empty string values for required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BDLawMetadata.REQUIRED_FIELDS),
        (fieldToEmpty) => {
          const metadata = BDLawMetadata.generate('http://bdlaws.minlaw.gov.bd/test.html');
          metadata[fieldToEmpty] = '';
          
          const validation = BDLawMetadata.validate(metadata);
          
          return (
            validation.valid === false &&
            validation.missing.includes(fieldToEmpty)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Metadata with null values should be rejected
   */
  it('should reject metadata with null values for required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BDLawMetadata.REQUIRED_FIELDS),
        (fieldToNull) => {
          const metadata = BDLawMetadata.generate('http://bdlaws.minlaw.gov.bd/test.html');
          metadata[fieldToNull] = null;
          
          const validation = BDLawMetadata.validate(metadata);
          
          return (
            validation.valid === false &&
            validation.missing.includes(fieldToNull)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Null or non-object inputs should be rejected with all fields missing
   */
  it('should reject null/undefined/non-object inputs with all fields listed as missing', () => {
    const invalidInputs = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.string(),
      fc.integer(),
      fc.boolean()
    );

    fc.assert(
      fc.property(
        invalidInputs,
        (input) => {
          const validation = BDLawMetadata.validate(input);
          
          return (
            validation.valid === false &&
            validation.missing.length === BDLawMetadata.REQUIRED_FIELDS.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple missing fields should all be listed
   */
  it('should list all missing fields when multiple are absent', () => {
    // Generate subsets of fields to remove
    fc.assert(
      fc.property(
        fc.subarray(BDLawMetadata.REQUIRED_FIELDS, { minLength: 1 }),
        (fieldsToRemove) => {
          const metadata = BDLawMetadata.generate('http://bdlaws.minlaw.gov.bd/test.html');
          
          for (const field of fieldsToRemove) {
            delete metadata[field];
          }
          
          const validation = BDLawMetadata.validate(metadata);
          
          // All removed fields should be in the missing list
          return (
            validation.valid === false &&
            fieldsToRemove.every(field => validation.missing.includes(field))
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
