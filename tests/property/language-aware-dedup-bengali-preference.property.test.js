/**
 * Property-Based Tests for Language-Aware Deduplication - Bengali Preference
 * 
 * Feature: cross-reference-extraction, Property 15: Language-Aware Deduplication - Bengali Preference
 * Validates: Requirements 11.5
 * 
 * For any act that exists in English, when attempting to extract a Bengali version,
 * the system SHALL allow extraction and replace the English version.
 */

const fc = require('fast-check');
const BDLawCorpusManifest = require('../../bdlaw-corpus-manifest.js');

describe('Property 15: Language-Aware Deduplication - Bengali Preference', () => {
  // Generator for valid internal IDs (numeric strings)
  const internalIdGen = fc.integer({ min: 1, max: 9999 }).map(n => n.toString());

  // Generator for volume numbers
  const volumeNumberGen = fc.integer({ min: 1, max: 50 }).map(n => n.toString());

  // Generator for act titles (Bengali-like strings)
  const bengaliTitleGen = fc.stringOf(
    fc.constantFrom('আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', 'চ', 'ছ', 'জ', 'ঝ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', ' '),
    { minLength: 5, maxLength: 50 }
  );

  // Generator for English titles
  const englishTitleGen = fc.stringOf(
    fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', ' '),
    { minLength: 5, maxLength: 50 }
  );

  // Generator for content (random text)
  const contentGen = fc.string({ minLength: 100, maxLength: 1000 });

  // Generator for an English act object
  const englishActGen = fc.record({
    internal_id: internalIdGen,
    title: englishTitleGen,
    volume_number: volumeNumberGen,
    content: contentGen,
    content_language: fc.constant('english'),
    capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
    cross_reference_count: fc.integer({ min: 0, max: 20 })
  });

  /**
   * Property: Bengali extraction is allowed when English version exists
   * Requirements: 11.5
   */
  it('should allow Bengali extraction when English version exists', () => {
    fc.assert(
      fc.property(
        englishActGen,
        (englishAct) => {
          // Create manifest and add the English act
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, englishAct);
          
          // Check if Bengali extraction is allowed
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            englishAct.internal_id, 
            'bengali'
          );
          
          return result.isDuplicate === true &&
                 result.allowExtraction === true &&
                 result.replaceExisting === true &&
                 result.existingLanguage === 'english' &&
                 result.newLanguage === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali extraction message indicates replacement
   * Requirements: 11.5
   */
  it('should indicate Bengali will replace English in message', () => {
    fc.assert(
      fc.property(
        englishActGen,
        (englishAct) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, englishAct);
          
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            englishAct.internal_id, 
            'bengali'
          );
          
          return result.message !== undefined &&
                 typeof result.message === 'string' &&
                 result.message.toLowerCase().includes('bengali') &&
                 (result.message.toLowerCase().includes('replace') || 
                  result.message.toLowerCase().includes('preferred'));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bengali extraction returns existing entry details
   * Requirements: 11.5
   */
  it('should return existing English entry details when Bengali is attempted', () => {
    fc.assert(
      fc.property(
        englishActGen,
        (englishAct) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, englishAct);
          
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            englishAct.internal_id, 
            'bengali'
          );
          
          return result.existingEntry !== undefined &&
                 result.existingEntry.internal_id === englishAct.internal_id &&
                 result.existingEntry.content_language === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: New act (no existing) allows extraction regardless of language
   * Requirements: 11.2
   */
  it('should allow extraction for new acts regardless of language', () => {
    fc.assert(
      fc.property(
        internalIdGen,
        fc.constantFrom('bengali', 'english'),
        (internalId, language) => {
          const manifest = BDLawCorpusManifest.createEmptyManifest();
          
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            internalId, 
            language
          );
          
          return result.isDuplicate === false &&
                 result.allowExtraction === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Default language is English when not specified
   * Requirements: 11.5
   */
  it('should treat missing content_language as English', () => {
    fc.assert(
      fc.property(
        internalIdGen,
        volumeNumberGen,
        englishTitleGen,
        contentGen,
        (internalId, volumeNumber, title, content) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add act without content_language (should default to English)
          const actWithoutLanguage = {
            internal_id: internalId,
            title: title,
            volume_number: volumeNumber,
            content: content,
            // No content_language specified
            capturedAt: new Date().toISOString()
          };
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, actWithoutLanguage);
          
          // Bengali should be allowed to replace
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            internalId, 
            'bengali'
          );
          
          return result.allowExtraction === true &&
                 result.replaceExisting === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Handle invalid inputs gracefully
   */
  it('should handle invalid inputs gracefully', () => {
    // Null/undefined manifest
    expect(BDLawCorpusManifest.checkLanguageAwareDuplicate(null, '123', 'bengali').allowExtraction).toBe(true);
    expect(BDLawCorpusManifest.checkLanguageAwareDuplicate(undefined, '123', 'bengali').allowExtraction).toBe(true);
    
    // Null/undefined internalId
    const manifest = BDLawCorpusManifest.createEmptyManifest();
    expect(BDLawCorpusManifest.checkLanguageAwareDuplicate(manifest, null, 'bengali').allowExtraction).toBe(true);
    expect(BDLawCorpusManifest.checkLanguageAwareDuplicate(manifest, undefined, 'bengali').allowExtraction).toBe(true);
  });
});
