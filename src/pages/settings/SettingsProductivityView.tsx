import { useState } from 'react';
import { useTaskStore } from '../../lib/stores/task-store';
import { KpiSection } from '../../components/KpiSection';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { getOutlierHandlingMode, setOutlierHandlingMode } from '../../lib/stores/kpi-settings';
import type { OutlierHandlingMode } from '../../lib/kpi';

interface SettingsProductivityViewProps {
  onBack: () => void;
}

export function SettingsProductivityView({ onBack }: SettingsProductivityViewProps) {
  const { tasks } = useTaskStore();
  const [showCalculator, setShowCalculator] = useState(false);
  const [outlierMode, setOutlierMode] = useState<OutlierHandlingMode>(getOutlierHandlingMode);

  return (
    <SettingsDetailLayout title="Productivity" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Productivity</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setShowCalculator(true)}
          >
            Calculator
          </button>
        </div>
        <p className="settings-view__helper">View KPIs and use the estimate calculator.</p>
        <label className="productivity__outlier-control">
          <span className="productivity__outlier-label">Outlier Handling</span>
          <select
            className="input"
            value={outlierMode}
            onChange={(e) => {
              const next = e.target.value as OutlierHandlingMode;
              setOutlierMode(next);
              setOutlierHandlingMode(next);
            }}
          >
            <option value="report_only">Report only (default)</option>
            <option value="exclude_from_rate">Exclude from KPI averages</option>
          </select>
        </label>
        <KpiSection tasks={tasks} outlierMode={outlierMode} />
      </div>

      <CalculatorSheet
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        tasks={tasks}
        outlierMode={outlierMode}
      />
    </SettingsDetailLayout>
  );
}
