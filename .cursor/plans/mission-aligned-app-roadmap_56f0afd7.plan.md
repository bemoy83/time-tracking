---
name: mission-aligned-app-roadmap
overview: Align the app with MISSION_PLAN phases while preserving Today execution UX and reflecting what is already implemented (task fundamentals + derived productivity display, but no templates/work taxonomy/archive). The plan prioritizes phases 1-4 as build scope and keeps phases 5-7 explicitly parked as future-ready backlog.
todos:
  - id: phase1-domain-and-db
    content: Add template/work taxonomy/productivity target types and IndexedDB migrations (new taskTemplates store + task field extensions).
    status: pending
  - id: phase1-template-management
    content: Implement template CRUD state/actions and minimal template management UI in Settings.
    status: pending
  - id: phase2-create-flow
    content: Upgrade CreateTaskSheet to support Blank vs Template creation with full prefill and editable fields.
    status: pending
  - id: phase3-productivity-target
    content: Persist required productivity on Task and update TaskProductivity to prioritize persisted target.
    status: pending
  - id: phase4-work-structure
    content: Add workCategory/buildPhase on Task, enforce read-only during execution, and implement work-type analytics key helper.
    status: pending
  - id: quality-regression
    content: Add migration/store/create-flow tests and run manual regression checks to ensure Today UX is unchanged.
    status: pending
isProject: false
---

# Mission-Aligned Roadmap (Current-State Adjusted)

## Current Baseline (Verified)

- Core task execution is strong and should remain untouched in Today UX: creation, status changes, timers, subtasks, and task detail flows are already live in [src/pages/TodayView.tsx](/Users/bemoy/Developer/time-tracking/src/pages/TodayView.tsx) and [src/pages/TaskDetail.tsx](/Users/bemoy/Developer/time-tracking/src/pages/TaskDetail.tsx).
- Data model currently has no template/work-taxonomy fields in `Task`; it includes title, estimate, work quantity/unit, workers in [src/lib/types.ts](/Users/bemoy/Developer/time-tracking/src/lib/types.ts).
- DB schema/migrations are at v9 and include task/time/project/note stores only in [src/lib/db.ts](/Users/bemoy/Developer/time-tracking/src/lib/db.ts).
- Creation flow is single-path (blank task) via [src/components/CreateTaskSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.tsx).
- Productivity is currently computed from estimate/time and shown in task detail, but no persisted “required productivity target” yet in [src/components/TaskProductivity.tsx](/Users/bemoy/Developer/time-tracking/src/components/TaskProductivity.tsx).

## Implementation Scope

- **Build now:** Mission Phases 1-4.
- **Defer (explicit):** Mission Phases 5-7 (archive/KPI calculator/planner integration), but design schema hooks now to avoid rework.
- **Invariant:** No behavior regression in Today task rows/swipe/start-stop/complete interactions.

## Phase 1 — Task Templates Foundation

- Add new domain types and constants in [src/lib/types.ts](/Users/bemoy/Developer/time-tracking/src/lib/types.ts):
  - `BuildPhase` (`build-up | tear-down`)
  - `WorkCategory` (predefined enum/union)
  - `TaskTemplate`
  - `TargetProductivity` value type (thin, mission-safe stub)
- Extend DB schema with a `taskTemplates` store and indexes in [src/lib/db.ts](/Users/bemoy/Developer/time-tracking/src/lib/db.ts); bump DB version and add migration with safe defaults.
- Create template CRUD store/actions parallel to task/project store in [src/lib/stores/task-store.ts](/Users/bemoy/Developer/time-tracking/src/lib/stores/task-store.ts) or split into new [src/lib/stores/template-store.ts](/Users/bemoy/Developer/time-tracking/src/lib/stores/template-store.ts) if cleaner.
- Add minimal template management UI entry in Settings (desktop-planning posture without polluting Today): [src/pages/SettingsView.tsx](/Users/bemoy/Developer/time-tracking/src/pages/SettingsView.tsx).

## Phase 2 — Template → Task Instantiation

- Add a creation mode selector (Blank vs From Template) while preserving existing fast-create defaults in [src/components/CreateTaskSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/CreateTaskSheet.tsx).
- For template mode, prefill title/work/unit/estimate/workers/productivity target/work taxonomy, but keep all fields editable before save.
- Keep only `title` required; no new mandatory execution fields.
- Ensure resulting task is plain `Task` and behaves identically in Today/detail flows (no special casing in [src/pages/TodayView.tsx](/Users/bemoy/Developer/time-tracking/src/pages/TodayView.tsx)).

## Phase 3 — Persisted Productivity Target (Task-Level)

- Add `requiredProductivity` to task model in [src/lib/types.ts](/Users/bemoy/Developer/time-tracking/src/lib/types.ts) and migration in [src/lib/db.ts](/Users/bemoy/Developer/time-tracking/src/lib/db.ts).
- On template instantiation, copy template target into task; for blank tasks keep nullable.
- Update productivity UI in [src/components/TaskProductivity.tsx](/Users/bemoy/Developer/time-tracking/src/components/TaskProductivity.tsx):
  - Prefer persisted `requiredProductivity` when available.
  - Continue showing achieved/so-far from tracked time.
  - Keep rendering scoped to task detail only (no Today-row changes).

## Phase 4 — Work Structure for Analytics (No Execution Friction)

- Add task-level fields: `workCategory`, `buildPhase` in [src/lib/types.ts](/Users/bemoy/Developer/time-tracking/src/lib/types.ts) with migration in [src/lib/db.ts](/Users/bemoy/Developer/time-tracking/src/lib/db.ts).
- Copy these from template during creation; allow blank creation with nullable values.
- Enforce mission rule: taxonomy read-only during execution by restricting edits in task detail components (primarily [src/pages/TaskDetail.tsx](/Users/bemoy/Developer/time-tracking/src/pages/TaskDetail.tsx) and related section components).
- Introduce a utility for analytics key composition (`workCategory + workUnit + buildPhase`) in a new helper module (e.g., [src/lib/analytics/work-type-key.ts](/Users/bemoy/Developer/time-tracking/src/lib/analytics/work-type-key.ts)) for future archive/KPI reuse.

## Phase 5-7 Readiness (Deferred, Prepared)

- Add placeholder type stubs now (no UI promises yet): `ArchivedTaskKPI` in [src/lib/types.ts](/Users/bemoy/Developer/time-tracking/src/lib/types.ts).
- Keep archive/KPI stores and calculator UI out of current implementation scope.
- Record deferred work as backlog items in `MISSION_PLAN.md` status notes only after implementation starts.

## Cross-Cutting Safety and Validation

- Add migration-focused tests and store-level tests before/with schema changes (new `*.test.ts` files under `src/lib`).
- Add creation-flow tests for blank vs template paths and title-only requirement.
- Manual verification checklist:
  - Create from blank in <10s.
  - Create from template in <10s.
  - Today list interactions unchanged.
  - Task detail shows required vs achieved productivity correctly.
  - Taxonomy values copied from template and preserved.

## Delivery Sequence

1. Types + DB migrations (templates + task target/taxonomy fields).
2. Template store + Settings management UI.
3. CreateTaskSheet dual-path instantiation.
4. Productivity display switch to persisted target.
5. Read-only taxonomy behavior + analytics key utility.
6. Test pass + regression pass on Today UX.
