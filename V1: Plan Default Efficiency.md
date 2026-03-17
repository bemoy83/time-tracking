# V1: Plan Default Efficiency

## Summary

Add a plan-level `defaultEfficiency` that reduces usable day capacity without changing task effort math.

Task effort remains exact:
```ts
plannedPersonHours = quantity / rate
```

Capacity becomes:
```ts
rawCapacity = crew * accessHours
effectiveCapacity = rawCapacity * resolvedEfficiency
```

Locked decisions for v1:
- `defaultEfficiency` exists on `Plan`, not on `WorkCalendarDay`
- default behavior is `0.8`
- allowed range is `0.5–1.0`
- editable only in single-plan schedule view
- shared schedule uses fixed `0.8` for the whole shared workspace
- no plan-level amendment-note requirement in v1
- task effort, KPI math, and execution data stay unchanged

## Implementation Changes

### Data model and normalization

Add to `Plan`:
```ts
defaultEfficiency: number | null;
```

Rules:
- `null` means “use app default”
- resolved app default is `0.8`
- store decimal values, display percentages
- clamp to `0.5–1.0` in input and normalization

Add helpers:
- `DEFAULT_PLAN_EFFICIENCY = 0.8`
- `resolvePlanEfficiency(plan)` returning a clamped decimal
- `normalizePlanEfficiency(value)` for import/DB/UI boundaries

Persistence:
- DB normalization sets missing `defaultEfficiency` to `null`
- import/export adds `defaultEfficiency` as an optional backward-compatible field
- no schema hard-break for this feature alone

Behavioral migration note:
- older plans without the field will immediately plan against `80%` usable capacity after upgrade unless changed by the planner

### Capacity and scheduler semantics

Keep raw productivity math unchanged. Only capacity changes.

Lock `DailyCapacity` shape to include both:
- `rawAvailablePersonHours`
- `effectiveAvailablePersonHours`
- `requiredPersonHours`
- `utilization`, defined as `required / effectiveAvailable`

Over-allocation rule:
```ts
isOverAllocated = requiredPersonHours > effectiveAvailablePersonHours
```

Do not overload raw-capacity fields silently. Existing UI must be migrated deliberately.

Capacity helpers:
- keep raw crew/hour helpers
- add `dayEffectiveAvailablePersonHours(day, defaultCrewSize, efficiency)`

Apply effective capacity consistently in:
- single-plan capacity summary
- single-plan auto-scheduler remaining-day capacity
- shared capacity summary
- shared auto-scheduler remaining-day capacity

Shared schedule v1 decision:
- shared workspace always uses fixed `0.8`
- this is intentionally independent from per-plan `defaultEfficiency`
- if a plan shows different capacity in single-plan view vs shared view, that is accepted v1 behavior
- no shared efficiency editing in v1

### UI behavior

Single-plan schedule view:
- add `defaultEfficiency` control near default crew
- percent UI, decimal storage
- presets: `70%`, `80%`, `90%`
- manual input allowed within `50%–100%`
- clearing the input resets to `null` which resolves to `80%`

Single-plan explanatory text:
- show one short helper line near the control:
  - “Usable daily capacity is planned at 80% of raw crew-hours.”

Grid and metrics:
- grid header shows effective capacity, e.g. `16 / 19.2h`
- tooltip shows:
  - raw capacity
  - efficiency
  - usable capacity
- utilization and headroom use effective capacity
- schedule coverage stays based on required effort vs scheduled effort, not effective capacity
- any “Available hrs” wording that now means usable capacity must be renamed or labeled explicitly as usable/effective

UI scope:
- editable only in single-plan schedule view
- no other plan-editing surfaces expose this control in v1
- shared schedule does not expose or inherit plan-level efficiency settings in UI

### Audit and active plans

V1 decision:
- changing `defaultEfficiency` on an active plan does not require an amendment note
- reason: the current model has no plan-level amendment storage
- no new audit model is introduced in v1

## Testing

Add or update tests for:

- Plan normalization
  - missing `defaultEfficiency` becomes `null`
  - invalid values clamp to `0.5–1.0`
  - resolved helper returns `0.8` for `null`

- Capacity math
  - `4 crew * 8h = 32 raw`, `25.6 effective` at `0.8`
  - `24h` required is not overallocated
  - `28h` required is overallocated
  - utilization uses effective, not raw, capacity

- Auto-scheduling
  - a workload spans more days at `0.8` than at `1.0`
  - assistant uses effective capacity in day placement

- Shared schedule
  - shared capacity uses fixed `0.8`
  - shared auto-schedule uses fixed `0.8`
  - selected-plan efficiency values do not affect shared v1 capacity

- UI
  - efficiency control updates single-plan schedule header and utilization immediately
  - helper text and tooltip reflect raw vs effective capacity
  - schedule coverage remains unchanged when only efficiency changes

- Import/export
  - round-trip preserves explicit `defaultEfficiency`
  - older payloads missing the field still import correctly

## Assumptions and defaults

- Default effective-capacity factor is `0.8`
- Allowed range is `0.5–1.0`
- V1 has no per-day efficiency overrides
- V1 has no fragmentation logic or smart auto-adjustment
- `defaultEfficiency` is a planning buffer, not a productivity correction
- Shared schedule intentionally uses fixed `0.8` as a workspace-level simplification in v1
- KPI calculations and execution records remain unchanged
