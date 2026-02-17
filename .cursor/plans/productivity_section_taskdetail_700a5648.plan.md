---
name: Productivity Section TaskDetail
overview: Add a PRODUCTIVITY section to TaskDetail that shows (1) required rate (quantity per person-hour to meet the time estimate) when quantity, estimate, and personnel are set, and (2) actual rate (from tracked time) when the task has time data—with optional comparison on completion.
todos: []
isProject: false
---

# Add Productivity Section to TaskDetail

## Context

We now have: **time estimate**, **work quantity** (with unit), and **personnel** (default workers). Per [BRIEF.md](BRIEF.md): Productivity = Quantity ÷ Person-Hours. This section surfaces that metric in two forms:

1. **Required rate** — Quantity per person-hour needed to complete within the estimate
2. **Actual rate** — Achieved productivity based on tracked time entries (and active timers)

---

## Formulas

**Required productivity:**

```
estimatedPersonHours = (estimatedMinutes / 60) × (defaultWorkers ?? 1)
requiredRate = workQuantity / estimatedPersonHours
```

Units: e.g. `"12.4 m²/person-hr"`

**Actual productivity:**

```
actualPersonHours = totalPersonMs / 3_600_000
actualRate = workQuantity / actualPersonHours
```

Edge case: `totalPersonMs === 0` → cannot compute (show "N/A" or omit actual).

---

## 1. Formatting Helper in types.ts

**File:** [src/lib/types.ts](src/lib/types.ts)

Add:

```ts
/**
 * Format productivity rate for display: "12.4 m²/person-hr"
 */
export function formatProductivity(rate: number, unit: WorkUnit): string {
  const label = WORK_UNIT_LABELS[unit];
  const rounded = rate >= 10 ? Math.round(rate) : rate.toFixed(1);
  return `${rounded} ${label}/person-hr`;
}
```

- Use 1 decimal for small numbers, round for larger
- Handle Infinity / NaN: callers should guard (only call when denominator > 0)

---

## 2. New Component: TaskProductivity

**New file:** [src/components/TaskProductivity.tsx](src/components/TaskProductivity.tsx)

**Props:** `taskId: string`, `subtaskIds: string[]` (same as TaskTimeTracking for breakdown)

**Data sources:**

- `task` via `useTask(taskId)` — workQuantity, workUnit, estimatedMinutes, defaultWorkers
- `breakdown` via `useTaskTimeBreakdown(taskId, subtaskIds, activeTimers)` — totalPersonMs

**Display logic (read-only, no edit):**


| Condition                     | Required rate | Actual rate |
| ----------------------------- | ------------- | ----------- |
| Has Q, E, W                   | Show          | —           |
| Has Q, E, W, and personMs > 0 | Show          | Show        |
| Has Q only, personMs > 0      | —             | Show        |
| Missing quantity              | —             | —           |


- **Required**: "Need X m²/person-hr to meet estimate" (or similar copy)
- **Actual**: "X m²/person-hr" — when completed: "Achieved X" or "Actual: X"; when in progress: "So far: X"

**Optional comparison (when both shown and completed):**

- If actual >= required: neutral/green "Met target"
- If actual < required: amber "Below target" or show variance "% under"

**When to show section at all:**

- Only render when we can show at least one metric (required or actual)
- If no quantity: hide section entirely
- If quantity but nothing else: hide (can't compute either)
- Empty state: "Set work quantity, time estimate, and personnel to see required productivity."

**Structure:**

- Use `ExpandableSection` with label `"PRODUCTIVITY"`, default closed
- Collapsed: show badge with rate if we have one (e.g. "12.4 m²/hr" or "Required: 10 m²/hr")
- Expanded: Required block + Actual block, with short labels

---

## 3. Integration in TaskDetail

**File:** [src/pages/TaskDetail.tsx](src/pages/TaskDetail.tsx)

- Insert after Personnel, before Notes:

```tsx
{/* 6. Personnel */}
<TaskPersonnel taskId={task.id} />

{/* 7. Productivity (when quantity + estimate or time) */}
<TaskProductivity taskId={task.id} subtaskIds={subtasks.map((s) => s.id)} />

{/* 8. Notes */}
<TaskNotes taskId={task.id} />
```

- Render `TaskProductivity` only when `task.workQuantity != null && task.workUnit != null` (otherwise no metrics possible)
- Or: always render, let component handle empty state (cleaner—one less conditional in parent)

---

## 4. Styling

**New file:** [src/styles/components/task-productivity.css](src/styles/components/task-productivity.css)

- Reuse `section-heading`, card patterns from [task-work-quantity.css](src/styles/components/task-work-quantity.css)
- Two rows: "Required" and "Actual" (or "Achieved")
- Optional status pill for "Met target" / "Below target"

**File:** [src/index.css](src/index.css) — add import for `task-productivity.css`

---

## 5. Icon

Use an existing icon (e.g. chart/gauge style) or add a simple `ProductivityIcon` / `TrendIcon`. [icons.tsx](src/components/icons.tsx) has Clock, Ruler, People—a bar-chart or speed-style icon would fit. Can defer and use a generic icon initially.

---

## Summary: Display Matrix


| workQuantity | workUnit | estimatedMinutes | defaultWorkers | totalPersonMs | Required | Actual |
| ------------ | -------- | ---------------- | -------------- | ------------- | -------- | ------ |
| 120          | m2       | 120              | 3              | 0             | Yes      | No     |
| 120          | m2       | 120              | 3              | 3600000       | Yes      | Yes    |
| 120          | m2       | null             | 3              | 3600000       | No       | Yes    |
| 120          | m2       | null             | null           | 0             | No       | No     |
| null         | null     | 120              | 3              | 0             | No       | No     |


---

## Out of Scope

- KPI dashboard / aggregate view (separate feature)
- Target thresholds or configurable "good" vs "bad" (can add later)
- Productivity on parent task when work is in subtasks (current model: quantity on leaf task; parent aggregates time only—keep simple for now)

