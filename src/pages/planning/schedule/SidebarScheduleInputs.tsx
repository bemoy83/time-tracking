import { useMemo, useState } from 'react';
import { DEFAULT_PLAN_EFFICIENCY } from '../../../lib/planning/plan-model';
import {
  type PhaseDateField,
  type PhaseDateValues,
  getScheduleDateValidationErrors,
} from './schedule-date-ui';

function countDays(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Not set';
  if (!start) return formatShortDate(end);
  if (!end || start === end) return formatShortDate(start);
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

function shiftDate(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString('en-CA');
}

// Derived span: the gap between two contiguous phase boundaries.
// Returns null if either anchor is missing or dates are contiguous (no gap).
function getDerivedSpan(
  afterDate: string | null,
  beforeDate: string | null,
): { start: string; end: string } | null {
  if (!afterDate || !beforeDate) return null;
  const start = shiftDate(afterDate, 1);
  const end = shiftDate(beforeDate, -1);
  if (start > end) return null; // contiguous, no gap
  return { start, end };
}

function PhaseRow({
  phase,
  name,
  tag,
  dateLabel,
  dayCount,
  expanded,
  onToggle,
  readOnly,
  children,
}: {
  phase: 'assembly' | 'event' | 'dismantle';
  name: string;
  tag?: string;
  dateLabel: string;
  dayCount: number | null;
  expanded: boolean;
  onToggle: () => void;
  readOnly: boolean;
  children: React.ReactNode;
}) {
  const hasDate = dateLabel !== 'Not set';
  return (
    <div className={`sidebar-phase-row ${expanded ? 'sidebar-phase-row--expanded' : ''}`}>
      <button
        type="button"
        className="sidebar-phase-row__btn"
        onClick={onToggle}
        aria-expanded={expanded}
        disabled={readOnly}
      >
        <span className={`sidebar-phase-row__dot sidebar-phase-row__dot--${phase}`} />
        <span className="sidebar-phase-row__name">
          {name}
          {tag && <span className="sidebar-phase-row__tag">{tag}</span>}
        </span>
        <span className={`sidebar-phase-row__dates${!hasDate ? ' sidebar-phase-row__dates--empty' : ''}`}>
          {dateLabel}
        </span>
        {dayCount !== null && (
          <span className="sidebar-phase-row__day-count">{dayCount}d</span>
        )}
        {!readOnly && (
          <svg className="sidebar-phase-row__edit" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M8 2L10 4L4 10L1.5 10.5L2 8L8 2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {expanded && !readOnly && (
        <div className="sidebar-phase-row__body">
          {children}
        </div>
      )}
    </div>
  );
}

function DerivedPhaseRow({
  zone,
  name,
  start,
  end,
}: {
  zone: 'moving-in' | 'moving-out';
  name: string;
  start: string;
  end: string;
}) {
  const days = countDays(start, end);
  return (
    <div className="sidebar-phase-row sidebar-derived-row">
      <div className="sidebar-phase-row__btn sidebar-derived-row__inner">
        <span className={`sidebar-phase-row__dot sidebar-phase-row__dot--${zone}`} />
        <span className="sidebar-phase-row__name sidebar-derived-row__name">{name}</span>
        <span className="sidebar-phase-row__dates">{formatRange(start, end)}</span>
        <span className="sidebar-phase-row__day-count">{days}d</span>
      </div>
    </div>
  );
}

function CompactDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <label className="sidebar-date-field">
      <span className="sidebar-date-field__label">{label}</span>
      <input
        className="sidebar-date-field__input"
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const EFFICIENCY_PRESETS = [
  { value: '80', label: 'Conservative — 80%' },
  { value: '90', label: 'Normal — 90%' },
  { value: '100', label: 'Full pace — 100%' },
] as const;

interface SidebarScheduleInputsProps extends PhaseDateValues {
  eventStartDate: string | null;
  eventEndDate: string | null;
  defaultCrewSize: number | null;
  defaultEfficiency: number | null;
  readOnly: boolean;
  primaryRange: { start: string; end: string } | null;
  onPhaseDateChange: (field: PhaseDateField, value: string) => void;
  onEventDateChange: (field: 'eventStartDate' | 'eventEndDate', value: string) => void;
  onDefaultCrewSizeChange: (value: string) => void;
  onDefaultEfficiencyChange: (value: string) => void;
}

export function SidebarScheduleInputs({
  assemblyStartDate,
  assemblyEndDate,
  dismantleStartDate,
  dismantleEndDate,
  eventStartDate,
  eventEndDate,
  defaultCrewSize,
  defaultEfficiency,
  readOnly,
  primaryRange,
  onPhaseDateChange,
  onEventDateChange,
  onDefaultCrewSizeChange,
  onDefaultEfficiencyChange,
}: SidebarScheduleInputsProps) {
  const [expandedPhase, setExpandedPhase] = useState<'assembly' | 'event' | 'dismantle' | null>(null);

  const currentPct = defaultEfficiency != null
    ? Math.round(defaultEfficiency * 100)
    : Math.round(DEFAULT_PLAN_EFFICIENCY * 100);
  const isKnownPreset = EFFICIENCY_PRESETS.some((p) => p.value === String(currentPct));
  const [customMode, setCustomMode] = useState(() => !isKnownPreset);
  const selectValue = customMode ? 'custom' : String(currentPct);

  const validationErrors = useMemo(
    () => getScheduleDateValidationErrors(
      { assemblyStartDate, assemblyEndDate, dismantleStartDate, dismantleEndDate },
      eventStartDate,
      eventEndDate,
    ),
    [assemblyStartDate, assemblyEndDate, dismantleStartDate, dismantleEndDate, eventStartDate, eventEndDate],
  );

  const movingInSpan = useMemo(
    () => getDerivedSpan(assemblyEndDate, eventStartDate),
    [assemblyEndDate, eventStartDate],
  );

  const movingOutSpan = useMemo(
    () => getDerivedSpan(eventEndDate, dismantleStartDate),
    [eventEndDate, dismantleStartDate],
  );

  // Per-phase day counts for summary
  const phaseCounts = useMemo(() => {
    const counts: { label: string; days: number }[] = [];
    if (assemblyStartDate && assemblyEndDate)
      counts.push({ label: 'Assembly', days: countDays(assemblyStartDate, assemblyEndDate) });
    if (movingInSpan)
      counts.push({ label: 'Moving In', days: countDays(movingInSpan.start, movingInSpan.end) });
    if (eventStartDate && eventEndDate)
      counts.push({ label: 'Event', days: countDays(eventStartDate, eventEndDate) });
    if (movingOutSpan)
      counts.push({ label: 'Moving Out', days: countDays(movingOutSpan.start, movingOutSpan.end) });
    if (dismantleStartDate && dismantleEndDate)
      counts.push({ label: 'Dismantle', days: countDays(dismantleStartDate, dismantleEndDate) });
    return counts;
  }, [assemblyStartDate, assemblyEndDate, movingInSpan, eventStartDate, eventEndDate, movingOutSpan, dismantleStartDate, dismantleEndDate]);

  function toggle(phase: 'assembly' | 'event' | 'dismantle') {
    setExpandedPhase((prev) => (prev === phase ? null : phase));
  }

  const assemblyDays = assemblyStartDate && assemblyEndDate
    ? countDays(assemblyStartDate, assemblyEndDate) : null;
  const eventDays = eventStartDate && eventEndDate
    ? countDays(eventStartDate, eventEndDate) : null;
  const dismantleDays = dismantleStartDate && dismantleEndDate
    ? countDays(dismantleStartDate, dismantleEndDate) : null;

  return (
    <div className="sidebar-schedule-inputs">
      {primaryRange && (
        <p className="sidebar-schedule-inputs__summary">
          <span className="sidebar-schedule-inputs__summary-range">
            {formatShortDate(primaryRange.start)} – {formatShortDate(primaryRange.end)}
          </span>
          {phaseCounts.length > 1 ? (
            phaseCounts.map((p, i) => (
              <span key={p.label} className="sidebar-schedule-inputs__summary-phase">
                {i === 0 && <span className="sidebar-schedule-inputs__summary-sep" aria-hidden>·</span>}
                {i > 0 && <span className="sidebar-schedule-inputs__summary-dot" aria-hidden>·</span>}
                <span className="sidebar-schedule-inputs__summary-phase-label">{p.label}</span>
                {' '}
                <span className="sidebar-schedule-inputs__summary-phase-count">{p.days}d</span>
              </span>
            ))
          ) : (
            <>
              <span className="sidebar-schedule-inputs__summary-sep" aria-hidden>·</span>
              <span className="sidebar-schedule-inputs__summary-count">
                {countDays(primaryRange.start, primaryRange.end)} days
              </span>
            </>
          )}
        </p>
      )}

      <div className="sidebar-phase-stack">
        <PhaseRow
          phase="assembly"
          name="Assembly"
          dateLabel={formatRange(assemblyStartDate, assemblyEndDate)}
          dayCount={assemblyDays}
          expanded={expandedPhase === 'assembly'}
          onToggle={() => toggle('assembly')}
          readOnly={readOnly}
        >
          <div className="sidebar-phase-row__inputs">
            <CompactDateField
              label="From"
              value={assemblyStartDate}
              onChange={(v) => onPhaseDateChange('assemblyStartDate', v)}
            />
            <CompactDateField
              label="To"
              value={assemblyEndDate}
              onChange={(v) => onPhaseDateChange('assemblyEndDate', v)}
            />
          </div>
        </PhaseRow>

        {movingInSpan && (
          <DerivedPhaseRow
            zone="moving-in"
            name="Moving In"
            start={movingInSpan.start}
            end={movingInSpan.end}
          />
        )}

        <PhaseRow
          phase="event"
          name="Event"
          tag="Show"
          dateLabel={formatRange(eventStartDate, eventEndDate)}
          dayCount={eventDays}
          expanded={expandedPhase === 'event'}
          onToggle={() => toggle('event')}
          readOnly={readOnly}
        >
          <div className="sidebar-phase-row__inputs">
            <CompactDateField
              label="From"
              value={eventStartDate}
              onChange={(v) => onEventDateChange('eventStartDate', v)}
            />
            <CompactDateField
              label="To"
              value={eventEndDate}
              onChange={(v) => onEventDateChange('eventEndDate', v)}
            />
          </div>
        </PhaseRow>

        {movingOutSpan && (
          <DerivedPhaseRow
            zone="moving-out"
            name="Moving Out"
            start={movingOutSpan.start}
            end={movingOutSpan.end}
          />
        )}

        <PhaseRow
          phase="dismantle"
          name="Dismantle"
          dateLabel={formatRange(dismantleStartDate, dismantleEndDate)}
          dayCount={dismantleDays}
          expanded={expandedPhase === 'dismantle'}
          onToggle={() => toggle('dismantle')}
          readOnly={readOnly}
        >
          <div className="sidebar-phase-row__inputs">
            <CompactDateField
              label="From"
              value={dismantleStartDate}
              onChange={(v) => onPhaseDateChange('dismantleStartDate', v)}
            />
            <CompactDateField
              label="To"
              value={dismantleEndDate}
              onChange={(v) => onPhaseDateChange('dismantleEndDate', v)}
            />
          </div>
        </PhaseRow>
      </div>

      <div className="sidebar-crew-eff">
        <label className="sidebar-crew-eff__field">
          <span className="sidebar-crew-eff__label">Default crew</span>
          <input
            className="sidebar-crew-eff__input"
            type="number"
            min={0}
            step={1}
            disabled={readOnly}
            value={defaultCrewSize ?? ''}
            onChange={(e) => onDefaultCrewSizeChange(e.target.value)}
          />
        </label>

        <label className="sidebar-crew-eff__field">
          <span className="sidebar-crew-eff__label">Efficiency</span>
          {customMode ? (
            <div className="sidebar-crew-eff__custom-wrap">
              <input
                className="sidebar-crew-eff__input"
                type="number"
                min={60}
                max={100}
                step={1}
                disabled={readOnly}
                value={currentPct}
                onChange={(e) => onDefaultEfficiencyChange(e.target.value)}
              />
              <button
                type="button"
                className="sidebar-crew-eff__preset-reset"
                onClick={() => { setCustomMode(false); onDefaultEfficiencyChange('100'); }}
              >
                Reset
              </button>
            </div>
          ) : (
            <select
              className="sidebar-crew-eff__input sidebar-crew-eff__input--select"
              disabled={readOnly}
              value={selectValue}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setCustomMode(true);
                } else {
                  setCustomMode(false);
                  onDefaultEfficiencyChange(e.target.value);
                }
              }}
            >
              {EFFICIENCY_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          )}
        </label>
      </div>

      {validationErrors.length > 0 && (
        <div className="sidebar-schedule-inputs__errors" role="alert">
          {validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
