# Web Text Extractor: Project Analysis

This document provides a factual analysis of the Web Text Extractor extension, based on a line-by-line review of its codebase as of August 2025. It outlines the project's current status, scope, and key architectural observations.

## 1. Current Development Status

The project is in a mature and functional state. The core features are implemented and the application is stable.

*   **Core Functionality (Implemented):**
    *   Text extraction from standard HTML pages.
    *   Text extraction from PDF files, handled via an offscreen document.
    *   A comprehensive text processing pipeline (`text-processor.js`) for cleaning and structuring data.
    *   An in-page Sider UI (`content.js`) for managing captured data directly on the webpage.
    *   A main popup UI (`popup.js`) for user interaction and configuration.
    *   An options page (`options.js`) for advanced settings.
    *   The extension is built on Manifest V3, ensuring adherence to modern browser security and performance standards.

*   **Data Collection (Complete):**
    *   The `outputs/` directory contains a substantial amount of raw data collected from the target university and government websites.

*   **Documentation (Complete):**
    *   The project includes a `README.md`, a `privacy-policy.md`, and this `docs/` directory containing detailed analyses of the project's architecture and pipeline.

## 2. Scope of the Project

The project's primary scope is to serve as a data collection and preprocessing tool for a specific research initiative.

*   **In Scope:**
    *   Extracting and cleaning text from the public-facing websites of four target universities (Sharda, NIU, Amity, Galgotias) and relevant government portals.
    *   Handling dynamic webpage elements (lazy-loading, tabs, etc.) to ensure comprehensive data capture.
    *   Processing the raw text to remove noise and structure it into a clean, usable format for the next stage of the research pipeline (Q&A pair generation).
    *   Ensuring user privacy by performing all core operations locally on the user's machine.

*   **Out of Scope:**
    *   Bypassing any form of authentication (logins, paywalls).
    *   Scraping content that is not publicly accessible.
    *   Direct integration with LLM APIs for real-time analysis (the extension prepares data *for* LLMs, but does not interact with them).

## 3. Architectural Observations and Considerations

This section provides objective observations about the codebase and its design. These points are intended to inform the research paper and any future development.

*   **UI State Management:** The settings in the main popup UI and the options page are managed independently. For instance, the "Remove Duplicates" checkbox in the popup is not synchronized with any setting on the options page. This is a deliberate design choice in the current implementation, but it means that settings are context-specific (i.e., some are configured in the popup, others on the options page).

*   **Data Capture Redundancy:** The raw data in the `outputs/` directory contains some files with numerically incremented names (e.g., `... (1).txt`). This indicates that the scraping process, as executed, sometimes captured the same page multiple times. The `text-processor.js` script is designed to mitigate this at the processing stage by removing duplicate content.

*   **File System Access UI:** The popup UI includes a "Browse" button for selecting a custom save folder. When clicked, it informs the user that this feature is not supported in the popup. This is an accurate reflection of the browser's security model, which requires a more persistent context (like a full tab) for the File System Access API. The current implementation directs all downloads to the default "Downloads" folder via the `chrome.downloads` API, which is a reliable and secure fallback.

*   **UI Implementation in `content.js`:** The in-page Sider UI is built using direct DOM manipulation. This is a standard and effective technique for injecting content into web pages. As the UI's complexity grows, future development cycles could consider adopting a more structured approach, but for the current scope, the implementation is functional and fit for purpose.
