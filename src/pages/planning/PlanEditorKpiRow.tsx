import { ClockIcon, PeopleIcon, RulerIcon, TaskListIcon } from '../../components/icons';

interface PlanEditorKpiRowProps {
  packageCount: number;
  personHours: number;
  utilizationPct: number | null;
  workDays: number | null;
  /** Optional secondary metric: assembly / dismantle work day split */
  workDaysSecondary?: { assembly: number; dismantle: number } | null;
}

export function PlanEditorKpiRow({
  packageCount,
  personHours,
  utilizationPct,
  workDays,
  workDaysSecondary,
}: PlanEditorKpiRowProps) {
  const hasWorkDaysSecondary =
    workDaysSecondary != null && (workDaysSecondary.assembly > 0 || workDaysSecondary.dismantle > 0);

  return (
    <div className="planning-view__kpi-row">
      <div className="planning-view__kpi-card">
        <div className="planning-view__kpi-card-ico">
          <RulerIcon />
        </div>
        <span className="planning-view__kpi-card-val">{packageCount}</span>
        <span className="planning-view__kpi-card-lbl">Packages</span>
      </div>
      <div className="planning-view__kpi-card">
        <div className="planning-view__kpi-card-ico">
          <ClockIcon />
        </div>
        <span className="planning-view__kpi-card-val">{Math.round(personHours)}</span>
        <span className="planning-view__kpi-card-lbl">Person-hrs</span>
      </div>
      <div className="planning-view__kpi-card">
        <div className="planning-view__kpi-card-ico">
          <PeopleIcon />
        </div>
        <span className="planning-view__kpi-card-val">
          {utilizationPct != null ? `${utilizationPct}%` : '—'}
        </span>
        <span className="planning-view__kpi-card-lbl">Utilization</span>
      </div>
      <div
        className={`planning-view__kpi-card${hasWorkDaysSecondary ? ' planning-view__kpi-card--has-secondary' : ''}`}
      >
        <div className="planning-view__kpi-card-ico">
          <TaskListIcon />
        </div>
        {hasWorkDaysSecondary ? (
          <>
            <div className="planning-view__kpi-card-primary">
              <span className="planning-view__kpi-card-val">{workDays ?? '—'}</span>
              <span className="planning-view__kpi-card-lbl">Work Days</span>
            </div>
            <div className="planning-view__kpi-card-secondary">
              <div className="planning-view__kpi-card-secondary-row">
                <span className="planning-view__kpi-card-secondary-val">{workDaysSecondary!.assembly}</span>
                <span className="planning-view__kpi-card-secondary-lbl">Assembly</span>
              </div>
              <div className="planning-view__kpi-card-secondary-row">
                <span className="planning-view__kpi-card-secondary-val">{workDaysSecondary!.dismantle}</span>
                <span className="planning-view__kpi-card-secondary-lbl">Dismantle</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="planning-view__kpi-card-val">{workDays ?? '—'}</span>
            <span className="planning-view__kpi-card-lbl">Work Days</span>
          </>
        )}
      </div>
    </div>
  );
}
