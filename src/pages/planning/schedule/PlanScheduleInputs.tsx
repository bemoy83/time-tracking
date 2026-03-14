import { useMemo } from 'react';
import {
  type PhaseDateField,
  type PhaseDateValues,
  getScheduleDateValidationErrors,
} from './schedule-date-ui';

interface PlanScheduleInputsProps extends PhaseDateValues {
  eventStartDate: string | null;
  eventEndDate: string | null;
  defaultCrewSize: number | null;
  readOnly: boolean;
  onPhaseDateChange: (field: PhaseDateField, value: string) => void;
  onEventDateChange: (field: 'eventStartDate' | 'eventEndDate', value: string) => void;
  onDefaultCrewSizeChange: (value: string) => void;
}

export function PlanScheduleInputs({
  assemblyStartDate,
  assemblyEndDate,
  dismantleStartDate,
  dismantleEndDate,
  eventStartDate,
  eventEndDate,
  defaultCrewSize,
  readOnly,
  onPhaseDateChange,
  onEventDateChange,
  onDefaultCrewSizeChange,
}: PlanScheduleInputsProps) {
  const phaseDates: PhaseDateValues = {
    assemblyStartDate,
    assemblyEndDate,
    dismantleStartDate,
    dismantleEndDate,
  };

  const validationErrors = useMemo(
    () => getScheduleDateValidationErrors(phaseDates, eventStartDate, eventEndDate),
    [phaseDates, eventStartDate, eventEndDate],
  );

  return (
    <>
      <div className="planning-view__schedule-inputs planning-view__schedule-inputs--phase">
        <fieldset className="planning-view__schedule-group" disabled={readOnly}>
          <legend className="planning-view__schedule-group-title">Assembly</legend>
          <div className="planning-view__schedule-group-grid">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">From</span>
              <input
                className="input"
                type="date"
                value={assemblyStartDate ?? ''}
                onChange={(event) => onPhaseDateChange('assemblyStartDate', event.target.value)}
              />
            </label>
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">To</span>
              <input
                className="input"
                type="date"
                value={assemblyEndDate ?? ''}
                onChange={(event) => onPhaseDateChange('assemblyEndDate', event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="planning-view__schedule-group" disabled={readOnly}>
          <legend className="planning-view__schedule-group-title">Dismantle</legend>
          <div className="planning-view__schedule-group-grid">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">From</span>
              <input
                className="input"
                type="date"
                value={dismantleStartDate ?? ''}
                onChange={(event) => onPhaseDateChange('dismantleStartDate', event.target.value)}
              />
            </label>
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">To</span>
              <input
                className="input"
                type="date"
                value={dismantleEndDate ?? ''}
                onChange={(event) => onPhaseDateChange('dismantleEndDate', event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="planning-view__schedule-group" disabled={readOnly}>
          <legend className="planning-view__schedule-group-title">Default Crew</legend>
          <div className="planning-view__schedule-group-grid planning-view__schedule-group-grid--single">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">Crew size</span>
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={defaultCrewSize ?? ''}
                onChange={(event) => onDefaultCrewSizeChange(event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="planning-view__schedule-group" disabled={readOnly}>
          <legend className="planning-view__schedule-group-title">Event (optional)</legend>
          <div className="planning-view__schedule-group-grid">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">From</span>
              <input
                className="input"
                type="date"
                value={eventStartDate ?? ''}
                onChange={(event) => onEventDateChange('eventStartDate', event.target.value)}
              />
            </label>
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">To</span>
              <input
                className="input"
                type="date"
                value={eventEndDate ?? ''}
                onChange={(event) => onEventDateChange('eventEndDate', event.target.value)}
              />
            </label>
          </div>
        </fieldset>
      </div>

      {validationErrors.length > 0 && (
        <div className="planning-view__schedule-validation planning-view__schedule-validation--error" role="alert">
          {validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </>
  );
}
