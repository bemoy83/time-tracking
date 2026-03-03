---
name: Hand off and Activate to Schedule
overview: Move Hand off and Activate actions from Plan Editor to Schedule view. Plan Edit focuses on managing work packages; hand off and activation belong after schedule is set.
todos: []
isProject: false
---

# Move Hand off and Activate to Schedule

**Rationale:** Hand off makes more sense after schedule is set. Plan Edit should focus on managing work packages only.

---

## Changes

### PlanEditor

**File:** [src/pages/planning/PlanEditor.tsx](src/pages/planning/PlanEditor.tsx)

- Remove Hand off button from editable actions block (lines 309–311)
- Remove Activate / Revert to Draft button from editable actions block (lines 313–315)
- Remove Hand off button from read-only block (lines 324–326)
- Remove unused: `exportPlanPackage` import, `isExporting` state, `handleExport`, `activatePlan`, `revertToDraft` imports, `handleToggleLock`
- Keep: Schedule (nav), Progress (when locked), Event Report (read-only)

### ScheduleView

**File:** [src/pages/planning/ScheduleView.tsx](src/pages/planning/ScheduleView.tsx)

- Destructure `flushAndWait` from `usePlanEditorState`
- Add imports: `exportPlanPackage` from plan-package; `activatePlan`, `revertToDraft` from plan-model
- Add state: `isExporting`
- Add handlers: `handleExport` (flushAndWait → exportPlanPackage), `handleToggleLock` (activate/revert)
- Add action buttons in header area (next to Print): Hand off, Activate/Revert (when !readOnly)
- When readOnly: show only Hand off (no Activate — reviewed plans cannot be activated)
- Button styling: Hand off as `btn--secondary`, Activate as `btn--success` when locked / `btn--secondary` when draft

---

## Placement

Header currently: `Back | Schedule (title) | Print`

Add: `Print | Hand off | Activate` (or `Revert to Draft` when active). Group in a compact row or inline with Print.

---

## Files Summary


| File                                                                       | Changes                                                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [src/pages/planning/PlanEditor.tsx](src/pages/planning/PlanEditor.tsx)     | Remove Hand off, Activate; remove related imports and handlers  |
| [src/pages/planning/ScheduleView.tsx](src/pages/planning/ScheduleView.tsx) | Add Hand off, Activate; add flushAndWait, export, lock handlers |


