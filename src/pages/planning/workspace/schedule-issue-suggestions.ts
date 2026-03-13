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
  const missingHours =
    issue.requiredPH != null && issue.assignedPH != null
      ? Math.max(0, issue.requiredPH - issue.assignedPH)
      : null;

  if (issue.kind === 'assistant-stale') {
    if (state.canRunAssistant) {
      pushUnique(suggestions, {
        id: `${issue.id}-run-assistant`,
        label: 'Re-run the assistant before trusting unresolved guidance from the last pass.',
      }, 3);
    }
    return suggestions;
  }

  if (issue.kind === 'capacity') {
    pushUnique(suggestions, {
      id: `${issue.id}-open-calendar`,
      label: 'Adjust day crew or access hours in Work Calendar on the flagged days below.',
    }, 3);
    pushUnique(suggestions, {
      id: `${issue.id}-spread-work`,
      label: 'If crew cannot increase, spread the affected work across more scheduled days.',
    }, 3);
    return suggestions;
  }

  if (issue.kind === 'unscheduled') {
    if (state.canRunAssistant) {
      pushUnique(suggestions, {
        id: `${issue.id}-run-assistant`,
        label: 'Run the assistant after confirming the phase has usable work days and enough crew.',
      }, 3);
    }
    pushUnique(suggestions, {
      id: `${issue.id}-manual-span`,
      label: 'If the assistant still cannot place the work, review the row manually and assign a valid span.',
    }, 3);
    return suggestions;
  }

  if (issue.kind === 'overstaffed') {
    pushUnique(suggestions, {
      id: `${issue.id}-reduce-crew`,
      label: 'Reduce crew on the lightest days if you want to recover spare capacity.',
    }, 3);
    pushUnique(suggestions, {
      id: `${issue.id}-keep-buffer`,
      label: 'Leave the extra crew in place if the plan needs a buffer for uncertainty.',
    }, 3);
    return suggestions;
  }

  if (issue.kind === 'assistant-unresolved') {
    if (issue.issueKey != null) {
      if (issue.unresolvedReason === 'missing_required_hours') {
        pushUnique(suggestions, {
          id: `${issue.id}-increase-crew`,
          label:
            missingHours != null
              ? `Add crew on the scheduled days to recover the missing ${missingHours.toFixed(1)}h.`
              : 'Add crew on the scheduled days for this phase.',
        }, 3);
        pushUnique(suggestions, {
          id: `${issue.id}-extend-span`,
          label: 'Extend the phase across more work days so the remaining hours have somewhere to land.',
        }, 3);
      } else if (issue.unresolvedReason === 'no_work_days') {
        pushUnique(suggestions, {
          id: `${issue.id}-open-calendar`,
          label: 'Enable at least one work day inside this phase window.',
        }, 3);
        pushUnique(suggestions, {
          id: `${issue.id}-adjust-dates`,
          label: 'Shift the phase dates onto days that already allow work if the current window must stay closed.',
        }, 3);
      } else if (issue.unresolvedReason === 'no_capacity_window') {
        pushUnique(suggestions, {
          id: `${issue.id}-shift-span`,
          label: 'Widen or shift the phase window to reach days with open capacity.',
        }, 3);
        pushUnique(suggestions, {
          id: `${issue.id}-open-calendar`,
          label: 'Free crew on the constrained days or increase day crew where the work must happen.',
        }, 3);
      }

      pushUnique(suggestions, {
        id: `${issue.id}-focus-row`,
        label: 'Review the matching schedule row to confirm the phase dates and crew assumptions are still correct.',
      }, 3);
    }

    if (state.canRunAssistant) {
      pushUnique(suggestions, {
        id: `${issue.id}-run-assistant`,
        label: 'Re-run the assistant after changes to verify that the issue clears.',
      }, 3);
    }

    return suggestions;
  }

  return suggestions;
}
