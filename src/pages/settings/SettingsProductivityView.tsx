import { useState } from 'react';
import { useTaskStore } from '../../lib/stores/task-store';
import { KpiSection } from '../../components/KpiSection';
import { CalculatorSheet } from '../../components/CalculatorSheet';
import { SettingsDetailLayout } from './SettingsDetailLayout';

interface SettingsProductivityViewProps {
  onBack: () => void;
}

export function SettingsProductivityView({ onBack }: SettingsProductivityViewProps) {
  const { tasks } = useTaskStore();
  const [showCalculator, setShowCalculator] = useState(false);

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
        <p className="settings-view__helper">View KPIs and use the estimate calculator</p>
        <KpiSection tasks={tasks} />
      </div>

      <CalculatorSheet
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        tasks={tasks}
      />
    </SettingsDetailLayout>
  );
}
