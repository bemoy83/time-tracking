import { useEffect, useMemo, useState } from 'react';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import {
  applyCloudCatalogPull,
  buildLocalCatalogSnapshot,
  getCloudCatalogStatus,
  getSession,
  isSupabaseConfigured,
  previewCloudCatalogPull,
  pushLocalCatalogSnapshot,
  signIn,
  signOut,
  type CatalogCounts,
  type CatalogPullPreview,
  type CloudCatalogStatus,
} from '../../lib/cloud/catalog-sync';
import type { Session } from '@supabase/supabase-js';

interface SettingsCloudSyncViewProps {
  onBack: () => void;
}

function formatCounts(counts: CatalogCounts): string {
  return [
    `${counts.workUnitDefinitions} units`,
    `${counts.workTypes} work types`,
    `${counts.tagCategories} categories`,
    `${counts.tags} tags`,
    `${counts.globalTagSequence} sequence`,
    `${counts.crewPool} crew pool`,
  ].join(' · ');
}

function localCountsFromSnapshot(snapshot: Awaited<ReturnType<typeof buildLocalCatalogSnapshot>>): CatalogCounts {
  return {
    workUnitDefinitions: snapshot.workUnitDefinitions.length,
    workTypes: snapshot.workTypes.length,
    tagCategories: snapshot.tagCategories.length,
    tags: snapshot.tags.length,
    globalTagSequence: snapshot.globalTagSequence ? 1 : 0,
    crewPool: snapshot.crewPool ? 1 : 0,
  };
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Never';
}

export function SettingsCloudSyncView({ onBack }: SettingsCloudSyncViewProps) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<CloudCatalogStatus | null>(null);
  const [localCounts, setLocalCounts] = useState<CatalogCounts | null>(null);
  const [pullPreview, setPullPreview] = useState<CatalogPullPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cloudCounts = useMemo(
    () => (status?.payload ? formatCounts({
      workUnitDefinitions: status.payload.workUnitDefinitions.length,
      workTypes: status.payload.workTypes.length,
      tagCategories: status.payload.tagCategories.length,
      tags: status.payload.tags.length,
      globalTagSequence: status.payload.globalTagSequence ? 1 : 0,
      crewPool: status.payload.crewPool ? 1 : 0,
    }) : null),
    [status],
  );

  async function refreshAll(): Promise<void> {
    setMessage(null);
    setPullPreview(null);
    const [nextSession, localSnapshot] = await Promise.all([
      getSession(),
      buildLocalCatalogSnapshot(),
    ]);
    setSession(nextSession);
    setLocalCounts(localCountsFromSnapshot(localSnapshot));
    if (nextSession) {
      setStatus(await getCloudCatalogStatus());
    } else {
      setStatus(null);
    }
  }

  useEffect(() => {
    if (!configured) return;
    setBusy(true);
    refreshAll()
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load Cloud Sync status.'))
      .finally(() => setBusy(false));
  }, [configured]);

  const handleSignIn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signIn(email);
      setMessage('Check your email for the sign-in link.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to start sign-in.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signOut();
      setSession(null);
      setStatus(null);
      setPullPreview(null);
      setMessage('Signed out.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to sign out.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    try {
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to refresh Cloud Sync status.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const nextStatus = await pushLocalCatalogSnapshot();
      setStatus(nextStatus);
      setPullPreview(null);
      setMessage('Local setup uploaded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to upload local setup.');
    } finally {
      setBusy(false);
    }
  };

  const handlePreviewPull = async () => {
    if (!status?.payload) return;
    setBusy(true);
    setMessage(null);
    try {
      const preview = await previewCloudCatalogPull(status.payload);
      setPullPreview(preview);
      setMessage(preview.blocked ? 'Pull blocked by local references.' : 'Cloud setup is ready to pull.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to preview cloud setup.');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyPull = async () => {
    if (!pullPreview || pullPreview.blocked) return;
    setBusy(true);
    setMessage(null);
    try {
      await applyCloudCatalogPull(pullPreview);
      await refreshAll();
      setMessage('Cloud setup pulled into this device.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to pull cloud setup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsDetailLayout title="Cloud Sync" onBack={onBack}>
      <div className="settings-view__card">
        <h2 className="settings-view__sub-header">Cloud Sync</h2>
        {!configured ? (
          <p className="settings-view__helper">
            Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable shared setup sync.
          </p>
        ) : session ? (
          <div className="settings-view__list">
            <div className="settings-view__row-detail">Signed in as {session.user.email ?? session.user.id}</div>
            <button type="button" className="btn btn--secondary btn--sm" onClick={handleSignOut} disabled={busy}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="settings-view__list">
            <label className="settings-view__row-label" htmlFor="cloud-sync-email">
              Email
            </label>
            <input
              id="cloud-sync-email"
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
            <button type="button" className="btn btn--primary btn--sm" onClick={handleSignIn} disabled={busy || !email.trim()}>
              Send sign-in link
            </button>
          </div>
        )}
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Setup Catalog</h2>
          <button type="button" className="btn btn--secondary btn--sm" onClick={handleRefresh} disabled={busy || !configured}>
            Refresh
          </button>
        </div>
        <div className="settings-view__list">
          <div className="settings-view__row-detail">
            Local: {localCounts ? formatCounts(localCounts) : 'Not loaded'}
          </div>
          <div className="settings-view__row-detail">
            Workspace: {status?.workspace.name ?? 'Not connected'}
          </div>
          <div className="settings-view__row-detail">
            Cloud snapshot: {status?.hasSnapshot ? `Updated ${formatDate(status.updatedAt)}` : 'None'}
          </div>
          {cloudCounts && (
            <div className="settings-view__row-detail">
              Cloud: {cloudCounts}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--primary btn--sm" onClick={handleUpload} disabled={busy || !session}>
              Upload local setup
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={handlePreviewPull} disabled={busy || !session || !status?.payload}>
              Pull cloud setup
            </button>
          </div>
        </div>
      </div>

      {pullPreview && (
        <div className="settings-view__card">
          <h2 className="settings-view__sub-header">Pull Preview</h2>
          <p className="settings-view__helper">{formatCounts(pullPreview.counts)}</p>
          {pullPreview.blocked ? (
            <div className="settings-view__list">
              {pullPreview.issues.map((issue) => (
                <div key={`${issue.entity}:${issue.id}`} className="settings-view__row-detail">
                  {issue.label}: {issue.references.tasks} task refs · {issue.references.plans} plan refs · {issue.references.templates} template refs · {issue.references.readOnlyWorkTypes} imported work type refs
                </div>
              ))}
            </div>
          ) : (
            <button type="button" className="btn btn--primary btn--sm" onClick={handleApplyPull} disabled={busy}>
              Apply pull
            </button>
          )}
        </div>
      )}

      {message && (
        <div className="settings-view__card">
          <p className="settings-view__helper">{message}</p>
        </div>
      )}
    </SettingsDetailLayout>
  );
}
