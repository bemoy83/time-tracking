import type { ReactNode } from 'react';

interface IconButtonProps {
  icon: ReactNode;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}

export function IconButton({
  icon,
  ariaLabel,
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--sm btn--circle ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );
}
