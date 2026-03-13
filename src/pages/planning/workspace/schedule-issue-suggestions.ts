import type { ScheduleIssueItem, ScheduleIssuePanelState } from './schedule-issue-panel-types';

export interface ScheduleIssueSuggestion {
  id: string;
  label: string;
}

function pushUnique(
  list: ScheduleIssueSuggestion[],
  next: ScheduleIssueSuggestion,
  limit: number,
): void {
  if (list.length >= limit) return;
  if (list.some((item) => item.id === next.id)) return;
  list.push(next);
}

export function buildIssueSuggestions(
  issue: ScheduleIssueItem,
  state: ScheduleIssuePanelState,
): ScheduleIssueSuggestion[] {
  const suggestions: ScheduleIssueSuggestion[] = [];

  if (issue.kind === 'assistant-stale') {
    if (state.canRunAssistant) {
      pushUnique(suggestions, {
        id: `${issue.id}-run-assistant`,
        label: 'Re-run assistant to refresh findings',
      }, 3);
    }
    return suggestions;
  }

  if (issue.kind === 'capacity') {
    pushUnique(suggestions, {
      id: `${issue.id}-open-calendar`,
      label: 'Consider adjusting crew size or access hours in Work Calendar.',
    }, 3);
    return suggestions;
  }

  if (issue.kind === 'unscheduled') {
    if (state.canRunAssistant) {
      pushUnique(suggestions, {
        id: `${issue.id}-run-assistant`,
        label: 'Consider running the assistant after widening the available work window.',
      }, 3);
    }
    return suggestions;
  }

  if (issue.kind === 'assistant-unresolved') {
    if (issue.issueKey != null) {
      if (issue.unresolvedReason === 'missing_required_hours') {
        pushUnique(suggestions, {
          id: `${issue.id}-increase-crew`,
          label: 'Consider increasing crew on the scheduled days for this phase.',
        }, 3);
        pushUnique(suggestions, {
          id: `${issue.id}-extend-span`,
          label: 'Consider extending the phase across more work days to cover the missing hours.',
        }, 3);
      } else if (issue.unresolvedReason === 'no_work_days') {
        pushUnique(suggestions, {
          id: `${issue.id}-open-calendar`,
          label: 'Consider enabling work days in the calendar for this phase window.',
        }, 3);
        pushUnique(suggestions, {
          id: `${issue.id}-adjust-dates`,
          label: 'Consider shifting the phase dates onto days that already allow work.',
        }, 3);
      } else if (issue.unresolvedReason === 'no_capacity_window') {
        pushUnique(suggestions, {
          id: `${issue.id}-shift-span`,
          label: 'Consider shifting or expanding the phase dates to find open capacity.',
        }, 3);
        pushUnique(suggestions, {
          id: `${issue.id}-open-calendar`,
          label: 'Consider freeing crew on constrained days or adding more available crew.',
        }, 3);
      }

      pushUnique(suggestions, {
        id: `${issue.id}-focus-row`,
        label: 'Review the matching schedule row to confirm dates and crew assumptions.',
      }, 3);
    }

    if (state.canRunAssistant) {
      pushUnique(suggestions, {
        id: `${issue.id}-run-assistant`,
        label: 'Re-run the assistant after making changes to verify the issue clears.',
      }, 3);
    }

    return suggestions;
  }

  return suggestions;
}
