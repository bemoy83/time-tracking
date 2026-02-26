import { useState } from 'react';
import {
  WORK_UNIT_LABELS,
  BUILD_PHASE_LABELS,
} from '../../lib/types';
import { getWorkTypeById } from '../../lib/stores/work-type-store';
import {
  type PlanLineItem,
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

/** Select all text on focus so typing replaces the value. */
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

interface LineItemCardProps {
  item: PlanLineItem;
  suggestion: LineItemSuggestion | null;
  isLocked: boolean;
  onUpdate: (updates: Partial<PlanLineItem>) => void;
  onDuplicate?: (item: PlanLineItem) => void;
  onRemove: () => void;
}

export function LineItemCard({
  item,
  suggestion,
  isLocked,
  onUpdate,
  onDuplicate,
  onRemove,
}: LineItemCardProps) {
  const [rationale, setRationale] = useState(item.rationale ?? '');
  const riskClass = suggestion ? `planning-view__risk--${suggestion.risk}` : '';

  const canRecomputeTime = item.workQuantity > 0 && item.crew > 0 && item.productivityRate > 0;
  const handleRecomputeTime = () => {
    const result = computeProductivityResult('time', item.workQuantity, item.productivityRate, 0, item.crew);
    if (result?.timeHours != null) {
      onUpdate({ timeHours: Math.round(result.timeHours * 100) / 100 });
    }
  };

  const canRecomputeCrew = item.workQuantity > 0 && item.timeHours > 0 && item.productivityRate > 0;
  const handleRecomputeCrew = () => {
    const result = computeProductivityResult('crew', item.workQuantity, item.productivityRate, item.timeHours, 0);
    if (result?.crew != null) {
      onUpdate({ crew: result.crew });
    }
  };

  const workTypeLabel = (() => {
    const wt = item.workTypeId ? getWorkTypeById(item.workTypeId) : null;
    return wt
      ? `${wt.title} · ${BUILD_PHASE_LABELS[wt.buildPhase]} · ${WORK_UNIT_LABELS[wt.workUnit]}`
      : `${resolveLineItemWorkTypeTitle(item)} · ${BUILD_PHASE_LABELS[item.buildPhase]} · ${WORK_UNIT_LABELS[item.workUnit]}`;
  })();

  return (
    <div className={`planning-view__line-item ${riskClass}`}>
      <div className="planning-view__line-item-header">
        <div className="planning-view__line-item-info">
          <span className="planning-view__line-item-title">{item.title}</span>
          <span className="planning-view__line-item-type">{workTypeLabel}</span>
        </div>
        {!isLocked && (
          <div className="planning-view__line-item-actions">
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

      {isLocked ? (
        <div className="planning-view__line-item-fields">
          <div className="planning-view__field">
            <span className="planning-view__field-label">Quantity</span>
            <span className="planning-view__field-value">{item.workQuantity}</span>
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">Crew</span>
            <span className="planning-view__field-value">{item.crew}</span>
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">Time (hrs)</span>
            <span className="planning-view__field-value">{item.timeHours}</span>
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">Rate</span>
            <span className="planning-view__field-value">
              {item.productivityRate} {WORK_UNIT_LABELS[item.workUnit]}/ph
            </span>
          </div>
        </div>
      ) : (
        <div className="planning-view__line-item-fields">
          <div className="planning-view__field">
            <span className="planning-view__field-label">Quantity</span>
            <input
              type="number"
              className="input"
              value={item.workQuantity}
              onChange={(e) => onUpdate({ workQuantity: Number(e.target.value) })}
              onFocus={selectOnFocus}
            />
          </div>
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
              value={item.crew}
              min={1}
              max={20}
              onChange={(e) => onUpdate({ crew: Number(e.target.value) })}
              onFocus={selectOnFocus}
            />
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
              value={item.timeHours}
              step={0.5}
              onChange={(e) => onUpdate({ timeHours: Number(e.target.value) })}
              onFocus={selectOnFocus}
            />
          </div>
          <div className="planning-view__field">
            <span className="planning-view__field-label">
              Rate ({WORK_UNIT_LABELS[item.workUnit]}/ph)
            </span>
            <input
              type="number"
              className="input"
              value={item.productivityRate}
              step={0.1}
              onChange={(e) => onUpdate({ productivityRate: Number(e.target.value) })}
              onFocus={selectOnFocus}
            />
          </div>
        </div>
      )}

      {/* KPI Suggestion */}
      {suggestion && suggestion.suggestedRate != null && (
        <div className="planning-view__suggestion">
          <SparklesIcon className="planning-view__suggestion-icon" />
          <span className="planning-view__suggestion-text">
            KPI suggests{' '}
            <span className="planning-view__suggestion-rate">
              {suggestion.suggestedRate.toFixed(1)} {WORK_UNIT_LABELS[item.workUnit]}/ph
            </span>
          </span>
          {suggestion.confidence && suggestion.confidence !== 'insufficient' && (
            <StatusBadge variant={suggestion.confidence} />
          )}
          {!isLocked && (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => onUpdate({
                productivityRate: suggestion.suggestedRate!,
                rateSource: 'historical',
                timeHours: suggestion.suggestedTimeHours ?? item.timeHours,
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
            <span key={i} className="planning-view__risk-reason">{reason}</span>
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
