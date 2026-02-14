import { useState, useEffect } from 'react';
import { useTaskStore } from '../lib/stores/task-store';
import { purgeTimeEntries, resetAllData } from '../lib/stores/purge-store';
import { getAllTimeEntries } from '../lib/db';
import { PurgeEntriesConfirm } from '../components/PurgeEntriesConfirm';
import { PurgeResetConfirm } from '../components/PurgeResetConfirm';

export function SettingsView() {
  const { tasks, projects } = useTaskStore();
  const [entryCount, setEntryCount] = useState(0);
  const [showPurgeEntries, setShowPurgeEntries] = useState(false);
  const [showResetAll, setShowResetAll] = useState(false);

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

  return (
    <div className="settings-view">
      <section className="settings-view__section">
        <h2 className="settings-view__section-title">Data</h2>

        <button
          className="settings-view__row settings-view__row--danger"
          onClick={() => setShowPurgeEntries(true)}
          disabled={entryCount === 0}
        >
          <span className="settings-view__row-label">Clear time entries</span>
          <span className="settings-view__row-detail">
            {entryCount === 0
              ? 'No time entries'
              : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
          </span>
        </button>

        <button
          className="settings-view__row settings-view__row--danger"
          onClick={() => setShowResetAll(true)}
        >
          <span className="settings-view__row-label">Reset all data</span>
          <span className="settings-view__row-detail">
            Tasks, projects, and time entries
          </span>
        </button>
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
