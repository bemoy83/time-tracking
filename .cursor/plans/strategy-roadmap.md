# Strategy Roadmap

**Owner:** Bjørn — Chief of Planning
**Date:** February 2026
**Basis:** Post-review-insights system state + architectural design session

---

## Product Vision

A two-role operational intelligence tool for exhibition build operations.

- The **planner** designs work, allocates resources, and learns from outcomes
- The **executor** tracks what actually happens in the field
- The system bridges them through a defined export/import protocol until live sync is warranted

This is more than a time tracker. It is less than a full workforce management platform. It sits in exactly the right scope for its constraints.

---

## Role Model (Explicit)

| Role | Context | Primary Surface | Device |
|---|---|---|---|
| **Planner** (Bjørn) | Before and after events. Review, adjust, estimate. | Planning Workspace | Tablet / desktop |
| **Executor** (foreman) | During the event. Start/stop timers, complete tasks. | Today View | Mobile phone |

These roles are behavioral, not enforced by accounts. No user authentication is required. The distinction shapes layout, UX density, and navigation decisions for every feature.

---

## Current System State

- Tasks carry hard lineage (`sourcePlanId`, `sourceLineItemId`, `excludeFromKpi`)
- Plans have a lifecycle: `draft → active → reviewed` (previously `draft → locked → review-ready → reviewed` — state model migration is the first implementation step)
- Progress view shows live plan-vs-actual per line item
- Wrap-up review archives tasks, updates KPIs with outlier deselection
- Insights view shows work type KPI trends, confidence, and variance
- `PlanLineItem` has reserved `scheduledStart` and `scheduledEnd` (nullable, unused)
- Planning module uses stack navigation with six surfaces: PlanList, PlanEditor, CompareView, ProgressView, WrapUpSheet, InsightsView

---

## Strategic Priorities

### Deliverable 1 — Planning Workspace + State Model Migration

**Spec:** `feature-planning-workspace.md`

**Why first:** The planning module has six surfaces in stack navigation. The workspace restructuring is the structural prerequisite for everything that follows, and the state model migration is bundled here as it is a prerequisite with no independent value.

**State model migration (ships with this deliverable):**
Rename `locked` → `active` throughout. DB version bump + data migration. No behavioural change — `active` means exactly what `locked` meant. Full detail in the spec.

**What the workspace delivers:**
- Desktop/tablet: persistent two-pane layout — sidebar (always visible) + main content area
- Mobile: graceful fallback to current stack navigation — no degradation
- Sidebar replaces tab bar on desktop; planning enters "workspace mode"
- Main pane tab strip: Edit / Progress / Review — context-dependent on plan state
- Insights accessible from sidebar footer as a plan-agnostic entry

**Sidebar organisation:**
Two zones — **Active** (draft + active plans) and **Archive** (reviewed). Status badges per plan. `review-ready` is a derived indicator within the Active zone, not a separate state.

---

### Deliverable 2 — Export (Outbound)

**Spec:** `feature-export-import.md`

**Why second:** Delivers immediate value independently of import. The planner can share plans, back up data, and generate Event Reports without the executor-side import being built yet.

**Four export actions:**

| Export | Format | Trigger | Consumer |
|---|---|---|---|
| Plan Package | JSON | Manual + auto on plan activation | Executor (via import) |
| Execution Return | JSON | Executor — Close Session in Field Plan View | Planner (via import) |
| Event Report | HTML / print-to-PDF | Manual from Review tab | Client / management |
| Full Backup | JSON | Manual + auto on wrap-up complete | Same device (restore) |

**Key decisions:**
- Every JSON export carries a versioned envelope (`schemaVersion`, `exportType`, `exportedAt`)
- Auto-exports write to a user-chosen folder (File System Access API); fallback to downloads
- Export format is a de-facto internal API — define schema once, treat changes as breaking

---

### Deliverable 3 — Import + Field Plan View

**Specs:** `feature-export-import.md` (import section) + `feature-field-plan-view.md`

**Why together:** Import creates a received plan on the executor's device. The Field Plan View is how the executor works that plan. Neither is useful without the other.

**Import behaviors:**
- Plan Package import: preview → confirm → received plan created (read-only structure, full execution capability)
- Re-import merge: incoming structural/schedule changes applied, executor execution state fully preserved
- Execution Return import: additive only — adds time entries and executor annotations; does not modify existing records
- Full Backup restore: destructive, explicit confirmation required

**Field Plan View:**
- Entry point: persistent "Plan" indicator in Today view header
- Shows all line items with execution state: Pending / In Progress / Completed / Blocked / Deferred
- Executor actions: Release to Today, Mark Blocked, Mark Deferred, Add Note, Clear Block
- Grouping: toggle between grouped by build phase (default) and flat list
- Close Session: deliberate end-of-event action that generates and exports the Execution Return

**Deferred items are a financial record.** Deferred = not delivered at this event. No carry forward. Feeds the "Not Delivered" section of the Event Report for invoice reconciliation.

---

### Deliverable 4 — Execution Return Import + Wrap-Up Review v2

**Specs:** `feature-export-import.md` (execution return import) + `feature-wrapup-review-v2.md`

**Why together:** The execution return import brings executor annotations into the planner's device. Wrap-Up Review v2 is the surface that acts on that data. Importing without the updated wrap-up UI leaves the new data stranded.

**Depends on:** Deliverable 3 (Field Plan View generates the execution return data)

**What wrap-up v2 adds over the current wrap-up:**
- Executor annotations (`executorNote`, `blockReason`, `blockCategory`) surfaced inline alongside planner's `reviewNote`
- Blocked items: excluded from KPI by default; planner can override per item
- Deferred items: confirmed as "not delivered"; feeds Event Report "Not Delivered" section
- Unplanned tasks: assign a work type → included in KPI; no work type → excluded
- Once scheduling exists: temporal dimension (scheduled date vs. actual completion)

**Event Report — five sections:**
1. Summary (totals, crew, overall productivity)
2. Delivered Work (completed line items, plan-vs-actual)
3. Not Delivered (deferred items — for invoice reconciliation)
4. Disruptions (blocked items with reason)
5. Unplanned Work (ad-hoc tasks with work type and hours)

---

### Deliverable 5 — Scheduling

**Spec:** `feature-scheduling.md`

**Why last:** Requires the workspace (the grid needs horizontal space) and export/import (plan packages must carry scheduled dates and the work calendar). Can be built in current stack navigation as a fallback but benefits significantly from workspace.

**Two linked capabilities:**

**Capacity calculator** (planning-time):
- Work Calendar: per-day configuration (work/off, access window `accessStart`→`accessEnd`, crew override)
- Defaults: Mon–Fri work days, 08:00–16:00, plan-level crew size; weekends off
- Schedule grid: rows = line items, columns = event days; per-day utilisation shown in column footer
- Feasibility signal: total required vs. available person-hours; over-allocated days flagged

**Deadline tracker** (execution-time, in Progress View and Field Plan View):
- Per line item: on track / at risk / overdue / done on time / done late
- Pace: `hoursSpent / estimatedHours ≤ quantityCompleted / totalQuantity`
- Plan-level: "Day 2 of 3 — 5 of 9 work packages complete. On track."

**Plan editability:** always fully editable at any state. No structural freeze. Amendment log records schedule changes silently for wrap-up review.

**No new workers field needed:** `defaultWorkers` on line items is already the planned crew — wire into capacity calculator. `workers` on time entries is already actual crew.

---

## Lower Priority (Deferred, Not Forgotten)

These are identified, understood, and intentionally deferred. Each has a clear trigger condition for reconsideration.

### Sync (Supabase)

- `syncStatus` field on time entries already exists
- A Supabase sync plan exists in `.cursor/plans/`
- **Blocked by:** No defined conflict model or ownership semantics
- **Natural write boundary:** Planner owns plans and tasks. Executor owns time entries. This is the ownership model that unblocks sync design.
- **Trigger:** Export/import workflow proves insufficient for operational tempo — i.e., round-trip file sharing creates friction that hurts execution.

### Named Crew Members / Team Identity

- Current model: `workers` is a headcount number, not identifiable individuals
- Named crew members enable individual productivity tracking, accountability, and eventual payroll integration
- Fundamentally changes the data model and UI surface area
- **Trigger:** Multi-crew events become common enough that headcount is insufficient to understand performance differences.

### Foreman Awareness / In-App Signals

- The app is currently entirely reactive — it records faithfully but never signals concern
- Useful signals: timer running significantly over KPI expectation, task stalled on a blocked dependency, projected deadline at risk
- This is an **awareness layer**, not a notification system — in-app banners and badges are sufficient delivery
- **Trigger:** Crew size or task count reaches a threshold where checking the app manually is insufficient to catch problems in time.

### Plan Templates

- Plans for recurring event types converge on similar line items over time
- Templates let the planner start from a known-good structure, with KPI calibration informing estimates automatically
- **Trigger:** The planner has reviewed enough events that a repeating structure is evident and manually re-entering it has become a real cost.

### Hierarchical Task Structure (Phases / Milestones)

- Current hierarchy: project → task → subtask
- Natural domain hierarchy: Event → Phase → Work Package → Task
- Lineage solves the immediate need; full hierarchy is scope creep for the current scale
- **Trigger:** Multi-phase events with distinct crews per phase become common.

---

## Estimation Calibration (Reframing Insights)

The insights layer currently reports what happened. The reframe: treat it as **estimation calibration** — helping the planner write better plans next time, not just understand the last one.

Concretely: after a wrap-up review, the system has planned hours per work type and actual hours per work type. Over time, patterns emerge: "electrical estimates run 40% over," "rigging work is consistently accurate." The insights view should surface this as actionable guidance, not just historical data.

This is not a new data surface. It is a shift in framing and presentation that makes the existing KPI layer more valuable to the planner.

---

## Build Order

Each deliverable is self-contained and can be implemented and shipped independently. Items 3 and 4 each have an internal coupling (paired units) but are independent of items 1 and 2. The only hard sequencing rule is: Deliverable 4 requires Deliverable 3 to exist first.

| # | Deliverable | Depends on | Key specs |
|---|---|---|---|
| 1 | State model migration + Planning Workspace | — | `feature-planning-workspace.md` |
| 2 | Export — outbound | — | `feature-export-import.md` |
| 3 | Import + Field Plan View | — | `feature-export-import.md`, `feature-field-plan-view.md` |
| 4 | Execution Return Import + Wrap-Up Review v2 | Deliverable 3 | `feature-export-import.md`, `feature-wrapup-review-v2.md` |
| 5 | Scheduling | Deliverable 1 (workspace) | `feature-scheduling.md` |
| — | Sync, Named crew, Templates... | Deferred — see trigger conditions below | — |

Deliverables 2 and 3 can be built in parallel with Deliverable 1 if needed — they have no dependency on the workspace, only on the state model migration having shipped.

---

## Resolved Architectural Decisions

These were open questions during design and are now resolved. Implementation must follow these.

| Decision | Resolution |
|---|---|
| Plan state model | Simplified to 3 states: **Draft → Active → Reviewed**. `locked` and `review-ready` are retired. `active` replaces `locked` — it is a Today-availability toggle with no edit restrictions. Wrap-up is initiated by the planner when they judge execution complete, not by a state flag. |
| Plan editability | Plans are **always fully editable** — at any state, at any point. No structural freeze. The planner can add scope, change quantities, and reschedule freely during execution. |
| Schedule adjustability | Always freely adjustable. No unlock required. Amendment log records changes silently for wrap-up review. |
| Re-import merge | When an updated plan package is re-imported over an existing plan with execution state: **merge** — apply incoming structural/schedule changes, preserve all executor annotations (`executionStatus`, `blockReason`, `executorNote`, `deferredNote`). |
| Scope changes mid-event | Both workflows supported: planner adds line items to the existing active plan, OR creates a new separate plan for additional work. |
| Deferred items | Mean **"not delivered at this event"** — not carried forward. Have financial/contractual implications. Surface in Event Report as "Not Delivered" for invoice reconciliation. No carry forward. |
| Blocked items + KPI | Excluded from KPI by default; planner can override to include per item. |
| Unplanned tasks + KPI | Assign a work type in wrap-up → included in KPI. No work type → excluded. |
| Executor import entry point | Primary: Field Plan View empty state ("Import plan" prompt). Secondary: Settings → Import. |
| Build phase grouping (Field Plan View) | Executor toggle — grouped by build phase (default when phases are set) or flat list. |
| Pace calculation | Time budget: `hoursSpent / estimatedHours ≤ quantityCompleted / totalQuantity`. Behind pace when time consumption exceeds completion proportion. |
| Workers fields | No new fields needed. `defaultWorkers` on line items = planned crew (capacity calculator input). `workers` on time entries = actual crew (KPI input). Wire `defaultWorkers` into capacity calculator as-is. |
| `executorNote` vs `reviewNote` | Separate fields, displayed side by side in wrap-up. Never merged, never overwriting. |

---

## Principles That Should Hold

- **Offline-first, always.** Network availability is never assumed during an event.
- **Planner and executor are different people.** Every UX decision should respect which role is being served.
- **Export format is a de-facto API.** Define the schema once, carefully. Breaking changes are costly.
- **Scheduling is capacity math first, calendar second.** The value is staffing feasibility, not just dates on a timeline.
- **Don't build multi-user infrastructure before the single-pair experience is excellent.** Export/import is the right substitute for now.
- **The system should eventually have an opinion.** Awareness signals — "this is behind" — are what separate a data recorder from an operational tool.
