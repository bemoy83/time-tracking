import { useState, useEffect } from 'react';
import { useTaskStore } from '../lib/stores/task-store';
import { purgeTimeEntries, resetAllData } from '../lib/stores/purge-store';
import { getParallelSubtaskTimers, setParallelSubtaskTimers } from '../lib/stores/timer-store';
import { getAllTimeEntries } from '../lib/db';
import { PurgeEntriesConfirm } from '../components/PurgeEntriesConfirm';
import { PurgeResetConfirm } from '../components/PurgeResetConfirm';
import { ChevronRightIcon } from '../components/icons';
import { pluralize } from '../lib/utils/pluralize';
import { getFeatureFlags, setFeatureFlag, type FeatureFlagKey } from '../lib/flags/feature-flags';
import { getTelemetrySnapshot, type TelemetryEventName } from '../lib/telemetry/telemetry';

type SettingsSection =
  | 'workTypes'
  | 'templates'
  | 'productivity'
  | 'attribution'
  | 'remediation'
  | 'interop';

interface SettingsViewProps {
  onNavigateToSection?: (section: SettingsSection) => void;
}

export function SettingsView({ onNavigateToSection }: SettingsViewProps) {
  const { tasks, projects } = useTaskStore();
  const [entryCount, setEntryCount] = useState(0);
  const [showPurgeEntries, setShowPurgeEntries] = useState(false);
  const [showResetAll, setShowResetAll] = useState(false);
  const [parallelTimers, setParallelTimers] = useState(getParallelSubtaskTimers);
  const [featureFlags, setFeatureFlags] = useState(getFeatureFlags);
  const [telemetrySnapshot, setTelemetrySnapshot] = useState(getTelemetrySnapshot);

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
    { key: 'workTypes', label: 'Work Types', helper: 'Add and manage reusable work-type definitions' },
    { key: 'templates', label: 'Templates', helper: 'Create reusable presets for faster task creation' },
    { key: 'productivity', label: 'Productivity', helper: 'View KPIs and use the estimate calculator' },
    { key: 'attribution', label: 'Attribution Quality', helper: 'Set attribution policy and monitor quality' },
    { key: 'remediation', label: 'Remediation', helper: 'Review and fix attribution/work-data issues' },
    { key: 'interop', label: 'Interop', helper: 'Export KPI profiles and import work packages' },
  ];

  const handleToggleFeatureFlag = (flag: FeatureFlagKey, enabled: boolean) => {
    setFeatureFlag(flag, enabled);
    setFeatureFlags((prev) => ({ ...prev, [flag]: enabled }));
  };

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
          <h2 className="settings-view__sub-header">Feature Flags</h2>
          <p className="settings-view__helper">Gate risky planning/interop/archive features for rollout safety</p>
          <label className="settings-view__row settings-view__row--toggle">
            <span className="settings-view__row-label">Planning scenario compare</span>
            <input
              type="checkbox"
              className="settings-view__toggle"
              checked={featureFlags.planningScenarioCompare}
              onChange={(e) => {
                handleToggleFeatureFlag('planningScenarioCompare', e.target.checked);
              }}
            />
          </label>
          <label className="settings-view__row settings-view__row--toggle">
            <span className="settings-view__row-label">Interop stale import guard</span>
            <input
              type="checkbox"
              className="settings-view__toggle"
              checked={featureFlags.interopStaleImportGuard}
              onChange={(e) => {
                handleToggleFeatureFlag('interopStaleImportGuard', e.target.checked);
              }}
            />
          </label>
          <label className="settings-view__row settings-view__row--toggle">
            <span className="settings-view__row-label">Archive maintenance tools</span>
            <input
              type="checkbox"
              className="settings-view__toggle"
              checked={featureFlags.archiveMaintenanceTools}
              onChange={(e) => {
                handleToggleFeatureFlag('archiveMaintenanceTools', e.target.checked);
              }}
            />
          </label>
          <label className="settings-view__row settings-view__row--toggle">
            <span className="settings-view__row-label">Archive KPI recompute</span>
            <input
              type="checkbox"
              className="settings-view__toggle"
              checked={featureFlags.archiveKpiRecompute}
              onChange={(e) => {
                handleToggleFeatureFlag('archiveKpiRecompute', e.target.checked);
              }}
            />
          </label>
          <label className="settings-view__row settings-view__row--toggle">
            <span className="settings-view__row-label">Calculator multi-scenario cards</span>
            <input
              type="checkbox"
              className="settings-view__toggle"
              checked={featureFlags.calculatorMultiScenarioCards}
              onChange={(e) => {
                handleToggleFeatureFlag('calculatorMultiScenarioCards', e.target.checked);
              }}
            />
          </label>
        </div>
      </section>

      <section className="settings-view__section">
        <div className="settings-view__card">
          <div className="settings-view__card-header">
            <h2 className="settings-view__sub-header">Telemetry</h2>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setTelemetrySnapshot(getTelemetrySnapshot())}
            >
              Refresh
            </button>
          </div>
          <p className="settings-view__helper">Quality/adoption event counters (local aggregate)</p>
          {Object.keys(telemetrySnapshot).length === 0 ? (
            <p className="settings-view__empty">No telemetry events captured yet.</p>
          ) : (
            <div className="settings-view__list">
              {(Object.entries(telemetrySnapshot) as Array<[TelemetryEventName, { count: number; lastAt: string }]>).map(([name, record]) => (
                <div key={name} className="settings-view__row">
                  <div className="settings-view__template-info">
                    <span className="settings-view__row-label">{name}</span>
                    <span className="settings-view__row-detail">{record.count} events · last {new Date(record.lastAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
