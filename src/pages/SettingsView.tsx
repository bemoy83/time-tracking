import { useState, useEffect } from 'react';
import { useTaskStore } from '../lib/stores/task-store';
import { purgeTimeEntries, resetAllData } from '../lib/stores/purge-store';
import { getParallelSubtaskTimers, setParallelSubtaskTimers } from '../lib/stores/timer-store';
import {
  useSubtaskTimeRollupMode,
  setSubtaskTimeRollupMode,
} from '../lib/stores/subtask-time-rollup-settings';
import { getAllTimeEntries } from '../lib/db';
import { PurgeEntriesConfirm } from '../components/PurgeEntriesConfirm';
import { PurgeResetConfirm } from '../components/PurgeResetConfirm';
import { ChevronRightIcon } from '../components/icons';
import { pluralize } from '../lib/utils/pluralize';
import './settings/settings-styles';

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
  | 'dataTransfer';

interface SettingsViewProps {
  onNavigateToSection?: (section: SettingsSection) => void;
}

export function SettingsView({ onNavigateToSection }: SettingsViewProps) {
  const { tasks, projects } = useTaskStore();
  const [entryCount, setEntryCount] = useState(0);
  const [showPurgeEntries, setShowPurgeEntries] = useState(false);
  const [showResetAll, setShowResetAll] = useState(false);
  const [parallelTimers, setParallelTimers] = useState(getParallelSubtaskTimers);
  const subtaskRollupMode = useSubtaskTimeRollupMode();

  useEffect(() => {
    getAllTimeEntries().then((entries) => setEntryCount(entries.length));
  }, []);

  const handlePurgeEntries = async () => {
    await purgeTimeEntries();
    setEntryCount(0);
    setShowPurgeEntries(false);
  };

  const handleResetAll = async () => {
    await resetAllData();
    setEntryCount(0);
    setShowResetAll(false);
  };

  const drillDownSections: { key: SettingsSection; label: string; helper: string }[] = [
    { key: 'projects', label: 'Projects / Events', helper: 'Import event schedule and manage project phase dates' },
    { key: 'workUnits', label: 'Quantity Units', helper: 'Manage the global catalog of measurable quantity units' },
    { key: 'workTypes', label: 'Work Types', helper: 'Add and manage reusable work-type definitions' },
    { key: 'tags', label: 'Tags', helper: 'Manage global tags and categories for filtering and grouping work' },
    { key: 'tagSequence', label: 'Tag Execution Sequence', helper: 'Define the global execution order for sequencable tags' },
    { key: 'crew', label: 'Crew', helper: 'Set available headcounts per skill for schedule capacity constraints' },
    { key: 'templates', label: 'Templates', helper: 'Create reusable presets for faster task creation' },
    { key: 'planLineItems', label: 'Plan Work Packages', helper: 'Download the CSV template and validate files for plan import' },
    { key: 'productivity', label: 'Productivity', helper: 'View KPIs and use the estimate calculator' },
    { key: 'attribution', label: 'Attribution Quality', helper: 'Set attribution policy and monitor quality' },
    { key: 'remediation', label: 'Remediation', helper: 'Review and fix attribution/work-data issues' },
    { key: 'dataTransfer', label: 'Data Transfer', helper: 'Import plan packages and progress reports' },
    { key: 'telemetry', label: 'Telemetry', helper: 'Quality/adoption event counters (local aggregate)' },
  ];

  return (
    <div className="settings-view">
      <h1 className="settings-view__title">Settings</h1>

      {/* Timers — inline */}
      <section className="settings-view__section">
        <div className="settings-view__card">
          <h2 className="settings-view__sub-header">Timers</h2>
          <p className="settings-view__helper">Allow multiple subtasks to run timers simultaneously</p>
          <label className="settings-view__row settings-view__row--toggle">
            <span className="settings-view__row-label">Allow parallel</span>
            <input
              type="checkbox"
              className="settings-view__toggle"
              checked={parallelTimers}
              onChange={(e) => {
                setParallelTimers(e.target.checked);
                setParallelSubtaskTimers(e.target.checked);
              }}
            />
          </label>
        </div>
      </section>

      {/* Drill-down sections — whole card is tappable */}
      {drillDownSections.map((section) => (
        <section key={section.key} className="settings-view__section">
          <button
            type="button"
            className="settings-view__card settings-view__card--tappable"
            onClick={() => onNavigateToSection?.(section.key)}
          >
            <div className="settings-view__card-header">
              <h2 className="settings-view__sub-header">{section.label}</h2>
              <ChevronRightIcon className="settings-view__card-chevron" />
            </div>
            <p className="settings-view__helper">{section.helper}</p>
          </button>
        </section>
      ))}

      <section className="settings-view__section">
        <div className="settings-view__card">
          <h2 className="settings-view__sub-header">Advanced</h2>
          <p className="settings-view__helper">
            Control whether subtasks are phase-only or can carry their own measurable work.
          </p>
          <label className="settings-view__row settings-view__row--toggle">
            <span className="settings-view__row-label">Allow subtasks to have work</span>
            <input
              type="checkbox"
              className="settings-view__toggle"
              checked={subtaskRollupMode === 'attribution'}
              onChange={(e) => {
                setSubtaskTimeRollupMode(e.target.checked ? 'attribution' : 'simple');
              }}
            />
          </label>
          <p className="settings-view__helper">
            When on: subtasks can have their own work, and time/productivity use attribution.
            When off: subtasks are phases only, and all subtask time rolls to parent.
          </p>
        </div>
      </section>

      {/* Data — inline */}
      <section className="settings-view__section">
        <div className="settings-view__card">
          <h2 className="settings-view__sub-header">Data</h2>
          <p className="settings-view__helper">Clear entries or reset all data</p>
          <div className="settings-view__list">
            <button
              className="settings-view__danger-link"
              onClick={() => setShowPurgeEntries(true)}
              disabled={entryCount === 0}
            >
              Clear time entries
              {entryCount > 0 && (
                <span className="settings-view__danger-meta">
                  ({pluralize(entryCount, 'entry', 'entries')})
                </span>
              )}
            </button>

            <button
              className="settings-view__danger-link"
              onClick={() => setShowResetAll(true)}
            >
              Reset all data
            </button>
          </div>
        </div>
      </section>

      <PurgeEntriesConfirm
        isOpen={showPurgeEntries}
        entryCount={entryCount}
        onConfirm={handlePurgeEntries}
        onCancel={() => setShowPurgeEntries(false)}
      />
      <PurgeResetConfirm
        isOpen={showResetAll}
        taskCount={tasks.length}
        projectCount={projects.length}
        entryCount={entryCount}
        onConfirm={handleResetAll}
        onCancel={() => setShowResetAll(false)}
      />
    </div>
  );
}
