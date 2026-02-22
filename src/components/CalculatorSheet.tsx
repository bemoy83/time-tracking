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
import { computeWorkTypeKpis, findKpiByKey, WorkTypeKpi, WorkTypeKey, ConfidenceLevel } from '../lib/kpi';
import { buildAttributedRollup } from '../lib/attributed-rollup';
import { computeProductivityResult, type SolveFor } from '../lib/calculator';
import { ActionSheet } from './ActionSheet';
import { WorkersStepper } from './WorkersStepper';
import { saveRecommendationToTask } from '../lib/calculator-save';

type ProductivitySource = 'template' | 'historical';

interface RateInfo {
  rate: number;
  source: ProductivitySource;
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

interface CalculatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
}

export function CalculatorSheet({ isOpen, onClose, tasks }: CalculatorSheetProps) {
  const { workTypes } = useWorkTypeStore();

  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');
  const [source, setSource] = useState<ProductivitySource>('template');
  const [quantity, setQuantity] = useState('');
  const [solveFor, setSolveFor] = useState<SolveFor>('crew');
  const [timeHours, setTimeHours] = useState('');
  const [crew, setCrew] = useState(2);

  const [saveTaskId, setSaveTaskId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);

  // Default selection when opening
  useEffect(() => {
    if (isOpen && workTypes.length > 0 && !selectedWorkTypeId) {
      setSelectedWorkTypeId(workTypes[0].id);
    }
  }, [isOpen, workTypes]);

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
          (t.workTypeId != null || t.workCategory != null)
      );
      const { entriesByTask } = await buildAttributedRollup(qualifying, tasks);
      if (cancelled) return;
      setKpis(computeWorkTypeKpis(tasks, entriesByTask, { workTypes, archiveOnly: true }));
    }

    load();
    return () => { cancelled = true; };
  }, [isOpen, tasks, workTypes]);

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

  const activeRate = source === 'template' ? templateRate : historicalRate;
  const resolvedRate = activeRate?.rate ?? null;
  const isInsufficient = activeRate?.confidence === 'insufficient';

  const qty = parseFloat(quantity);
  const timeH = parseFloat(timeHours);

  const result = useMemo(() => {
    if (!activeRate || isNaN(qty) || qty <= 0 || isInsufficient) return null;
    return computeResult(
      solveFor, qty, activeRate.rate, activeRate.source, workUnit,
      timeH, crew, activeRate.confidence, activeRate.sampleCount,
    );
  }, [activeRate, qty, solveFor, timeH, crew, workUnit, isInsufficient]);

  const altRate = source === 'template' ? historicalRate : templateRate;
  const altResult = useMemo(() => {
    if (!altRate || isNaN(qty) || qty <= 0) return null;
    if (altRate.confidence === 'insufficient') return null;
    return computeResult(
      solveFor, qty, altRate.rate, altRate.source, workUnit,
      timeH, crew, altRate.confidence, altRate.sampleCount,
    );
  }, [altRate, qty, solveFor, timeH, crew, workUnit]);

  const hasBothSources = templateRate != null && historicalRate != null && historicalRate.confidence !== 'insufficient';

  const eligibleTasks = useMemo(() => {
    if (!selectedWorkType) return [];
    return tasks.filter(
      (t) =>
        t.status === 'active' &&
        t.workTypeId === selectedWorkTypeId
    );
  }, [tasks, selectedWorkTypeId, selectedWorkType]);

  const handleSave = async () => {
    if (!result || !saveTaskId || !activeRate) return;
    setSaveStatus('saving');
    try {
      await saveRecommendationToTask({
        taskId: saveTaskId,
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
      });
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

        {/* Save to task */}
        {result != null && eligibleTasks.length > 0 && (
          <div className="create-task-sheet__section">
            <label className="entry-modal__label">Apply to Task</label>
            <div className="calculator__save-row">
              <select
                className="input calculator__save-select"
                value={saveTaskId}
                onChange={(e) => { setSaveTaskId(e.target.value); setSaveStatus('idle'); }}
              >
                <option value="">Select a task...</option>
                {eligibleTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={!saveTaskId || saveStatus === 'saving'}
                onClick={handleSave}
              >
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Save'}
              </button>
            </div>
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

function ProvenanceDisplay({
  result,
  activeRate,
  workUnit,
}: {
  result: CalcResult;
  activeRate: RateInfo;
  workUnit: WorkUnit;
}) {
  const sourceLabel = result.rateSource === 'template'
    ? `Expected${activeRate.templateName ? `: ${activeRate.templateName}` : ''}`
    : `Historical avg (${activeRate.sampleCount} tasks)`;

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
