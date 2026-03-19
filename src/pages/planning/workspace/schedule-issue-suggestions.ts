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
      label: 'System fix: add crew or extend access hours on the constrained day before adjusting individual rows.',
    }, 3);
    pushUnique(suggestions, {
      id: `${issue.id}-spread-work`,
      label: 'Fallback: if crew cannot increase, spread the affected work across more scheduled days to reduce peak load.',
    }, 3);
    return suggestions;
  }

  if (issue.kind === 'unscheduled') {
    if (state.canRunAssistant) {
      pushUnique(suggestions, {
        id: `${issue.id}-run-assistant`,
        label: 'Plan fix: confirm usable work days and valid phase spans first, then re-run the assistant to place the unscheduled rows.',
      }, 3);
    }
    pushUnique(suggestions, {
      id: `${issue.id}-manual-span`,
      label: 'Local fix: if a row still cannot place, review its phase dates manually and give it a valid span before optimizing crew.',
    }, 3);
    return suggestions;
  }

  if (issue.kind === 'overstaffed') {
    pushUnique(suggestions, {
      id: `${issue.id}-reduce-crew`,
      label: 'Optimization: reduce crew on the lightest days if you want to recover spare capacity for later schedule changes.',
    }, 3);
    pushUnique(suggestions, {
      id: `${issue.id}-keep-buffer`,
      label: 'Alternative: leave the extra crew in place if the plan needs a buffer for uncertainty or late changes.',
    }, 3);
    return suggestions;
  }

  if (issue.kind === 'fragmentation') {
    pushUnique(suggestions, {
      id: `${issue.id}-consolidate`,
      label: 'Optimization: consolidate the smallest allocations onto fewer days where phase dates allow.',
    }, 3);
    pushUnique(suggestions, {
      id: `${issue.id}-keep-buffer`,
      label: 'Alternative: keep extra buffer on the most fragmented day instead of filling it to nominal capacity.',
    }, 3);
    pushUnique(suggestions, {
      id: `${issue.id}-move-light-work`,
      label: 'Local fix: move low-effort rows to adjacent lower-risk days if the current day is too fragmented to stay efficient.',
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
              ? `Local fix: add crew on the already scheduled days to recover the missing ${missingHours.toFixed(1)}h.`
              : 'Local fix: add crew on the already scheduled days for this phase.',
        }, 3);
        pushUnique(suggestions, {
          id: `${issue.id}-extend-span`,
          label: 'Alternative: extend the phase across more work days so the remaining hours have somewhere to land.',
        }, 3);
      } else if (issue.unresolvedReason === 'no_work_days') {
        pushUnique(suggestions, {
          id: `${issue.id}-open-calendar`,
          label: 'System fix: enable at least one work day inside this phase window so the assistant has somewhere to place the work.',
        }, 3);
        pushUnique(suggestions, {
          id: `${issue.id}-adjust-dates`,
          label: 'Local fix: shift the phase dates onto days that already allow work if the current window must stay closed.',
        }, 3);
      } else if (issue.unresolvedReason === 'no_capacity_window') {
        pushUnique(suggestions, {
          id: `${issue.id}-shift-span`,
          label: 'Local fix: widen or shift the phase window to reach days with open capacity.',
        }, 3);
        pushUnique(suggestions, {
          id: `${issue.id}-open-calendar`,
          label: 'System fix: free crew on the constrained days or increase day crew where the work must happen.',
        }, 3);
      }

      pushUnique(suggestions, {
        id: `${issue.id}-focus-row`,
        label: 'Check the matching row to confirm its phase dates and crew assumptions are still the right planning choice.',
      }, 3);
    }

    if (state.canRunAssistant) {
      pushUnique(suggestions, {
        id: `${issue.id}-run-assistant`,
        label: 'After changes, re-run the assistant to confirm that this issue actually clears.',
      }, 3);
    }

    return suggestions;
  }

  return suggestions;
}
