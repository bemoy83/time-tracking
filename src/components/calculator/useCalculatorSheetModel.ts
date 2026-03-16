import { useEffect, useMemo, useState } from 'react';
import { buildAttributedRollup } from '../../lib/attributed-rollup';
import {
  saveRecommendationToTask,
  saveRecommendationToTemplate,
} from '../../lib/calculator-save';
import {
  computeWorkTypeKpis,
  findKpiByKey,
  type OutlierHandlingMode,
  type WorkTypeKpi,
  type WorkTypeKey,
} from '../../lib/kpi';
import { useTemplateStore } from '../../lib/stores/template-store';
import { useWorkTypeStore } from '../../lib/stores/work-type-store';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';
import type { SolveFor } from '../../lib/calculator';
import type { Task, WorkUnit } from '../../lib/types';
import { computeResult } from './result-utils';
import type { CalcResult, ProductivitySource, RateInfo } from './types';

interface UseCalculatorSheetModelArgs {
  isOpen: boolean;
  tasks: Task[];
  outlierMode: OutlierHandlingMode;
}

type SaveTargetType = 'task' | 'template';

type SavePayload = {
  type: SolveFor;
  crewValue: number | undefined;
  estimatedMinutes: number | undefined;
  rateUsed: number;
  rateSource: ProductivitySource;
  workUnit: WorkUnit;
  quantityUsed: number;
  sampleCount: number | null;
};

function buildSavePayload(result: CalcResult): SavePayload {
  return {
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
  };
}

function parseSaveTarget(saveTargetId: string): { targetType: SaveTargetType; targetId: string } | null {
  if (!saveTargetId) return null;
  const [targetType, targetId] = saveTargetId.split(':', 2);
  if ((targetType !== 'task' && targetType !== 'template') || !targetId) return null;
  return { targetType, targetId };
}

async function saveRecommendation(
  targetType: SaveTargetType,
  targetId: string,
  payload: SavePayload,
): Promise<void> {
  if (targetType === 'template') {
    await saveRecommendationToTemplate({ templateId: targetId, ...payload });
    trackTelemetryEvent('calculator_save_template');
    return;
  }

  await saveRecommendationToTask({ taskId: targetId, ...payload });
  trackTelemetryEvent('calculator_save_task');
}

export function useCalculatorSheetModel({ isOpen, tasks, outlierMode }: UseCalculatorSheetModelArgs) {
  const { workTypes } = useWorkTypeStore();
  const { templates } = useTemplateStore();

  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');

  const [source, setSource] = useState<'template' | 'historical'>('template');
  const [quantity, setQuantity] = useState('');
  const [solveFor, setSolveFor] = useState<SolveFor>('crew');
  const [timeHours, setTimeHours] = useState('');
  const [crew, setCrew] = useState(2);

  const [saveTargetId, setSaveTargetId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [kpis, setKpis] = useState<WorkTypeKpi[]>([]);

  useEffect(() => {
    if (isOpen && workTypes.length > 0 && !selectedWorkTypeId) {
      setSelectedWorkTypeId(workTypes[0].id);
    }
  }, [isOpen, workTypes, selectedWorkTypeId]);

  useEffect(() => {
    if (!isOpen) return;
    setSaveStatus('idle');
  }, [isOpen, selectedWorkTypeId]);

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

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, tasks, workTypes, outlierMode]);

  const selectedWorkType = workTypes.find((wt) => wt.id === selectedWorkTypeId);
  const workUnit = selectedWorkType?.workUnit ?? 'm2';

  const templateRate = useMemo((): RateInfo | null => {
    if (!selectedWorkType) return null;
    return {
      rate: selectedWorkType.assemblyRate || selectedWorkType.dismantleRate,
      source: 'template',
      confidence: null,
      sampleCount: null,
      cv: null,
      templateName: selectedWorkType.title,
    };
  }, [selectedWorkType]);

  const historicalRate = useMemo((): RateInfo | null => {
    if (!selectedWorkType) return null;
    const key: WorkTypeKey = {
      workTypeId: selectedWorkType.id,
      workTypeTitle: selectedWorkType.title,
      workUnit: selectedWorkType.workUnit,
    };
    const kpi = findKpiByKey(kpis, key);
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

  const eligibleTasks = useMemo(() => {
    if (!selectedWorkType) return [];
    return tasks.filter(
      (t) => t.status === 'active' && t.workTypeId === selectedWorkTypeId,
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

  const hasValidResultForSave = result != null;

  const isSaveDisabled = !saveTargetId || saveStatus === 'saving' || !hasValidResultForSave;

  const handleSaveTargetChange = (nextTargetId: string) => {
    setSaveTargetId(nextTargetId);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    const target = parseSaveTarget(saveTargetId);
    if (!target) return;

    if (!result) return;

    setSaveStatus('saving');
    try {
      const payload = buildSavePayload(result);
      await saveRecommendation(target.targetType, target.targetId, payload);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  return {
    workTypes,
    templates,

    selectedWorkTypeId,
    source,
    quantity,
    solveFor,
    timeHours,
    crew,
    saveTargetId,
    saveStatus,

    workUnit,
    templateRate,
    historicalRate,
    activeRate,
    resolvedRate,
    isInsufficient,
    result,
    altRate,
    altResult,
    hasBothSources,
    eligibleTasks,
    eligibleTemplates,
    isSaveDisabled,

    setSelectedWorkTypeId,
    setSource,
    setQuantity,
    setSolveFor,
    setTimeHours,
    setCrew,

    handleSaveTargetChange,
    handleSave,
  };
}
