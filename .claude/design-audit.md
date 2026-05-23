# Design Audit — Time Tracking App

Audited at commit `b2f6033`. Update the **Status** column as issues are resolved.

---

## Design System Snapshot

### Token files
| File | Purpose |
|---|---|
| `src/styles/_variables.css` | All design tokens (colors, spacing, radius, shadow, typography) |
| `src/styles/_dark.css` | All dark mode overrides in one file |
| `src/styles/_base.css` | Reset, keyframes, base layout |
| `src/styles/_a11y.css` | Accessibility enhancements |
| `src/styles/components/` | 90+ component-specific CSS files |

### Color tokens (light mode)
| Token | Value | Role |
|---|---|---|
| `--surface-base-bg` | `#e8eaf0` | Page background |
| `--surface-contained-bg` | `#ffffff` | Cards, task rows |
| `--surface-contained-hover` | `#d4d6e0` | Hover state |
| `--surface-contained-active` | `#c8cad4` | Active/pressed state |
| `--color-text` | `#13131a` | Primary text |
| `--color-text-muted` | `#65657a` | Secondary/muted text |
| `--color-primary` | `#2563eb` | Interactive blue |
| `--color-recording` | `#dc2626` (via `--state-danger-fg`) | Active timer / danger |
| `--color-ready` | `#16a34a` (via `--state-success-fg`) | Success / complete |
| `--color-amber` | `#d97706` (via `--state-warning-fg`) | Blocked / warning |
| `--card-shadow` | `none` | Card shadow — currently disabled |

### Typography scale
| Token | Value | Usage |
|---|---|---|
| `--font-large` | `1.5rem` / 24px | Page titles, status control |
| `--font-heading` | `1.1875rem` / 19px | Section headings |
| `--font-body` | `1rem` / 16px | Body, buttons, labels |
| `--font-small` | `0.8125rem` / 13px | Badges, timestamps, metadata |
| `--font-label` | `0.75rem` / 12px | Field labels |
| `--font-caption` | `0.6875rem` / 11px | Dense data — smallest in system |
| Font family | `'Outfit'`, system-ui | Primary typeface |

### Spacing scale
| Token | Value |
|---|---|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |

### Sizing
| Token | Value | Usage |
|---|---|---|
| `--touch-min` | 44px | Minimum touch target |
| `--timer-bar-height` | 140px | Fixed timer drawer height |
| `--action-bar-height` | 76px | Task detail bottom action bar |

### Radius scale
`--radius-sm` 4px · `--radius-md` 8px · `--radius-lg` 14px · `--radius-xl` 20px · `--radius-2xl` 26px · `--radius-full` 9999px

### Shadow scale
| Token | Value |
|---|---|
| `--shadow-xs` | `0 1px 3px rgba(0,0,0,0.05)` |
| `--shadow-sm` | `0 2px 12px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)` |
| `--shadow-md` | `0 6px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)` |

### Animation easing
| Token | Value | Usage |
|---|---|---|
| `--ease-enter` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrances — smooth decelerate |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Microinteractions — slight overshoot |

---

## Component State Snapshot

### TaskCard (`src/components/TaskCard.tsx`, `src/styles/components/task-card.css`)
- Layout: absolute project dot left edge, title + time badge row, progress bar row
- Title: `font-weight: 500` (current), `font-size` inherits body (16px)
- Padding: `var(--space-sm) var(--space-md) var(--space-sm) calc(var(--space-md) + 18px)`
- Expand button: **28×28px** (below `--touch-min`)
- Hover: `--surface-contained-hover`; Active: `--surface-contained-active`
- Status classes: `task-card--active` (timer running), `task-card--in-progress`
- Left border accent applied at parent `.today-view__task-list > .swipeable-row` level via `:has()` selector

### TaskRow (`src/components/TaskRow.tsx`, `src/styles/components/task-row.css`)
- Layout: grid `1fr auto`, project dot absolute left edge
- Title: `font-weight: 500` (current)
- Expand button: **44×44px** when parent has subtasks; plain chevron (20×20px, muted) when navigating
- Blocked chip: solid amber `#d97706` bg + white text, 13px uppercase — **contrast ~2.7:1 (WCAG fail)**
- Blocked reason: `color: var(--color-amber)`, preceded by `·` pseudo-element
- Subtask variant: extra left padding `calc(var(--space-md) + 18px + var(--space-lg))`
- Completed: `opacity: 0.85`, title strikethrough + muted color

### Tab Navigation (`src/styles/components/tab-nav.css`)
- Fixed bottom, height 56px
- Active: `box-shadow: inset 0 3px 0 0 var(--color-primary)` + `--surface-brand-subtle` bg
- No transition on active indicator switch (instantaneous)
- Icon: 24×24px; label: `--font-small` (13px), weight 600 active / 500 inactive

### Timer Bar (`src/styles/components/timer.css`)
- Fixed bottom, `min-height: 140px` — always fully expanded
- Recording state: `--color-recording-bg` (`#fef2f2`) background + red border
- Workers badge: **24px height** (below `--touch-min`), `border-radius: 12px`
- Start button: green `--color-ready`; Stop button: red `--color-recording`; both `min-height: 44px`, `min-width: 120px`

### Task Detail Status Control (`src/styles/components/task-detail.css:55-127`)
- Full-width pill, `min-height: 44px`, `border-radius: var(--radius-xl)`
- Same visual treatment for interactive (active, recording) and non-interactive (blocked, completed) states
- Blocked: `cursor: default` but looks identical to interactive states — no affordance distinction
- Font size: `--font-large` (24px) — very large for a status label

### Button System (`src/styles/components/btn.css`)
- Default radius: `--radius-xl` (20px pill)
- `--secondary` bg: `var(--color-border)` = `#e0e0e0` — same as border color, reads near-disabled
- Spring animation on `:active` (scale 0.96, `--ease-spring` on release)
- Sizes: xs 28px · sm 36px · default 44px · lg 44px+

### Status Badge (`src/styles/components/status-badge.css` — path inferred)
- Shape: `border-radius: 9999px` pill
- `--status-badge-draft-bg: #b45309` — **not overridden in `_dark.css`**

### Swipeable Row (`src/components/SwipeableRow.tsx`)
- Left action: Complete (green, CheckIcon)
- Right action: Start (blue, PlayIcon) — hidden when timer already active
- Threshold: 80px swipe to trigger
- No first-use affordance / gesture hint

### Today View Sections (`src/styles/components/today-view.css`)
- Project subsection header: 12px uppercase, `letter-spacing: 0.08em`, muted text + solid blue pill badge
- Task list group: `background: --surface-contained-bg`, `border-radius: --card-radius`, no shadow
- Left border accents: 4px solid, applied via CSS `:has()` selectors on `.swipeable-row` wrappers
- Subtask expand: instant show/hide, no height transition

---

## Findings & Status

| # | Priority | Issue | File(s) | Status |
|---|---|---|---|---|
| 1 | P1 | `--card-shadow: none` — task lists are flat, no depth cue | `_variables.css:159` | Open |
| 2 | P1 | Task title `font-weight: 500` — too light, no hierarchy | `task-card.css:49`, `task-row.css:57` | Resolved |
| 3 | P3 | `--font-caption: 11px` — too small for outdoor field use | `_variables.css:124` | Resolved |
| 4 | **P0** | Blocked chip: white on `#d97706` = ~2.7:1 contrast (WCAG AA fail) | `task-row.css:70-88` | Resolved |
| 5 | P1 | Status control: blocked/completed states look interactive but aren't | `task-detail.css:55-127` | Resolved |
| 6 | P3 | Expand button 28px in TaskCard vs 44px in TaskRow; workers badge 24px | `task-card.css:71`, `task-row.css:123`, `timer.css:196` | Resolved |
| 7 | P2 | `btn--secondary` bg is `--color-border` (#e0e0e0) — reads as disabled | `btn.css:44` | Open |
| 8 | P2 | Swipe actions have no first-use affordance hint | `SwipeableRow.tsx` | Open |
| 9 | P3 | Project subsection badge: solid blue pill reads as tappable button | `today-view.css:82-91` | Resolved |
| 10 | P3 | Subtask expand: no height animation (inconsistent with modal slide-ups) | `today-view.css`, `ExpandableSection.tsx` | Resolved |
| 11 | **P0** | `--status-badge-draft-bg: #b45309` not overridden in dark mode | `_variables.css:178`, `_dark.css` | Resolved |
| 12 | P2 | Timer bar always 140px — no compact mode, consumes 21% of SE viewport | `_variables.css:128`, `timer.css:49` | Open |
