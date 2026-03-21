---
name: Batch duplicate/delete all
overview: Add "duplicate all" and "delete all" for work packages by reusing existing plan-model helpers, a single atomic `mutatePlan` per action in PlanEditor, and two new header controls in WorkPackageTable (with a destructive confirmation for delete all).
todos:
  - id: plan-model-helpers
    content: Add duplicateAllLineItemsInPlan + removeAllLineItemsFromPlan in plan-model.ts and tests in plan-model.test.ts
    status: pending
  - id: plan-editor-handlers
    content: Wire handlers + optional props from PlanEditor to WorkPackageTable with readOnly/isLocked guards
    status: pending
  - id: work-package-table-ui
    content: Add header buttons, AlertDialog for delete-all, and CSS for header action row in WorkPackageTable + work-package-table.css
    status: pending
isProject: false
---

# Batch duplicate all / delete all (work packages)

## Current behavior (baseline)

- **Single duplicate:** `[duplicateLineItem](src/lib/planning/plan-model.ts)` builds a new `PlanLineItem` (new `id`, title `(copy)` rules), then `[addLineItemToPlan](src/lib/planning/plan-model.ts)` appends it.
- **Single delete:** `[removeLineItemFromPlan](src/lib/planning/plan-model.ts)` filters one id out.
- **Batch suggestions:** `[handleBatchApplySuggestions](src/pages/planning/PlanEditor.tsx)` loops `updatePlanLineItem` inside one `mutatePlan` callback (one state update / debounced autosave tick).
- **Import path:** `[addLineItemsToPlan](src/lib/planning/plan-model.ts)` already appends many items in one plan update (`[usePlanLineItemImport](src/pages/planning/hooks/usePlanLineItemImport.ts)`).

## Domain layer (`[plan-model.ts](src/lib/planning/plan-model.ts)`)

1. `**duplicateAllLineItemsInPlan(plan: Plan): Plan`**
  - `const copies = plan.lineItems.map(duplicateLineItem)`  
  - `return addLineItemsToPlan(plan, copies)`  
  - Preserves order: originals first, then each copy in the same order as sources (matches mental model of “duplicate every row once”).
2. `**removeAllLineItemsFromPlan(plan: Plan): Plan`**
  - `return { ...plan, lineItems: [], updatedAt: nowUtc() }` (same `updatedAt` pattern as existing removals).  
  - Keeps a single, testable primitive instead of ad-hoc object spreads in the editor.
3. **Tests** in `[plan-model.test.ts](src/lib/planning/plan-model.test.ts)`:
  - After `duplicateAllLineItemsInPlan`, length doubles; new ids differ from originals; titles follow existing `duplicateLineItem` rules.  
  - After `removeAllLineItemsFromPlan`, `lineItems` is empty.

**Note:** Duplicating many rows with the same title can yield duplicate “(copy)” titles (same as duplicating similar rows one-by-one today). No extra work unless you want unique suffixes later.

## PlanEditor (`[PlanEditor.tsx](src/pages/planning/PlanEditor.tsx)`)

- Import the two new functions (alongside existing `duplicateLineItem` / `addLineItemToPlan` imports as needed).
- `**handleDuplicateAll`:** `mutatePlan((prev) => duplicateAllLineItemsInPlan(prev))` — one mutation, consistent with `[usePlanEditorState](src/pages/planning/hooks/usePlanEditorState.ts)` debounced save.
- `**handleRemoveAll`:** only after user confirms (see UI).
- Pass new props into `WorkPackageTable` only when editable: same guard as batch magic — `readOnly || isLocked ? undefined : handler` (mirrors `[onBatchApplySuggestions](src/pages/planning/PlanEditor.tsx)` around line 742).

## WorkPackageTable (`[WorkPackageTable.tsx](src/pages/planning/WorkPackageTable.tsx)`)

- **Props:** optional `onDuplicateAll?: () => void` and `onRemoveAll?: () => void` (or a single optional object — keep it minimal).
- **Header UI:** In the actions column header (next to the existing batch sparkles control), add:
  - **Duplicate all:** icon button reusing `DuplicateIcon`, `disabled={lineItems.length === 0}`, `aria-label` / `title` e.g. “Duplicate all work packages”.
  - **Delete all:** icon button reusing `TrashIcon` + danger styling (match row delete), `disabled={lineItems.length === 0}`.
- **Delete confirmation:** Use `[AlertDialog](src/components/AlertDialog.tsx)` (`tone="danger"`, copy that states N packages will be removed). Open on delete-all click; primary destructive action calls `onRemoveAll` and closes. Cancel closes without mutating. This matches the app’s structured dialogs (vs raw `window.confirm` in `[ScheduleView.tsx](src/pages/planning/ScheduleView.tsx)`).

## Styles (`[work-package-table.css](src/styles/components/planning/work-package-table.css)`)

- The header stack is already a column flex (`[.planning-view__wp-actions-col-content](src/styles/components/planning/work-package-table.css)`). Add a small horizontal group or second row for the two new icon buttons so the column does not grow unbounded (e.g. wrap duplicate-all + delete-all in a `display: flex; gap: 4px;` wrapper with `flex-wrap` if needed). Keep touch targets and alignment consistent with existing `planning-view__wp-action-btn` sizing.

## Edge cases

- **Empty table:** both batch actions disabled (`lineItems.length === 0`).
- **Locked / read-only:** omit callbacks so controls do not render (same pattern as batch apply).
- **Downstream:** Empty `lineItems` is already a valid plan state (e.g. schedule stepper already treats “no packages” as incomplete in `[PlanEditor.tsx](src/pages/planning/PlanEditor.tsx)`); no extra migration.

## Scope / non-goals

- No “selected rows only” batching (that would need selection state and different UX).
- No undo stack beyond existing single `mutatePlan` (same as other bulk edits).

