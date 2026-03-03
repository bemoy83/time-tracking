---
name: Schedule Grid Redesign
overview: "Implement the schedule grid redesign per schedule_grid_redesign_next_steps.md: calendar style (remove checkerboard), sticky first column with right-edge shadow, simplified need/capacity display, and unscheduled as inline indicator. All styling uses existing CSS variables."
todos:
  - id: phase1-calendar
    content: "Phase 1: Clean calendar style — remove per-cell bg/radius, add grid borders"
    status: pending
  - id: phase2-sticky
    content: "Phase 2: Sticky first column + right-edge shadow"
    status: pending
  - id: phase4-unscheduled
    content: "Phase 4: Remove Unscheduled block; add badge + left-edge bar on rows"
    status: pending
  - id: phase3-capacity
    content: "Phase 3: Simplify day header to visual-first (bar + compact text)"
    status: pending
isProject: false
---

# Schedule Grid Redesign Implementation Plan

Reference: [schedule_grid_redesign_next_steps.md](.cursor/plans/schedule_grid_redesign_next_steps.md). Constraint: no new background colors; use existing design tokens only.

---

## Phase 1: Clean Calendar Style

**Goal:** Remove per-cell rounded tile/background. Use unified grid surface with borders.

**Files:** [src/styles/components/schedule-view.css](src/styles/components/schedule-view.css)

### 1.1 Grid container as unified surface

- Add background to `.schedule-grid` (or `.schedule-grid__body`): `background: var(--color-surface-subtle)` so the grid has one surface
- The grid body wraps header, rows, footer; ensure the scrollable area has the unified bg

### 1.2 Remove per-cell backgrounds and rounded corners

Current (lines 311-318, 433-444):

```css
.schedule-grid__line-item-col,
.schedule-grid__day-col,
.schedule-grid__line-item,
.schedule-grid__cell,
.schedule-grid__summary-col {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: var(--space-sm) 8px;
}
```

- Remove `background: var(--color-bg)` from these base rules; cells become transparent over the grid bg
- Remove `border-radius` from cells (or reduce to 0)
- Replace with thin borders: `border-bottom: 1px solid var(--color-border)` and `border-right: 1px solid var(--color-border)` (or equivalent) to define cells — use existing `--color-border`

### 1.3 Header row

- Header cells (`.schedule-grid__line-item-col`, `.schedule-grid__day-col`) currently have `background: var(--color-surface-subtle)`. Keep a subtle header treatment: either keep that or use `border-bottom: 2px solid var(--color-border)` for separation. Avoid new colors.

### 1.4 Problem-state cells (preserve existing)

- `.schedule-grid__cell--over`, `--over-crew`, `--over-worker`, `.schedule-grid__day-col--over`, etc. use existing rgba overlays (e.g. `rgba(239, 68, 68, 0.1)`). Keep these; they are already in the design system
- Ensure problem states still read correctly over the new grid (may need to keep a light tint for contrast)

---

## Phase 2: Sticky First Column + Right-Edge Shadow

**Goal:** First column (work package) stays visible during horizontal scroll; right edge has shadow when scrollable.

**Files:** [src/pages/planning/schedule/ScheduleGrid.tsx](src/pages/planning/schedule/ScheduleGrid.tsx), [src/styles/components/schedule-view.css](src/styles/components/schedule-view.css)

### 2.1 Scroll structure

- `.schedule-grid` already has `overflow-x: auto`. The grid rows use `display: grid` with `gridTemplateColumns`
- First-column elements: `.schedule-grid__line-item-col`, `.schedule-grid__line-item`, `.schedule-grid__summary-col`, and `.schedule-grid__phase-label` (phase header spans full width — handle separately)
- Apply `position: sticky; left: 0; z-index: 2` to first-column cells
- Sticky cells need a background so content doesn't show through when scrolling: `background: var(--color-surface-subtle)` (header) and `background: var(--color-bg)` or `var(--color-surface-subtle)` for line-item and summary cells — these are existing tokens

### 2.2 Right-edge shadow

- Add `box-shadow: inset -8px 0 8px -8px rgba(0,0,0,0.15)` (or similar) to the sticky column container, OR use a pseudo-element
- Simpler: add a class when grid is scrolled (optional enhancement) or always add a subtle `border-right: 1px solid var(--color-border)` plus `box-shadow: 2px 0 4px rgba(0,0,0,0.06)` on the first column cells — use low-opacity black so it works in light theme; existing patterns in workspace use similar shadows

### 2.3 Phase header

- `.schedule-grid__phase-label` uses `grid-column: 1 / -1` — it spans full width. For sticky to work, either:
  - Split phase header into sticky label + scrollable spacer, or
  - Leave phase header as-is (it scrolls with the grid) — acceptable since it's a section divider

---

## Phase 3: Need vs Capacity at a Glance

**Goal:** Day header shows required vs available visually, not dense text.

**Files:** [src/pages/planning/schedule/ScheduleGrid.tsx](src/pages/planning/schedule/ScheduleGrid.tsx), [src/styles/components/schedule-view.css](src/styles/components/schedule-view.css)

### 3.1 Simplify `formatUtilBadge` output

- Current output examples: `54h need · 40h capacity`, `54h work · 56h capacity 96%`
- New approach: lead with compact format
  - Over-worker: `54/40h` (need/cap) — existing `--color-recording` for text
  - Normal: `54h` or `54/56h` + `96%` when crew assigned
  - Use existing `.schedule-grid__day-util` and `--over` / `--over-worker` variants for color

### 3.2 Visual bar in day header

- Add a small horizontal bar (similar to `.schedule-grid__util-bar` in footer) to each day header
- Bar fill: `requiredPersonHours / availablePersonHours` capped at 100%; over = 100%+ (bar full + red)
- Use existing: `background: var(--color-border)` for track, `var(--color-primary)` for fill, `var(--color-recording)` for over
- Keep numeric summary (e.g. `54h` or `96%`) next to or below the bar

### 3.3 Utilization footer

- Footer already has progress bars. Ensure styling is consistent with day headers (same colors, no new tokens)

---

## Phase 4: Unscheduled as Inline Indicator

**Goal:** Remove separate Unscheduled section; add badge + left-edge bar on unscheduled rows.

**Files:** [src/pages/planning/schedule/ScheduleGrid.tsx](src/pages/planning/schedule/ScheduleGrid.tsx), [src/styles/components/schedule-view.css](src/styles/components/schedule-view.css)

### 4.1 Remove Unscheduled block

- Delete the `<div className="schedule-view__unscheduled">` block (lines 386-406)
- Delete or repurpose `.schedule-view__unscheduled`, `.schedule-view__unscheduled-title`, `.schedule-view__unscheduled-list`, `.schedule-view__unscheduled-hours` CSS

### 4.2 Badge in block header

- In `schedule-view__block-header`, when `unscheduled.length > 0`, append badge: e.g. "Schedule Grid" with "3 unscheduled" badge
- Use existing badge pattern: e.g. `count-badge` or inline pill with `background: var(--color-amber)` or `var(--color-surface-hover)` and `color: var(--color-text-muted)` — reference [src/styles/components/count-badge.css](src/styles/components/count-badge.css) or status-badge for patterns

### 4.3 Left-edge bar on unscheduled rows

- Unscheduled items are rows with `getAssignedDates(item).length === 0`
- Add modifier class to the row wrapper: `schedule-grid__row--unscheduled`
- Style: `border-inline-start: 3px solid var(--color-amber)` — same pattern as blocked section in [src/styles/components/today-view.css](src/styles/components/today-view.css) (line 179)

---

## File Summary


| File                | Changes                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schedule-view.css` | Calendar style (remove cell bg/radius, add borders), sticky + shadow, day header bar, unscheduled row modifier                                       |
| `ScheduleGrid.tsx`  | Remove Unscheduled block; add badge to header; add `schedule-grid__row--unscheduled` to rows; optional: simplify `formatUtilBadge` or add bar markup |


---

## Styling Constraint Checklist

- No new `--color-`* variables
- Use only: `--color-bg`, `--color-surface-subtle`, `--color-surface-hover`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-recording`, `--color-ready`, `--color-amber`
- Problem states: keep existing rgba overlays (e.g. `rgba(239, 68, 68, 0.1)`) — already in codebase
- Shadows: use `rgba(0,0,0,0.06)` to `0.15` for subtle depth

---

## Implementation Order

1. Phase 1 (calendar style) — foundation
2. Phase 2 (sticky + shadow) — depends on Phase 1
3. Phase 4 (unscheduled) — independent, can parallel
4. Phase 3 (need/capacity) — refines day header

