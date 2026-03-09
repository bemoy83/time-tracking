import type { PlanLineItem, WorkCalendarDay } from '../../../../lib/planning/plan-model';
import type { DailyCapacity } from '../../../../lib/planning/scheduling/capacity';
import type { DateSpan } from '../../../../lib/planning/scheduling/schedule-span';
import type { SharedScheduleRow } from '../../../../lib/planning/scheduling/shared-schedule-types';
import type { BuildPhase } from '../../../../lib/types';

export type GridDayContext = Map<string, DailyCapacity>;

export interface ItemRowRenderInput {
  rowIndex: number;
  item: PlanLineItem;
  phase: BuildPhase;
  assignedDates: string[];
  calendar: WorkCalendarDay[];
  dayByDate: GridDayContext;
  gridColumns: string;
  phaseRange: DateSpan | null;
  hasPhaseWindows: boolean;
  readOnly: boolean;
  metaPrefix?: string;
  onToggleAssignment: (date: string, cellElement?: HTMLElement) => void;
  onCrewForDateChange?: (date: string, crew: number) => void;
  outOfPhaseAriaUsesLabel: boolean;
  readOnlyTitle?: string;
}

export interface GroupRowRenderInput {
  row: SharedScheduleRow;
  calendar: WorkCalendarDay[];
  gridColumns: string;
  aggregateByDate?: Map<string, { requiredHours: number; assignedCrew: number; assignedCapacityHours: number; shortfallHours: number }>;
  isCollapsed: boolean;
  onToggle: () => void;
}
