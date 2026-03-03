# Schedule Grid Redesign — Implementation Analysis & Improvement Suggestions

**Context:** Redesign implemented per [schedule_grid_redesign_next_steps.md](schedule_grid_redesign_next_steps.md). This document analyzes the current state and suggests refinements.

---

## What's Working Well

1. **Calendar style:** Per-cell rounded backgrounds removed; unified grid with borders. Checkerboard noise eliminated.
2. **Sticky first column:** Line-item column stays visible during scroll; right-edge shadow (`box-shadow: 2px 0 4px`) provides separation.
3. **Day header bar:** Visual progress bar for need vs capacity; over state (red) clear at a glance.
4. **Simplified util badge:** `127/96h` and `32/96h 33%` are more compact than the previous long format.
5. **Unscheduled inline:** Badge in header + left-edge bar on rows; no separate section.
6. **Problem-state cells:** Over, over-crew, over-worker still use existing rgba tints.

---

## Suggested Improvements

### 1. Line-item meta legibility

**Issue:** Long text (e.g. `6993 m² · 8.0h / 127.1h`) in the sticky column at ~220px min-width may truncate or feel cramped. The DOM sample showed `127.1` without trailing `h` — could be truncation or inspector artifact.

**Suggestions:**
- Ensure `.schedule-grid__line-item` has `min-width: 0` if it's in a flex/grid child (allows proper flex behavior)
- If truncation occurs: add `overflow: hidden; text-overflow: ellipsis` with `title` for full text on hover
- Or: allow `word-break: break-word` / wrapping for the meta line so it doesn't need to fit on one line
- Consider increasing `minmax(220px, 1.3fr)` to `minmax(240px, 1.3fr)` if space allows

---

### 2. Day header: bar vs text redundancy

**Issue:** Day header shows bar + util text (e.g. bar at 33% + `32/96h 33%`). The percentage appears twice (bar and text).

**Suggestions:**
- **Option A:** When bar is present, show only `32/96h` — the bar conveys the proportion
- **Option B:** When balanced (under 100%), show only bar + percentage (`33%`) — drop the `32/96h` to reduce clutter
- **Option C:** Keep both for power users who want exact numbers; ensure bar and text align visually (bar first, then compact text)

---

### 3. Over-worker day semantics

**Issue:** Day 1 shows `127/96h` — required > available. The format is compact but could be clearer that this is "need exceeds capacity."

**Suggestions:**
- Add a small visual cue: use `.schedule-grid__day-util--over-worker` (already exists) to ensure red/warning color is applied
- Optional: prefix with "!" or use slightly bolder weight when over
- Current `formatUtilBadge` for over-worker returns `need/available` — correct; verify the `--over` and `--over-worker` modifier classes are applied so the color reads as warning

---

### 4. Shadow placement for sticky column

**Issue:** `box-shadow: 2px 0 4px rgba(0,0,0,0.06)` casts a shadow to the right. For a left sticky column, an *inset* shadow on the right edge can read more naturally as "column floats above content."

**Suggestion (optional):**
- Try `box-shadow: inset -6px 0 8px -6px rgba(0,0,0,0.08)` on the sticky cells — creates a subtle gradient from the right edge without adding visual bulk. Revert if it feels off.

---

### 5. Footer last row border

**Issue:** Footer cells have `border-bottom: none` (override). The last row may not have a clear bottom edge against the rounded grid container.

**Suggestion:**
- Add `border-bottom: 1px solid var(--color-border)` to the footer row container (e.g. `.schedule-grid__footer`) or ensure the schedule-grid's `border-radius` clips the content and the last row's cells still read as bounded.

---

### 6. Accessibility: role="grid" placement

**Issue:** `role="grid"` and `aria-label="Schedule grid"` are on the outer `<section>`, which includes the block header ("Schedule Grid" title + unscheduled badge). The accessible grid should only wrap the actual grid (header row, body, footer).

**Suggestion:**
- Move `role="grid"` and `aria-label` to the scrollable `.schedule-grid` div
- Keep the `<section>` as a generic container or use `role="region"` with a descriptive label if needed

---

### 7. Day bar height

**Issue:** Bar is 4px — may be subtle on high-DPI or from a distance.

**Suggestion:**
- Consider `height: 5px` or `6px` for better visibility; keep proportions consistent with footer util bar.

---

### 8. Grid row spacing

**Issue:** Rows are stacked with no gap (flex column, no gap). Borders provide separation. If the grid feels too dense:

**Suggestion:**
- Add `gap: 1px` or `2px` between header/body/footer if the borders feel too tight — or leave as-is if current density is preferred.

---

## Quick Wins (Low Effort)

| # | Improvement | File | Change |
|---|-------------|------|--------|
| 1 | Move role="grid" to .schedule-grid | ScheduleGrid.tsx | Swap role/aria-label from section to inner div |
| 2 | Ensure over-worker day has warning color | ScheduleGrid.tsx | Verify `cap.isOverWorkerCapacity` applies `--over-worker` to day-util span |
| 3 | Day bar height 5px | schedule-view.css | `.schedule-grid__day-bar { height: 5px; }` |
| 4 | Footer bottom border | schedule-view.css | `.schedule-grid__footer { border-bottom: 1px solid var(--color-border); }` or equivalent |

---

## Defer / Validate with User

- **Shadow variant:** Inset vs. current drop shadow — subjective
- **Day header simplification:** Bar-only vs. bar+text — user preference
- **Line-item width:** Only increase min if truncation is observed in practice
