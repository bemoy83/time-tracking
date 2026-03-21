import { useMemo, useState } from 'react';
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
  defaultEfficiency: number | null;
  readOnly: boolean;
  onPhaseDateChange: (field: PhaseDateField, value: string) => void;
  onEventDateChange: (field: 'eventStartDate' | 'eventEndDate', value: string) => void;
  onDefaultCrewSizeChange: (value: string) => void;
  onDefaultEfficiencyChange: (value: string) => void;
}

const EFFICIENCY_PRESETS = [
  { value: '80', label: 'Conservative — 80%' },
  { value: '90', label: 'Normal — 90%' },
  { value: '100', label: 'Full pace — 100%' },
] as const;

function DateInput({
  label,
  labelMod,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  labelMod?: string;
  value: string | null;
  readOnly: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="planning-view__schedule-input">
      <span className={`planning-view__schedule-label-text${labelMod ? ` ${labelMod}` : ''}`}>{label}</span>
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
          <CalendarIcon /><span>{formatShortDate(value)}</span>
        </div>
        <input
          className="input"
          type="date"
          disabled={readOnly}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}

export function PlanScheduleInputs({
  assemblyStartDate,
  assemblyEndDate,
  dismantleStartDate,
  dismantleEndDate,
  eventStartDate,
  eventEndDate,
  defaultCrewSize,
  defaultEfficiency,
  readOnly,
  onPhaseDateChange,
  onEventDateChange,
  onDefaultCrewSizeChange,
  onDefaultEfficiencyChange,
}: PlanScheduleInputsProps) {
  const currentPct = defaultEfficiency != null ? Math.round(defaultEfficiency * 100) : 80;
  const isKnownPreset = EFFICIENCY_PRESETS.some((p) => p.value === String(currentPct));

  const [customMode, setCustomMode] = useState(() => !isKnownPreset);

  const selectValue = customMode ? 'custom' : String(currentPct);

  function handleEfficiencySelectChange(val: string) {
    if (val === 'custom') {
      setCustomMode(true);
    } else {
      setCustomMode(false);
      onDefaultEfficiencyChange(val);
    }
  }

  const validationErrors = useMemo(
    () => getScheduleDateValidationErrors(
      { assemblyStartDate, assemblyEndDate, dismantleStartDate, dismantleEndDate },
      eventStartDate,
      eventEndDate,
    ),
    [assemblyStartDate, assemblyEndDate, dismantleStartDate, dismantleEndDate, eventStartDate, eventEndDate],
  );

  return (
    <>
      <div className="planning-view__schedule-inputs planning-view__schedule-inputs--phase">
        {/* Row 1: phase dates */}
        <DateInput
          label="Assembly from"
          labelMod="planning-view__schedule-label-text--assembly"
          value={assemblyStartDate}
          readOnly={readOnly}
          onChange={(v) => onPhaseDateChange('assemblyStartDate', v)}
        />
        <DateInput
          label="Assembly to"
          labelMod="planning-view__schedule-label-text--assembly"
          value={assemblyEndDate}
          readOnly={readOnly}
          onChange={(v) => onPhaseDateChange('assemblyEndDate', v)}
        />
        <DateInput
          label="Dismantle from"
          labelMod="planning-view__schedule-label-text--dismantle"
          value={dismantleStartDate}
          readOnly={readOnly}
          onChange={(v) => onPhaseDateChange('dismantleStartDate', v)}
        />
        <DateInput
          label="Dismantle to"
          labelMod="planning-view__schedule-label-text--dismantle"
          value={dismantleEndDate}
          readOnly={readOnly}
          onChange={(v) => onPhaseDateChange('dismantleEndDate', v)}
        />

        {/* Row 2: crew, usable time, event dates */}
        <label className="planning-view__schedule-input">
          <span className="planning-view__schedule-label-text">Default crew</span>
          <input
            className="input"
            type="number"
            min={0}
            step={1}
            disabled={readOnly}
            value={defaultCrewSize ?? ''}
            onChange={(e) => onDefaultCrewSizeChange(e.target.value)}
          />
        </label>

        <label className="planning-view__schedule-input">
          <span className="planning-view__schedule-label-text">Base efficiency</span>
          <select
            className="input"
            disabled={readOnly}
            value={selectValue}
            onChange={(e) => handleEfficiencySelectChange(e.target.value)}
          >
            {EFFICIENCY_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
        </label>

        <DateInput
          label="Event from"
          value={eventStartDate}
          readOnly={readOnly}
          onChange={(v) => onEventDateChange('eventStartDate', v)}
        />
        <DateInput
          label="Event to"
          value={eventEndDate}
          readOnly={readOnly}
          onChange={(v) => onEventDateChange('eventEndDate', v)}
        />
      </div>

      {customMode && (
        <div className="planning-view__schedule-slider-wrap">
          <input
            type="range"
            className="planning-view__schedule-slider"
            min={60}
            max={100}
            step={1}
            disabled={readOnly}
            value={Math.min(100, Math.max(60, currentPct))}
            onChange={(e) => onDefaultEfficiencyChange(e.target.value)}
          />
          <span className="planning-view__schedule-slider-value">{currentPct}%</span>
        </div>
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
