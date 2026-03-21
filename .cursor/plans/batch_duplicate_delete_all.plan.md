---
name: Batch duplicate/delete all
overview: Add duplicate-all and delete-all for work packages with AlertDialog confirmation for both actions, shared copy pattern, and plan-model helpers.
todos:
  - id: plan-model-helpers
    content: Add duplicateAllLineItemsInPlan + removeAllLineItemsFromPlan in plan-model.ts and tests in plan-model.test.ts
  - id: plan-editor-handlers
    content: Wire handlers + optional props from PlanEditor to WorkPackageTable with readOnly/isLocked guards
  - id: work-package-table-ui
    content: Add header buttons and dual AlertDialogs (duplicate + delete) with shared copy pattern; CSS for header actions
---

# Batch duplicate all / delete all (work packages)

## Current behavior (baseline)

- **Single duplicate:** [`duplicateLineItem`](src/lib/planning/plan-model.ts) + [`addLineItemToPlan`](src/lib/planning/plan-model.ts).
- **Single delete:** [`removeLineItemFromPlan`](src/lib/planning/plan-model.ts).
- **Batch suggestions:** [`handleBatchApplySuggestions`](src/pages/planning/PlanEditor.tsx) in one `mutatePlan` callback.
- **Import path:** [`addLineItemsToPlan`](src/lib/planning/plan-model.ts) in [`usePlanLineItemImport`](src/pages/planning/hooks/usePlanLineItemImport.ts).

## Domain layer ([`plan-model.ts`](src/lib/planning/plan-model.ts))

1. **`duplicateAllLineItemsInPlan(plan: Plan): Plan`** — `plan.lineItems.map(duplicateLineItem)` then `addLineItemsToPlan(plan, copies)`.
2. **`removeAllLineItemsFromPlan(plan: Plan): Plan`** — `{ ...plan, lineItems: [], updatedAt: nowUtc() }`.
3. **Tests** in [`plan-model.test.ts`](src/lib/planning/plan-model.test.ts).

## PlanEditor ([`PlanEditor.tsx`](src/pages/planning/PlanEditor.tsx))

- `handleDuplicateAll` / `handleRemoveAll` call `mutatePlan` with the new helpers (only after confirmation from the table/dialog layer).
- Pass optional callbacks when `!(readOnly || isLocked)`, same guard as [`onBatchApplySuggestions`](src/pages/planning/PlanEditor.tsx).

## WorkPackageTable ([`WorkPackageTable.tsx`](src/pages/planning/WorkPackageTable.tsx))

- Optional `onDuplicateAll?: () => void` and `onRemoveAll?: () => void`.
- Header: duplicate-all and delete-all icon buttons; `disabled` when `lineItems.length === 0`.

### Confirmation UX (both actions)

Use [`AlertDialog`](src/components/AlertDialog.tsx) for **duplicate all** and **delete all** (not only delete).

**Copy pattern** (parameterize `action` verb and reuse `count = lineItems.length`):

- **Title or body:** “Are you sure you want to [action] all. This will [action] [count] work packages”
  - **Duplicate:** e.g. action verbs *duplicate* — “Are you sure you want to duplicate all. This will duplicate 5 work packages”
  - **Delete:** e.g. action verbs *delete* — “Are you sure you want to delete all. This will delete 5 work packages”

**Buttons:** [Cancel] (secondary / dismiss) and [Confirm] (primary; use `danger` variant for delete, `primary` or non-danger for duplicate).

**Flow:**

- Click duplicate-all → open duplicate `AlertDialog` → Confirm calls `onDuplicateAll()`.
- Click delete-all → open delete `AlertDialog` → Confirm calls `onRemoveAll()`.

Implement with local state in `WorkPackageTable` (e.g. `confirmKind: 'duplicate' | 'delete' | null`) or two booleans; only one dialog open at a time.

## Styles ([`work-package-table.css`](src/styles/components/planning/work-package-table.css))

- Header action row / flex for batch icon buttons; align with existing `planning-view__wp-action-btn` patterns.

## Edge cases

- Empty table: batch buttons disabled; dialogs never need to open with count 0 if buttons are disabled.
- Locked / read-only: omit callbacks; hide or disable batch controls consistently with batch magic.

## Scope / non-goals

- No row-selection batching.
- Title collisions after duplicate-all follow existing `duplicateLineItem` behavior.
