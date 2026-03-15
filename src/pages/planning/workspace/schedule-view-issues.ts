import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import { generateConflictSuggestions } from '../../../lib/planning/scheduling/conflict-resolution';
import type { AutoScheduleUnresolvedReason } from '../../../lib/planning/scheduling/auto-schedule';
import type { AssistantReviewIssue } from '../hooks/useScheduleAssistantState';
import type { ScheduleIssueItem } from './schedule-issue-panel-types';

export type PlanningIssueSeverity = 'critical' | 'warning' | 'info';

export interface PlanningIssue {
  id: string;
  severity: PlanningIssueSeverity;
  label: string;
}

interface BuildScheduleViewIssuesParams {
  capacity: CapacitySummary;
  conflictSuggestions: ReturnType<typeof generateConflictSuggestions>;
  schedulableUnscheduledCount: number;
  assistantReportStale: boolean;
  assistantUnresolvedCount: number;
  assistantReviewIssues: AssistantReviewIssue[];
}

function unresolvedReasonLabel(reason: AutoScheduleUnresolvedReason): string {
  switch (reason) {
    case 'missing_required_hours':
      return 'Missing required hours';
    case 'no_work_days':
      return 'No work days';
    case 'no_capacity_window':
      return 'No capacity window';
    default:
      return 'Unresolved';
  }
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatMinutesAsDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function buildScheduleViewIssues({
  capacity,
  conflictSuggestions,
  schedulableUnscheduledCount,
  assistantReportStale,
  assistantUnresolvedCount,
  assistantReviewIssues,
}: BuildScheduleViewIssuesParams): {
  planningIssues: PlanningIssue[];
  panelIssues: ScheduleIssueItem[];
} {
  const planningIssues: PlanningIssue[] = [];
  const panelIssues: ScheduleIssueItem[] = [];

  if (capacity.overWorkerCapacityDayCount > 0) {
    planningIssues.push({
      id: 'worker-capacity',
      severity: 'critical',
      label: `${capacity.overWorkerCapacityDayCount} ${capacity.overWorkerCapacityDayCount === 1 ? 'day has' : 'days have'} too much work for available crew`,
    });
    panelIssues.push({
      id: 'worker-capacity',
      kind: 'capacity',
      severity: 'critical',
      assistantPriority: 10,
      impact: 'Solving the constrained day first is likely to unblock multiple assignments at once.',
      sharedConstraintKey: 'plan:capacity',
      label: `${capacity.overWorkerCapacityDayCount} ${capacity.overWorkerCapacityDayCount === 1 ? 'day has' : 'days have'} too much work for available crew`,
      scope: 'plan',
      category: 'blocking',
      detail: 'Some scheduled days require more person-hours than the assigned crew can physically deliver.',
      facts: conflictSuggestions.workerCapacitySuggestions
        .slice(0, 2)
        .map((suggestion) => suggestion.message),
    });
  }

  if (capacity.overAllocatedDayCount > 0) {
    planningIssues.push({
      id: 'over-allocated',
      severity: 'critical',
      label: `${capacity.overAllocatedDayCount} ${capacity.overAllocatedDayCount === 1 ? 'day is' : 'days are'} overloaded`,
    });
    panelIssues.push({
      id: 'over-allocated',
      kind: 'capacity',
      severity: 'critical',
      assistantPriority: 15,
      impact: 'Relieving the most overloaded day should create immediate placement room for the assistant.',
      sharedConstraintKey: 'plan:capacity',
      label: `${capacity.overAllocatedDayCount} ${capacity.overAllocatedDayCount === 1 ? 'day is' : 'days are'} overloaded`,
      scope: 'plan',
      category: 'blocking',
      detail: 'Assigned work currently exceeds the available crew capacity on some scheduled days.',
      facts: [
        ...conflictSuggestions.crewSuggestions
          .slice(0, 1)
          .map((suggestion) => `Add ${suggestion.additionalCrew} crew on ${formatShortDate(suggestion.date)}.`),
        ...conflictSuggestions.overtimeSuggestions
          .slice(0, 1)
          .map((suggestion) => `Extend ${formatShortDate(suggestion.date)} by ${formatMinutesAsDuration(suggestion.extendMinutes)}.`),
      ],
    });
  }

  if (schedulableUnscheduledCount > 0) {
    planningIssues.push({
      id: 'unscheduled',
      severity: 'warning',
      label: `${schedulableUnscheduledCount} ${schedulableUnscheduledCount === 1 ? 'assignment' : 'assignments'} not yet scheduled`,
    });
    panelIssues.push({
      id: 'unscheduled',
      kind: 'unscheduled',
      severity: 'warning',
      assistantPriority: 30,
      impact: 'Giving these rows valid spans lets the assistant place and optimize the remaining work.',
      label: `${schedulableUnscheduledCount} ${schedulableUnscheduledCount === 1 ? 'assignment' : 'assignments'} not yet scheduled`,
      scope: 'plan',
      category: 'adjustment',
      detail: 'These rows still have no scheduled span, so the work has nowhere to be placed in the grid yet.',
      facts: [
        `${schedulableUnscheduledCount} ${schedulableUnscheduledCount === 1 ? 'row is' : 'rows are'} still missing scheduled dates.`,
      ],
    });
  }

  if (assistantReportStale) {
    planningIssues.push({
      id: 'assistant-stale',
      severity: 'warning',
      label: 'Schedule changed - re-run to re-check',
    });
    panelIssues.push({
      id: 'assistant-stale',
      kind: 'assistant-stale',
      severity: 'warning',
      assistantPriority: 0,
      label: 'Schedule changed - re-run to re-check',
      scope: 'plan',
      category: 'blocking',
      detail: 'Assistant findings are out of date because the schedule changed after the last run.',
    });
  }

  if (!assistantReportStale) {
    for (const issue of assistantReviewIssues) {
      const missingHours = Math.max(0, issue.requiredPH - issue.assignedPH);
      const detail =
        issue.reason === 'missing_required_hours'
          ? `${missingHours.toFixed(1)}h missing of ${issue.requiredPH.toFixed(1)}h required for ${issue.phase}.`
          : issue.reason === 'no_work_days'
            ? `The current ${issue.phase} window contains no work days the assistant can use.`
            : `The current ${issue.phase} window has no remaining crew capacity the assistant can use.`;
      const facts: string[] = [];
      if (issue.reason === 'missing_required_hours') {
        facts.push(`${issue.assignedPH.toFixed(1)}h currently scheduled of ${issue.requiredPH.toFixed(1)}h needed.`);
      }
      facts.push(`${issue.lineItemTitle} is blocked in ${issue.phase}.`);
      panelIssues.push({
        id: `assistant-unresolved-${issue.key}`,
        kind: 'assistant-unresolved',
        severity: 'warning',
        assistantPriority:
          issue.reason === 'no_work_days'
            ? 40
            : issue.reason === 'no_capacity_window'
              ? 45
              : 50,
        impact:
          issue.reason === 'no_work_days'
            ? 'Opening work days in this window would give the assistant a place to schedule the row.'
            : issue.reason === 'no_capacity_window'
              ? 'Finding capacity in this window may unblock this row without changing its dates.'
              : `${missingHours.toFixed(1)}h still need placement for this row.`,
        sharedConstraintKey: `reason:${issue.reason}:${issue.phase}`,
        label: `${issue.lineItemTitle} · ${issue.phase} · ${unresolvedReasonLabel(issue.reason)}`,
        scope: 'item',
        category: 'adjustment',
        detail,
        facts: facts.slice(0, 2),
        lineItemId: issue.lineItemId,
        phase: issue.phase,
        issueKey: issue.key,
        unresolvedReason: issue.reason,
        requiredPH: issue.requiredPH,
        assignedPH: issue.assignedPH,
      });
    }
  }

  if (assistantUnresolvedCount > 0) {
    planningIssues.push({
      id: 'assistant-unresolved',
      severity: 'warning',
      label: `${assistantUnresolvedCount} ${assistantUnresolvedCount === 1 ? 'item' : 'items'} still ${assistantUnresolvedCount === 1 ? 'needs' : 'need'} review`,
    });
  }

  if (capacity.overStaffedDayCount > 0) {
    planningIssues.push({
      id: 'over-staffed',
      severity: 'info',
      label: `${capacity.overStaffedDayCount} ${capacity.overStaffedDayCount === 1 ? 'day' : 'days'} may be overstaffed`,
    });
    panelIssues.push({
      id: 'overstaffed',
      kind: 'overstaffed',
      severity: 'info',
      assistantPriority: 90,
      impact: 'This is an optimization opportunity rather than a blocker.',
      label: `${capacity.overStaffedDayCount} ${capacity.overStaffedDayCount === 1 ? 'day may be' : 'days may be'} overstaffed`,
      scope: 'plan',
      category: 'optimization',
      detail: 'Some days appear to carry more crew than the planned work currently needs.',
      facts: [`${capacity.overStaffedDayCount} ${capacity.overStaffedDayCount === 1 ? 'day has' : 'days have'} spare crew capacity.`],
    });
  }

  return { planningIssues, panelIssues };
}
