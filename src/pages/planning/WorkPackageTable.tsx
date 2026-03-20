import { useMemo, type KeyboardEvent } from 'react';
import {
  BUILD_PHASES,
  formatWorkTypeWithUnit,
  resolveWorkUnitLabel,
  type BuildPhase,
  type WorkType,
} from '../../lib/types';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import {
  type PlanLineItem,
  getPhaseFields,
  getPhaseQuantity,
  isPhaseActive,
  phaseFieldUpdates,
  resolveLineItemWorkTypeTitle,
} from '../../lib/planning/plan-model';
import type { LineItemSuggestion, PhaseSuggestion } from '../../lib/planning/plan-suggestions';
import { DuplicateIcon, SparklesIcon, TrashIcon } from '../../components/icons';

interface WorkPackageTableProps {
  lineItems: PlanLineItem[];
  suggestionsByLineItemId: Map<string, LineItemSuggestion>;
  isLocked: boolean;
  onUpdate: (lineItemId: string, updates: Partial<PlanLineItem>) => void;
  onBatchApplySuggestions?: (
    updates: Array<{ itemId: string; updates: Partial<PlanLineItem> }>,
  ) => void;
  onDuplicate: (item: PlanLineItem) => void;
  onRemove: (lineItemId: string) => void;
}

function parseInputNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}

function getSuggestionForPhase(
  suggestion: LineItemSuggestion,
  phase: BuildPhase,
): PhaseSuggestion {
  return phase === 'assembly' ? suggestion.assembly : suggestion.dismantle;
}

function getMagicPhaseUpdates(
  item: PlanLineItem,
  phase: BuildPhase,
  suggestion: PhaseSuggestion,
): Partial<PlanLineItem> | null {
  const pf = getPhaseFields(item, phase);
  const quantity = getPhaseQuantity(item, phase);
  const hasActionableSuggestion =
    suggestion.suggestedCrew != null ||
    suggestion.suggestedRate != null ||
    suggestion.suggestedTimeHours != null;
  const effectiveRate = pf.rate > 0 ? pf.rate : (suggestion.suggestedRate ?? 0);

  if (!hasActionableSuggestion || quantity <= 0 || effectiveRate <= 0) {
    return null;
  }

  const nextCrew = suggestion.suggestedCrew ?? (pf.crew > 0 ? pf.crew : 1);
  if (nextCrew <= 0) return null;

  const nextRate = suggestion.suggestedRate ?? pf.rate;
  const rateForTime = nextRate > 0 ? nextRate : effectiveRate;
  const nextTimeHours = quantity / (rateForTime * nextCrew);

  const updates: Partial<PlanLineItem> = phaseFieldUpdates(phase, {
    crew: nextCrew,
    timeHours: roundTo1(nextTimeHours),
  });

  if (suggestion.suggestedRate != null && pf.rate !== suggestion.suggestedRate) {
    Object.assign(
      updates,
      phaseFieldUpdates(phase, {
        rate: suggestion.suggestedRate,
        rateSource: 'historical',
      }),
    );
  }

  return updates;
}

function canApplyMagic(item: PlanLineItem, suggestion: LineItemSuggestion | null): boolean {
  if (!suggestion) return false;
  return BUILD_PHASES.some(
    (phase) => getMagicPhaseUpdates(item, phase, getSuggestionForPhase(suggestion, phase)) != null,
  );
}

export function WorkPackageTable({
  lineItems,
  suggestionsByLineItemId,
  isLocked,
  onUpdate,
  onBatchApplySuggestions,
  onDuplicate,
  onRemove,
}: WorkPackageTableProps) {
  const { workTypes } = useWorkTypeStore();
  const selectableWorkTypes = useMemo(
    () => workTypes.filter((wt) => wt.readOnly !== true),
    [workTypes],
  );

  const handleWorkTypeChange = (item: PlanLineItem, nextWorkType: WorkType) => {
    const assemblyCrew = nextWorkType.assemblyRate > 0 ? Math.max(1, item.assemblyCrew) : 0;
    const dismantleCrew = nextWorkType.dismantleRate > 0 ? Math.max(1, item.dismantleCrew) : 0;
    const dismantleQuantity = item.dismantleQuantity ?? item.workQuantity;
    const assemblyTimeHours =
      item.workQuantity > 0 && assemblyCrew > 0 && nextWorkType.assemblyRate > 0
        ? roundTo1(item.workQuantity / (nextWorkType.assemblyRate * assemblyCrew))
        : 0;
    const dismantleTimeHours =
      dismantleQuantity > 0 && dismantleCrew > 0 && nextWorkType.dismantleRate > 0
        ? roundTo1(dismantleQuantity / (nextWorkType.dismantleRate * dismantleCrew))
        : 0;

    onUpdate(item.id, {
      workTypeId: nextWorkType.id,
      workTypeTitle: nextWorkType.title,
      workUnit: nextWorkType.workUnit,
      assemblyRate: nextWorkType.assemblyRate,
      assemblyCrew,
      assemblyRateSource: 'template',
      assemblyTimeHours,
      dismantleRate: nextWorkType.dismantleRate,
      dismantleCrew,
      dismantleRateSource: 'template',
      dismantleTimeHours,
    });
  };

  const handleActivatePhase = (item: PlanLineItem, phase: BuildPhase) => {
    if (isLocked || isPhaseActive(item, phase)) return;
    onUpdate(item.id, phaseFieldUpdates(phase, { crew: 1 }));
  };

  const handleMagicApply = (item: PlanLineItem, suggestion: LineItemSuggestion | null) => {
    if (isLocked || !suggestion) return;
    const updates: Partial<PlanLineItem> = {};
    for (const phase of BUILD_PHASES) {
      const phaseSuggestion = getSuggestionForPhase(suggestion, phase);
      const phaseUpdates = getMagicPhaseUpdates(item, phase, phaseSuggestion);
      if (phaseUpdates) Object.assign(updates, phaseUpdates);
    }
    if (Object.keys(updates).length > 0) {
      onUpdate(item.id, updates);
    }
  };
  const batchApplyableUpdates = useMemo(
    () =>
      lineItems.flatMap((item) => {
        const suggestion = suggestionsByLineItemId.get(item.id);
        if (!suggestion) return [];
        const updates: Partial<PlanLineItem> = {};
        for (const phase of BUILD_PHASES) {
          const phaseSuggestion = getSuggestionForPhase(suggestion, phase);
          const phaseUpdates = getMagicPhaseUpdates(item, phase, phaseSuggestion);
          if (phaseUpdates) Object.assign(updates, phaseUpdates);
        }
        if (Object.keys(updates).length === 0) return [];
        return [{ itemId: item.id, updates }];
      }),
    [lineItems, suggestionsByLineItemId],
  );
  const batchApplyableCount = batchApplyableUpdates.length;
  const handleBatchMagicApply = () => {
    if (isLocked || !onBatchApplySuggestions || batchApplyableCount === 0) return;
    onBatchApplySuggestions(batchApplyableUpdates);
  };

  const getPhaseActivationProps = (
    item: PlanLineItem,
    phase: BuildPhase,
    inactive: boolean,
  ) => {
    if (isLocked || !inactive) return {};
    const activate = () => handleActivatePhase(item, phase);
    const phaseLabel = phase === 'assembly' ? 'assembly' : 'dismantle';
    return {
      role: 'button' as const,
      tabIndex: 0,
      onClick: activate,
      onKeyDown: (event: KeyboardEvent<HTMLTableCellElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      },
      title: `Click or press Enter to activate ${phaseLabel} phase`,
      'aria-label': `Activate ${phaseLabel} phase for ${item.title}`,
      'aria-disabled': false,
    };
  };

  return (
    <div className="planning-view__work-package-table-wrap">
      <table className="planning-view__work-package-table">
        <caption className="sr-only">
          Work packages with editable quantity, type, and assembly/dismantle staffing fields.
        </caption>
        <thead>
          <tr className="planning-view__wp-header-group">
            <th colSpan={4} className="planning-view__wp-group-heading" scope="colgroup">
              Work Package
            </th>
            <th
              colSpan={3}
              className="planning-view__wp-group-heading planning-view__wp-group-heading--phase planning-view__wp-group-heading--assembly planning-view__wp-phase-group-start"
              scope="colgroup"
              title="Defaults from work type. Edit values only when overriding."
              aria-label="Assembly defaults from work type; editable to override"
            >
              <span className="planning-view__wp-group-heading-label">Assembly</span>
            </th>
            <th
              colSpan={3}
              className="planning-view__wp-group-heading planning-view__wp-group-heading--phase planning-view__wp-group-heading--dismantle planning-view__wp-phase-group-start"
              scope="colgroup"
              title="Defaults from work type. Edit values only when overriding."
              aria-label="Dismantle defaults from work type; editable to override"
            >
              <span className="planning-view__wp-group-heading-label">Dismantle</span>
            </th>
            <th rowSpan={2} className="planning-view__wp-actions-col" scope="col">
              <div className="planning-view__wp-actions-col-content">
                <span className="planning-view__wp-actions-col-label">Actions</span>
                {!isLocked && onBatchApplySuggestions && (
                  <button
                    type="button"
                    className="planning-view__wp-action-btn planning-view__wp-action-btn--magic planning-view__wp-batch-apply"
                    onClick={handleBatchMagicApply}
                    aria-label="Apply suggestions to all applicable work packages"
                    title={
                      batchApplyableCount > 0
                        ? 'Apply suggested values to all rows'
                        : 'No suggestions to apply'
                    }
                    disabled={batchApplyableCount === 0}
                  >
                    <SparklesIcon className="planning-view__wp-action-icon" />
                  </button>
                )}
              </div>
            </th>
          </tr>
          <tr className="planning-view__wp-header-columns">
            <th className="planning-view__wp-title-col" scope="col">Title</th>
            <th className="planning-view__wp-type-col" scope="col">Type</th>
            <th className="planning-view__wp-qty-col" scope="col">Qty</th>
            <th className="planning-view__wp-unit-col" scope="col">Unit</th>
            <th
              className="planning-view__wp-rate-col planning-view__wp-phase-col planning-view__wp-phase-col--assembly planning-view__wp-phase-group-start"
              scope="col"
            >
              Rate
            </th>
            <th
              className="planning-view__wp-crew-col planning-view__wp-phase-col planning-view__wp-phase-col--assembly"
              scope="col"
            >
              Crew
            </th>
            <th
              className="planning-view__wp-hours-col planning-view__wp-phase-col planning-view__wp-phase-col--assembly"
              scope="col"
            >
              Hrs
            </th>
            <th
              className="planning-view__wp-rate-col planning-view__wp-phase-col planning-view__wp-phase-col--dismantle planning-view__wp-phase-group-start"
              scope="col"
            >
              Rate
            </th>
            <th
              className="planning-view__wp-crew-col planning-view__wp-phase-col planning-view__wp-phase-col--dismantle"
              scope="col"
            >
              Crew
            </th>
            <th
              className="planning-view__wp-hours-col planning-view__wp-phase-col planning-view__wp-phase-col--dismantle"
              scope="col"
            >
              Hrs
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 && (
            <tr>
              <td colSpan={11} className="planning-view__wp-empty">
                No work packages yet.
              </td>
            </tr>
          )}
          {lineItems.map((item) => {
            const suggestion = suggestionsByLineItemId.get(item.id) ?? null;
            const rowCanApplyMagic = canApplyMagic(item, suggestion);
            const assemblyFields = getPhaseFields(item, 'assembly');
            const dismantleFields = getPhaseFields(item, 'dismantle');
            const assemblyInactive = !isPhaseActive(item, 'assembly');
            const dismantleInactive = !isPhaseActive(item, 'dismantle');
            const currentWorkTypeLabel = formatWorkTypeWithUnit(resolveLineItemWorkTypeTitle(item), item.workUnit);
            const assemblyActivationProps = getPhaseActivationProps(item, 'assembly', assemblyInactive);
            const dismantleActivationProps = getPhaseActivationProps(item, 'dismantle', dismantleInactive);

            return (
              <tr key={item.id} className="planning-view__wp-row">
                <td className="planning-view__wp-cell">
                  {isLocked ? (
                    <span className="planning-view__wp-static">{item.title}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input"
                      value={item.title}
                      onChange={(e) => onUpdate(item.id, { title: e.target.value })}
                      aria-label={`Title for ${item.title}`}
                    />
                  )}
                </td>

                <td className="planning-view__wp-cell">
                  {isLocked ? (
                    <span className="planning-view__wp-static">{currentWorkTypeLabel}</span>
                  ) : (
                    <select
                      className="input planning-view__wp-cell-input planning-view__wp-cell-select"
                      value={item.workTypeId ?? ''}
                      onChange={(e) => {
                        const wt = workTypes.find((candidate) => candidate.id === e.target.value);
                        if (!wt) return;
                        handleWorkTypeChange(item, wt);
                      }}
                      aria-label={`Work type for ${item.title}`}
                    >
                      {!item.workTypeId && <option value="">Select work type…</option>}
                      {item.workTypeId &&
                        !selectableWorkTypes.some((wt) => wt.id === item.workTypeId) && (
                          <option value={item.workTypeId}>{currentWorkTypeLabel}</option>
                        )}
                      {selectableWorkTypes.map((wt) => (
                        <option key={wt.id} value={wt.id}>
                          {formatWorkTypeWithUnit(wt.title, wt.workUnit)}
                        </option>
                      ))}
                    </select>
                  )}
                </td>

                <td className="planning-view__wp-cell planning-view__wp-number-cell">
                  {isLocked ? (
                    <span className="planning-view__wp-static">{item.workQuantity}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      step="any"
                      value={item.workQuantity}
                      onChange={(e) => onUpdate(item.id, { workQuantity: parseInputNumber(e.target.value) })}
                      aria-label={`Quantity for ${item.title}`}
                    />
                  )}
                </td>

                <td className="planning-view__wp-cell planning-view__wp-unit-cell">
                  <span className="planning-view__wp-static">{resolveWorkUnitLabel(item.workUnit)}</span>
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-phase-cell--assembly planning-view__wp-number-cell planning-view__wp-phase-group-start${assemblyInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && assemblyInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  {...assemblyActivationProps}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{roundTo1(assemblyFields.rate)}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      step="any"
                      value={roundTo1(assemblyFields.rate)}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('assembly', { rate: roundTo1(parseInputNumber(e.target.value)) }),
                        )
                      }
                      disabled={assemblyInactive}
                      aria-label={`Assembly rate for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-phase-cell--assembly planning-view__wp-number-cell${assemblyInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && assemblyInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  {...assemblyActivationProps}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{assemblyFields.crew}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      min={0}
                      step="any"
                      value={assemblyFields.crew}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('assembly', { crew: parseInputNumber(e.target.value) }),
                        )
                      }
                      disabled={assemblyInactive}
                      aria-label={`Assembly crew for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-phase-cell--assembly planning-view__wp-number-cell${assemblyInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && assemblyInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  {...assemblyActivationProps}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{roundTo1(assemblyFields.timeHours)}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      step="any"
                      value={roundTo1(assemblyFields.timeHours)}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('assembly', { timeHours: roundTo1(parseInputNumber(e.target.value)) }),
                        )
                      }
                      disabled={assemblyInactive}
                      aria-label={`Assembly hours for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-phase-cell--dismantle planning-view__wp-number-cell planning-view__wp-phase-group-start${dismantleInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && dismantleInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  {...dismantleActivationProps}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{roundTo1(dismantleFields.rate)}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      step="any"
                      value={roundTo1(dismantleFields.rate)}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('dismantle', { rate: roundTo1(parseInputNumber(e.target.value)) }),
                        )
                      }
                      disabled={dismantleInactive}
                      aria-label={`Dismantle rate for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-phase-cell--dismantle planning-view__wp-number-cell${dismantleInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && dismantleInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  {...dismantleActivationProps}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{dismantleFields.crew}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      min={0}
                      step="any"
                      value={dismantleFields.crew}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('dismantle', { crew: parseInputNumber(e.target.value) }),
                        )
                      }
                      disabled={dismantleInactive}
                      aria-label={`Dismantle crew for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-phase-cell--dismantle planning-view__wp-number-cell${dismantleInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && dismantleInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  {...dismantleActivationProps}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{roundTo1(dismantleFields.timeHours)}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      step="any"
                      value={roundTo1(dismantleFields.timeHours)}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('dismantle', { timeHours: roundTo1(parseInputNumber(e.target.value)) }),
                        )
                      }
                      disabled={dismantleInactive}
                      aria-label={`Dismantle hours for ${item.title}`}
                    />
                  )}
                </td>

                <td className="planning-view__wp-cell planning-view__wp-actions-cell">
                  {!isLocked && (
                    <div className="planning-view__wp-actions">
                      <button
                        type="button"
                        className="planning-view__wp-action-btn planning-view__wp-action-btn--magic"
                        onClick={() => handleMagicApply(item, suggestion)}
                        aria-label={`Apply suggestions for ${item.title}`}
                        title="Apply suggested values"
                        disabled={!rowCanApplyMagic}
                      >
                        <SparklesIcon className="planning-view__wp-action-icon" />
                      </button>
                      <button
                        type="button"
                        className="planning-view__wp-action-btn"
                        onClick={() => onDuplicate(item)}
                        aria-label={`Duplicate ${item.title}`}
                        title="Duplicate row"
                      >
                        <DuplicateIcon className="planning-view__wp-action-icon" />
                      </button>
                      <button
                        type="button"
                        className="planning-view__wp-action-btn planning-view__wp-action-btn--danger"
                        onClick={() => onRemove(item.id)}
                        aria-label={`Delete ${item.title}`}
                        title="Delete row"
                      >
                        <TrashIcon className="planning-view__wp-action-icon" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
