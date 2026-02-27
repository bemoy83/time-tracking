import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';

interface CapacitySummaryPanelProps {
  capacity: CapacitySummary;
}

export function CapacitySummaryPanel({ capacity }: CapacitySummaryPanelProps) {
  return (
    <section className="schedule-view__block">
      <header className="schedule-view__block-header">
        <h3 className="schedule-view__block-title">Capacity Summary</h3>
      </header>
      <div className="schedule-capacity">
        <div className="schedule-capacity__row">
          <span>Required person-hours</span>
          <strong>{capacity.totalRequiredPersonHours.toFixed(1)}h</strong>
        </div>
        <div className="schedule-capacity__row">
          <span>Available person-hours</span>
          <strong>{capacity.totalAvailablePersonHours.toFixed(1)}h</strong>
        </div>
        <div className="schedule-capacity__row">
          <span>Headroom / deficit</span>
          <strong className={capacity.headroomPersonHours >= 0 ? 'schedule-capacity__ok' : 'schedule-capacity__warn'}>
            {capacity.headroomPersonHours >= 0 ? '+' : ''}{capacity.headroomPersonHours.toFixed(1)}h
          </strong>
        </div>
        <div className="schedule-capacity__row">
          <span>Over-allocated days</span>
          <strong>{capacity.overAllocatedDayCount}</strong>
        </div>
        <div className="schedule-capacity__row">
          <span>Unscheduled work packages</span>
          <strong>{capacity.unscheduledLineItemCount}</strong>
        </div>
      </div>
    </section>
  );
}
