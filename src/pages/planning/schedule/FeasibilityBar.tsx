import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import { WarningIcon } from '../../../components/icons';

interface FeasibilityBarProps {
  capacity: CapacitySummary;
}

export function FeasibilityBar({ capacity }: FeasibilityBarProps) {
  const headroom = capacity.headroomPersonHours;
  const isOver = headroom < 0;

  return (
    <div className={`feasibility-bar${isOver ? ' feasibility-bar--over' : ''}`}>
      <span className="feasibility-bar__metric">
        {capacity.totalRequiredPersonHours.toFixed(1)}h required
      </span>
      <span className="feasibility-bar__separator">/</span>
      <span className="feasibility-bar__metric">
        {capacity.totalAvailablePersonHours.toFixed(1)}h available
      </span>
      <span className="feasibility-bar__separator">&middot;</span>
      <span className={`feasibility-bar__headroom${isOver ? ' feasibility-bar__headroom--over' : ''}`}>
        {headroom >= 0 ? '+' : ''}{headroom.toFixed(1)}h headroom
      </span>
      {capacity.overAllocatedDayCount > 0 && (
        <>
          <span className="feasibility-bar__separator">&middot;</span>
          <span className="feasibility-bar__warning">
            <WarningIcon className="feasibility-bar__warning-icon" />
            {capacity.overAllocatedDayCount} over-allocated {capacity.overAllocatedDayCount === 1 ? 'day' : 'days'}
          </span>
        </>
      )}
      {capacity.overAssignedCrewDayCount > 0 && (
        <>
          <span className="feasibility-bar__separator">&middot;</span>
          <span className="feasibility-bar__warning feasibility-bar__warning--crew">
            <WarningIcon className="feasibility-bar__warning-icon" />
            {capacity.overAssignedCrewDayCount} over-crewed {capacity.overAssignedCrewDayCount === 1 ? 'day' : 'days'}
          </span>
        </>
      )}
      {capacity.overWorkerCapacityDayCount > 0 && (
        <>
          <span className="feasibility-bar__separator">&middot;</span>
          <span className="feasibility-bar__warning feasibility-bar__warning--worker">
            <WarningIcon className="feasibility-bar__warning-icon" />
            {capacity.overWorkerCapacityDayCount} {capacity.overWorkerCapacityDayCount === 1 ? 'day exceeds' : 'days exceed'} worker capacity
          </span>
        </>
      )}
    </div>
  );
}
