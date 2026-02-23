import { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '../../lib/stores/task-store';
import { getAttributionPolicy } from '../../lib/stores/attribution-settings';
import type { IssueQueueItem, IssueQueueResult } from '../../lib/remediation/issue-queue';
import type { DataQualityProgress } from '../../lib/remediation/data-quality';
import {
  bulkClassifyToRecommendedWorkType,
  type BulkClassifyResult,
  type ClassifyTaskToWorkTypeResult,
  type CreateAndClassifyTaskResult,
} from '../../lib/remediation/worktype-classify';
import { loadAttributionDiagnostics } from '../../lib/attribution/diagnostics';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { RemediationWorkTypeAssignSheet } from '../../components/RemediationWorkTypeAssignSheet';
import { ReassignEntrySheet } from '../../components/ReassignEntrySheet';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import { isRolloutGateOpen, REMEDIATION_BULK_GATE } from '../../lib/flags/rollout-gates';

interface SettingsRemediationViewProps {
  onBack: () => void;
}

interface NeedsActionCounters {
  totalScopes: number;
  totalEntries: number;
  withSuggestion: number;
  manualRequired: number;
}

export function getNeedsActionCounters(items: IssueQueueItem[]): NeedsActionCounters {
  const withSuggestion = items.filter((item) => item.recommendedWorkTypeId != null).length;
  const totalEntries = items.reduce((sum, item) => sum + item.entryCount, 0);
  return {
    totalScopes: items.length,
    totalEntries,
    withSuggestion,
    manualRequired: items.length - withSuggestion,
  };
}

export function summarizeBulkFixResult(label: string, result: BulkClassifyResult): string {
  if (result.attempted === 0) {
    return `${label}: no eligible task scopes with recommended WorkType.`;
  }
  if (result.failed.length === 0) {
    return `${label}: ${result.succeeded}/${result.attempted} scopes classified.`;
  }
  return `${label}: ${result.succeeded}/${result.attempted} scopes classified, ${result.failed.length} failed.`;
}

function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function SettingsRemediationView({ onBack }: SettingsRemediationViewProps) {
  const { tasks } = useTaskStore();
  const { workTypes } = useWorkTypeStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [queues, setQueues] = useState<IssueQueueResult | null>(null);
  const [progress, setProgress] = useState<DataQualityProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [assignEntry, setAssignEntry] = useState<{
    taskId: string;
    entryId: string | null;
    recommendedWorkTypeId: string | null;
    initialMode: 'existing' | 'create';
  } | null>(null);
  const [reassignEntry, setReassignEntry] = useState<{ entryId: string; taskId: string } | null>(null);

  const workTypeTitleById = useMemo(
    () => new Map(workTypes.map((workType) => [workType.id, workType.title])),
    [workTypes],
  );

  const load = async (options: { forceRecompute?: boolean } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const policy = getAttributionPolicy();
      const diagnostics = await loadAttributionDiagnostics({
        tasks,
        policy,
        forceRecompute: options.forceRecompute,
      });
      setQueues(diagnostics.queues);
      setProgress(diagnostics.progress);
      setLastUpdatedAt(diagnostics.computedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load remediation data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tasks]);

  const applyQueue = async (items: IssueQueueItem[], label: string) => {
    setIsApplying(true);
    setError(null);
    setActionMessage(null);
    try {
      const result = await bulkClassifyToRecommendedWorkType(items, label);
      setActionMessage(summarizeBulkFixResult(label, result));
      if (result.attempted > 0) {
        trackTelemetryEvent('remediation_bulk_apply');
      }
      await load({ forceRecompute: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply remediation action.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyAmbiguous = async () => {
    if (!queues) return;
    await applyQueue(queues.ambiguousOwner, 'Apply ambiguous WorkType suggestions');
  };

  const handleApplyNeeds = async () => {
    if (!queues) return;
    await applyQueue(
      queues.needsMeasurableOwner,
      'Apply needs-owner WorkType suggestions',
    );
  };

  const handleClassificationApplied = async (
    result: ClassifyTaskToWorkTypeResult | CreateAndClassifyTaskResult,
  ) => {
    const createdPrefix = 'createdWorkTypeId' in result ? 'Created + assigned WorkType.' : 'Assigned WorkType.';
    const warningSuffix = result.warning === 'missing_quantity'
      ? ' KPI will include this task after quantity is set.'
      : '';
    setActionMessage(`${createdPrefix}${warningSuffix}`);
    try {
      await load({ forceRecompute: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh remediation data.');
    }
  };

  const handleManualReassigned = async () => {
    setActionMessage('Manual move-entry reassignment applied.');
    await load({ forceRecompute: true });
  };

  const needsCounters = getNeedsActionCounters(queues?.needsMeasurableOwner ?? []);
  const noWorkContextCounters = getNeedsActionCounters(queues?.noWorkContext ?? []);
  const hasAutoApplicable = (queues?.ambiguousOwner.some((i) => i.recommendedWorkTypeId != null) ?? false)
    || needsCounters.withSuggestion > 0;
  const bulkGateOpen = isRolloutGateOpen(REMEDIATION_BULK_GATE);

  const renderIssueCard = (item: IssueQueueItem, keyPrefix: string) => (
    <div key={`${item.taskId}-${keyPrefix}`} className="remediation__issue">
      <span className="remediation__issue-title">{item.taskTitle}</span>
      <div className="remediation__issue-meta">
        <span className="remediation__issue-stat">
          {item.personHours.toFixed(2)} hrs · {item.entryCount} {item.entryCount === 1 ? 'entry' : 'entries'}
        </span>
        <span className="remediation__issue-desc">{item.description}</span>
        {item.suggestedTargetTitle && (
          <span className="remediation__issue-suggestion">
            Suggested: {item.suggestedTargetTitle} ({item.suggestionSource})
          </span>
        )}
        {item.recommendedWorkTypeId && (
          <span className="remediation__issue-suggestion">
            Recommended: {workTypeTitleById.get(item.recommendedWorkTypeId) ?? item.recommendedWorkTypeId}
          </span>
        )}
        {item.conflictingRecommendedWorkTypeIds.length > 1 && (
          <span className="remediation__issue-conflict">
            Conflicting recommendations — manual selection required
          </span>
        )}
      </div>
      {item.entryCount > 0 && (
        <div className="remediation__issue-actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              setAssignEntry({
                entryId: item.entryId,
                taskId: item.taskId,
                recommendedWorkTypeId: item.recommendedWorkTypeId,
                initialMode: 'existing',
              });
            }}
          >
            Assign WorkType
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              setAssignEntry({
                entryId: item.entryId,
                taskId: item.taskId,
                recommendedWorkTypeId: item.recommendedWorkTypeId,
                initialMode: 'create',
              });
            }}
          >
            Create + Assign
          </button>
          {item.entryCount === 1 && item.entryId && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setReassignEntry({ entryId: item.entryId!, taskId: item.taskId })}
            >
              Move Entry
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <SettingsDetailLayout title="Remediation" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Issue Queues</h2>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              void load({ forceRecompute: true });
            }}
          >
            Refresh
          </button>
        </div>
        <p className="settings-view__helper">
          Fix unattributed time by assigning WorkTypes to source tasks.
        </p>
        {lastUpdatedAt && (
          <p className="settings-view__helper">Last recomputed: {formatUpdatedAt(lastUpdatedAt)}</p>
        )}

        {isLoading && queues == null ? (
          <p className="settings-view__empty">Loading...</p>
        ) : (
          <>
            {error && (
              <div className="remediation__issue">
                <span className="remediation__issue-title">Failed to refresh remediation data</span>
                <span className="remediation__issue-desc">{error}</span>
                <div className="remediation__issue-actions">
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

            {actionMessage && (
              <p className="settings-view__helper">{actionMessage}</p>
            )}

            {progress && (
              <div className="remediation__grade">
                <span className="remediation__grade-label">
                  Quality grade: {progress.grade}
                </span>
                <span className="remediation__grade-detail">
                  {progress.attributionRate}% attributed · {progress.totalOpenIssues} open issues
                </span>
                <span className="remediation__grade-detail">
                  {progress.affectedHours.toFixed(1)} affected hrs
                </span>
              </div>
            )}

            {queues && (
              <div className="remediation__queue-summary">
                <div className="remediation__queue-row">
                  <span className="remediation__queue-label">Needs measurable owner</span>
                  <span className="remediation__queue-detail">
                    {needsCounters.totalScopes} scopes · {needsCounters.totalEntries} entries
                  </span>
                  <span className="remediation__queue-detail">
                    {needsCounters.withSuggestion} with suggestion · {needsCounters.manualRequired} manual
                  </span>
                </div>
                <div className="remediation__queue-row">
                  <span className="remediation__queue-label">Ambiguous owner</span>
                  <span className="remediation__queue-detail">
                    {queues.ambiguousOwner.length} scopes with suggestions
                  </span>
                </div>
                <div className="remediation__queue-row">
                  <span className="remediation__queue-label">No work context</span>
                  <span className="remediation__queue-detail">
                    {noWorkContextCounters.totalScopes} scopes · {noWorkContextCounters.totalEntries} entries
                  </span>
                  <span className="remediation__queue-detail">
                    {noWorkContextCounters.manualRequired} manual
                  </span>
                </div>
              </div>
            )}

            {queues && queues.totalIssues === 0 && (
              <p className="settings-view__empty">No open remediation issues.</p>
            )}

            {queues && queues.totalIssues > 0 && !hasAutoApplicable && (
              <p className="settings-view__helper">
                Open issues found, but none have recommended WorkType suggestions. Use manual assignment.
              </p>
            )}

            {queues && (
              <div className="remediation__bulk-actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm btn--full"
                  disabled={isApplying || !bulkGateOpen || queues.ambiguousOwner.every((i) => i.recommendedWorkTypeId == null)}
                  onClick={() => {
                    void handleApplyAmbiguous();
                  }}
                >
                  {isApplying ? 'Applying...' : !bulkGateOpen ? 'Blocked by quality gate' : 'Apply Ambiguous Suggestions'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--full"
                  disabled={isApplying || !bulkGateOpen || needsCounters.withSuggestion === 0}
                  onClick={() => {
                    void handleApplyNeeds();
                  }}
                >
                  {isApplying ? 'Applying...' : !bulkGateOpen ? 'Blocked by quality gate' : 'Apply Needs-Owner Suggestions'}
                </button>
              </div>
            )}

            {queues && queues.needsMeasurableOwner.length > 0 && (
              <div className="remediation__issue-list">
                <h3 className="remediation__issue-list-heading">Needs Measurable Owner</h3>
                {queues.needsMeasurableOwner.map((item) => renderIssueCard(item, 'needs'))}
              </div>
            )}

            {queues && queues.ambiguousOwner.length > 0 && (
              <div className="remediation__issue-list">
                <h3 className="remediation__issue-list-heading">Ambiguous Owner</h3>
                {queues.ambiguousOwner.map((item) => renderIssueCard(item, 'ambiguous'))}
              </div>
            )}

            {queues && queues.noWorkContext.length > 0 && (
              <div className="remediation__issue-list">
                <h3 className="remediation__issue-list-heading">No Work Context</h3>
                {queues.noWorkContext.map((item) => renderIssueCard(item, 'nowork'))}
              </div>
            )}
          </>
        )}
      </div>

      {assignEntry && (
        <RemediationWorkTypeAssignSheet
          isOpen={true}
          onClose={() => setAssignEntry(null)}
          taskId={assignEntry.taskId}
          entryId={assignEntry.entryId}
          recommendedWorkTypeId={assignEntry.recommendedWorkTypeId}
          initialMode={assignEntry.initialMode}
          onAssigned={(result) => {
            void handleClassificationApplied(result);
          }}
        />
      )}

      {reassignEntry && (
        <ReassignEntrySheet
          isOpen={true}
          onClose={() => setReassignEntry(null)}
          entryId={reassignEntry.entryId}
          currentTaskId={reassignEntry.taskId}
          onReassigned={() => {
            void handleManualReassigned();
          }}
        />
      )}
    </SettingsDetailLayout>
  );
}
