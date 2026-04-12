/**
 * BDLawCorpus Filesystem Sync Manifest Helpers
 *
 * Maintains manifest/dedup metadata for the local filesystem sync feature.
 */

const BDLawSyncManifest = {
  SCHEMA_VERSION: '1.0',

  createEmptyManifest() {
    return {
      schema_version: this.SCHEMA_VERSION,
      acts: {},
      failed: {},
      logs: {
        audit_log_bytes: 0,
        sync_log_bytes: 0
      },
      last_synced_at: null
    };
  },

  ensureManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') {
      return this.createEmptyManifest();
    }

    return {
      ...this.createEmptyManifest(),
      ...manifest,
      acts: manifest.acts && typeof manifest.acts === 'object' ? manifest.acts : {},
      failed: manifest.failed && typeof manifest.failed === 'object' ? manifest.failed : {},
      logs: {
        ...this.createEmptyManifest().logs,
        ...(manifest.logs || {})
      }
    };
  },

  buildFailedFingerprint(failedEntry) {
    const reason = failedEntry?.failure_reason || 'unknown';
    const retryCount = Number(failedEntry?.retry_count || 0);
    const maxRetries = Number(failedEntry?.max_retries || 0);
    return `${reason}:${retryCount}:${maxRetries}`;
  },

  shouldSyncSuccessfulAct(manifest, act) {
    const safeManifest = this.ensureManifest(manifest);
    const actNumber = String(act?.actNumber || act?.act_number || '');
    const contentHash = act?.contentHash || act?.content_raw_sha256 || null;

    if (!actNumber) {
      return { needed: false, reason: 'invalid_act' };
    }

    const existing = safeManifest.acts[actNumber];
    if (!existing) {
      return { needed: true, reason: 'new' };
    }

    if (contentHash && existing.content_hash === contentHash) {
      return { needed: false, reason: 'unchanged' };
    }

    return { needed: true, reason: contentHash ? 'content_changed' : 'metadata_changed' };
  },

  shouldSyncFailedAct(manifest, failedEntry) {
    const safeManifest = this.ensureManifest(manifest);
    const actNumber = String(failedEntry?.act_number || failedEntry?.actNumber || '');
    if (!actNumber) {
      return { needed: false, reason: 'invalid_failed_act' };
    }

    const existing = safeManifest.failed[actNumber];
    const fingerprint = this.buildFailedFingerprint(failedEntry);
    if (!existing) {
      return { needed: true, reason: 'new_failed' };
    }

    if (existing.failure_fingerprint === fingerprint) {
      return { needed: false, reason: 'unchanged' };
    }

    return { needed: true, reason: 'failure_changed' };
  },

  updateManifestForSuccessfulAct(manifest, actNumber, contentHash, metadata = {}) {
    const safeManifest = this.ensureManifest(manifest);
    const normalizedActNumber = String(actNumber);

    safeManifest.acts[normalizedActNumber] = {
      act_number: normalizedActNumber,
      content_hash: contentHash || null,
      path: metadata.path || `acts/${normalizedActNumber}.json`,
      title: metadata.title || null,
      synced_at: metadata.synced_at || new Date().toISOString()
    };

    delete safeManifest.failed[normalizedActNumber];
    safeManifest.last_synced_at = metadata.synced_at || new Date().toISOString();
    return safeManifest;
  },

  updateManifestForFailedAct(manifest, failedEntry, metadata = {}) {
    const safeManifest = this.ensureManifest(manifest);
    const actNumber = String(failedEntry?.act_number || failedEntry?.actNumber || '');
    if (!actNumber) {
      return safeManifest;
    }

    safeManifest.failed[actNumber] = {
      act_number: actNumber,
      failure_reason: failedEntry.failure_reason || 'unknown',
      failure_fingerprint: this.buildFailedFingerprint(failedEntry),
      path: metadata.path || `failed/${actNumber}.failed.json`,
      title: failedEntry.title || null,
      synced_at: metadata.synced_at || new Date().toISOString()
    };

    safeManifest.last_synced_at = metadata.synced_at || new Date().toISOString();
    return safeManifest;
  },

  updateLogStats(manifest, logStats = {}) {
    const safeManifest = this.ensureManifest(manifest);
    safeManifest.logs = {
      ...safeManifest.logs,
      ...logStats
    };
    return safeManifest;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BDLawSyncManifest;
}

if (typeof window !== 'undefined') {
  window.BDLawSyncManifest = BDLawSyncManifest;
}