import type { ReactNode } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import { planTotalPersonHours } from '../../../lib/planning/plan-model';
import { isPlanArchived, isPlanInPlannerState } from '../../../lib/planning/plan-lifecycle';
import {
  computeCapacitySummary,
  computeSharedCapacitySummary,
} from '../../../lib/planning/scheduling/capacity';
import {
  deriveCrewPoolCalendar,
  deriveCrewPoolDefaultCrewSize,
} from '../../../lib/planning/scheduling/crew-pool-calendar';
import type { CapacitySummary } from '../../../lib/planning/scheduling/capacity';
import type { ScheduledLineItemRef } from '../../../lib/planning/scheduling/shared-schedule-types';
import { computePlanProgress } from '../../../lib/planning/plan-progress';
import {
  generateDefaultWorkCalendar,
  dayAvailablePersonHours,
} from '../../../lib/planning/scheduling/work-calendar';
import {
  getPrimaryScheduleRange,
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
  const primaryRange = getPrimaryScheduleRange(phaseDates, plan.eventStartDate, plan.eventEndDate);

  let workDays: number | null = null;
  let headroom: number | null = null;
  if (primaryRange) {
    const calendar =
      plan.workCalendar.length > 0
        ? plan.workCalendar
        : generateDefaultWorkCalendar(primaryRange.start, primaryRange.end, plan.defaultCrewSize);
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

export function getScheduleViewMetrics(plan: Plan): SidebarMetricDescriptor[] {
  const cap = computeCapacitySummary(plan);
  return [
    { value: cap.scheduledLineItemCount, label: 'Scheduled items', icon: <CheckIcon />, iconVariant: 'tasks' },
    { value: cap.unscheduledLineItemCount, label: 'Unscheduled', icon: <TaskListIcon />, iconVariant: 'estimate' },
    { value: Math.round(cap.totalAvailablePersonHours), label: 'Available hrs', icon: <ClockIcon />, iconVariant: 'time' },
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
  capacityFromView?: { totalRequiredPersonHours: number; totalAvailablePersonHours: number } | null,
): SidebarMetricDescriptor[] {
  const selectablePlans = plans.filter(isPlanInPlannerState);
  const selected = selectablePlans.filter((p) => selectedPlanIds.has(p.id));
  const totalItems = selected.reduce((sum, p) => sum + p.lineItems.length, 0);
  const totalPH = selected.reduce((sum, p) => sum + planTotalPersonHours(p), 0);

  // Use capacity from main view when provided (matches FeasibilityBar); otherwise derive
  let utilizationMetric = createUtilizationMetric(null);
  if (capacityFromView && capacityFromView.totalAvailablePersonHours > 0) {
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
    utilizationMetric = createUtilizationMetric({
      totalRequiredPersonHours: cap.totalRequiredPersonHours,
      totalAvailablePersonHours: cap.totalAvailablePersonHours,
    });
  }

  return [
    { value: selectedPlanIds.size, label: 'Selected plans', icon: <CheckIcon />, iconVariant: 'tasks' },
    { value: totalItems, label: 'Line items', icon: <TaskListIcon />, iconVariant: 'estimate' },
    { value: Math.round(totalPH), label: 'Person-hrs', icon: <ClockIcon />, iconVariant: 'time' },
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
