import { useEffect, useId, useRef, useState } from 'react';
import type { DailyCapacity } from '../../../../lib/planning/scheduling/capacity';

const FRAGMENTATION_TOOLTIP_DELAY_MS = 150;

function formatFragmentationRiskLabel(risk: DailyCapacity['fragmentationRisk']): string {
  if (risk === 'high') return 'High';
  if (risk === 'moderate') return 'Moderate';
  return 'None';
}

export function FragmentationWarningIcon({ cap }: { cap: DailyCapacity }) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useId();
  const isHighFragmentation = cap.fragmentationRisk === 'high';
  const rationale = cap.fragmentationRisk === 'high'
    ? 'This day is heavily fragmented and may underperform despite available capacity.'
    : 'This day may lose throughput to switching and coordination.';

  useEffect(() => () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  const openWithDelay = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }
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

  return (
    <span className="schedule-grid__day-warning">
      <button
        type="button"
        className={`schedule-grid__day-warning-icon${isHighFragmentation ? ' schedule-grid__day-warning-icon--high' : ' schedule-grid__day-warning-icon--moderate'}`}
        aria-label={`Fragmentation risk ${formatFragmentationRiskLabel(cap.fragmentationRisk)}`}
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
          <strong className="schedule-grid__day-warning-tooltip-title">
            Fragmentation risk: {formatFragmentationRiskLabel(cap.fragmentationRisk)}
          </strong>
          <span>Assigned rows: {cap.assignedRowCount}</span>
          <span>Small allocations (&lt;2h): {cap.smallAllocationCount}</span>
          <span>Average allocation: {(cap.averageAllocationPersonHours ?? 0).toFixed(1)}h</span>
          <span>Largest task share: {Math.round((cap.largestAllocationShare ?? 0) * 100)}%</span>
          <span>{rationale}</span>
        </span>
      )}
    </span>
  );
}
