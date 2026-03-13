import { useMemo } from 'react';
import {
  buildIssueSuggestions,
} from './schedule-issue-suggestions';
import type {
  ScheduleIssueItem,
  ScheduleIssuePanelPayload,
} from './schedule-issue-panel-types';

interface SidebarIssuesPanelProps {
  payload: ScheduleIssuePanelPayload | null;
  isScheduleContext: boolean;
}

const SEVERITY_ORDER = ['critical', 'warning', 'info'] as const;

type Severity = (typeof SEVERITY_ORDER)[number];

function severityHeading(severity: Severity): string {
  if (severity === 'critical') return 'Critical blockers';
  if (severity === 'warning') return 'Warnings';
  return 'Info';
}

function kindHeading(kind: ScheduleIssueItem['kind']): string {
  if (kind === 'capacity') return 'Capacity';
  if (kind === 'assistant-unresolved') return 'Assistant unresolved';
  if (kind === 'assistant-stale') return 'Assistant status';
  return 'Unscheduled';
}

function statusLabel(payload: ScheduleIssuePanelPayload): string {
  if (payload.state.isStale) return 'Stale';
  if (payload.state.unresolvedCount > 0) return 'Needs review';
  if (payload.state.issues.length > 0) return 'Open issues';
  return 'Ready';
}

function groupIssues(issues: ScheduleIssueItem[]): Array<{
  severity: Severity;
  kinds: Array<{ kind: ScheduleIssueItem['kind']; items: ScheduleIssueItem[] }>;
}> {
  const groups: Array<{
    severity: Severity;
    kinds: Array<{ kind: ScheduleIssueItem['kind']; items: ScheduleIssueItem[] }>;
  }> = [];

  for (const severity of SEVERITY_ORDER) {
    const severityIssues = issues.filter((issue) => issue.severity === severity);
    if (severityIssues.length === 0) continue;

    const byKind = new Map<ScheduleIssueItem['kind'], ScheduleIssueItem[]>();
    for (const issue of severityIssues) {
      const list = byKind.get(issue.kind);
      if (list) list.push(issue);
      else byKind.set(issue.kind, [issue]);
    }

    const kinds = [...byKind.entries()]
      .map(([kind, items]) => ({ kind, items }))
      .sort((a, b) => kindHeading(a.kind).localeCompare(kindHeading(b.kind)));

    groups.push({ severity, kinds });
  }

  return groups;
}

export function SidebarIssuesPanel({ payload, isScheduleContext }: SidebarIssuesPanelProps) {
  const visibleIssues = useMemo(() => {
    if (!payload) return [];
    if (!payload.state.isStale) return payload.state.issues;
    return payload.state.issues.filter((issue) => issue.kind !== 'assistant-unresolved');
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
          <h3 className="planning-workspace__sidebar-issues-title">Issue help</h3>
          <span className={`planning-workspace__sidebar-issues-chip planning-workspace__sidebar-issues-chip--${status.toLowerCase().replace(/\s+/g, '-')}`}>
            {status}
          </span>
        </div>
        <p className="planning-workspace__sidebar-issues-meta">
          {state.issues.length} total · {state.unresolvedCount} unresolved
        </p>
      </header>

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
          {issueGroups.map((severityGroup) => (
            <section
              key={severityGroup.severity}
              className="planning-workspace__sidebar-issues-group"
              aria-label={severityHeading(severityGroup.severity)}
            >
              <h4 className="planning-workspace__sidebar-issues-group-title">
                {severityHeading(severityGroup.severity)}
              </h4>
              {severityGroup.kinds.map((kindGroup) => (
                <div key={kindGroup.kind} className="planning-workspace__sidebar-issues-kind">
                  <p className="planning-workspace__sidebar-issues-kind-title">{kindHeading(kindGroup.kind)}</p>
                  {kindGroup.items.map((issue) => {
                    const suggestions = buildIssueSuggestions(issue, state);
                    return (
                      <article
                        key={issue.id}
                        className="planning-workspace__sidebar-issue-card"
                      >
                        <div className="planning-workspace__sidebar-issue-head">
                          <p className="planning-workspace__sidebar-issue-label">{issue.label}</p>
                          {issue.requiredPH != null && issue.assignedPH != null && (
                            <span className="planning-workspace__sidebar-issue-metric">
                              {issue.assignedPH.toFixed(1)}h / {issue.requiredPH.toFixed(1)}h
                            </span>
                          )}
                        </div>
                        {suggestions.length > 0 && (
                          <ul className="planning-workspace__sidebar-issue-suggestions" aria-label="Suggested ways to resolve this issue">
                            {suggestions.map((suggestion) => (
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
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
