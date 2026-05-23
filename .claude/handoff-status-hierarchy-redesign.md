# Handoff — Task Status & Hierarchy Redesign

## What this session is about

Structural reversal of how the task list communicates two things that are currently conflated:

1. **Project assignment** — currently shown as a small coloured dot (`TaskProjectDot`) absolutely positioned at `left: 16px` inside each row.
2. **Task status** — currently shown as a coloured `border-inline-start: 4px solid` accent bar on the `.swipeable-row` wrapper, driven by CSS `:has()` selectors on status classes.

The desired end state:
- **Accent bar → project colour** (tells the user which project a task belongs to)
- **Status dot/bar → status badge** in a dedicated visible column (tells the user what state the task is in — idle, in progress, timer running, blocked, completed)

A status badge column existed in an earlier version and was removed in a previous refactor. This session restores and redesigns it.

---

## Current implementation (precise)

### Task status — how it works today

`TaskStatus = 'active' | 'completed' | 'blocked'` (src/lib/types.ts:21)

"Timer running" and "in progress" are **derived**, not stored. `TaskRow` computes them:
```ts
const isTimerActive = activeTimers.some((t) => t.taskId === task.id);  // live timer
const isBlocked = task.status === 'blocked';
const isCompleted = task.status === 'completed';
const isInProgress = hasProgress({ totalMs, isTimerActive });           // has logged time, no live timer
```

Five visual states map to four CSS classes applied to `.task-row` / `.task-card`:
| Visual state | CSS class | Accent colour |
|---|---|---|
| Idle (no time, no timer) | _(none)_ | none |
| In progress (has logged time) | `task-row--in-progress` | blue `--color-primary` |
| Timer running | `task-row--active` | red `--color-recording` |
| Blocked | `task-row--blocked` | amber `--color-amber` |
| Completed | `task-row--completed` | green `--color-ready` |

### Accent bar — where the CSS lives

`src/styles/components/today-view.css` — 8 `:has()` selector blocks covering:
- Main task list (lines ~130–145)
- Subtask drawer (lines ~203–216)
- First/last child radius compensation (lines ~220–236) — these exist because `border-inline-start` on the swipeable-row breaks the container's `border-radius` at the corners

### Project colour — how it flows today

1. Parent (TodayView) computes colour via `resolveProjectColor(task)` → hex string
2. Passed as `projectColor?: string` prop through `TaskCard` / `TaskRow` / `SwipeableTaskRow`
3. Rendered as `<TaskProjectDot>` → `<ProjectColorDot size="sm">` — a small coloured circle
4. Positioned absolutely at `left: var(--space-md)` (16px) inside the row
5. Row left padding is `calc(var(--space-md) + 18px)` — the 18px accounts for the dot width

---

## What needs to change

### 1. Accent bar → project colour

The CSS `:has()` approach **cannot** drive project colour — project colours are user-defined strings (unlimited palette), not enumerable CSS classes. The bar colour must become an inline style.

**Approach:** Pass `projectColor` up to the `SwipeableRow` or its parent, and apply `style={{ borderInlineStartColor: projectColor }}` directly. A class like `swipeable-row--has-project` can toggle the bar on/off without the inline style needing to know the colour.

Tasks with no project assigned → no bar (or a neutral/muted bar, TBD).

The 8 `:has()` status blocks in `today-view.css` are **removed** entirely. The first/last child radius compensation selectors that exist only because of those blocks are also removed.

### 2. Project dot → remove

Once the accent bar carries project colour, the `TaskProjectDot` is redundant. Remove it from `TaskCard` and `TaskRow`. The left padding `calc(var(--space-md) + 18px)` simplifies to `var(--space-md)`.

`showProjectDot` prop on `TaskRow` / `SwipeableTaskRow` can be deleted.

### 3. Status badge column

A compact status indicator needs to appear in the row, always visible. Design decisions to make in-session:

**What states show a badge?** Options:
- All 5 states (idle gets a neutral "not started" badge)
- Only non-idle (4 states; idle shows nothing, keeping the row clean)

**Where does it sit?**
- `TaskRow` currently has grid `1fr auto` (title | actions). A badge column would be `auto 1fr auto` (badge | title | actions) or `1fr auto auto` (title | badge | actions).
- Leading position (before title) is conventional for status indicators — easier to scan a column of badges.
- Trailing position (after title, before chevron) is more compact but mixed with the time badge.

**Badge design:** Re-use the existing `StatusBadge` component (`src/styles/components/status-badge.css`) — it's a pill at `--font-caption` size. New modifier classes needed:
- `.status-badge--idle` (or omit entirely for idle)
- `.status-badge--in-progress`
- `.status-badge--recording` (timer running — most urgent)
- `.status-badge--blocked` (already exists conceptually)
- `.status-badge--completed` (already exists)

Consider icon-only badges (no text) for compactness in narrow rows — the `TaskListIcon`, `PlayIcon`, `ClockIcon` etc. are already available in `src/components/icons.tsx`.

---

## Files to touch

| File | Change |
|---|---|
| `src/styles/components/today-view.css` | Remove all 8 `:has()` status accent blocks and radius compensation selectors; add `.swipeable-row--has-project` accent bar rule |
| `src/styles/components/task-row.css` | Add status badge column to grid; remove dot left-padding offset |
| `src/styles/components/task-card.css` | Remove dot positioning; adjust left padding |
| `src/styles/components/status-badge.css` | Add task-status badge variants |
| `src/components/TaskRow.tsx` | Add status badge rendering; remove `showProjectDot`; adjust className logic |
| `src/components/TaskCard.tsx` | Remove `TaskProjectDot`; remove dot-related class/padding |
| `src/components/SwipeableTaskRow.tsx` | Remove `showProjectDot` prop; pass project colour to swipeable wrapper for bar |
| `src/components/SwipeableRow.tsx` | Accept optional `accentColor?: string` prop for the bar |
| `src/styles/_dark.css` | Any dark mode status badge overrides |

Also check:
- `src/pages/today/BlockedSection.tsx` — renders SwipeableTaskRow, may need badge
- `src/components/CompletedSection.tsx` — same
- `src/pages/ProjectDetail.tsx` — same
- `src/styles/components/field-plan.css` — has its own blocked row styling that may need to align

---

## Constraints & gotchas

**Separator `::before` alignment** — in the polish session, task row/card separators were changed to inset `::before` pseudo-elements with `left: calc(var(--space-md) + 18px)`. If the dot is removed and left padding changes to `var(--space-md)`, the separator left value must also update to `var(--space-md)`.

**Subtask accent bars** — the subtask drawer (`.today-view__subtasks`) has its own set of `:has()` status selectors that mirror the main list ones. Both sets are removed together.

**`hasProgress` utility** — the in-progress derived state comes from `src/lib/utils/taskProgress.ts`. The badge needs the same inputs (`totalMs`, `isTimerActive`) that TaskRow already receives.

**`task-row--active` class is also used in `ExpandableSection`** — grep before removing to confirm no other consumers depend on it for non-accent purposes.

**Radius compensation selectors** — lines ~220–236 in `today-view.css` apply `border-start-start-radius` / `border-end-start-radius` corrections to first/last accented rows. These exist solely because the accent border breaks the container's `border-radius`. Removing the status accent removes the need for these selectors entirely. Verify the container's corner rounding looks correct after removal.
