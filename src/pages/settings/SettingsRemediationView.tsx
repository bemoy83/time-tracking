import { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '../../lib/stores/task-store';
import { getCachedAttribution, recomputeAttribution } from '../../lib/attribution/cache';
import { getAttributionPolicy } from '../../lib/stores/attribution-settings';
import { buildIssueQueues, type IssueQueueItem, type IssueQueueResult } from '../../lib/remediation/issue-queue';
import { computeDataQualityProgress, type DataQualityProgress } from '../../lib/remediation/data-quality';
import {
  bulkClassifyToRecommendedWorkType,
  type BulkClassifyResult,
  type ClassifyEntryToWorkTypeResult,
  type CreateAndClassifyResult,
} from '../../lib/remediation/worktype-classify';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { RemediationWorkTypeAssignSheet } from '../../components/RemediationWorkTypeAssignSheet';
import { ReassignEntrySheet } from '../../components/ReassignEntrySheet';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';

interface SettingsRemediationViewProps {
  onBack: () => void;
}

interface NeedsActionCounters {
  total: number;
  withSuggestion: number;
  manualRequired: number;
}

export function getNeedsActionCounters(items: IssueQueueItem[]): NeedsActionCounters {
  const withSuggestion = items.filter((item) => item.recommendedWorkTypeId != null).length;
  return {
    total: items.length,
    withSuggestion,
    manualRequired: items.length - withSuggestion,
  };
}

export function summarizeBulkFixResult(label: string, result: BulkClassifyResult): string {
  if (result.attempted === 0) {
    return `${label}: no eligible entries with recommended WorkType.`;
  }
  if (result.failed.length === 0) {
    return `${label}: ${result.succeeded}/${result.attempted} entries classified.`;
  }
  return `${label}: ${result.succeeded}/${result.attempted} entries classified, ${result.failed.length} failed.`;
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
    entryId: string;
    taskId: string;
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
      const attribution = options.forceRecompute
        ? await recomputeAttribution(policy)
        : await getCachedAttribution(policy);
      const issueQueues = buildIssueQueues(attribution.results, tasks);
      const quality = computeDataQualityProgress(attribution.summary, issueQueues);
      setQueues(issueQueues);
      setProgress(quality);
      setLastUpdatedAt(attribution.computedAt);
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
      await recomputeAttribution(getAttributionPolicy());
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
    result: ClassifyEntryToWorkTypeResult | CreateAndClassifyResult,
  ) => {
    const createdPrefix = 'createdWorkTypeId' in result ? 'Created + assigned WorkType.' : 'Assigned WorkType.';
    const warningSuffix = result.warning === 'missing_quantity'
      ? ' KPI will include this task after quantity is set.'
      : '';
    setActionMessage(`${createdPrefix}${warningSuffix}`);
    try {
      await recomputeAttribution(getAttributionPolicy());
      await load({ forceRecompute: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh remediation data.');
    }
  };

  const handleManualReassigned = async () => {
    setActionMessage('Manual move-entry reassignment applied.');
    await recomputeAttribution(getAttributionPolicy());
    await load({ forceRecompute: true });
  };

  const needsCounters = getNeedsActionCounters(queues?.needsMeasurableOwner ?? []);
  const hasAutoApplicable = (queues?.ambiguousOwner.some((i) => i.recommendedWorkTypeId != null) ?? false)
    || needsCounters.withSuggestion > 0;

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
              <div className="settings-view__list">
                <div className="settings-view__row">
                  <div className="settings-view__template-info">
                    <span className="settings-view__row-label">Failed to refresh remediation data</span>
                    <span className="settings-view__row-detail">{error}</span>
                  </div>
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
              <div className="settings-view__list">
                <div className="settings-view__row">
                  <div className="settings-view__template-info">
                    <span className="settings-view__row-label">
                      Quality grade: {progress.grade}
                    </span>
                    <span className="settings-view__row-detail">
                      {progress.attributionRate}% attributed · {progress.totalOpenIssues} open issues · {progress.affectedHours.toFixed(1)} affected hrs
                    </span>
                  </div>
                </div>
              </div>
            )}

            {queues && (
              <div className="settings-view__list">
                <div className="settings-view__row">
                  <div className="settings-view__template-info">
                    <span className="settings-view__row-label">Needs measurable owner</span>
                    <span className="settings-view__row-detail">
                      {needsCounters.total} entries · {needsCounters.withSuggestion} with suggestion · {needsCounters.manualRequired} manual
                    </span>
                  </div>
                </div>
                <div className="settings-view__row">
                  <div className="settings-view__template-info">
                    <span className="settings-view__row-label">Ambiguous owner</span>
                    <span className="settings-view__row-detail">
                      {queues.ambiguousOwner.length} entries with suggestions
                    </span>
                  </div>
                </div>
                <div className="settings-view__row">
                  <div className="settings-view__template-info">
                    <span className="settings-view__row-label">No work context</span>
                    <span className="settings-view__row-detail">
                      {queues.noWorkContext.length} completed tasks
                    </span>
                  </div>
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
              <div className="settings-view__card-header" style={{ marginTop: 12, gap: 8 }}>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={isApplying || queues.ambiguousOwner.every((i) => i.recommendedWorkTypeId == null)}
                  onClick={() => {
                    void handleApplyAmbiguous();
                  }}
                >
                  {isApplying ? 'Applying...' : 'Apply Ambiguous WorkType Suggestions'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={isApplying || needsCounters.withSuggestion === 0}
                  onClick={() => {
                    void handleApplyNeeds();
                  }}
                >
                  {isApplying ? 'Applying...' : 'Apply Needs-Owner WorkType Suggestions'}
                </button>
              </div>
            )}

            {queues && queues.needsMeasurableOwner.length > 0 && (
              <div className="settings-view__list" style={{ marginTop: 12 }}>
                {queues.needsMeasurableOwner.map((item) => (
                  <div key={`${item.entryId ?? item.taskId}-needs`} className="settings-view__row">
                    <div className="settings-view__template-info">
                      <span className="settings-view__row-label">{item.taskTitle}</span>
                      <span className="settings-view__row-detail">
                        {item.personHours.toFixed(2)} hrs · {item.description}
                      </span>
                      {item.suggestedTargetTitle && (
                        <span className="settings-view__row-detail">
                          Suggested: {item.suggestedTargetTitle} ({item.suggestionSource})
                        </span>
                      )}
                      {item.recommendedWorkTypeId && (
                        <span className="settings-view__row-detail">
                          Recommended WorkType: {workTypeTitleById.get(item.recommendedWorkTypeId) ?? item.recommendedWorkTypeId}
                        </span>
                      )}
                    </div>
                    {item.entryId && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => {
                            setAssignEntry({
                              entryId: item.entryId!,
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
                              entryId: item.entryId!,
                              taskId: item.taskId,
                              recommendedWorkTypeId: item.recommendedWorkTypeId,
                              initialMode: 'create',
                            });
                          }}
                        >
                          Create + Assign
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => setReassignEntry({ entryId: item.entryId!, taskId: item.taskId })}
                        >
                          Advanced: Move Entry
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {queues && queues.ambiguousOwner.length > 0 && (
              <div className="settings-view__list" style={{ marginTop: 12 }}>
                {queues.ambiguousOwner.map((item) => (
                  <div key={`${item.entryId ?? item.taskId}-ambiguous`} className="settings-view__row">
                    <div className="settings-view__template-info">
                      <span className="settings-view__row-label">{item.taskTitle}</span>
                      <span className="settings-view__row-detail">
                        {item.personHours.toFixed(2)} hrs · {item.description}
                      </span>
                      {item.suggestedTargetTitle && (
                        <span className="settings-view__row-detail">
                          Suggested: {item.suggestedTargetTitle} ({item.suggestionSource})
                        </span>
                      )}
                      {item.recommendedWorkTypeId && (
                        <span className="settings-view__row-detail">
                          Recommended WorkType: {workTypeTitleById.get(item.recommendedWorkTypeId) ?? item.recommendedWorkTypeId}
                        </span>
                      )}
                    </div>
                    {item.entryId && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => {
                            setAssignEntry({
                              entryId: item.entryId!,
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
                              entryId: item.entryId!,
                              taskId: item.taskId,
                              recommendedWorkTypeId: item.recommendedWorkTypeId,
                              initialMode: 'create',
                            });
                          }}
                        >
                          Create + Assign
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => setReassignEntry({ entryId: item.entryId!, taskId: item.taskId })}
                        >
                          Advanced: Move Entry
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {assignEntry && (
        <RemediationWorkTypeAssignSheet
          isOpen={true}
          onClose={() => setAssignEntry(null)}
          entryId={assignEntry.entryId}
          taskId={assignEntry.taskId}
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
