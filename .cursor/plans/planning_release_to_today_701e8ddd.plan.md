---
name: Planning Release to Today
overview: "Implement the Release-to-Today flow from the planning feature spec: add a conversion function to map PlanLineItem to Task, create an \"Add from plan\" sheet that lists locked plans and their line items, and integrate it into Today's FAB flow so floor managers can pull work packages into active tasks."
todos: []
isProject: false
---

# Planning Feature MVP — Release to Today

## Current State

Most of the MVP is already implemented:


| Spec item                                                  | Status                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Plan list and editor                                       | Done in [PlanningView.tsx](src/pages/PlanningView.tsx)                |
| Add/remove line items with work type, quantity, crew, rate | Done                                                                  |
| KPI suggestions and risk indicators                        | Done via [plan-suggestions.ts](src/lib/planning/plan-suggestions.ts)  |
| Lock/unlock plan                                           | Done via [plan-model.ts](src/lib/planning/plan-model.ts)              |
| Scenario comparison                                        | Implemented behind `planningScenarioCompare` flag (deferred per spec) |
| **Release to Today**                                       | **Missing**                                                           |
| **Add from plan queue access**                             | **Missing**                                                           |


## Field Mapping (PlanLineItem → Task)

Per spec: Tasks inherit title, workTypeId, workQuantity, defaultWorkers, targetProductivity, buildPhase, estimatedMinutes (from plan time).


| PlanLineItem     | Task               |
| ---------------- | ------------------ |
| title            | title              |
| workTypeId       | workTypeId         |
| workQuantity     | workQuantity       |
| crew             | defaultWorkers     |
| productivityRate | targetProductivity |
| buildPhase       | buildPhase         |
| workUnit         | workUnit           |
| timeHours * 60   | estimatedMinutes   |


---

## Implementation Plan

### 1. Line item → Task conversion

Add `lineItemToCreateTaskInput` in a new module (e.g. [src/lib/planning/release-plan.ts](src/lib/planning/release-plan.ts)) that maps `PlanLineItem` to `CreateTaskInput` for [task-store.ts](src/lib/stores/task-store.ts). This keeps planning logic separate and testable.

```ts
// release-plan.ts
export function lineItemToCreateTaskInput(item: PlanLineItem): CreateTaskInput {
  return {
    title: item.title,
    workTypeId: item.workTypeId ?? undefined,
    workQuantity: item.workQuantity,
    workUnit: item.workUnit,
    defaultWorkers: item.crew,
    targetProductivity: item.productivityRate,
    buildPhase: item.buildPhase,
    estimatedMinutes: Math.round(item.timeHours * 60) || undefined,
  };
}
```

Add unit tests covering the mapping and edge cases (e.g. `timeHours === 0`).

---

### 2. AddFromPlanSheet component

Create [src/components/AddFromPlanSheet.tsx](src/components/AddFromPlanSheet.tsx) modeled after [TemplatePickerSheet.tsx](src/components/TemplatePickerSheet.tsx):

**Behavior:**

- Fetch plans via `getAllPlans()`, filter to `status === 'locked'`
- Empty state when no locked plans
- Plan list: tap a plan to expand/reveal its line items inline (or two-step: plan picker → line items)
- Line items: multi-select with checkboxes (spec: batch vs single is TBD — support multi)
- Confirm: for each selected line item, call `lineItemToCreateTaskInput` and `createTask`, then close
- Use [ActionSheet](src/components/ActionSheet.tsx) for consistency with CreateTaskSheet / TemplatePickerSheet

**UX options:** Single scrollable list (plan headers with expandable line items) or stepped flow (plan first, then line items). Recommend expandable plan sections to reduce taps.

---

### 3. Integrate into Today FAB flow

Extend the Today FAB flow in [TodayView.tsx](src/pages/TodayView.tsx):

**Option A (recommended):** Add "From Plan" as a third option alongside Blank and From Template.

- Update [TemplatePickerSheet](src/components/TemplatePickerSheet.tsx): add segment `[Blank] [From Template] [From Plan]`
- When user selects "From Plan", `onSelect` passes a sentinel (e.g. `'from-plan'`) instead of template
- TodayView: if selection is `'from-plan'`, open `AddFromPlanSheet` instead of `CreateTaskSheet`

**Option B:** Separate secondary action (e.g. long-press on FAB or "Add from plan" link in header). Simpler but less discoverable.

**Recommendation:** Option A keeps all "add task" paths in one place and matches the spec’s "Add from plan control… from Today."

---

### 4. Handle edge cases

- **No locked plans:** Show empty state in AddFromPlanSheet ("No locked plans. Lock a plan in Planning to add work here.")
- **Locked plan with no line items:** Show plan but disable or hide line-item section
- **Batch creation:** Create tasks sequentially with `createTask`; consider `createTasks` batch if task-store supports it (currently it does not — sequential is fine for MVP)

---

### 5. Scenario comparison (Phase 1 scope)

Spec states scenario comparison is **out of scope** for Phase 1. The compare UI is already behind `planningScenarioCompare`. Consider setting the default to `false` for Phase 1, or leave as-is since it's opt-in.

---

## File Summary


| File                                     | Action                                                 |
| ---------------------------------------- | ------------------------------------------------------ |
| `src/lib/planning/release-plan.ts`       | Create — line item to task mapping                     |
| `src/lib/planning/release-plan.test.ts`  | Create — unit tests                                    |
| `src/components/AddFromPlanSheet.tsx`    | Create — plan/line-item picker UI                      |
| `src/components/TemplatePickerSheet.tsx` | Modify — add "From Plan" segment                       |
| `src/pages/TodayView.tsx`                | Modify — wire AddFromPlanSheet when "From Plan" chosen |


---

## Out of Scope (Phase 1)

- Plan export/import CSV
- Moving tasks back to plans
- Task → plan linkage (`sourcePlanId` on Task)
- Scheduling metadata
- Project assignment for released tasks (default `projectId: null`)

