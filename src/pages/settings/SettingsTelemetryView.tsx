import { useState } from 'react';
import { getTelemetrySnapshot, type TelemetryEventName } from '../../lib/telemetry/telemetry';
import { SettingsDetailLayout } from './SettingsDetailLayout';

interface SettingsTelemetryViewProps {
  onBack: () => void;
}

export function SettingsTelemetryView({ onBack }: SettingsTelemetryViewProps) {
  const [telemetrySnapshot, setTelemetrySnapshot] = useState(getTelemetrySnapshot);

  const handleRefresh = () => {
    setTelemetrySnapshot(getTelemetrySnapshot());
  };

  return (
    <SettingsDetailLayout title="Telemetry" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Telemetry</h2>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleRefresh}
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
              <div key={name} className="settings-view__row settings-view__kpi-row">
                <div className="settings-view__template-info">
                  <span className="settings-view__row-label">{name}</span>
                  <span className="settings-view__row-detail settings-view__kpi-stats">
                    {record.count} events · last {new Date(record.lastAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsDetailLayout>
  );
}
