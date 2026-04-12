/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

describe('filesystem sync UI scaffold', () => {
  test('export sidebar includes filesystem sync controls', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../sidepanel.html'), 'utf8');

    document.documentElement.innerHTML = html;

    expect(document.getElementById('filesystemSyncSection')).not.toBeNull();
    expect(document.getElementById('enableFilesystemSync')).not.toBeNull();
    expect(document.getElementById('selectSyncFolderBtn')).not.toBeNull();
    expect(document.getElementById('syncNowBtn')).not.toBeNull();
    expect(document.getElementById('reconnectSyncFolderBtn')).not.toBeNull();
    expect(document.getElementById('syncStatusLabel')).not.toBeNull();
    expect(document.getElementById('syncStatusLabel').textContent).toContain('Not configured');
  });
});