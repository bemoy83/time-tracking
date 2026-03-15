import { ClockIcon, PeopleIcon, RulerIcon, TaskListIcon } from '../../components/icons';

interface PlanEditorKpiRowProps {
  packageCount: number;
  personHours: number;
  utilizationPct: number | null;
  workDays: number | null;
}

export function PlanEditorKpiRow({
  packageCount,
  personHours,
  utilizationPct,
  workDays,
}: PlanEditorKpiRowProps) {
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
      <div className="planning-view__kpi-card">
        <div className="planning-view__kpi-card-ico">
          <TaskListIcon />
        </div>
        <span className="planning-view__kpi-card-val">{workDays ?? '—'}</span>
        <span className="planning-view__kpi-card-lbl">Work Days</span>
      </div>
    </div>
  );
}
