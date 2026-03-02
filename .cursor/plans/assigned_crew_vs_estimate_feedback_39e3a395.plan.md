---
name: Assigned Crew vs Estimate Feedback
overview: Add assigned-capacity-vs-required comparison so planners get feedback in both directions (deficit and excess). Assigned crew × access hours = capacity; compare to required person-hours. Always show the relationship; use neutral "excess capacity" language; add min crew hint and ConflictResolutionBanner suggestion.
todos: []
isProject: false
---

# Assigned Crew vs Estimate Feedback

## Problem

When both days' demands are met, the planner can continue adding crew with no feedback. There is no signal for excess capacity. The system only validates deficit (over-worker), not excess.

**User expectation:** Assigned crew should calculate person-hours (capacity) and be compared against the estimate (required). Feedback in both directions: under-staffed and over-staffed.

## Solution

- **Assigned capacity** = `assignedCrewTotal × accessHours` (person-hours the assigned crew can provide)
- **Required (estimate)** = `requiredPersonHours` (from work package allocation)
- **Two distinct comparisons:**
  - **Required vs day available:** Utilization (%). Constraint: don't exceed day capacity.
  - **Required vs assigned capacity:** Estimate vs what assigned crew can do. Constraint: meet demand; excess is advisory.
- Compare and surface both directions:
  - **Deficit:** required > capacity → over-worker (existing)
  - **Excess:** capacity > required → excess capacity (new; neutral language)
- When multiple items share a day, the comparison is aggregate. Excess could come from any item; user adjusts per-item crew in the Crew/day row.

---

## Implementation

### 1. Extend DailyCapacity with assigned capacity

**File:** [src/lib/planning/scheduling/capacity.ts](src/lib/planning/scheduling/capacity.ts)

**1.1 Add to DailyCapacity:**

- `assignedCapacityPersonHours: number` — `assignedCrewTotal × accessHours`
- `isOverStaffed: boolean` — true when `assignedCapacityPersonHours > requiredPersonHours` (and required > 0). Internal name; user-facing: "excess capacity".

**1.2 Add to CapacitySummary:**

- `overStaffedDayCount: number` — count of days with excess capacity.

**1.3 Compute in the days mapping (after aggregation):**

```ts
const assignedCapacityPersonHours = round2(day.assignedCrewTotal * (day.accessHours || 8));
const isOverStaffed = day.isWorkDay && day.requiredPersonHours > 0 && assignedCapacityPersonHours > day.requiredPersonHours + 0.01;
```

---

### 2. Update ScheduleGrid day header badge

**File:** [src/pages/planning/schedule/ScheduleGrid.tsx](src/pages/planning/schedule/ScheduleGrid.tsx)

**2.1 Always show assigned capacity when crew is set**

When `assignedCrewTotal > 0`, always show required vs assigned capacity so the model is transparent. Balanced: `54h (7 crew → 56h) 56%`.

**2.2 Badge logic (integrated)**

```ts
const assignedCapacity = cap.assignedCrewTotal * (cap.accessHours || 8);
if (cap.isOverWorkerCapacity) {
  return `${required}h / ${assignedCapacity.toFixed(0)}h max`;
}
if (cap.isOverStaffed) {
  const excess = round(assignedCapacity - required);
  return `${required}h / ${assignedCapacity.toFixed(0)}h (+${excess}h excess)`;
}
// Balanced: show crew capacity for transparency
if (cap.assignedCrewTotal > 0) {
  return `${required}h (${cap.assignedCrewTotal} crew → ${assignedCapacity.toFixed(0)}h) ${pct}%`;
}
return `${required}h ${pct}%`;
```

**2.3 Styling**

- `schedule-grid__day-util--over-worker` for deficit (existing; red).
- `schedule-grid__day-util--over-staffed` for excess (amber/info, distinct from deficit).

---

### 3. Minimum crew hint in Crew/day row

**File:** [src/pages/planning/schedule/ScheduleGrid.tsx](src/pages/planning/schedule/ScheduleGrid.tsx)

When Crew/day row is expanded, show a hint per assigned day:

- **Per-item per-day:** `perDay = (item.timeHours * item.crew) / getAssignedDates(item).length`
- **min crew** = `ceil(perDay / day.accessHours)` from WorkCalendarDay
- Display: `min 7 crew for 54h` below or beside the crew input.
- When over-staffed for that item: `+2 crew (16h excess)`.

Requires: import `dayAccessHours` from work-calendar; get `accessHours` from `calendar` (WorkCalendarDay) for each day.

---

### 4. FeasibilityBar: excess capacity (informational)

**File:** [src/pages/planning/schedule/FeasibilityBar.tsx](src/pages/planning/schedule/FeasibilityBar.tsx)

When `overStaffedDayCount > 0`, show: `X days with excess crew capacity` — informational style (amber), not error. User may intentionally over-staff; advisory only.

---

### 5. ConflictResolutionBanner: reduce crew suggestion

**File:** [src/pages/planning/schedule/ConflictResolutionBanner.tsx](src/pages/planning/schedule/ConflictResolutionBanner.tsx) and/or [conflict-resolution.ts](src/lib/planning/scheduling/conflict-resolution.ts)

When `overStaffedDayCount > 0`:

- Add: "X day(s) have excess crew capacity — reduce crew in Crew/day to match demand, or leave as buffer."
- Optional: "Show days" action to scroll to over-staffed columns.

---

### 6. Cell-level feedback (optional, defer if clutter)

When a cell is assigned and that day has excess capacity, consider a subtle indicator on the cell (e.g. faint "+" or buffer icon). Defer if it adds clutter.

---

### 7. Unit tests

**File:** [src/lib/planning/scheduling/capacity.test.ts](src/lib/planning/scheduling/capacity.test.ts)

- Test: 20h total, 2 days, 4 crew each → 10h/day, 4×8=32h capacity/day → not over-worker, not over-staffed.
- Test: Same setup, 6 crew each → 6×8=48h capacity, 10h required → `isOverStaffed` true, `assignedCapacityPersonHours` = 48.

---

## Display Examples


| State                                    | Day header badge          |
| ---------------------------------------- | ------------------------- |
| Balanced (54h req, 7 crew → 56h)         | `54h (7 crew → 56h) 56%`  |
| Over-worker (54h req, 5 crew → 40h)      | `54h / 40h max`           |
| Excess capacity (54h req, 10 crew → 80h) | `54h / 80h (+26h excess)` |


---

## Files to Modify


| File                                                      | Changes                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `capacity.ts`                                             | Add `assignedCapacityPersonHours`, `isOverStaffed`, `overStaffedDayCount`          |
| `capacity.test.ts`                                        | Add tests for excess capacity and assigned capacity                                |
| `ScheduleGrid.tsx`                                        | Extend `formatUtilBadge`; always show crew capacity; min crew hint in Crew/day row |
| `schedule-view.css`                                       | Styles for `--over-staffed` (amber/info)                                           |
| `FeasibilityBar.tsx`                                      | Excess crew capacity day count (informational)                                     |
| `ConflictResolutionBanner.tsx` / `conflict-resolution.ts` | Suggest reducing crew when excess                                                  |


