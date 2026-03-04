import type { BuildPhase } from '../../types';
import type { Plan, PlanLineItem, WorkCalendarDay } from '../plan-model';

export interface ScheduledLineItemRef {
  planId: string;
  lineItemId: string;
  plan: Plan;
  item: PlanLineItem;
  readOnly: boolean;
}

export interface SharedScheduleInput {
  calendar: WorkCalendarDay[];
  defaultCrewSize: number | null;
  lineItems: ScheduledLineItemRef[];
}

interface SharedScheduleRowBase {
  id: string;
  type: 'project' | 'phase' | 'item';
  planId: string;
  label: string;
  depth: 0 | 1 | 2;
  projectRowId: string;
  readOnly: boolean;
}

export interface SharedScheduleProjectRow extends SharedScheduleRowBase {
  type: 'project';
  depth: 0;
  itemCount: number;
}

export interface SharedSchedulePhaseRow extends SharedScheduleRowBase {
  type: 'phase';
  depth: 1;
  phase: BuildPhase;
  phaseRowId: string;
  itemCount: number;
}

export interface SharedScheduleItemRow extends SharedScheduleRowBase {
  type: 'item';
  depth: 2;
  phase: BuildPhase;
  phaseRowId: string;
  lineItemId: string;
}

export type SharedScheduleRow =
  | SharedScheduleProjectRow
  | SharedSchedulePhaseRow
  | SharedScheduleItemRow;
