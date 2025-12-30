/**
 * Property-Based Tests for Language-Aware Deduplication - English Blocked
 * 
 * Feature: cross-reference-extraction, Property 16: Language-Aware Deduplication - English Blocked
 * Validates: Requirements 11.4
 * 
 * For any act that exists in Bengali, when attempting to extract an English version,
 * the system SHALL block extraction and display a warning.
 */

const fc = require('fast-check');
const BDLawCorpusManifest = require('../../bdlaw-corpus-manifest.js');

describe('Property 16: Language-Aware Deduplication - English Blocked', () => {
  // Generator for valid internal IDs (numeric strings)
  const internalIdGen = fc.integer({ min: 1, max: 9999 }).map(n => n.toString());

  // Generator for volume numbers
  const volumeNumberGen = fc.integer({ min: 1, max: 50 }).map(n => n.toString());

  // Generator for act titles (Bengali-like strings)
  const bengaliTitleGen = fc.stringOf(
    fc.constantFrom('আ', 'ই', 'উ', 'এ', 'ও', 'ক', 'খ', 'গ', 'ঘ', 'চ', 'ছ', 'জ', 'ঝ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ', ' '),
    { minLength: 5, maxLength: 50 }
  );

  // Generator for content (random text)
  const contentGen = fc.string({ minLength: 100, maxLength: 1000 });

  // Generator for a Bengali act object
  const bengaliActGen = fc.record({
    internal_id: internalIdGen,
    title: bengaliTitleGen,
    volume_number: volumeNumberGen,
    content: contentGen,
    content_language: fc.constant('bengali'),
    capturedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
    cross_reference_count: fc.integer({ min: 0, max: 20 })
  });

  /**
   * Property: English extraction is blocked when Bengali version exists
   * Requirements: 11.4
   */
  it('should block English extraction when Bengali version exists', () => {
    fc.assert(
      fc.property(
        bengaliActGen,
        (bengaliAct) => {
          // Create manifest and add the Bengali act
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, bengaliAct);
          
          // Check if English extraction is blocked
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            bengaliAct.internal_id, 
            'english'
          );
          
          return result.isDuplicate === true &&
                 result.allowExtraction === false &&
                 result.existingLanguage === 'bengali' &&
                 result.newLanguage === 'english';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: English blocked message indicates Bengali is preferred
   * Requirements: 11.4
   */
  it('should indicate Bengali is preferred in blocking message', () => {
    fc.assert(
      fc.property(
        bengaliActGen,
        (bengaliAct) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, bengaliAct);
          
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            bengaliAct.internal_id, 
            'english'
          );
          
          return result.message !== undefined &&
                 typeof result.message === 'string' &&
                 result.message.toLowerCase().includes('bengali') &&
                 (result.message.toLowerCase().includes('preferred') || 
                  result.message.toLowerCase().includes('blocked'));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: English blocked returns existing Bengali entry details
   * Requirements: 11.4
   */
  it('should return existing Bengali entry details when English is blocked', () => {
    fc.assert(
      fc.property(
        bengaliActGen,
        (bengaliAct) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, bengaliAct);
          
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            bengaliAct.internal_id, 
            'english'
          );
          
          return result.existingEntry !== undefined &&
                 result.existingEntry.internal_id === bengaliAct.internal_id &&
                 result.existingEntry.content_language === 'bengali';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Same language duplicate is also blocked
   * Requirements: 11.4
   */
  it('should block same language duplicate (Bengali to Bengali)', () => {
    fc.assert(
      fc.property(
        bengaliActGen,
        (bengaliAct) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, bengaliAct);
          
          // Try to add another Bengali version
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            bengaliAct.internal_id, 
            'bengali'
          );
          
          return result.isDuplicate === true &&
                 result.allowExtraction === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Same language duplicate is blocked (English to English)
   * Requirements: 11.4
   */
  it('should block same language duplicate (English to English)', () => {
    fc.assert(
      fc.property(
        internalIdGen,
        volumeNumberGen,
        contentGen,
        (internalId, volumeNumber, content) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          
          // Add English act
          const englishAct = {
            internal_id: internalId,
            title: 'Test Act',
            volume_number: volumeNumber,
            content: content,
            content_language: 'english',
            capturedAt: new Date().toISOString()
          };
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, englishAct);
          
          // Try to add another English version
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            internalId, 
            'english'
          );
          
          return result.isDuplicate === true &&
                 result.allowExtraction === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: replaceExisting is not set when English is blocked
   * Requirements: 11.4
   */
  it('should not set replaceExisting when English is blocked', () => {
    fc.assert(
      fc.property(
        bengaliActGen,
        (bengaliAct) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, bengaliAct);
          
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            bengaliAct.internal_id, 
            'english'
          );
          
          // replaceExisting should be undefined or false when blocked
          return result.replaceExisting === undefined || result.replaceExisting === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Message includes capture timestamp
   * Requirements: 11.4
   */
  it('should include capture timestamp in blocking message', () => {
    fc.assert(
      fc.property(
        bengaliActGen,
        (bengaliAct) => {
          let manifest = BDLawCorpusManifest.createEmptyManifest();
          manifest = BDLawCorpusManifest.updateCorpusManifest(manifest, bengaliAct);
          
          const result = BDLawCorpusManifest.checkLanguageAwareDuplicate(
            manifest, 
            bengaliAct.internal_id, 
            'english'
          );
          
          // Message should reference the existing entry's timestamp
          return result.existingEntry !== undefined &&
                 result.existingEntry.capture_timestamp !== undefined;
        }
      ),
      { numRuns: 100 }
    );
  });
});
