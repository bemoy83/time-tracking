import type { Plan, PlanLineItem, BlockCategory, LineItemExecutionStatus, RateSource } from '../../planning/plan-model';
import type { BuildPhase, Project, Task, TimeEntry, WorkType, WorkUnit } from '../../types';
import type { DeadlineStatus } from '../../planning/scheduling/deadline';

export const DATA_TRANSFER_SCHEMA_VERSION = '1.2';
export const DATA_TRANSFER_SCHEMA_COMPAT = ['1.2'] as const;

export type DataTransferExportType =
  | 'plan-package'
  | 'execution-return'
  | 'full-backup';

export interface DataTransferEnvelope<TPayload> {
  schemaVersion: string;
  exportType: DataTransferExportType;
  exportedAt: string;
  appVersion: string;
  payload: TPayload;
}

export interface PlanPackagePayload {
  plan: PlanPackageSerializedPlan;
  workTypes: WorkType[];
  /** Projects referenced by the plan; optional for backward compatibility. */
  projects?: Project[];
  lastModifiedAt: string;
}

/**
 * Legacy single-phase line-item wire format used for plan-package exports.
 * A unified work package can emit up to two records (assembly + dismantle).
 */
export interface LegacyPlanPackageLineItem {
  id: string;
  title: string;
  workTypeTitle: string;
  workUnit: WorkUnit;
  workTypeId: string | null;
  workQuantity: number;
  buildPhase: BuildPhase;
  productivityRate: number;
  crew: number;
  timeHours: number;
  rateSource: RateSource;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  originalScheduledStart: string | null;
  originalScheduledEnd: string | null;
  crewByDate?: Record<string, number>;
  executionStatus: LineItemExecutionStatus;
  blockReason: string | null;
  blockCategory: BlockCategory | null;
  executorNote: string | null;
  deferredNote: string | null;
  rationale: string | null;
  reviewNote?: string | null;
  removedFromSource: boolean;
  amendmentNote: string | null;
  amendedAt: string | null;
  /** Lineage back to unified planner-side work package id. */
  sourceWorkPackageId?: string;
}

export type PlanPackageSerializedLineItem =
  | PlanLineItem
  | LegacyPlanPackageLineItem;

export type PlanPackageSerializedPlan = Omit<Plan, 'lineItems'> & {
  lineItems: PlanPackageSerializedLineItem[];
};

export interface ExecutionReturnLineItem {
  lineItemId: string;
  /** Phase represented by this execution snapshot row. */
  phase?: BuildPhase;
  /** Planner-side unified work package id when available. */
  sourceWorkPackageId?: string | null;
  title: string;
  executionStatus: LineItemExecutionStatus;
  blockReason: string | null;
  blockCategory: BlockCategory | null;
  executorNote: string | null;
  deferredNote: string | null;
  removedFromSource: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  /** Per-day assigned crew from plan schedule. */
  crewByDate?: Record<string, number>;
  actualStartDate: string | null;
  actualEndDate: string | null;
  deadlineStatusAtClose: DeadlineStatus | null;
}

/**
 * Per-day schedule entry for the structured schedule section.
 * Groups line items with their assigned crew and planned person-hours per day.
 */
export interface ScheduleDayEntry {
  date: string;
  lineItems: Array<{
    lineItemId: string;
    title: string;
    assignedCrew: number;
    plannedPersonHours: number;
  }>;
}

/**
 * Structured schedule section in execution return payload.
 * Provides a day-by-day view tying line items to tasks and time entries.
 */
export interface ScheduleSection {
  days: ScheduleDayEntry[];
}

export interface ExecutionReturnPayload {
  planId: string;
  planTitle: string;
  closedAt: string;
  summary: {
    completed: number;
    blocked: number;
    deferred: number;
    pending: number;
    inProgress: number;
    unplannedTaskCount: number;
    totalPersonHours: number;
  };
  lineItems: ExecutionReturnLineItem[];
  /** Structured day-by-day schedule section. Omitted in older exports. */
  schedule?: ScheduleSection;
  tasks: Task[];
  unplannedTasks: Task[];
  timeEntries: TimeEntry[];
  /** Work types for ID remapping on planner import. Omitted in older exports. */
  workTypes?: WorkType[];
}

export type ExecutionReturnImportConflict = 'duplicate-time-entry-id';

export interface ExecutionReturnImportPreview {
  planId: string;
  planTitle: string;
  closedAt: string;
  timeEntryCount: number;
  duplicateTimeEntryIds: string[];
  conflicts: ExecutionReturnImportConflict[];
  unplannedTaskCount: number;
  lineItemCount: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  envelope: DataTransferEnvelope<ExecutionReturnPayload>;
}

export interface ExecutionReturnImportResult {
  importedEntryCount: number;
  skippedDuplicateEntryCount: number;
  executionReturnId: string;
  lineItemCount: number;
  unplannedTaskCount: number;
  reason: string;
}

export interface ImportedExecutionReturnRecord {
  id: string;
  planId: string;
  planTitle: string;
  closedAt: string;
  importedAt: string;
  schemaVersion: string;
  appVersion: string;
  exportType: 'execution-return';
  exportedAt: string;
}

export interface ImportedExecutionReturnLineItemRecord extends ExecutionReturnLineItem {
  id: string;
  executionReturnId: string;
  planId: string;
  importedAt: string;
}

export interface ImportedExecutionReturnUnplannedTaskRecord {
  id: string;
  executionReturnId: string;
  planId: string;
  importedAt: string;
  taskId: string;
  title: string;
  workTypeId: string | null;
  workUnit: Task['workUnit'];
  buildPhase: Task['buildPhase'];
  personHours: number;
}

export type PlanPackageLineItemDiffAction = 'new' | 'updated' | 'unchanged' | 'removed';

export interface PlanPackageLineItemDiff {
  lineItemId: string;
  title: string;
  action: PlanPackageLineItemDiffAction;
  changedFields?: string[];
}

export interface PlanPackageLineItemDiffSummary {
  new: number;
  updated: number;
  unchanged: number;
  removed: number;
}

export interface PlanPackageImportPreview {
  planId: string;
  title: string;
  lineItemCount: number;
  workTypeCount: number;
  lastModifiedAt: string;
  conflict: 'none' | 'replace-or-skip' | 'merge' | 'planner-plan';
  existingStatus: Plan['status'] | null;
  envelope: DataTransferEnvelope<PlanPackagePayload>;
  lineItemDiffs?: PlanPackageLineItemDiff[];
  lineItemDiffSummary?: PlanPackageLineItemDiffSummary;
}

export interface ExecutionSummary {
  lineItems: Array<{
    item: PlanLineItem;
    derivedStatus: LineItemExecutionStatus;
  }>;
  counts: {
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
    deferred: number;
  };
}
