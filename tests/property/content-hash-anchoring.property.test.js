/**
 * Property-Based Tests for Content Hash Anchoring
 * 
 * Feature: legal-integrity-enhancement, Property 2: Content Hash Anchoring
 * Validates: Requirements 1.5
 * 
 * For any act, computing SHA-256 hash of content_raw SHALL produce the same value
 * as _metadata.content_hash. The hash SHALL be deterministic and computed
 * exclusively from content_raw.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');

describe('Property 2: Content Hash Anchoring', () => {
  // Generator for content strings (various lengths and character types)
  const contentGen = fc.string({ minLength: 1, maxLength: 5000 });

  // Generator for Bengali content
  const bengaliContentGen = fc.stringOf(
    fc.constantFrom(
      '\u0986', '\u0987', '\u0989', '\u098F', '\u0993', '\u0995', '\u0996', '\u0997', '\u0998', '\u099A', '\u099B', '\u099C', '\u099D', 
      '\u099F', '\u09A0', '\u09A1', '\u09A2', '\u09A3', '\u09A4', '\u09A5', '\u09A6', '\u09A7', '\u09A8', '\u09AA', '\u09AB', '\u09AC', 
      '\u09AD', '\u09AE', '\u09AF', '\u09B0', '\u09B2', '\u09B6', '\u09B7', '\u09B8', '\u09B9', ' ', '\n', '\u0964', '\u09E6', 
      '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'
    ),
    { minLength: 10, maxLength: 2000 }
  );

  // Generator for mixed content (English + Bengali)
  const mixedContentGen = fc.tuple(contentGen, bengaliContentGen)
    .map(([eng, ben]) => eng + ben);

  /**
   * Property: Hash is computed from content_raw exclusively
   * Requirements: 1.5
   */
  it('should compute hash from content_raw exclusively', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentGen,
        async (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          const hashResult = await BDLawExtractor.computeContentHash(threeVersion);
          
          // Hash should be computed and hash_source should be content_raw
          return hashResult.hash_source === 'content_raw' && 
                 hashResult.content_hash !== null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash is deterministic - same content_raw produces same hash
   * Requirements: 1.5
   */
  it('should produce identical hash for same content_raw', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentGen,
        async (inputText) => {
          const threeVersion1 = BDLawExtractor.createThreeVersionContent(inputText);
          const threeVersion2 = BDLawExtractor.createThreeVersionContent(inputText);
          
          const hashResult1 = await BDLawExtractor.computeContentHash(threeVersion1);
          const hashResult2 = await BDLawExtractor.computeContentHash(threeVersion2);
          
          return hashResult1.content_hash === hashResult2.content_hash;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash format is "sha256:hexstring"
   * Requirements: 1.5
   */
  it('should return hash in format "sha256:hexstring"', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentGen,
        async (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          const hashResult = await BDLawExtractor.computeContentHash(threeVersion);
          
          // Hash should start with "sha256:"
          if (!hashResult.content_hash.startsWith('sha256:')) return false;
          
          // The hex part should be 64 characters (256 bits = 64 hex chars)
          const hexPart = hashResult.content_hash.substring(7);
          if (hexPart.length !== 64) return false;
          
          // Should only contain valid hex characters
          return /^[0-9a-f]+$/.test(hexPart);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different content_raw produces different hashes
   * Requirements: 1.5
   */
  it('should produce different hashes for different content_raw', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentGen,
        contentGen,
        async (content1, content2) => {
          // Skip if contents are the same
          if (content1 === content2) return true;
          
          const threeVersion1 = BDLawExtractor.createThreeVersionContent(content1);
          const threeVersion2 = BDLawExtractor.createThreeVersionContent(content2);
          
          const hashResult1 = await BDLawExtractor.computeContentHash(threeVersion1);
          const hashResult2 = await BDLawExtractor.computeContentHash(threeVersion2);
          
          return hashResult1.content_hash !== hashResult2.content_hash;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash is consistent for Bengali content
   * Requirements: 1.5
   */
  it('should produce consistent hash for Bengali content_raw', async () => {
    await fc.assert(
      fc.asyncProperty(
        bengaliContentGen,
        async (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          const hashResult1 = await BDLawExtractor.computeContentHash(threeVersion);
          const hashResult2 = await BDLawExtractor.computeContentHash(threeVersion);
          
          return hashResult1.content_hash === hashResult2.content_hash &&
                 hashResult1.hash_source === 'content_raw';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash is consistent for mixed content
   * Requirements: 1.5
   */
  it('should produce consistent hash for mixed English/Bengali content_raw', async () => {
    await fc.assert(
      fc.asyncProperty(
        mixedContentGen,
        async (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          const hashResult1 = await BDLawExtractor.computeContentHash(threeVersion);
          const hashResult2 = await BDLawExtractor.computeContentHash(threeVersion);
          
          return hashResult1.content_hash === hashResult2.content_hash &&
                 hashResult1.hash_source === 'content_raw';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash computed from three-version object equals hash from raw string
   * Requirements: 1.5 - Hash is anchored to content_raw
   */
  it('should produce same hash whether passed object or raw string', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentGen,
        async (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          
          // Hash from three-version object
          const hashFromObject = await BDLawExtractor.computeContentHash(threeVersion);
          
          // Hash from raw string directly (legacy support)
          const hashFromString = await BDLawExtractor.computeContentHash(inputText);
          
          // Both should produce the same hash since content_raw === inputText
          return hashFromObject.content_hash === hashFromString.content_hash;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash is sensitive to whitespace changes in content_raw
   * Requirements: 1.5
   */
  it('should produce different hashes for content_raw with different whitespace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 100 }),
        async (content) => {
          const original = content;
          const withSpace = content + ' ';
          const withNewline = content + '\n';
          
          const threeVersion1 = BDLawExtractor.createThreeVersionContent(original);
          const threeVersion2 = BDLawExtractor.createThreeVersionContent(withSpace);
          const threeVersion3 = BDLawExtractor.createThreeVersionContent(withNewline);
          
          const hashOriginal = await BDLawExtractor.computeContentHash(threeVersion1);
          const hashWithSpace = await BDLawExtractor.computeContentHash(threeVersion2);
          const hashWithNewline = await BDLawExtractor.computeContentHash(threeVersion3);
          
          // All three should be different
          return hashOriginal.content_hash !== hashWithSpace.content_hash && 
                 hashOriginal.content_hash !== hashWithNewline.content_hash && 
                 hashWithSpace.content_hash !== hashWithNewline.content_hash;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content returns null hash with hash_source
   * Requirements: 1.5
   */
  it('should return null hash for empty or null content with hash_source metadata', async () => {
    const nullResult = await BDLawExtractor.computeContentHash(null);
    const undefinedResult = await BDLawExtractor.computeContentHash(undefined);
    const emptyThreeVersion = BDLawExtractor.createThreeVersionContent('');
    const emptyResult = await BDLawExtractor.computeContentHash(emptyThreeVersion);
    
    expect(nullResult.content_hash).toBeNull();
    expect(nullResult.hash_source).toBe('content_raw');
    
    expect(undefinedResult.content_hash).toBeNull();
    expect(undefinedResult.hash_source).toBe('content_raw');
    
    expect(emptyResult.content_hash).toBeNull();
    expect(emptyResult.hash_source).toBe('content_raw');
  });

  /**
   * Property: hash_source is always 'content_raw'
   * Requirements: 1.5
   */
  it('should always set hash_source to content_raw', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentGen,
        async (inputText) => {
          const threeVersion = BDLawExtractor.createThreeVersionContent(inputText);
          const hashResult = await BDLawExtractor.computeContentHash(threeVersion);
          
          return hashResult.hash_source === 'content_raw';
        }
      ),
      { numRuns: 100 }
    );
  });
});
