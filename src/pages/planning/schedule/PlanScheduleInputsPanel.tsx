import { PlanScheduleInputs } from './PlanScheduleInputs';
import type { PhaseDateField, PhaseDateValues } from './schedule-date-ui';

interface PlanScheduleInputsPanelProps extends PhaseDateValues {
  eventStartDate: string | null;
  eventEndDate: string | null;
  readOnly: boolean;
  onPhaseDateChange: (field: PhaseDateField, value: string) => void;
  onEventDateChange: (field: 'eventStartDate' | 'eventEndDate', value: string) => void;
}

export function PlanScheduleInputsPanel({
  assemblyStartDate,
  assemblyEndDate,
  dismantleStartDate,
  dismantleEndDate,
  eventStartDate,
  eventEndDate,
  readOnly,
  onPhaseDateChange,
  onEventDateChange,
}: PlanScheduleInputsPanelProps) {
  return (
    <PlanScheduleInputs
      assemblyStartDate={assemblyStartDate}
      assemblyEndDate={assemblyEndDate}
      dismantleStartDate={dismantleStartDate}
      dismantleEndDate={dismantleEndDate}
      eventStartDate={eventStartDate}
      eventEndDate={eventEndDate}
      readOnly={readOnly}
      onPhaseDateChange={onPhaseDateChange}
      onEventDateChange={onEventDateChange}
    />
  );
}
