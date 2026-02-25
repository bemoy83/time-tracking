# Planning Feature — Product Specification

## Overview

The Planning feature separates **planning** (defining work packages, estimates, scenarios) from **execution** (timing, completion on Today view). Planners define work ahead of time—often on desktop—and floor managers execute by pulling tasks from plans into Today.

---

## Core Principles

| Principle | Definition |
|-----------|------------|
| **Plans are organizational buckets** | Each plan is a separate container; any plan can contribute tasks to Today. Plans are not mutually exclusive. |
| **Plan titles are purely organizational** | Names like "Monday", "Build Phase 1", or "Overflow" are user-defined labels only. The system does not infer scheduling or semantics from titles. |
| **Future scheduling** | A scheduling feature, if added, will use explicit metadata (e.g. dates, priorities)—not plan title parsing. Plan titles remain organizational. |
| **Release = active tasks** | When line items are released from a plan, they become **active tasks** on Today immediately. No intermediate status. |

---

## User Roles & Workflows

### Planner (office / desktop)

- Creates plans as organizational containers (e.g. "Week 3 – Build-up", "Tuesday overflow").
- Adds work packages (title, work type, quantity, crew, rate).
- Uses KPI suggestions and risk indicators for estimates.
- Locks plan when ready for execution.
- May export plans (CSV) for import on other devices.

### Floor Manager (field / mobile)

- Opens Today view for active work.
- Pulls tasks from locked plans into Today when ready to execute.
- Starts timers and completes work on released tasks.
- May move tasks between plans or back from Today as re-planning needs arise (future).

---

## Plan Model (Conceptual)

- **Plan**: Container with a free-form title, status (draft | locked), and line items.
- **Plan line item**: Work package—title, work type, quantity, crew, time estimate, productivity rate. Maps 1:1 to what a Task needs when released.
- **Plan title**: Purely organizational. No system interpretation (e.g. "per day" is a naming pattern, not a constraint).

---

## Planning Page Purpose

> The Planning page is where planners define and refine work packages for a build phase or scenario. Plans use KPI-backed suggestions for estimates. A locked plan acts as an execution queue: the floor manager adds line items to Today as active tasks and tracks time on them.

---

## MVP Scope (Phase 1)

### In scope

1. **Plan list & editor**
   - Create, edit, delete plans.
   - Add/remove line items with work type, quantity, crew, rate.
   - KPI suggestions and risk indicators.
   - Lock/unlock plan.

2. **Release to Today**
   - Floor manager can add line items from a locked plan to Today.
   - Selected items become **active tasks** immediately.
   - Tasks inherit: title, workTypeId, workQuantity, defaultWorkers, targetProductivity, buildPhase, estimatedMinutes (from plan time).

3. **Queue access**
   - A way to view and pull from plans from Today (or adjacent to Today)—e.g. "Add from plan" control that lists locked plans and their line items.

### Out of scope (Phase 1)

- **Scenario comparison** — deferred; can return later as separate feature.
- **Plan export/import** — follow existing template/work-type CSV patterns; add when needed.
- **Moving tasks back to plans** — "shuffle" between plans and Today; future iteration.
- **Scheduling** — explicit dates, order, priorities; future feature using dedicated metadata.

---

## Release Flow (Phase 1)

1. Planner locks a plan → line items are ready for release.
2. Floor manager opens Today (or "Add from plan").
3. Selects a locked plan.
4. Selects one or more line items to add.
5. System creates Tasks (status: active) with plan-derived fields.
6. Tasks appear on Today; floor manager starts timers.

---

## Open Questions & Future Work

| Topic | Notes |
|-------|-------|
| **Plan-per-day** | Naming pattern only. No structural "day" binding until scheduling exists. |
| **Task → plan linkage** | Whether released tasks retain a reference to source plan (for rollback, analytics). |
| **Batch vs single release** | Whether floor manager adds one item or selects multiple; UX TBD. |
| **Shuffle / re-plan** | Moving tasks back into plans or between plans; deferred. |
| **Scheduling feature** | Will introduce its own model; plan titles stay organizational. |

---

## Design Constraints

- Do **not** parse plan titles for scheduling or ordering.
- Do **not** infer plan semantics (e.g. "Monday" = day-of-week) from names.
- Keep plan model flexible enough for future scheduling metadata.
- Ensure PlanLineItem → Task mapping is straightforward (title, workTypeId, workQuantity, defaultWorkers, targetProductivity, buildPhase, estimatedMinutes).

---

## Summary

| Aspect | Decision |
|--------|----------|
| Plans | Organizational buckets; any can feed Today |
| Plan titles | Purely organizational; no system inference |
| Release | Line items → active tasks on Today |
| Scope | One plan per build phase; no scenario compare in Phase 1 |
| Scheduling | Door open; future feature uses explicit metadata |
