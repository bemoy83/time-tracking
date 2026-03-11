## Shared Schedule Smart Assistant v1

### Summary
1. Add a shared-schedule assistant that schedules unscheduled phase rows across selected plans against the shared crew-pool calendar.
2. Reuse single-plan assistant rules already validated: `time_hours_first`, partial allocation when full completion is impossible, and unresolved shortfall reporting.
3. Apply one global amendment note per run for all changed rows in active plans.
4. Optimize for maximum global covered person-hours (not per-plan fairness), with deterministic tie-break ordering.

### Implementation Changes
1. Scheduling engine (new shared runner):
   - Create `runSharedAutoSchedule(...)` in a dedicated shared engine module (for example under `src/lib/planning/scheduling`).
   - Inputs: selected plan refs, shared crew-pool calendar/default crew, options.
   - Candidate rows: unscheduled active phase rows only (`includeScheduled=false` for v1).
   - Per-row required work resolution: same as single-plan (`timeHours*crew` first, fallback `quantity/rate`).
   - Placement logic: global greedy + local shift rebalance over newly placed rows; allow partial allocation and keep unresolved shortfall in report.
   - Capacity constraints: respect row’s own phase window and shared workday/access/crew availability.
   - Deterministic order/tie-break:
     - primary: higher required PH first,
     - secondary: smaller span / higher covered PH depending on covering vs non-covering windows,
     - final: lexical `planId`, `lineItemId`, `phase`, earliest start.
2. Shared view orchestration:
   - In [SharedScheduleView.tsx](/Users/bemoy/Developer/time-tracking/src/pages/planning/SharedScheduleView.tsx), add `handleAutoScheduleShared`.
   - Run assistant on current selected/effective plans and shared crew-pool calendar.
   - If changed rows include active plans: prompt once for a required global note; cancel run if empty/cancelled.
   - Apply mutations plan-by-plan through `applyPlanMutation(planId, ...)`, preserving existing autosave/debounce behavior.
   - Add assistant summary panel (changed rows, unresolved rows, coverage before/after, over-capacity days before/after), matching single-plan UX pattern.
3. Shared grid UI:
   - In [ScheduleGrid.tsx](/Users/bemoy/Developer/time-tracking/src/pages/planning/schedule/ScheduleGrid.tsx), expose `onAutoSchedule` for `mode="shared"` header.
   - Show shared schedulable-unscheduled count at phase-row granularity (with valid required-work source and eligible phase-window workdays).
4. Amendment handling:
   - Reuse bulk amendment helper pattern to stamp one note/timestamp across all changed rows in active plans during shared runs.
   - Keep reviewed/archived plans read-only and excluded from mutation targets.
5. Telemetry:
   - Add `shared_schedule_assistant_run` event in telemetry names.
   - Emit payload: `changed_count`, `changed_plan_count`, `unresolved_count`, `coverage_ratio_before/after`, `over_capacity_days_before/after`.

### Public Interfaces / Types
1. New shared assistant API:
   - `runSharedAutoSchedule(input: SharedAutoScheduleInput, options?: AutoScheduleOptions): SharedAutoScheduleResult`
2. New result/report types:
   - `SharedAutoScheduleResult`:
     - `planUpdatesById: Map<string, Plan>`
     - `report: SharedAutoScheduleReport`
   - `SharedAutoScheduleReport`:
     - `changed: Array<{ planId; lineItemId; phase; scheduledStart; scheduledEnd }>`
     - `unresolved: Array<{ planId; lineItemId; phase; reason; requiredPH; assignedPH }>`
     - `before/after` shared metrics (same shape as single-plan assistant metrics)
3. Reuse unresolved reasons for consistency:
   - `missing_required_hours | no_work_days | no_capacity_window`

### Test Plan
1. Engine unit tests:
   - schedules unscheduled rows across multiple plans within each row’s phase window.
   - allocates partial work when full completion is impossible and reports assigned-vs-required shortfall.
   - does not mutate already scheduled rows (`includeScheduled=false` behavior).
   - deterministic output for identical inputs.
   - local rebalance does not worsen objective (`coveredPH` non-decreasing, capacity violations non-increasing).
2. Shared view tests:
   - shared auto-schedule button enabled/disabled from shared schedulable row count.
   - one global note required when active plans are changed; cancel/empty note aborts mutation.
   - reviewed/archived plans remain unchanged.
   - assistant summary renders expected counts/metrics after run.
3. Regression tests:
   - manual shared assignment/crew edit behavior unchanged.
   - shared capacity banner/metrics remain consistent after assistant run.

### Assumptions and Defaults
1. Active-plan governance: one global amendment note per shared assistant run.
2. Optimization scope: unscheduled rows only in v1.
3. Objective: maximize total covered person-hours globally; no fairness balancing in v1.
4. Shared assistant reuses single-plan defaults and option semantics unless explicitly overridden.
