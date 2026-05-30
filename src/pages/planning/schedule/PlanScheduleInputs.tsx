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
  try { input?.showPicker?.(); } catch { /* fallback */ }
}

function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

interface PlanScheduleInputsProps extends PhaseDateValues {
  eventStartDate: string | null;
  eventEndDate: string | null;
  readOnly: boolean;
  onPhaseDateChange: (field: PhaseDateField, value: string) => void;
  onEventDateChange: (field: 'eventStartDate' | 'eventEndDate', value: string) => void;
}

function DateField({
  value,
  readOnly,
  placeholder,
  onChange,
}: {
  value: string | null;
  readOnly: boolean;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="psi-date-field">
      <div
        className={`psi-date-display${!readOnly ? ' psi-date-display--interactive' : ''}`}
        aria-hidden="true"
        onClick={!readOnly ? openDatePicker : undefined}
        onKeyDown={!readOnly ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDatePicker(e); }
        } : undefined}
      >
        <CalendarIcon />
        <span className={value ? undefined : 'psi-date-placeholder'}>
          {value ? formatShortDate(value) : placeholder}
        </span>
      </div>
      <input
        className="input"
        type="date"
        disabled={readOnly}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PhaseColumn({
  label,
  dotClass,
  startDate,
  endDate,
  readOnly,
  onStartChange,
  onEndChange,
}: {
  label: string;
  dotClass: string;
  startDate: string | null;
  endDate: string | null;
  readOnly: boolean;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  return (
    <div className="psi-col">
      <div className="psi-col__label">
        <span className={`psi-col__dot ${dotClass}`} />
        <span className="psi-col__label-text">{label}</span>
      </div>
      <DateField value={startDate} readOnly={readOnly} placeholder="From" onChange={onStartChange} />
      <DateField value={endDate} readOnly={readOnly} placeholder="To" onChange={onEndChange} />
    </div>
  );
}

function DerivedColumn({
  label,
  dotClass,
  startDate,
  endDate,
}: {
  label: string;
  dotClass: string;
  startDate: string | null;
  endDate: string | null;
}) {
  return (
    <div className="psi-col psi-col--derived">
      <div className="psi-col__label">
        <span className={`psi-col__dot psi-col__dot--derived ${dotClass}`} />
        <span className="psi-col__label-text psi-col__label-text--muted">{label}</span>
      </div>
      <DateField value={startDate} readOnly placeholder="From" onChange={() => {}} />
      <DateField value={endDate} readOnly placeholder="To" onChange={() => {}} />
    </div>
  );
}

export function PlanScheduleInputs({
  assemblyStartDate,
  assemblyEndDate,
  dismantleStartDate,
  dismantleEndDate,
  eventStartDate,
  eventEndDate,
  readOnly,
  onPhaseDateChange,
  onEventDateChange,
}: PlanScheduleInputsProps) {
  const movingInStart = assemblyEndDate ? shiftDate(assemblyEndDate, 1) : null;
  const movingInEnd = eventStartDate ? shiftDate(eventStartDate, -1) : null;
  const movingInVisible = movingInStart != null && movingInEnd != null && movingInStart <= movingInEnd;

  const movingOutStart = eventEndDate ? shiftDate(eventEndDate, 1) : null;
  const movingOutEnd = dismantleStartDate ? shiftDate(dismantleStartDate, -1) : null;
  const movingOutVisible = movingOutStart != null && movingOutEnd != null && movingOutStart <= movingOutEnd;

  const validationErrors = useMemo(
    () => getScheduleDateValidationErrors(
      { assemblyStartDate, assemblyEndDate, dismantleStartDate, dismantleEndDate },
      eventStartDate,
      eventEndDate,
    ),
    [assemblyStartDate, assemblyEndDate, dismantleStartDate, dismantleEndDate, eventStartDate, eventEndDate],
  );

  return (
    <div className="psi-strip">
      <div className="psi-phases">
        <PhaseColumn
          label="Assembly"
          dotClass="psi-col__dot--assembly"
          startDate={assemblyStartDate}
          endDate={assemblyEndDate}
          readOnly={readOnly}
          onStartChange={(v) => onPhaseDateChange('assemblyStartDate', v)}
          onEndChange={(v) => onPhaseDateChange('assemblyEndDate', v)}
        />

        {movingInVisible && (
          <DerivedColumn
            label="Moving In"
            dotClass="psi-col__dot--moving-in"
            startDate={movingInStart}
            endDate={movingInEnd}
          />
        )}

        <PhaseColumn
          label="Event"
          dotClass="psi-col__dot--event"
          startDate={eventStartDate}
          endDate={eventEndDate}
          readOnly={readOnly}
          onStartChange={(v) => onEventDateChange('eventStartDate', v)}
          onEndChange={(v) => onEventDateChange('eventEndDate', v)}
        />

        {movingOutVisible && (
          <DerivedColumn
            label="Moving Out"
            dotClass="psi-col__dot--moving-out"
            startDate={movingOutStart}
            endDate={movingOutEnd}
          />
        )}

        <PhaseColumn
          label="Dismantle"
          dotClass="psi-col__dot--dismantle"
          startDate={dismantleStartDate}
          endDate={dismantleEndDate}
          readOnly={readOnly}
          onStartChange={(v) => onPhaseDateChange('dismantleStartDate', v)}
          onEndChange={(v) => onPhaseDateChange('dismantleEndDate', v)}
        />
      </div>

      {validationErrors.length > 0 && (
        <div className="planning-view__schedule-validation planning-view__schedule-validation--error" role="alert">
          {validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
