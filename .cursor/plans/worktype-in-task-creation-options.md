# WorkType in Task Creation — Design Options

## Current State

**Template mode**: User picks template → CreateTaskSheet gets `workTypeId` from template → task has WorkType. All good.

**Blank mode**: User picks Blank → CreateTaskSheet has no template → task gets `workTypeId: null`. No WorkType selection available.

**Impact**: Blank tasks don’t participate in productivity KPIs, Calculator “Apply to Task”, or remediation matching.

---

## Goal

Include WorkType selection whenever adding work (tasks with quantity/unit). Ensure both Blank and Template paths support a WorkType.

---

## Option A: WorkType Picker in CreateTaskSheet (Blank Mode)

**Flow**: TemplatePickerSheet unchanged. When `template=null` and `showWork=true`, add a WorkType dropdown to CreateTaskSheet.

**Behavior**:
- WorkType dropdown (required when showWork=true)
- On selection: lock unit + build phase from WorkType; default title from `workType.title`
- User adds: quantity, estimate, workers
- Task gets `workTypeId` and denormalized fields

**Pros**: Minimal UX change; Blank and Template use the same CreateTaskSheet.
**Cons**: Blank still means “no template”; the “Blank” label can be confusing since we now require WorkType.

---

## Option B: Three-Way Picker — [Blank] [Work Type] [Template]

**Flow**: Replace TemplatePickerSheet segments with three options.

| Mode   | Meaning                                               | CreateTaskSheet receives      |
|--------|--------------------------------------------------------|-------------------------------|
| Blank  | No productivity tracking (coordination, admin)        | No WorkType, title only       |
| Work Type | Quantifiable work, no saved template               | `workTypeId` only             |
| Template | Quantifiable work, full template pre-fill          | `template` (includes WorkType)|

**Behavior**:
- **Blank**: CreateTaskSheet with `showWork=false` (or minimal) — no WorkType
- **Work Type**: List of WorkTypes → pick one → CreateTaskSheet with `workTypeId`, user fills quantity, estimate, workers
- **Template**: List of templates → pick one → CreateTaskSheet with template (current behavior)

**Pros**: Clear separation. “Work Type” is the primary path for adding quantified work.
**Cons**: Extra segment; Blank might be rare.

---

## Option C: WorkType-First Unified Flow

**Flow**: Single “New Task” flow. Step 1 is always “Work type?” when adding work.

- **No work type** (e.g. “Other” / “None”): title-only task, no productivity fields
- **Pick WorkType**: Pre-fill unit, build phase, expected rate; user adds quantity, estimate, workers
- **Pick Template** (optional): If user picks a template, it pre-fills WorkType + quantity + estimate + workers

**Behavior**: WorkType is the main decision. “From template” is a shortcut that pre-fills everything.

**Pros**: WorkType is central; aligns with productivity focus.
**Cons**: Bigger UX change; flow may feel heavier.

---

## Option D: Always WorkType; Templates as Presets

**Flow**: For tasks with work (`showWork=true`), WorkType is always selected first.

- TemplatePickerSheet becomes: [Blank – no work] [Add work]
- “Add work” → WorkType picker (required) → optionally “Use template” if a template exists for that WorkType → CreateTaskSheet

**Behavior**:
- Blank = task without work tracking
- Add work = pick WorkType first, then optionally a template that matches it

**Pros**: WorkType is primary; templates become convenience presets.
**Cons**: Requires templates to be scoped/filtered by WorkType.

---

## Recommended: Option A

Reasons:
1. **Smallest change** — add WorkType picker only when `template=null` and `showWork=true`.
2. **Same form** — CreateTaskSheet handles both Blank and Template; only the source of `workTypeId` changes (picker vs template).
3. **Consistent outcome** — both paths produce tasks with `workTypeId` when work is tracked.

**Implementation sketch**:
- `CreateTaskSheet`: when `template == null` and `showWork === true`, render WorkType dropdown (required).
- On WorkType select: set unit from `workType.workUnit`, build phase from `workType.buildPhase`, default title to `workType.title`.
- `createTask` call: pass `workTypeId`, `workUnit`, `buildPhase`, `targetProductivity` from selected WorkType.

---

## Edge Cases

1. **Subtask creation** (`showWork=false`): No WorkType picker. Attribution can inherit from parent.
2. **No WorkTypes defined**: Show empty state “Create work types in Settings” and block creation until at least one exists (when showWork=true).
3. **Template + different WorkType**: Not applicable — template owns WorkType. No mixed override.
