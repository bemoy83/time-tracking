import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlanLineItem } from '../../../lib/planning/plan-model';
import type {
  AutoScheduleReport,
  AutoScheduleUnresolvedReason,
} from '../../../lib/planning/scheduling/auto-schedule';
import type { BuildPhase } from '../../../lib/types';

export interface AssistantReviewIssue {
  key: string;
  lineItemId: string;
  lineItemTitle: string;
  phase: BuildPhase;
  reason: AutoScheduleUnresolvedReason;
  requiredPH: number;
  assignedPH: number;
}

interface UseScheduleAssistantStateParams {
  planId: string;
  lineItems: PlanLineItem[];
}

export function useScheduleAssistantState({
  planId,
  lineItems,
}: UseScheduleAssistantStateParams) {
  const [assistantReport, setAssistantReport] = useState<AutoScheduleReport | null>(null);
  const [assistantReportStale, setAssistantReportStale] = useState(false);
  const [activeAssistantIssueIndex, setActiveAssistantIssueIndex] = useState<number | null>(null);

  useEffect(() => {
    setAssistantReport(null);
    setAssistantReportStale(false);
    setActiveAssistantIssueIndex(null);
  }, [planId]);

  const markAssistantFindingsStale = useCallback(() => {
    if (assistantReport != null) setAssistantReportStale(true);
    setActiveAssistantIssueIndex((prev) => (prev == null ? prev : null));
  }, [assistantReport]);

  const applyAssistantRunReport = useCallback((report: AutoScheduleReport) => {
    setAssistantReport(report);
    setAssistantReportStale(false);
    setActiveAssistantIssueIndex(null);
  }, []);

  const hasFreshAssistantReport = assistantReport != null && !assistantReportStale;
  const assistantUnresolvedCount = hasFreshAssistantReport ? assistantReport.unresolved.length : 0;

  const assistantReviewIssues = useMemo<AssistantReviewIssue[]>(() => {
    if (!hasFreshAssistantReport || assistantReport.unresolved.length === 0) return [];
    const titleByLineItemId = new Map(lineItems.map((item) => [item.id, item.title]));
    const deduped = new Map<string, AssistantReviewIssue>();
    for (const issue of assistantReport.unresolved) {
      const key = `${issue.lineItemId}:${issue.phase}`;
      if (deduped.has(key)) continue;
      deduped.set(key, {
        key,
        lineItemId: issue.lineItemId,
        lineItemTitle: titleByLineItemId.get(issue.lineItemId) ?? issue.lineItemId,
        phase: issue.phase,
        reason: issue.reason,
        requiredPH: issue.requiredPH,
        assignedPH: issue.assignedPH,
      });
    }
    return [...deduped.values()];
  }, [assistantReport, hasFreshAssistantReport, lineItems]);

  const activeAssistantIssue =
    activeAssistantIssueIndex != null
      ? assistantReviewIssues[activeAssistantIssueIndex] ?? null
      : null;

  const unresolvedIssueKeys = useMemo(
    () => new Set(assistantReviewIssues.map((issue) => issue.key)),
    [assistantReviewIssues],
  );

  const focusNextReviewIssue = useCallback(() => {
    if (assistantReviewIssues.length === 0) return false;
    setActiveAssistantIssueIndex((prev) => {
      const current = prev == null ? -1 : prev;
      return (current + 1) % assistantReviewIssues.length;
    });
    return true;
  }, [assistantReviewIssues.length]);

  const focusPrevReviewIssue = useCallback(() => {
    if (assistantReviewIssues.length === 0) return false;
    setActiveAssistantIssueIndex((prev) => {
      const current = prev == null ? 0 : prev;
      return (current - 1 + assistantReviewIssues.length) % assistantReviewIssues.length;
    });
    return true;
  }, [assistantReviewIssues.length]);

  return {
    assistantReport,
    assistantReportStale,
    assistantUnresolvedCount,
    assistantReviewIssues,
    activeAssistantIssue,
    activeAssistantIssueIndex,
    unresolvedIssueKeys,
    markAssistantFindingsStale,
    applyAssistantRunReport,
    focusNextReviewIssue,
    focusPrevReviewIssue,
  };
}

