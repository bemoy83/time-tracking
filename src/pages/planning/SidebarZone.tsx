import { ChevronIcon } from '../../components/icons';

export function SidebarZone({
  label,
  children,
  collapsible = false,
  expanded = true,
  onToggle,
}: {
  label: string;
  children: React.ReactNode;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  if (collapsible) {
    return (
      <div className="planning-sidebar__zone">
        <button
          type="button"
          className="planning-sidebar__zone-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <ChevronIcon
            className={`planning-sidebar__zone-chevron${expanded ? ' planning-sidebar__zone-chevron--expanded' : ''}`}
          />
          <span className="planning-sidebar__zone-heading">{label}</span>
        </button>
        {expanded && children}
      </div>
    );
  }

  return (
    <div className="planning-sidebar__zone">
      <h3 className="planning-sidebar__zone-heading">{label}</h3>
      {children}
    </div>
  );
}
