import type { WorkUnitDefinition } from '../lib/types';

interface WorkUnitPillGroupProps {
  units: WorkUnitDefinition[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

export function WorkUnitPillGroup({
  units,
  value,
  onChange,
  ariaLabel,
  className,
}: WorkUnitPillGroupProps) {
  return (
    <div className={className ?? 'task-work-quantity__unit-pills'} role="group" aria-label={ariaLabel}>
      {units.map((unitOption) => (
        <button
          key={unitOption.id}
          type="button"
          role="radio"
          aria-checked={value === unitOption.id}
          className={`task-work-quantity__unit-pill${value === unitOption.id ? ' task-work-quantity__unit-pill--active' : ''}`}
          onClick={() => onChange(unitOption.id)}
        >
          {unitOption.label}
        </button>
      ))}
    </div>
  );
}
