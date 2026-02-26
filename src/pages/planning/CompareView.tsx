import { formatDurationShort } from '../../lib/types';
import type { PlanComparison } from '../../lib/planning/plan-compare';
import { ChevronLeftIcon } from '../../components/icons';

interface CompareViewProps {
  comparison: PlanComparison;
  onBack: () => void;
}

export function CompareView({ comparison, onBack }: CompareViewProps) {
  return (
    <div className="planning-view">
      <header className="planning-view__editor-header">
        <button className="planning-view__back" onClick={onBack} aria-label="Back to plan">
          <ChevronLeftIcon className="planning-view__back-icon" />
          Back
        </button>
        <h2 className="planning-view__title" style={{ flex: 1 }}>
          Compare
        </h2>
      </header>

      <div className="planning-view__compare-summary">
        <div className="planning-view__compare-row">
          <span className="planning-view__compare-plan-name">{comparison.planATitle}</span>
          <span className="planning-view__compare-plan-stat">
            {comparison.totalDelta.lineItemsA} items · {formatDurationShort(comparison.totalDelta.personHoursA * 3_600_000)}
          </span>
        </div>
        <div className="planning-view__compare-row">
          <span className="planning-view__compare-plan-name">{comparison.planBTitle}</span>
          <span className="planning-view__compare-plan-stat">
            {comparison.totalDelta.lineItemsB} items · {formatDurationShort(comparison.totalDelta.personHoursB * 3_600_000)}
          </span>
        </div>
        <div className="planning-view__compare-delta">
          <span>Delta</span>
          <span className={comparison.totalDelta.personHoursDelta > 0 ? 'planning-view__delta--increase' : 'planning-view__delta--decrease'}>
            {comparison.totalDelta.personHoursDelta > 0 ? '+' : ''}
            {formatDurationShort(Math.abs(comparison.totalDelta.personHoursDelta) * 3_600_000)} person-hrs
          </span>
        </div>
      </div>

      <div className="planning-view__compare-items">
        {comparison.lineItems.map((item) => (
          <div key={item.lineItemId} className={`planning-view__compare-item planning-view__compare-item--${item.status}`}>
            <div className="planning-view__compare-item-header">
              <span className="planning-view__compare-title">{item.title}</span>
              <span className={`planning-view__compare-status planning-view__compare-status--${item.status}`}>
                {item.status}
              </span>
            </div>
            {item.changes.length > 0 && (
              <div className="planning-view__compare-changes">
                {item.changes.map((change) => (
                  <span key={change.field} className="planning-view__compare-change">
                    {change.field}: {change.valueA}{' '}
                    <span className="planning-view__compare-change-arrow">&rarr;</span>{' '}
                    {change.valueB}
                    {change.percentChange != null && (
                      <span className={change.percentChange > 0 ? 'planning-view__delta--increase' : 'planning-view__delta--decrease'}>
                        {' '}({change.percentChange > 0 ? '+' : ''}{(change.percentChange * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
