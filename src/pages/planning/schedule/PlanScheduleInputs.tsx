interface PlanScheduleInputsProps {
  eventStartDate: string | null;
  eventEndDate: string | null;
  defaultCrewSize: number | null;
  readOnly: boolean;
  onEventDateChange: (field: 'eventStartDate' | 'eventEndDate', value: string) => void;
  onDefaultCrewSizeChange: (value: string) => void;
}

export function PlanScheduleInputs({
  eventStartDate,
  eventEndDate,
  defaultCrewSize,
  readOnly,
  onEventDateChange,
  onDefaultCrewSizeChange,
}: PlanScheduleInputsProps) {
  return (
    <div className="planning-view__schedule-inputs">
      <label className="planning-view__schedule-input">
        <span>Event start</span>
        <input
          className="input"
          type="date"
          value={eventStartDate ?? ''}
          disabled={readOnly}
          onChange={(event) => onEventDateChange('eventStartDate', event.target.value)}
        />
      </label>
      <label className="planning-view__schedule-input">
        <span>Event end</span>
        <input
          className="input"
          type="date"
          value={eventEndDate ?? ''}
          disabled={readOnly}
          onChange={(event) => onEventDateChange('eventEndDate', event.target.value)}
        />
      </label>
      <label className="planning-view__schedule-input">
        <span>Default crew</span>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          value={defaultCrewSize ?? ''}
          disabled={readOnly}
          onChange={(event) => onDefaultCrewSizeChange(event.target.value)}
        />
      </label>
    </div>
  );
}
