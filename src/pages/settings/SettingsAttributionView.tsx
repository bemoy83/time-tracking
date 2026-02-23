import { useEffect, useState } from 'react';
import { useTaskStore } from '../../lib/stores/task-store';
import { getAttributionPolicy, setAttributionPolicy } from '../../lib/stores/attribution-settings';
import type { AttributionPolicy } from '../../lib/types';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import {
  loadAttributionDiagnostics,
  type AttributionDiagnostics,
} from '../../lib/attribution/diagnostics';

interface SettingsAttributionViewProps {
  onBack: () => void;
  onOpenRemediation: () => void;
}

function formatUpdatedAt(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function buildAttributionStatusLine(
  diagnostics: Pick<AttributionDiagnostics, 'summary' | 'progress' | 'computedAt'> | null,
): string {
  if (!diagnostics || diagnostics.summary.totalEntries === 0) {
    return 'No time entries yet.';
  }
  const base = `${diagnostics.progress.attributionRate}% attributed · ${diagnostics.progress.totalOpenIssues} open issues · ${diagnostics.progress.affectedHours.toFixed(1)} affected hrs`;
  const updated = formatUpdatedAt(diagnostics.computedAt);
  return updated ? `${base} · Updated ${updated}` : base;
}

export function SettingsAttributionView({ onBack, onOpenRemediation }: SettingsAttributionViewProps) {
  const { tasks } = useTaskStore();
  const [policy, setPolicy] = useState<AttributionPolicy>(getAttributionPolicy);
  const [diagnostics, setDiagnostics] = useState<AttributionDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (options: { forceRecompute?: boolean } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await loadAttributionDiagnostics({
        tasks,
        policy,
        forceRecompute: options.forceRecompute,
      });
      setDiagnostics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attribution diagnostics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tasks, policy]);

  return (
    <SettingsDetailLayout title="Attribution Quality" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Attribution Quality</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={async () => {
              await load({ forceRecompute: true });
            }}
          >
            Recompute
          </button>
        </div>
        <p className="settings-view__helper">Set attribution policy and monitor quality.</p>
        <label className="attribution__policy-control">
          <span className="attribution__policy-label">Policy</span>
          <select
            className="input"
            value={policy}
            onChange={(e) => {
              const next = e.target.value as AttributionPolicy;
              setPolicy(next);
              setAttributionPolicy(next);
            }}
          >
            <option value="soft_allow_flag">Suggest only (default)</option>
            <option value="strict_block">Strict block</option>
            <option value="soft_allow_pick_nearest">Auto-apply nearest</option>
          </select>
        </label>

        {isLoading && diagnostics == null ? (
          <p className="settings-view__empty">Loading...</p>
        ) : diagnostics && diagnostics.summary.totalEntries === 0 ? (
          <p className="settings-view__empty">No time entries yet.</p>
        ) : diagnostics ? (
          <div className="attribution__status">
            <span className="attribution__status-grade">
              {diagnostics.progress.attributionRate}% attributed
            </span>
            <span className="attribution__status-detail">
              {diagnostics.progress.totalOpenIssues} open issues · {diagnostics.progress.affectedHours.toFixed(1)} affected hrs
            </span>
            {formatUpdatedAt(diagnostics.computedAt) && (
              <span className="attribution__status-detail">
                Updated {formatUpdatedAt(diagnostics.computedAt)}
              </span>
            )}
            <div className="attribution__status-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--full"
                onClick={onOpenRemediation}
              >
                Open Remediation
              </button>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="attribution__error">
            <span className="attribution__error-title">Failed to refresh diagnostics</span>
            <span className="attribution__error-detail">{error}</span>
            <div className="attribution__error-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  void load({ forceRecompute: true });
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </SettingsDetailLayout>
  );
}
