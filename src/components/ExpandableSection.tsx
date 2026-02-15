/**
 * ExpandableSection component.
 * Shared collapsible section with toggle header, optional CountBadge, and rotating chevron.
 */

import { useState } from 'react';
import { CountBadge } from './CountBadge';

interface ExpandableSectionProps {
  label: string;
  count?: number;
  countVariant?: 'primary' | 'muted';
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  onToggle?: (isOpen: boolean) => void;
  children: React.ReactNode;
}

export function ExpandableSection({
  label,
  count,
  countVariant = 'muted',
  icon,
  defaultOpen = false,
  badge,
  onToggle,
  children,
}: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    onToggle?.(next);
  };

  return (
    <section className="expandable-section" aria-label={label}>
      <button
        type="button"
        className="expandable-section__toggle"
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <span className="expandable-section__label">
          {icon}
          {label}
          {count != null && count > 0 && (
            <CountBadge count={count} variant={countVariant} size="compact" />
          )}
          {badge}
        </span>
        <span className={`expandable-section__chevron${isOpen ? ' expandable-section__chevron--open' : ''}`}>
          &#x25B8;
        </span>
      </button>

      {isOpen && (
        <div className="expandable-section__content">
          {children}
        </div>
      )}
    </section>
  );
}
