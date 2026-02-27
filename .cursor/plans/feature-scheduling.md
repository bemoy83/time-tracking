# Feature Plan — Scheduling

**Priority:** 5 — Deliverable 5; benefits from workspace but can be built in stack navigation as fallback
**Role served:** Planner (primary), Executor (deadline visibility in Field Plan View)
**Status:** Design — not yet implemented
**Related specs:** `feature-planning-workspace.md` (Schedule tab lives in the main pane tab strip), `feature-export-import.md` (plan packages must carry Work Calendar + scheduled dates once this is built), `feature-field-plan-view.md` (executor gains scheduled date context and deadline signal)

---

## Problem Statement

The planner currently has no way to answer the two most important pre-event questions:

> *Do I have enough crew for the available work days?*
> *When should each work package happen to hit the deadline?*

And no way to answer the most important during-event question:

> *Are we on track to finish?*

The plan has estimated person-hours per work package and a defined crew size. The event has a start date and end date. The math exists — the system just doesn't do it yet.

Scheduling connects those pieces.

---

## What Scheduling Is (and Is Not)

**Is:**
- Calendar placement of work packages across event days
- Capacity math: do planned person-hours fit within available crew × days?
- Per-day crew utilization: is any day over or under capacity?
- Deadline tracking during execution: is the plan on track?

**Is not:**
- Time-of-day scheduling (no hour-level precision)
- Dependency chains between work packages (exhibition build-ups are parallel, not sequential)
- Resource-level scheduling (which specific worker does what)
- Critical path calculation
- Multi-event or multi-plan scheduling

These are deliberate constraints, not omissions. The domain doesn't require them for the core value case.

---

## Two Linked Capabilities

### 1. Capacity Calculator (Planning-Time)

The planner uses this before the event to verify the plan is feasible.

**Plan-level inputs** (seed the Work Calendar — see Work Calendar section):

| Input | Description | Default |
|---|---|---|
| Event start date | First day of work | — |
| Event end date | Last day of work (deadline) | — |
| Default crew size | Workers per day unless overridden | — |

From these, the Work Calendar is generated. The calendar is the single source of truth for **available person-hours per day** — it accounts for off days, access windows, and per-day crew overrides. The capacity calculator reads from the calendar, not from the raw plan-level fields.

**Line item inputs** (already exist or being added):

| Input | Description |
|---|---|
| `estimatedMinutes` | Total estimated time for the work package |
| `plannedWorkers` | How many crew members assigned to this work package |
| `scheduledStart` | Which day (or first day) this work is scheduled |
| `scheduledEnd` | Last day of this work (= `scheduledStart` for single-day items) |

The capacity calculator aggregates planned person-hours per day across all line items assigned to each day, and compares against available person-hours.

**Output: per-day utilization signal**

For each event day:
- Required person-hours (sum of line items scheduled on that day)
- Available person-hours (crew size × hours per day)
- Utilization ratio and a feasibility indicator

Over-allocated days are flagged — the planner either adjusts crew size, moves work to a different day, or reduces scope.

**Output: overall feasibility signal**

Total required person-hours across all line items vs. total available person-hours across all event days. A simple pass/fail with the numbers shown: "128 person-hours planned across 3 days, 192 person-hours available with 8 workers. 64 person-hours of headroom."

---

### 2. Deadline Tracker (Execution-Time)

The Progress View gains a temporal axis once line items have scheduled dates.

For each line item in the Progress View:

| Condition | Signal |
|---|---|
| Scheduled for today, not yet started | Urgent — due today |
| Scheduled for today, in progress and on pace | On track |
| Scheduled for today, in progress but behind pace | At risk |
| Scheduled date has passed, not completed | Overdue |
| Completed on or before scheduled date | Done — on time |
| Completed after scheduled date | Done — late |
| Blocked or deferred | Needs replanning |

At the plan level, the Progress View shows an overall deadline signal: "Day 2 of 3 — 5 of 9 work packages complete. On track."

This is a derived signal, not a manually set status. It is recalculated from actual task data against the schedule.

**Pace calculation:** an in-progress line item is "on pace" when the ratio of hours spent to hours estimated matches the ratio of quantity completed to total quantity. Concretely: `(hoursSpent / estimatedHours) ≤ (quantityCompleted / totalQuantity)`. If more time has been consumed than the completion percentage warrants, the item is behind pace. This uses the existing time and quantity tracking data — no new signals required.

---

## The `workers` Field — No New Field Required

The data model already has the right separation:

| Field | Location | Semantics | Purpose |
|---|---|---|---|
| `defaultWorkers` | Plan line item | Planner's intended crew | Capacity planning input |
| `workers` | Time entry / task | Actual crew used | KPI and productivity calculation |

`defaultWorkers` is the scheduling input for the capacity calculator. No new field is needed — `defaultWorkers` just needs to be wired into the capacity math. The naming clarification should be reflected in the codebase as comments or aliases, but no data migration is required.

---

## Schedule Tab in Planning Workspace

The Schedule tab appears in the main pane's tab strip alongside Edit / Progress / Review, once a plan has event start and end dates set.

**Tab visibility rule:** available on `draft` and `active` plans — the planner needs capacity planning at any stage. Hidden on `reviewed` plans (read-only historical record; the schedule is visible in the Review tab instead).

### Plan-Level Date and Crew Fields

Accessible from the plan header in the Edit tab (not buried in the Schedule tab). These are the foundation inputs that seed the Work Calendar:

- Event start date (date picker)
- Event end date (date picker)
- Default crew size (number input — applies to all work days unless overridden in the calendar)

Setting these generates the Work Calendar automatically with defaults applied (weekdays on, weekends off, 08:00–16:00). The planner then refines the calendar for venue-specific conditions.

These are set early — often before line items are fully defined. The planner sets the event parameters first, then builds the work packages.

### Schedule Grid

The primary UI of the Schedule tab. A grid where:

- **Rows** = plan line items
- **Columns** = event days (Mon 3 Mar, Tue 4 Mar, Wed 5 Mar, etc.)
- **Cells** = assignment — is this line item scheduled on this day?

Each row also shows:
- Line item title and work type
- `plannedWorkers` (editable inline)
- Total estimated person-hours for this line item
- A feasibility check: does the estimate fit within the days it is scheduled?

Each column footer shows:
- Required person-hours (sum of scheduled line items for that day)
- Available person-hours (crew × hours)
- Utilization ratio — color-coded: under-utilized (grey), healthy (green), over-allocated (amber/red)

**Interaction model:**

Tap/click a cell to toggle assignment for that day. A line item can be assigned to one day (single-day work) or multiple consecutive days (multi-day work package — sets `scheduledStart` to the first assigned day and `scheduledEnd` to the last). No drag-and-drop required for v1 — tap to toggle is sufficient.

The capacity row updates live as assignments change. The planner sees the effect of each assignment decision immediately.

**Unscheduled line items:**

Line items with no day assigned appear in a holding row at the bottom of the grid — "Unscheduled." The planner can see at a glance what hasn't been placed yet. The overall feasibility signal does not count unscheduled items as planned — they represent scope uncertainty.

### Capacity Summary Panel

Alongside or below the grid: a summary panel showing:

- Total required person-hours (all scheduled line items)
- Total available person-hours (event days × crew × hours/day)
- Net headroom or deficit
- Number of over-allocated days (if any)
- Number of unscheduled line items

This gives the planner the headline answer without having to read the entire grid.

---

## Schedule in the Field Plan View

Once scheduling exists, the Field Plan View gains temporal context for the executor:

- Each line item shows its scheduled date(s)
- A session-level header: "Day 2 of 3 — 5 of 9 work packages should be complete by now"
- Overdue line items (scheduled date passed, not completed) are surfaced prominently — they need immediate attention

The executor's block/defer decisions now carry temporal weight. Deferring a line item that was scheduled for today is visible in the execution return as: scheduled Day 1, deferred to Day 2 (or not completed). The planner sees exactly where the schedule slipped.

---

## Schedule in the Execution Return

When the executor exports the execution return, scheduled dates travel alongside actual completion dates. The planner receives:

- What was scheduled for each day
- What actually happened each day
- Where the schedule held and where it slipped
- Executor annotations explaining the slippage

This makes the wrap-up review temporally aware: "Day 1 ran 2 hours over, which pushed the Day 2 carpet work to Day 3."

---

## Plan Editability During Execution

A plan is **always fully editable** by the planner — at any state, at any point during or after the event. There is no structural freeze. The plan state model (Draft → Active → Reviewed) is an operational visibility toggle and a review status, not an edit lock.

This is correct because changes to a plan during an event are expected and legitimate. Two kinds of changes occur:

1. **Progress-driven changes**: a work package slips a day, a crew is redirected, a line item needs rescheduling because execution ran long
2. **Scope-driven changes**: new sales or customer requests add work mid-event; the planner adds line items to reflect the expanded scope

Both are handled the same way: the planner edits the plan freely and re-exports a plan package. The executor re-imports the update. The amendment log records what changed for the wrap-up review.

### Live Re-export on Plan Change

When the planner changes the plan mid-event (structural or schedule), the executor's device does not automatically receive the update — there is no live sync. The updated plan package must be re-exported and the executor must re-import it.

The planner communicates the change to the executor directly (out of band) and provides an updated plan package when the change is significant. Minor same-day adjustments may not warrant a re-export.

The plan package carries a `lastModifiedAt` timestamp so the executor can see when the package was last updated and whether their imported copy is current.

---

## Amendment Tracking

When a line item's scheduled date changes after the plan is activated — either by the planner adjusting the schedule mid-event, or by the executor deferring a work package — the original schedule should be preserved alongside the amendment.

This is a lightweight log, not a full audit trail:

| Field | Content |
|---|---|
| `originalScheduledStart` | The date when the plan was first activated |
| `originalScheduledEnd` | The end date when the plan was first activated |
| `amendmentNote` | Why the schedule was changed |
| `amendedAt` | Timestamp of the amendment |

Amendments are visible in the Progress View and in the wrap-up review. They explain variance between plan and reality without needing to reconstruct history.

---

## Relationship to Prior Features

**Planning Workspace:** The Schedule tab lives in the main pane alongside Edit/Progress/Review. The workspace layout makes the grid usable — a phone-width column cannot display a multi-day scheduling grid. This is why Workspace is a prerequisite.

**Export/Import:** The plan package export must carry scheduled dates and `plannedWorkers` so the executor's device reflects the schedule. The execution return carries actual vs. scheduled completion per line item.

**Field Plan View:** Gains scheduled date visibility per line item and an overall deadline signal. The executor's block/defer actions become temporally meaningful — the planner can see not just what was skipped but when it was meant to happen.

---

## Work Calendar

The plan-level "event start / event end / crew size / hours per day" model is insufficient for real events. Exhibition venues have access windows, inaccessible days, and varying crew availability across the event period. The system must model this accurately — otherwise capacity math produces wrong answers.

The Work Calendar is a first-class concept at the plan level. It defines the actual working conditions for each day of the event.

### Defaults

When an event start and end date are set, the system generates the work calendar automatically:

- **Weekdays (Mon–Fri):** work days, 08:00–16:00 (8 hours), plan-level crew size
- **Weekends (Sat–Sun):** off days — inaccessible, zero capacity, no scheduling allowed

These defaults are always overridable. The planner adjusts the calendar to match the venue's actual access conditions.

### Per-Day Configuration

Each day in the calendar is independently configurable:

| Property | Description | Default |
|---|---|---|
| **Day type** | Work day or off day | Weekdays = work, weekends = off |
| **Access start** | Earliest time work can begin | 08:00 |
| **Access end** | Latest time work must finish | 16:00 |
| **Available hours** | Derived: access end − access start | 8 hrs |
| **Crew size** | Workers available this day | Plan-level default |

**Off days:** marked inaccessible. No line items can be assigned. Available person-hours = 0. Displayed as greyed-out columns in the schedule grid. Holidays, venue rest days, and client-blocked days are all off days.

**Access windows:** replace the flat "hours per day" value with a concrete time range. This handles edge cases precisely:
- Venue access not until 10:00 → `accessStart: 10:00`, `accessEnd: 16:00` → 6 hours
- Early finish day before show opens → `accessStart: 08:00`, `accessEnd: 13:00` → 5 hours
- Extended day for critical push → `accessStart: 07:00`, `accessEnd: 20:00` → 13 hours

Available hours is always derived from the access window, never entered as a raw number. This prevents the planner from setting "10 hours" for a day that only has an 8-hour window.

**Per-day crew override:** some days have a smaller or larger crew than the event default. Rigging day may need 12 specialists; finishing day may need only 4. The per-day crew size overrides the plan-level default for that day's capacity calculation only — it does not affect how `plannedWorkers` is set on individual line items.

### Calendar Editor

Accessible from the Schedule tab — a compact day-by-day list alongside the schedule grid, or as a setup step before the grid is usable.

Each row is one calendar day. The planner can:
- Toggle a day between work and off
- Set the access window (start time, end time) for a work day
- Override the crew size for a work day

Bulk actions for common patterns:
- "Mark all Saturdays as off" (already default, but useful for multi-week events)
- "Set all work days to 07:00–15:00" (shift-based access)
- "Apply standard week" (reset to default)

### Capacity Recalculation

The capacity calculator updates whenever the work calendar changes. The schedule grid reflects the revised available person-hours per day immediately. Over-allocated days re-evaluate against the corrected capacity.

**Available person-hours per day** = `(accessEnd − accessStart) × crewSize` for work days, `0` for off days.

**Total available person-hours** = sum across all work days in the calendar.

This replaces the flat `workDays × crewSize × hoursPerDay` formula used in the simple model. The calendar is the single source of truth for capacity.

### Data Model

The Work Calendar is stored at the plan level as an ordered list of day entries spanning the event period. Each entry:

| Field | Type | Description |
|---|---|---|
| `date` | date | The calendar day |
| `isWorkDay` | boolean | Whether work is possible |
| `accessStart` | time (nullable) | Earliest start, if work day |
| `accessEnd` | time (nullable) | Latest finish, if work day |
| `crewSize` | integer (nullable) | Override crew for this day; null = use plan default |

When the event start/end dates change, the calendar is regenerated (preserving any manual overrides for days that remain within the new range).

---

## Open Questions

**Q2: Resolved — schedule is always freely adjustable.**
Scheduling adjustments are continuous and require no explicit "amend" action or unlock cycle. The planner must be able to react to actual progress and events at any time, on any plan state. The amendment log silently records before/after for each change — it is informational for wrap-up review, not a gate. See the **Two-Layer Lock Model** below.

**Q4: How does the deadline tracker handle plans with no scheduled dates?**
Plans that have not been scheduled (line items all unscheduled) fall back to the existing quantitative progress view — no temporal signals. The deadline tracker activates only when scheduling data is present. This is a graceful degradation, not a failure mode.
