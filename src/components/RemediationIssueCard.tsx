import type { IssueQueueItem } from '../lib/remediation/issue-queue';

interface RemediationIssueCardProps {
  item: IssueQueueItem;
  workTypeTitleById: Map<string, string>;
  onAssign: (item: IssueQueueItem) => void;
  onCreateAssign: (item: IssueQueueItem) => void;
  onMoveEntry: (item: IssueQueueItem) => void;
}

export function RemediationIssueCard({
  item,
  workTypeTitleById,
  onAssign,
  onCreateAssign,
  onMoveEntry,
}: RemediationIssueCardProps) {
  return (
    <div className="remediation__issue">
      <span className="remediation__issue-title">{item.taskTitle}</span>
      <div className="remediation__issue-meta">
        <span className="remediation__issue-stat">
          {item.personHours.toFixed(2)} hrs · {item.entryCount} {item.entryCount === 1 ? 'entry' : 'entries'}
        </span>
        <span className="remediation__issue-desc">{item.description}</span>
        {item.category !== 'no_work_context' && item.suggestedTargetTitle && (
          <span className="remediation__issue-suggestion">
            Suggested: {item.suggestedTargetTitle} ({item.suggestionSource})
          </span>
        )}
        {item.category !== 'no_work_context' && item.recommendedWorkTypeId && (
          <span className="remediation__issue-suggestion">
            Recommended: {workTypeTitleById.get(item.recommendedWorkTypeId) ?? item.recommendedWorkTypeId}
          </span>
        )}
        {item.category !== 'no_work_context' && item.conflictingRecommendedWorkTypeIds.length > 1 && (
          <span className="remediation__issue-conflict">
            Conflicting recommendations — manual selection required
          </span>
        )}
      </div>
      {item.entryCount > 0 && (
        <div className="remediation__issue-actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => onAssign(item)}
          >
            Assign WorkType
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => onCreateAssign(item)}
          >
            Create + Assign
          </button>
          {item.entryCount === 1 && item.entryId && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => onMoveEntry(item)}
            >
              Move Entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
