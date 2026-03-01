---
name: Schedule Worker Capacity Validation Fix
overview: "Fix the allocation logic so the schedule validates that person-hours per line item per day do not exceed what the assigned crew can physically work (effectiveCrew × accessHours). Implement Option B: validate, flag, and surface warnings — no hard blocks."
todos: []
isProject: false
---

# Schedule Worker Capacity Validation Fix

## Problem

The schedule allows impossible allocations: e.g. 27 person-hours assigned to 1 crew on a single day. One worker cannot work more than `accessHours` (typically 8h) in one workday.

**Constraint:** `personHoursForItemOnDay ≤ crewForItemOnDay × accessHoursForDay`

---

## Approach (Option B)

- **Validate** allocation after computing `personHoursForDay` per item per day
- **Flag** when violated (`isOverWorkerCapacity`)
- **Warn** in UI; no hard blocks
- **Resolution:** User adds crew, adds days, or extends access times (overtime)

---

## Implementation

### 1. Extend capacity data structures

**File:** [src/lib/planning/scheduling/capacity.ts](src/lib/planning/scheduling/capacity.ts)

**1.1 Add `accessHours` to `DailyCapacity`**

In `buildDayMap`, each day is built from `WorkCalendarDay`. Add:

```ts
accessHours: dayAccessHours(day)
```

Import `dayAccessHours` from work-calendar. When building from `listDateRange` fallback (no work calendar), use default 8h.

**1.2 Add `isOverWorkerCapacity` to `DailyCapacity`**

New field: `boolean` — true when any line item on that day has `personHoursForDay > effectiveCrew × accessHours`.

**1.3 Add `overWorkerCapacityDayCount` to `CapacitySummary`**

Count of days where `isOverWorkerCapacity` is true.

---

### 2. Validate allocation in `computeCapacitySummary`

**File:** [src/lib/planning/scheduling/capacity.ts](src/lib/planning/scheduling/capacity.ts)

**2.1 Obtain `accessHours` per day**

When building `dayMap`, ensure each entry has `accessHours`. For the `listDateRange` fallback (no work calendar), each generated day gets `accessHours: 8` (08:00–16:00 default).

**2.2 Detect per-item violation**

During allocation (both `hasCrewByDate` and even-split branches), after computing `personHoursForDay` for each (item, date):

```ts
const maxAllowed = effectiveCrew * (day.accessHours ?? 8);
if (personHoursForDay > maxAllowed) {
  day.isOverWorkerCapacity = true;
}
```

**2.3 Set `isOverWorkerCapacity` on day**

Initialize `isOverWorkerCapacity: false` in `buildDayMap`. Set to `true` when any item violates the constraint on that day. Ensure it propagates into the final `days` array and `CapacitySummary`.

**2.4 Compute `overWorkerCapacityDayCount`**

Add to return: `overWorkerCapacityDayCount: days.filter(d => d.isOverWorkerCapacity).length`.

---

### 3. Extend `FeasibilityBar` to show worker-capacity warning

**File:** [src/pages/planning/schedule/FeasibilityBar.tsx](src/pages/planning/schedule/FeasibilityBar.tsx)

Add a third warning block (similar to over-allocated and over-crewed):

- When `capacity.overWorkerCapacityDayCount > 0`:
  - Show: `{overWorkerCapacityDayCount} day(s) exceed worker capacity (add crew or days)`
  - Use same warning icon/style as existing blocks

---

### 4. Extend `ConflictResolutionBanner` (optional)

**File:** [src/pages/planning/schedule/ConflictResolutionBanner.tsx](src/pages/planning/schedule/ConflictResolutionBanner.tsx)

**4.1 Include worker-capacity in conflict detection**

Ensure `generateConflictSuggestions` (or equivalent) considers `isOverWorkerCapacity` when deciding `hasConflicts`. If it does not, extend it to treat over-worker-capacity days as conflicts.

**4.2 Add suggestion for worker-capacity**

For days with `isOverWorkerCapacity`:

- **Solve for crew:** Suggest increasing crew for the affected line item(s) on that day (e.g. "Add 2 crew to Teppefliser on Mon").
- **Solve for overtime:** Same as over-allocation — extend `accessEnd` to allow more hours per worker.
- **Solve for days:** Suggest spreading work over more days (user would unassign and reassign to a longer span).

The conflict-resolution module may need a new suggestion type or to extend `generateConflictSuggestions` to handle `isOverWorkerCapacity`. Check [conflict-resolution.ts](src/lib/planning/scheduling/conflict-resolution.ts) for current structure.

---

### 5. ScheduleGrid visual treatment (optional)

**File:** [src/pages/planning/schedule/ScheduleGrid.tsx](src/pages/planning/schedule/ScheduleGrid.tsx)

- When `cap?.isOverWorkerCapacity`, add class `schedule-grid__day-col--over-worker` (and `schedule-grid__cell--over-worker` for assigned cells on that day).
- Reuse or define CSS to distinguish from `--over` and `--over-crew` (e.g. different border or badge style).

---

### 6. Work-calendar fallback for `accessHours`

**File:** [src/lib/planning/scheduling/capacity.ts](src/lib/planning/scheduling/capacity.ts)

In `buildDayMap`, when using `listDateRange` fallback, the mapped object has `accessStart: '08:00'`, `accessEnd: '16:00'`. Use `dayAccessHours` on that object, or explicitly set `accessHours: 8` when the day object is minimal (no WorkCalendarDay shape).

---

## Files to Modify


| File                                                       | Changes                                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/lib/planning/scheduling/capacity.ts`                  | Add `accessHours`, `isOverWorkerCapacity`; validate allocation; `overWorkerCapacityDayCount` |
| `src/pages/planning/schedule/FeasibilityBar.tsx`           | Display over-worker-capacity warning                                                         |
| `src/lib/planning/scheduling/conflict-resolution.ts`       | Include worker-capacity in suggestions (if not already)                                      |
| `src/pages/planning/schedule/ConflictResolutionBanner.tsx` | Show worker-capacity in banner when relevant                                                 |
| `src/pages/planning/schedule/ScheduleGrid.tsx`             | Optional: over-worker visual styling                                                         |
| `src/styles/components/planning.css` (or schedule CSS)     | Optional: `--over-worker` styles                                                             |


---

## Test Cases

- **Single day, 1 crew, 27 person-hours:** Expect `isOverWorkerCapacity` true, warning shown.
- **Single day, 4 crew, 32 person-hours, 8h access:** 4×8=32, no violation.
- **Two days, 1 crew each, 16 person-hours total:** 8h each day, no violation.
- **Two days, 1 crew each, 20 person-hours total:** 10h per day, violation (unless overtime extends to 10h).

---

## Out of Scope

- Hard block on invalid allocation
- Automatic redistribution when violated
- Changing allocation formula (still proportional to crew; we only validate and warn)

