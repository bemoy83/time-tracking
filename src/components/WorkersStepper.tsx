/**
 * WorkersStepper component.
 * Shared crew-size stepper used in TimerBar, TaskDetail, and entry modals.
 *
 * Two sizes:
 * - compact: inline pill [- 3 +] for TimerBar
 * - large: full-width stepper for modals
 */

interface WorkersStepperProps {
  value: number;
  onChange: (n: number) => void;
  size?: 'compact' | 'large';
}

export function WorkersStepper({ value, onChange, size = 'compact' }: WorkersStepperProps) {
  const min = 1;
  const max = 20;

  const decrement = () => {
    if (value > min) onChange(value - 1);
  };

  const increment = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div
      className={`workers-stepper workers-stepper--${size}`}
      role="spinbutton"
      aria-label="Workers count"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      <button
        type="button"
        className="workers-stepper__btn"
        onClick={decrement}
        disabled={value <= min}
        aria-label="Decrease workers"
      >
        -
      </button>
      <span className="workers-stepper__value">{value}</span>
      <button
        type="button"
        className="workers-stepper__btn"
        onClick={increment}
        disabled={value >= max}
        aria-label="Increase workers"
      >
        +
      </button>
    </div>
  );
}
