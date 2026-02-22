/**
 * CalculatorSheet — advisory productivity calculator for planning.
 * Solves for crew size or time given work quantity and a productivity rate.
 *
 * Uses WorkType selector for expected rate. Historical rate from KPIs.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  WorkUnit,
  WORK_UNIT_LABELS,
  BUILD_PHASE_LABELS,
  Task,
  formatProductivity,
  formatDurationShort,
} from '../lib/types';
import { useWorkTypeStore } from '../lib/stores/work-type-store';
import { computeWorkTypeKpis, findKpiByKey, type OutlierHandlingMode, WorkTypeKpi, WorkTypeKey, ConfidenceLevel } from '../lib/kpi';
import { buildAttributedRollup } from '../lib/attributed-rollup';
import { computeProductivityResult, type SolveFor } from '../lib/calculator';
import {
  MAX_SCENARIOS,
  addScenario,
  canRemoveScenario,
  computeAllScenarios,
  createDefaultScenarios,
  removeScenario,
  selectScenario,
  updateScenario,
  validationReasonLabel,
  type CalculatorScenario,
  type ScenarioComputed,
} from '../lib/calculator-scenarios';
import { ActionSheet } from './ActionSheet';
import { WorkersStepper } from './WorkersStepper';
import { saveRecommendationToTask, saveRecommendationToTemplate } from '../lib/calculator-save';
import { useTemplateStore } from '../lib/stores/template-store';
import { trackTelemetryEvent } from '../lib/telemetry/telemetry';
import { getFeatureFlag } from '../lib/flags/feature-flags';

type ProductivitySource = 'template' | 'historical' | 'manual';

interface RateInfo {
  rate: number;
  source: 'template' | 'historical';
  confidence: ConfidenceLevel | null;
  sampleCount: number | null;
  cv: number | null;
  templateName: string | null;
}

interface CalcResult {
  type: SolveFor;
  crewValue?: number;
  crewExact?: number;
  timeFormatted?: string;
  timeHours?: number;
  rateUsed: number;
  rateSource: ProductivitySource;
  quantityUsed: number;
  unitUsed: WorkUnit;
  confidence: ConfidenceLevel | null;
  sampleCount: number | null;
}

function computeResult(
  solveFor: SolveFor,
  qty: number,
  rate: number,
  rateSource: ProductivitySource,
  workUnit: WorkUnit,
  timeHours: number,
  crew: number,
  confidence: ConfidenceLevel | null,
  sampleCount: number | null,
): CalcResult | null {
  const raw = computeProductivityResult(solveFor, qty, rate, timeHours, crew);
  if (!raw) return null;

  const base = { rateUsed: rate, rateSource, quantityUsed: qty, unitUsed: workUnit, confidence, sampleCount };

  if (solveFor === 'crew') {
    return { type: 'crew', crewValue: raw.crew, crewExact: raw.crewExact, ...base };
  }
  const ms = (raw.timeHours ?? 0) * 3_600_000;
  return { type: 'time', timeFormatted: formatDurationShort(ms), timeHours: raw.timeHours, ...base };
}

function toCalcResult(computed: ScenarioComputed | null): CalcResult | null {
  if (!computed || !computed.isValid) return null;
  if (computed.resultType == null || computed.rateUsed == null || computed.rateSource == null || computed.quantityUsed == null) {
    return null;
  }

  if (computed.resultType === 'crew') {
    return {
      type: 'crew',
      crewValue: computed.crewValue ?? undefined,
      crewExact: computed.crewExact ?? undefined,
      rateUsed: computed.rateUsed,
      rateSource: computed.rateSource,
      quantityUsed: computed.quantityUsed,
      unitUsed: computed.workUnit,
      confidence: computed.confidence,
      sampleCount: computed.sampleCount,
    };
  }

  const timeHours = computed.timeHours ?? (computed.estimatedMinutes != null ? computed.estimatedMinutes / 60 : undefined);
  return {
    type: 'time',
    timeHours,
    timeFormatted: timeHours != null ? formatDurationShort(timeHours * 3_600_000) : undefined,
    rateUsed: computed.rateUsed,
    rateSource: computed.rateSource,
    quantityUsed: computed.quantityUsed,
    unitUsed: computed.workUnit,
    confidence: computed.confidence,
    sampleCount: computed.sampleCount,
  };
}

interface CalculatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  outlierMode: OutlierHandlingMode;
}

export function CalculatorSheet({ isOpen, onClose, tasks, outlierMode }: CalculatorSheetProps) {
  const { workTypes } = useWorkTypeStore();
  const { templates } = useTemplateStore();
  const multiScenarioEnabled = getFeatureFlag('calculatorMultiScenarioCards');

  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');

  // Legacy calculator state (flag fallback)
  const [source, setSource] = useState<'template' | 'historical'>('template');
  const [quantity, setQuantity] = useState('');
  const [solveFor, setSolveFor] = useState<SolveFor>('crew');
  const [timeHours, setTimeHours] = useState('');
  const [crew, setCrew] = useState(2);

  // Multi-scenario state
  const [scenarios, setScenarios] = useState<CalculatorScenario[]>(createDefaultScenarios);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');

  const [saveTargetId, setSaveTargetId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);

  // Default selection when opening
  useEffect(() => {
    if (isOpen && workTypes.length > 0 && !selectedWorkTypeId) {
      setSelectedWorkTypeId(workTypes[0].id);
    }
  }, [isOpen, workTypes, selectedWorkTypeId]);

  // Re-seed scenarios for each open + work type change to avoid stale mismatches.
  useEffect(() => {
    if (!isOpen) return;
    const seeded = createDefaultScenarios();
    setScenarios(seeded);
    setSelectedScenarioId(seeded[0]?.id ?? '');
    setSaveStatus('idle');
  }, [isOpen, selectedWorkTypeId]);

  // Keep selected scenario valid when cards are added/removed.
  useEffect(() => {
    if (!multiScenarioEnabled) return;
    const resolvedId = selectScenario(scenarios, selectedScenarioId);
    if (resolvedId !== selectedScenarioId) {
      setSelectedScenarioId(resolvedId);
    }
  }, [multiScenarioEnabled, scenarios, selectedScenarioId]);

  // Load KPIs
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function load() {
      const qualifying = tasks.filter(
        (t) =>
          t.status === 'completed' &&
          t.workUnit != null &&
          t.workQuantity != null &&
          t.workQuantity > 0 &&
          t.workTypeId != null,
      );
      const { entriesByTask } = await buildAttributedRollup(qualifying, tasks);
      if (cancelled) return;
      setKpis(computeWorkTypeKpis(tasks, entriesByTask, {
        workTypes,
        archiveOnly: true,
        outlierMode,
      }));
    }

    load();
    return () => { cancelled = true; };
  }, [isOpen, tasks, workTypes, outlierMode]);

  const selectedWorkType = workTypes.find((wt) => wt.id === selectedWorkTypeId);
  const workUnit = selectedWorkType?.workUnit ?? 'm2';

  // Template rate from WorkType expected productivity
  const templateRate = useMemo((): RateInfo | null => {
    if (!selectedWorkType) return null;
    return {
      rate: selectedWorkType.expectedProductivity,
      source: 'template',
      confidence: null,
      sampleCount: null,
      cv: null,
      templateName: selectedWorkType.title,
    };
  }, [selectedWorkType]);

  // Historical rate from KPI data
  const historicalRate = useMemo((): RateInfo | null => {
    if (!selectedWorkType) return null;
    const key: WorkTypeKey = {
      workTypeId: selectedWorkType.id,
      workTypeTitle: selectedWorkType.title,
      workUnit: selectedWorkType.workUnit,
      buildPhase: selectedWorkType.buildPhase,
    };
    let kpi = findKpiByKey(kpis, key);
    if (!kpi) {
      kpi = findKpiByKey(kpis, { ...key, buildPhase: null });
    }
    if (!kpi) return null;
    return {
      rate: kpi.avgProductivity,
      source: 'historical',
      confidence: kpi.confidence,
      sampleCount: kpi.sampleCount,
      cv: kpi.cv,
      templateName: null,
    };
  }, [kpis, selectedWorkType]);

  // --- Legacy single-scenario result path ---
  const activeRate = source === 'template' ? templateRate : historicalRate;
  const resolvedRate = activeRate?.rate ?? null;
  const isInsufficient = activeRate?.confidence === 'insufficient';

  const qty = parseFloat(quantity);
  const timeH = parseFloat(timeHours);

  const result = useMemo(() => {
    if (!activeRate || isNaN(qty) || qty <= 0 || isInsufficient) return null;
    return computeResult(
      solveFor,
      qty,
      activeRate.rate,
      activeRate.source,
      workUnit,
      timeH,
      crew,
      activeRate.confidence,
      activeRate.sampleCount,
    );
  }, [activeRate, qty, solveFor, timeH, crew, workUnit, isInsufficient]);

  const altRate = source === 'template' ? historicalRate : templateRate;
  const altResult = useMemo(() => {
    if (!altRate || isNaN(qty) || qty <= 0) return null;
    if (altRate.confidence === 'insufficient') return null;
    return computeResult(
      solveFor,
      qty,
      altRate.rate,
      altRate.source,
      workUnit,
      timeH,
      crew,
      altRate.confidence,
      altRate.sampleCount,
    );
  }, [altRate, qty, solveFor, timeH, crew, workUnit]);

  const hasBothSources = templateRate != null && historicalRate != null && historicalRate.confidence !== 'insufficient';

  // --- Multi-scenario computed path ---
  const computedScenarios = useMemo(() => computeAllScenarios(scenarios, {
    workUnit,
    templateRate: templateRate?.rate ?? null,
    templateName: templateRate?.templateName ?? null,
    historicalRate: historicalRate?.rate ?? null,
    historicalConfidence: historicalRate?.confidence ?? null,
    historicalSampleCount: historicalRate?.sampleCount ?? null,
  }), [scenarios, workUnit, templateRate, historicalRate]);

  const selectedScenarioComputed = useMemo(
    () => computedScenarios.find((computed) => computed.scenario.id === selectedScenarioId) ?? computedScenarios[0] ?? null,
    [computedScenarios, selectedScenarioId],
  );
  const selectedScenarioResult = useMemo(() => toCalcResult(selectedScenarioComputed), [selectedScenarioComputed]);

  const effectiveResult = multiScenarioEnabled ? selectedScenarioResult : result;

  const eligibleTasks = useMemo(() => {
    if (!selectedWorkType) return [];
    return tasks.filter(
      (t) =>
        t.status === 'active' &&
        t.workTypeId === selectedWorkTypeId,
    );
  }, [tasks, selectedWorkTypeId, selectedWorkType]);

  const eligibleTemplates = useMemo(() => {
    if (!selectedWorkType) return [];
    return templates.filter((template) => template.workTypeId === selectedWorkTypeId);
  }, [templates, selectedWorkType, selectedWorkTypeId]);

  useEffect(() => {
    const targetOptions = [
      ...eligibleTasks.map((task) => `task:${task.id}`),
      ...eligibleTemplates.map((template) => `template:${template.id}`),
    ];
    if (targetOptions.length === 0) {
      if (saveTargetId !== '') setSaveTargetId('');
      return;
    }
    if (saveTargetId === '' || !targetOptions.includes(saveTargetId)) {
      setSaveTargetId(targetOptions[0]);
    }
  }, [eligibleTasks, eligibleTemplates, saveTargetId]);

  const handleAddScenario = () => {
    setScenarios((previous) => {
      const next = addScenario(previous);
      if (next.length > previous.length) {
        const added = next.find((scenario) => !previous.some((candidate) => candidate.id === scenario.id));
        if (added) {
          setSelectedScenarioId(added.id);
        }
        trackTelemetryEvent('calculator_scenario_add');
      }
      return next;
    });
  };

  const handleRemoveScenario = (id: string) => {
    setScenarios((previous) => {
      const next = removeScenario(previous, id);
      if (next.length < previous.length) {
        setSelectedScenarioId((current) => selectScenario(next, current === id ? '' : current));
        trackTelemetryEvent('calculator_scenario_remove');
      }
      return next;
    });
  };

  const handleSelectScenario = (id: string) => {
    setSelectedScenarioId((previous) => {
      if (previous === id) return previous;
      trackTelemetryEvent('calculator_scenario_select');
      return id;
    });
  };

  const handleScenarioPatch = (
    id: string,
    patch: Partial<Omit<CalculatorScenario, 'id' | 'label'>>,
  ) => {
    setScenarios((previous) => updateScenario(previous, id, patch));
    setSaveStatus('idle');
  };

  const multiScenarioSaveBlockedReason = multiScenarioEnabled && selectedScenarioComputed && !selectedScenarioComputed.isValid
    ? validationReasonLabel(selectedScenarioComputed.validationReason)
    : null;

  const isSaveDisabled = !saveTargetId || saveStatus === 'saving' || (multiScenarioEnabled ? effectiveResult == null : result == null);

  const handleSave = async () => {
    if (!saveTargetId) return;

    const [targetType, targetId] = saveTargetId.split(':', 2);

    if (multiScenarioEnabled) {
      if (!selectedScenarioComputed || !selectedScenarioComputed.isValid || !selectedScenarioResult) return;

      const payload = {
        type: selectedScenarioResult.type,
        crewValue: selectedScenarioResult.crewValue,
        estimatedMinutes: selectedScenarioResult.type === 'time' && selectedScenarioResult.timeHours != null
          ? Math.round(selectedScenarioResult.timeHours * 60)
          : undefined,
        rateUsed: selectedScenarioResult.rateUsed,
        rateSource: selectedScenarioResult.rateSource,
        workUnit: selectedScenarioResult.unitUsed,
        quantityUsed: selectedScenarioResult.quantityUsed,
        sampleCount: selectedScenarioResult.sampleCount,
      } as const;

      setSaveStatus('saving');
      try {
        if (targetType === 'template') {
          await saveRecommendationToTemplate({ templateId: targetId, ...payload });
          trackTelemetryEvent('calculator_save_template');
        } else {
          await saveRecommendationToTask({ taskId: targetId, ...payload });
          trackTelemetryEvent('calculator_save_task');
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
      return;
    }

    if (!result || !activeRate) return;

    setSaveStatus('saving');
    try {
      const payload = {
        type: result.type,
        crewValue: result.crewValue,
        estimatedMinutes: result.type === 'time' && result.timeHours != null
          ? Math.round(result.timeHours * 60)
          : undefined,
        rateUsed: result.rateUsed,
        rateSource: result.rateSource,
        workUnit: result.unitUsed,
        quantityUsed: result.quantityUsed,
        sampleCount: result.sampleCount,
      } as const;

      if (targetType === 'template') {
        await saveRecommendationToTemplate({
          templateId: targetId,
          ...payload,
        });
        trackTelemetryEvent('calculator_save_template');
      } else {
        await saveRecommendationToTask({
          taskId: targetId,
          ...payload,
        });
        trackTelemetryEvent('calculator_save_task');
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  return (
    <ActionSheet isOpen={isOpen} title="Productivity Calculator" onClose={onClose}>
      <div className="create-task-sheet__form">
        {/* Work Type Selector */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Type</label>
          {workTypes.length === 0 ? (
            <p className="settings-view__empty">No work types defined.</p>
          ) : (
            <select
              className="input"
              value={selectedWorkTypeId}
              onChange={(e) => setSelectedWorkTypeId(e.target.value)}
            >
              {workTypes.map((wt) => (
                <option key={wt.id} value={wt.id}>
                  {wt.title} · {WORK_UNIT_LABELS[wt.workUnit]} · {BUILD_PHASE_LABELS[wt.buildPhase]}
                </option>
              ))}
            </select>
          )}
        </div>

        {multiScenarioEnabled ? (
          <>
            <div className="create-task-sheet__section">
              <div className="calculator__scenario-header">
                <label className="entry-modal__label">Scenarios</label>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={scenarios.length >= MAX_SCENARIOS}
                  onClick={handleAddScenario}
                >
                  Add Scenario
                </button>
              </div>
              {scenarios.length >= MAX_SCENARIOS && (
                <p className="settings-view__helper">Maximum of 4 scenarios reached.</p>
              )}
              <div className="calculator__scenario-grid">
                {computedScenarios.map((computed) => (
                  <ScenarioCard
                    key={computed.scenario.id}
                    computed={computed}
                    selected={computed.scenario.id === selectedScenarioId}
                    onSelect={() => handleSelectScenario(computed.scenario.id)}
                    onRemove={canRemoveScenario(computed.scenario) ? () => handleRemoveScenario(computed.scenario.id) : null}
                    onPatch={(patch) => handleScenarioPatch(computed.scenario.id, patch)}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Productivity Source */}
            <div className="create-task-sheet__section">
              <label className="entry-modal__label">Productivity Source</label>
              <div className="task-work-quantity__unit-pills" role="group" aria-label="Source">
                <button
                  type="button"
                  role="radio"
                  aria-checked={source === 'template'}
                  className={`task-work-quantity__unit-pill${source === 'template' ? ' task-work-quantity__unit-pill--active' : ''}`}
                  onClick={() => setSource('template')}
                >
                  Expected Rate
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={source === 'historical'}
                  className={`task-work-quantity__unit-pill${source === 'historical' ? ' task-work-quantity__unit-pill--active' : ''}`}
                  onClick={() => setSource('historical')}
                >
                  Historical Avg
                </button>
              </div>
              <div className="calculator__rate">
                {resolvedRate != null
                  ? formatProductivity(resolvedRate, workUnit)
                  : 'No data'}
                {activeRate?.confidence != null && (
                  <span className={`kpi-badge kpi-badge--${activeRate.confidence}`} style={{ marginLeft: 8 }}>
                    {activeRate.confidence === 'insufficient'
                      ? 'Insufficient data'
                      : `${activeRate.confidence} · ${activeRate.sampleCount} tasks`}
                  </span>
                )}
              </div>
            </div>

            {/* Work Quantity */}
            <div className="create-task-sheet__section">
              <label className="entry-modal__label">Work Quantity</label>
              <div className="task-work-quantity__input-wrap">
                <input
                  inputMode="decimal"
                  className="task-work-quantity__number-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  style={{ width: `${Math.max(String(quantity || '0').length, 1)}ch` }}
                />
                <span className="task-work-quantity__input-unit" aria-hidden="true">
                  {WORK_UNIT_LABELS[workUnit]}
                </span>
              </div>
            </div>

            {/* Solve For */}
            <div className="create-task-sheet__section">
              <label className="entry-modal__label">Solve For</label>
              <div className="task-work-quantity__unit-pills" role="group" aria-label="Solve for">
                <button
                  type="button"
                  role="radio"
                  aria-checked={solveFor === 'crew'}
                  className={`task-work-quantity__unit-pill${solveFor === 'crew' ? ' task-work-quantity__unit-pill--active' : ''}`}
                  onClick={() => setSolveFor('crew')}
                >
                  Crew Size
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={solveFor === 'time'}
                  className={`task-work-quantity__unit-pill${solveFor === 'time' ? ' task-work-quantity__unit-pill--active' : ''}`}
                  onClick={() => setSolveFor('time')}
                >
                  Time
                </button>
              </div>
            </div>

            {/* Known Value */}
            {solveFor === 'crew' ? (
              <div className="create-task-sheet__section">
                <label className="entry-modal__label">Available Time (hours)</label>
                <div className="task-work-quantity__input-wrap">
                  <input
                    inputMode="decimal"
                    className="task-work-quantity__number-input"
                    value={timeHours}
                    onChange={(e) => setTimeHours(e.target.value)}
                    placeholder="0"
                    style={{ width: `${Math.max(String(timeHours || '0').length, 1)}ch` }}
                  />
                  <span className="task-work-quantity__input-unit" aria-hidden="true">hrs</span>
                </div>
              </div>
            ) : (
              <div className="create-task-sheet__section">
                <label className="entry-modal__label">Crew Size</label>
                <WorkersStepper value={crew} onChange={setCrew} size="large" />
              </div>
            )}

            {/* Result */}
            <div className="calculator__result">
              {result == null ? (
                <span className="calculator__result-empty">
                  {resolvedRate == null
                    ? 'Select a work type with data'
                    : isInsufficient
                      ? 'Insufficient data — need 3+ completed tasks for this work type'
                      : 'Enter values to calculate'}
                </span>
              ) : (
                <>
                  <ResultDisplay result={result} />
                  <ProvenanceDisplay result={result} activeRate={activeRate!} workUnit={workUnit} />
                </>
              )}
            </div>

            {/* Side-by-side comparison */}
            {hasBothSources && result != null && altResult != null && (
              <div className="calculator__compare">
                <span className="calculator__compare-label">Compare sources</span>
                <div className="calculator__compare-grid">
                  <CompareCard
                    label={source === 'template' ? 'Expected Rate' : 'Historical Avg'}
                    rate={activeRate!}
                    result={result}
                    workUnit={workUnit}
                    isActive
                  />
                  <CompareCard
                    label={source === 'template' ? 'Historical Avg' : 'Expected Rate'}
                    rate={altRate!}
                    result={altResult}
                    workUnit={workUnit}
                    isActive={false}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Save target */}
        {(effectiveResult != null || (multiScenarioEnabled && selectedScenarioComputed != null))
          && (eligibleTasks.length > 0 || eligibleTemplates.length > 0) && (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">Apply to Task or Template</label>
            <div className="calculator__save-row">
              <select
                className="input calculator__save-select"
                value={saveTargetId}
                onChange={(e) => { setSaveTargetId(e.target.value); setSaveStatus('idle'); }}
              >
                <option value="">Select target...</option>
                {eligibleTasks.length > 0 && (
                  <optgroup label="Tasks">
                    {eligibleTasks.map((t) => (
                      <option key={t.id} value={`task:${t.id}`}>{t.title}</option>
                    ))}
                  </optgroup>
                )}
                {eligibleTemplates.length > 0 && (
                  <optgroup label="Templates">
                    {eligibleTemplates.map((template) => (
                      <option key={template.id} value={`template:${template.id}`}>{template.title}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={isSaveDisabled}
                onClick={handleSave}
              >
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Save'}
              </button>
            </div>
            {multiScenarioSaveBlockedReason && (
              <p className="calculator__save-warning">Selected scenario is not computable: {multiScenarioSaveBlockedReason}</p>
            )}
          </div>
        )}

        {/* Close */}
        <div className="action-sheet__actions">
          <div className="action-sheet__actions-right">
            <button type="button" className="btn btn--secondary btn--lg" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </ActionSheet>
  );
}

function ResultDisplay({ result }: { result: CalcResult }) {
  if (result.type === 'crew') {
    return (
      <>
        <span className="calculator__result-value">{result.crewValue}</span>
        <span className="calculator__result-label">
          {result.crewValue === 1 ? 'worker' : 'workers'} needed
          <span className="calculator__advisory"> (advisory)</span>
        </span>
      </>
    );
  }
  return (
    <>
      <span className="calculator__result-value">{result.timeFormatted}</span>
      <span className="calculator__result-label">
        estimated duration
        <span className="calculator__advisory"> (advisory)</span>
      </span>
    </>
  );
}

function sourceLabelFromResult(result: CalcResult, activeRate: RateInfo): string {
  if (result.rateSource === 'template') {
    return `Expected${activeRate.templateName ? `: ${activeRate.templateName}` : ''}`;
  }
  if (result.rateSource === 'historical') {
    return `Historical avg (${activeRate.sampleCount} tasks)`;
  }
  return 'Manual rate';
}

function ProvenanceDisplay({
  result,
  activeRate,
  workUnit,
}: {
  result: CalcResult;
  activeRate: RateInfo;
  workUnit: WorkUnit;
}) {
  const sourceLabel = sourceLabelFromResult(result, activeRate);

  const equation = result.type === 'crew'
    ? `${result.quantityUsed} ${WORK_UNIT_LABELS[workUnit]} / (time × ${formatProductivity(result.rateUsed, workUnit)})`
    : `${result.quantityUsed} ${WORK_UNIT_LABELS[workUnit]} / (crew × ${formatProductivity(result.rateUsed, workUnit)})`;

  return (
    <div className="calculator__provenance">
      <span className="calculator__provenance-item">Source: {sourceLabel}</span>
      <span className="calculator__provenance-item">Rate: {formatProductivity(result.rateUsed, workUnit)}</span>
      <span className="calculator__provenance-item">Equation: {equation}</span>
      {result.confidence != null && result.confidence !== 'high' && (
        <span className="calculator__provenance-item calculator__provenance-warning">
          {result.confidence === 'low'
            ? 'Low confidence — limited historical data'
            : result.confidence === 'medium'
              ? 'Medium confidence — more data will improve accuracy'
              : ''}
        </span>
      )}
    </div>
  );
}

function CompareCard({
  label,
  rate,
  result,
  workUnit,
  isActive,
}: {
  label: string;
  rate: RateInfo;
  result: CalcResult;
  workUnit: WorkUnit;
  isActive: boolean;
}) {
  const value = result.type === 'crew'
    ? `${result.crewValue} ${result.crewValue === 1 ? 'worker' : 'workers'}`
    : result.timeFormatted!;

  return (
    <div className={`calculator__compare-card${isActive ? ' calculator__compare-card--active' : ''}`}>
      <span className="calculator__compare-card-label">{label}</span>
      <span className="calculator__compare-card-value">{value}</span>
      <span className="calculator__compare-card-rate">{formatProductivity(rate.rate, workUnit)}</span>
      {rate.confidence != null && (
        <span className={`kpi-badge kpi-badge--${rate.confidence}`}>
          {rate.confidence}
        </span>
      )}
    </div>
  );
}

function ScenarioCard({
  computed,
  selected,
  onSelect,
  onRemove,
  onPatch,
}: {
  computed: ScenarioComputed;
  selected: boolean;
  onSelect: () => void;
  onRemove: (() => void) | null;
  onPatch: (patch: Partial<Omit<CalculatorScenario, 'id' | 'label'>>) => void;
}) {
  const { scenario, workUnit } = computed;
  const scenarioResult = toCalcResult(computed);

  return (
    <div className={`calculator__scenario-card${selected ? ' calculator__scenario-card--selected' : ''}`}>
      <div className="calculator__scenario-card-header">
        <button
          type="button"
          className={`calculator__scenario-select${selected ? ' calculator__scenario-select--active' : ''}`}
          onClick={onSelect}
        >
          {scenario.label}
          {selected ? ' (Selected)' : ''}
        </button>
        {onRemove && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onRemove}
            aria-label={`Remove ${scenario.label}`}
          >
            Remove
          </button>
        )}
      </div>

      <div className="calculator__scenario-body">
        <label className="entry-modal__label">Rate Source</label>
        <div className="task-work-quantity__unit-pills" role="group" aria-label={`${scenario.label} rate source`}>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.rateMode === 'template'}
            className={`task-work-quantity__unit-pill${scenario.rateMode === 'template' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ rateMode: 'template' })}
          >
            Expected
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.rateMode === 'historical'}
            className={`task-work-quantity__unit-pill${scenario.rateMode === 'historical' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ rateMode: 'historical' })}
          >
            Historical
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.rateMode === 'manual'}
            className={`task-work-quantity__unit-pill${scenario.rateMode === 'manual' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ rateMode: 'manual' })}
          >
            Manual
          </button>
        </div>

        {scenario.rateMode === 'manual' && (
          <div>
            <label className="entry-modal__label">Manual Rate</label>
            <div className="task-work-quantity__input-wrap">
              <input
                inputMode="decimal"
                className="task-work-quantity__number-input"
                value={scenario.manualRate}
                onChange={(e) => onPatch({ manualRate: e.target.value })}
                placeholder="0"
                style={{ width: `${Math.max(String(scenario.manualRate || '0').length, 1)}ch` }}
              />
              <span className="task-work-quantity__input-unit" aria-hidden="true">
                {WORK_UNIT_LABELS[workUnit]}/p-hr
              </span>
            </div>
          </div>
        )}

        <label className="entry-modal__label">Solve For</label>
        <div className="task-work-quantity__unit-pills" role="group" aria-label={`${scenario.label} solve for`}>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.solveFor === 'crew'}
            className={`task-work-quantity__unit-pill${scenario.solveFor === 'crew' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ solveFor: 'crew' })}
          >
            Crew
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scenario.solveFor === 'time'}
            className={`task-work-quantity__unit-pill${scenario.solveFor === 'time' ? ' task-work-quantity__unit-pill--active' : ''}`}
            onClick={() => onPatch({ solveFor: 'time' })}
          >
            Time
          </button>
        </div>

        <label className="entry-modal__label">Work Quantity</label>
        <div className="task-work-quantity__input-wrap">
          <input
            inputMode="decimal"
            className="task-work-quantity__number-input"
            value={scenario.quantity}
            onChange={(e) => onPatch({ quantity: e.target.value })}
            placeholder="0"
            style={{ width: `${Math.max(String(scenario.quantity || '0').length, 1)}ch` }}
          />
          <span className="task-work-quantity__input-unit" aria-hidden="true">
            {WORK_UNIT_LABELS[workUnit]}
          </span>
        </div>

        {scenario.solveFor === 'crew' ? (
          <div>
            <label className="entry-modal__label">Available Time (hours)</label>
            <div className="task-work-quantity__input-wrap">
              <input
                inputMode="decimal"
                className="task-work-quantity__number-input"
                value={scenario.timeHours}
                onChange={(e) => onPatch({ timeHours: e.target.value })}
                placeholder="0"
                style={{ width: `${Math.max(String(scenario.timeHours || '0').length, 1)}ch` }}
              />
              <span className="task-work-quantity__input-unit" aria-hidden="true">hrs</span>
            </div>
          </div>
        ) : (
          <div>
            <label className="entry-modal__label">Crew Size</label>
            <WorkersStepper value={scenario.crew} onChange={(nextCrew) => onPatch({ crew: nextCrew })} size="compact" />
          </div>
        )}

        <div className="calculator__scenario-result">
          {scenarioResult ? (
            <>
              <ResultDisplay result={scenarioResult} />
              <span className="calculator__scenario-provenance">
                Source: {scenarioResult.rateSource === 'template' ? 'Expected' : scenarioResult.rateSource === 'historical' ? `Historical (${computed.sampleCount ?? 0} tasks)` : 'Manual'}
                {' · '}
                Rate: {formatProductivity(scenarioResult.rateUsed, workUnit)}
              </span>
              {scenarioResult.confidence != null && scenarioResult.confidence !== 'high' && (
                <span className="calculator__scenario-warning">
                  {scenarioResult.confidence === 'low'
                    ? 'Low confidence historical data'
                    : scenarioResult.confidence === 'medium'
                      ? 'Medium confidence historical data'
                      : ''}
                </span>
              )}
            </>
          ) : (
            <span className="calculator__scenario-invalid">
              {validationReasonLabel(computed.validationReason)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
