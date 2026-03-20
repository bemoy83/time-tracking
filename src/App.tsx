import { Suspense, useEffect, useRef, useState } from 'react';
import { initializeTimerStore, useTimerStore } from './lib/stores/timer-store';
import { initializeTaskStore, useTaskStore } from './lib/stores/task-store';
import { initializeTemplateStore } from './lib/stores/template-store';
import { initializeWorkUnitStore } from './lib/stores/work-unit-store';
import { initializeWorkTypeStore } from './lib/stores/work-type-store';
import { initializeSyncQueue } from './lib/sync/sync-queue';
import { runWorkTypeLinkBackfill } from './lib/migrations/backfill-worktype-link';
import type { Project, Task } from './lib/types';
// import { NetworkStatus } from './components/NetworkStatus';
import { InstallPrompt } from './components/InstallPrompt';
import { LoadingBlock } from './components/LoadingBlock';
import { TodayView } from './pages/TodayView';
import { ProjectList } from './pages/ProjectList';
import { useMediaQuery, WORKSPACE_MIN_WIDTH } from './lib/hooks/useMediaQuery';
import { lazyNamedExport } from './lib/react/lazy-named-export';

type Tab = 'today' | 'projects' | 'planning' | 'fieldPlan' | 'settings';
type SettingsSection =
  | 'projects'
  | 'workUnits'
  | 'workTypes'
  | 'templates'
  | 'planLineItems'
  | 'productivity'
  | 'attribution'
  | 'remediation'
  | 'telemetry'
  | 'dataTransfer';
type ReturnTo =
  | { type: 'tab'; tab: Tab }
  | { type: 'detail'; taskId: string; returnTab: Tab };
type View =
  | { type: 'tab'; tab: Tab }
  | { type: 'detail'; taskId: string; returnTab: Tab }
  | { type: 'projectDetail'; projectId: string; returnTo: ReturnTo }
  | { type: 'settingsDetail'; section: SettingsSection; returnTab: Tab }
;

const TaskDetail = lazyNamedExport(() => import('./pages/TaskDetail'), 'TaskDetail');
const ProjectDetail = lazyNamedExport(() => import('./pages/ProjectDetail'), 'ProjectDetail');
const SettingsView = lazyNamedExport(() => import('./pages/SettingsView'), 'SettingsView');
const PlanningView = lazyNamedExport(() => import('./pages/PlanningView'), 'PlanningView');
const SettingsProjectsView = lazyNamedExport(() => import('./pages/settings/SettingsProjectsView'), 'SettingsProjectsView');
const SettingsWorkUnitsView = lazyNamedExport(() => import('./pages/settings/SettingsWorkUnitsView'), 'SettingsWorkUnitsView');
const SettingsWorkTypesView = lazyNamedExport(() => import('./pages/settings/SettingsWorkTypesView'), 'SettingsWorkTypesView');
const SettingsTemplatesView = lazyNamedExport(() => import('./pages/settings/SettingsTemplatesView'), 'SettingsTemplatesView');
const SettingsPlanLineItemsView = lazyNamedExport(() => import('./pages/settings/SettingsPlanLineItemsView'), 'SettingsPlanLineItemsView');
const SettingsProductivityView = lazyNamedExport(() => import('./pages/settings/SettingsProductivityView'), 'SettingsProductivityView');
const SettingsAttributionView = lazyNamedExport(() => import('./pages/settings/SettingsAttributionView'), 'SettingsAttributionView');
const SettingsRemediationView = lazyNamedExport(() => import('./pages/settings/SettingsRemediationView'), 'SettingsRemediationView');
const SettingsTelemetryView = lazyNamedExport(() => import('./pages/settings/SettingsTelemetryView'), 'SettingsTelemetryView');
const SettingsDataTransferView = lazyNamedExport(() => import('./pages/settings/SettingsDataTransferView'), 'SettingsDataTransferView');
const FieldPlanView = lazyNamedExport(() => import('./pages/field-plan/FieldPlanView'), 'FieldPlanView');

function App() {
  const [initialized, setInitialized] = useState(false);
  const [initTimedOut, setInitTimedOut] = useState(false);
  const { isLoading: timerLoading } = useTimerStore();
  const { isLoading: tasksLoading } = useTaskStore();
  // Sync status disabled until sync is implemented
  // const { isOnline, pendingCount, isSyncing, lastError } = useSyncState();
  const [view, setView] = useState<View>({ type: 'tab', tab: 'today' });
  const [planningLaunch, setPlanningLaunch] = useState<{
    planId: string;
    subView: 'edit' | 'progress' | 'insights';
  } | null>(null);

  // Initialize stores and sync queue on mount
  useEffect(() => {
    const INIT_TIMEOUT_MS = 15_000;

    async function initialize() {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Initialization timeout')), INIT_TIMEOUT_MS)
      );

      try {
        await Promise.race([
          Promise.all([
            initializeTimerStore(),
            initializeTaskStore(),
            initializeTemplateStore(),
            initializeWorkUnitStore(),
            initializeWorkTypeStore(),
            initializeSyncQueue(),
          ]),
          timeout,
        ]);
      } catch (err) {
        console.error('[App] Initialization failed:', err);
        setInitTimedOut(true);
        // Unblock UI so user can retry or inspect; stores may be partially ready
      }

      // Backfill legacy task/template links to WorkType deterministically.
      // This is best-effort and should never block app startup.
      try {
        await runWorkTypeLinkBackfill();
      } catch {
        // Intentionally ignore backfill failures at startup.
      }

      setInitialized(true);
    }

    void initialize();
  }, []);

  // Show network status bar when offline or has pending/errors (disabled until sync implemented)
  const showNetworkStatus = false;

  // Track the tab the user was on before entering the planning workspace
  const previousTabRef = useRef<Tab>('today');

  // Planning workspace — desktop only (dual-pane). Hidden on small screens.
  const isWideScreen = useMediaQuery(WORKSPACE_MIN_WIDTH);
  const isPlanningWorkspaceActive =
    isWideScreen &&
    view.type === 'tab' &&
    view.tab === 'planning';

  // Redirect away from planning when viewport becomes too narrow (e.g. resize)
  useEffect(() => {
    if (view.type === 'tab' && view.tab === 'planning' && !isWideScreen) {
      setView({ type: 'tab', tab: previousTabRef.current });
    }
  }, [view, isWideScreen]);

  const isLoading =
    !initialized ||
    (!initTimedOut && (timerLoading || tasksLoading));

  if (isLoading) {
    return (
      <main>
        <LoadingBlock message="Loading..." />
      </main>
    );
  }

  const currentTab =
    view.type === 'tab' ? view.tab
    : view.type === 'detail' ? view.returnTab
    : view.type === 'settingsDetail' ? view.returnTab
    : view.returnTo.type === 'tab' ? view.returnTo.tab
    : view.returnTo.returnTab;

  const handleSelectTask = (task: Task) => {
    setView({ type: 'detail', taskId: task.id, returnTab: currentTab });
  };

  const handleBack = () => {
    if (view.type === 'projectDetail') {
      setView(view.returnTo);
    } else if (view.type === 'settingsDetail') {
      setView({ type: 'tab', tab: view.returnTab });
    } else {
      setView({ type: 'tab', tab: currentTab });
    }
  };

  const handleTabChange = (tab: Tab) => {
    if (tab !== 'planning') {
      setPlanningLaunch(null);
    }
    // Track the previous tab so workspace exit can return to it
    if (tab === 'planning' && currentTab !== 'planning') {
      previousTabRef.current = currentTab;
    }
    setView({ type: 'tab', tab });
  };

  const handleExitWorkspace = () => {
    setPlanningLaunch(null);
    setView({ type: 'tab', tab: previousTabRef.current });
  };

  const handleNavigateToProject = (project: Project) => {
    setView({
      type: 'projectDetail',
      projectId: project.id,
      returnTo: view.type === 'tab' || view.type === 'detail' ? view : view.type === 'settingsDetail' ? { type: 'tab' as const, tab: view.returnTab } : view.returnTo,
    });
  };

  const rootClass = [
    showNetworkStatus && 'has-network-status',
  ]
    .filter(Boolean)
    .join(' ');

  const routeContent = (
    <>
      {view.type === 'tab' && view.tab === 'today' && (
        <TodayView
          onSelectTask={handleSelectTask}
        />
      )}
      {view.type === 'tab' && view.tab === 'projects' && (
        <ProjectList onSelectProject={handleNavigateToProject} />
      )}
      {view.type === 'tab' && view.tab === 'planning' && (
        <PlanningView
          initialPlanId={planningLaunch?.planId ?? null}
          initialSubView={planningLaunch?.subView}
          onInitialNavigationHandled={() => setPlanningLaunch(null)}
          onExitWorkspace={handleExitWorkspace}
        />
      )}
      {view.type === 'tab' && view.tab === 'fieldPlan' && (
        <FieldPlanView />
      )}
      {view.type === 'tab' && view.tab === 'settings' && (
        <SettingsView
          onNavigateToSection={(section) =>
            setView({ type: 'settingsDetail', section, returnTab: 'settings' })
          }
        />
      )}
      {view.type === 'detail' && (
        <TaskDetail
          taskId={view.taskId}
          onBack={handleBack}
          onSelectTask={handleSelectTask}
          onNavigateToProject={handleNavigateToProject}
        />
      )}
      {view.type === 'projectDetail' && (
        <ProjectDetail
          projectId={view.projectId}
          onBack={handleBack}
          onSelectTask={handleSelectTask}
          onOpenPlanReview={(planId) => {
            setPlanningLaunch({ planId, subView: 'progress' });
            setView({ type: 'tab', tab: 'planning' });
          }}
        />
      )}
      {view.type === 'settingsDetail' && view.section === 'workTypes' && (
        <SettingsWorkTypesView
          onBack={handleBack}
          onManageUnits={() => setView({ type: 'settingsDetail', section: 'workUnits', returnTab: 'settings' })}
        />
      )}
      {view.type === 'settingsDetail' && view.section === 'workUnits' && (
        <SettingsWorkUnitsView onBack={handleBack} />
      )}
      {view.type === 'settingsDetail' && view.section === 'projects' && (
        <SettingsProjectsView onBack={handleBack} />
      )}
      {view.type === 'settingsDetail' && view.section === 'templates' && (
        <SettingsTemplatesView onBack={handleBack} />
      )}
      {view.type === 'settingsDetail' && view.section === 'planLineItems' && (
        <SettingsPlanLineItemsView onBack={handleBack} />
      )}
      {view.type === 'settingsDetail' && view.section === 'productivity' && (
        <SettingsProductivityView onBack={handleBack} />
      )}
      {view.type === 'settingsDetail' && view.section === 'attribution' && (
        <SettingsAttributionView
          onBack={handleBack}
          onOpenRemediation={() => setView({ type: 'settingsDetail', section: 'remediation', returnTab: 'settings' })}
        />
      )}
      {view.type === 'settingsDetail' && view.section === 'remediation' && (
        <SettingsRemediationView onBack={handleBack} />
      )}
      {view.type === 'settingsDetail' && view.section === 'telemetry' && (
        <SettingsTelemetryView onBack={handleBack} />
      )}
      {view.type === 'settingsDetail' && view.section === 'dataTransfer' && (
        <SettingsDataTransferView onBack={handleBack} />
      )}
    </>
  );

  return (
    <div className={rootClass || undefined}>
      {/* Network status bar - disabled until sync is implemented */}
      {/* <NetworkStatus /> */}

      <main
        id="main-content"
        role="main"
        aria-label="Main content"
        className={isPlanningWorkspaceActive ? 'main--workspace' : undefined}
      >
        <Suspense fallback={<LoadingBlock message="Loading..." />}>
          {routeContent}
        </Suspense>
      </main>

      {/* Tab Navigation */}
      {view.type === 'tab' && (
        <nav className={`tab-nav${isPlanningWorkspaceActive ? ' tab-nav--hidden' : ''}`} role="navigation" aria-label="Main navigation">
          <button
            className={`tab-nav__btn ${currentTab === 'today' ? 'tab-nav__btn--active' : ''}`}
            onClick={() => handleTabChange('today')}
            aria-label="Today view"
            aria-current={currentTab === 'today' ? 'page' : undefined}
          >
            <TodayIcon />
            <span>Today</span>
          </button>
          <button
            className={`tab-nav__btn ${currentTab === 'fieldPlan' ? 'tab-nav__btn--active' : ''}`}
            onClick={() => handleTabChange('fieldPlan')}
            aria-label="Field Plan"
            aria-current={currentTab === 'fieldPlan' ? 'page' : undefined}
          >
            <FieldPlanIcon />
            <span>Field Plan</span>
          </button>
          <button
            className={`tab-nav__btn ${currentTab === 'projects' ? 'tab-nav__btn--active' : ''}`}
            onClick={() => handleTabChange('projects')}
            aria-label="Projects"
            aria-current={currentTab === 'projects' ? 'page' : undefined}
          >
            <ProjectsIcon />
            <span>Projects</span>
          </button>
          {isWideScreen && (
            <button
              className={`tab-nav__btn ${currentTab === 'planning' ? 'tab-nav__btn--active' : ''}`}
              onClick={() => handleTabChange('planning')}
              aria-label="Planning"
              aria-current={currentTab === 'planning' ? 'page' : undefined}
            >
              <PlanningIcon />
              <span>Planning</span>
            </button>
          )}
          <button
            className={`tab-nav__btn ${currentTab === 'settings' ? 'tab-nav__btn--active' : ''}`}
            onClick={() => handleTabChange('settings')}
            aria-label="Settings"
            aria-current={currentTab === 'settings' ? 'page' : undefined}
          >
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </nav>
      )}

      {/* Install prompt for PWA */}
      <InstallPrompt />

    </div>
  );
}

// Tab Icons
function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="tab-nav__icon">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="tab-nav__icon">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z" />
    </svg>
  );
}

function PlanningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="tab-nav__icon">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" />
    </svg>
  );
}

function FieldPlanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="tab-nav__icon">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="tab-nav__icon">
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
    </svg>
  );
}

export default App;
