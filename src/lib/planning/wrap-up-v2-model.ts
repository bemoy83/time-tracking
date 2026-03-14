import type { BlockCategory, LineItemExecutionStatus, PlanLineItem } from './plan-model';
import type { BuildPhase, Task, TimeEntry, WorkUnit } from '../types';

export interface WrapUpLineItemProjection {
  lineItem: PlanLineItem;
  phase: BuildPhase;
  linkedTaskIds: string[];
  plannedPersonHours: number;
  actualPersonHours: number;
  variancePersonHours: number;
  actualProductivity: number | null;
  executionStatus: LineItemExecutionStatus;
  executorNote: string | null;
  blockReason: string | null;
  blockCategory: BlockCategory | null;
  deferredNote: string | null;
  defaultIncludeInKpi: boolean;
}

export interface WrapUpUnplannedProjection {
  taskId: string;
  title: string;
  isImportedOnly: boolean;
  workTypeId: string | null;
  workUnit: WorkUnit | null;
  phase: BuildPhase | null;
  personHours: number;
  sourceTask: Task | null;
}

export interface WrapUpReviewLineItemDecision {
  lineItemId: string;
  includeInKpi: boolean;
  deferredDispositionConfirmed: boolean;
  reviewNote: string | null;
  executionStatus: LineItemExecutionStatus;
  executorNote: string | null;
  blockReason: string | null;
  blockCategory: BlockCategory | null;
  deferredNote: string | null;
  linkedTaskIds: string[];
}

export interface WrapUpReviewUnplannedDecision {
  taskId: string;
  includeInKpi: boolean;
  assignedWorkTypeId: string | null;
  isImportedOnly: boolean;
  sourceTask: Task | null;
}

export interface WrapUpV2Projection {
  lineItems: WrapUpLineItemProjection[];
  unplanned: WrapUpUnplannedProjection[];
  importedAt: string | null;
  closedAt: string | null;
}

export interface WrapUpV2FinalizeInput {
  lineItemDecisions: WrapUpReviewLineItemDecision[];
  unplannedDecisions: WrapUpReviewUnplannedDecision[];
  archiveTaskIds: string[];
  markReviewed: boolean;
}

export type TimeEntriesByTask = Map<string, TimeEntry[]>;
