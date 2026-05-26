import type { ScheduleIssuePanelState } from './schedule-issue-panel-types';

export function getVisibleScheduleIssues(state: Pick<ScheduleIssuePanelState, 'issues' | 'isStale'>) {
  return state.issues.filter((issue) => {
    if (issue.kind === 'assistant-stale') return false;
    if (state.isStale && issue.kind === 'assistant-unresolved') return false;
    return true;
  });
}
