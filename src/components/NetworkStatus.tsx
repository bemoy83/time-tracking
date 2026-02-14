/**
 * NetworkStatus component.
 * Shows offline indicator and sync status.
 *
 * Design requirements from CONTEXT.md:
 * - Clear visual states (not color-only)
 * - Offline-first - user should know their status
 */

import { useSyncState, retryFailedSync } from '../lib/sync/sync-queue';

export function NetworkStatus() {
  const { isOnline, isSyncing, pendingCount, lastError } = useSyncState();

  // Don't show anything if online with nothing pending
  if (isOnline && pendingCount === 0 && !isSyncing && !lastError) {
    return null;
  }

  return (
    <div
      className={`network-status ${!isOnline ? 'network-status--offline' : ''} ${
        lastError ? 'network-status--error' : ''
      }`}
      role="status"
      aria-live="polite"
    >
      {/* Offline indicator */}
      {!isOnline && (
        <div className="network-status__offline">
          <OfflineIcon />
          <span>Offline - changes saved locally</span>
        </div>
      )}

      {/* Syncing indicator */}
      {isOnline && isSyncing && (
        <div className="network-status__syncing">
          <SyncIcon />
          <span>Syncing...</span>
        </div>
      )}

      {/* Pending count */}
      {isOnline && !isSyncing && pendingCount > 0 && !lastError && (
        <div className="network-status__pending">
          <span>
            {pendingCount} {pendingCount === 1 ? 'entry' : 'entries'} pending sync
          </span>
        </div>
      )}

      {/* Error state */}
      {lastError && (
        <div className="network-status__error">
          <span>{lastError}</span>
          <button
            className="network-status__retry"
            onClick={() => retryFailedSync()}
            disabled={!isOnline}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// Icons
function OfflineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="network-status__icon"
      aria-hidden="true"
    >
      <path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7L12 21.5l3.07-4.04 3.89 3.89 1.27-1.27-3.19-3.19z" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="network-status__icon network-status__icon--spin"
      aria-hidden="true"
    >
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
    </svg>
  );
}
