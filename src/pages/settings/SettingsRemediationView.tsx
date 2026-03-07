import { useMemo, useState } from 'react';
import { ReassignEntrySheet } from '../../components/ReassignEntrySheet';
import { RemediationIssueCard } from '../../components/RemediationIssueCard';
import { RemediationQueueSummary } from '../../components/RemediationQueueSummary';
import { RemediationWorkTypeAssignSheet } from '../../components/RemediationWorkTypeAssignSheet';
import { LoadingBlock } from '../../components/LoadingBlock';
import { useRemediationData } from '../../lib/hooks/useRemediationData';
import type { BaseIssueItem, EntryLevelIssueItem, IssueQueueItem } from '../../lib/remediation/issue-queue';
import type { BulkClassifyResult } from '../../lib/remediation/worktype-classify';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { CheckIcon } from '../../components/icons';
import { SettingsDetailLayout } from './SettingsDetailLayout';

interface SettingsRemediationViewProps {
  onBack: () => void;
}

export interface QueueCounters {
  totalScopes: number;
  totalEntries: number;
  manualRequired: number;
}

export interface SuggestionQueueCounters extends QueueCounters {
  withSuggestion: number;
}

export function getQueueCounters(items: BaseIssueItem[]): QueueCounters {
  const totalEntries = items.reduce((sum, item) => sum + item.entryCount, 0);
  return {
    totalScopes: items.length,
    totalEntries,
    manualRequired: items.length,
  };
}

export function getSuggestionQueueCounters(items: EntryLevelIssueItem[]): SuggestionQueueCounters {
  const withSuggestion = items.filter((item) => item.recommendedWorkTypeId != null).length;
  const counters = getQueueCounters(items);
  return {
    ...counters,
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

function getRecommendedWorkTypeId(item: IssueQueueItem): string | null {
  return item.category === 'no_work_context' ? null : item.recommendedWorkTypeId;
}

export function SettingsRemediationView({ onBack }: SettingsRemediationViewProps) {
  const { workTypes } = useWorkTypeStore();
  const {
    isLoading,
    isApplying,
    queues,
    progress,
    error,
    lastUpdatedAt,
    actionMessage,
    load,
    applyQueue,
    handleClassificationApplied,
    handleManualReassigned,
  } = useRemediationData();
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

  const needsCounters = getSuggestionQueueCounters(queues?.needsMeasurableOwner ?? []);
  const noWorkContextCounters = getQueueCounters(queues?.noWorkContext ?? []);
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
          <LoadingBlock />
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
              <RemediationQueueSummary
                queues={queues}
                needsCounters={needsCounters}
                noWorkContextCounters={noWorkContextCounters}
              />
            )}

            {queues && queues.totalIssues === 0 && (
              <div className="empty-state">
                <CheckIcon className="empty-state__icon" aria-hidden />
                <p className="empty-state__heading">No open issues</p>
                <p className="empty-state__text">All attribution and work data is in good shape.</p>
              </div>
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
                  disabled={isApplying || queues.ambiguousOwner.every((i) => i.recommendedWorkTypeId == null)}
                  onClick={() => {
                    void handleApplyAmbiguous();
                  }}
                >
                  {isApplying ? 'Applying...' : 'Apply Ambiguous Suggestions'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--full"
                  disabled={isApplying || needsCounters.withSuggestion === 0}
                  onClick={() => {
                    void handleApplyNeeds();
                  }}
                >
                  {isApplying ? 'Applying...' : 'Apply Needs-Owner Suggestions'}
                </button>
              </div>
            )}

            {queues && queues.needsMeasurableOwner.length > 0 && (
              <div className="remediation__issue-list">
                <h3 className="remediation__issue-list-heading">Needs Measurable Owner</h3>
                {queues.needsMeasurableOwner.map((item) => (
                  <RemediationIssueCard
                    key={`${item.taskId}-needs`}
                    item={item}
                    workTypeTitleById={workTypeTitleById}
                    onAssign={(issue) => {
                      setAssignEntry({
                        entryId: issue.entryId,
                        taskId: issue.taskId,
                        recommendedWorkTypeId: getRecommendedWorkTypeId(issue),
                        initialMode: 'existing',
                      });
                    }}
                    onCreateAssign={(issue) => {
                      setAssignEntry({
                        entryId: issue.entryId,
                        taskId: issue.taskId,
                        recommendedWorkTypeId: getRecommendedWorkTypeId(issue),
                        initialMode: 'create',
                      });
                    }}
                    onMoveEntry={(issue) => {
                      if (issue.entryId) {
                        setReassignEntry({ entryId: issue.entryId, taskId: issue.taskId });
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {queues && queues.ambiguousOwner.length > 0 && (
              <div className="remediation__issue-list">
                <h3 className="remediation__issue-list-heading">Ambiguous Owner</h3>
                {queues.ambiguousOwner.map((item) => (
                  <RemediationIssueCard
                    key={`${item.taskId}-ambiguous`}
                    item={item}
                    workTypeTitleById={workTypeTitleById}
                    onAssign={(issue) => {
                      setAssignEntry({
                        entryId: issue.entryId,
                        taskId: issue.taskId,
                        recommendedWorkTypeId: getRecommendedWorkTypeId(issue),
                        initialMode: 'existing',
                      });
                    }}
                    onCreateAssign={(issue) => {
                      setAssignEntry({
                        entryId: issue.entryId,
                        taskId: issue.taskId,
                        recommendedWorkTypeId: getRecommendedWorkTypeId(issue),
                        initialMode: 'create',
                      });
                    }}
                    onMoveEntry={(issue) => {
                      if (issue.entryId) {
                        setReassignEntry({ entryId: issue.entryId, taskId: issue.taskId });
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {queues && queues.noWorkContext.length > 0 && (
              <div className="remediation__issue-list">
                <h3 className="remediation__issue-list-heading">No Work Context</h3>
                {queues.noWorkContext.map((item) => (
                  <RemediationIssueCard
                    key={`${item.taskId}-nowork`}
                    item={item}
                    workTypeTitleById={workTypeTitleById}
                    onAssign={(issue) => {
                      setAssignEntry({
                        entryId: issue.entryId,
                        taskId: issue.taskId,
                        recommendedWorkTypeId: getRecommendedWorkTypeId(issue),
                        initialMode: 'existing',
                      });
                    }}
                    onCreateAssign={(issue) => {
                      setAssignEntry({
                        entryId: issue.entryId,
                        taskId: issue.taskId,
                        recommendedWorkTypeId: getRecommendedWorkTypeId(issue),
                        initialMode: 'create',
                      });
                    }}
                    onMoveEntry={(issue) => {
                      if (issue.entryId) {
                        setReassignEntry({ entryId: issue.entryId, taskId: issue.taskId });
                      }
                    }}
                  />
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
