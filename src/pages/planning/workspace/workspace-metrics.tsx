import type { ReactNode } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import { planTotalPersonHours } from '../../../lib/planning/plan-model';
import { isPlanArchived, isPlanInPlannerState } from '../../../lib/planning/plan-lifecycle';
import {
  computeCapacitySummary,
  computeSharedCapacitySummary,
} from '../../../lib/planning/scheduling/capacity';
import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import {
  deriveCrewPoolCalendar,
  deriveCrewPoolDefaultCrewSize,
} from '../../../lib/planning/scheduling/crew-pool-calendar';
import type { ScheduledLineItemRef } from '../../../lib/planning/scheduling/shared-schedule-types';
import { computePlanProgress } from '../../../lib/planning/plan-progress';
import {
  generateDefaultWorkCalendarForSpans,
  dayAvailablePersonHours,
} from '../../../lib/planning/scheduling/work-calendar';
import {
  getWorkCalendarPhaseSpans,
  readPhaseDateValues,
} from '../schedule/schedule-date-ui';
import type { Task, TimeEntry } from '../../../lib/types';
import type { WorkTypeKpi } from '../../../lib/kpi';
import {
  BlockedIcon,
  CheckIcon,
  ClockIcon,
  CompleteCircleIcon,
  PeopleIcon,
  RulerIcon,
  SparklesIcon,
  SpeedIcon,
  TaskListIcon,
  WarningIcon,
} from '../../../components/icons';

type MetricCardIconVariant = 'tasks' | 'done' | 'time' | 'people' | 'blocked' | 'estimate';

// ---------------------------------------------------------------------------
// Reusable utilization metric
// ---------------------------------------------------------------------------

export interface UtilizationInput {
  totalRequiredPersonHours: number;
  totalAvailablePersonHours: number;
}

/**
 * Creates a reusable utilization metric descriptor (crew capacity used vs available).
 * Returns "—" when no capacity data; shows percentage with risk variant when over-allocated.
 */
export function createUtilizationMetric(input: UtilizationInput | null): SidebarMetricDescriptor {
  if (!input || input.totalAvailablePersonHours <= 0) {
    return { value: '—', label: 'Utilization', icon: <PeopleIcon />, iconVariant: 'people' };
  }
  const ratio = input.totalRequiredPersonHours / input.totalAvailablePersonHours;
  const pct = Math.round(ratio * 100);
  return {
    value: `${pct}%`,
    label: 'Utilization',
    icon: <PeopleIcon />,
    iconVariant: 'people',
    variant: ratio > 1 ? 'risk' : 'default',
  };
}

export interface SidebarMetricDescriptor {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
  iconVariant?: MetricCardIconVariant;
  meta?: string;
  variant?: 'default' | 'risk';
  /** Optional progress ring shown in the KPI card (replaces icon). */
  ring?: { ratio: number; isComplete: boolean };
}

export interface ScheduleCoverageMetric {
  label: string;
  scheduledHours: number;
  unscheduledHours: number;
  totalHours: number;
  completionRatio: number;
  isComplete: boolean;
}

export const PLACEHOLDER_METRIC: SidebarMetricDescriptor = { value: '—', label: '' };

export type ResolvedMetrics = [SidebarMetricDescriptor, SidebarMetricDescriptor, SidebarMetricDescriptor, SidebarMetricDescriptor];

export function resolveSidebarMetrics(
  viewMetrics: SidebarMetricDescriptor[],
  fallbacks: SidebarMetricDescriptor[],
): ResolvedMetrics {
  const result = viewMetrics.slice(0, 4);
  const usedLabels = new Set(result.map((m) => m.label));

  for (const fb of fallbacks) {
    if (result.length >= 4) break;
    if (usedLabels.has(fb.label)) continue;
    result.push(fb);
    usedLabels.add(fb.label);
  }

  while (result.length < 4) {
    result.push(PLACEHOLDER_METRIC);
  }

  return result as ResolvedMetrics;
}

// ---------------------------------------------------------------------------
// Global fallback metrics
// ---------------------------------------------------------------------------

export function getGlobalFallbackMetrics(plans: Plan[], tasks: Task[]): SidebarMetricDescriptor[] {
  const activePlans = plans.filter((p) => !isPlanArchived(p));
  const totalHours = activePlans.reduce((sum, p) => sum + planTotalPersonHours(p), 0);
  const totalPackages = activePlans.reduce((sum, p) => sum + p.lineItems.length, 0);
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;

  // Utilization only derives from selected plans; fallbacks have no selection → show "—"
  return [
    createUtilizationMetric(null),
    { value: Math.round(totalHours), label: 'Person-hrs', icon: <ClockIcon />, iconVariant: 'time' },
    { value: totalPackages, label: 'Work packages', icon: <TaskListIcon />, iconVariant: 'estimate' },
    { value: completedTasks, label: 'Tasks done', icon: <CheckIcon />, iconVariant: 'done' },
  ];
}

// ---------------------------------------------------------------------------
// Per-view metric functions
// ---------------------------------------------------------------------------

export function getPlanEditorMetrics(plan: Plan): SidebarMetricDescriptor[] {
  const totalPH = planTotalPersonHours(plan);
  const phaseDates = readPhaseDateValues(plan);
  const phaseSpans = getWorkCalendarPhaseSpans(phaseDates);

  let workDays: number | null = null;
  let headroom: number | null = null;
  if (plan.workCalendar.length > 0 || phaseSpans.length > 0) {
    const calendar =
      plan.workCalendar.length > 0
        ? plan.workCalendar
        : generateDefaultWorkCalendarForSpans(phaseSpans, plan.defaultCrewSize);
    workDays = calendar.filter((d) => d.isWorkDay).length;
    const totalAvailable = calendar.reduce(
      (sum, d) => sum + dayAvailablePersonHours(d, plan.defaultCrewSize),
      0,
    );
    headroom = totalAvailable - totalPH;
  }

  const metrics: SidebarMetricDescriptor[] = [
    { value: plan.lineItems.length, label: 'Work packages', icon: <RulerIcon />, iconVariant: 'estimate' },
    { value: Math.round(totalPH), label: 'Person-hrs', icon: <ClockIcon />, iconVariant: 'time' },
  ];
  if (workDays != null) {
    metrics.push({ value: workDays, label: 'Work days', icon: <TaskListIcon />, iconVariant: 'tasks' });
  }
  if (headroom != null) {
    metrics.push({
      value: Math.round(headroom),
      label: 'Headroom hrs',
      icon: <SpeedIcon />,
      iconVariant: 'time',
      variant: headroom < 0 ? 'risk' : 'default',
    });
  }
  return metrics;
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function formatHoursMetricValue(hours: number): string {
  const rounded = round1(hours);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function createScheduleCoverageMetric(
  totalRequiredPersonHours: number,
  scheduledRequiredPersonHours: number,
): ScheduleCoverageMetric {
  const totalHours = Math.max(0, round1(totalRequiredPersonHours));
  const boundedScheduledHours = Math.max(
    0,
    Math.min(totalHours, round1(scheduledRequiredPersonHours)),
  );
  const unscheduledHoursRaw = Math.max(0, round1(totalHours - boundedScheduledHours));
  const unscheduledHours = unscheduledHoursRaw < 0.1 ? 0 : unscheduledHoursRaw;
  const scheduledHours = round1(totalHours - unscheduledHours);
  const completionRatio = totalHours <= 0
    ? 1
    : Math.max(0, Math.min(1, scheduledHours / totalHours));

  return {
    label: 'Schedule coverage',
    scheduledHours,
    unscheduledHours,
    totalHours,
    completionRatio,
    isComplete: unscheduledHours === 0,
  };
}

export function getPlanScheduleCoverageMetric(plan: Plan): ScheduleCoverageMetric {
  const totalRequiredPersonHours = planTotalPersonHours(plan);
  const capacity = computeCapacitySummary(plan);
  return createScheduleCoverageMetric(totalRequiredPersonHours, capacity.totalRequiredPersonHours);
}

export function getSharedScheduleCoverageMetric(
  plans: Plan[],
  selectedPlanIds: Set<string>,
  capacityFromView?: Pick<CapacitySummary, 'totalRequiredPersonHours'> | null,
): ScheduleCoverageMetric | null {
  const selectablePlans = plans.filter(isPlanInPlannerState);
  const selected = selectablePlans.filter((p) => selectedPlanIds.has(p.id));
  if (selected.length === 0) return null;

  const totalRequiredPersonHours = selected.reduce(
    (sum, plan) => sum + planTotalPersonHours(plan),
    0,
  );

  if (capacityFromView) {
    return createScheduleCoverageMetric(
      totalRequiredPersonHours,
      capacityFromView.totalRequiredPersonHours,
    );
  }

  const calendar = deriveCrewPoolCalendar(selected);
  const defaultCrewSize = deriveCrewPoolDefaultCrewSize(selected);
  const lineItems: ScheduledLineItemRef[] = selected.flatMap((plan) =>
    plan.lineItems.map((item) => ({
      planId: plan.id,
      lineItemId: item.id,
      plan,
      item,
      readOnly: isPlanArchived(plan),
    })),
  );
  const capacity = computeSharedCapacitySummary({
    calendar,
    defaultCrewSize,
    lineItems,
  });
  return createScheduleCoverageMetric(totalRequiredPersonHours, capacity.totalRequiredPersonHours);
}

export function getScheduleViewMetrics(plan: Plan): SidebarMetricDescriptor[] {
  const cap = computeCapacitySummary(plan);
  const coverage = getPlanScheduleCoverageMetric(plan);
  return [
    {
      value: formatHoursMetricValue(coverage.scheduledHours),
      label: 'Scheduled hrs',
      icon: <CheckIcon />,
      iconVariant: 'done',
      ring: { ratio: coverage.completionRatio, isComplete: coverage.isComplete },
    },
    {
      value: formatHoursMetricValue(coverage.unscheduledHours),
      label: 'Unscheduled hrs',
      icon: <TaskListIcon />,
      iconVariant: 'estimate',
      variant: coverage.unscheduledHours > 0 ? 'risk' : 'default',
    },
    {
      value: formatHoursMetricValue(cap.totalAvailablePersonHours),
      label: 'Available hrs',
      icon: <ClockIcon />,
      iconVariant: 'time',
    },
    {
      value: cap.overAllocatedDayCount,
      label: 'Over-allocated days',
      icon: <WarningIcon />,
      iconVariant: 'blocked',
      variant: cap.overAllocatedDayCount > 0 ? 'risk' : 'default',
    },
  ];
}

export function getProgressViewMetrics(
  plan: Plan,
  tasks: Task[],
  timeEntries: TimeEntry[],
): SidebarMetricDescriptor[] {
  const progress = computePlanProgress(plan, tasks, timeEntries);
  const pct = Math.round(progress.completionRatio * 100);
  const deadlineRisk = progress.deadline.status != null && progress.deadline.status !== 'on-track';
  return [
    { value: `${pct}%`, label: 'Completion', icon: <CompleteCircleIcon />, iconVariant: 'done' },
    { value: progress.lineItems.length, label: 'Planned items', icon: <TaskListIcon />, iconVariant: 'estimate' },
    {
      value: progress.deadline.label ?? '—',
      label: 'Deadline',
      icon: <ClockIcon />,
      iconVariant: 'time',
      variant: deadlineRisk ? 'risk' : 'default',
    },
    { value: progress.unplannedWork.taskCount, label: 'Unplanned work', icon: <BlockedIcon />, iconVariant: 'blocked' },
  ];
}

export function getSharedScheduleMetrics(
  plans: Plan[],
  selectedPlanIds: Set<string>,
  capacityFromView?: {
    totalRequiredPersonHours: number;
    totalAvailablePersonHours: number;
    unscheduledLineItemCount?: number;
  } | null,
): SidebarMetricDescriptor[] {
  const selectablePlans = plans.filter(isPlanInPlannerState);
  const selected = selectablePlans.filter((p) => selectedPlanIds.has(p.id));
  const totalPH = selected.reduce((sum, p) => sum + planTotalPersonHours(p), 0);

  let scheduledRequiredHours = 0;
  let unscheduledLineItemCount: number | undefined;

  // Use capacity from main view when provided (matches FeasibilityBar); otherwise derive
  let utilizationMetric = createUtilizationMetric(null);
  if (capacityFromView && capacityFromView.totalAvailablePersonHours > 0) {
    scheduledRequiredHours = capacityFromView.totalRequiredPersonHours;
    unscheduledLineItemCount = capacityFromView.unscheduledLineItemCount;
    utilizationMetric = createUtilizationMetric(capacityFromView);
  } else if (selected.length > 0) {
    const calendar = deriveCrewPoolCalendar(selected);
    const defaultCrewSize = deriveCrewPoolDefaultCrewSize(selected);
    const lineItems: ScheduledLineItemRef[] = selected.flatMap((plan) =>
      plan.lineItems.map((item) => ({
        planId: plan.id,
        lineItemId: item.id,
        plan,
        item,
        readOnly: isPlanArchived(plan),
      })),
    );
    const cap = computeSharedCapacitySummary({
      calendar,
      defaultCrewSize,
      lineItems,
    });
    scheduledRequiredHours = cap.totalRequiredPersonHours;
    unscheduledLineItemCount = cap.unscheduledLineItemCount;
    utilizationMetric = createUtilizationMetric({
      totalRequiredPersonHours: cap.totalRequiredPersonHours,
      totalAvailablePersonHours: cap.totalAvailablePersonHours,
    });
  }
  const unscheduledHours = Math.max(0, totalPH - scheduledRequiredHours);

  const lineItemMeta =
    unscheduledLineItemCount !== undefined && unscheduledLineItemCount > 0
      ? `${unscheduledLineItemCount} line item${unscheduledLineItemCount === 1 ? '' : 's'}`
      : undefined;

  return [
    { value: selectedPlanIds.size, label: 'Selected plans', icon: <CheckIcon />, iconVariant: 'tasks' },
    {
      value: formatHoursMetricValue(scheduledRequiredHours),
      label: 'Scheduled hrs',
      icon: <CheckIcon />,
      iconVariant: 'done',
    },
    {
      value: formatHoursMetricValue(unscheduledHours),
      label: 'Unscheduled hrs',
      icon: <TaskListIcon />,
      iconVariant: 'estimate',
      variant: unscheduledHours > 0 ? 'risk' : 'default',
      meta: lineItemMeta,
    },
    utilizationMetric,
  ];
}

export function getInsightsViewMetrics(kpis: WorkTypeKpi[]): SidebarMetricDescriptor[] {
  const highConfidence = kpis.filter((k) => k.confidence === 'high').length;
  return [
    { value: kpis.length, label: 'Work types', icon: <RulerIcon />, iconVariant: 'tasks' },
    { value: highConfidence, label: 'High confidence', icon: <SparklesIcon />, iconVariant: 'done' },
  ];
}

export function getEventReportMetrics(plan: Plan): SidebarMetricDescriptor[] {
  return [
    { value: Math.round(planTotalPersonHours(plan)), label: 'Person-hrs', icon: <ClockIcon />, iconVariant: 'time' },
    { value: plan.lineItems.length, label: 'Line items', icon: <TaskListIcon />, iconVariant: 'estimate' },
  ];
}
