import { useEffect, useId, useRef, useState } from 'react';
import type { DailyCapacity } from '../../../../lib/planning/scheduling/capacity';

const FRAGMENTATION_TOOLTIP_DELAY_MS = 150;

export function FragmentationWarningIcon({ cap }: { cap: DailyCapacity }) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useId();
  const isHighFragmentation = cap.fragmentationRisk === 'high';

  useEffect(() => () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  const openWithDelay = () => {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(true);
      timeoutRef.current = null;
    }, FRAGMENTATION_TOOLTIP_DELAY_MS);
  };

  const openImmediately = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const closeTooltip = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(false);
  };

  // Skill-group penalty numbers
  const ff = cap.fragmentationFactor ?? 1;
  const groups = cap.skillGroupCount ?? 1;
  const hasSkillPenalty = ff < 0.999;
  const penaltyPct = hasSkillPenalty ? Math.round((1 - ff) * 100) : 0;
  // Base capacity before fragmentation penalty (after efficiency)
  const baseBeforePenalty = hasSkillPenalty
    ? Math.round(cap.effectiveAvailablePersonHours / ff)
    : cap.effectiveAvailablePersonHours;
  const hoursLost = hasSkillPenalty
    ? Math.round(baseBeforePenalty - cap.effectiveAvailablePersonHours)
    : 0;

  return (
    <span className="schedule-grid__day-warning">
      <button
        type="button"
        className={`schedule-grid__day-warning-icon${isHighFragmentation ? ' schedule-grid__day-warning-icon--high' : ' schedule-grid__day-warning-icon--moderate'}`}
        aria-label="Fragmentation warning"
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={openWithDelay}
        onMouseLeave={closeTooltip}
        onFocus={openImmediately}
        onBlur={closeTooltip}
      >
        <span className="schedule-grid__day-warning-icon-glyph" aria-hidden="true">▲</span>
      </button>
      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          className="schedule-grid__day-warning-tooltip"
        >
          {hasSkillPenalty ? (
            <>
              <strong className="schedule-grid__day-warning-tooltip-title">
                Task-switching penalty: −{penaltyPct}%
              </strong>
              <span>
                {groups} skill {groups === 1 ? 'group' : 'groups'} active today — each additional group reduces throughput by the task-switching factor.
              </span>
              <span>
                Usable capacity: <strong>{cap.effectiveAvailablePersonHours.toFixed(1)}h</strong> (down from {baseBeforePenalty.toFixed(1)}h — {hoursLost.toFixed(1)}h lost to switching overhead).
              </span>
              {cap.fragmentationRisk !== 'none' && (
                <span>
                  Also: many small allocations detected, adding coordination risk on top of the penalty.
                </span>
              )}
            </>
          ) : (
            <>
              <strong className="schedule-grid__day-warning-tooltip-title">
                Fragmentation risk: {cap.fragmentationRisk === 'high' ? 'High' : 'Moderate'}
              </strong>
              <span>
                {cap.assignedRowCount} tasks scheduled today, averaging {(cap.averageAllocationPersonHours ?? 0).toFixed(1)}h each.
                {cap.smallAllocationCount > 0 && ` ${cap.smallAllocationCount} ${cap.smallAllocationCount === 1 ? 'task is' : 'tasks are'} under 2h.`}
              </span>
              <span>
                Frequent context switching between many short tasks tends to reduce actual throughput below what the hours suggest.
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
