import { useMemo } from 'react';
import { buildIssueSuggestions } from '../workspace/schedule-issue-suggestions';
import type {
  ScheduleAssistantStatus,
  ScheduleIssueCategory,
  ScheduleIssueItem,
  ScheduleIssuePanelPayload,
} from '../workspace/schedule-issue-panel-types';
import { getVisibleScheduleIssues } from '../workspace/schedule-issue-visibility';

interface ScheduleAssistantPanelProps {
  payload: ScheduleIssuePanelPayload | null;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_ORDER: ScheduleIssueCategory[] = ['blocking', 'adjustment', 'optimization'];

function categoryHeading(category: ScheduleIssueCategory): string {
  if (category === 'blocking') return 'Blocking activation';
  if (category === 'adjustment') return 'Needs schedule adjustment';
  return 'Optimization opportunities';
}

function statusLabel(status: ScheduleAssistantStatus | undefined, payload: ScheduleIssuePanelPayload): string {
  if (status === 'stale' || payload.state.isStale) return 'Stale';
  if (status === 'needs-review' || payload.state.unresolvedCount > 0) return 'Needs review';
  return 'Ready';
}

function statusCopy(status: ScheduleAssistantStatus | undefined, payload: ScheduleIssuePanelPayload): string {
  if (status === 'stale' || payload.state.isStale) {
    return 'The schedule changed after the last assistant run. Refresh findings before trusting unresolved issue guidance.';
  }
  if (status === 'needs-review' || payload.state.unresolvedCount > 0) {
    return 'Use the guidance below to understand what is blocking the schedule without scanning the full grid row by row.';
  }
  return 'No scheduling blockers detected. This panel will explain conflicts when the grid becomes too large to scan comfortably.';
}

function groupIssues(issues: ScheduleIssueItem[]): Array<{
  category: ScheduleIssueCategory;
  items: ScheduleIssueItem[];
}> {
  const groups: Array<{ category: ScheduleIssueCategory; items: ScheduleIssueItem[] }> = [];
  for (const category of CATEGORY_ORDER) {
    const items = issues.filter((issue) => issue.category === category);
    if (items.length === 0) continue;
    groups.push({ category, items });
  }
  return groups;
}

export function ScheduleAssistantPanel({ payload, isOpen, onClose }: ScheduleAssistantPanelProps) {
  const visibleIssues = useMemo(() => {
    if (!payload) return [];
    return getVisibleScheduleIssues(payload.state);
  }, [payload]);

  const issueGroups = useMemo(() => groupIssues(visibleIssues), [visibleIssues]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="schedule-assistant-panel__backdrop"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`schedule-assistant-panel${isOpen ? ' schedule-assistant-panel--open' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-label="Schedule Assistant"
        aria-hidden={!isOpen}
      >
        <div className="schedule-assistant-panel__header">
          <div className="schedule-assistant-panel__header-title-row">
            <h2 className="schedule-assistant-panel__title">Schedule Assistant</h2>
            <button
              type="button"
              className="schedule-assistant-panel__close"
              onClick={onClose}
              aria-label="Close Schedule Assistant"
            >
              ✕
            </button>
          </div>
          {payload && (
            <div className="schedule-assistant-panel__header-meta" aria-live="polite">
              <span className={`schedule-assistant-panel__status-chip schedule-assistant-panel__status-chip--${statusLabel(payload.state.assistantStatus, payload).toLowerCase().replace(/\s+/g, '-')}`}>
                {statusLabel(payload.state.assistantStatus, payload)}
              </span>
              <span className="schedule-assistant-panel__header-count">
                {visibleIssues.length} issues · {payload.state.unresolvedCount} unresolved
              </span>
            </div>
          )}
        </div>

        <div className="schedule-assistant-panel__body">
          {!payload ? (
            <div className="schedule-assistant-panel__empty">
              <p className="schedule-assistant-panel__empty-title">Loading…</p>
            </div>
          ) : (
            <>
              {/* Run / Re-run assistant */}
              {payload.state.canRunAssistant && (
                <div className="schedule-assistant-panel__run-section">
                  <button
                    type="button"
                    className={`btn btn--primary btn--sm schedule-assistant-panel__run-btn${payload.state.isStale ? ' schedule-assistant-panel__run-btn--stale' : ''}`}
                    onClick={() => void payload.actions.runAssistant()}
                  >
                    {payload.state.isStale ? 'Re-run assistant' : 'Run assistant'}
                  </button>
                  {payload.state.isStale && (
                    <p className="schedule-assistant-panel__stale-notice">
                      Schedule changed since last run — re-run to refresh findings.
                    </p>
                  )}
                </div>
              )}

              {/* Summary */}
              <section className="schedule-assistant-panel__section" aria-label="Assistant summary">
                <p className="schedule-assistant-panel__section-label">
                  {statusLabel(payload.state.assistantStatus, payload)}
                </p>
                <p className="schedule-assistant-panel__summary-body">
                  {payload.state.assistantSummary ?? statusCopy(payload.state.assistantStatus, payload)}
                </p>
              </section>

              {/* Best next move */}
              {payload.state.assistantBestNextMove && (
                <section className="schedule-assistant-panel__card" aria-label="Best next move">
                  <p className="schedule-assistant-panel__card-eyebrow">Best next move</p>
                  <p className="schedule-assistant-panel__card-title">{payload.state.assistantBestNextMove.title}</p>
                  <p className="schedule-assistant-panel__card-body">{payload.state.assistantBestNextMove.rationale}</p>
                  {payload.state.assistantBestNextMove.impact && (
                    <p className="schedule-assistant-panel__card-impact">{payload.state.assistantBestNextMove.impact}</p>
                  )}
                </section>
              )}

              {/* Insights */}
              {payload.state.assistantInsights && payload.state.assistantInsights.length > 0 && (
                <section className="schedule-assistant-panel__section" aria-label="What the assistant is seeing">
                  <p className="schedule-assistant-panel__section-label">What I&apos;m seeing</p>
                  <ul className="schedule-assistant-panel__insights-list">
                    {payload.state.assistantInsights.map((insight) => (
                      <li key={insight} className="schedule-assistant-panel__insight">{insight}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Issue navigation (when there are unresolved items) */}
              {payload.state.unresolvedCount > 0 && (
                <div className="schedule-assistant-panel__nav-bar">
                  <span className="schedule-assistant-panel__nav-label">
                    Navigate issues
                  </span>
                  <div className="schedule-assistant-panel__nav-actions">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={payload.actions.focusPrev}>
                      Prev
                    </button>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={payload.actions.focusNext}>
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Issue list */}
              {issueGroups.length === 0 ? (
                <div className="schedule-assistant-panel__empty">
                  <p className="schedule-assistant-panel__empty-title">No open issues</p>
                  <p className="schedule-assistant-panel__empty-body">Nothing blocking activation at the moment.</p>
                </div>
              ) : (
                <div className="schedule-assistant-panel__issues" role="list">
                  {issueGroups.map((group) => (
                    <section
                      key={group.category}
                      className="schedule-assistant-panel__issue-group"
                      aria-label={categoryHeading(group.category)}
                    >
                      <h3 className="schedule-assistant-panel__issue-group-title">
                        {categoryHeading(group.category)}
                      </h3>
                      {group.items.map((issue) => {
                        const suggestions = buildIssueSuggestions(issue, payload.state);
                        const isActive = payload.state.activeIssueKey === issue.issueKey;
                        return (
                          <article
                            key={issue.id}
                            className={`schedule-assistant-panel__issue-card${isActive ? ' schedule-assistant-panel__issue-card--active' : ''}`}
                            onClick={issue.issueKey ? () => payload.actions.selectIssue(issue.issueKey!) : undefined}
                            style={issue.issueKey ? { cursor: 'pointer' } : undefined}
                          >
                            <div className="schedule-assistant-panel__issue-section">
                              <p className="schedule-assistant-panel__issue-section-label">What&apos;s happening</p>
                              <p className="schedule-assistant-panel__issue-label">{issue.label}</p>
                              {issue.requiredPH != null && issue.assignedPH != null && (
                                <span className="schedule-assistant-panel__issue-metric">
                                  {issue.assignedPH.toFixed(1)}h / {issue.requiredPH.toFixed(1)}h
                                </span>
                              )}
                            </div>
                            {issue.detail && (
                              <div className="schedule-assistant-panel__issue-section">
                                <p className="schedule-assistant-panel__issue-section-label">Why it matters</p>
                                <p className="schedule-assistant-panel__issue-detail">{issue.detail}</p>
                              </div>
                            )}
                            {issue.facts && issue.facts.length > 0 && (
                              <div className="schedule-assistant-panel__issue-section">
                                <p className="schedule-assistant-panel__issue-section-label">What I&apos;m basing this on</p>
                                <ul className="schedule-assistant-panel__issue-facts">
                                  {issue.facts.slice(0, 2).map((fact) => (
                                    <li key={fact} className="schedule-assistant-panel__issue-fact">{fact}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {suggestions.length > 0 && (
                              <div className="schedule-assistant-panel__issue-section">
                                <p className="schedule-assistant-panel__issue-section-label">What I&apos;d try</p>
                                <ul className="schedule-assistant-panel__issue-suggestions">
                                  {suggestions.slice(0, 3).map((suggestion) => (
                                    <li key={suggestion.id} className="schedule-assistant-panel__issue-suggestion">
                                      {suggestion.label}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {issue.impact && (
                              <p className="schedule-assistant-panel__issue-impact">{issue.impact}</p>
                            )}
                          </article>
                        );
                      })}
                    </section>
                  ))}
                </div>
              )}

              {/* Actions footer */}
              {(payload.state.canClearAll) && (
                <div className="schedule-assistant-panel__footer">
                  {payload.state.canClearAll && (
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={payload.actions.clearAllSchedules}
                    >
                      Clear all schedules
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
