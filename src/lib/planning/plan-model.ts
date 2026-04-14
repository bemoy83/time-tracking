/**
 * Planning workspace data model.
 *
 * A Plan is a collection of work packages (line items) with editable
 * assumptions. Plans can be in planner states ('draft' | 'active' | 'reviewed')
 * or executor states ('received' | 'session-closed').
 *
 * Each line item is phase-agnostic: it carries per-phase assumptions (rate,
 * crew, time) for both assembly and dismantle. A phase with rate=0 and
 * crew=0 and timeHours=0 is considered inactive.
 */

export type {
  BlockCategory,
  DailyEffortMap,
  LineItemExecutionStatus,
  PhaseFields,
  Plan,
  PlanDateSpan,
  PlanLineItem,
  PlanStatus,
  RateSource,
  WorkCalendarDay,
} from './plan-model-types';

import type { WorkUnit, BuildPhase } from '../types';
import { generateId, nowUtc } from '../types';
import type { WorkTypeKey } from '../kpi';
import { lineItemWorkTypeKey as toLineItemWorkTypeKey } from '../work-package-core';
import {
  getPhaseSpan as getPhaseSpanInternal,
  getPlanEffectiveSpan as getPlanEffectiveSpanInternal,
  hasPhaseDates as hasPhaseDatesInternal,
} from './scheduling/schedule-span';
import type {
  DailyEffortMap,
  EffectiveSpanPlan,
  PhaseDatePlan,
  PhaseDatePlanWithValues,
  PhaseFields,
  Plan,
  PlanDateSpan,
  PlanDisplayProject,
  PlanLineItem,
  PlanPhase,
  RateSource,
} from './plan-model-types';

const PHASE_CONFIG = {
  assembly: {
    prefix: 'assembly',
    quantityOverrideField: null,
  },
  dismantle: {
    prefix: 'dismantle',
    quantityOverrideField: 'dismantleQuantity',
  },
} as const satisfies Record<
  PlanPhase,
  {
    prefix: 'assembly' | 'dismantle';
    quantityOverrideField: 'dismantleQuantity' | null;
  }
>;

const PHASE_FIELD_SUFFIXES = {
  rate: 'Rate',
  crew: 'Crew',
  timeHours: 'TimeHours',
  rateSource: 'RateSource',
  scheduledStart: 'ScheduledStart',
  scheduledEnd: 'ScheduledEnd',
  originalScheduledStart: 'OriginalScheduledStart',
  originalScheduledEnd: 'OriginalScheduledEnd',
  personHoursByDate: 'PersonHoursByDate',
  executionStatus: 'ExecutionStatus',
  blockReason: 'BlockReason',
  blockCategory: 'BlockCategory',
  executorNote: 'ExecutorNote',
  deferredNote: 'DeferredNote',
} as const satisfies Record<keyof PhaseFields, string>;

const PHASE_FIELD_NAMES = Object.keys(PHASE_FIELD_SUFFIXES) as Array<keyof PhaseFields>;
type PhasePrefix = (typeof PHASE_CONFIG)[BuildPhase]['prefix'];
type PhaseSpecificPlanLineItemField =
  `${PhasePrefix}${(typeof PHASE_FIELD_SUFFIXES)[keyof typeof PHASE_FIELD_SUFFIXES]}`;

function getPhaseFieldKey<FieldName extends keyof PhaseFields>(
  phase: BuildPhase,
  fieldName: FieldName,
): PhaseSpecificPlanLineItemField {
  const { prefix } = PHASE_CONFIG[phase];
  const suffix = PHASE_FIELD_SUFFIXES[fieldName];
  return `${prefix}${suffix}` as PhaseSpecificPlanLineItemField;
}

function readPhaseField<FieldName extends keyof PhaseFields>(
  item: PlanLineItem,
  phase: BuildPhase,
  fieldName: FieldName,
): PhaseFields[FieldName] {
  return item[getPhaseFieldKey(phase, fieldName)] as PhaseFields[FieldName];
}

function phaseFieldState(
  phase: BuildPhase,
  fields: PhaseFields,
): Pick<PlanLineItem, PhaseSpecificPlanLineItemField> {
  const result: Record<string, unknown> = {};
  for (const fieldName of PHASE_FIELD_NAMES) {
    result[getPhaseFieldKey(phase, fieldName)] = fields[fieldName];
  }
  return result as Pick<PlanLineItem, PhaseSpecificPlanLineItemField>;
}

export function getPhaseFields(item: PlanLineItem, phase: BuildPhase): PhaseFields {
  return Object.fromEntries(
    PHASE_FIELD_NAMES.map((fieldName) => [fieldName, readPhaseField(item, phase, fieldName)]),
  ) as unknown as PhaseFields;
}

export function isPhaseActive(item: PlanLineItem, phase: BuildPhase): boolean {
  const { rate, crew, timeHours } = getPhaseFields(item, phase);
  return rate > 0 || crew > 0 || timeHours > 0;
}

export function getPhaseQuantity(item: PlanLineItem, phase: BuildPhase): number {
  const quantityOverrideField = PHASE_CONFIG[phase].quantityOverrideField;
  if (quantityOverrideField) {
    const quantityOverride = item[quantityOverrideField];
    if (quantityOverride != null) {
      return quantityOverride;
    }
  }
  return item.workQuantity;
}

export function phaseFieldUpdates(
  phase: BuildPhase,
  updates: Partial<PhaseFields>,
): Partial<PlanLineItem> {
  const result: Record<string, unknown> = {};
  for (const fieldName of PHASE_FIELD_NAMES) {
    if (Object.prototype.hasOwnProperty.call(updates, fieldName)) {
      result[getPhaseFieldKey(phase, fieldName)] = updates[fieldName];
    }
  }
  return result as Partial<PlanLineItem>;
}

export function hasPhaseDates(plan: PhaseDatePlan): plan is PhaseDatePlanWithValues {
  return hasPhaseDatesInternal(plan);
}

export function getPlanEffectiveSpan(
  plan: EffectiveSpanPlan,
): PlanDateSpan | null {
  return getPlanEffectiveSpanInternal(plan);
}

export function getPhaseSpan(
  plan: PhaseDatePlan,
  phase: BuildPhase,
): PlanDateSpan | null {
  return getPhaseSpanInternal(plan, phase);
}

export function getPlanDisplayName(
  plan: Pick<Plan, 'title'>,
  project?: PlanDisplayProject | null,
): string {
  return project?.name ?? plan.title;
}

export function resolveLineItemWorkTypeTitle(
  item: Pick<PlanLineItem, 'workTypeTitle' | 'title'>,
): string {
  if (item.workTypeTitle && item.workTypeTitle.trim().length > 0) {
    return item.workTypeTitle;
  }
  return item.title;
}

export function lineItemWorkTypeKey(item: PlanLineItem): WorkTypeKey {
  return toLineItemWorkTypeKey(item);
}

function roundPlannedPersonHours(value: number): number {
  return Number(value.toFixed(2));
}

export function normalizeDailyEffortMap(
  value: DailyEffortMap | undefined,
): DailyEffortMap | undefined {
  if (!value) return undefined;
  const normalized: DailyEffortMap = {};
  for (const [date, hours] of Object.entries(value)) {
    if (!Number.isFinite(hours) || hours <= 0) continue;
    normalized[date] = roundPlannedPersonHours(hours);
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function getAssignedDatesFromEffortMap(
  personHoursByDate: DailyEffortMap | undefined,
): string[] {
  return Object.keys(personHoursByDate ?? {})
    .filter((date) => (personHoursByDate?.[date] ?? 0) > 0)
    .sort();
}

export function recomputeScheduledSpanFromEffortMap(
  personHoursByDate: DailyEffortMap | undefined,
): { scheduledStart: string | null; scheduledEnd: string | null } {
  const dates = getAssignedDatesFromEffortMap(personHoursByDate);
  if (dates.length === 0) {
    return { scheduledStart: null, scheduledEnd: null };
  }
  return {
    scheduledStart: dates[0],
    scheduledEnd: dates[dates.length - 1],
  };
}

export function getPlannedPersonHoursForDate(
  item: PlanLineItem,
  phase: BuildPhase,
  date: string,
): number {
  const pf = getPhaseFields(item, phase);
  return roundPlannedPersonHours(pf.personHoursByDate?.[date] ?? 0);
}

export function getEffectiveCrewForDate(
  item: PlanLineItem,
  phase: BuildPhase,
  date: string,
): number {
  const pf = getPhaseFields(item, phase);
  return getPlannedPersonHoursForDate(item, phase, date) > 0 ? pf.crew : 0;
}

export function lineItemEffectiveCrew(item: PlanLineItem, phase: BuildPhase): number {
  return getPhaseFields(item, phase).crew;
}

export function planTotalPersonHours(plan: Plan): number {
  return plan.lineItems.reduce((sum, item) => {
    const bu = item.assemblyTimeHours * item.assemblyCrew;
    const td = item.dismantleTimeHours * item.dismantleCrew;
    return sum + bu + td;
  }, 0);
}

export function planPhasePersonHours(plan: Plan, phase: BuildPhase): number {
  return plan.lineItems.reduce((sum, item) => {
    const pf = getPhaseFields(item, phase);
    return sum + pf.timeHours * pf.crew;
  }, 0);
}

export function planTotalsByUnit(plan: Plan): Map<WorkUnit, number> {
  const totals = new Map<WorkUnit, number>();
  for (const item of plan.lineItems) {
    totals.set(item.workUnit, (totals.get(item.workUnit) ?? 0) + item.workQuantity);
  }
  return totals;
}

export const DEFAULT_PLAN_EFFICIENCY = 1.0;

export function normalizePlanEfficiency(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(1.0, Math.max(0.5, value));
}

export function resolvePlanEfficiency(plan: Pick<Plan, 'defaultEfficiency'>): number {
  return normalizePlanEfficiency(plan.defaultEfficiency) ?? DEFAULT_PLAN_EFFICIENCY;
}

export function createPlan(title: string): Plan {
  const now = nowUtc();
  return {
    id: generateId(),
    title,
    status: 'draft',
    lineItems: [],
    projectId: null,
    eventStartDate: null,
    eventEndDate: null,
    assemblyStartDate: null,
    assemblyEndDate: null,
    dismantleStartDate: null,
    dismantleEndDate: null,
    defaultCrewSize: null,
    defaultEfficiency: null,
    workCalendar: [],
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    reviewedAt: null,
    importedAt: null,
    lastExecutionReturnExportedAt: null,
    sessionClosedAt: null,
  };
}

export function createLineItem(
  title: string,
  workTypeTitle: string,
  workUnit: WorkUnit,
  workQuantity: number,
  assemblyRate: number,
  dismantleRate: number,
  rateSource: RateSource = 'manual',
  workTypeId: string | null = null,
  tagIds: string[] = [],
): PlanLineItem {
  const assemblyTimeHours = assemblyRate > 0 ? workQuantity / assemblyRate : 0;
  const dismantleTimeHours = dismantleRate > 0 ? workQuantity / dismantleRate : 0;
  return {
    id: generateId(),
    title,
    workTypeTitle,
    workUnit,
    workTypeId,
    workQuantity,
    dismantleQuantity: null,
    ...phaseFieldState('assembly', {
      rate: assemblyRate,
      crew: assemblyRate > 0 ? 1 : 0,
      timeHours: assemblyTimeHours,
      rateSource,
      scheduledStart: null,
      scheduledEnd: null,
      originalScheduledStart: null,
      originalScheduledEnd: null,
      personHoursByDate: undefined,
      executionStatus: 'pending',
      blockReason: null,
      blockCategory: null,
      executorNote: null,
      deferredNote: null,
    }),
    ...phaseFieldState('dismantle', {
      rate: dismantleRate,
      crew: dismantleRate > 0 ? 1 : 0,
      timeHours: dismantleTimeHours,
      rateSource,
      scheduledStart: null,
      scheduledEnd: null,
      originalScheduledStart: null,
      originalScheduledEnd: null,
      personHoursByDate: undefined,
      executionStatus: 'pending',
      blockReason: null,
      blockCategory: null,
      executorNote: null,
      deferredNote: null,
    }),
    rationale: null,
    reviewNote: null,
    removedFromSource: false,
    amendmentNote: null,
    amendedAt: null,
    tagIds,
  };
}

export function duplicateLineItem(item: PlanLineItem): PlanLineItem {
  const trimmedTitle = item.title.trim();
  const baseTitle = trimmedTitle.replace(/\s*\(copy\)\s*$/i, '').trim();
  const duplicateTitle = `${baseTitle || trimmedTitle} (copy)`.trim();

  return {
    id: generateId(),
    title: duplicateTitle,
    workTypeTitle: item.workTypeTitle,
    workUnit: item.workUnit,
    workTypeId: item.workTypeId,
    workQuantity: item.workQuantity,
    dismantleQuantity: item.dismantleQuantity,
    ...phaseFieldState('assembly', {
      ...getPhaseFields(item, 'assembly'),
      personHoursByDate: item.assemblyPersonHoursByDate ? { ...item.assemblyPersonHoursByDate } : undefined,
      blockReason: null,
      blockCategory: null,
      executorNote: null,
      deferredNote: null,
    }),
    ...phaseFieldState('dismantle', {
      ...getPhaseFields(item, 'dismantle'),
      personHoursByDate: item.dismantlePersonHoursByDate ? { ...item.dismantlePersonHoursByDate } : undefined,
      blockReason: null,
      blockCategory: null,
      executorNote: null,
      deferredNote: null,
    }),
    rationale: null,
    reviewNote: null,
    removedFromSource: item.removedFromSource,
    amendmentNote: item.amendmentNote,
    amendedAt: item.amendedAt,
    tagIds: item.tagIds ? [...item.tagIds] : [],
  };
}

export function activatePlan(plan: Plan): Plan {
  const now = nowUtc();
  return {
    ...plan,
    status: 'active',
    activatedAt: now,
    reviewedAt: null,
    sessionClosedAt: null,
    lastExecutionReturnExportedAt: null,
    updatedAt: now,
  };
}

export function revertToDraft(plan: Plan): Plan {
  return {
    ...plan,
    status: 'draft',
    activatedAt: null,
    handedOffAt: null,
    reviewedAt: null,
    lastExecutionReturnExportedAt: null,
    updatedAt: nowUtc(),
  };
}

export function handOffPlan(plan: Plan): Plan {
  const now = nowUtc();
  return { ...plan, handedOffAt: now, updatedAt: now };
}

export function updatePlanLineItem(
  plan: Plan,
  lineItemId: string,
  updates: Partial<Omit<PlanLineItem, 'id'>>,
): Plan {
  return {
    ...plan,
    lineItems: plan.lineItems.map((item) =>
      item.id === lineItemId ? { ...item, ...updates } : item,
    ),
    updatedAt: nowUtc(),
  };
}

export function addLineItemToPlan(plan: Plan, item: PlanLineItem): Plan {
  return {
    ...plan,
    lineItems: [...plan.lineItems, item],
    updatedAt: nowUtc(),
  };
}

export function addLineItemsToPlan(plan: Plan, items: PlanLineItem[]): Plan {
  return {
    ...plan,
    lineItems: [...plan.lineItems, ...items],
    updatedAt: nowUtc(),
  };
}

export function duplicateAllLineItemsInPlan(plan: Plan): Plan {
  const copies = plan.lineItems.map(duplicateLineItem);
  return addLineItemsToPlan(plan, copies);
}

export function removeLineItemFromPlan(plan: Plan, lineItemId: string): Plan {
  return {
    ...plan,
    lineItems: plan.lineItems.filter((item) => item.id !== lineItemId),
    updatedAt: nowUtc(),
  };
}

export function removeAllLineItemsFromPlan(plan: Plan): Plan {
  return {
    ...plan,
    lineItems: [],
    updatedAt: nowUtc(),
  };
}
