/**
 * CalculatorSheet — advisory productivity calculator for planning.
 * Solves for crew size or time given work quantity and a productivity rate.
 *
 * Phase 3: Shows provenance for every recommendation, side-by-side
 * source comparison, and confidence-aware output messaging.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  WorkUnit,
  WorkCategory,
  BuildPhase,
  WORK_UNIT_LABELS,
  WORK_CATEGORIES,
  WORK_CATEGORY_LABELS,
  BUILD_PHASES,
  BUILD_PHASE_LABELS,
  Task,
  formatProductivity,
  formatDurationShort,
} from '../lib/types';
import { useTemplateStore } from '../lib/stores/template-store';
import { computeWorkTypeKpis, findKpiByKey, WorkTypeKpi, WorkTypeKey, ConfidenceLevel } from '../lib/kpi';
import { buildAttributedRollup } from '../lib/attributed-rollup';
import { ActionSheet } from './ActionSheet';
import { WorkersStepper } from './WorkersStepper';
import { saveRecommendationToTask } from '../lib/calculator-save';

const WORK_UNITS: WorkUnit[] = ['m2', 'm', 'pcs', 'orders'];

type ProductivitySource = 'template' | 'historical';
type SolveFor = 'crew' | 'time';

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
  // crew mode
  crewValue?: number;
  crewExact?: number;
  // time mode
  timeFormatted?: string;
  timeHours?: number;
  // provenance
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
  if (rate <= 0 || qty <= 0) return null;

  const base = { rateUsed: rate, rateSource, quantityUsed: qty, unitUsed: workUnit, confidence, sampleCount };

  if (solveFor === 'crew') {
    if (timeHours <= 0) return null;
    const crewExact = qty / (timeHours * rate);
    return { type: 'crew', crewValue: Math.ceil(crewExact), crewExact, ...base };
  } else {
    if (crew <= 0) return null;
    const hours = qty / (crew * rate);
    const ms = hours * 3_600_000;
    return { type: 'time', timeFormatted: formatDurationShort(ms), timeHours: hours, ...base };
  }
}

interface CalculatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
}

export function CalculatorSheet({ isOpen, onClose, tasks }: CalculatorSheetProps) {
  const { templates } = useTemplateStore();

  const [workCategory, setWorkCategory] = useState<WorkCategory>('carpet-tiles');
  const [workUnit, setWorkUnit] = useState<WorkUnit>('m2');
  const [buildPhase, setBuildPhase] = useState<BuildPhase | null>(null);
  const [source, setSource] = useState<ProductivitySource>('template');
  const [quantity, setQuantity] = useState('');
  const [solveFor, setSolveFor] = useState<SolveFor>('crew');
  const [timeHours, setTimeHours] = useState('');
  const [crew, setCrew] = useState(2);

  // Save-to-task state
  const [saveTaskId, setSaveTaskId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load KPIs
  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function load() {
      const qualifying = tasks.filter(
        (t) =>
          t.status === 'completed' &&
          t.workCategory != null &&
          t.workUnit != null &&
          t.workQuantity != null &&
          t.workQuantity > 0
      );
      const { entriesByTask } = await buildAttributedRollup(qualifying, tasks);
      if (cancelled) return;
      setKpis(computeWorkTypeKpis(tasks, entriesByTask));
    }

    load();
    return () => { cancelled = true; };
  }, [isOpen, tasks]);

  // Resolve both rate sources
  const templateRate = useMemo((): RateInfo | null => {
    const match = templates.find(
      (t) =>
        t.workCategory === workCategory &&
        t.workUnit === workUnit &&
        (buildPhase == null || t.buildPhase === buildPhase) &&
        t.targetProductivity != null &&
        t.targetProductivity > 0
    );
    if (!match?.targetProductivity) return null;
    return {
      rate: match.targetProductivity,
      source: 'template',
      confidence: null,
      sampleCount: null,
      cv: null,
      templateName: match.title,
    };
  }, [templates, workCategory, workUnit, buildPhase]);

  const historicalRate = useMemo((): RateInfo | null => {
    const key: WorkTypeKey = { workCategory, workUnit, buildPhase };
    let kpi = findKpiByKey(kpis, key);
    if (!kpi && buildPhase != null) {
      kpi = findKpiByKey(kpis, { workCategory, workUnit, buildPhase: null });
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
  }, [kpis, workCategory, workUnit, buildPhase]);

  const activeRate = source === 'template' ? templateRate : historicalRate;
  const resolvedRate = activeRate?.rate ?? null;
  const isInsufficient = activeRate?.confidence === 'insufficient';

  // Compute primary result
  const qty = parseFloat(quantity);
  const timeH = parseFloat(timeHours);

  const result = useMemo(() => {
    if (!activeRate || isNaN(qty) || qty <= 0 || isInsufficient) return null;
    return computeResult(
      solveFor, qty, activeRate.rate, activeRate.source, workUnit,
      timeH, crew, activeRate.confidence, activeRate.sampleCount,
    );
  }, [activeRate, qty, solveFor, timeH, crew, workUnit, isInsufficient]);

  // Compute comparison result (other source)
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

  // Tasks eligible for saving (active, matching work type)
  const eligibleTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.status === 'active' &&
        t.workCategory === workCategory &&
        t.workUnit === workUnit
    );
  }, [tasks, workCategory, workUnit]);

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
        {/* Work Category */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Category</label>
          <select
            className="input"
            value={workCategory}
            onChange={(e) => setWorkCategory(e.target.value as WorkCategory)}
          >
            {WORK_CATEGORIES.map((c) => (
              <option key={c} value={c}>{WORK_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        {/* Work Unit */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Work Unit</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Unit">
            {WORK_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={workUnit === u}
                className={`task-work-quantity__unit-pill${workUnit === u ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setWorkUnit(u)}
              >
                {WORK_UNIT_LABELS[u]}
              </button>
            ))}
          </div>
        </div>

        {/* Build Phase */}
        <div className="create-task-sheet__section">
          <label className="entry-modal__label">Build Phase</label>
          <div className="task-work-quantity__unit-pills" role="group" aria-label="Build phase">
            <button
              type="button"
              role="radio"
              aria-checked={buildPhase === null}
              className={`task-work-quantity__unit-pill${buildPhase === null ? ' task-work-quantity__unit-pill--active' : ''}`}
              onClick={() => setBuildPhase(null)}
            >
              Any
            </button>
            {BUILD_PHASES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={buildPhase === p}
                className={`task-work-quantity__unit-pill${buildPhase === p ? ' task-work-quantity__unit-pill--active' : ''}`}
                onClick={() => setBuildPhase(p)}
              >
                {BUILD_PHASE_LABELS[p]}
              </button>
            ))}
          </div>
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
              Template Target
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
                ? 'Select a productivity source with data'
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
                label={source === 'template' ? 'Template Target' : 'Historical Avg'}
                rate={activeRate!}
                result={result}
                workUnit={workUnit}
                isActive
              />
              <CompareCard
                label={source === 'template' ? 'Historical Avg' : 'Template Target'}
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
    ? `Template${activeRate.templateName ? `: ${activeRate.templateName}` : ''}`
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
