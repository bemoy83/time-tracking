# Feature Plan — Field Plan View

**Priority:** 3 — Deliverable 3, paired with Import (must be built together)
**Role served:** Executor (foreman), mobile-first
**Status:** Design — not yet implemented
**Related specs:** `feature-export-import.md` (import transport layer this surface depends on), `feature-wrapup-review-v2.md` (where executor annotations land after Close Session), `feature-scheduling.md` (adds scheduled date context to line item cards once built)

---

## Problem Statement

When a plan is imported onto the executor's device, the executor currently has no way to see the full plan context. Today view shows active tasks — it does not show what was planned, what is still pending, or what the overall picture looks like.

On the floor, things go wrong. A task gets blocked because a vendor hasn't delivered materials. A section of the hall is inaccessible until a certain time. The crew finishes a work package early and needs to pull forward something that was planned for later. The executor needs to see the plan to make these decisions, not just the tasks currently running.

The Field Plan View is the executor's operational lens on a received plan.

---

## What It Is Not

The Field Plan View is not a mobile version of the Planning Workspace. The planner's workspace is analytical, information-dense, and reflective. The Field Plan View is operational, action-limited, and immediate.

The executor cannot edit line item estimates, quantities, or work type definitions. They cannot change the plan's lifecycle state. They cannot create new line items in the plan. Those are the planner's responsibilities.

What the executor can do is work the plan and annotate what actually happened.

---

## The Executor's Mental Model During Execution

The executor arrives with a received plan on their device. Their job over the course of the event:

1. **Get work started** — release line items to Today, assign crew
2. **Monitor progress** — are we on pace? what's been done?
3. **React to problems** — mark what's blocked or deferred, note why
4. **Close the session** — export what happened back to the planner

The Field Plan View serves steps 1, 2, and 3. Today view handles step 4 (unplanned tasks, running timers). The execution return export (step 4) is triggered from the Field Plan View at end of session.

---

## Entry Point

The Field Plan View is accessed from Today — not from a top-level navigation tab. It is firmly in the executor's context.

**Entry point:** a persistent **Plan indicator** in the Today view header or toolbar. It shows the active plan name: e.g., "Plan: Week 3 Build-up →". Tapping opens the Field Plan View as a full-screen overlay.

If the executor has multiple received plans (e.g., build-up phase and tear-down phase are separate plans), the Field Plan View opens to a simple list of received plans. Selecting one opens that plan's operational view.

The executor always knows which plan they are working from. The connection between Today's tasks and the originating plan should be visible at a glance.

---

## Field Plan View Layout

### Header

- Plan title
- Overall progress: X of Y line items completed (fraction + progress bar)
- Session time: total person-hours logged so far against this plan
- Deadline (once scheduling exists): "On track / Behind / Ahead"

### Line Item List

Each line item appears as a card showing:

| Element | Content |
|---|---|
| Title | Work package name |
| Work type + quantity | E.g., "Carpet · 200 m²" |
| Execution state | Visual indicator (see states below) |
| Progress | Quantity completed vs. planned (once tasks are active) |
| Workers | Headcount active on this item |
| Time | Hours logged vs. estimated |

Cards are ordered by execution state priority: **Blocked** first (needs attention), then **In Progress**, then **Pending**, then **Completed**, then **Deferred** last.

### Unplanned Work Section

Below the plan's line items: a collapsed section showing tasks created during this session that are not from this plan. These are visible here for context — the executor and planner both need to know what unplanned work ran alongside the plan. This section cannot be edited from the Field Plan View; those tasks are managed in Today.

---

## Line Item Execution States

| State | Set by | Meaning |
|---|---|---|
| **Pending** | System (default) | Line item not yet released to Today |
| **In Progress** | System (derived) | One or more tasks from this line item are active in Today |
| **Completed** | System (derived) | All tasks from this line item are marked complete |
| **Blocked** | Executor (explicit) | Work cannot proceed; reason recorded |
| **Deferred** | Executor (explicit) | Work is being pushed — won't happen in this session |

`In Progress` and `Completed` are derived from underlying task state — they are not manually set. `Blocked` and `Deferred` are explicit executor annotations, stored on the line item.

---

## Executor Actions Per Line Item

### Release to Today

Available on **Pending** line items. Creates an active task in Today from the line item — same mechanism as the existing "Add from plan" flow. The line item transitions to **In Progress**.

The executor does not need to leave the Field Plan View to release a line item. The action is available inline, from the line item card.

### Mark as Blocked

Available on any non-Completed line item. Opens a quick annotation sheet:

- **Reason** (required, short text): "Materials not delivered", "Area inaccessible", "Crew unavailable"
- **Category** (optional, fast-select): Access · Materials · Crew · Dependency · Other

The line item is marked Blocked. A blocked indicator is shown on the card. If tasks from this line item are active in Today, they remain active — the executor decides whether to stop the timer separately. The blocked mark is a signal to the planner, not an automatic task state change.

### Mark as Deferred

Available on **Pending** or **Blocked** line items. Opens a minimal annotation sheet:

- **Note** (optional): reason for deferral

The line item is marked Deferred. Deferred means: **this work will not happen at this event.** It is not carried forward to a future session — deferred work was sold, scoped, and not delivered. It has financial and contractual implications.

In the execution return, deferred items surface as explicitly not delivered, with the executor's note. In the planner's wrap-up review, deferred items require an explicit disposition: they are marked as cancelled/not delivered, which feeds directly into invoice reconciliation and the Event Report's "Not Delivered" section.

### Add Note

Available on any line item at any state. A plain text note attached to the line item — context for the planner. Examples: "Completed early, crew moved to AV", "Area opened 2 hours late", "Quantity increased by client request."

### Clear Block / Reactivate

If a blocked situation resolves (materials arrive, area opens), the executor can clear the block and return the line item to its prior state.

---

## End of Session / Export Execution Return

At the bottom of the Field Plan View, a persistent **"Close Session"** action. This is the deliberate, intentional close of the execution phase.

**Flow:**
1. Summary screen: X completed, Y blocked, Z deferred, N unplanned tasks, total person-hours
2. Review annotations: executor can review and adjust any block/defer notes before sending
3. Confirm → generates and exports the Execution Return JSON

This is a conscious close, not an automatic background export. The executor reviews what they are sending before it goes.

After close, the received plan transitions to `status: 'session-closed'` on the executor's device. It remains readable in the "Past events" section of the Field Plan View but no further execution actions are available.

---

## What Travels in the Execution Return

The Execution Return now carries executor judgment, not just numbers:

| Data | Purpose |
|---|---|
| Time entries (per task) | Actual hours and workers per work package |
| Task completion status | What was done |
| Line item execution state | Completed / blocked / deferred per line item |
| Block reasons and categories | Why something couldn't be done |
| Executor notes | Context and narrative per line item |
| Unplanned tasks | Work that happened outside the plan |

The planner receives this and, during wrap-up review, sees: planned vs. actual quantities and hours *alongside* the executor's account of what happened. That combination — data + narrative — is what makes wrap-up genuinely useful rather than just a numbers reconciliation.

---

## What the Planner Sees on Import

When the execution return is imported on the planner's device:

- Blocked line items are flagged in the wrap-up review — the planner sees the reason and can decide whether to exclude them from KPI calculation
- Deferred line items appear with their executor note — the planner knows the work didn't happen and why
- Executor notes appear inline alongside the quantitative variance for each line item
- Unplanned tasks appear in the unplanned work section of the wrap-up

The wrap-up review becomes a conversation between the planner and the executor's field record, not just a post-hoc number comparison.

---

## Data Model Additions Required

The following fields need to be added to `PlanLineItem` to support the Field Plan View and Execution Return:

| Field | Type | Purpose |
|---|---|---|
| `executionStatus` | enum | pending / in-progress / completed / blocked / deferred |
| `blockReason` | string (nullable) | Free-text reason for blocked state |
| `blockCategory` | enum (nullable) | Access / Materials / Crew / Dependency / Other |
| `executorNote` | string (nullable) | General annotation from executor (already exists as `reviewNote` — evaluate reuse) |
| `deferredNote` | string (nullable) | Reason for deferral |

`executionStatus`, `blockReason`, `blockCategory`, and `deferredNote` are set on the executor's device and travel outbound in the execution return. The planner's device receives them on import.

Note: `reviewNote` already exists on `PlanLineItem` for planner-side post-review annotations. The executor-facing note is a separate field — `executorNote` — that must never overwrite the planner's `reviewNote`. Both fields travel through the system independently: `executorNote` is set on the executor's device and arrives via the execution return import; `reviewNote` is set by the planner during wrap-up. They coexist and are displayed together during wrap-up review without either replacing the other.

---

## Design Constraints

- **Mobile-first, always.** The executor is on a phone, moving, one-handed. Every action must be reachable with a thumb.
- **Large tap targets.** Line item cards must be tall enough to tap accurately on a moving floor.
- **Fast to open.** The executor interrupts Today to check the plan and returns quickly. Minimize navigation depth.
- **Clear visual states.** Blocked and Deferred must be unmistakable at a glance — not just a subtle badge. A blocked line item should feel urgent.
- **Usable in bright halls.** High contrast. No color-only state encoding.

---

## Open Questions

**Q1: What happens to a received plan when the executor's device has no tasks yet (plan just imported, nothing released)?**
The Field Plan View shows all line items in Pending state. The executor's first action is to release the first work packages to Today. The view must be compelling enough at this empty state to guide the executor into starting work — not just an empty list.

**Q2: Can the executor partially release a line item?**
Resolved: no ad-hoc splitting. A line item releases in full as one task. If a work package needs to be divided across time, that is a scheduling decision made by the planner — not an ad-hoc field action by the executor. This keeps the release flow simple and ensures quantity splits are always intentional and planned.

**Q3: Resolved — `received` plans shown by default.**
The Field Plan View shows only plans with `status: 'received'`. Plans with `status: 'session-closed'` are accessible in a collapsed "Past events" section at the bottom but no execution actions are available on them. The executor's primary context is always the current event.

**Q4: Resolved — build phase grouping with user toggle.**
The executor can switch between a grouped view (line items grouped by build phase) and a flat list. When build phases are set on line items, grouped view is the default — the executor works one phase at a time. Flat list is available for quick scanning across the full plan. The toggle persists per session.
