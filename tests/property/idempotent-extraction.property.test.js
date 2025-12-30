/**
 * Property-Based Tests for Idempotent Extraction
 * 
 * Feature: cross-reference-extraction, Property 13: Idempotent Extraction
 * Validates: Requirements 10.1
 * 
 * For any act extracted twice from the same source URL without source changes,
 * the content field (excluding _metadata timestamps) SHALL be byte-identical.
 */

const fc = require('fast-check');
const BDLawCorpusManifest = require('../../bdlaw-corpus-manifest.js');

describe('Property 13: Idempotent Extraction', () => {
  // Generator for valid internal IDs (numeric strings)
  const internalIdGen = fc.integer({ min: 1, max: 9999 }).map(n => n.toString());

  // Generator for content strings
  const contentGen = fc.string({ minLength: 100, maxLength: 5000 });

  // Generator for Bengali content
  const bengaliContentGen = fc.stringOf(
    fc.constantFrom(
      'আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', 'চ', 'ছ', 'জ', 'ঝ', 
      'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 
      'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', ' ', '\n', '।', '০', 
      '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'
    ),
    { minLength: 100, maxLength: 2000 }
  );

  // Generator for act titles
  const titleGen = fc.stringOf(
    fc.constantFrom('আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', 'চ', 'ছ', 'জ', 'ঝ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', ' '),
    { minLength: 5, maxLength: 50 }
  );

  // Generator for volume numbers
  const volumeNumberGen = fc.integer({ min: 1, max: 50 }).map(n => n.toString());

  /**
   * Property: checkExtractionIdempotency returns isIdentical: true for same content
   * Requirements: 10.1
   */
  it('should return isIdentical: true when content hash matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        internalIdGen,
        titleGen,
        volumeNumberGen,
        contentGen,
        async (internalId, title, volumeNumber, content) => {
          // Create manifest and add act with content hash
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          const contentHash = await BDLawCorpusManifest.computeContentHash(content);
          
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            content_hash: contentHash,
            capturedAt: new Date().toISOString()
          });
          
          // Check idempotency with same content
          const result = await BDLawCorpusManifest.checkExtractionIdempotency(
            manifest, 
            internalId, 
            content
          );
          
          return result.isIdentical === true && 
                 result.isNew === false &&
                 result.message === 'Content unchanged from previous extraction';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: checkExtractionIdempotency returns source_changed for different content
   * Requirements: 10.1, 10.3
   */
  it('should return source_changed flag when content differs', async () => {
    await fc.assert(
      fc.asyncProperty(
        internalIdGen,
        titleGen,
        volumeNumberGen,
        contentGen,
        contentGen,
        async (internalId, title, volumeNumber, originalContent, newContent) => {
          // Skip if contents are the same
          if (originalContent === newContent) return true;
          
          // Create manifest and add act with original content hash
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          const originalHash = await BDLawCorpusManifest.computeContentHash(originalContent);
          
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: originalContent,
            content_hash: originalHash,
            capturedAt: new Date().toISOString()
          });
          
          // Check idempotency with different content
          const result = await BDLawCorpusManifest.checkExtractionIdempotency(
            manifest, 
            internalId, 
            newContent
          );
          
          return result.isIdentical === false && 
                 result.isNew === false &&
                 result.flag === 'source_changed' &&
                 result.previousHash === originalHash &&
                 result.newHash !== originalHash;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: checkExtractionIdempotency returns isNew: true for new acts
   * Requirements: 10.1
   */
  it('should return isNew: true for acts not in manifest', async () => {
    await fc.assert(
      fc.asyncProperty(
        internalIdGen,
        contentGen,
        async (internalId, content) => {
          // Create empty manifest
          const manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Check idempotency for non-existent act
          const result = await BDLawCorpusManifest.checkExtractionIdempotency(
            manifest, 
            internalId, 
            content
          );
          
          return result.isNew === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: checkExtractionIdempotency handles missing previous hash
   * Requirements: 10.1
   */
  it('should handle acts without previous content hash', async () => {
    await fc.assert(
      fc.asyncProperty(
        internalIdGen,
        titleGen,
        volumeNumberGen,
        contentGen,
        async (internalId, title, volumeNumber, content) => {
          // Create manifest and add act WITHOUT content hash
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            // No content_hash provided
            capturedAt: new Date().toISOString()
          });
          
          // Check idempotency
          const result = await BDLawCorpusManifest.checkExtractionIdempotency(
            manifest, 
            internalId, 
            content
          );
          
          return result.isNew === false && 
                 result.isIdentical === false &&
                 result.flag === 'no_previous_hash';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Idempotency check is consistent for Bengali content
   * Requirements: 10.1
   */
  it('should correctly detect identical Bengali content', async () => {
    await fc.assert(
      fc.asyncProperty(
        internalIdGen,
        titleGen,
        volumeNumberGen,
        bengaliContentGen,
        async (internalId, title, volumeNumber, content) => {
          // Create manifest and add act with content hash
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          const contentHash = await BDLawCorpusManifest.computeContentHash(content);
          
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            content_hash: contentHash,
            capturedAt: new Date().toISOString()
          });
          
          // Check idempotency with same Bengali content
          const result = await BDLawCorpusManifest.checkExtractionIdempotency(
            manifest, 
            internalId, 
            content
          );
          
          return result.isIdentical === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Idempotency check includes both hashes in result
   * Requirements: 10.1, 10.3
   */
  it('should include both previous and new hashes in result', async () => {
    await fc.assert(
      fc.asyncProperty(
        internalIdGen,
        titleGen,
        volumeNumberGen,
        contentGen,
        async (internalId, title, volumeNumber, content) => {
          // Create manifest and add act with content hash
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          const contentHash = await BDLawCorpusManifest.computeContentHash(content);
          
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            content_hash: contentHash,
            capturedAt: new Date().toISOString()
          });
          
          // Check idempotency
          const result = await BDLawCorpusManifest.checkExtractionIdempotency(
            manifest, 
            internalId, 
            content
          );
          
          // Both hashes should be present and equal for identical content
          return result.previousHash === contentHash && 
                 result.newHash === contentHash;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Handle null/undefined manifest gracefully
   */
  it('should handle null/undefined manifest gracefully', async () => {
    const content = 'test content';
    
    const nullResult = await BDLawCorpusManifest.checkExtractionIdempotency(null, '123', content);
    const undefinedResult = await BDLawCorpusManifest.checkExtractionIdempotency(undefined, '123', content);
    
    expect(nullResult.isNew).toBe(true);
    expect(undefinedResult.isNew).toBe(true);
  });

  /**
   * Property: Whitespace changes are detected as source_changed
   * Requirements: 10.1
   */
  it('should detect whitespace changes as source_changed', async () => {
    await fc.assert(
      fc.asyncProperty(
        internalIdGen,
        titleGen,
        volumeNumberGen,
        fc.string({ minLength: 10, maxLength: 100 }),
        async (internalId, title, volumeNumber, content) => {
          // Create manifest and add act with content hash
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          const contentHash = await BDLawCorpusManifest.computeContentHash(content);
          
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            content_hash: contentHash,
            capturedAt: new Date().toISOString()
          });
          
          // Check idempotency with content that has extra whitespace
          const modifiedContent = content + ' ';
          const result = await BDLawCorpusManifest.checkExtractionIdempotency(
            manifest, 
            internalId, 
            modifiedContent
          );
          
          return result.isIdentical === false && 
                 result.flag === 'source_changed';
        }
      ),
      { numRuns: 100 }
    );
  });
});
