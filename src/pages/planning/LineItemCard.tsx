import { useState } from 'react';
import {
  formatUnitRate,
  formatWorkTypeWithUnit,
  resolveWorkUnitLabel,
  type WorkUnit,
} from '../../lib/types';
import { getWorkTypeById, useWorkTypeStore } from '../../lib/stores/work-type-store';
import {
  type PlanLineItem,
  getPhaseFields,
  phaseFieldUpdates,
  resolveLineItemWorkTypeTitle,
} from '../../lib/planning/plan-model';
import type { LineItemSuggestion } from '../../lib/planning/plan-suggestions';
import { computeProductivityResult } from '../../lib/calculator';
import {
  CalculatorIcon,
  DuplicateIcon,
  SparklesIcon,
  TrashIcon,
} from '../../components/icons';
import { StatusBadge } from '../../components/StatusBadge';
import type { BuildPhase } from '../../lib/types';

/** Select all text on focus so typing replaces the value. */
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

interface LineItemCardProps {
  item: PlanLineItem;
  suggestion: LineItemSuggestion | null;
  isLocked: boolean;
  /** Which phase to display in this card. Defaults to assembly. */
  displayPhase?: BuildPhase;
  onUpdate: (updates: Partial<PlanLineItem>) => void;
  onDuplicate?: (item: PlanLineItem) => void;
  onRemove: () => void;
}

export function LineItemCard({
  item,
  suggestion,
  isLocked,
  displayPhase = 'assembly',
  onUpdate,
  onDuplicate,
  onRemove,
}: LineItemCardProps) {
  const [rationale, setRationale] = useState(item.rationale ?? '');
  const [unitChangeWarning, setUnitChangeWarning] = useState<{ from: WorkUnit; to: WorkUnit } | null>(null);
  const { workTypes } = useWorkTypeStore();
  const riskClass = suggestion ? `planning-view__risk--${suggestion.risk}` : '';

  // Read phase fields for the display phase
  const pf = getPhaseFields(item, displayPhase);
  const phaseSuggestion = suggestion
    ? (displayPhase === 'assembly' ? suggestion.assembly : suggestion.dismantle)
    : null;
  const suggestedCrew = phaseSuggestion?.suggestedCrew ?? null;

  const canRecomputeTime = item.workQuantity > 0 && pf.crew > 0 && pf.rate > 0;
  const handleRecomputeTime = () => {
    const result = computeProductivityResult('time', item.workQuantity, pf.rate, 0, pf.crew);
    if (result?.timeHours != null) {
      onUpdate(phaseFieldUpdates(displayPhase, { timeHours: Math.round(result.timeHours * 100) / 100 }));
    }
  };

  const canRecomputeCrew = item.workQuantity > 0 && pf.timeHours > 0 && pf.rate > 0;
  const handleRecomputeCrew = () => {
    const result = computeProductivityResult('crew', item.workQuantity, pf.rate, pf.timeHours, 0);
    if (result?.crew != null) {
      onUpdate(phaseFieldUpdates(displayPhase, { crew: result.crew }));
    }
  };

  const effectiveRate = pf.rate > 0 ? pf.rate : (phaseSuggestion?.suggestedRate ?? 0);
  /** Magic button shows when all are met: editable, has quantity, has rate, and at least one suggestion (crew/rate/time). Phase-agnostic. */
  const hasActionableSuggestion =
    suggestedCrew != null || phaseSuggestion?.suggestedRate != null || phaseSuggestion?.suggestedTimeHours != null;
  const canMagicApply =
    !isLocked &&
    item.workQuantity > 0 &&
    effectiveRate > 0 &&
    hasActionableSuggestion;
  const handleMagicApply = () => {
    const crew = suggestedCrew ?? pf.crew;
    const rate = pf.rate > 0 ? pf.rate : (phaseSuggestion?.suggestedRate ?? 1);
    const timeHours = item.workQuantity / (rate * crew);
    const updates: Partial<PlanLineItem> = phaseFieldUpdates(displayPhase, {
      crew,
      timeHours: Math.round(timeHours * 100) / 100,
    });
    if (phaseSuggestion?.suggestedRate != null && pf.rate !== phaseSuggestion.suggestedRate) {
      Object.assign(updates, phaseFieldUpdates(displayPhase, {
        rate: phaseSuggestion.suggestedRate,
        rateSource: 'historical',
      }));
    }
    onUpdate(updates);
  };

  const workTypeLabel = (() => {
    const wt = item.workTypeId ? getWorkTypeById(item.workTypeId) : null;
    return wt
      ? formatWorkTypeWithUnit(wt.title, wt.workUnit)
      : formatWorkTypeWithUnit(resolveLineItemWorkTypeTitle(item), item.workUnit);
  })();

  const handleWorkTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const wt = workTypes.find((w) => w.id === e.target.value);
    if (!wt) return;
    setUnitChangeWarning(
      wt.workUnit !== item.workUnit ? { from: item.workUnit, to: wt.workUnit } : null,
    );
    const effectiveWtRate = displayPhase === 'dismantle' ? wt.dismantleRate : wt.assemblyRate;
    const chosenRate = effectiveWtRate || wt.assemblyRate || wt.dismantleRate;
    const updates: Partial<PlanLineItem> = {
      workTypeId: wt.id,
      workTypeTitle: wt.title,
      workUnit: wt.workUnit,
      ...phaseFieldUpdates(displayPhase, {
        rate: chosenRate,
        rateSource: 'template',
      }),
    };
    if (chosenRate > 0 && pf.crew > 0 && item.workQuantity > 0) {
      Object.assign(updates, phaseFieldUpdates(displayPhase, {
        timeHours: Math.round((item.workQuantity / (chosenRate * pf.crew)) * 100) / 100,
      }));
    }
    onUpdate(updates);
  };

  return (
    <div className={`planning-view__line-item ${riskClass}`}>
      <div className="planning-view__line-item-header">
        <div className="planning-view__line-item-info">
          <span className="planning-view__line-item-title">{item.title}</span>
          {isLocked ? (
            <span className="planning-view__line-item-type">{workTypeLabel}</span>
          ) : (
            <>
              <select
                className="input planning-view__work-type-select"
                value={item.workTypeId ?? ''}
                onChange={handleWorkTypeChange}
              >
                <option value="" disabled>Select work type…</option>
                {workTypes.map((wt) => (
                  <option key={wt.id} value={wt.id}>
                    {formatWorkTypeWithUnit(wt.title, wt.workUnit)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        {!isLocked && (
          <div className="planning-view__line-item-actions">
            {canMagicApply && (
              <button
                type="button"
                className="planning-view__line-item-magic"
                onClick={handleMagicApply}
                aria-label="Apply suggestions"
                title="Apply suggested crew, rate, and time"
              >
                <SparklesIcon className="planning-view__line-item-action-icon" />
              </button>
            )}
            <button
              type="button"
              className="planning-view__line-item-duplicate"
              onClick={() => onDuplicate?.(item)}
              aria-label={`Duplicate ${item.title}`}
            >
              <DuplicateIcon className="planning-view__line-item-action-icon" />
            </button>
            <button
              className="planning-view__line-item-remove"
              onClick={onRemove}
              aria-label={`Remove ${item.title}`}
            >
              <TrashIcon className="planning-view__line-item-action-icon" />
            </button>
          </div>
        )}
      </div>

      {unitChangeWarning && (
        <div className="planning-view__unit-warning">
          <span>
            Unit changed from {resolveWorkUnitLabel(unitChangeWarning.from)} to{' '}
            {resolveWorkUnitLabel(unitChangeWarning.to)}. Verify quantity.
          </span>
          <button
            type="button"
            className="planning-view__unit-warning-dismiss"
            onClick={() => setUnitChangeWarning(null)}
            aria-label="Dismiss warning"
          >
            ✕
          </button>
        </div>
      )}

      {isLocked ? (
        <div className="planning-view__line-item-fields">
          <div className="planning-view__field-group">
            <div className="planning-view__field">
              <span className="planning-view__field-label">Quantity</span>
              <span className="planning-view__field-value">{item.workQuantity}</span>
            </div>
            <div className="planning-view__field">
              <span className="planning-view__field-label">Rate</span>
              <span className="planning-view__field-value">
                {formatUnitRate(pf.rate, item.workUnit)}
              </span>
            </div>
          </div>
          <div className="planning-view__field-group">
            <div className="planning-view__field">
              <span className="planning-view__field-label">Crew</span>
              <span className="planning-view__field-value">{pf.crew}</span>
            </div>
            <div className="planning-view__field">
              <span className="planning-view__field-label">Time (hrs)</span>
              <span className="planning-view__field-value">{pf.timeHours}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="planning-view__line-item-fields">
          <div className="planning-view__field-group">
            <div className="planning-view__field">
              <span className="planning-view__field-label">Quantity</span>
              <input
                type="number"
                className="input"
                value={item.workQuantity}
                onChange={(e) => onUpdate({ workQuantity: Number(e.target.value) })}
                onFocus={selectOnFocus}
              />
              <span className="planning-view__field-help">Total in {resolveWorkUnitLabel(item.workUnit)}</span>
            </div>
            <div className="planning-view__field">
              <span className="planning-view__field-label">
                Rate ({resolveWorkUnitLabel(item.workUnit)}/ph)
              </span>
              <input
                type="number"
                className="input"
                value={pf.rate}
                step={0.1}
                onChange={(e) => onUpdate(phaseFieldUpdates(displayPhase, { rate: Number(e.target.value) }))}
                onFocus={selectOnFocus}
              />
              <span className="planning-view__field-help">Productivity per person-hour</span>
            </div>
          </div>
          <div className="planning-view__field-group">
            <div className="planning-view__field">
              <span className="planning-view__field-label">
                Crew
                <button
                  className="planning-view__recompute-btn"
                  onClick={handleRecomputeCrew}
                  disabled={!canRecomputeCrew}
                  aria-label="Recompute crew from quantity, time, and rate"
                  title="Recompute crew"
                >
                  <CalculatorIcon className="planning-view__recompute-icon" />
                </button>
              </span>
              <input
                type="number"
                className="input"
                value={pf.crew}
                min={1}
                max={20}
                onChange={(e) => onUpdate(phaseFieldUpdates(displayPhase, { crew: Number(e.target.value) }))}
                onFocus={selectOnFocus}
              />
              <span className="planning-view__field-help">
                {suggestedCrew != null ? `Suggested: ${suggestedCrew} crew for phase` : 'Number of workers'}
              </span>
            </div>
            <div className="planning-view__field">
              <span className="planning-view__field-label">
                Time (hrs)
                <button
                  className="planning-view__recompute-btn"
                  onClick={handleRecomputeTime}
                  disabled={!canRecomputeTime}
                  aria-label="Recompute time from quantity, crew, and rate"
                  title="Recompute time"
                >
                  <CalculatorIcon className="planning-view__recompute-icon" />
                </button>
              </span>
              <input
                type="number"
                className="input"
                value={pf.timeHours}
                step={0.5}
                onChange={(e) => onUpdate(phaseFieldUpdates(displayPhase, { timeHours: Number(e.target.value) }))}
                onFocus={selectOnFocus}
              />
              <span className="planning-view__field-help">Estimated duration in hours</span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Suggestion */}
      {phaseSuggestion && phaseSuggestion.suggestedRate != null && (
        <div className="planning-view__suggestion">
          <SparklesIcon className="planning-view__suggestion-icon" />
          <span className="planning-view__suggestion-text">
            KPI suggests{' '}
            <span className="planning-view__suggestion-rate">
              {formatUnitRate(phaseSuggestion.suggestedRate.toFixed(1), item.workUnit)}
            </span>
          </span>
          {suggestion?.confidence && suggestion.confidence !== 'insufficient' && (
            <StatusBadge variant={suggestion.confidence} />
          )}
          {!isLocked && (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => onUpdate({
                ...phaseFieldUpdates(displayPhase, {
                  rate: phaseSuggestion.suggestedRate!,
                  rateSource: 'historical',
                  timeHours: phaseSuggestion.suggestedTimeHours ?? pf.timeHours,
                }),
              })}
            >
              Apply
            </button>
          )}
        </div>
      )}

      {/* Risk warnings */}
      {suggestion && suggestion.riskReasons.length > 0 && (
        <div className="planning-view__risk-warnings">
          {suggestion.riskReasons.map((reason, i) => (
            <StatusBadge key={i} variant="danger">
              {reason}
            </StatusBadge>
          ))}
        </div>
      )}

      {/* Rationale note */}
      {!isLocked && (
        <div className="planning-view__rationale">
          <input
            type="text"
            className="input"
            placeholder="Add rationale note..."
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            onBlur={() => onUpdate({ rationale: rationale || null })}
          />
          <span className="planning-view__field-help">Optional note for this package</span>
        </div>
      )}
      {isLocked && rationale && (
        <div className="planning-view__line-item-type">
          {rationale}
        </div>
      )}
    </div>
  );
}
