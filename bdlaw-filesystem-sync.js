/**
 * BDLawCorpus Filesystem Sync Runtime
 *
 * Handles canonical path generation, file IO helpers, resume queue building,
 * and UI status helpers for local filesystem sync.
 */

const BDLawFilesystemSync = {
  getActPath(actNumber) {
    return `acts/${actNumber}.json`;
  },

  getFailedPath(actNumber) {
    return `failed/${actNumber}.failed.json`;
  },

  getAuditLogPath() {
    return 'logs/audit-log.ndjson';
  },

  getSyncLogPath() {
    return 'logs/sync-log.ndjson';
  },

  getManifestPath() {
    return 'manifests/sync-manifest.json';
  },

  getStatePath() {
    return 'manifests/sync-state.json';
  },

  async ensureDirectory(rootHandle, segments) {
    let current = rootHandle;
    for (const segment of segments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }
    return current;
  },

  splitRelativePath(relativePath) {
    const parts = String(relativePath).split('/').filter(Boolean);
    return {
      directories: parts.slice(0, -1),
      fileName: parts[parts.length - 1]
    };
  },

  async getFileHandle(rootHandle, relativePath, options = { create: true }) {
    const { directories, fileName } = this.splitRelativePath(relativePath);
    const dirHandle = await this.ensureDirectory(rootHandle, directories);
    return dirHandle.getFileHandle(fileName, options);
  },

  async readTextFile(rootHandle, relativePath) {
    try {
      const fileHandle = await this.getFileHandle(rootHandle, relativePath, { create: false });
      const file = await fileHandle.getFile();
      if (typeof file.text === 'function') {
        return file.text();
      }
      return '';
    } catch (error) {
      if (error && (error.name === 'NotFoundError' || /not found/i.test(error.message || ''))) {
        return null;
      }
      throw error;
    }
  },

  async writeTextFile(rootHandle, relativePath, content) {
    const fileHandle = await this.getFileHandle(rootHandle, relativePath, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return relativePath;
  },

  async appendTextFile(rootHandle, relativePath, content) {
    const existing = (await this.readTextFile(rootHandle, relativePath)) || '';
    await this.writeTextFile(rootHandle, relativePath, existing + content);
    return relativePath;
  },

  async appendNdjson(rootHandle, relativePath, record) {
    const line = JSON.stringify(record) + '\n';
    return this.appendTextFile(rootHandle, relativePath, line);
  },

  async readJsonFile(rootHandle, relativePath) {
    const text = await this.readTextFile(rootHandle, relativePath);
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  },

  async writeJsonFile(rootHandle, relativePath, data, pretty = true) {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    return this.writeTextFile(rootHandle, relativePath, content);
  },

  async writeSuccessfulAct(rootHandle, actNumber, jsonContent) {
    return this.writeTextFile(rootHandle, this.getActPath(actNumber), jsonContent);
  },

  async writeFailedAct(rootHandle, actNumber, jsonContent) {
    return this.writeTextFile(rootHandle, this.getFailedPath(actNumber), jsonContent);
  },

  async deleteIfExists(rootHandle, relativePath) {
    const { directories, fileName } = this.splitRelativePath(relativePath);
    try {
      const dirHandle = await this.ensureDirectory(rootHandle, directories);
      await dirHandle.removeEntry(fileName);
      return true;
    } catch (error) {
      if (error && (error.name === 'NotFoundError' || /not found/i.test(error.message || ''))) {
        return false;
      }
      throw error;
    }
  },

  async reconcileActTransition(rootHandle, options) {
    if (options?.becameSuccessful) {
      await this.deleteIfExists(rootHandle, this.getFailedPath(options.actNumber));
    }
  },

  computeSyncStatus({ permission, syncEnabled, folderName, isSyncing, lastError, pendingCount = 0, lastSyncedAt = null }) {
    if (!syncEnabled) {
      return { label: 'Disabled', detail: 'Enable sync to choose a folder.', tone: 'neutral', paused: true };
    }

    if (!folderName) {
      return { label: 'Setup required', detail: 'Select a sync folder to continue.', tone: 'warning', paused: true };
    }

    if (permission && permission !== 'granted') {
      return { label: 'Permission lost', detail: 'Reconnect the folder to restore access.', tone: 'danger', paused: true };
    }

    if (lastError) {
      return { label: 'Error', detail: lastError, tone: 'danger', paused: true };
    }

    if (isSyncing) {
      return { label: 'Syncing', detail: pendingCount > 0 ? `${pendingCount} item(s) pending` : 'Writing files…', tone: 'info', paused: false };
    }

    if (lastSyncedAt) {
      return { label: 'Ready', detail: pendingCount > 0 ? `${pendingCount} item(s) ready to sync` : `Last synced ${lastSyncedAt}`, tone: 'success', paused: false };
    }

    return { label: 'Ready', detail: pendingCount > 0 ? `${pendingCount} item(s) ready to sync` : 'Folder connected and ready.', tone: 'success', paused: false };
  },

  buildPendingSyncQueue({ capturedActs = [], failedExtractions = [], manifest = null, syncState = {} }) {
    const safeManifest = (typeof BDLawSyncManifest !== 'undefined' ? BDLawSyncManifest : require('./bdlaw-sync-manifest.js')).ensureManifest(manifest);
    const manifestHelper = (typeof BDLawSyncManifest !== 'undefined' ? BDLawSyncManifest : require('./bdlaw-sync-manifest.js'));

    const pendingActs = capturedActs.filter((act) => {
      const actNumber = String(act.actNumber || act.act_number || '');
      const contentHash = act.content_raw_sha256 || act.content_hash || null;
      return manifestHelper.shouldSyncSuccessfulAct(safeManifest, { actNumber, contentHash }).needed;
    });

    const pendingFailed = failedExtractions.filter((entry) => manifestHelper.shouldSyncFailedAct(safeManifest, entry).needed);

    return {
      syncEnabled: !!syncState.sync_enabled,
      pendingActs,
      pendingFailed,
      pendingCount: pendingActs.length + pendingFailed.length
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawFilesystemSync;
}

if (typeof window !== 'undefined') {
  window.BDLawFilesystemSync = BDLawFilesystemSync;
}