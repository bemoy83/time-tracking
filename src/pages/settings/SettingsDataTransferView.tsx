import { ExecutionReturnTransferCard } from './cards/ExecutionReturnTransferCard';
import { FullBackupTransferCard } from './cards/FullBackupTransferCard';
import { PlanPackageTransferCard } from './cards/PlanPackageTransferCard';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import './settings-styles';

interface SettingsDataTransferViewProps {
  onBack: () => void;
}

export function SettingsDataTransferView({ onBack }: SettingsDataTransferViewProps) {
  return (
    <SettingsDetailLayout title="Data Transfer" onBack={onBack}>
      <FullBackupTransferCard />
      <PlanPackageTransferCard />
      <ExecutionReturnTransferCard />
    </SettingsDetailLayout>
  );
}
