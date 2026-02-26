/**
 * Floating action button — shared across Today, Projects, Planning, and other views.
 */

interface FabProps {
  onClick: () => void;
  'aria-label': string;
  children?: React.ReactNode;
}

export function Fab({ onClick, 'aria-label': ariaLabel, children = '+' }: FabProps) {
  return (
    <button
      type="button"
      className="fab"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
