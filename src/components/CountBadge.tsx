/**
 * Unified count badge for use across views.
 * Use "primary" for emphasis (e.g. notes count), "muted" for section counts.
 */

interface CountBadgeProps {
  count: number;
  variant?: 'primary' | 'muted';
  size?: 'default' | 'compact';
}

export function CountBadge({ count, variant = 'muted', size = 'default' }: CountBadgeProps) {
  const sizeClass = size === 'compact' ? ' count-badge--compact' : '';
  return (
    <span
      className={`count-badge count-badge--${variant}${sizeClass}`}
      aria-label={`${count} items`}
    >
      {count}
    </span>
  );
}
