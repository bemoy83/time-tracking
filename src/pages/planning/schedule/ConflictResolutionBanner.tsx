import { useMemo, useState } from 'react';
import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import {
  generateConflictSuggestions,
  formatCrewSuggestionSummary,
  formatOvertimeSuggestionSummary,
} from '../../../lib/planning/scheduling/conflict-resolution';
import { WarningIcon } from '../../../components/icons';

interface ConflictResolutionBannerProps {
  capacity: CapacitySummary;
}

export function ConflictResolutionBanner({ capacity }: ConflictResolutionBannerProps) {
  const suggestions = useMemo(() => generateConflictSuggestions(capacity), [capacity]);
  const [expanded, setExpanded] = useState(false);

  if (!suggestions.hasConflicts) return null;

  const crewSummary = formatCrewSuggestionSummary(suggestions.crewSuggestions);
  const overtimeSummary = formatOvertimeSuggestionSummary(suggestions.overtimeSuggestions);
  const conflictDayCount = Math.max(
    suggestions.crewSuggestions.length,
    suggestions.overtimeSuggestions.length,
    suggestions.workerCapacitySuggestions.length,
  );

  return (
    <div className="conflict-banner">
      <div className="conflict-banner__header">
        <WarningIcon className="conflict-banner__icon" />
        <span className="conflict-banner__title">
          Schedule has capacity conflicts on {conflictDayCount} {conflictDayCount === 1 ? 'day' : 'days'}
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Hide suggestions' : 'Show suggestions'}
        </button>
      </div>
      {expanded && (
        <div className="conflict-banner__suggestions">
          {crewSummary && (
            <div className="conflict-banner__option">
              <span className="conflict-banner__option-label">Solve for crew:</span>
              <span className="conflict-banner__option-detail">{crewSummary}</span>
            </div>
          )}
          {overtimeSummary && (
            <div className="conflict-banner__option">
              <span className="conflict-banner__option-label">Solve for overtime:</span>
              <span className="conflict-banner__option-detail">{overtimeSummary}</span>
            </div>
          )}
          {suggestions.workerCapacitySuggestions.length > 0 && (
            <div className="conflict-banner__option">
              <span className="conflict-banner__option-label">Worker capacity exceeded:</span>
              <span className="conflict-banner__option-detail">
                {suggestions.workerCapacitySuggestions.map((s) => s.message).join('; ')}
              </span>
            </div>
          )}
          <p className="conflict-banner__note">
            Apply changes via Work Calendar to adjust crew size or access times for specific days.
          </p>
        </div>
      )}
    </div>
  );
}
