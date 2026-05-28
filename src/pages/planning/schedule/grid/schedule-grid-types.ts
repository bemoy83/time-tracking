import type { CSSProperties } from 'react';
import type { PlanLineItem, WorkCalendarDay } from '../../../../lib/planning/plan-model';
import type { DailyCapacity } from '../../../../lib/planning/scheduling/capacity';
import type { DateSpan } from '../../../../lib/planning/scheduling/schedule-span';
import type { SharedScheduleRow } from '../../../../lib/planning/scheduling/shared-schedule-types';
import type { BuildPhase } from '../../../../lib/types';

export type GridDayContext = Map<string, DailyCapacity>;

export interface ItemRowRenderInput {
  rowKey: string;
  rowIndex: number;
  item: PlanLineItem;
  phase: BuildPhase;
  assignedDates: string[];
  calendar: WorkCalendarDay[];
  dayByDate: GridDayContext;
  gridColumns: string;
  phaseRange: DateSpan | null;
  commercialPhaseRange: DateSpan | null;
  hasPhaseWindows: boolean;
  readOnly: boolean;
  metaPrefix?: string;
  onToggleAssignment: (date: string, cellElement?: HTMLElement) => void;
  onClearSchedule?: () => void;
  onPersonHoursForDateChange?: (date: string, personHours: number) => void;
  outOfPhaseAriaUsesLabel: boolean;
  readOnlyTitle?: string;
  isAssistantUnresolved?: boolean;
  isAssistantActive?: boolean;
}

export interface GroupDayTint {
  className: string;
  style?: CSSProperties;
}

export interface GroupRowRenderInput {
  row: SharedScheduleRow;
  calendar: WorkCalendarDay[];
  gridColumns: string;
  aggregateByDate?: Map<string, { requiredHours: number; assignedCrew: number; assignedCapacityHours: number; shortfallHours: number }>;
  topLevelAccentColor?: string | null;
  /** Single-plan event header uses event styling instead of project. */
  headerVariant?: 'event';
  /** When set, shown instead of row.itemCount (e.g. item-phase row count). */
  itemCountOverride?: number;
  /** Phase / event band tint on day cells (single-plan today; shared later). */
  getGroupDayTint?: (day: WorkCalendarDay) => GroupDayTint;
  isCollapsed: boolean;
  onToggle: () => void;
}
