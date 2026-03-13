import { useMemo } from 'react';
import {
  buildIssueSuggestions,
} from './schedule-issue-suggestions';
import type {
  ScheduleIssueCategory,
  ScheduleIssueItem,
  ScheduleIssuePanelPayload,
} from './schedule-issue-panel-types';

interface SidebarIssuesPanelProps {
  payload: ScheduleIssuePanelPayload | null;
  isScheduleContext: boolean;
}

const CATEGORY_ORDER: ScheduleIssueCategory[] = ['blocking', 'adjustment', 'optimization'];

function categoryHeading(category: ScheduleIssueCategory): string {
  if (category === 'blocking') return 'Blocking activation';
  if (category === 'adjustment') return 'Needs schedule adjustment';
  return 'Optimization opportunities';
}

function statusLabel(payload: ScheduleIssuePanelPayload): string {
  if (payload.state.isStale) return 'Assistant stale';
  if (payload.state.unresolvedCount > 0) return 'Needs review';
  return 'Ready';
}

function statusCopy(payload: ScheduleIssuePanelPayload): string {
  if (payload.state.isStale) {
    return 'The schedule changed after the last assistant run. Refresh assistant findings before trusting unresolved issue guidance.';
  }
  if (payload.state.unresolvedCount > 0) {
    return 'Use the guidance below to understand what is blocking the schedule without scanning the full grid row by row.';
  }
  return 'No scheduling blockers are currently detected. This tab will explain conflicts here when the grid becomes too large to scan comfortably.';
}

function groupIssues(issues: ScheduleIssueItem[]): Array<{
  category: ScheduleIssueCategory;
  items: ScheduleIssueItem[];
}> {
  const groups: Array<{
    category: ScheduleIssueCategory;
    items: ScheduleIssueItem[];
  }> = [];

  for (const category of CATEGORY_ORDER) {
    const items = issues.filter((issue) => issue.category === category);
    if (items.length === 0) continue;
    groups.push({ category, items });
  }

  return groups;
}

export function SidebarIssuesPanel({ payload, isScheduleContext }: SidebarIssuesPanelProps) {
  const visibleIssues = useMemo(() => {
    if (!payload) return [];
    return payload.state.issues.filter((issue) => {
      if (issue.kind === 'assistant-stale') return false;
      if (payload.state.isStale && issue.kind === 'assistant-unresolved') return false;
      return true;
    });
  }, [payload]);

  const issueGroups = useMemo(() => groupIssues(visibleIssues), [visibleIssues]);

  if (!isScheduleContext) {
    return (
      <div className="planning-workspace__sidebar-issues planning-workspace__sidebar-issues--empty">
        <p className="planning-workspace__sidebar-issues-empty-title">Issues available in Schedule tab</p>
        <p className="planning-workspace__sidebar-issues-empty-body">
          Open a plan schedule to review unresolved items and apply fixes.
        </p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="planning-workspace__sidebar-issues planning-workspace__sidebar-issues--empty">
        <p className="planning-workspace__sidebar-issues-empty-title">Loading issue state</p>
      </div>
    );
  }

  const { state } = payload;
  const status = statusLabel(payload);

  return (
    <div className="planning-workspace__sidebar-issues">
      <header className="planning-workspace__sidebar-issues-header" aria-live="polite">
        <div className="planning-workspace__sidebar-issues-status">
          <h3 className="planning-workspace__sidebar-issues-title">Scheduling help</h3>
          <span className={`planning-workspace__sidebar-issues-chip planning-workspace__sidebar-issues-chip--${status.toLowerCase().replace(/\s+/g, '-')}`}>
            {status}
          </span>
        </div>
        <p className="planning-workspace__sidebar-issues-meta">
          {state.issues.length} total · {state.unresolvedCount} unresolved
        </p>
      </header>

      <section className="planning-workspace__sidebar-issues-summary" aria-label="Scheduling help summary">
        <p className="planning-workspace__sidebar-issues-summary-title">{status}</p>
        <p className="planning-workspace__sidebar-issues-summary-body">{statusCopy(payload)}</p>
      </section>

      {state.isStale && (
        <p className="planning-workspace__sidebar-issues-stale">
          Schedule changed after assistant run. Re-run assistant to refresh unresolved findings.
        </p>
      )}

      {issueGroups.length === 0 ? (
        <div className="planning-workspace__sidebar-issues-empty">
          <p className="planning-workspace__sidebar-issues-empty-title">No open issues</p>
          <p className="planning-workspace__sidebar-issues-empty-body">
            Nothing blocking activation at the moment.
          </p>
        </div>
      ) : (
        <div className="planning-workspace__sidebar-issues-list" role="list">
          {issueGroups.map((categoryGroup) => (
            <section
              key={categoryGroup.category}
              className="planning-workspace__sidebar-issues-group"
              aria-label={categoryHeading(categoryGroup.category)}
            >
              <h4 className="planning-workspace__sidebar-issues-group-title">
                {categoryHeading(categoryGroup.category)}
              </h4>
              {categoryGroup.items.map((issue) => {
                const suggestions = buildIssueSuggestions(issue, state);
                return (
                  <article
                    key={issue.id}
                    className="planning-workspace__sidebar-issue-card"
                  >
                    <div className="planning-workspace__sidebar-issue-head">
                      <p className="planning-workspace__sidebar-issue-label">{issue.label}</p>
                      {issue.detail && (
                        <p className="planning-workspace__sidebar-issue-detail">{issue.detail}</p>
                      )}
                      {issue.requiredPH != null && issue.assignedPH != null && (
                        <span className="planning-workspace__sidebar-issue-metric">
                          {issue.assignedPH.toFixed(1)}h / {issue.requiredPH.toFixed(1)}h
                        </span>
                      )}
                    </div>
                    {issue.facts && issue.facts.length > 0 && (
                      <ul className="planning-workspace__sidebar-issue-facts" aria-label="Issue facts">
                        {issue.facts.slice(0, 2).map((fact) => (
                          <li key={fact} className="planning-workspace__sidebar-issue-fact">{fact}</li>
                        ))}
                      </ul>
                    )}
                    {suggestions.length > 0 && (
                      <ul className="planning-workspace__sidebar-issue-suggestions" aria-label="Suggested ways to resolve this issue">
                        {suggestions.slice(0, 3).map((suggestion) => (
                          <li
                            key={suggestion.id}
                            className="planning-workspace__sidebar-issue-suggestion"
                          >
                            {suggestion.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
