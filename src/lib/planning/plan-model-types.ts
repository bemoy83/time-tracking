import type { WorkUnit, BuildPhase, Project } from '../types';
import type { DateSpan } from './scheduling/schedule-span';

export type PlanStatus =
  | 'draft'
  | 'active'
  | 'reviewed'
  | 'received'
  | 'session-closed';

export type LineItemExecutionStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'blocked'
  | 'deferred';

export type BlockCategory =
  | 'access'
  | 'materials'
  | 'crew'
  | 'dependency'
  | 'other';

export type RateSource = 'template' | 'historical' | 'manual';
export type DailyEffortMap = Record<string, number>;

export interface WorkCalendarDay {
  date: string;
  isWorkDay: boolean;
  accessStart: string | null;
  accessEnd: string | null;
  crewSize: number | null;
  efficiency?: number | null;
  crewComposition?: Record<string, number>;
}

export interface PlanLineItem {
  id: string;
  title: string;
  workTypeTitle: string;
  workUnit: WorkUnit;
  workTypeId: string | null;
  workQuantity: number;
  dismantleQuantity?: number | null;
  assemblyRate: number;
  assemblyCrew: number;
  assemblyTimeHours: number;
  assemblyRateSource: RateSource;
  dismantleRate: number;
  dismantleCrew: number;
  dismantleTimeHours: number;
  dismantleRateSource: RateSource;
  assemblyScheduledStart: string | null;
  assemblyScheduledEnd: string | null;
  assemblyOriginalScheduledStart: string | null;
  assemblyOriginalScheduledEnd: string | null;
  assemblyPersonHoursByDate?: DailyEffortMap;
  dismantleScheduledStart: string | null;
  dismantleScheduledEnd: string | null;
  dismantleOriginalScheduledStart: string | null;
  dismantleOriginalScheduledEnd: string | null;
  dismantlePersonHoursByDate?: DailyEffortMap;
  assemblyExecutionStatus: LineItemExecutionStatus;
  assemblyBlockReason: string | null;
  assemblyBlockCategory: BlockCategory | null;
  assemblyExecutorNote: string | null;
  assemblyDeferredNote: string | null;
  dismantleExecutionStatus: LineItemExecutionStatus;
  dismantleBlockReason: string | null;
  dismantleBlockCategory: BlockCategory | null;
  dismantleExecutorNote: string | null;
  dismantleDeferredNote: string | null;
  rationale: string | null;
  reviewNote?: string | null;
  removedFromSource: boolean;
  amendmentNote: string | null;
  amendedAt: string | null;
  tagIds?: string[];
}

export interface PhaseFields {
  rate: number;
  crew: number;
  timeHours: number;
  rateSource: RateSource;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  originalScheduledStart: string | null;
  originalScheduledEnd: string | null;
  personHoursByDate: DailyEffortMap | undefined;
  executionStatus: LineItemExecutionStatus;
  blockReason: string | null;
  blockCategory: BlockCategory | null;
  executorNote: string | null;
  deferredNote: string | null;
}

export interface Plan {
  id: string;
  title: string;
  status: PlanStatus;
  lineItems: PlanLineItem[];
  projectId: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  assemblyStartDate: string | null;
  assemblyEndDate: string | null;
  dismantleStartDate: string | null;
  dismantleEndDate: string | null;
  defaultCrewSize: number | null;
  defaultEfficiency: number | null;
  workCalendar: WorkCalendarDay[];
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  handedOffAt?: string | null;
  reviewedAt?: string | null;
  importedAt?: string | null;
  lastExecutionReturnExportedAt?: string | null;
  sessionClosedAt?: string | null;
}

export type PlanDateSpan = DateSpan;

export type PlanDisplayProject = Pick<Project, 'name'>;
export type PhaseDatePlan = Pick<
  Plan,
  'assemblyStartDate' | 'assemblyEndDate' | 'dismantleStartDate' | 'dismantleEndDate'
>;
export type EffectiveSpanPlan = Pick<
  Plan,
  | 'eventStartDate'
  | 'eventEndDate'
  | 'assemblyStartDate'
  | 'assemblyEndDate'
  | 'dismantleStartDate'
  | 'dismantleEndDate'
>;
export type PhaseDatePlanWithValues = PhaseDatePlan & {
  assemblyStartDate: string;
  assemblyEndDate: string;
  dismantleStartDate: string;
  dismantleEndDate: string;
};
export type PlanPhase = BuildPhase;
