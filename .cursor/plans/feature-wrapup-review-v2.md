# Feature Plan — Wrap-Up Review v2

**Priority:** 4 — Deliverable 4, paired with Execution Return Import (must be built together)
**Role served:** Planner (exclusively)
**Status:** Design — updates existing WrapUpSheet
**Related specs:** `feature-export-import.md` (execution return import brings the data this surface acts on), `feature-field-plan-view.md` (executor annotations originate here), `strategy-roadmap.md` (resolved decisions on blocked/deferred/unplanned handling)

---

## What Changes From v1

The wrap-up review was originally designed for a single-device workflow: one planner reviewing their own execution data. With the two-role model and execution return import, the wrap-up now receives richer data and carries financial consequence. This spec defines the additions.

**What existed in v1:**
- Plan-vs-actual comparison per line item (quantities, hours, variance)
- KPI update with outlier deselection
- `reviewNote` per line item
- Sets `reviewedAt` on the plan

**What v2 adds:**
- Executor annotations surfaced inline (`executorNote`, `blockReason`, `blockCategory`, `deferredNote`)
- Explicit handling for blocked items (KPI exclusion)
- Explicit handling for deferred items (not delivered — financial record)
- Unplanned task reconciliation (work type assignment for KPI)
- Temporal dimension (schedule vs. actual completion dates, once scheduling exists)
- "Not Delivered" record feeding the Event Report

---

## The Wrap-Up Review Surface

The Review tab in the Planning Workspace main pane. Available on an active plan when execution data is present. The planner initiates wrap-up when they judge execution to be complete — it is not gated by a state transition.

Completing wrap-up transitions the plan from `active` to `reviewed`.

---

## Line Item Review

Each line item appears as a review card. The planner works through the list, reviewing each item before finalising.

### Card Content

| Element | Source | Notes |
|---|---|---|
| Title, work type, quantity | Plan | Structural reference |
| Planned person-hours | Plan (`estimatedMinutes × defaultWorkers`) | What was expected |
| Actual person-hours | Time entries | What happened |
| Variance | Derived | Actual − planned, shown as % and absolute |
| Productivity achieved | Derived | Quantity ÷ actual person-hours |
| Productivity target | KPI baseline | Expected rate for this work type |
| Execution state | From executor | completed / blocked / deferred |
| Executor note | `executorNote` | Executor's field annotation |
| Block reason + category | `blockReason`, `blockCategory` | If blocked |
| Deferred note | `deferredNote` | If deferred |
| Planner review note | `reviewNote` | Planner's own post-review annotation (editable here) |
| Scheduled date(s) | Schedule | Once scheduling exists |
| Actual completion date | Task completion timestamp | Once scheduling exists |

`executorNote` and `reviewNote` are displayed side by side — never merged or overwriting each other. The planner sees the executor's field account and writes their own annotation independently.

---

## Blocked Items

A blocked line item had work that could not proceed. No (or partial) work was done.

**Default behaviour:** excluded from KPI calculation — a blocked item is not a valid productivity sample because the conditions were abnormal.

**Planner action:** the planner can override the default and include a blocked item in KPI if they judge the data to be valid (e.g. partial work was done and the hours are representative).

**UI:** each blocked item has a toggle — "Exclude from KPI (default) / Include." The reason category is shown as context for the decision.

**In the Event Report:** blocked items appear in a "Disruptions" section showing the reason and category. They are not included in the delivered work summary.

---

## Deferred Items

A deferred line item represents work that was **planned, sold, and not delivered**. This has financial and contractual implications — it is not simply "didn't get to it." The client may be entitled to a credit or scope adjustment.

**No carry forward.** The exhibition is over. Deferred work cannot be rescheduled within this event. The planner must record it as not delivered and communicate it through appropriate channels (invoice adjustment, client notification).

**Planner action:** for each deferred item, the planner confirms the "not delivered" disposition and can add a `reviewNote` explaining the context from their perspective. The executor's `deferredNote` is shown for reference.

**In the Event Report:** deferred items appear in a dedicated **"Not Delivered"** section showing:
- Work package title and planned quantity
- Planned person-hours (what was budgeted)
- Executor's deferred note
- Planner's review note
- A clear "Not delivered — not invoiced" designation

This section is designed to be shared with the client or finance team as part of invoice reconciliation. The format and language should be professional and unambiguous.

**Effect on KPI:** deferred items are excluded from KPI — no work was done, so there is no productivity data.

**Effect on plan totals in the Event Report:** the summary distinguishes between:
- Planned scope: all line items
- Delivered scope: completed items only
- Not delivered: deferred items
- Disrupted: blocked items

---

## Unplanned Tasks

Tasks created by the executor during the event that were not in the plan. They represent real work done but outside the planned scope — additional requests, corrections, or support tasks.

**Displayed in a separate section** of the wrap-up review: "Unplanned Work."

**Planner action:** for each unplanned task, assign a work type. Once a work type is assigned:
- The task's time entries contribute to KPI for that work type
- The task appears in the Event Report's "Unplanned Work" section with its work type, time, and workers

If no work type is assigned, the task is excluded from KPI but still appears in the Event Report for transparency.

**No retroactive line item attachment.** Unplanned tasks are not merged back into plan line items — they remain distinct. This preserves the integrity of the plan-vs-actual comparison: the plan represents what was originally intended, unplanned work is always additive and separate.

**In the Event Report:** the unplanned work section shows total unplanned person-hours and a list of tasks. This gives the client and planner visibility into work that happened outside the agreed scope — which may itself have billing implications (additional work not in the original quote).

---

## KPI Update

After the planner has reviewed all line items and made include/exclude decisions, the KPI update runs as in v1:

- Completed, included items contribute new productivity samples to the work type KPI
- Blocked and deferred items are excluded (unless the planner overrode blocked items to include)
- Unplanned tasks with assigned work types contribute to KPI
- The planner can still deselect individual outliers before confirming

The KPI update is the final action before the plan transitions to `reviewed`.

---

## Temporal Layer (Once Scheduling Exists)

When a plan has scheduling data, the wrap-up gains a temporal dimension:

- Per line item: scheduled date(s) vs. actual completion date
- Schedule adherence: did this work happen when it was planned to?
- Amendment history: if the schedule was adjusted mid-event, the original and amended dates are shown
- Overall: how many days ran to schedule, how many slipped

This data feeds the Event Report's timeline section and the Insights layer's historical scheduling accuracy.

---

## Event Report — Updated Structure

The Event Report (HTML/PDF) now has five sections:

1. **Summary** — event name, dates, total planned vs. actual person-hours, crew summary, overall productivity
2. **Delivered Work** — completed line items with plan-vs-actual per item, variance, productivity vs. target
3. **Not Delivered** — deferred items with planned scope, deferred reason, planner note, "not invoiced" designation
4. **Disruptions** — blocked items with reason category and partial work data if applicable
5. **Unplanned Work** — ad-hoc tasks with work type, hours, workers

The "Not Delivered" and "Disruptions" sections are designed for external communication — they should read clearly to a client or finance manager who did not attend the event.

---

## Wrap-Up Review Flow

1. **Import execution return** (if two-device workflow) — time entries and executor annotations are added to the planner's local store
2. **Open Review tab** for the plan
3. **Review line items** — work through each card:
   - Completed items: confirm KPI inclusion/exclusion, add `reviewNote` if needed
   - Blocked items: review reason, confirm KPI exclusion or override to include
   - Deferred items: confirm "not delivered" disposition, add `reviewNote`
4. **Review unplanned work** — assign work types to unplanned tasks
5. **Confirm KPI update** — final outlier deselection, then apply
6. **Generate Event Report** — available immediately after wrap-up is complete
7. **Complete wrap-up** — plan transitions to `reviewed`, `reviewedAt` is set

Steps 3 and 4 can be done in any order. Step 5 is always last before completion.

---

## Resolved Decisions

| Decision | Resolution |
|---|---|
| Blocked items and KPI | Excluded by default; planner can override to include per item |
| Deferred items and KPI | Always excluded — no work happened |
| Deferred items disposition | Marked "not delivered" — no carry forward |
| Deferred items financial | Feed "Not Delivered" section of Event Report for invoice reconciliation |
| Unplanned tasks and KPI | Assign work type → included in KPI; no work type → excluded |
| Unplanned tasks attachment | Not retroactively attached to plan line items — always separate |
| `executorNote` vs `reviewNote` | Displayed side by side, never merged, never overwriting |
