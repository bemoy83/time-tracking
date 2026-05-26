import { useCallback, useRef } from 'react';
import { getPlanDisplayName, type Plan } from '../../../lib/planning/plan-model';
import { getProjectDisplayColor, type Project, type Task, type TimeEntry, type WorkType } from '../../../lib/types';
import type { WorkTypeKpi } from '../../../lib/kpi';
import { isPlanArchived, isPlanWrapUpEligible } from '../../../lib/planning/plan-lifecycle';
import type { WorkspaceTab } from '../hooks/usePlanningWorkspaceState';
import { getVisiblePlanWorkspaceTabs } from './workspace-tabs';
import { WorkspaceTabButton } from './WorkspaceTabButton';
import { PlanEditor } from '../PlanEditor';
import { ScheduleView } from '../ScheduleView';
import { ProgressView } from '../ProgressView';
import { InsightsView } from '../InsightsView';
import { EventReportView } from '../EventReportView';
import { StatusBadge } from '../../../components/StatusBadge';
import type { ScheduleEditContextValue } from './ScheduleEditContext';

function formatContextDateRange(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  return fmt(end!);
}

export interface WorkspaceMainPaneProps {
  plan: Plan;
  activeTab: WorkspaceTab;
  tasks: Task[];
  projects: Project[];
  workTypes: WorkType[];
  kpis: WorkTypeKpi[];
  timeEntries: TimeEntry[];
  timeEntriesByTask: Map<string, TimeEntry[]>;
  hasLinkedTasks: boolean;
  onSavePlan: (plan: Plan) => void;
  onSetActiveTab: (tab: WorkspaceTab) => void;
  onOpenProgress: () => void;
  onOpenWrapUp: (plan: Plan) => void;
  planIdsWithImportedExecutionReturns: Set<string>;
  onScheduleContextChange: (ctx: ScheduleEditContextValue | null) => void;
}

export function WorkspaceMainPane({
  plan,
  activeTab,
  tasks,
  projects,
  workTypes,
  kpis,
  timeEntries,
  timeEntriesByTask,
  hasLinkedTasks,
  onSavePlan,
  onSetActiveTab,
  onOpenProgress,
  onOpenWrapUp,
  onScheduleContextChange,
  planIdsWithImportedExecutionReturns,
}: WorkspaceMainPaneProps) {
  const beforeScheduleTabRef = useRef<(() => Promise<void>) | null>(null);
  const selectedProject = plan.projectId
    ? projects.find((project) => project.id === plan.projectId) ?? null
    : null;
  const planDisplayName = getPlanDisplayName(plan, selectedProject);
  const projectAccentColor = selectedProject ? getProjectDisplayColor(selectedProject.color) : null;

  const isReviewed = isPlanArchived(plan);
  const wrapUpEligible = isPlanWrapUpEligible(plan, tasks, planIdsWithImportedExecutionReturns.has(plan.id));
  const showScheduleTab = !isReviewed;
  const effectiveActiveTab: WorkspaceTab =
    activeTab === 'schedule' && !showScheduleTab ? 'edit' : activeTab;

  const handleSetActiveTab = useCallback(
    (tab: WorkspaceTab) => {
      if (tab === 'schedule') {
        void (async () => {
          await (beforeScheduleTabRef.current?.() ?? Promise.resolve());
          onSetActiveTab('schedule');
        })();
      } else {
        onSetActiveTab(tab);
      }
    },
    [onSetActiveTab],
  );

  const tabs = getVisiblePlanWorkspaceTabs({
    hasLinkedTasks,
    isReviewed,
    reviewReady: wrapUpEligible,
    onOpenProgress,
    onSetActiveTab: handleSetActiveTab,
    showScheduleTab,
    onOpenInsights: () => onSetActiveTab('insights'),
  });
  const reviewedDateText = plan.reviewedAt
    ? ` on ${new Date(plan.reviewedAt).toLocaleDateString()}`
    : '';

  const assemblyDateRange = formatContextDateRange(plan.assemblyStartDate, plan.assemblyEndDate);
  const dismantleDateRange = formatContextDateRange(plan.dismantleStartDate, plan.dismantleEndDate);

  return (
    <div className="planning-workspace__main-inner">
      {/* Plan context bar */}
      <div
        className={`planning-workspace__plan-context-bar${projectAccentColor ? ' planning-workspace__plan-context-bar--has-project' : ''}`}
        style={projectAccentColor ? { '--planning-workspace-project-accent': projectAccentColor } as React.CSSProperties : undefined}
      >
        <span className="planning-workspace__plan-context-title">{planDisplayName}</span>
        <StatusBadge variant={wrapUpEligible ? 'review-ready' : plan.status === 'active' ? 'ready' : plan.status} />
        {(assemblyDateRange || dismantleDateRange) && (
          <span className="planning-workspace__plan-context-phases">
            {assemblyDateRange && (
              <span className="planning-workspace__plan-context-phase">
                <span className="planning-workspace__plan-context-phase-dot planning-workspace__plan-context-phase-dot--assembly" />
                <span className="mono">{assemblyDateRange}</span>
              </span>
            )}
            {dismantleDateRange && (
              <span className="planning-workspace__plan-context-phase">
                <span className="planning-workspace__plan-context-phase-dot planning-workspace__plan-context-phase-dot--dismantle" />
                <span className="mono">{dismantleDateRange}</span>
              </span>
            )}
          </span>
        )}
      </div>
      {/* Context-aware tab strip */}
      <nav className="planning-workspace__tabs" role="tablist" aria-label="Plan views">
        {tabs.map((tab) => (
          <WorkspaceTabButton
            key={tab.id}
            tab={tab.id}
            activeTab={effectiveActiveTab}
            onClick={tab.onSelect}
          >
            {tab.label}
          </WorkspaceTabButton>
        ))}
      </nav>

      {/* Tab content */}
      <div className="planning-workspace__tab-content" role="tabpanel">
        {isReviewed && (
          <div className="planning-workspace__reviewed-banner">
            This plan was reviewed and archived{reviewedDateText}.
          </div>
        )}
        {effectiveActiveTab === 'edit' && (
          <div className="planning-workspace__editor-canvas">
            <PlanEditor
              plan={plan}
              kpis={kpis}
              projects={projects}
              canOpenProgress={hasLinkedTasks}
              showBackButton={false}
              readOnly={isReviewed}
              onSave={onSavePlan}
              onBack={() => onSetActiveTab('edit')}
              onOpenSchedule={showScheduleTab ? () => onSetActiveTab('schedule') : undefined}
              onOpenProgress={onOpenProgress}
              onOpenReport={() => onSetActiveTab('report')}
              onRegisterBeforeScheduleSwitch={(fn) => {
                beforeScheduleTabRef.current = fn ?? null;
              }}
            />
          </div>
        )}
        {effectiveActiveTab === 'progress' && (
          <div className="planning-workspace__editor-canvas">
            <ProgressView
              plan={plan}
              tasks={tasks}
              timeEntries={timeEntries}
              showBackButton={false}
              onBack={() => onSetActiveTab('edit')}
              onWrapUp={!isReviewed && wrapUpEligible ? () => onOpenWrapUp(plan) : undefined}
            />
          </div>
        )}
        {effectiveActiveTab === 'insights' && (
          <div className="planning-workspace__editor-canvas">
            <InsightsView
              tasks={tasks}
              workTypes={workTypes}
              planId={plan.id}
              planTitle={planDisplayName}
              projects={projects}
            />
          </div>
        )}
        {effectiveActiveTab === 'schedule' && showScheduleTab && (
          <div className="planning-workspace__editor-canvas">
            <ScheduleView
              plan={plan}
              onSave={onSavePlan}
              showBackButton={false}
              onBack={() => onSetActiveTab('edit')}
              readOnly={isReviewed}
              onScheduleContextChange={onScheduleContextChange}
            />
          </div>
        )}
        {effectiveActiveTab === 'review' && (
          <div className="planning-workspace__editor-canvas">
            <div className="planning-workspace__review-prompt">
              <p>This plan is ready for review and wrap-up.</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onOpenWrapUp(plan)}
              >
                Start Wrap Up
              </button>
            </div>
          </div>
        )}
        {effectiveActiveTab === 'report' && isReviewed && (
          <EventReportView
            plan={plan}
            tasks={tasks}
            timeEntriesByTask={timeEntriesByTask}
            showBackButton={false}
            onBack={() => onSetActiveTab('edit')}
          />
        )}
      </div>
    </div>
  );
}
