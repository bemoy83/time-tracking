---
name: mission-alignment-gap-closure
overview: Close the remaining mission-alignment gaps by correcting KPI/calculator aggregation to include subtask time and updating template-based creation so all copied fields are editable before save, while preserving Today execution UX.
todos:
  - id: kpi-subtask-rollup
    content: Implement shared parent+subtask person-time rollup and apply it to KPI aggregation.
    status: pending
  - id: calculator-rollup-parity
    content: Apply same rollup source to calculator historical productivity resolution.
    status: pending
  - id: template-all-fields-editable
    content: Expose and persist editable buildPhase/workCategory/targetProductivity in template-based CreateTaskSheet flow.
    status: pending
  - id: tests-for-gap-closure
    content: Add focused tests for subtask-inclusive KPI/calculator and template-field override persistence.
    status: pending
  - id: today-ux-smoke-check
    content: Run manual smoke checks to verify Today execution UX remains unchanged.
    status: pending
isProject: false
---

# Mission Alignment Gap-Closure Plan

## Goal

Align current implementation with the original roadmap intent by fixing two confirmed gaps:

- KPI and calculator must account for subtask time where execution happens on subtasks.
- Template-based task creation must allow editing all copied fields before create.

## Scope (Targeted)

- In scope:
  - KPI aggregation path (`[/Users/bemoy/Developer/time-tracking/src/components/KpiSection.tsx](/Users/bemoy/Developer/time-tracking/src/components/KpiSection.tsx)`, `[/Users/bemoy/Developer/time-tracking/src/lib/kpi.ts](/Users/bemoy/Developer/time-tracking/src/lib/kpi.ts)`, `[/Users/bemoy/Developer/time-tracking/src/components/CalculatorSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/CalculatorSheet.tsx)`).
  - Template instantiate/create path (`[/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.tsx)`, `[/Users/bemoy/Developer/time-tracking/src/pages/TodayView.tsx](/Users/bemoy/Developer/time-tracking/src/pages/TodayView.tsx)`, `[/Users/bemoy/Developer/time-tracking/src/lib/stores/task-store.ts](/Users/bemoy/Developer/time-tracking/src/lib/stores/task-store.ts)`).
  - Test coverage for these two behaviors.
- Out of scope:
  - Wider archive system redesign.
  - Changing Today row behavior/swipe/timer UX.

## Workstream A — KPI + Calculator include subtask time

- Build a shared helper for task execution-time rollup by task id set:
  - New helper module (e.g. `[/Users/bemoy/Developer/time-tracking/src/lib/time-rollup.ts](/Users/bemoy/Developer/time-tracking/src/lib/time-rollup.ts)`) that computes person-time from:
    - task’s direct entries
    - all direct child entries (and only one level, matching current subtask model)
- Update KPI load path in `[/Users/bemoy/Developer/time-tracking/src/components/KpiSection.tsx](/Users/bemoy/Developer/time-tracking/src/components/KpiSection.tsx)`:
  - When qualifying parent task is completed and has work metadata, fetch/include entries for parent + children.
  - Preserve grouping key: `workCategory + workUnit + buildPhase`.
- Update calculator data source in `[/Users/bemoy/Developer/time-tracking/src/components/CalculatorSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/CalculatorSheet.tsx)`:
  - Use the same rollup logic as KPI so historical rates are consistent.
- Keep KPI compute function deterministic and side-effect free in `[/Users/bemoy/Developer/time-tracking/src/lib/kpi.ts](/Users/bemoy/Developer/time-tracking/src/lib/kpi.ts)`, but accept rolled-up person-hours inputs or taskId→entries map that already includes subtasks.

## Workstream B — Template creation: all fields editable

- Extend `CreateTaskSheet` UI in `[/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.tsx)` to expose editable fields when template is selected:
  - `workCategory`
  - `buildPhase`
  - `targetProductivity`
  - (existing editable fields remain: title/work/estimate/workers)
- Prefill those fields from template, but keep user overrideable before save.
- Persist final edited values through `createTask` input path in `[/Users/bemoy/Developer/time-tracking/src/lib/stores/task-store.ts](/Users/bemoy/Developer/time-tracking/src/lib/stores/task-store.ts)`.
- Keep blank flow unchanged and title-only required.

## Workstream C — Regression protection

- Add focused tests (new files):
  - KPI includes subtask-only tracked time for parent work task.
  - Calculator historical source matches KPI rollup for same work type.
  - Template-based creation allows editing and persists overridden taxonomy/productivity fields.
- Suggested locations:
  - `[/Users/bemoy/Developer/time-tracking/src/lib/kpi.test.ts](/Users/bemoy/Developer/time-tracking/src/lib/kpi.test.ts)`
  - `[/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.test.tsx](/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.test.tsx)`

## Acceptance Criteria

- Completed parent task with time only on subtasks contributes correctly to KPI sample and productivity.
- Calculator “Historical Avg” matches KPI values for same key (including subtask-time cases).
- In template mode, user can edit all copied fields before create, and saved task reflects edited values.
- Today list execution interactions remain unchanged (start/stop/complete/swipe behavior unaffected).

## Delivery Order

1. Implement shared rollup helper + wire KPI.
2. Wire calculator to same rollup.
3. Expand template-create UI/editability and save path.
4. Add tests for rollup + template-editable flow.
5. Manual smoke regression on Today execution UX.

