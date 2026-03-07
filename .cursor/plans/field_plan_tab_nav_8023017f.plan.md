---
name: Field Plan Tab Nav
overview: Promote Field Plan from a hidden TodayView button to a first-class tab. Hide the Planning tab on mobile (< 768px). Clean up the now-redundant TodayView plan indicator.
todos:
  - id: app-tab-type
    content: "Update App.tsx: add 'fieldPlan' to Tab, remove fieldPlan View type, fix handleBack guard, add always-visible Field Plan tab button, update nav and renders"
    status: pending
  - id: fieldplan-header
    content: Remove BreadcrumbNav entirely in tab mode; replace with plain h1 header matching Today view style
    status: pending
  - id: fieldplan-css
    content: Add field-plan-view__title CSS rule; adjust field-plan-view__title-section padding for h1 height
    status: pending
  - id: todayview-cleanup
    content: Remove onNavigateToFieldPlan prop, executorPlans state/effect, and plan-indicator button from TodayView
    status: pending
  - id: css-cleanup
    content: Remove .today-view__plan-indicator CSS rule; update empty state copy
    status: pending
isProject: false
---

# Field Plan Tab Navigation

## Changes

### `[src/App.tsx](src/App.tsx)`

- Add `'fieldPlan'` to `Tab` type
- Remove `{ type: 'fieldPlan'; returnTo: ReturnTo }` from `View` type — Field Plan is now purely a tab, no longer a push-navigation
- Remove the `view.type === 'fieldPlan'` render block
- **Fix `handleBack`**: remove `|| view.type === 'fieldPlan'` from the guard (line 121) since that View variant is gone
- Add `view.type === 'tab' && view.tab === 'fieldPlan'` render block for `<FieldPlanView />` — no `onBack` prop passed (tab mode)
- Remove `onNavigateToFieldPlan` from `<TodayView>` props
- In the `<nav>`: conditionally hide the Planning button when `!isWideScreen` (reuses existing `WORKSPACE_MIN_WIDTH` / `useMediaQuery`)
- Add Field Plan tab button in position after Planning (before Settings) — **always visible**, no feature flag condition, shown on all screen widths
- Add `FieldPlanIcon` SVG function component (clipboard-style, distinct from the bar-chart `PlanningIcon`)

### `[src/pages/field-plan/FieldPlanView.tsx](src/pages/field-plan/FieldPlanView.tsx)`

- Make `onBack` optional (`onBack?: () => void`)
- **Remove `BreadcrumbNav` entirely in tab mode** (when `onBack` is undefined): replace `field-plan-view__title-section` content with `<h1 className="field-plan-view__title">Field Plan</h1>` — matches the `<h1>Tasks</h1>` pattern in TodayView
- Remove the `fieldPlanExecution` feature flag guard entirely from `FieldPlanView` — the feature is now permanently accessible via the tab; there is no valid "redirect away" path in tab mode
- Remove the `BreadcrumbNav` import if no longer used in any code path

### `[src/pages/TodayView.tsx](src/pages/TodayView.tsx)`

- Remove `onNavigateToFieldPlan` from `TodayViewProps` and component args
- Remove `executorPlans` state, `fieldPlanEnabled` local var, the `getAllPlans` useEffect, and `fieldPlanIndicator` computed value
- Remove `today-view__plan-indicator` button from the header JSX
- Remove now-unused imports: `getAllPlans`, `Plan` type, `getFeatureFlag`

### `[src/styles/components/field-plan.css](src/styles/components/field-plan.css)`

- Add `.field-plan-view__title` rule matching `today-view__title` (font-size: `var(--font-large)`, font-weight: 800, margin: 0, color: `var(--color-text)`)
- Add top padding to `.field-plan-view__title-section` to compensate for the removed BreadcrumbNav touch-target height, so the content below doesn't shift

### `[src/styles/components/today-view.css](src/styles/components/today-view.css)`

- Remove the `.today-view__plan-indicator` rule block

### `[src/pages/field-plan/FieldPlanView.tsx](src/pages/field-plan/FieldPlanView.tsx)` — empty state copy

- Update empty state text from *"Import a planner package to start execution in Field Plan View."* → *"Import a plan package to get started."* (removes now-redundant "Field Plan View" self-reference)

## Behaviour Summary

- **Phone (< 768px)**: nav shows Today | Projects | Field Plan | Settings — Planning hidden
- **Tablet+ (≥ 768px)**: nav shows Today | Projects | Planning | Field Plan | Settings
- **Field Plan tab header**: plain `<h1>Field Plan</h1>`, no back button — consistent with Today view
- **Field Plan tab (no plans)**: `empty-state` with updated copy; FAB is the import entry point
- **Field Plan tab (plans exist)**: plan selector and detail as before
- `**previousTabRef` bonus**: exiting the planning workspace from a tablet returns the user to Field Plan if that was their previous tab — no extra code needed
- **Feature flag**: `fieldPlanExecution` flag guard removed from `FieldPlanView`; the tab is always present and functional

