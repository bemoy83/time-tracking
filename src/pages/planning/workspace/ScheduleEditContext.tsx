import { createContext, useContext } from 'react';
import type { Plan } from '../../../lib/planning/plan-model';
import type { PhaseDateField, PhaseDateValues } from '../schedule/schedule-date-ui';

export interface ScheduleEditContextValue {
  currentPlan: Plan;
  phaseDates: PhaseDateValues;
  primaryRange: { start: string; end: string } | null;
  workCalendarRange: { start: string; end: string } | null;
  effectiveCrewSize: number | null;
  readOnly: boolean;
  onPhaseDateChange: (field: PhaseDateField, value: string) => void;
  onEventDateChange: (field: 'eventStartDate' | 'eventEndDate', value: string) => void;
  onDefaultCrewChange: (value: string) => void;
  onDefaultEfficiencyChange: (value: string) => void;
  onUpdateCalendarDay: (date: string, updates: Partial<Plan['workCalendar'][number]>) => void;
  onScrollToDate: (date: string) => void;
}

export const ScheduleEditContext = createContext<ScheduleEditContextValue | null>(null);

export function useScheduleEditContext(): ScheduleEditContextValue | null {
  return useContext(ScheduleEditContext);
}
