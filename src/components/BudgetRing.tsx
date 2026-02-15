/**
 * BudgetRing component.
 * SVG circular progress ring showing budget usage percentage.
 * Color-coded: green (under), amber (approaching), red (over).
 */

import { BudgetStatus } from '../lib/types';

interface BudgetRingProps {
  budgetStatus: BudgetStatus;
  size?: 'small' | 'medium';
}

export function BudgetRing({ budgetStatus, size = 'medium' }: BudgetRingProps) {
  if (budgetStatus.status === 'none') return null;

  const { percentUsed, status } = budgetStatus;
  const clampedPercent = Math.min(percentUsed, 100);

  return (
    <div
      className={`budget-ring budget-ring--${size} budget-ring--${status}`}
      aria-label={`${Math.round(percentUsed)}% of estimate used`}
    >
      <svg viewBox="0 0 36 36" className="budget-ring__svg">
        <circle
          className="budget-ring__bg"
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          strokeWidth="3"
        />
        <circle
          className="budget-ring__progress"
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${clampedPercent} ${100 - clampedPercent}`}
          strokeDashoffset="25"
        />
        <text
          x="18"
          y="20.5"
          className="budget-ring__text"
          textAnchor="middle"
        >
          {Math.round(percentUsed)}%
        </text>
      </svg>
    </div>
  );
}
