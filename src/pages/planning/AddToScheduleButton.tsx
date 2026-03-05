import { CheckIcon, PlusIcon } from '../../components/icons';
import { trackTelemetryEvent } from '../../lib/telemetry/telemetry';

interface AddToScheduleButtonProps {
  planId: string;
  planTitle: string;
  isChecked: boolean;
  onToggle: () => void;
}

export function AddToScheduleButton({
  planId,
  planTitle,
  isChecked,
  onToggle,
}: AddToScheduleButtonProps) {
  return (
    <button
      type="button"
      className={`planning-view__add-to-schedule-btn${isChecked ? ' planning-view__add-to-schedule-btn--checked' : ''}`}
      data-plan-id={planId}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
        trackTelemetryEvent('shared_schedule_plan_selection_change');
      }}
      aria-label={isChecked ? `Remove ${planTitle} from shared schedule` : `Add ${planTitle} to shared schedule`}
      aria-pressed={isChecked}
    >
      {isChecked ? (
        <CheckIcon className="planning-view__add-to-schedule-icon" aria-hidden />
      ) : (
        <PlusIcon className="planning-view__add-to-schedule-icon" aria-hidden />
      )}
    </button>
  );
}
