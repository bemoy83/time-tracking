import { useState } from 'react';
import { useTaskStore } from '../../lib/stores/task-store';
import { AttributionQualitySection } from '../../components/AttributionQualitySection';
import { recomputeAttribution } from '../../lib/attribution/cache';
import { getAttributionPolicy, setAttributionPolicy } from '../../lib/stores/attribution-settings';
import type { AttributionPolicy } from '../../lib/types';
import { SettingsDetailLayout } from './SettingsDetailLayout';

interface SettingsAttributionViewProps {
  onBack: () => void;
}

export function SettingsAttributionView({ onBack }: SettingsAttributionViewProps) {
  const { tasks } = useTaskStore();
  const [attributionKey, setAttributionKey] = useState(0);
  const [policy, setPolicy] = useState<AttributionPolicy>(getAttributionPolicy);

  return (
    <SettingsDetailLayout title="Attribution Quality" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Attribution Quality</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={async () => {
              await recomputeAttribution();
              setAttributionKey((k) => k + 1);
            }}
          >
            Recompute
          </button>
        </div>
        <p className="settings-view__helper">Set attribution policy and monitor quality</p>
        <label className="settings-view__row">
          <span className="settings-view__row-label">Policy</span>
          <select
            className="input"
            value={policy}
            onChange={(e) => {
              const next = e.target.value as AttributionPolicy;
              setPolicy(next);
              setAttributionPolicy(next);
              setAttributionKey((k) => k + 1);
            }}
          >
            <option value="soft_allow_flag">Suggest only (default)</option>
            <option value="strict_block">Strict block</option>
            <option value="soft_allow_pick_nearest">Auto-apply nearest</option>
          </select>
        </label>
        <AttributionQualitySection key={attributionKey} tasks={tasks} policy={policy} />
      </div>
    </SettingsDetailLayout>
  );
}
