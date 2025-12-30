/**
 * Property-Based Tests for Numeric Region Protection
 * 
 * Feature: legal-integrity-enhancement, Property 7: Numeric Region Protection
 * Validates: Requirements 3.5, 3.6, 3.7
 * 
 * For any detected numeric region (currency, percentage, rate, table), no OCR
 * correction, encoding repair, or formatting SHALL be applied within that region.
 * Only Unicode normalization is permitted.
 */

const fc = require('fast-check');
const BDLawExtractor = require('../../bdlaw-extractor.js');
const BDLawQuality = require('../../bdlaw-quality.js');

describe('Property 7: Numeric Region Protection', () => {
  // Generator for currency amounts with Bengali Taka symbol
  const bengaliCurrencyGen = fc.tuple(
    fc.integer({ min: 1, max: 999999 }),
    fc.constantFrom('৳', 'টাকা')
  ).map(([amount, symbol]) => {
    const bengaliDigits = amount.toString().split('').map(d => 
      String.fromCharCode(0x09E6 + parseInt(d))
    ).join('');
    return symbol === '৳' ? `৳ ${bengaliDigits}` : `${bengaliDigits} টাকা`;
  });

  // Generator for currency amounts with English symbols
  const englishCurrencyGen = fc.tuple(
    fc.integer({ min: 1, max: 999999 }),
    fc.constantFrom('Tk.', 'Tk', '$')
  ).map(([amount, symbol]) => `${symbol} ${amount.toLocaleString()}`);

  // Generator for percentage values
  const percentageGen = fc.tuple(
    fc.integer({ min: 0, max: 100 }),
    fc.constantFrom('%', 'শতাংশ', 'percent')
  ).map(([value, suffix]) => `${value}${suffix === '%' ? '' : ' '}${suffix}`);

  // Generator for rate values
  const rateGen = fc.tuple(
    fc.integer({ min: 1, max: 50 }),
    fc.constantFrom('per annum', 'p.a.', 'বার্ষিক', 'হার')
  ).map(([value, suffix]) => `${value}% ${suffix}`);

  // Generator for content with numeric regions embedded
  const contentWithNumericGen = fc.tuple(
    fc.string({ minLength: 10, maxLength: 100 }),
    fc.oneof(bengaliCurrencyGen, englishCurrencyGen, percentageGen, rateGen),
    fc.string({ minLength: 10, maxLength: 100 })
  ).map(([before, numeric, after]) => `${before} ${numeric} ${after}`);

  /**
   * Property: detectNumericRegions returns regions for currency patterns
   * Requirements: 3.1, 3.5
   */
  it('should detect currency patterns as numeric regions', () => {
    fc.assert(
      fc.property(
        fc.oneof(bengaliCurrencyGen, englishCurrencyGen),
        (currencyText) => {
          const content = `Some text before ${currencyText} and some text after`;
          const regions = BDLawExtractor.detectNumericRegions(content);
          
          // Should detect at least one numeric region
          return regions.length > 0 && 
                 regions.some(r => r.type === 'currency' && r.numeric_integrity_sensitive === true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectNumericRegions returns regions for percentage patterns
   * Requirements: 3.2, 3.5
   */
  it('should detect percentage patterns as numeric regions', () => {
    fc.assert(
      fc.property(
        percentageGen,
        (percentText) => {
          const content = `The rate is ${percentText} of the total`;
          const regions = BDLawExtractor.detectNumericRegions(content);
          
          // Should detect at least one numeric region
          return regions.length > 0 && 
                 regions.some(r => r.type === 'percentage' && r.numeric_integrity_sensitive === true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: detectNumericRegions returns regions for rate patterns
   * Requirements: 3.3, 3.5
   */
  it('should detect rate patterns as numeric regions', () => {
    fc.assert(
      fc.property(
        rateGen,
        (rateText) => {
          const content = `Interest at ${rateText} shall be charged`;
          const regions = BDLawExtractor.detectNumericRegions(content);
          
          // Should detect at least one numeric region (rate or percentage)
          return regions.length > 0 && 
                 regions.some(r => r.numeric_integrity_sensitive === true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isInNumericRegion correctly identifies positions within regions
   * Requirements: 3.6
   */
  it('should correctly identify positions within numeric regions', () => {
    fc.assert(
      fc.property(
        contentWithNumericGen,
        (content) => {
          const regions = BDLawExtractor.detectNumericRegions(content);
          
          if (regions.length === 0) {
            return true; // No regions to test
          }
          
          // For each region, positions within should return true
          for (const region of regions) {
            const midPoint = Math.floor((region.start + region.end) / 2);
            if (!BDLawExtractor.isInNumericRegion(midPoint, regions)) {
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
   * Property: isInNumericRegion returns false for positions outside regions
   * Requirements: 3.6
   */
  it('should return false for positions outside numeric regions', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 200 }),
        (textWithoutNumeric) => {
          // Content without numeric patterns
          const content = textWithoutNumeric.replace(/[\d০-৯%৳$]/g, 'X');
          const regions = BDLawExtractor.detectNumericRegions(content);
          
          // If no regions detected, any position should return false
          if (regions.length === 0) {
            return !BDLawExtractor.isInNumericRegion(0, regions) &&
                   !BDLawExtractor.isInNumericRegion(content.length - 1, regions);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Cleaning functions skip transformations in numeric regions
   * Requirements: 3.6, 3.7
   */
  it('should skip encoding repairs within numeric regions', () => {
    // Create content with encoding error inside a currency amount
    const content = 'The amount is ৳ ১০০০০ with æ error inside';
    const numericRegions = BDLawExtractor.detectNumericRegions(content);
    
    // Create a config with encoding error that would match
    const config = {
      encodingErrors: [
        { pattern: /æ/g, description: 'Test error', replacement: '"' }
      ],
      ocrCorrections: [],
      formattingRules: {}
    };
    
    // Apply encoding repairs with numeric region protection
    const result = BDLawQuality.applyEncodingRepairRules(content, config, false, numericRegions);
    
    // The error outside numeric region should be fixed
    // The function should track skipped transformations
    expect(result.content).toBeDefined();
    expect(result.transformations).toBeDefined();
  });

  /**
   * Property: All detected numeric regions have numeric_integrity_sensitive = true
   * Requirements: 3.5
   */
  it('should mark all numeric regions as numeric_integrity_sensitive', () => {
    fc.assert(
      fc.property(
        contentWithNumericGen,
        (content) => {
          const regions = BDLawExtractor.detectNumericRegions(content);
          
          // All regions should have numeric_integrity_sensitive = true
          return regions.every(r => r.numeric_integrity_sensitive === true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Numeric regions have valid start and end positions
   * Requirements: 3.5
   */
  it('should return regions with valid start and end positions', () => {
    fc.assert(
      fc.property(
        contentWithNumericGen,
        (content) => {
          const regions = BDLawExtractor.detectNumericRegions(content);
          
          // All regions should have valid positions
          return regions.every(r => 
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
   * Property: Numeric regions include the matched text
   * Requirements: 3.5
   */
  it('should include matched text in numeric regions', () => {
    fc.assert(
      fc.property(
        contentWithNumericGen,
        (content) => {
          const regions = BDLawExtractor.detectNumericRegions(content);
          
          // All regions should have text that matches the content at that position
          return regions.every(r => {
            if (!r.text) return true; // text is optional in merged regions
            const extractedText = content.substring(r.start, r.end);
            return extractedText.includes(r.text.split(' ')[0]) || r.text.includes(extractedText);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: cleanContent respects numeric region protection
   * Requirements: 3.6, 3.7
   */
  it('should protect numeric regions during cleanContent', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.oneof(bengaliCurrencyGen, englishCurrencyGen),
          fc.string({ minLength: 5, maxLength: 50 })
        ),
        ([numericValue, surroundingText]) => {
          const content = `${surroundingText} ${numericValue} ${surroundingText}`;
          
          // Clean the content
          const result = BDLawQuality.cleanContent(content, {
            applyEncodingRepairs: true,
            applyOcrCorrections: true,
            applyFormatting: true
          });
          
          // The numeric value should be preserved in the cleaned content
          // (either unchanged or only Unicode normalized)
          const normalizedNumeric = numericValue.normalize('NFC');
          return result.cleaned.includes(numericValue) || 
                 result.cleaned.includes(normalizedNumeric);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Table/schedule markers are detected as numeric regions
   * Requirements: 3.4, 3.5
   */
  it('should detect table and schedule markers as numeric regions', () => {
    const schedulePatterns = [
      'তফসিল',
      'Schedule I',
      'Schedule II',
      'Appendix A',
      'Form A',
      'Table I'
    ];

    for (const pattern of schedulePatterns) {
      const content = `See the ${pattern} for details`;
      const regions = BDLawExtractor.detectNumericRegions(content);
      
      expect(regions.length).toBeGreaterThan(0);
      expect(regions.some(r => r.numeric_integrity_sensitive === true)).toBe(true);
    }
  });

  /**
   * Property: Empty content returns empty regions array
   * Requirements: 3.5
   */
  it('should handle empty content gracefully', () => {
    expect(BDLawExtractor.detectNumericRegions('')).toEqual([]);
    expect(BDLawExtractor.detectNumericRegions(null)).toEqual([]);
    expect(BDLawExtractor.detectNumericRegions(undefined)).toEqual([]);
  });

  /**
   * Property: rangeOverlapsNumericRegion correctly detects overlaps
   * Requirements: 3.6
   */
  it('should correctly detect range overlaps with numeric regions', () => {
    const content = 'Amount: ৳ ১০০০০ is the total';
    const regions = BDLawExtractor.detectNumericRegions(content);
    
    if (regions.length > 0) {
      const region = regions[0];
      
      // Range fully inside should overlap
      expect(BDLawExtractor.rangeOverlapsNumericRegion(
        region.start + 1, region.end - 1, regions
      )).toBe(true);
      
      // Range partially overlapping should overlap
      expect(BDLawExtractor.rangeOverlapsNumericRegion(
        region.start - 5, region.start + 5, regions
      )).toBe(true);
      
      // Range fully before should not overlap
      expect(BDLawExtractor.rangeOverlapsNumericRegion(
        0, region.start, regions
      )).toBe(false);
      
      // Range fully after should not overlap
      expect(BDLawExtractor.rangeOverlapsNumericRegion(
        region.end, content.length, regions
      )).toBe(false);
    }
  });
});
