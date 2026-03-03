# Schedule Grid Redesign — Next Steps

**Context:** BRIEF.md (exhibition build operations, quantity-based work, staffing estimates, productivity), Phase 3 focus on schedule usability.  
**Reference:** Forecast-style resource planning — calendar look, clean grid, at-a-glance capacity.  
**Scope:** Schedule grid only. Tablet/desktop ≥820px.  
**Role:** Product/architecture — WHAT to improve, WHY.

---

## Design Direction (User Input)

1. **Calendar style, not checkerboard:** Remove the "every cell has its own rounded tile/background" pattern. Move to a clean calendar aesthetic with shared grid lines, unified surface. The checkerboard noise must go.

2. **Sticky column + shadow:** After the clean calendar style is in place, the sticky first column gets a right-edge shadow so it reads as distinct when scrolling.

3. **Need vs capacity, allocated vs need at a glance:** Planner must see:
   - **Need vs capacity** (per day): Does the day fit? Required vs available person-hours, visually clear.
   - **Allocated vs need** (per day): What's assigned vs what's needed — at a glance, not buried in dense text.

4. **Unscheduled:** No separate "Unscheduled" section. Items stay in the grid list. Use an alert badge or status indicator (e.g. left-edge bar on unscheduled rows) instead.

---

## Grounding: Event Planner's Job

From BRIEF: *"Accurate productivity tracking... reliable data-driven estimates... improved visibility into crew performance."*

The schedule grid supports the planner (Bjørn) in:
1. **Assignment:** Where does each work package go? (which days)
2. **Feasibility:** Does the work fit? (capacity vs demand)
3. **Crew tuning:** How many people per day per package?

The planner thinks in: *"Day 1 of build," "we're behind on Day 2," "which packages are overloaded?"*

---

## Current State (What's Already Done)

| Capability | Status |
|------------|--------|
| Event-relative day labels (Day 1 \| Mon 3 Mar) | Done |
| PeopleIcon + crew inline per cell | Done |
| Hours badge with over-worker "Xh / Yh" | Done |
| Phase grouping (Build-up / Tear-down) | Done |
| Amendment popover (no window.prompt) | Done |
| FeasibilityBar (sticky, top) | Done |
| EventContextBar | Done |
| ConflictResolutionBanner | Done |
| Day/column over-allocation styling | Done |
| Utilization footer with progress bar | Done |
| Keyboard navigation | Done |

**Current visual problem:** Each cell has its own rounded background (`background: var(--color-bg)`, `border-radius`), creating a checkerboard/tiled look. This must be removed in favor of a calendar style.

---

## Redesign Priorities

### 1. Clean Calendar Style (Foundation)

**Problem:** Checkerboard noise — every cell has its own rounded tile/background. Visual clutter.

**Intent:**
- Replace per-cell backgrounds with a unified grid surface
- Use shared grid lines or subtle dividers (borders) to define cells
- Cells are delineated by structure, not by individual card treatment
- Reference: Forecast resource planner — clean, calendar-like, minimal per-cell decoration

**Outcome:** Grid reads as one calendar surface, not a mosaic of tiles.

---

### 2. Sticky First Column + Right-Edge Shadow

**Intent:**
- First column (work package names) sticky during horizontal scroll
- **After** calendar style is implemented: add right-edge shadow (or border) on the sticky column so it visually separates from day columns when scrolling
- Shadow conveys "this panel floats above the timeline"

---

### 3. Need vs Capacity / Allocated vs Need at a Glance

**Clarification:** The "day badge" is the utilization info in the day header. The user wants this information *visually*, not as dense text.

**Per day (column):**
- **Need vs capacity:** Required person-hours vs available person-hours. At a glance = percentage bar, color (green/amber/red), or compact numeric (e.g. `54/56h` or `96%`) — not a long string.
- **Allocated vs need:** What's been assigned vs what's required. Again, visual-first — color in column, compact number, or bar.

**Per cell (assignment):**
- Assigned cells: hours + crew. Status (OK vs over-worker) via color, not text-heavy badge.

**Intent:** Lead with visual encoding (color, bar, icon). Numbers support but don't dominate. Planner answers "does this day fit?" and "is this cell OK?" without parsing paragraphs.

---

### 4. Unscheduled: Inline Indicator, No Separate Section

**Problem:** Current "Unscheduled" block below the grid duplicates items that are already in the list (as rows with no assignments).

**Intent:**
- **Remove** the separate Unscheduled section
- Unscheduled items remain as rows in the grid (they're already there)
- Add an indicator instead:
  - **Option A:** Alert badge — e.g. "3 unscheduled" in the grid header or schedule block header
  - **Option B:** Status indicator — left-edge bar (or similar) on each unscheduled row in the list
  - Or both: badge for count, left-edge bar for which rows

**Why:** Item is already in the list; we just need to signal "this one needs placement" without a duplicate UI block.

---

## Implementation Order

| Step | Work | Why |
|------|------|-----|
| 1 | Clean calendar style — remove per-cell rounded backgrounds, use grid lines | Foundation; must be done before shadow reads correctly |
| 2 | Sticky first column + right-edge shadow | Depends on step 1 |
| 3 | Need vs capacity / allocated vs need — simplify day header to visual-first | At-a-glance requirement |
| 4 | Unscheduled — remove section, add badge or left-edge bar | Reduces duplication, cleaner layout |

---

## What to Defer

- Sidebar collapse optimization (per user)
- Kanban-style layout (line items in sidebar) — out of scope
- Drag-and-drop assignment — future
- Separate "Assign to Day" from unscheduled list — items stay in grid; assign by clicking cells

---

## Open Questions

1. **Grid line treatment:** Thin borders vs. subtle background alternation for row definition? Calendar tools often use light horizontal/vertical lines.
2. **Day header format:** For "at a glance" — percentage bar only? `54/56h` + color? Or keep compact text (`96%`) with color as backup?
3. **Left-edge bar for unscheduled:** Color? Width? How subtle vs. prominent?
