---
name: Shared Schedule Refactor
overview: "Refactor the shared schedule sidebar feature: consolidate duplicated plan-status logic, extract the add-to-schedule button component, rename props for clarity, and improve CSS organization."
todos: []
isProject: false
---

# Shared Schedule Refactor Plan

## 1. Extract Shared Plan-Status Helper

**Problem:** The condition `plan.status === 'draft' || plan.status === 'active' || plan.status === 'reviewed'` is duplicated in 4 places.

**Add to [src/lib/planning/plan-lifecycle.ts](src/lib/planning/plan-lifecycle.ts):**

```ts
/** Plans in planner states (draft, active, reviewed) are visible and can be included in shared schedule. */
export function isPlanInPlannerState(plan: Plan): boolean {
  return (
    plan.status === 'draft' ||
    plan.status === 'active' ||
    plan.status === 'reviewed'
  );
}
```

**Update consumers:**

- [PlanList.tsx](src/pages/planning/PlanList.tsx): Remove `isPlanSelectableForSharedSchedule`, import and use `isPlanInPlannerState`
- [SharedScheduleView.tsx](src/pages/planning/SharedScheduleView.tsx): Replace inline filter with `plans.filter(isPlanInPlannerState)`
- [usePlanningData.ts](src/pages/planning/hooks/usePlanningData.ts): Replace `isPlannerVisiblePlan` with import of `isPlanInPlannerState`
- [plan-package.ts](src/lib/interop/data-transfer/plan-package.ts): Import `isPlanInPlannerState` and use for status check, or keep `isPlannerStatus` (status-only) and add a thin wrapper if the API differs

---

## 2. Extract AddToScheduleButton Component

**Create [src/pages/planning/AddToScheduleButton.tsx](src/pages/planning/AddToScheduleButton.tsx):**

```tsx
interface AddToScheduleButtonProps {
  planId: string;
  planTitle: string;
  isChecked: boolean;
  onToggle: () => void;
}
```

- Renders the button with Plus/Check icons, `planning-view__add-to-schedule-btn` classes, aria-label, aria-pressed
- Calls `trackTelemetryEvent('shared_schedule_plan_selection_change')` in onToggle
- Import CheckIcon, PlusIcon from icons

**Update [PlanList.tsx](src/pages/planning/PlanList.tsx):**

- Import AddToScheduleButton
- Replace the inline button block (lines 425-441) with `<AddToScheduleButton planId={plan.id} planTitle={plan.title} isChecked={isChecked} onToggle={handleToggleAddToSchedule} />`
- Remove CheckIcon, PlusIcon from PlanList imports if no longer used elsewhere
- Remove `handleToggleAddToSchedule` logic from PlanListItem — pass a callback that invokes `onSelectedPlanIdsChange` with the updated Set; AddToScheduleButton receives `onToggle` that does the toggle. The parent (PlanListItem) can keep the handler that builds the new Set and calls the prop.

---

## 3. Rename Prop: showSharedScheduleCheckbox to showAddToScheduleButton

**Reason:** The control is a button, not a checkbox. Clearer for future readers.

**Changes:**

- [PlanList.tsx](src/pages/planning/PlanList.tsx): Rename prop in interface and destructuring; pass through to PlanItems/PlanListItem
- [PlanningWorkspaceShell.tsx](src/pages/planning/workspace/PlanningWorkspaceShell.tsx): Change `showSharedScheduleCheckbox={activeTab === 'shared-schedule'}` to `showAddToScheduleButton={activeTab === 'shared-schedule'}`
- [PlanList.tsx](src/pages/planning/PlanList.tsx): Rename in PlanItemsProps, PlanListItemProps; update `showCheckbox` internal variable to `showAddButton` or similar

---

## 4. Rename CSS Class: planning-view__item--selected to planning-view__row--selected

**Reason:** The modifier applies to the row (li), not the item div.

**Changes:**

- [PlanList.tsx](src/pages/planning/PlanList.tsx) line 351: Change class to `planning-view__row--selected`
- [planning-workspace.css](src/styles/components/planning-workspace.css): Update selectors from `.planning-view__row.planning-view__item--selected` to `.planning-view__row.planning-view__row--selected` (or simplify to `.planning-view__row--selected`)

---

## 5. Add CSS Section Comments

**In [planning-workspace.css](src/styles/components/planning-workspace.css):**

- Add comment before add-to-schedule button styles: `/* Add-to-schedule button (sidebar, when Shared Schedule tab active) */`
- Add comment before first/last radius overrides: `/* First/last item radius to match list container */`

---

## 6. Tests

- Run existing tests: `npm test -- --run src/pages/planning`
- If PlanningWorkspaceShell or PlanList tests assert on class names or structure, update accordingly after renames

---

## File Summary


| Action | File                                                                                  |
| ------ | ------------------------------------------------------------------------------------- |
| Modify | [plan-lifecycle.ts](src/lib/planning/plan-lifecycle.ts)                               |
| Modify | [PlanList.tsx](src/pages/planning/PlanList.tsx)                                       |
| Modify | [SharedScheduleView.tsx](src/pages/planning/SharedScheduleView.tsx)                   |
| Modify | [usePlanningData.ts](src/pages/planning/hooks/usePlanningData.ts)                     |
| Modify | [plan-package.ts](src/lib/interop/data-transfer/plan-package.ts)                      |
| Modify | [PlanningWorkspaceShell.tsx](src/pages/planning/workspace/PlanningWorkspaceShell.tsx) |
| Modify | [planning-workspace.css](src/styles/components/planning-workspace.css)                |
| Create | [AddToScheduleButton.tsx](src/pages/planning/AddToScheduleButton.tsx)                 |


---

## Implementation Order

1. Add `isPlanInPlannerState` to plan-lifecycle; update all 4 consumers
2. Create AddToScheduleButton; integrate into PlanList
3. Rename showSharedScheduleCheckbox to showAddToScheduleButton
4. Rename planning-view__item--selected to planning-view__row--selected
5. Add CSS comments
6. Run tests

