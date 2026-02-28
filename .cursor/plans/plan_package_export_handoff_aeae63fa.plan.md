---
name: Plan Package Export Handoff
overview: "Add UI for exporting a plan as JSON so the foreman can import it via Settings → Data Transfer. Incorporates gap analysis findings: synthetic WorkType rules, error handling, dual button placement, telemetry, and filename sanitization."
todos: []
isProject: false
---

# Plan Package Export Handoff

**Goal:** Add "Hand off plan" (or "Export plan") UI so planners can export a plan package as JSON for foremen to import via Settings → Data Transfer.

---

## Current State

- **Import:** Implemented (`parsePlanPackageJson`, `applyPlanPackageImport`, Settings → Data Transfer).
- **Export:** `createPlanPackageEnvelope()` exists in [plan-package.ts](src/lib/interop/data-transfer/plan-package.ts) but is never called from UI.
- **Payload contract:** `PlanPackagePayload` = `{ plan, workTypes[], lastModifiedAt }` in [contracts.ts](src/lib/interop/data-transfer/contracts.ts).

---

## Implementation

### 1. Telemetry

Add `interop_plan_package_export` to `TelemetryEventName` in [telemetry.ts](src/lib/telemetry/telemetry.ts), consistent with existing `interop_plan_package_`* events.

---

### 2. Filename Sanitization

Create shared util at `src/lib/utils/sanitize-filename.ts`:

```ts
export function sanitizeFileNameSegment(value: string): string {
  return value.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'plan';
}
```

Extract from [FieldPlanOverlay.tsx](src/pages/field-plan/FieldPlanOverlay.tsx) (lines 78-84) and import there. Use in plan-package export.

---

### 3. plan-package.ts — buildPlanPackagePayload and exportPlanPackage

**File:** [src/lib/interop/data-transfer/plan-package.ts](src/lib/interop/data-transfer/plan-package.ts)

**3.1 Add imports**

- `getAllWorkTypes` from `../../db`
- `sanitizeFileNameSegment` from `../../utils/sanitize-filename`
- `downloadJson` from `../download-json`

**3.2 buildPlanPackagePayload(plan: Plan): Promise****

- Collect unique non-null `workTypeId`s from `plan.lineItems`.
- Call `getAllWorkTypes()` once; filter to those ids.
- For each line item with `workTypeId`:
  - If WorkType found → include in `workTypes` (dedupe).
  - If WorkType not found → create **synthetic** from line item (`workTypeTitle`, `workUnit`, `buildPhase`), generated id `plan-export-${plan.id}-${item.id}`, timestamps via `nowUtc()`.
- For line items with `workTypeId === null` → do NOT add any WorkType (they carry enough data on the line item; no synthetic needed).
- Return `{ plan, workTypes, lastModifiedAt: plan.updatedAt }`.

**3.3 exportPlanPackage(plan: Plan): Promise****

- `payload = await buildPlanPackagePayload(plan)`
- `envelope = createPlanPackageEnvelope(payload)`
- `filename = plan-package-${sanitizeFileNameSegment(plan.title)}-${plan.updatedAt.slice(0, 10)}.json`
- `downloadJson(filename, envelope)`

---

### 4. PlanEditor — Export Button

**File:** [src/pages/planning/PlanEditor.tsx](src/pages/planning/PlanEditor.tsx)

**4.1 Placement**

- **Editable block** (lines 236-256): Add "Hand off" button next to Schedule, Progress, Activate.
- **Read-only block** (lines 257-263): Add "Hand off" button alongside Event Report.

**4.2 Handler**

```ts
const handleExport = async () => {
  try {
    await flushAndWait();
    await exportPlanPackage(currentPlan);
    trackTelemetryEvent('interop_plan_package_export');
  } catch (e) {
    alert('Could not export plan. Please try again.');
  }
};
```

**4.3 Optional polish**

- Brief loading state during export (disable button, show spinner).

---

### 5. Error Handling

- Wrap `exportPlanPackage` call in try/catch.
- On failure: `alert('Could not export plan. Please try again.')` (or toast if available).

---

## Synthetic WorkType Rules (Clarified)


| Case                                                   | Action                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `workTypeId === null`                                  | No WorkType added. Line item has `workTypeTitle`, `workUnit`, `buildPhase`; import uses those. |
| `workTypeId` set, `getWorkType(id)` returns WorkType   | Include existing WorkType in payload.                                                          |
| `workTypeId` set, WorkType not found (deleted/corrupt) | Create synthetic WorkType from line item so import can succeed.                                |


---

## Files to Modify


| File                                                                                           | Changes                                            |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [src/lib/telemetry/telemetry.ts](src/lib/telemetry/telemetry.ts)                               | Add `interop_plan_package_export`                  |
| [src/lib/utils/sanitize-filename.ts](src/lib/utils/sanitize-filename.ts)                       | New file                                           |
| [src/pages/field-plan/FieldPlanOverlay.tsx](src/pages/field-plan/FieldPlanOverlay.tsx)         | Import sanitize from util, remove inline fn        |
| [src/lib/interop/data-transfer/plan-package.ts](src/lib/interop/data-transfer/plan-package.ts) | Add `buildPlanPackagePayload`, `exportPlanPackage` |
| [src/pages/planning/PlanEditor.tsx](src/pages/planning/PlanEditor.tsx)                         | Add Hand off button in both actions blocks         |


---

## Optional / Future

- Export button in ScheduleView header (when planner is on Schedule tab).
- Loading state and toast instead of alert.

