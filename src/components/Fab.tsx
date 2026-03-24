/**
 * Floating action button — shared across Today, Projects, Planning, and other views.
 */

interface FabProps {
  onClick: () => void;
  'aria-label': string;
  disabled?: boolean;
  'aria-busy'?: boolean;
  children?: React.ReactNode;
}

export function Fab({
  onClick,
  'aria-label': ariaLabel,
  disabled = false,
  'aria-busy': ariaBusy,
  children = '+',
}: FabProps) {
  return (
    <button
      type="button"
      className="fab"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      aria-busy={ariaBusy}
    >
      {children}
    </button>
  );
}
