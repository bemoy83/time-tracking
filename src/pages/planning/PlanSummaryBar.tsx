import type { Project } from '../../lib/types';
import { ProjectColorDot } from '../../components/ProjectColorDot';
import { ChevronUpIcon } from '../../components/icons';

const formatSummaryDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });

interface PlanSummaryBarProps {
  planDisplayName: string;
  selectedProject: Project | null;
  summaryRange: { start: string; end: string } | null;
  canOpenScheduleAction: boolean;
  scheduleActionBlockedReason: string | null;
  onOpenSchedule: () => void | Promise<void>;
  onExpand: () => void;
}

export function PlanSummaryBar({
  planDisplayName,
  selectedProject,
  summaryRange,
  canOpenScheduleAction,
  scheduleActionBlockedReason,
  onOpenSchedule,
  onExpand,
}: PlanSummaryBarProps) {
  return (
    <div className="planning-view__summary-bar">
      <span className="planning-view__summary-bar-name">
        {selectedProject && (
          <ProjectColorDot color={selectedProject.color} size="sm" className="planning-view__project-dot" />
        )}
        <span>{planDisplayName || 'Untitled plan'}</span>
      </span>
      {summaryRange && (
        <span className="planning-view__summary-bar-dates">
          {formatSummaryDate(summaryRange.start)} – {formatSummaryDate(summaryRange.end)}
        </span>
      )}
      <div className="planning-view__summary-bar-actions">
        {canOpenScheduleAction && (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onOpenSchedule}
            disabled={scheduleActionBlockedReason != null}
            title={scheduleActionBlockedReason ?? 'Build schedule'}
          >
            Build Schedule
          </button>
        )}
        <button
          type="button"
          className="planning-view__summary-collapse-btn"
          onClick={onExpand}
          aria-label="Expand plan setup"
          title="Expand plan setup"
        >
          <ChevronUpIcon className="planning-view__summary-collapse-icon planning-view__summary-collapse-icon--collapsed" />
        </button>
      </div>
    </div>
  );
}
