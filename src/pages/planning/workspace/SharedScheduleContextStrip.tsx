interface SharedScheduleContextStripProps {
  selectedPlanCount: number;
}

export function SharedScheduleContextStrip({ selectedPlanCount }: SharedScheduleContextStripProps) {
  return (
    <div className="planning-workspace__plan-context-bar">
      <span className="planning-workspace__plan-context-title">Shared Schedule</span>
      {selectedPlanCount > 0 && (
        <span className="planning-workspace__plan-context-phases">
          <span className="planning-workspace__plan-context-phase">
            {selectedPlanCount} {selectedPlanCount === 1 ? 'plan' : 'plans'}
          </span>
        </span>
      )}
    </div>
  );
}
