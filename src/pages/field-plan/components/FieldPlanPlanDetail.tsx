import { useMemo } from 'react';
import { CountBadge } from '../../../components/CountBadge';
import { ProjectColorDot } from '../../../components/ProjectColorDot';
import { TagFilterPanel } from '../../../components/TagFilterPanel';
import { useTagFilter } from '../../../components/useTagFilter';
import {
  CheckIcon,
  ClockIcon,
  ExpandChevronIcon,
  PlayIcon,
  TaskListIcon,
  WarningIcon,
} from '../../../components/icons';
import { BUILD_PHASE_LABELS, type BuildPhase, type Task } from '../../../lib/types';
import { FIELD_EXECUTION_RETURN_EXPLANATION } from '../../../lib/interop/data-transfer/handoff-copy';
import type { FieldPlanLineItemSummary } from '../field-plan-model';
import type { FieldPlanStatusGroups } from '../field-plan-overlay-types';
import { FieldPlanLineItemRow } from './FieldPlanLineItemRow';
import { FieldPlanReleaseBatchButton } from './FieldPlanReleaseBatchButton';

interface LineItemStatusSummary {
  completed: number;
}

interface DeadlineSummary {
  overdue: number;
  atRisk: number;
}

interface FieldPlanPlanDetailProps {
  planId: string;
  planDisplayName: string;
  projectColor?: string;
  importedAt: string | null;
  lastExecutionReturnExportedAt: string | null;
  progressPercent: number;
  lineItemStatusSummary: LineItemStatusSummary;
  lineItems: FieldPlanLineItemSummary[];
  deadlineSummary: DeadlineSummary;
  statusGroups: FieldPlanStatusGroups;
  completedExpanded: boolean;
  deferredExpanded: boolean;
  canExecute: boolean;
  personHours: string;
  unplannedTasks: Task[];
  phaseFilter: 'all' | BuildPhase;
  onPhaseFilterChange: (filter: 'all' | BuildPhase) => void;
  onToggleCompletedExpanded: () => void;
  onToggleDeferredExpanded: () => void;
  onReleaseEligibleBatch: (items: FieldPlanLineItemSummary[]) => void;
  onReleaseToToday: (lineItem: FieldPlanLineItemSummary) => void;
  onOpenActions: (lineItem: FieldPlanLineItemSummary) => void;
  onExportExecutionReturn: () => void;
}

export function FieldPlanPlanDetail({
  planId,
  planDisplayName,
  projectColor,
  importedAt,
  lastExecutionReturnExportedAt,
  progressPercent,
  lineItemStatusSummary,
  lineItems,
  deadlineSummary,
  statusGroups,
  completedExpanded,
  deferredExpanded,
  canExecute,
  personHours,
  unplannedTasks,
  phaseFilter,
  onPhaseFilterChange,
  onToggleCompletedExpanded,
  onToggleDeferredExpanded,
  onReleaseEligibleBatch,
  onReleaseToToday,
  onOpenActions,
  onExportExecutionReturn,
}: FieldPlanPlanDetailProps) {
  // Collect tag IDs present across all line items in this plan
  const availableTagIds = useMemo(() => {
    const set = new Set<string>();
    for (const li of lineItems) {
      for (const id of li.item.tagIds ?? []) set.add(id);
    }
    return [...set];
  }, [lineItems]);

  const tagFilter = useTagFilter(availableTagIds, { resetKey: planId });

  const pendingScopeLabel = useMemo(() => {
    let label = phaseFilter === 'all' ? 'Pending' : `Pending (${BUILD_PHASE_LABELS[phaseFilter]})`;
    if (tagFilter.hasActiveFilters) {
      label += ' · filtered by tags';
    }
    return label;
  }, [phaseFilter, tagFilter.hasActiveFilters]);

  const filteredStatusGroups: FieldPlanStatusGroups = useMemo(() => {
    const { activeTagFilters } = tagFilter;
    if (activeTagFilters.size === 0) return statusGroups;
    // Tag filters narrow the visible lists only; header summary props remain plan-wide values from the parent model.
    const filter = <T extends FieldPlanLineItemSummary>(items: T[]): T[] =>
      items.filter((li) => (li.item.tagIds ?? []).some((id) => activeTagFilters.has(id)));
    return {
      inProgress: filter(statusGroups.inProgress),
      blocked: filter(statusGroups.blocked),
      pending: filter(statusGroups.pending),
      completed: filter(statusGroups.completed),
      deferred: filter(statusGroups.deferred),
    };
  }, [statusGroups, tagFilter]);

  return (
    <>
      <section className="field-plan__header-card">
        <div className="field-plan__header-title-row">
          {projectColor && (
            <ProjectColorDot color={projectColor} size="xl" className="field-plan__header-dot" />
          )}
          <h3 className="field-plan__plan-title">{planDisplayName}</h3>
        </div>
        <div className="field-plan__progress">
          <div className="field-plan__progress-track" aria-hidden="true">
            <div
              className="field-plan__progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="field-plan__progress-label">
            {lineItemStatusSummary.completed}/{lineItems.length} completed
          </span>
        </div>
        <div className="field-plan__summary-row">
          <span className="field-plan__summary-stat">
            <ClockIcon className="field-plan__summary-icon" />
            {personHours}
          </span>
          {deadlineSummary.overdue > 0 && (
            <span className="field-plan__summary-stat field-plan__summary-stat--risk">
              {deadlineSummary.overdue} overdue
            </span>
          )}
          {deadlineSummary.atRisk > 0 && (
            <span className="field-plan__summary-stat field-plan__summary-stat--warning">
              {deadlineSummary.atRisk} at risk
            </span>
          )}
        </div>
        <div className="field-plan__handoff-status" aria-label="Handoff status">
          <p className="field-plan__handoff-title">Handoff status</p>
          <p className="field-plan__handoff-row">
            Imported to device: {importedAt ? new Date(importedAt).toLocaleString() : 'Unknown'}
          </p>
          <p className="field-plan__handoff-row">
            Last execution return export: {lastExecutionReturnExportedAt ? new Date(lastExecutionReturnExportedAt).toLocaleString() : 'Not yet exported'}
          </p>
          <p className="field-plan__handoff-row">
            {FIELD_EXECUTION_RETURN_EXPLANATION}
          </p>
        </div>
        <div
          className="field-plan__filter-group"
          role="group"
          aria-labelledby="field-plan-phase-filter-label"
        >
          <h4 className="field-plan__filter-heading" id="field-plan-phase-filter-label">
            Filter by phase
          </h4>
          <div className="field-plan__phase-filter">
            {(['all', 'assembly', 'dismantle'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`field-plan__phase-filter-btn${phaseFilter === f ? ' field-plan__phase-filter-btn--active' : ''}`}
                onClick={() => onPhaseFilterChange(f)}
              >
                {f === 'all' ? 'All' : BUILD_PHASE_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
        {tagFilter.availableCategories.length > 0 && (
          <div
            className="field-plan__filter-group"
            role="group"
            aria-labelledby="field-plan-tag-filter-label"
          >
            <h4 className="field-plan__filter-heading" id="field-plan-tag-filter-label">
              Filter by tags
            </h4>
            <TagFilterPanel
              activeTagFilters={tagFilter.activeTagFilters}
              tagSearchQuery={tagFilter.tagSearchQuery}
              selectedCategoryId={tagFilter.selectedCategoryId}
              availableCategories={tagFilter.availableCategories}
              displayedTags={tagFilter.displayedTags}
              hasActiveFilters={tagFilter.hasActiveFilters}
              onToggleTag={tagFilter.toggleTagFilter}
              onSearchChange={tagFilter.setTagSearchQuery}
              onCategoryChange={tagFilter.setSelectedCategoryId}
              onClearFilters={tagFilter.clearTagFilters}
            />
          </div>
        )}
      </section>

      {filteredStatusGroups.inProgress.length > 0 && (
        <section className="field-plan__section">
          <h2 className="field-plan__section-title section-heading">
            <PlayIcon className="field-plan__icon" />
            In Progress
            <CountBadge count={filteredStatusGroups.inProgress.length} variant="muted" />
          </h2>
          <div className="field-plan__task-list field-plan__task-list--active">
            {filteredStatusGroups.inProgress.map((li) => (
              <FieldPlanLineItemRow
                key={`${li.item.id}:${li.phase}`}
                lineItem={li}
                projectColor={projectColor}
                canExecute={canExecute}
                onRelease={onReleaseToToday}
                onOpenActions={onOpenActions}
              />
            ))}
          </div>
        </section>
      )}

      {filteredStatusGroups.blocked.length > 0 && (
        <section className="field-plan__section">
          <h2 className="field-plan__section-title section-heading section-heading--blocked">
            <WarningIcon className="field-plan__icon" />
            Blocked
            <CountBadge count={filteredStatusGroups.blocked.length} variant="muted" />
          </h2>
          <div className="field-plan__task-list field-plan__task-list--blocked">
            {filteredStatusGroups.blocked.map((li) => (
              <FieldPlanLineItemRow
                key={`${li.item.id}:${li.phase}`}
                lineItem={li}
                projectColor={projectColor}
                canExecute={canExecute}
                onRelease={onReleaseToToday}
                onOpenActions={onOpenActions}
              />
            ))}
          </div>
        </section>
      )}

      {filteredStatusGroups.pending.length > 0 && (
        <section className="field-plan__section">
          <div className="field-plan__section-heading-row">
            <h2 className="field-plan__section-title section-heading">
              <TaskListIcon className="field-plan__icon" />
              Pending
              <CountBadge count={filteredStatusGroups.pending.length} variant="muted" />
            </h2>
            <FieldPlanReleaseBatchButton
              lineItems={filteredStatusGroups.pending}
              scopeLabel={pendingScopeLabel}
              onReleaseBatch={onReleaseEligibleBatch}
            />
          </div>
          <div className="field-plan__task-list">
            {filteredStatusGroups.pending.map((li) => (
              <FieldPlanLineItemRow
                key={`${li.item.id}:${li.phase}`}
                lineItem={li}
                projectColor={projectColor}
                canExecute={canExecute}
                onRelease={onReleaseToToday}
                onOpenActions={onOpenActions}
              />
            ))}
          </div>
        </section>
      )}

      {filteredStatusGroups.completed.length > 0 && (
        <section className="field-plan__section field-plan__section--completed">
          <button
            type="button"
            className="field-plan__collapsible-toggle"
            onClick={onToggleCompletedExpanded}
            aria-expanded={completedExpanded}
          >
            <CheckIcon className="field-plan__toggle-icon field-plan__toggle-icon--ready" />
            <span>Completed</span>
            <CountBadge count={filteredStatusGroups.completed.length} variant="muted" />
            <ExpandChevronIcon
              className={`field-plan__toggle-chevron${completedExpanded ? ' field-plan__toggle-chevron--expanded' : ''}`}
            />
          </button>
          {completedExpanded && (
            <div className="field-plan__task-list field-plan__task-list--completed">
              {filteredStatusGroups.completed.map((li) => (
                <FieldPlanLineItemRow
                  key={`${li.item.id}:${li.phase}`}
                  lineItem={li}
                  projectColor={projectColor}
                  canExecute={canExecute}
                  onRelease={onReleaseToToday}
                  onOpenActions={onOpenActions}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {filteredStatusGroups.deferred.length > 0 && (
        <section className="field-plan__section field-plan__section--deferred">
          <button
            type="button"
            className="field-plan__collapsible-toggle"
            onClick={onToggleDeferredExpanded}
            aria-expanded={deferredExpanded}
          >
            <span>Deferred</span>
            <CountBadge count={filteredStatusGroups.deferred.length} variant="muted" />
            <ExpandChevronIcon
              className={`field-plan__toggle-chevron${deferredExpanded ? ' field-plan__toggle-chevron--expanded' : ''}`}
            />
          </button>
          {deferredExpanded && (
            <div className="field-plan__task-list field-plan__task-list--deferred">
              {filteredStatusGroups.deferred.map((li) => (
                <FieldPlanLineItemRow
                  key={`${li.item.id}:${li.phase}`}
                  lineItem={li}
                  projectColor={projectColor}
                  canExecute={canExecute}
                  onRelease={onReleaseToToday}
                  onOpenActions={onOpenActions}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {unplannedTasks.length > 0 && (
        <details className="field-plan__unplanned">
          <summary>Unplanned tasks ({unplannedTasks.length})</summary>
          <ul className="field-plan__unplanned-list">
            {unplannedTasks.map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
        </details>
      )}

      <button
        type="button"
        className="btn btn--primary btn--full"
        onClick={onExportExecutionReturn}
      >
        Export Execution Return
      </button>
    </>
  );
}
