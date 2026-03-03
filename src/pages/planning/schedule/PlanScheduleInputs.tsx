import { useMemo } from 'react';
import {
  type PhaseDateField,
  type PhaseDateValues,
  getScheduleDateValidationErrors,
  hasAnyPhaseDates,
  hasCompletePhaseDates,
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
  buildUpStartDate,
  buildUpEndDate,
  tearDownStartDate,
  tearDownEndDate,
  eventStartDate,
  eventEndDate,
  defaultCrewSize,
  readOnly,
  onPhaseDateChange,
  onEventDateChange,
  onDefaultCrewSizeChange,
}: PlanScheduleInputsProps) {
  const phaseDates: PhaseDateValues = {
    buildUpStartDate,
    buildUpEndDate,
    tearDownStartDate,
    tearDownEndDate,
  };

  const validationErrors = useMemo(
    () => getScheduleDateValidationErrors(phaseDates, eventStartDate, eventEndDate),
    [phaseDates, eventStartDate, eventEndDate],
  );
  const isPhasePartial = hasAnyPhaseDates(phaseDates) && !hasCompletePhaseDates(phaseDates);

  return (
    <>
      <div className="planning-view__schedule-inputs planning-view__schedule-inputs--phase">
        <fieldset className="planning-view__schedule-group" disabled={readOnly}>
          <legend className="planning-view__schedule-group-title">Build-up</legend>
          <div className="planning-view__schedule-group-grid">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">From</span>
              <input
                className="input"
                type="date"
                value={buildUpStartDate ?? ''}
                onChange={(event) => onPhaseDateChange('buildUpStartDate', event.target.value)}
              />
            </label>
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">To</span>
              <input
                className="input"
                type="date"
                value={buildUpEndDate ?? ''}
                onChange={(event) => onPhaseDateChange('buildUpEndDate', event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="planning-view__schedule-group" disabled={readOnly}>
          <legend className="planning-view__schedule-group-title">Tear-down</legend>
          <div className="planning-view__schedule-group-grid">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">From</span>
              <input
                className="input"
                type="date"
                value={tearDownStartDate ?? ''}
                onChange={(event) => onPhaseDateChange('tearDownStartDate', event.target.value)}
              />
            </label>
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">To</span>
              <input
                className="input"
                type="date"
                value={tearDownEndDate ?? ''}
                onChange={(event) => onPhaseDateChange('tearDownEndDate', event.target.value)}
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

      {isPhasePartial && (
        <p className="planning-view__schedule-validation planning-view__schedule-validation--hint">
          Set all four phase dates to enable phase-based scheduling windows.
        </p>
      )}

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
