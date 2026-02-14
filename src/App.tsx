import { useEffect, useState } from 'react';
import { initializeTimerStore, useTimerStore } from './lib/stores/timer-store';
import { initializeTaskStore, useTaskStore } from './lib/stores/task-store';
import { initializeSyncQueue, useSyncState } from './lib/sync/sync-queue';
import { Task, Project } from './lib/types';
import { TimerBar } from './components/TimerBar';
import { NetworkStatus } from './components/NetworkStatus';
import { InstallPrompt } from './components/InstallPrompt';
import { TodayView } from './pages/TodayView';
import { TaskDetail } from './pages/TaskDetail';
import { ProjectList } from './pages/ProjectList';
import { ProjectDetail } from './pages/ProjectDetail';

type Tab = 'today' | 'projects';
type ReturnTo =
  | { type: 'tab'; tab: Tab }
  | { type: 'detail'; taskId: string; returnTab: Tab };
type View =
  | { type: 'tab'; tab: Tab }
  | { type: 'detail'; taskId: string; returnTab: Tab }
  | { type: 'projectDetail'; projectId: string; returnTo: ReturnTo };

function App() {
  const [initialized, setInitialized] = useState(false);
  const { isLoading: timerLoading, activeTimer } = useTimerStore();
  const { isLoading: tasksLoading } = useTaskStore();
  const { isOnline, pendingCount, isSyncing, lastError } = useSyncState();
  const [view, setView] = useState<View>({ type: 'tab', tab: 'today' });

  // Initialize stores and sync queue on mount
  useEffect(() => {
    Promise.all([
      initializeTimerStore(),
      initializeTaskStore(),
      initializeSyncQueue(),
    ]).then(() => setInitialized(true));
  }, []);

  // Show network status bar when offline or has pending/errors
  const showNetworkStatus = !isOnline || pendingCount > 0 || isSyncing || !!lastError;

  const isLoading = !initialized || timerLoading || tasksLoading;

  if (isLoading) {
    return (
      <main>
        <p>Loading...</p>
      </main>
    );
  }

  const currentTab =
    view.type === 'tab' ? view.tab
    : view.type === 'detail' ? view.returnTab
    : view.returnTo.type === 'tab' ? view.returnTo.tab
    : view.returnTo.returnTab;

  const handleSelectTask = (task: Task) => {
    setView({ type: 'detail', taskId: task.id, returnTab: currentTab });
  };

  const handleBack = () => {
    if (view.type === 'projectDetail') {
      setView(view.returnTo);
    } else {
      setView({ type: 'tab', tab: currentTab });
    }
  };

  const handleTabChange = (tab: Tab) => {
    setView({ type: 'tab', tab });
  };

  const handleNavigateToProject = (project: Project) => {
    setView({
      type: 'projectDetail',
      projectId: project.id,
      returnTo: view.type === 'tab' || view.type === 'detail' ? view : view.returnTo,
    });
  };

  const rootClass = [
    showNetworkStatus && 'has-network-status',
    activeTimer && 'is-tracking',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass || undefined}>
      {/* Network status bar */}
      <NetworkStatus />

      <main id="main-content" role="main" aria-label="Main content">
        {view.type === 'tab' && view.tab === 'today' && (
          <TodayView onSelectTask={handleSelectTask} />
        )}
        {view.type === 'tab' && view.tab === 'projects' && (
          <ProjectList onSelectProject={handleNavigateToProject} />
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
          />
        )}
      </main>

      {/* Tab Navigation */}
      {view.type === 'tab' && (
        <nav className="tab-nav" role="navigation" aria-label="Main navigation">
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
            className={`tab-nav__btn ${currentTab === 'projects' ? 'tab-nav__btn--active' : ''}`}
            onClick={() => handleTabChange('projects')}
            aria-label="Projects"
            aria-current={currentTab === 'projects' ? 'page' : undefined}
          >
            <ProjectsIcon />
            <span>Projects</span>
          </button>
        </nav>
      )}

      {/* Install prompt for PWA */}
      <InstallPrompt />

      {activeTimer && <TimerBar />}
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

function ProjectsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="tab-nav__icon">
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
    </svg>
  );
}

export default App;
