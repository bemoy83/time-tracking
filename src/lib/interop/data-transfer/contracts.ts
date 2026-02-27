import type { Plan, PlanLineItem, BlockCategory, LineItemExecutionStatus } from '../../planning/plan-model';
import type { Task, TimeEntry, WorkType } from '../../types';
import type { DeadlineStatus } from '../../planning/scheduling/deadline';

export const DATA_TRANSFER_SCHEMA_VERSION = '1.1';
export const DATA_TRANSFER_SCHEMA_COMPAT = ['1.0', '1.1'] as const;

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
  plan: Plan;
  workTypes: WorkType[];
  lastModifiedAt: string;
}

export interface ExecutionReturnLineItem {
  lineItemId: string;
  title: string;
  executionStatus: LineItemExecutionStatus;
  blockReason: string | null;
  blockCategory: BlockCategory | null;
  executorNote: string | null;
  deferredNote: string | null;
  removedFromSource: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  deadlineStatusAtClose: DeadlineStatus | null;
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
  tasks: Task[];
  unplannedTasks: Task[];
  timeEntries: TimeEntry[];
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

export interface PlanPackageImportPreview {
  planId: string;
  title: string;
  lineItemCount: number;
  workTypeCount: number;
  lastModifiedAt: string;
  conflict: 'none' | 'replace-or-skip' | 'merge' | 'planner-plan';
  existingStatus: Plan['status'] | null;
  envelope: DataTransferEnvelope<PlanPackagePayload>;
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
