# Privacy Policy - Web Text Extractor

Last Updated: 2025-08-11

This privacy policy outlines the data handling practices of the "Web Text Extractor" Chrome extension. As a tool designed for a research project, maintaining user privacy and data security is a top priority.

## 1. Data Collection & Processing

**All data processing is performed locally on your computer.**

*   The extension **does not** collect, transmit, or store any of your personal data on any external server.
*   When you extract text from a webpage, the entire process—from extraction to cleaning and formatting—happens within your browser.

## 2. Data Storage

The extension uses your browser's local storage mechanisms to function.

*   **Extracted Content**: The text you extract is held temporarily in your browser's memory for the duration of your session with the extension's popup. It is discarded when the popup is closed.
*   **User Settings**: Your preferences for how to process the text (e.g., whether to remove duplicates) are saved on your computer using the `chrome.storage.local` API. This is for your convenience, so your settings are remembered for future use. This data is not transmitted anywhere.

## 3. Permissions

The extension requests a minimal set of permissions required for its core functionality. Here is a clear explanation of why each permission is needed:

*   **`activeTab` & `tabs`**: To allow the extension to run on the webpage you are currently viewing when you click the extension icon.
*   **`scripting`**: To inject the necessary code (`content.js`) into the webpage to extract its text content.
*   **`downloads`**: To allow you to save the processed `.txt` files to your computer.
*   **`storage`**: To save your settings locally on your machine.
*   **`offscreen`**: To use a non-visible document for processing PDF files, which is a requirement of the Manifest V3 architecture.
*   **`declarativeNetRequest`**: To block known advertising and tracking domains (as defined in `rules.json`), which helps in collecting cleaner data.

## 4. Third-Party Services

**This extension does not send any data to third-party services.**

The tool is designed to be a self-contained data collection and preprocessing utility. There is no integration with any external AI or data processing APIs.

## 5. Contact

For any questions or concerns regarding this privacy policy or the extension's data handling practices, please refer to the contact information available in the project's repository on GitHub.
