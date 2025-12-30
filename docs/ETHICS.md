# Research Ethics

## Ethical Framework

BDLawCorpus is designed with research ethics as a foundational principle. This document outlines the ethical considerations, access principles, and non-misuse guarantees.

## Purpose Statement

BDLawCorpus exists solely to support academic research by enabling structured, reproducible access to publicly available Bangladeshi legal texts.

**Intended beneficiaries:**
- Academic researchers in legal informatics
- Digital humanities scholars
- Low-resource language researchers
- Legal accessibility advocates

**Not intended for:**
- Commercial data mining
- Automated legal services
- Mass surveillance or profiling
- Any use requiring legal accuracy guarantees

## Data Source Ethics

### Source Legitimacy

All data originates from bdlaws.minlaw.gov.bd, the official government source for Bangladeshi laws maintained by the Ministry of Law and Justice.

- **Public access**: The source website is publicly accessible without authentication
- **Government publication**: Content represents official government publications
- **No circumvention**: No access controls, paywalls, or restrictions are bypassed

### No Unauthorized Access

The tool:
- Does NOT access private or restricted content
- Does NOT bypass authentication mechanisms
- Does NOT circumvent rate limiting (manual operation only)
- Does NOT access content not intended for public viewing

## Collection Principles

### Transparency

- All extraction operations are visible to the user
- Source URLs are preserved in every export
- Extraction timestamps enable verification
- Tool identification is included in metadata

### Minimal Intervention

- Legal text is preserved exactly as rendered by the browser
- No summarization, interpretation, or modification
- No inference of legal meaning or effect
- No resolution of ambiguities

### Human Oversight

- All extraction requires explicit user initiation
- No background or automated operation
- User reviews content before saving
- User controls extraction timing and scope

### Reproducibility

- Methodology is fully documented
- Extraction process is deterministic (for given DOM state)
- Provenance chain is complete
- Limitations are explicitly stated

## Non-Misuse Guarantees

### What This Tool Does NOT Do

1. **No Legal Advice**: This tool does not provide, generate, or imply legal advice
2. **No Legal Interpretation**: No inference of legal meaning, effect, or applicability
3. **No Amendment Resolution**: No determination of which law supersedes another
4. **No Validity Claims**: No assertion that extracted content is legally valid
5. **No Completeness Claims**: No guarantee that any act is complete
6. **No Currency Claims**: No assertion that content reflects current law

### Prohibited Uses

Users MUST NOT use BDLawCorpus outputs for:

- Providing legal advice to individuals or organizations
- Making legal determinations in official proceedings
- Automated legal decision-making systems
- Any application requiring legal accuracy guarantees
- Commercial legal services without additional validation
- Training production ML systems without explicit risk acknowledgment

### User Responsibility

Users of BDLawCorpus are responsible for:

- Proper academic citation
- Compliance with institutional research guidelines
- Ethical use of extracted data
- Understanding and communicating limitations
- Independent verification of critical information

## Data Integrity

### Preservation Principles

- Original Bengali text is preserved verbatim in `content_raw`
- UTF-8 encoding is enforced throughout
- No transliteration or translation is applied
- Structural markers are detected but not modified

### Modification Transparency

When modifications are applied (encoding fixes):

- Original content is preserved in `content_raw`
- All transformations are logged
- Risk levels are classified (non-semantic vs. potential-semantic)
- Potential-semantic changes are flagged but not applied

### No Inference

The system explicitly does NOT:

- Infer missing content
- Correct perceived errors in legal text
- Resolve apparent contradictions
- Fill gaps in incomplete extractions

## Access Principles

### Open Access

- Tool source code is publicly available
- Methodology is fully documented
- No proprietary algorithms or hidden processing
- Community contributions welcome

### Non-Commercial

- Tool is provided free of charge
- No commercial licensing restrictions on tool use
- Extracted content subject to original source terms
- Academic use is the primary intended purpose

### Attribution

When using BDLawCorpus in research:

- Cite the tool and methodology
- Acknowledge limitations
- Provide access to extraction metadata
- Enable reproducibility where possible

## Institutional Compliance

### Research Ethics Boards

Researchers using BDLawCorpus should:

- Consult institutional research ethics guidelines
- Determine if ethics board approval is required
- Document data collection methodology
- Maintain appropriate data governance

### Data Protection

- No personal data is collected or processed
- Legal texts are government publications
- No user tracking or analytics
- All processing occurs locally

## Disclaimer

BDLawCorpus is provided "as is" for academic research purposes. The developers:

- Make no warranties about fitness for any purpose
- Accept no liability for misuse or misinterpretation
- Do not guarantee accuracy, completeness, or currency
- Are not responsible for downstream applications

## Contact

For ethical concerns or questions about appropriate use, please open an issue in the project repository.
