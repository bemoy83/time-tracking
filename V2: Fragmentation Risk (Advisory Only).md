# V2: Fragmentation Risk (Advisory Only)

## Summary

Add a day-level fragmentation warning layer that identifies days where actual scheduled effort is split across too many small allocations, which likely reduces real-world throughput through switching, movement, and coordination overhead.

Locked decisions:
- fragmentation is advisory only
- it does not change `plannedPersonHours`
- it does not change effective-capacity math
- it does not change auto-schedule placement
- it appears in both single-plan and shared schedule views
- only `moderate` and `high` risk are surfaced
- warnings are based on allocated day effort only, never unresolved or shortfall effort

## Prerequisites

This plan is blocked until all of these are true:

1. V1 `defaultEfficiency` is implemented and merged.
2. Daily capacity already distinguishes raw/effective capacity in the capacity layer.
3. Grid/header/utilization surfaces already read from the V1 effective-capacity model.
4. Shared schedule capacity summary and shared auto-schedule already use the V1 capacity basis.

Implementation rule:
- if any prerequisite is not met, do not begin V2 implementation
- complete V1 first, then re-check the capacity contracts before starting V2

## Key Changes

### Capacity contract

Extend `DailyCapacity` with:

```ts
assignedRowCount: number;
smallAllocationCount: number;
allocatedPersonHours: number;
averageAllocationPersonHours: number | null;
largestAllocationShare: number | null;
fragmentationScore: number;
fragmentationRisk: 'none' | 'moderate' | 'high';
```

Extend `CapacitySummary` with:

```ts
fragmentedDayCount: number;
highFragmentationDayCount: number;
```

Definitions:
- `allocatedPersonHours`: sum of positive scheduled effort allocations on that day
- `assignedRowCount`: number of phase rows with positive effort on that day
- `smallAllocationCount`: number of phase rows contributing `< 2.0h` on that day
- `averageAllocationPersonHours`: `allocatedPersonHours / assignedRowCount`, or `null` if no assigned rows
- `largestAllocationShare`: `largestSingleRowPH / allocatedPersonHours`, or `null` if no allocated effort

Row-count rule:
- count each phase row once per day if it has positive effort
- assembly and dismantle count as separate rows
- zero-effort rows do not count

### Risk scoring

Compute fragmentation inside the same daily capacity aggregation pass that totals scheduled effort.

Use named constants:
- `FRAGMENTATION_SMALL_ALLOCATION_HOURS = 2`
- `FRAGMENTATION_MIN_SURFACED_HOURS = 4`
- `FRAGMENTATION_ROW_THRESHOLD_MODERATE = 5`
- `FRAGMENTATION_ROW_THRESHOLD_HIGH = 8`
- `FRAGMENTATION_SMALL_COUNT_MODERATE = 2`
- `FRAGMENTATION_SMALL_COUNT_HIGH = 4`
- `FRAGMENTATION_AVERAGE_HOURS_THRESHOLD = 2`
- `FRAGMENTATION_LARGEST_SHARE_THRESHOLD = 0.45`

Score:
- `+1` if `assignedRowCount >= 5`
- `+1` if `assignedRowCount >= 8`
- `+1` if `smallAllocationCount >= 2`
- `+1` if `smallAllocationCount >= 4`
- `+1` if `averageAllocationPersonHours != null && averageAllocationPersonHours < 2`
- `+1` if `largestAllocationShare != null && largestAllocationShare < 0.45 && assignedRowCount >= 4`

Risk mapping:
- `0–1` => `none`
- `2–3` => `moderate`
- `4+` => `high`

Surface gate:
- do not surface fragmentation unless `allocatedPersonHours >= 4`
- days below that threshold may compute metrics internally but must surface as `none`

### UI and issue behavior

Grid header:
- keep effective-capacity display unchanged
- add a distinct amber advisory treatment for `moderate` and `high`
- do not reuse overload/error styling
- tooltip shows:
  - fragmentation risk
  - assigned rows
  - small allocations
  - average allocation
  - largest allocation share

Issue panel:
- add `fragmentation` to `ScheduleIssueKind`
- create one plan-scope issue when at least one day is surfaced as `moderate` or `high`
- set:
  - `severity: 'warning'`
  - `category: 'optimization'`
  - `assistantPriority: 75`

Highest-risk day selection:
- sort by highest `fragmentationRisk`
- then highest `fragmentationScore`
- then earliest date

Suggestions for `fragmentation`:
- consolidate the smallest allocations onto fewer days where possible
- keep buffer on the highest-fragmentation day instead of filling it to nominal capacity
- move low-effort rows to adjacent lower-risk days if phase dates allow

Apply the same logic in single-plan and shared schedule views.

## Implementation Notes

Use the capacity pipeline as the source of truth:
- aggregate `allocatedPersonHours`, row counts, small-allocation counts, and max single-row effort in the normalized day pass
- derive fragmentation metrics only from scheduled positive day allocations
- do not feed fragmentation into utilization, over-allocation, effective capacity, or scheduling logic

Primary touchpoints:
- [capacity.ts](/Users/bemoy/Developer/time-tracking/src/lib/planning/scheduling/capacity.ts)
- [schedule-view-issues.ts](/Users/bemoy/Developer/time-tracking/src/pages/planning/workspace/schedule-view-issues.ts)
- [ScheduleGridHeader.tsx](/Users/bemoy/Developer/time-tracking/src/pages/planning/schedule/grid/ScheduleGridHeader.tsx)

Also update:
- schedule issue panel types to include `fragmentation`
- schedule issue suggestions to include fragmentation guidance

No persistence, schema, import/export, or migration changes are required.

## Test Plan

Add coverage for:
- prerequisite guard:
  - V2 implementation does not proceed against pre-V1 capacity contracts
- capacity scoring:
  - 1–3 large allocations => `none`
  - 5 allocations with 2 small tasks and `>= 4h` total => `moderate`
  - 8 allocations with 4 small tasks, low largest-share, and `>= 4h` total => `high`
- surface gate:
  - a day below `4h` total never surfaces fragmentation warning even if raw score is high
- zero-work and single-row days:
  - fragmentation metrics stay null/zero as expected
- shared schedule aggregation:
  - multiple plans contributing many small rows on one day produce surfaced fragmentation risk
- issue generation:
  - one plan-level fragmentation warning is created
  - highest-risk day is named first using the locked tie-break rules
  - fragmentation suggestions appear
- grid header:
  - `moderate` and `high` show amber advisory treatment
  - tooltip values match computed fragmentation metrics
  - `none` renders no advisory warning
- regression:
  - fragmentation does not change effective capacity, utilization, over-allocation, or auto-schedule placement

## Assumptions

- small allocation threshold is `< 2.0h`
- surfaced warnings require at least `4h` allocated on the day
- the same thresholds apply to single-plan and shared views
- fragmentation remains advisory only in V2
