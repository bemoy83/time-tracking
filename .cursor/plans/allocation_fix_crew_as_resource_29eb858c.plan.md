---
name: Allocation Fix Crew as Resource
overview: Fix the schedule allocation so person-hours per day are always evenly distributed across assigned days, regardless of crewByDate. crewByDate becomes "how many workers to accomplish the work on that day" for validation and capacity only—not a proportion that reshuffles the workload.
todos: []
isProject: false
---

# Allocation Fix: Crew as Resource (Not Proportion)

## Problem

Current allocation: `personHoursForDay = totalPersonHours * (effectiveCrew / sumCrew)`

- Adding crew to a day **increases** that day's workload and **decreases** others
- User intent: crew is the **resource** to meet a fixed workload per day
- Result: Adjusting crew to fix over-worker makes the problem worse—unusable

## Solution

**Always use even split** for person-hours distribution. crewByDate affects only:

- **assignedCrewTotal** (capacity: assigned vs available crew)
- **Worker capacity validation** (can this crew do the allocated hours?)
- **UI** (crew input per day)

Person-hours per day = `totalPersonHours / dates.length` — fixed, regardless of crew.

---

## Implementation

### 1. Simplify capacity allocation in capacity.ts

**File:** [src/lib/planning/scheduling/capacity.ts](src/lib/planning/scheduling/capacity.ts)

**1.1 Remove proportional-to-crew branch**

Delete the `hasCrewByDate` conditional block (lines 107-127). Use a single allocation path for all scheduled items.

**1.2 Always use even split**

```ts
const perDay = totalPersonHours / dates.length;
for (const date of dates) {
  const day = dayMap.get(date);
  if (!day) continue;
  day.requiredPersonHours += perDay;
  day.assignedCrewTotal += getEffectiveCrewForDate(item, date);  // crew for capacity
  day.lineItemCount += 1;
  // Worker capacity: can this crew do perDay?
  const effectiveCrew = getEffectiveCrewForDate(item, date);
  const maxAllowed = effectiveCrew * (day.accessHours || 8);
  if (perDay > maxAllowed + 0.01) {
    day.isOverWorkerCapacity = true;
  }
}
```

**1.3 Remove unused import**

If `getEffectiveCrewForDate` is only used for assignedCrewTotal and effectiveCrew in the loop, keep it. No other imports need to change.

**1.4 Key change**

- `requiredPersonHours` per day: always `totalPersonHours / dates.length` (even split)
- `assignedCrewTotal`: sum of `getEffectiveCrewForDate(item, date)` across items — unchanged for capacity logic
- Worker capacity: `perDay > effectiveCrew * accessHours` — validation still uses per-day crew

---

### 2. Verify no other allocation logic depends on proportional crew

**Files to check:**

- [execution-return.ts](src/lib/interop/data-transfer/execution-return.ts): Uses crewByDate for export, not allocation. No change.
- [auto-schedule.ts](src/lib/planning/scheduling/auto-schedule.ts): Initializes crewByDate with item.crew for each day. With even split, that's fine—work is even, crew starts even.

---

### 3. Update schedule intelligence plan (optional)

**File:** [.cursor/plans/schedule_intelligence_feature_1cef62c7.plan.md](.cursor/plans/schedule_intelligence_feature_1cef62c7.plan.md)

In Phase 2 allocation model, note: allocation is always even split; crewByDate is for validation and capacity only, not proportional distribution.

---

### 4. Test scenarios


| Scenario                                                  | Before (proportional)      | After (even split)                                |
| --------------------------------------------------------- | -------------------------- | ------------------------------------------------- |
| 2 days, 5 crew Mon / 4 crew Tue, 108h total               | Mon 60h, Tue 48h           | Mon 54h, Tue 54h                                  |
| Add 1 crew to Mon                                         | Mon 64.3h, Tue 42.9h       | Mon 54h, Tue 54h (unchanged)                      |
| Add crew to Mon to fix over-worker (54h, 1 crew → 8 crew) | Would increase Mon's share | Mon stays 54h; 8 crew × 8h = 64h capacity — fixed |


---

## Out of Scope

- Explicit per-day person-hours (personHoursByDate): future enhancement if user wants manual distribution
- Changing crewByDate semantics elsewhere: ScheduleGrid, WorkCalendarEditor, amendments, plan-schedule-update — no changes needed; crewByDate remains "crew assigned to this package on this day"

