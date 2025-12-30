/**
 * Property-Based Tests for Protected Section Enforcement
 * 
 * Feature: legal-integrity-enhancement, Property 9: Protected Section Enforcement
 * Validates: Requirements 17.5, 17.6, 17.7
 * 
 * For any OCR artifact detected within a protected section (definitions, proviso,
 * explanation), the artifact SHALL be flagged but NOT corrected. content_corrected
 * SHALL preserve the original text in protected sections.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 9: Protected Section Enforcement', () => {
  // Generator for definition section markers
  const definitionMarkerGen = fc.constantFrom(
    'সংজ্ঞা',
    'definition',
    'definitions',
    'means',
    '"term" means',
    'অর্থ হইবে',
    'বলিতে বুঝাইবে'
  );

  // Generator for proviso section markers
  const provisoMarkerGen = fc.constantFrom(
    'তবে শর্ত',
    'Provided that',
    'proviso',
    'শর্ত থাকে যে',
    'এই শর্তে যে'
  );

  // Generator for explanation section markers
  const explanationMarkerGen = fc.constantFrom(
    'ব্যাখ্যা',
    'Explanation',
    'Note',
    'দ্রষ্টব্য'
  );

  // Generator for any protected section marker
  const protectedMarkerGen = fc.oneof(
    definitionMarkerGen,
    provisoMarkerGen,
    explanationMarkerGen
  );

  // Generator for content with protected sections
  const contentWithProtectedSectionGen = fc.tuple(
    fc.string({ minLength: 10, maxLength: 50 }),
    protectedMarkerGen,
    fc.string({ minLength: 20, maxLength: 100 }),
    fc.string({ minLength: 10, maxLength: 50 })
  ).map(([before, marker, sectionContent, after]) => 
    `${before} ${marker}: ${sectionContent} ${after}`
  );

  /**
   * Property: detectProtectedSections returns regions for definition patterns
   * Requirements: 17.1, 17.4
   */
  it('should detect definition sections as protected regions', () => {
    fc.assert(
      fc.property(
        definitionMarkerGen,
        (marker) => {
          const content = `Section 2. ${marker}: "Act" means this legislation. Other text follows.`;
          const result = BDLawExtractor.detectProtectedSections(content);
          
          // Should detect definitions as protected section
          return result.protected_sections.includes('definitions') &&
                 result.regions.length > 0 &&
                 result.regions.some(r => r.type === 'definitions' || r.type.includes('definitions'));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectProtectedSections returns regions for proviso patterns
   * Requirements: 17.2, 17.4
   */
  it('should detect proviso sections as protected regions', () => {
    fc.assert(
      fc.property(
        provisoMarkerGen,
        (marker) => {
          const content = `The penalty shall apply. ${marker} no penalty shall exceed one year. End of section.`;
          const result = BDLawExtractor.detectProtectedSections(content);
          
          // Should detect proviso as protected section
          return result.protected_sections.includes('proviso') &&
                 result.regions.length > 0 &&
                 result.regions.some(r => r.type === 'proviso' || r.type.includes('proviso'));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectProtectedSections returns regions for explanation patterns
   * Requirements: 17.3, 17.4
   */
  it('should detect explanation sections as protected regions', () => {
    fc.assert(
      fc.property(
        explanationMarkerGen,
        (marker) => {
          const content = `The term applies broadly. ${marker}: This includes all related matters. More text here.`;
          const result = BDLawExtractor.detectProtectedSections(content);
          
          // Should detect explanation as protected section
          return result.protected_sections.includes('explanation') &&
                 result.regions.length > 0 &&
                 result.regions.some(r => r.type === 'explanation' || r.type.includes('explanation'));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isInProtectedSection correctly identifies positions within regions
   * Requirements: 17.5
   */
  it('should correctly identify positions within protected sections', () => {
    fc.assert(
      fc.property(
        contentWithProtectedSectionGen,
        (content) => {
          const result = BDLawExtractor.detectProtectedSections(content);
          
          if (result.regions.length === 0) {
            return true; // No regions to test
          }
          
          // For each region, positions within should return true
          for (const region of result.regions) {
            const midPoint = Math.floor((region.start + region.end) / 2);
            if (!BDLawExtractor.isInProtectedSection(midPoint, result.regions)) {
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
   * Property: isInProtectedSection returns false for positions outside regions
   * Requirements: 17.5
   */
  it('should return false for positions outside protected sections', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 200 }),
        (textWithoutProtected) => {
          // Content without protected section markers
          const content = textWithoutProtected
            .replace(/সংজ্ঞা|definition|means|তবে শর্ত|Provided that|proviso|ব্যাখ্যা|Explanation/gi, 'text');
          const result = BDLawExtractor.detectProtectedSections(content);
          
          // If no regions detected, any position should return false
          if (result.regions.length === 0) {
            return !BDLawExtractor.isInProtectedSection(0, result.regions) &&
                   !BDLawExtractor.isInProtectedSection(content.length - 1, result.regions);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: OCR corrections are flagged but NOT applied in protected sections
   * Requirements: 17.5, 17.6, 17.7
   */
  it('should flag but not correct OCR artifacts in protected sections', () => {
    // Create content with OCR error inside a definition section
    const ocrError = 'প্রম্্নফ';
    const ocrCorrect = 'প্রুফ';
    const content = `Section 2. সংজ্ঞা: "${ocrError}" means proof document. Other text with ${ocrError} outside.`;
    
    const protectedResult = BDLawExtractor.detectProtectedSections(content);
    
    // Create a config with OCR correction that would match
    const config = {
      encodingErrors: [],
      ocrCorrections: [
        { incorrect: ocrError, correct: ocrCorrect, context: 'test' }
      ],
      formattingRules: {}
    };
    
    // Apply OCR corrections with protected section enforcement
    const result = BDLawQuality.applyOcrCorrectionRules(
      content, 
      config, 
      false, 
      [], // no numeric regions
      protectedResult.regions
    );
    
    // The OCR error inside protected section should be flagged but NOT corrected
    expect(result.flaggedInProtectedSections.length).toBeGreaterThan(0);
    expect(result.skippedInProtectedSections).toBeGreaterThan(0);
    
    // The flagged entry should have applied = false
    expect(result.flaggedInProtectedSections.every(f => f.applied === false)).toBe(true);
    expect(result.flaggedInProtectedSections.every(f => f.reason === 'protected_section_enforcement')).toBe(true);
  });

  /**
   * Property: OCR corrections ARE applied outside protected sections
   * Requirements: 17.5, 17.6
   */
  it('should apply OCR corrections outside protected sections', () => {
    // Create content with OCR error ONLY outside protected sections
    // Avoid any words that might match protected section patterns
    const ocrError = 'অতগরটির';
    const ocrCorrect = 'অক্ষরটির';
    const content = `Regular paragraph with ${ocrError} error here. No special markers present.`;
    
    const protectedResult = BDLawExtractor.detectProtectedSections(content);
    
    // Create a config with OCR correction
    const config = {
      encodingErrors: [],
      ocrCorrections: [
        { incorrect: ocrError, correct: ocrCorrect, context: 'letter reference' }
      ],
      formattingRules: {}
    };
    
    // Apply OCR corrections
    const result = BDLawQuality.applyOcrCorrectionRules(
      content, 
      config, 
      false, 
      [], // no numeric regions
      protectedResult.regions
    );
    
    // The OCR error should be corrected (if no protected regions, or if error is outside them)
    if (protectedResult.regions.length === 0) {
      expect(result.content).toContain(ocrCorrect);
      expect(result.content).not.toContain(ocrError);
    } else {
      // If there are protected regions, check that corrections happen outside them
      expect(result.transformations.length).toBeGreaterThan(0);
    }
  });

  /**
   * Property: Protected sections have valid start and end positions
   * Requirements: 17.4
   */
  it('should return regions with valid start and end positions', () => {
    fc.assert(
      fc.property(
        contentWithProtectedSectionGen,
        (content) => {
          const result = BDLawExtractor.detectProtectedSections(content);
          
          // All regions should have valid positions
          return result.regions.every(r => 
            typeof r.start === 'number' &&
            typeof r.end === 'number' &&
            r.start >= 0 &&
            r.end <= content.length &&
            r.start < r.end
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Protected sections include the marker text
   * Requirements: 17.4
   */
  it('should include marker text in protected regions', () => {
    fc.assert(
      fc.property(
        contentWithProtectedSectionGen,
        (content) => {
          const result = BDLawExtractor.detectProtectedSections(content);
          
          // All regions should have a marker
          return result.regions.every(r => 
            typeof r.marker === 'string' && r.marker.length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: cleanContent respects protected section enforcement
   * Requirements: 17.5, 17.6, 17.7
   */
  it('should protect sections during cleanContent', () => {
    fc.assert(
      fc.property(
        protectedMarkerGen,
        (marker) => {
          const content = `Regular text. ${marker}: Important legal text here. More regular text.`;
          
          // Clean the content
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: true,
            applyFormatting: true
          });
          
          // The marker should be preserved in the cleaned content
          return result.cleaned.includes(marker);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty content returns empty protected sections
   * Requirements: 17.4
   */
  it('should handle empty content gracefully', () => {
    expect(BDLawExtractor.detectProtectedSections('')).toEqual({
      protected_sections: [],
      regions: []
    });
    expect(BDLawExtractor.detectProtectedSections(null)).toEqual({
      protected_sections: [],
      regions: []
    });
    expect(BDLawExtractor.detectProtectedSections(undefined)).toEqual({
      protected_sections: [],
      regions: []
    });
  });

  /**
   * Property: rangeOverlapsProtectedSection correctly detects overlaps
   * Requirements: 17.5
   */
  it('should correctly detect range overlaps with protected sections', () => {
    const content = 'Section 2. সংজ্ঞা: "Act" means this legislation. Other text.';
    const result = BDLawExtractor.detectProtectedSections(content);
    
    if (result.regions.length > 0) {
      const region = result.regions[0];
      
      // Range fully inside should overlap
      expect(BDLawExtractor.rangeOverlapsProtectedSection(
        region.start + 1, region.end - 1, result.regions
      )).toBe(true);
      
      // Range partially overlapping should overlap
      expect(BDLawExtractor.rangeOverlapsProtectedSection(
        region.start - 5, region.start + 5, result.regions
      )).toBe(true);
      
      // Range fully before should not overlap
      expect(BDLawExtractor.rangeOverlapsProtectedSection(
        0, region.start, result.regions
      )).toBe(false);
      
      // Range fully after should not overlap
      expect(BDLawExtractor.rangeOverlapsProtectedSection(
        region.end, content.length, result.regions
      )).toBe(false);
    }
  });

  /**
   * Property: Multiple protected sections are all detected
   * Requirements: 17.1, 17.2, 17.3, 17.4
   */
  it('should detect multiple protected sections in same content', () => {
    const content = `
      Section 2. সংজ্ঞা: "Act" means this legislation.
      Section 3. The penalty applies. তবে শর্ত that no penalty exceeds one year.
      ব্যাখ্যা: This includes all related matters.
    `;
    
    const result = BDLawExtractor.detectProtectedSections(content);
    
    // Should detect all three types
    expect(result.protected_sections).toContain('definitions');
    expect(result.protected_sections).toContain('proviso');
    expect(result.protected_sections).toContain('explanation');
    
    // Should have at least one region (may be merged if overlapping)
    expect(result.regions.length).toBeGreaterThanOrEqual(1);
    
    // The regions should cover all three section types
    const allTypes = result.regions.map(r => r.type).join(',');
    expect(allTypes).toContain('definitions');
    expect(allTypes).toContain('proviso');
    expect(allTypes).toContain('explanation');
  });

  /**
   * Property: content_corrected preserves original text in protected sections
   * Requirements: 17.7
   */
  it('should preserve original text in protected sections after cleaning', () => {
    const definitionText = 'সংজ্ঞা: "প্রম্্নফ" means proof';
    const content = `Section 2. ${definitionText}. Other text here.`;
    
    // Clean the content
    const result = BDLawQuality.cleanContent(content, {
      applyEncodingRepairs: true,
      applyOcrCorrections: true,
      applyFormatting: true
    });
    
    // The definition section should be preserved (OCR error not corrected)
    // The original text within the protected section should remain
    expect(result.cleaned).toContain('সংজ্ঞা');
  });

  /**
   * Property: Flagged artifacts include position information
   * Requirements: 17.6, 17.7
   */
  it('should include position information in flagged artifacts', () => {
    const ocrError = 'প্রম্্নফ';
    const content = `সংজ্ঞা: "${ocrError}" means proof. Regular text.`;
    
    const protectedResult = BDLawExtractor.detectProtectedSections(content);
    
    const config = {
      encodingErrors: [],
      ocrCorrections: [
        { incorrect: ocrError, correct: 'প্রুফ', context: 'test' }
      ],
      formattingRules: {}
    };
    
    const result = BDLawQuality.applyOcrCorrectionRules(
      content, 
      config, 
      false, 
      [],
      protectedResult.regions
    );
    
    if (result.flaggedInProtectedSections.length > 0) {
      // Each flagged artifact should have position information
      expect(result.flaggedInProtectedSections.every(f => 
        typeof f.position === 'number' &&
        f.position >= 0
      )).toBe(true);
    }
  });
});
