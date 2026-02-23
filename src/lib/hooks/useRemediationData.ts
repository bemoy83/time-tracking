import { useEffect, useState } from 'react';
import { loadAttributionDiagnostics } from '../attribution/diagnostics';
import type { DataQualityProgress } from '../remediation/data-quality';
import type { EntryLevelIssueItem, IssueQueueResult } from '../remediation/issue-queue';
import {
  bulkClassifyToRecommendedWorkType,
  type BulkClassifyResult,
  type ClassifyTaskToWorkTypeResult,
  type CreateAndClassifyTaskResult,
} from '../remediation/worktype-classify';
import { getAttributionPolicy } from '../stores/attribution-settings';
import { useTaskStore } from '../stores/task-store';
import { trackTelemetryEvent } from '../telemetry/telemetry';

interface UseRemediationDataResult {
  isLoading: boolean;
  isApplying: boolean;
  queues: IssueQueueResult | null;
  progress: DataQualityProgress | null;
  error: string | null;
  lastUpdatedAt: string | null;
  actionMessage: string | null;
  load: (options?: { forceRecompute?: boolean }) => Promise<void>;
  applyQueue: (items: EntryLevelIssueItem[], label: string) => Promise<void>;
  handleClassificationApplied: (
    result: ClassifyTaskToWorkTypeResult | CreateAndClassifyTaskResult,
  ) => Promise<void>;
  handleManualReassigned: () => Promise<void>;
}

function summarizeBulkFixResult(label: string, result: BulkClassifyResult): string {
  if (result.attempted === 0) {
    return `${label}: no eligible task scopes with recommended WorkType.`;
  }
  if (result.failed.length === 0) {
    return `${label}: ${result.succeeded}/${result.attempted} scopes classified.`;
  }
  return `${label}: ${result.succeeded}/${result.attempted} scopes classified, ${result.failed.length} failed.`;
}

export function useRemediationData(): UseRemediationDataResult {
  const { tasks } = useTaskStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [queues, setQueues] = useState<IssueQueueResult | null>(null);
  const [progress, setProgress] = useState<DataQualityProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  const applyQueue = async (items: EntryLevelIssueItem[], label: string) => {
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

  return {
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
  };
}
