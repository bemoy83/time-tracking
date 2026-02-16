/**
 * StatusProgressBar component.
 * Reusable progress bar with status-based coloring for budget/subtask tracking.
 */

import { ReactNode } from 'react';

type ProgressStatus = 'under' | 'approaching' | 'over';

interface StatusProgressBarProps {
  percent: number;
  status?: ProgressStatus;
  label?: ReactNode;
  height?: number;
  className?: string;
}

export function StatusProgressBar({
  percent,
  status,
  label,
  height = 4,
  className = '',
}: StatusProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={`status-progress ${className}`}>
      <div className="status-progress__bar" style={{ height: `${height}px` }}>
        <div
          className={`status-progress__fill ${status ? `status-progress__fill--${status}` : ''}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label !== undefined && (
        <span className={`status-progress__label ${status ? `status-progress__label--${status}` : ''}`}>
          {label}
        </span>
      )}
    </div>
  );
}
