/**
 * StepperPill — Reusable pill-shaped increment/decrement control.
 * Renders [−] [value|divider] [+] as a gapless segmented button.
 *
 * Variants:
 * - with-value: [- value +] for compact inline use
 * - with-divider: [- | +] for when the value is displayed outside the pill
 */

interface StepperPillProps {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  variant: 'with-value' | 'with-divider';
  size?: 'compact' | 'large';
  decrementLabel?: string;
  incrementLabel?: string;
  ariaLabel?: string;
}

export function StepperPill({
  value,
  min,
  max,
  onChange,
  variant,
  size = 'compact',
  decrementLabel = 'Decrease',
  incrementLabel = 'Increase',
  ariaLabel = 'Value',
}: StepperPillProps) {
  const decrement = () => {
    if (value > min) onChange(value - 1);
  };

  const increment = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div
      className={`stepper-pill stepper-pill--${size} stepper-pill--${variant}`}
      role="spinbutton"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      <button
        type="button"
        className="stepper-pill__btn"
        onClick={decrement}
        disabled={value <= min}
        aria-label={decrementLabel}
      >
        −
      </button>
      {variant === 'with-value' ? (
        <span className="stepper-pill__value">{value}</span>
      ) : (
        <span className="stepper-pill__divider" aria-hidden="true" />
      )}
      <button
        type="button"
        className="stepper-pill__btn"
        onClick={increment}
        disabled={value >= max}
        aria-label={incrementLabel}
      >
        +
      </button>
    </div>
  );
}
