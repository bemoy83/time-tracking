import { useState } from 'react';
import { useMediaQuery } from '../../../lib/hooks/useMediaQuery';
import { PlanScheduleInputs } from './PlanScheduleInputs';
import { ScheduleInputsBlock } from './ScheduleInputsBlock';
import type { PhaseDateField, PhaseDateValues } from './schedule-date-ui';

interface PlanScheduleInputsPanelProps extends PhaseDateValues {
  eventStartDate: string | null;
  eventEndDate: string | null;
  defaultCrewSize: number | null;
  readOnly: boolean;
  showBackButton?: boolean;
  primaryRange: { start: string; end: string } | null;
  dayCount: number;
  crewSize: number | null;
  totalAvailable: number;
  onPhaseDateChange: (field: PhaseDateField, value: string) => void;
  onEventDateChange: (field: 'eventStartDate' | 'eventEndDate', value: string) => void;
  onDefaultCrewSizeChange: (value: string) => void;
}

export function PlanScheduleInputsPanel({
  buildUpStartDate,
  buildUpEndDate,
  tearDownStartDate,
  tearDownEndDate,
  eventStartDate,
  eventEndDate,
  defaultCrewSize,
  readOnly,
  showBackButton = false,
  primaryRange,
  dayCount,
  crewSize,
  totalAvailable,
  onPhaseDateChange,
  onEventDateChange,
  onDefaultCrewSizeChange,
}: PlanScheduleInputsPanelProps) {
  const isEmpty = primaryRange == null;
  const [inputsExpanded, setInputsExpanded] = useState(isEmpty);
  const isDesktopControlBand = useMediaQuery('(min-width: 1200px)') && !showBackButton;
  const scheduleInputsExpanded = isDesktopControlBand ? true : inputsExpanded;

  return (
    <ScheduleInputsBlock
      expanded={scheduleInputsExpanded}
      onToggle={() => setInputsExpanded((prev) => !prev)}
      collapsible={!isDesktopControlBand}
      primaryRange={primaryRange}
      dayCount={dayCount}
      crewSize={crewSize}
      totalAvailable={totalAvailable}
    >
      <PlanScheduleInputs
        buildUpStartDate={buildUpStartDate}
        buildUpEndDate={buildUpEndDate}
        tearDownStartDate={tearDownStartDate}
        tearDownEndDate={tearDownEndDate}
        eventStartDate={eventStartDate}
        eventEndDate={eventEndDate}
        defaultCrewSize={defaultCrewSize}
        readOnly={readOnly}
        onPhaseDateChange={onPhaseDateChange}
        onEventDateChange={onEventDateChange}
        onDefaultCrewSizeChange={onDefaultCrewSizeChange}
      />
    </ScheduleInputsBlock>
  );
}
