import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILD_PHASES,
  WORK_UNIT_LABELS,
  type BuildPhase,
  type WorkType,
} from '../../lib/types';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import {
  type PlanLineItem,
  createLineItem,
  getPhaseFields,
  getPhaseQuantity,
  isPhaseActive,
  phaseFieldUpdates,
  resolveLineItemWorkTypeTitle,
} from '../../lib/planning/plan-model';
import type { LineItemSuggestion, PhaseSuggestion } from '../../lib/planning/plan-suggestions';
import { DuplicateIcon, PlusIcon, SparklesIcon, TrashIcon } from '../../components/icons';

interface WorkPackageTableProps {
  lineItems: PlanLineItem[];
  suggestionsByLineItemId: Map<string, LineItemSuggestion>;
  isLocked: boolean;
  onAdd: (item: PlanLineItem) => void;
  onUpdate: (lineItemId: string, updates: Partial<PlanLineItem>) => void;
  onDuplicate: (item: PlanLineItem) => void;
  onRemove: (lineItemId: string) => void;
}

function parseInputNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getSuggestionForPhase(
  suggestion: LineItemSuggestion,
  phase: BuildPhase,
): PhaseSuggestion {
  return phase === 'build-up' ? suggestion.buildUp : suggestion.tearDown;
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
    timeHours: roundTo2(nextTimeHours),
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
  onAdd,
  onUpdate,
  onDuplicate,
  onRemove,
}: WorkPackageTableProps) {
  const { workTypes } = useWorkTypeStore();
  const selectableWorkTypes = useMemo(
    () => workTypes.filter((wt) => wt.readOnly !== true),
    [workTypes],
  );

  const addTitleRef = useRef<HTMLInputElement>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newWorkTypeId, setNewWorkTypeId] = useState('');
  const [newQuantity, setNewQuantity] = useState(0);

  useEffect(() => {
    if (selectableWorkTypes.length === 0) {
      if (newWorkTypeId) setNewWorkTypeId('');
      return;
    }
    const isCurrentValid = selectableWorkTypes.some((wt) => wt.id === newWorkTypeId);
    if (!isCurrentValid) {
      setNewWorkTypeId(selectableWorkTypes[0].id);
    }
  }, [newWorkTypeId, selectableWorkTypes]);

  const newWorkType = newWorkTypeId
    ? selectableWorkTypes.find((wt) => wt.id === newWorkTypeId) ?? null
    : null;

  const handleAddRow = () => {
    if (!newWorkType || !newTitle.trim()) return;
    onAdd(
      createLineItem(
        newTitle.trim(),
        newWorkType.title,
        newWorkType.workUnit,
        newQuantity,
        newWorkType.buildUpRate,
        newWorkType.tearDownRate,
        'template',
        newWorkType.id,
      ),
    );
    setNewTitle('');
    setNewQuantity(0);
    addTitleRef.current?.focus();
  };

  const handleWorkTypeChange = (item: PlanLineItem, nextWorkType: WorkType) => {
    const buildUpCrew = nextWorkType.buildUpRate > 0 ? Math.max(1, item.buildUpCrew) : 0;
    const tearDownCrew = nextWorkType.tearDownRate > 0 ? Math.max(1, item.tearDownCrew) : 0;
    const tearDownQuantity = item.tearDownQuantity ?? item.workQuantity;
    const buildUpTimeHours =
      item.workQuantity > 0 && buildUpCrew > 0 && nextWorkType.buildUpRate > 0
        ? roundTo2(item.workQuantity / (nextWorkType.buildUpRate * buildUpCrew))
        : 0;
    const tearDownTimeHours =
      tearDownQuantity > 0 && tearDownCrew > 0 && nextWorkType.tearDownRate > 0
        ? roundTo2(tearDownQuantity / (nextWorkType.tearDownRate * tearDownCrew))
        : 0;

    onUpdate(item.id, {
      workTypeId: nextWorkType.id,
      workTypeTitle: nextWorkType.title,
      workUnit: nextWorkType.workUnit,
      buildUpRate: nextWorkType.buildUpRate,
      buildUpCrew,
      buildUpRateSource: 'template',
      buildUpTimeHours,
      tearDownRate: nextWorkType.tearDownRate,
      tearDownCrew,
      tearDownRateSource: 'template',
      tearDownTimeHours,
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

  return (
    <div className="planning-view__work-package-table-wrap">
      <table className="planning-view__work-package-table">
        <thead>
          <tr className="planning-view__wp-header-group">
            <th colSpan={4} className="planning-view__wp-group-heading">Work Package</th>
            <th
              colSpan={3}
              className="planning-view__wp-group-heading planning-view__wp-group-heading--phase planning-view__wp-phase-group-start"
            >
              Build-up
            </th>
            <th
              colSpan={3}
              className="planning-view__wp-group-heading planning-view__wp-group-heading--phase planning-view__wp-phase-group-start"
            >
              Tear-down
            </th>
            <th rowSpan={2} className="planning-view__wp-actions-col">Actions</th>
          </tr>
          <tr className="planning-view__wp-header-columns">
            <th className="planning-view__wp-title-col">Title</th>
            <th className="planning-view__wp-type-col">Type</th>
            <th className="planning-view__wp-qty-col">Qty</th>
            <th className="planning-view__wp-unit-col">Unit</th>
            <th className="planning-view__wp-rate-col planning-view__wp-phase-col planning-view__wp-phase-group-start">
              Rate
            </th>
            <th className="planning-view__wp-crew-col planning-view__wp-phase-col">Crew</th>
            <th className="planning-view__wp-hours-col planning-view__wp-phase-col">Hrs</th>
            <th className="planning-view__wp-rate-col planning-view__wp-phase-col planning-view__wp-phase-group-start">
              Rate
            </th>
            <th className="planning-view__wp-crew-col planning-view__wp-phase-col">Crew</th>
            <th className="planning-view__wp-hours-col planning-view__wp-phase-col">Hrs</th>
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
            const buildUpFields = getPhaseFields(item, 'build-up');
            const tearDownFields = getPhaseFields(item, 'tear-down');
            const buildUpInactive = !isPhaseActive(item, 'build-up');
            const tearDownInactive = !isPhaseActive(item, 'tear-down');
            const currentWorkTypeLabel = `${resolveLineItemWorkTypeTitle(item)} · ${WORK_UNIT_LABELS[item.workUnit]}`;

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
                          {wt.title} · {WORK_UNIT_LABELS[wt.workUnit]}
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
                      value={item.workQuantity}
                      onChange={(e) => onUpdate(item.id, { workQuantity: parseInputNumber(e.target.value) })}
                      aria-label={`Quantity for ${item.title}`}
                    />
                  )}
                </td>

                <td className="planning-view__wp-cell planning-view__wp-unit-cell">
                  <span className="planning-view__wp-static">{WORK_UNIT_LABELS[item.workUnit]}</span>
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell planning-view__wp-phase-group-start${buildUpInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && buildUpInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  onClick={() => handleActivatePhase(item, 'build-up')}
                  title={!isLocked && buildUpInactive ? 'Click to activate build-up phase' : undefined}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{buildUpFields.rate}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      step={0.1}
                      value={buildUpFields.rate}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('build-up', { rate: parseInputNumber(e.target.value) }),
                        )
                      }
                      disabled={buildUpInactive}
                      aria-label={`Build-up rate for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell${buildUpInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && buildUpInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  onClick={() => handleActivatePhase(item, 'build-up')}
                  title={!isLocked && buildUpInactive ? 'Click to activate build-up phase' : undefined}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{buildUpFields.crew}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      min={0}
                      step={1}
                      value={buildUpFields.crew}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('build-up', { crew: parseInputNumber(e.target.value) }),
                        )
                      }
                      disabled={buildUpInactive}
                      aria-label={`Build-up crew for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell${buildUpInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && buildUpInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  onClick={() => handleActivatePhase(item, 'build-up')}
                  title={!isLocked && buildUpInactive ? 'Click to activate build-up phase' : undefined}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{buildUpFields.timeHours}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      step={0.1}
                      value={buildUpFields.timeHours}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('build-up', { timeHours: parseInputNumber(e.target.value) }),
                        )
                      }
                      disabled={buildUpInactive}
                      aria-label={`Build-up hours for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell planning-view__wp-phase-group-start${tearDownInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && tearDownInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  onClick={() => handleActivatePhase(item, 'tear-down')}
                  title={!isLocked && tearDownInactive ? 'Click to activate tear-down phase' : undefined}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{tearDownFields.rate}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      step={0.1}
                      value={tearDownFields.rate}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('tear-down', { rate: parseInputNumber(e.target.value) }),
                        )
                      }
                      disabled={tearDownInactive}
                      aria-label={`Tear-down rate for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell${tearDownInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && tearDownInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  onClick={() => handleActivatePhase(item, 'tear-down')}
                  title={!isLocked && tearDownInactive ? 'Click to activate tear-down phase' : undefined}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{tearDownFields.crew}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      min={0}
                      step={1}
                      value={tearDownFields.crew}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('tear-down', { crew: parseInputNumber(e.target.value) }),
                        )
                      }
                      disabled={tearDownInactive}
                      aria-label={`Tear-down crew for ${item.title}`}
                    />
                  )}
                </td>

                <td
                  className={`planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell${tearDownInactive ? ' planning-view__wp-phase-cell--inactive' : ''}${!isLocked && tearDownInactive ? ' planning-view__wp-phase-cell--activatable' : ''}`}
                  onClick={() => handleActivatePhase(item, 'tear-down')}
                  title={!isLocked && tearDownInactive ? 'Click to activate tear-down phase' : undefined}
                >
                  {isLocked ? (
                    <span className="planning-view__wp-static">{tearDownFields.timeHours}</span>
                  ) : (
                    <input
                      className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                      type="number"
                      step={0.1}
                      value={tearDownFields.timeHours}
                      onChange={(e) =>
                        onUpdate(
                          item.id,
                          phaseFieldUpdates('tear-down', { timeHours: parseInputNumber(e.target.value) }),
                        )
                      }
                      disabled={tearDownInactive}
                      aria-label={`Tear-down hours for ${item.title}`}
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

          {!isLocked && (
            <tr className="planning-view__wp-add-row">
              <td className="planning-view__wp-cell">
                <div className="planning-view__wp-add-title-wrap">
                  <PlusIcon className="planning-view__wp-add-plus" />
                  <input
                    ref={addTitleRef}
                    className="input planning-view__wp-cell-input"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRow();
                      }
                    }}
                    placeholder="Add work package..."
                    aria-label="New work package title"
                  />
                </div>
              </td>
              <td className="planning-view__wp-cell">
                <select
                  className="input planning-view__wp-cell-input planning-view__wp-cell-select"
                  value={newWorkTypeId}
                  onChange={(e) => setNewWorkTypeId(e.target.value)}
                  disabled={selectableWorkTypes.length === 0}
                  aria-label="New work package type"
                >
                  {selectableWorkTypes.length === 0 && (
                    <option value="">No work types. Add in Settings.</option>
                  )}
                  {selectableWorkTypes.map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.title} · {WORK_UNIT_LABELS[wt.workUnit]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="planning-view__wp-cell planning-view__wp-number-cell">
                <input
                  className="input planning-view__wp-cell-input planning-view__wp-cell-input--number"
                  type="number"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(parseInputNumber(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRow();
                    }
                  }}
                  aria-label="New work package quantity"
                />
              </td>
              <td className="planning-view__wp-cell planning-view__wp-unit-cell">
                <span className="planning-view__wp-static">
                  {newWorkType ? WORK_UNIT_LABELS[newWorkType.workUnit] : '—'}
                </span>
              </td>
              <td className="planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell planning-view__wp-phase-group-start">
                <span className="planning-view__wp-static">—</span>
              </td>
              <td className="planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell">
                <span className="planning-view__wp-static">—</span>
              </td>
              <td className="planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell">
                <span className="planning-view__wp-static">—</span>
              </td>
              <td className="planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell planning-view__wp-phase-group-start">
                <span className="planning-view__wp-static">—</span>
              </td>
              <td className="planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell">
                <span className="planning-view__wp-static">—</span>
              </td>
              <td className="planning-view__wp-cell planning-view__wp-phase-cell planning-view__wp-number-cell">
                <span className="planning-view__wp-static">—</span>
              </td>
              <td className="planning-view__wp-cell planning-view__wp-actions-cell">
                <button
                  type="button"
                  className="btn btn--primary btn--sm planning-view__wp-add-btn"
                  onClick={handleAddRow}
                  disabled={!newTitle.trim() || newWorkType == null}
                >
                  Add
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
