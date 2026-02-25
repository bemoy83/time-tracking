---
name: Anchor Project in Planning View
overview: Move project assignment from AddFromPlanSheet (release time) to PlanEditor (planning time). Add projectId to the Plan model, surface it in PlanningView with ProjectPicker, and have released tasks inherit the plan's project. Remove project picker from AddFromPlanSheet.
todos: []
isProject: false
---

# Anchor Project Assignment in Planning View

## Rationale

Per [BRIEF.md](BRIEF.md), projects represent exhibitions and events. Plans are scoped to a specific event—the planner knows which project at planning time. Assigning at release was a generic choice; anchoring in planning matches the domain.

---

## Summary of Changes


| Area             | Change                                              |
| ---------------- | --------------------------------------------------- |
| Plan model       | Add `projectId: string                              |
| PlanningView     | Add ProjectPicker in PlanEditor                     |
| AddFromPlanSheet | Remove project picker; use plan.projectId per item  |
| Release flow     | Pass plan.projectId from plan owning each line item |
| DB               | Migration for existing plans                        |


---

## 1. Plan Model

**File:** [src/lib/planning/plan-model.ts](src/lib/planning/plan-model.ts)

Add to `Plan` interface:

```ts
export interface Plan {
  id: string;
  title: string;
  status: PlanStatus;
  lineItems: PlanLineItem[];
  /** Event/project this plan belongs to. null = unassigned. */
  projectId: string | null;  // NEW
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
}
```

Update `createPlan(title)` to set `projectId: null`.

---

## 2. Database Migration

**File:** [src/lib/db.ts](src/lib/db.ts)

- Bump `DB_VERSION` to 18.
- Add migration for `oldVersion < 18`: iterate `plans` store, add `projectId: null` to any plan missing it, then `put` back.
- The `Plan` type is imported from plan-model; schema stays compatible since idb stores plain objects.

---

## 3. PlanEditor — Project Assignment UI

**File:** [src/pages/PlanningView.tsx](src/pages/PlanningView.tsx)

**State:** Add `showProjectPicker: boolean` (default false).

**UI placement:** Add an "Event / Project" row in the PlanEditor header area (near title/status), consistent with TaskDetail's "Add to project":

- Label: "Event" or "Project" (BRIEF uses "event").
- Button showing current selection: "None" or project name with `ProjectColorDot`. Disabled when locked (read-only like other fields).
- On click: open `ProjectPicker` (same pattern as [AddFromPlanSheet](src/components/AddFromPlanSheet.tsx) lines 136–152).

**Sync with plan:** When user selects a project in ProjectPicker:

- `onSelect(projectId)` → `setCurrentPlan(prev => ({ ...prev, projectId }))` and `onSave(updated)`.
- Invalidate `selectedProjectId` if the project is deleted: subscribe to `projects` from `useTaskStore`, and if `currentPlan.projectId` is set but not in `projects`, clear it and save.

**Props:** PlanEditor needs `projects` from `useTaskStore()` (already available in PlanningView via task store).

---

## 4. Release Flow — Use Plan's ProjectId

**File:** [src/components/AddFromPlanSheet.tsx](src/components/AddFromPlanSheet.tsx)

**Remove:**

- `selectedProjectId` state.
- `showProjectPicker` state.
- Project picker UI block (`plan-picker__project`).
- `ProjectPicker` component.
- `useTaskStore` import (only needed for projects; remove if unused after cleanup).

**Update confirm handler:** Each selected item belongs to a plan. Use that plan's `projectId`:

```ts
for (const plan of plans) {
  for (const item of plan.lineItems) {
    if (selectedItemIds.has(item.id)) {
      await createTask(
        lineItemToCreateTaskInput(item, { projectId: plan.projectId ?? undefined })
      );
    }
  }
}
```

**File:** [src/lib/planning/release-plan.ts](src/lib/planning/release-plan.ts)

No change. `lineItemToCreateTaskInput(item, { projectId })` already supports the override.

---

## 5. Plan List Display (Optional)

**File:** [PlanningView.tsx](src/pages/PlanningView.tsx) — `PlanList` component

Optionally show project badge/name in plan list items (e.g. next to plan title) so planners can see which event each plan is for. Low priority; can be a follow-up.

---

## 6. Plan Creation — Default projectId

When creating a new plan via `createPlan`, `projectId` is already `null` after model update. No change to create flow.

---

## Implementation Order

1. Plan model + `createPlan` update.
2. DB migration (bump version, migrate plans).
3. PlanEditor: project assignment UI + ProjectPicker.
4. AddFromPlanSheet: remove project picker, use `plan.projectId` in confirm.
5. (Optional) Plan list project badge.

---

## Files to Modify


| File                                                        | Changes                                           |
| ----------------------------------------------------------- | ------------------------------------------------- |
| [plan-model.ts](src/lib/planning/plan-model.ts)             | Add `projectId` to Plan; update `createPlan`      |
| [db.ts](src/lib/db.ts)                                      | Version 18, migration for plans                   |
| [PlanningView.tsx](src/pages/PlanningView.tsx)              | PlanEditor project row + ProjectPicker            |
| [AddFromPlanSheet.tsx](src/components/AddFromPlanSheet.tsx) | Remove project picker, use plan.projectId in loop |


