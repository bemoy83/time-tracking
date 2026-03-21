import type { Plan, PlanLineItem, BlockCategory, LineItemExecutionStatus } from '../../planning/plan-model';
import type { BuildPhase, Project, Task, TimeEntry, WorkType, WorkUnitDefinition } from '../../types';
import type { Tag, TagCategory } from '../../tags';
import type { DeadlineStatus } from '../../planning/scheduling/deadline';

export const DATA_TRANSFER_SCHEMA_VERSION = '4.0';
export const DATA_TRANSFER_SCHEMA_COMPAT = ['3.0', '4.0'] as const;

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
  workUnitDefinitions?: WorkUnitDefinition[];
  /** Projects referenced by the plan; optional for backward compatibility. */
  projects?: Project[];
  /**
   * Tag definitions referenced by this plan's workTypes and lineItems.
   * Optional for backward compatibility with older packages.
   * Field devices use this to display tag names without a network call.
   */
  tags?: Tag[];
  /** Tag categories for the included tags. Optional for backward compatibility. */
  tagCategories?: TagCategory[];
  lastModifiedAt: string;
}

export type PlanPackageSerializedLineItem = PlanLineItem;

export type PlanPackageSerializedPlan = Omit<Plan, 'lineItems'> & {
  lineItems: PlanPackageSerializedLineItem[];
};

export interface ExecutionReturnLineItem {
  lineItemId: string;
  /** Phase represented by this execution snapshot row. */
  phase: BuildPhase;
  /** Planner-side unified work package id when available. */
  sourceWorkPackageId: string | null;
  title: string;
  executionStatus: LineItemExecutionStatus;
  blockReason: string | null;
  blockCategory: BlockCategory | null;
  executorNote: string | null;
  deferredNote: string | null;
  removedFromSource: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  /** Per-day planned effort from plan schedule. */
  personHoursByDate?: Record<string, number>;
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
  /** Referenced quantity units for label preservation. Omitted in older exports. */
  workUnitDefinitions?: WorkUnitDefinition[];
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
  workUnitCount: number;
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
  phase: Task['phase'];
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
  workUnitCount: number;
  projectCount: number;
  tagCount: number;
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
