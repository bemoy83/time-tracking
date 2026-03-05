---
name: Shared Schedule Zone Additive Followup
overview: Integrate the shared schedule checkbox into each PlanListItem — show [planlistitem] [checkbox] when on Shared Schedule tab, and just [planlistitem] otherwise. Remove SharedSchedulePlanZone.
todos: []
isProject: false
---

# Shared Schedule Checkbox: Inline in Plan List (Follow-up)

**Context:** Current implementation uses a separate `SharedSchedulePlanZone` that replaces or sits above `PlanList`. The desired behavior: the checkbox lives inline in each plan row — `[planlistitem] [checkbox]` when on Shared Schedule tab, `[planlistitem]` when not.

---

## 1. PlanList — New Props for Shared Schedule Mode

**File:** [PlanList.tsx](src/pages/planning/PlanList.tsx)

**Add optional props:**
- `showSharedScheduleCheckbox?: boolean` — when true, each item shows a checkbox
- `selectedPlanIdsForSharedSchedule?: Set<string>`
- `onSelectedPlanIdsChange?: (planIds: Set<string>) => void`

**Pass them through** `PlanItems` → `PlanListItem` when in sidebar mode.

---

## 2. PlanListItem — Conditional Checkbox

**File:** [PlanList.tsx](src/pages/planning/PlanList.tsx) — `PlanListItem` component

**Layout:** `[item content] [status/wrap-up] [checkbox when shared-schedule] [delete]`

**When `showSharedScheduleCheckbox` is true:** Render a checkbox at the end of each row (before or after the delete button — typically before delete). Use `stopPropagation` on the checkbox `onChange` so clicking it doesn't trigger the row select.

**Filtering:** Only show the checkbox for plans that are selectable for shared schedule: `draft`, `active`, or `reviewed` (same as [SharedScheduleView.tsx](src/pages/planning/SharedScheduleView.tsx) selectablePlans). Plans with status `review-ready`, `received`, or `session-closed` do not get a checkbox. Optional: grey out or hide checkbox for non-selectable plans; or show for all and let SharedScheduleView logic handle it. Recommendation: only render checkbox for `draft`, `active`, `reviewed`.

**Telemetry:** Call `trackTelemetryEvent('shared_schedule_plan_selection_change')` when the checkbox is toggled.

---

## 3. PlanItems — Pass Shared Schedule Props

**File:** [PlanList.tsx](src/pages/planning/PlanList.tsx)

- Add `showSharedScheduleCheckbox`, `selectedPlanIdsForSharedSchedule`, `onSelectedPlanIdsChange` to `PlanItemsProps`.
- Pass them to each `PlanListItem`.

---

## 4. PlanningWorkspaceShell — Always PlanList, Remove SharedSchedulePlanZone

**File:** [PlanningWorkspaceShell.tsx](src/pages/planning/workspace/PlanningWorkspaceShell.tsx)

**Change:**
- Remove `SharedSchedulePlanZone` import and usage.
- Always render `PlanList` (no conditional swap).
- When `activeTab === 'shared-schedule'`, pass shared schedule props to `PlanList`:

```jsx
<PlanList
  plans={plans}
  tasks={tasks}
  onSelect={onSelectPlan}
  onCreate={onCreatePlan}
  onDelete={onDeletePlan}
  onOpenWrapUp={onOpenWrapUp}
  onOpenInsights={onOpenInsights}
  selectedPlanId={activePlan?.id ?? null}
  sidebarMode
  archiveExpanded={archiveExpanded}
  onToggleArchive={onToggleArchive}
  showSharedScheduleCheckbox={activeTab === 'shared-schedule'}
  selectedPlanIdsForSharedSchedule={selectedPlanIdsForSharedSchedule}
  onSelectedPlanIdsChange={onSetSelectedPlanIdsForSharedSchedule}
/>
```

---

## 5. Remove SharedSchedulePlanZone

**File:** [SharedSchedulePlanZone.tsx](src/pages/planning/SharedSchedulePlanZone.tsx)

**Action:** Delete the file. The component is no longer used.

**Also remove** any styles that were specific to `SharedSchedulePlanZone` (e.g. `.shared-schedule-plan-zone__option`, `.shared-schedule-plan-zone__list`) if they exist and are unused.

---

## 6. Styles for Inline Checkbox

**File:** [planning-workspace.css](src/styles/components/planning-workspace.css) or [planning.css](src/styles/components/planning.css)

Add styles for the checkbox inside `.planning-view__item` when in sidebar compact mode. Ensure it aligns with the row (e.g. flexbox, before the delete button). Class suggestion: `.planning-view__item-shared-checkbox` or similar.

---

## File Summary

| Action | File |
|--------|------|
| Modify | [PlanList.tsx](src/pages/planning/PlanList.tsx) |
| Modify | [PlanningWorkspaceShell.tsx](src/pages/planning/workspace/PlanningWorkspaceShell.tsx) |
| Delete | [SharedSchedulePlanZone.tsx](src/pages/planning/SharedSchedulePlanZone.tsx) |
| Modify | [planning-workspace.css](src/styles/components/planning-workspace.css) or planning styles |

---

## Implementation Order

1. Add `PlanListItem` checkbox rendering (with shared schedule props, filtering, telemetry).
2. Thread props through `PlanItems` and `PlanList`.
3. Update `PlanningWorkspaceShell`: always `PlanList`, pass shared schedule props when `activeTab === 'shared-schedule'`.
4. Delete `SharedSchedulePlanZone.tsx`.
5. Add/clean up styles.
