/**
 * WorkersStepper component.
 * Shared crew-size stepper used in TimerBar, TaskDetail, and entry modals.
 *
 * Two sizes:
 * - compact: inline pill [- 3 +] for TimerBar
 * - large: icon + "Personnel" + count + StepperPill [− | +] for modals
 */

import { PeopleIcon } from './icons';
import { StepperPill } from './StepperPill';

interface WorkersStepperProps {
  value: number;
  onChange: (n: number) => void;
  size?: 'compact' | 'large';
}

const MIN = 1;
const MAX = 20;

export function WorkersStepper({ value, onChange, size = 'compact' }: WorkersStepperProps) {
  return (
    <div className={`workers-stepper workers-stepper--${size}`}>
      {size === 'large' && (
        <>
          <PeopleIcon className="workers-stepper__icon" aria-hidden={true} />
          <span className="workers-stepper__label">Personnel</span>
          <span className="workers-stepper__count">{value}</span>
        </>
      )}
      <StepperPill
        value={value}
        min={MIN}
        max={MAX}
        onChange={onChange}
        variant={size === 'compact' ? 'with-value' : 'with-divider'}
        size={size}
        decrementLabel="Decrease personnel"
        incrementLabel="Increase personnel"
        ariaLabel="Personnel count"
      />
    </div>
  );
}
