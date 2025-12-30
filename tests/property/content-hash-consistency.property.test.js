/**
 * Property-Based Tests for Content Hash Consistency
 * 
 * Feature: cross-reference-extraction, Property 10: Content Hash Consistency
 * Validates: Requirements 10.1, 10.2
 * 
 * For any act content, computing the content hash twice SHALL produce identical results.
 * The hash SHALL be deterministic based solely on content bytes.
 */

const fc = require('fast-check');
const BDLawCorpusManifest = require('../../bdlaw-corpus-manifest.js');

describe('Property 10: Content Hash Consistency', () => {
  // Generator for content strings (various lengths and character types)
  const contentGen = fc.string({ minLength: 1, maxLength: 5000 });

  // Generator for Bengali content
  const bengaliContentGen = fc.stringOf(
    fc.constantFrom(
      'আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', 'চ', 'ছ', 'জ', 'ঝ', 
      'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 
      'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', ' ', '\n', '।', '০', 
      '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'
    ),
    { minLength: 10, maxLength: 2000 }
  );

  // Generator for mixed content (English + Bengali)
  const mixedContentGen = fc.tuple(contentGen, bengaliContentGen)
    .map(([eng, ben]) => eng + ben);

  /**
   * Property: Computing hash twice produces identical results
   * Requirements: 10.1, 10.2
   */
  it('should produce identical hash when computed twice on same content', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentGen,
        async (content) => {
          const hash1 = await BDLawCorpusManifest.computeContentHash(content);
          const hash2 = await BDLawCorpusManifest.computeContentHash(content);
          
          return hash1 === hash2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash format is "sha256:hexstring"
   * Requirements: 10.2
   */
  it('should return hash in format "sha256:hexstring"', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentGen,
        async (content) => {
          const hash = await BDLawCorpusManifest.computeContentHash(content);
          
          // Hash should start with "sha256:"
          if (!hash.startsWith('sha256:')) return false;
          
          // The hex part should be 64 characters (256 bits = 64 hex chars)
          const hexPart = hash.substring(7);
          if (hexPart.length !== 64) return false;
          
          // Should only contain valid hex characters
          return /^[0-9a-f]+$/.test(hexPart);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different content produces different hashes
   * Requirements: 10.1
   */
  it('should produce different hashes for different content', async () => {
    await fc.assert(
      fc.asyncProperty(
        contentGen,
        contentGen,
        async (content1, content2) => {
          // Skip if contents are the same
          if (content1 === content2) return true;
          
          const hash1 = await BDLawCorpusManifest.computeContentHash(content1);
          const hash2 = await BDLawCorpusManifest.computeContentHash(content2);
          
          return hash1 !== hash2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash is deterministic for Bengali content
   * Requirements: 10.1, 10.2
   */
  it('should produce consistent hash for Bengali content', async () => {
    await fc.assert(
      fc.asyncProperty(
        bengaliContentGen,
        async (content) => {
          const hash1 = await BDLawCorpusManifest.computeContentHash(content);
          const hash2 = await BDLawCorpusManifest.computeContentHash(content);
          
          return hash1 === hash2 && hash1.startsWith('sha256:');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash is deterministic for mixed content
   * Requirements: 10.1, 10.2
   */
  it('should produce consistent hash for mixed English/Bengali content', async () => {
    await fc.assert(
      fc.asyncProperty(
        mixedContentGen,
        async (content) => {
          const hash1 = await BDLawCorpusManifest.computeContentHash(content);
          const hash2 = await BDLawCorpusManifest.computeContentHash(content);
          
          return hash1 === hash2 && hash1.startsWith('sha256:');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or null content returns null
   * Requirements: 10.2
   */
  it('should return null for empty or null content', async () => {
    const nullHash = await BDLawCorpusManifest.computeContentHash(null);
    const undefinedHash = await BDLawCorpusManifest.computeContentHash(undefined);
    const emptyHash = await BDLawCorpusManifest.computeContentHash('');
    
    expect(nullHash).toBeNull();
    expect(undefinedHash).toBeNull();
    expect(emptyHash).toBeNull();
  });

  /**
   * Property: Hash is sensitive to whitespace changes
   * Requirements: 10.1
   */
  it('should produce different hashes for content with different whitespace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 100 }),
        async (content) => {
          const original = content;
          const withSpace = content + ' ';
          const withNewline = content + '\n';
          
          const hashOriginal = await BDLawCorpusManifest.computeContentHash(original);
          const hashWithSpace = await BDLawCorpusManifest.computeContentHash(withSpace);
          const hashWithNewline = await BDLawCorpusManifest.computeContentHash(withNewline);
          
          // All three should be different
          return hashOriginal !== hashWithSpace && 
                 hashOriginal !== hashWithNewline && 
                 hashWithSpace !== hashWithNewline;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Hash is case-sensitive
   * Requirements: 10.1
   */
  it('should produce different hashes for different case content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.toLowerCase() !== s.toUpperCase()),
        async (content) => {
          const lower = content.toLowerCase();
          const upper = content.toUpperCase();
          
          // Skip if they're the same (no alphabetic characters)
          if (lower === upper) return true;
          
          const hashLower = await BDLawCorpusManifest.computeContentHash(lower);
          const hashUpper = await BDLawCorpusManifest.computeContentHash(upper);
          
          return hashLower !== hashUpper;
        }
      ),
      { numRuns: 100 }
    );
  });
});
