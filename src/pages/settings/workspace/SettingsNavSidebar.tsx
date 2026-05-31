import type { ReactNode } from 'react';
import {
  BackIcon,
  RulerIcon,
  TagIcon,
  PeopleIcon,
  TaskListIcon,
  FolderIcon,
  SpeedIcon,
  WarningIcon,
  ExportIcon,
  ImportIcon,
  ChevronIcon,
  CheckIcon,
} from '../../../components/icons';

type SettingsSection =
  | 'projects'
  | 'workUnits'
  | 'workTypes'
  | 'tags'
  | 'tagSequence'
  | 'crew'
  | 'templates'
  | 'planLineItems'
  | 'productivity'
  | 'attribution'
  | 'remediation'
  | 'telemetry'
  | 'cloudSync'
  | 'dataTransfer';

interface NavItem {
  key: SettingsSection;
  label: string;
  icon: ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Library',
    items: [
      { key: 'workTypes',   label: 'Work Types',  icon: <RulerIcon  className="settings-nav__item-icon" /> },
      { key: 'tags',        label: 'Tags',         icon: <TagIcon    className="settings-nav__item-icon" /> },
      { key: 'workUnits',   label: 'Units',        icon: <RulerIcon  className="settings-nav__item-icon" /> },
      { key: 'crew',        label: 'Crew',         icon: <PeopleIcon className="settings-nav__item-icon" /> },
      { key: 'templates',   label: 'Templates',    icon: <TaskListIcon className="settings-nav__item-icon" /> },
    ],
  },
  {
    label: 'Planning',
    items: [
      { key: 'projects',     label: 'Projects',         icon: <FolderIcon   className="settings-nav__item-icon" /> },
      { key: 'tagSequence',  label: 'Tag Sequence',     icon: <ChevronIcon  className="settings-nav__item-icon" /> },
      { key: 'planLineItems',label: 'Work Packages',    icon: <CheckIcon    className="settings-nav__item-icon" /> },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { key: 'productivity', label: 'Productivity',  icon: <SpeedIcon   className="settings-nav__item-icon" /> },
      { key: 'attribution',  label: 'Attribution',   icon: <CheckIcon   className="settings-nav__item-icon" /> },
      { key: 'remediation',  label: 'Remediation',   icon: <WarningIcon className="settings-nav__item-icon" /> },
    ],
  },
  {
    label: 'Data',
    items: [
      { key: 'dataTransfer', label: 'Data Transfer', icon: <ExportIcon className="settings-nav__item-icon" /> },
      { key: 'cloudSync',    label: 'Cloud Sync',    icon: <ImportIcon className="settings-nav__item-icon" /> },
      { key: 'telemetry',    label: 'Telemetry',     icon: <SpeedIcon  className="settings-nav__item-icon" /> },
    ],
  },
];

interface SettingsNavSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onExit: () => void;
}

export function SettingsNavSidebar({
  activeSection,
  onSectionChange,
  onExit,
}: SettingsNavSidebarProps) {
  return (
    <nav className="settings-nav" aria-label="Settings navigation">
      <div className="settings-nav__header">
        <button
          type="button"
          className="settings-nav__exit"
          onClick={onExit}
          aria-label="Exit settings"
        >
          <BackIcon className="settings-nav__exit-icon" />
          Settings
        </button>
      </div>

      <div className="settings-nav__groups">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="settings-nav__group">
            <span className="settings-nav__group-label">{group.label}</span>
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`settings-nav__item${activeSection === item.key ? ' settings-nav__item--active' : ''}`}
                onClick={() => onSectionChange(item.key)}
                aria-current={activeSection === item.key ? 'page' : undefined}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="settings-nav__footer">v3.4.0</div>
    </nav>
  );
}
