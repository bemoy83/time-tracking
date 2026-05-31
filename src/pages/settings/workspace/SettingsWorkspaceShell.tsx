import { Suspense, useState } from 'react';
import { SettingsNavSidebar } from './SettingsNavSidebar';
import { LoadingBlock } from '../../../components/LoadingBlock';
import { lazyNamedExport } from '../../../lib/react/lazy-named-export';

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

const SettingsWorkTypesView   = lazyNamedExport(() => import('../SettingsWorkTypesView'),   'SettingsWorkTypesView');
const SettingsTagsView        = lazyNamedExport(() => import('../SettingsTagsView'),        'SettingsTagsView');
const SettingsTagSequenceView = lazyNamedExport(() => import('../SettingsTagSequenceView'), 'SettingsTagSequenceView');
const SettingsCrewView        = lazyNamedExport(() => import('../SettingsCrewView'),        'SettingsCrewView');
const SettingsWorkUnitsView   = lazyNamedExport(() => import('../SettingsWorkUnitsView'),   'SettingsWorkUnitsView');
const SettingsProjectsView    = lazyNamedExport(() => import('../SettingsProjectsView'),    'SettingsProjectsView');
const SettingsTemplatesView   = lazyNamedExport(() => import('../SettingsTemplatesView'),   'SettingsTemplatesView');
const SettingsPlanLineItemsView = lazyNamedExport(() => import('../SettingsPlanLineItemsView'), 'SettingsPlanLineItemsView');
const SettingsProductivityView  = lazyNamedExport(() => import('../SettingsProductivityView'),  'SettingsProductivityView');
const SettingsAttributionView   = lazyNamedExport(() => import('../SettingsAttributionView'),   'SettingsAttributionView');
const SettingsRemediationView   = lazyNamedExport(() => import('../SettingsRemediationView'),   'SettingsRemediationView');
const SettingsTelemetryView     = lazyNamedExport(() => import('../SettingsTelemetryView'),     'SettingsTelemetryView');
const SettingsCloudSyncView     = lazyNamedExport(() => import('../SettingsCloudSyncView'),     'SettingsCloudSyncView');
const SettingsDataTransferView  = lazyNamedExport(() => import('../SettingsDataTransferView'),  'SettingsDataTransferView');

interface SettingsWorkspaceShellProps {
  initialSection: SettingsSection;
  onExit: () => void;
}

const noop = () => {};

export function SettingsWorkspaceShell({ initialSection, onExit }: SettingsWorkspaceShellProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  function renderSection() {
    switch (activeSection) {
      case 'workTypes':
        return (
          <SettingsWorkTypesView
            onBack={noop}
            onManageUnits={() => setActiveSection('workUnits')}
          />
        );
      case 'tags':
        return <SettingsTagsView onBack={noop} />;
      case 'tagSequence':
        return <SettingsTagSequenceView onBack={noop} />;
      case 'crew':
        return <SettingsCrewView onBack={noop} />;
      case 'workUnits':
        return <SettingsWorkUnitsView onBack={noop} />;
      case 'projects':
        return <SettingsProjectsView onBack={noop} />;
      case 'templates':
        return <SettingsTemplatesView onBack={noop} />;
      case 'planLineItems':
        return <SettingsPlanLineItemsView onBack={noop} />;
      case 'productivity':
        return <SettingsProductivityView onBack={noop} />;
      case 'attribution':
        return (
          <SettingsAttributionView
            onBack={noop}
            onOpenRemediation={() => setActiveSection('remediation')}
          />
        );
      case 'remediation':
        return <SettingsRemediationView onBack={noop} />;
      case 'telemetry':
        return <SettingsTelemetryView onBack={noop} />;
      case 'cloudSync':
        return <SettingsCloudSyncView onBack={noop} />;
      case 'dataTransfer':
        return <SettingsDataTransferView onBack={noop} />;
    }
  }

  return (
    <div className="settings-workspace">
      <div className="settings-workspace__nav">
        <SettingsNavSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onExit={onExit}
        />
      </div>
      <div className="settings-workspace__body">
        <div className="settings-workspace__content">
          <Suspense fallback={<LoadingBlock message="Loading…" />}>
            {renderSection()}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
