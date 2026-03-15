import { useMemo } from 'react';
import { CalendarIcon } from '../../../components/icons';
import {
  type PhaseDateField,
  type PhaseDateValues,
  getScheduleDateValidationErrors,
} from './schedule-date-ui';

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function openDatePicker(e: React.MouseEvent | React.KeyboardEvent) {
  const input = (e.currentTarget.parentElement?.querySelector('input[type="date"]') as HTMLInputElement | null);
  try {
    input?.showPicker?.();
  } catch {
    /* showPicker requires user gesture; fallback: input receives click if not disabled */
  }
}

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
          <legend className="planning-view__schedule-group-title planning-view__schedule-group-title--assembly">Assembly</legend>
          <div className="planning-view__schedule-group-grid">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">From</span>
              <div className="planning-view__date-display-wrap">
                <div
                  className={`planning-view__date-display${!readOnly ? ' planning-view__date-display--interactive' : ''}`}
                  aria-hidden="true"
                  onClick={!readOnly ? openDatePicker : undefined}
                  onKeyDown={
                    !readOnly
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDatePicker(e);
                          }
                        }
                      : undefined
                  }
                >
                  <CalendarIcon /><span>{formatShortDate(assemblyStartDate)}</span>
                </div>
                <input
                  className="input"
                  type="date"
                  value={assemblyStartDate ?? ''}
                  onChange={(event) => onPhaseDateChange('assemblyStartDate', event.target.value)}
                />
              </div>
            </label>
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">To</span>
              <div className="planning-view__date-display-wrap">
                <div
                  className={`planning-view__date-display${!readOnly ? ' planning-view__date-display--interactive' : ''}`}
                  aria-hidden="true"
                  onClick={!readOnly ? openDatePicker : undefined}
                  onKeyDown={
                    !readOnly
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDatePicker(e);
                          }
                        }
                      : undefined
                  }
                >
                  <CalendarIcon /><span>{formatShortDate(assemblyEndDate)}</span>
                </div>
                <input
                  className="input"
                  type="date"
                  value={assemblyEndDate ?? ''}
                  onChange={(event) => onPhaseDateChange('assemblyEndDate', event.target.value)}
                />
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset className="planning-view__schedule-group" disabled={readOnly}>
          <legend className="planning-view__schedule-group-title planning-view__schedule-group-title--dismantle">Dismantle</legend>
          <div className="planning-view__schedule-group-grid">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">From</span>
              <div className="planning-view__date-display-wrap">
                <div
                  className={`planning-view__date-display${!readOnly ? ' planning-view__date-display--interactive' : ''}`}
                  aria-hidden="true"
                  onClick={!readOnly ? openDatePicker : undefined}
                  onKeyDown={
                    !readOnly
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDatePicker(e);
                          }
                        }
                      : undefined
                  }
                >
                  <CalendarIcon /><span>{formatShortDate(dismantleStartDate)}</span>
                </div>
                <input
                  className="input"
                  type="date"
                  value={dismantleStartDate ?? ''}
                  onChange={(event) => onPhaseDateChange('dismantleStartDate', event.target.value)}
                />
              </div>
            </label>
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">To</span>
              <div className="planning-view__date-display-wrap">
                <div
                  className={`planning-view__date-display${!readOnly ? ' planning-view__date-display--interactive' : ''}`}
                  aria-hidden="true"
                  onClick={!readOnly ? openDatePicker : undefined}
                  onKeyDown={
                    !readOnly
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDatePicker(e);
                          }
                        }
                      : undefined
                  }
                >
                  <CalendarIcon /><span>{formatShortDate(dismantleEndDate)}</span>
                </div>
                <input
                  className="input"
                  type="date"
                  value={dismantleEndDate ?? ''}
                  onChange={(event) => onPhaseDateChange('dismantleEndDate', event.target.value)}
                />
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset className="planning-view__schedule-group" disabled={readOnly}>
          <legend className="planning-view__schedule-group-title">Default Crew</legend>
          <div className="planning-view__schedule-group-grid planning-view__schedule-group-grid--single">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">Crew size</span>
              <div className="planning-view__schedule-value-wrap">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  value={defaultCrewSize ?? ''}
                  onChange={(event) => onDefaultCrewSizeChange(event.target.value)}
                />
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset className="planning-view__schedule-group" disabled={readOnly}>
          <legend className="planning-view__schedule-group-title">Event (optional)</legend>
          <div className="planning-view__schedule-group-grid">
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">From</span>
              <div className="planning-view__date-display-wrap">
                <div
                  className={`planning-view__date-display${!readOnly ? ' planning-view__date-display--interactive' : ''}`}
                  aria-hidden="true"
                  onClick={!readOnly ? openDatePicker : undefined}
                  onKeyDown={
                    !readOnly
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDatePicker(e);
                          }
                        }
                      : undefined
                  }
                >
                  <CalendarIcon /><span>{formatShortDate(eventStartDate)}</span>
                </div>
                <input
                  className="input"
                  type="date"
                  value={eventStartDate ?? ''}
                  onChange={(event) => onEventDateChange('eventStartDate', event.target.value)}
                />
              </div>
            </label>
            <label className="planning-view__schedule-input">
              <span className="planning-view__schedule-label-text">To</span>
              <div className="planning-view__date-display-wrap">
                <div
                  className={`planning-view__date-display${!readOnly ? ' planning-view__date-display--interactive' : ''}`}
                  aria-hidden="true"
                  onClick={!readOnly ? openDatePicker : undefined}
                  onKeyDown={
                    !readOnly
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDatePicker(e);
                          }
                        }
                      : undefined
                  }
                >
                  <CalendarIcon /><span>{formatShortDate(eventEndDate)}</span>
                </div>
                <input
                  className="input"
                  type="date"
                  value={eventEndDate ?? ''}
                  onChange={(event) => onEventDateChange('eventEndDate', event.target.value)}
                />
              </div>
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
