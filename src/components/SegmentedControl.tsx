import type { ReactNode } from 'react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  title?: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
  disabled?: boolean;
  /** "pill" = dark iOS-style track (default). "outline" = light bordered, blue active state. */
  variant?: 'pill' | 'outline';
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  disabled = false,
  variant = 'pill',
}: SegmentedControlProps<T>) {
  return (
    <div className={`segmented-control segmented-control--${variant}`} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          className={`segmented-control__option${opt.value === value ? ' is-active' : ''}`}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
