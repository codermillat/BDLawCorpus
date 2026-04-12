# BDLawCorpus — Project Brief

## Project Identity
- **Name**: BDLawCorpus
- **Type**: Chrome Extension (Manifest V3)
- **Version**: 1.3.1
- **Repository**: https://github.com/codermillat/BDLawCorpus.git
- **License**: MIT

## Core Purpose
Academic research tool for building a **complete, research-grade LLM training dataset** of all Bangladeshi laws. Extracts legal texts from the official Bangladesh Laws website (`bdlaws.minlaw.gov.bd`) with:
- 100% extraction accuracy target
- Full provenance metadata
- Research integrity guarantees
- SHA-256 content integrity verification
- Reproducible corpus construction

## Target Website
`http://bdlaws.minlaw.gov.bd` — Official Bangladesh Laws website run by Legislative and Parliamentary Affairs Division, Ministry of Law, Justice and Parliamentary Affairs.

## Corpus Scope
- **57 volumes** of Bangladeshi Acts and Ordinances
- **~1,500+ acts** total
- Date range: 1799 (colonial era) to 2026 (current)
- Languages: English (Volumes 1–26) + Bengali (Volumes 27–57)
- Includes: Acts, Ordinances, Regulations, Presidential Orders

## Fundamental Constraints
1. `element.textContent` ONLY — `innerText` strictly forbidden
2. User-initiated extraction only — no automated crawling
3. `content_raw` is immutable — never modified after capture
4. No legal inference — citations are string patterns only
5. Failed acts exported with `content_raw: null` — never inferred
6. All operations logged with ISO-8601 timestamps

## Academic Positioning
This is a digital humanities / legal informatics resource, NOT a legal database. Explicitly NOT:
- A Gazette reconstruction
- Legally validated
- Suitable for legal advice
- Continuously maintained

## Intended LLM Dataset Use
- Corpus linguistics (Bengali + English legal text)
- Legal informatics research
- Low-resource NLP / Bengali language AI
- Information retrieval studies