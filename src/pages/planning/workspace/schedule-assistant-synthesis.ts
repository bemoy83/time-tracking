import type {
  ScheduleAssistantBestNextMove,
  ScheduleAssistantStatus,
  ScheduleIssueItem,
} from './schedule-issue-panel-types';

interface ScheduleAssistantSynthesisInput {
  isStale: boolean;
  unresolvedCount: number;
  issues: ScheduleIssueItem[];
  canRunAssistant: boolean;
}

interface ScheduleAssistantSynthesisResult {
  assistantStatus: ScheduleAssistantStatus;
  assistantSummary: string;
  assistantBestNextMove: ScheduleAssistantBestNextMove | null;
  assistantInsights: string[];
}

function formatPhaseLabel(phase: ScheduleIssueItem['phase']): string {
  return phase ?? 'schedule';
}

function buildBestNextMove(issue: ScheduleIssueItem): ScheduleAssistantBestNextMove {
  if (issue.kind === 'capacity') {
    return {
      title: issue.facts?.[0] ?? 'Relieve the constrained day first',
      rationale: issue.detail ?? 'Shared capacity pressure is blocking multiple scheduling decisions.',
      impact: issue.impact,
    };
  }

  if (issue.kind === 'unscheduled') {
    return {
      title: 'Establish valid spans for unscheduled work',
      rationale: issue.detail ?? 'Rows without scheduled spans cannot be placed or optimized.',
      impact: issue.impact,
    };
  }

  if (issue.kind === 'assistant-unresolved' && issue.unresolvedReason === 'no_work_days') {
    return {
      title: 'Open work days inside the current window',
      rationale: issue.detail ?? 'The assistant cannot place work when the current phase window has no usable days.',
      impact: issue.impact,
    };
  }

  if (issue.kind === 'assistant-unresolved' && issue.unresolvedReason === 'no_capacity_window') {
    return {
      title: 'Free capacity or widen the phase window',
      rationale: issue.detail ?? 'The current window has no remaining crew capacity for this work.',
      impact: issue.impact,
    };
  }

  if (issue.kind === 'assistant-unresolved') {
    return {
      title: 'Give the phase more room or more crew',
      rationale: issue.detail ?? 'This row still needs more scheduled hours than the current setup can deliver.',
      impact: issue.impact,
    };
  }

  return {
    title: issue.label,
    rationale: issue.detail ?? 'Review the issue details below.',
    impact: issue.impact,
  };
}

function buildSharedConstraintInsights(issues: ScheduleIssueItem[]): string[] {
  const grouped = new Map<string, ScheduleIssueItem[]>();
  for (const issue of issues) {
    if (!issue.sharedConstraintKey) continue;
    const list = grouped.get(issue.sharedConstraintKey);
    if (list) list.push(issue);
    else grouped.set(issue.sharedConstraintKey, [issue]);
  }

  const insights: string[] = [];
  for (const [key, groupedIssues] of grouped.entries()) {
    if (groupedIssues.length < 2) continue;
    const sample = groupedIssues[0];
    const phaseLabel = formatPhaseLabel(sample.phase);

    if (key.startsWith('reason:no_work_days:')) {
      insights.push(`Several ${phaseLabel} rows fail because their current windows contain no work days.`);
      continue;
    }

    if (key === 'plan:capacity') {
      insights.push('Most open issues trace back to the same constrained schedule days.');
      continue;
    }

    if (key.startsWith('reason:no_capacity_window:')) {
      insights.push(`Several ${phaseLabel} rows are blocked by the same lack of crew capacity in their current windows.`);
      continue;
    }

    if (key.startsWith('reason:missing_required_hours:')) {
      insights.push(`Most unresolved ${phaseLabel} rows are short on capacity, not dates.`);
    }
  }

  return insights;
}

export function synthesizeScheduleAssistant({
  isStale,
  unresolvedCount,
  issues,
  canRunAssistant,
}: ScheduleAssistantSynthesisInput): ScheduleAssistantSynthesisResult {
  if (isStale) {
    return {
      assistantStatus: 'stale',
      assistantSummary: 'The schedule changed after the last assistant run, so detailed unresolved guidance may no longer match the current grid.',
      assistantBestNextMove: canRunAssistant
        ? {
            title: 'Re-run the assistant',
            rationale: 'Refresh the findings before trusting unresolved issue guidance from the previous run.',
            impact: 'A fresh pass will confirm which issues still need attention.',
          }
        : null,
      assistantInsights: [],
    };
  }

  if (issues.length === 0) {
    return {
      assistantStatus: 'ready',
      assistantSummary: 'No scheduling blockers are currently detected.',
      assistantBestNextMove: null,
      assistantInsights: [],
    };
  }

  const actionableIssues = issues.filter((issue) => issue.category !== 'optimization');
  if (actionableIssues.length === 0) {
    return {
      assistantStatus: 'ready',
      assistantSummary: 'The schedule is ready. Only optional optimization opportunities remain.',
      assistantBestNextMove: null,
      assistantInsights: [],
    };
  }

  const prioritizedIssues = [...actionableIssues].sort((a, b) => {
    const aPriority = a.assistantPriority ?? 999;
    const bPriority = b.assistantPriority ?? 999;
    return aPriority - bPriority;
  });
  const bestIssue = prioritizedIssues[0];

  const insights: string[] = [];
  const blockingIssues = actionableIssues.filter((issue) => issue.category === 'blocking');
  if (blockingIssues.length > 0) {
    insights.push('Shared bottlenecks should be cleared before row-by-row adjustments.');
  }

  for (const insight of buildSharedConstraintInsights(actionableIssues)) {
    if (insights.includes(insight)) continue;
    insights.push(insight);
  }

  const unscheduledIssue = actionableIssues.find((issue) => issue.kind === 'unscheduled');
  if (unscheduledIssue) {
    insights.push('Rows without a scheduled span should be placed before trying to optimize crew usage.');
  }

  return {
    assistantStatus: 'needs-review',
    assistantSummary:
      blockingIssues.length > 0
        ? 'The schedule still has blocking issues. Start with the shared bottleneck below before editing rows one by one.'
        : unresolvedCount > 1
          ? 'The remaining unresolved work is concentrated in a few repeat patterns that can be solved without scanning the full grid.'
          : 'A small number of schedule adjustments are still needed before the plan is ready.',
    assistantBestNextMove: buildBestNextMove(bestIssue),
    assistantInsights: insights.slice(0, 3),
  };
}
