# Feature Plan — Planning Workspace (Split-Pane)

**Priority:** 1 — Structural prerequisite for all subsequent planning features
**Role served:** Planner (Bjørn), tablet/desktop context
**Status:** Design — not yet implemented
**Related specs:** `strategy-roadmap.md` (build order + all resolved decisions)

---

## State Model Migration (Prerequisite)

This migration must be completed as part of the same deliverable as the workspace. It is a rename of one stored value and cleanup of all references. No behavioural changes — `active` means exactly what `locked` meant.

### What Changes

**1. Type definition** — `src/lib/planning/plan-model.ts`

```ts
// Before
export type PlanStatus = 'draft' | 'locked';

// After
export type PlanStatus = 'draft' | 'active' | 'reviewed' | 'received' | 'session-closed';
```

| Value | Device | Meaning |
|---|---|---|
| `draft` | Planner | Being built — not yet available for Today |
| `active` | Planner | Available for Today — freely editable |
| `reviewed` | Planner | Wrap-up complete — closed |
| `received` | Executor | Imported from planner — active session in progress |
| `session-closed` | Executor | Executor closed the session — read-only historical record |

`received` and `session-closed` are executor-device states. They are never created by the planner and never appear in the Planning Workspace sidebar. The Planning Workspace filters to `draft`, `active`, `reviewed` only. The Field Plan View shows `received` plans by default and `session-closed` in a collapsed "Past events" section.

**2. IndexedDB migration** — `src/lib/db.ts`

Bump `DB_VERSION` from `21` to `22`. Add a migration step that reads all plans with `status === 'locked'` and writes them back as `status === 'active'`. No index changes needed — `status` is a plain string value, not an indexed field on the plans store.

**3. Code references** — all occurrences of `'locked'` as a plan status value:

| File | Change |
|---|---|
| `src/lib/planning/plan-model.ts` | `lockPlan()` sets `status: 'locked'` → `'active'`; rename function to `activatePlan()` |
| `src/lib/planning/plan-model.ts` | `unlockPlan()` rename to `revertToDraft()` |
| `src/lib/planning/plan-model.ts` | `lockedAt` field rename to `activatedAt` |
| `src/lib/planning/plan-lifecycle.ts` | `isPlanReviewReady()` checks `plan.status !== 'locked'` → `!== 'active'` |
| `src/pages/planning/PlanEditor.tsx` | `isLocked = plan.status === 'locked'` → `=== 'active'` |
| `src/components/AddFromPlanSheet.tsx` | filter `p.status === 'locked'` → `=== 'active'` |
| `src/components/StatusBadge.tsx` | `locked` variant → `active` |
| `src/pages/planning/PlanList.tsx` | badge variant derivation uses `plan.status` — update accordingly |

**4. UI strings**

| Location | Before | After |
|---|---|---|
| Plan action button | "Lock plan" | "Activate plan" |
| `AddFromPlanSheet` empty state | "No locked plans. Lock a plan in Planning…" | "No active plans. Activate a plan in Planning…" |
| Any tooltips or helper text referencing "locked" | update to "active" |

### What Does Not Change

- `reviewedAt` timestamp — still the signal for the reviewed state, unchanged
- `isPlanReviewReady()` logic — same derivation, just checks `'active'` instead of `'locked'`
- `review-ready` as a derived/display concept — still computed, not stored
- All other plan fields, indexes, and store structure

### Commit Approach

Ship as a single atomic commit: type change + DB migration + all reference updates together. A partial commit where the type is renamed but references are not updated will break the app.

---

## Problem Statement

The planning module has six surfaces: `PlanList`, `PlanEditor`, `CompareView`, `ProgressView`, `WrapUpSheet`, `InsightsView`. All six currently live in stack navigation.

Stack navigation is the wrong pattern for a planner's working context. Planning is not linear — it is iterative. A planner needs to:

- See the plan list while reviewing a plan's progress
- Switch between plans without losing context
- Compare two plans side by side with the list visible
- Move between Edit / Progress / Review without re-navigating

The workspace restructuring solves this by making the plan list a persistent sidebar and promoting the main pane to a true working surface.

---

## What the Workspace Is

A persistent two-pane layout for the planning module on desktop and tablet (≥768px):

```
┌─────────────────────────────────────────────────────────┐
│  ← Exit workspace                                        │
├────────────────┬────────────────────────────────────────┤
│                │  [ Edit ]  [ Progress ]  [ Review ]     │
│   Plan List    │                                         │
│   (sidebar)    │           Main Pane                     │
│                │     (PlanEditor / ProgressView /        │
│   ─────────    │      WrapUpSheet / CompareView)         │
│   Insights     │                                         │
└────────────────┴────────────────────────────────────────┘
```

On mobile (insufficient horizontal space): current stack navigation is unchanged. No degradation. The workspace is a progressive enhancement only.

---

## Sidebar

### Purpose

The sidebar is the workspace's navigation backbone. It replaces stack navigation as the way to move between plans and surfaces.

### Structure

Two permanent zones:

**Active zone** — plans in use:
- Status: `draft`, `active`
- Ordered by: last modified descending
- A plan ready for wrap-up review has a distinct indicator — it is waiting for the planner to act

**Archive zone** — closed plans:
- Status: `reviewed`
- Collapsed by default; expandable
- Ordered by reviewed date descending

Below both zones, a persistent **Insights entry** — plan-agnostic, always accessible from the sidebar footer.

### Per-Plan Entry in Sidebar

Each plan entry shows:
- Plan title
- Status badge (color-coded — see below)
- Event/date label (once scheduling exists — reserved space for now)

No further metadata is needed at the list level. Density matters — the planner should be able to scan the full list at a glance.

### Status Badge Colors

| Status | Color | Meaning |
|---|---|---|
| `draft` | Grey | Being built — not yet available for Today |
| `active` | Blue | Available for Today — freely editable by planner |
| `reviewed` | Muted green | Wrap-up complete — closed |

Note: the previous `locked` and `review-ready` states are retired. `active` replaces `locked` (availability toggle, no edit restrictions). Wrap-up readiness is determined by data (all tasks complete) rather than a discrete state — the planner initiates wrap-up directly from an active plan.

Colors must meet contrast requirements for use in bright exhibition halls. Never use color as the sole differentiator — badge labels accompany all colors.

### Create New Plan

A persistent create action lives in the sidebar header. Always visible, never buried in a menu. The planner should be able to start a new plan without switching context.

### Collapsible Sidebar

The sidebar can be collapsed to give the main pane more space. This is relevant when editing a plan with many line items, or when reviewing a detailed progress view. A toggle control lives at the sidebar's edge. State persists across the session.

---

## Main Pane

### Tab Strip

The tab strip is context-dependent on the selected plan's state:

| Plan State | Available Tabs |
|---|---|
| `draft` | Edit |
| `active` | Edit · Progress · Schedule (once scheduling exists) |
| `active` (wrap-up available) | Edit · Progress · Schedule · Review |
| `reviewed` | Edit (read-only) · Progress (read-only) · Schedule (read-only) · Review (read-only) |

Wrap-up (Review tab) becomes available on an active plan when execution data is present — it is not gated by a state transition. The planner initiates wrap-up when they judge execution to be complete, not when a state flag changes.

Tabs not yet applicable to the plan's state are hidden, not disabled. Showing inaccessible tabs as greyed-out creates visual noise. Hiding them keeps the strip clean.

The main pane defaults to the last-active tab for the selected plan. If no prior state, it defaults to Edit.

### Compare View — Special Case

Compare View does not fit into a single-plan tab strip. It operates across two plans simultaneously.

**Access pattern:**
Within a plan's Edit tab, a "Compare" action triggers Compare mode. The current plan becomes Plan A. The sidebar shifts into comparison-selection mode — clicking a second plan assigns it as Plan B. The main pane renders `CompareView` with both plans loaded.

**Sidebar behavior during comparison:**
- Plan A is highlighted with an "A" indicator
- Hovering other plans shows "Compare as B"
- Clicking a plan in the sidebar replaces Plan B
- An "Exit comparison" control dismisses compare mode and returns to the prior tab

This makes the sidebar the natural selection surface for comparison — which is more ergonomic than navigating to a compare screen and selecting both plans there.

### Insights — Plan-Agnostic Entry

Insights aggregates across all reviewed plans. It does not belong in any single plan's tab strip.

Clicking "Insights" in the sidebar footer clears the plan selection and renders `InsightsView` in the main pane. No plan is highlighted in the sidebar. A back action or clicking a plan in the sidebar returns to plan context.

---

## Workspace Chrome

When the planning workspace is active on desktop/tablet:
- The bottom tab bar recedes or hides — it is replaced by workspace chrome
- Workspace chrome: an exit control in the top-left corner ("← All Plans" or home icon)
- The workspace feels like a modal at the navigation level — the planner is "in" a distinct working space

The intent is for the workspace to eventually become a standalone route/mode. The chrome design should not couple it to the tab bar structure so tightly that this promotion becomes difficult.

---

## Auto-Save

With a persistent sidebar enabling easy plan switching, explicit save + dirty state warnings become friction. A planner who clicks a different plan mid-edit should not face an interrupting prompt.

**Behavior:**
- Plan line items auto-save on change (debounced, short delay)
- A subtle "Saved" indicator confirms persistence
- No save button; no dirty state warning
- Navigating away mid-edit saves automatically

This is a behavioral change from the current editor. It requires the editor state model to shift from form-with-submit to continuous mutation.

**Exception:** Plan status transitions (`draft → active`, `active → reviewed`) are explicit actions — they have meaningful side effects and should require intentional user confirmation. Auto-save applies to line item content, not lifecycle transitions.

---

## Empty States

| Condition | What the workspace shows |
|---|---|
| No plans exist | Sidebar shows a prompt to create the first plan; main pane shows onboarding copy |
| Plan selected, no line items | Main pane prompts to add the first work package |
| Insights selected, no reviewed plans | Main pane explains what insights will show once plans are reviewed |
| Archive zone has no reviewed plans | Zone is hidden entirely |

---

## Mobile Fallback

When horizontal space is insufficient for a comfortable two-pane layout, the workspace does not activate and the current stack navigation serves all six surfaces unchanged. No features are gated behind the workspace — all capabilities remain accessible on mobile, just via the original navigation pattern.

This is a layout switch, not a feature gate. The threshold is determined by what the content needs, not an arbitrary pixel value.

---

## Design Decisions Already Made

- The workspace is a **progressive enhancement** — mobile is not degraded
- Mobile fallback is **unchanged stack navigation** — no new mobile behavior required
- Planning workspace **replaces app chrome on desktop** — it is a modal at the navigation level, not coexisting with the tab bar
- Sidebar has **two zones** (Active / Archive), not sections by status — this avoids over-segmenting while preserving the important Active/Closed distinction
- Plans with all tasks completed (wrap-up available) **float to top** of the Active zone — they require planner action

---

## Resolved Decisions

**Last-selected plan persists across sessions.**
Reopening the planning workspace restores the last-selected plan and tab. Quality-of-life behaviour — the planner should not have to re-navigate to where they left off. Requires persisting the last-selected plan ID and active tab locally.

**No fixed breakpoint — content adapts to available space.**
The current narrow layout is an artefact of mobile-first construction, not a deliberate constraint. The workspace activates whenever there is enough horizontal space for a two-pane layout to be comfortable. All page content — line item tables, progress views, the editor — should scale and adapt to tablet/desktop width rather than being constrained to a phone-width column. The sidebar and main pane together fill the available viewport.

**Sidebar width is fixed.**
A fixed sidebar (240–280px) is sufficient for plan titles and status badges. No resize handle for now.

**"Add from plan" in Today view is independent of the workspace.**
This is a handoff feature: the plan is active, the executor pulls tasks into Today. It accesses plan data directly without entering the planning workspace. No change to this flow — it remains executor-facing and self-contained.

---

## Relationship to Future Features

**Scheduling:** The workspace is where the scheduling UI will live. The main pane's tab strip gains a "Schedule" tab (alongside Edit / Progress / Review) when scheduling is built. The sidebar gains event date context per plan. The workspace layout makes this addition natural rather than forced.

**Export/Import:** Export actions belong in the workspace — likely in the plan's Edit tab (or a plan-level actions menu accessible from the sidebar). The workspace is where the planner manages plan lifecycle, and export is a lifecycle action.

**Planning as a standalone mode:** The workspace is the first step toward planning becoming a fully independent view mode (own route, own navigation state). The workspace chrome should be designed without coupling to the tab bar so that this promotion is straightforward when the time comes.

---

## Summary

| Aspect | Decision |
|---|---|
| Layout | Two-pane: persistent sidebar + main pane |
| Breakpoint | Available space determines layout; no arbitrary pixel constraint |
| Plan states | Draft → Active → Reviewed (3 states; locked/review-ready retired) |
| Sidebar zones | Active (draft + active) + Archive (reviewed) |
| Tab strip | Context-dependent on plan state; inaccessible tabs hidden |
| Compare mode | Triggered from Edit tab; sidebar becomes Plan B selector |
| Insights | Sidebar footer entry; plan-agnostic; clears plan selection |
| Save model | Auto-save on line item changes; explicit action for lifecycle transitions |
| Workspace chrome | Exit control top-left; tab bar recedes on desktop |
| Mobile | Unchanged stack navigation; no degradation |
