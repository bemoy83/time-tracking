import type { IssueQueueResult } from '../lib/remediation/issue-queue';

interface RemediationQueueSummaryProps {
  queues: IssueQueueResult;
  needsCounters: {
    totalScopes: number;
    totalEntries: number;
    withSuggestion: number;
    manualRequired: number;
  };
  noWorkContextCounters: {
    totalScopes: number;
    totalEntries: number;
    manualRequired: number;
  };
}

export function RemediationQueueSummary({
  queues,
  needsCounters,
  noWorkContextCounters,
}: RemediationQueueSummaryProps) {
  return (
    <div className="remediation__queue-summary">
      <div className="remediation__queue-row">
        <span className="remediation__queue-label">Needs measurable owner</span>
        <span className="remediation__queue-detail">
          {needsCounters.totalScopes} scopes · {needsCounters.totalEntries} entries
        </span>
        <span className="remediation__queue-detail">
          {needsCounters.withSuggestion} with suggestion · {needsCounters.manualRequired} manual
        </span>
      </div>
      <div className="remediation__queue-row">
        <span className="remediation__queue-label">Ambiguous owner</span>
        <span className="remediation__queue-detail">
          {queues.ambiguousOwner.length} scopes with suggestions
        </span>
      </div>
      <div className="remediation__queue-row">
        <span className="remediation__queue-label">No work context</span>
        <span className="remediation__queue-detail">
          {noWorkContextCounters.totalScopes} scopes · {noWorkContextCounters.totalEntries} entries
        </span>
        <span className="remediation__queue-detail">
          {noWorkContextCounters.manualRequired} manual
        </span>
      </div>
    </div>
  );
}
