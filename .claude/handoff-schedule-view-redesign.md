# Handoff — Schedule View Redesign
**For:** Claude Design prototype (static HTML/CSS — no production code)
**Status:** Ready to prototype
**Date:** May 2026

---

## 1. Context

The schedule view lives inside the Planning Workspace — a desktop-first, two-pane layout:
- **Left sidebar** (288px): plan list, always visible
- **Main content card**: tab-navigated, currently showing Edit / Schedule / Progress tabs

This handoff covers a structural redesign of the **Schedule tab only**. The sidebar, context bar, and tab strip are unchanged.

### Why it's being redesigned

Current layout is configuration-first, canvas-last:
1. KPI card row (4 large tiles)
2. Stepper card (Plan → Crew → Schedule → Hand off)
3. Collapsed "Schedule Inputs" accordion
4. Collapsed "Work Calendar" accordion
5. Schedule Grid (the primary work surface) — buried halfway down
6. Empty gray void below the grid

Problems: the grid (where all scheduling work happens) is the last thing the planner sees. The KPI tiles consume 120px+ of prime vertical space. The stepper occupies a full-width card. The work calendar — the only section touched *during* scheduling — is hidden behind a collapse. The Schedule Assistant has no permanent home. Nothing below the grid can exist because it can extend to 100+ rows.

---

## 2. Design token reference

Prototype must use CSS custom properties matching the existing system. Do not hardcode any colour, spacing, radius, or shadow values.

### Colours
```
--surface-base-bg:          #e8eaf0   page / canvas background
--surface-contained-bg:     #ffffff   cards, panels, rows
--surface-contained-inset:  #f3f3f7   recessed surfaces
--surface-contained-hover:  #d4d6e0   hover state
--surface-contained-border: #e0e0e8   borders, dividers
--surface-brand-subtle:     rgba(37,99,235,0.08)   selected / active tint

--color-text:               #13131a
--color-text-muted:         #65657a
--color-primary:            #2563eb
--color-border:             #e0e0e0

--state-danger-fg:          #dc2626
--state-danger-bg:          #fef2f2
--state-warning-fg:         #d97706
--state-warning-bg-soft:    (amber-tinted bg)
--state-success-fg:         #16a34a
--state-info-fg:            #2563eb
--state-info-bg:            (blue-tinted bg)

--phase-assembly-fg:        green-ish (currently used in grid phase headers)
--phase-dismantle-fg:       purple-ish (currently used in grid phase headers)
```

### Spacing
```
--space-xs:  4px
--space-sm:  8px
--space-md:  16px
--space-lg:  24px
--space-xl:  32px
```

### Typography
```
--font-large:   1.5rem   (24px)
--font-heading: 1.1875rem (19px)
--font-body:    1rem     (16px)
--font-small:   0.8125rem (13px)
--font-caption: 0.75rem  (12px)

Font family: 'Outfit', system-ui
Mono: 'DM Mono', ui-monospace (for dates and numbers)
```

### Radius
```
--radius-sm:   4px
--radius-md:   8px
--radius-lg:   14px
--radius-xl:   20px
--radius-2xl:  26px
--radius-full: 9999px
```

### Shadows
```
--shadow-xs: 0 1px 3px rgba(0,0,0,0.05)
--shadow-sm: 0 2px 12px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)
--shadow-md: 0 6px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)
```

---

## 3. Overall layout structure

The redesigned schedule tab is a **3-zone layout** inside the main content card:

```
┌─────────────────────────────────────────────────────────────────┐
│  METRIC STRIP  (full width, ~36px tall)                         │  Zone A
├──────────────────────┬──────────────────────────────────────────┤
│                      │  GRID TOOLBAR  (sticky, ~44px)           │
│  CONFIG PANEL        ├──────────────────────────────────────────┤  Zone B
│  (~220px fixed)      │  SCHEDULE GRID                           │
│                      │  (fills remaining width + height,        │
│                      │   scrolls independently)                  │
│                      │                                          │
│                      │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

- **Zone A** — Metric strip: single horizontal row, `height: 36px`, `flex-shrink: 0`
- **Zone B** — Two-column split:
  - Left: Config panel, `width: 220px`, `flex-shrink: 0`, `overflow-y: auto`
  - Right: Grid column, `flex: 1`, `min-width: 0`, `display: flex; flex-direction: column`
    - Grid toolbar: `height: 44px`, `flex-shrink: 0`
    - Schedule grid: `flex: 1`, `overflow: auto`

The entire schedule tab content area is `display: flex; flex-direction: column; height: 100%` — it must fill the main card's remaining height (below the context bar and tab strip) with no overflow.

### Approximate pixel budget at 1440px viewport

| Layer | Width |
|---|---|
| Outer workspace padding | 12px × 2 |
| Plan list sidebar | 288px |
| Gap | 10px |
| Main content card | ~1106px |
| Config panel (within main) | 220px |
| Divider | 1px |
| Grid column | ~885px |

---

## 4. Zone A — Metric strip

### Purpose
Replaces the four KPI tile cards. Communicates schedule health at a glance without consuming vertical space.

### Dimensions
- Full width of the tab content area
- Height: `36px` (single line)
- Background: `--surface-contained-bg` (same as card)
- Border-bottom: `1px solid --surface-contained-border`
- Padding: `0 var(--space-md)`

### Layout
Horizontal flex row, `align-items: center`, `gap: var(--space-lg)`.

### Metrics to show (left to right)

| Metric | Label | Value | Colour rule |
|---|---|---|---|
| Scheduled hours | "Scheduled" | `0 h` | `--color-text-muted` when 0, `--color-text` when > 0 |
| Unscheduled hours | "Unscheduled" | `71.8 h` | `--state-warning-fg` when > 0, `--color-text-muted` when 0 |
| Usable hours | "Usable" | `144 h` | always `--color-text-muted` (reference info) |
| Over-allocated days | "Over-allocated" | `0` | `--state-danger-fg` when > 0, `--color-text-muted` when 0 |

### Each metric
```
[value]  [label]
```
- Value: `font-family: 'DM Mono'`, `font-size: --font-small` (13px), `font-weight: 600`
- Label: `font-size: --font-caption` (12px), `color: --color-text-muted`
- The two sit on the same baseline, separated by `4px`

### Right side of strip
A subtle `·` separator + the schedule progress state inline:

```
Plan ✓ · Crew ✓ · Schedule · Hand off
```
- Completed steps: checkmark icon (12×12) + label, `--state-success-fg` color
- Current step: label only, `--color-primary`, `font-weight: 600`
- Future steps: label only, `--color-text-muted`
- Separator: `·` in `--color-text-muted`
- This replaces the stepper card entirely

Mock state for prototype: Plan ✓, Crew ✓, Schedule (current), Hand off (future)

---

## 5. Zone B left — Config panel

### Purpose
Permanent home for Schedule Inputs (read display) and Work Calendar (interactive). Always visible so the planner can adjust without expanding anything.

### Dimensions
- `width: 220px`, `flex-shrink: 0`
- `height: 100%` (fills Zone B height)
- `overflow-y: auto`
- Border-right: `1px solid --surface-contained-border`
- Background: `--surface-contained-bg`
- Padding: `var(--space-md)`
- Internal `display: flex; flex-direction: column; gap: var(--space-lg)`

---

### 5a. Schedule Inputs block

**Position:** Top of config panel

**Purpose:** Reference display. Planner set these before scheduling. Rarely touched during scheduling. Shows dates, crew size, efficiency, and work hours.

**Visual treatment:**
- Section label: `font-size: --font-caption`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.07em`, `color: --color-text-muted`. Text: "SCHEDULE INPUTS"
- Below the label: stacked label/value pairs

**Label/value pair format:**
```
LABEL
value
```
- Label: `--font-caption`, `--color-text-muted`, uppercase, `letter-spacing: 0.05em`
- Value: `--font-small`, `--color-text`, `font-weight: 500`
- Gap between label and value: `2px`
- Gap between pairs: `var(--space-sm)` (8px)

**Mock data to display:**

| Label | Value |
|---|---|
| DATES | May 26 – May 31 |
| DURATION | 5 days |
| DEFAULT CREW | 6 workers |
| EFFICIENCY | Full pace — 100% |
| EVENT | May 28 – May 28 |

**Edit affordance:**
A small pencil icon button (`16×16px`, `--color-text-muted`, `border-radius: --radius-sm`) sits inline at the top-right of the section label row. Non-functional in prototype — just render it.

---

### 5b. Work Calendar block

**Position:** Below Schedule Inputs, separated by `--space-lg`

**Purpose:** The primary interaction target during scheduling. Planner adjusts this when they can't fit all work into the existing schedule — extending shift hours, adding a weekend day, or increasing crew on a specific day.

**Visual treatment:**
- Section label: same style as above. Text: "WORK CALENDAR"
- Below: a list of work day rows

**Work day row:**
Each row represents one active work day. Full width of the panel.

```
[day abbrev]  [time range]     [crew count]
Tue           8:00 – 16:00     6
```

Layout: horizontal flex, `align-items: center`, `height: 36px`, `padding: 0 var(--space-xs)`
- Day: `font-size: --font-small`, `font-weight: 600`, `width: 32px`, `--color-text`
- Time range: `font-family: 'DM Mono'`, `font-size: --font-caption`, `--color-text-muted`, `flex: 1`
- Crew count: `font-size: --font-small`, `font-weight: 600`, `--color-text`, `width: 24px`, `text-align: right`

Between rows: `1px solid --surface-contained-border` divider (inset 0 left, 0 right — full width within the block)

**Hover state:** `background: --surface-contained-hover`, `border-radius: --radius-sm`, `cursor: pointer`

**Mock data:**

| Day | Time | Crew |
|---|---|---|
| Tue | 8:00 – 16:00 | 6 |
| Wed | 8:00 – 16:00 | 6 |
| Fri | 8:00 – 16:00 | 6 |

**"Add day" affordance:**
Below the last row, a dashed-border button: `+ Add day`. 
- `height: 32px`, `border: 1.5px dashed --color-border`, `border-radius: --radius-md`
- `font-size: --font-caption`, `color: --color-text-muted`
- Full width within the block
- `cursor: pointer`, hover: `border-color: --color-primary`, `color: --color-primary`
- Non-functional in prototype

---

## 6. Zone B right — Grid column

### 6a. Grid toolbar

**Dimensions:** Full width of grid column, `height: 44px`, `flex-shrink: 0`
**Background:** `--surface-contained-inset`
**Border-bottom:** `1px solid --surface-contained-border`
**Padding:** `0 var(--space-md)`
**Layout:** flex row, `align-items: center`, `gap: var(--space-sm)`

**Left side — "Auto-schedule" button:**
- Label: "Auto-schedule (2)"
- Style: `btn btn--primary` (blue pill, `height: 32px`, `padding: 0 var(--space-md)`, `border-radius: --radius-full`, `font-size: --font-small`, `font-weight: 600`)
- The "(2)" indicates how many work packages will be auto-scheduled
- Non-functional in prototype

**Right side (pushed with `margin-left: auto`):**
- `1 issue` chip: `background: --state-danger-bg`, `color: --state-danger-fg`, `font-size: --font-caption`, `font-weight: 600`, `padding: 2px 8px`, `border-radius: --radius-full`
- `1 warning` chip: `background: --state-warning-bg-soft`, `color: --state-warning-fg`, same sizing
- Gap between chips: `var(--space-xs)`
- `Schedule Assistant` button: `background: --surface-contained-bg`, `border: 1.5px solid --surface-contained-border`, `color: --color-text`, `font-size: --font-small`, `font-weight: 500`, `height: 32px`, `padding: 0 var(--space-sm)`, `border-radius: --radius-full`. When Schedule Assistant drawer is open: `background: --surface-brand-subtle`, `border-color: --color-primary`, `color: --color-primary`

---

### 6b. Schedule grid

**Dimensions:** `flex: 1`, `overflow: auto` (scrolls both axes), `min-height: 0`

This is a mock — render a static but realistic-looking grid. Do not implement any logic.

**Grid structure:**

```
┌─────────────────────┬────────────┬────────────┬────────────┐
│ WORK PACKAGE        │ Tue, May 26│ Wed, May 27│ Fri, May 29│  ← sticky header row
├─────────────────────┼────────────┼────────────┼────────────┤
│ ▾ ASSEMBLY (1)      │            │            │            │  ← phase group header
├─────────────────────┼────────────┼────────────┼────────────┤
│  Tepper             │  [cell]    │  [cell]    │  [cell]    │  ← work package row
│  TeppeFl · m²       │            │            │            │
│  2345 m² · 42.6h    │            │            │            │
├─────────────────────┼────────────┼────────────┼────────────┤
│ ▾ DISMANTLE (1)     │            │            │            │  ← phase group header
├─────────────────────┼────────────┼────────────┼────────────┤
│  Tepper             │  [cell]    │  [cell]    │  [cell]    │
│  TeppeFl · m²       │            │            │            │
│  2345 m² · 29.2h    │            │            │            │
└─────────────────────┴────────────┴────────────┴────────────┘
```

**Column widths:**
- Work package column: `240px`, `flex-shrink: 0` (sticky left, does not scroll horizontally)
- Day columns: `100px` each, `flex-shrink: 0`

**Header row:**
- `height: 40px`, `background: --surface-contained-bg`, `position: sticky; top: 0; z-index: 10`
- "WORK PACKAGE" cell: `font-size: --font-caption`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.07em`, `color: --color-text-muted`, `padding: 0 var(--space-md)`
- Date cells: `font-size: --font-caption`, `font-weight: 600`, `--color-text`, monospace, `text-align: center`
  - Format: "Tue, May 26" on two lines (day abbrev on top, "May 26" below)
  - Border-bottom: `2px solid --surface-contained-border`

**Phase group header rows:**
- `height: 32px`, `background: --surface-contained-inset`
- Assembly: tinted green left border (3px), `color: --phase-assembly-fg`
- Dismantle: tinted purple left border (3px), `color: --phase-dismantle-fg`
- Label: "▾ ASSEMBLY (1)" — `font-size: --font-caption`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.05em`
- Padding: `0 var(--space-md)`

**Work package rows:**
- `height: 72px` (three lines of info)
- Left column content (stacked):
  - Line 1: Plan name — `font-size: --font-small`, `font-weight: 600`, `--color-text`
  - Line 2: Tag + unit — e.g. `[TeppeFl] · m²` — tag is a pill chip: `background: rgba(37,99,235,0.1)`, `color: --color-primary`, `font-size: --font-caption`, `border-radius: --radius-full`, `padding: 0 6px`
  - Line 3: Qty + estimated hours — `font-size: --font-caption`, `--color-text-muted`
  - Left padding: `var(--space-md)` + 8px indent (subtask visual depth)
- Day cells: `background: --surface-contained-inset` (empty = unscheduled), `border: 1px dashed --color-border`, shows a faint "+" on hover
- Row divider: `1px solid --surface-contained-border` at the bottom of each row

**Row separators between group sections:**
- `8px` of `--surface-contained-inset` between the last row of one phase group and the next phase header

---

## 7. Schedule Assistant drawer

### Trigger
"Schedule Assistant" button in the grid toolbar (see 6a). Click toggles the drawer open/closed.

### Behaviour
- Slides in from the right edge of the **grid column only** (not over the config panel)
- Width: `300px`
- The grid column shrinks: grid gets `flex: 1`, drawer is `width: 300px; flex-shrink: 0` — they share the grid column space side by side
- Transition: `width 0.25s --ease-enter` (or slide-in transform)
- Does not overlay anything — it displaces the grid horizontally

### Dimensions
- Full height of Zone B right column
- `border-left: 1px solid --surface-contained-border`
- Background: `--surface-contained-bg`
- Padding: `var(--space-md)`
- `display: flex; flex-direction: column; gap: var(--space-md)`

### Header
```
[✦ sparkle icon]  Schedule Assistant          [✕ close]
```
- Label: `font-size: --font-body`, `font-weight: 600`
- Sparkle icon: 16×16px, `--color-primary`
- Close button: `×`, `--color-text-muted`

### Content — Issue cards

Render 2–3 mock issue cards. Each card:
- `background: --surface-contained-inset`
- `border-radius: --radius-lg`
- `padding: var(--space-sm)`
- `border-left: 3px solid [severity colour]`

**Severity colours:**
- Warning: `--state-warning-fg`
- Info: `--state-info-fg`

**Card anatomy:**
```
[severity pill]  Issue title
Short description of the problem.
Impact: X person-hours affected
[Suggested action button]
```
- Severity pill: `font-size: --font-caption`, `font-weight: 700`, uppercase, same tinted bg/fg as the toolbar chip
- Title: `--font-small`, `font-weight: 600`, `--color-text`
- Description: `--font-caption`, `--color-text`
- Impact: `--font-caption`, `--color-text-muted`
- Suggested action: `btn btn--secondary`, `font-size: --font-caption`, `height: 28px`

**Mock issue data:**

Issue 1 (warning):
- Title: "Tepper is unscheduled"
- Description: "2345 m² of carpet laying has no hours allocated on any work day."
- Impact: "42.6 person-hours unplaced"
- Action button: "Auto-schedule"

Issue 2 (info):
- Title: "Wed May 27 is under-utilised"
- Description: "Only 12h of 96h usable capacity is currently allocated."
- Impact: "84h available"
- Action button: "View day"

---

## 8. What to prototype

Build a **static HTML + CSS file** — no React, no build tooling, no JavaScript beyond toggling the Schedule Assistant drawer open/closed.

### Must build
- [ ] Full planning workspace shell: sidebar (plan list) + main content card, matching existing proportions
- [ ] Context bar (Project 2 · DRAFT badge · phase dates)
- [ ] Tab strip (Edit · Schedule · Progress), Schedule tab active
- [ ] Zone A: metric strip with mock values and inline stepper
- [ ] Zone B left: config panel with Schedule Inputs block + Work Calendar block
- [ ] Zone B right: grid toolbar + schedule grid (static, 2 phase groups, 1 row each)
- [ ] Schedule Assistant drawer: toggle via JS click, side-by-side layout (not overlay)
- [ ] Hover states on work calendar rows and grid cells

### Mock only (no interaction needed)
- Auto-schedule button (render, no click handler)
- Edit pencil on Schedule Inputs (render, no click handler)
- Add day button (render, no click handler)
- Grid cell scheduling (render dashed cells, no drag/drop)
- Issue/warning chips (render, no click handler)

### Do not build
- The Edit tab content
- The Progress tab content
- The plan list sidebar interaction (just render "Project 2" selected + "Test" unselected)
- Dark mode

---

## 9. Prototype file location

Save as: `.claude/prototype-schedule-view.html`

Self-contained single file. Embed all CSS in a `<style>` block. Use Google Fonts CDN for Outfit and DM Mono:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Target viewport: 1440×900. The prototype should look correct at this size without responsive behaviour.

---

## 10. Visual reference — current vs target

### Current (what exists today)

```
[context bar]
[tabs]
[tab content — inset bg] ─────────────────────────────
  [KPI card row — 4 tiles, 120px tall]
  [Stepper card — full width, 80px]
  [▸ SCHEDULE INPUTS — collapsed accordion card]
  [▸ WORK CALENDAR — collapsed accordion card]
  [SCHEDULE GRID card — 200px visible, then scroll]
  [~~~~~~~~~~~ empty gray void ~~~~~~~~~~~~~~~~~~~]
```

### Target (what to prototype)

```
[context bar]
[tabs]
[tab content — flex column, fills height] ────────────
  [metric strip — 36px — inline numbers + stepper]
  ┌──────────────┬──────────────────────────────────┐
  │ SCHEDULE     │ [Auto-schedule (2)]  [1 issue]    │
  │ INPUTS       │ [1 warn]  [Schedule Assistant ▸]  │
  │              ├──────────────────────────────────┤
  │ May 26–31    │ WORK PACKAGE  │ Tue 26 │ Wed 27   │
  │ 5d · 6 crew  │ ─────────────┼────────┼──────────│
  │              │ ▾ ASSEMBLY   │        │          │
  │ WORK         │   Tepper     │ [cell] │ [cell]   │
  │ CALENDAR     │ ─────────────┼────────┼──────────│
  │ Tue 8–16 ×6  │ ▾ DISMANTLE  │        │          │
  │ Wed 8–16 ×6  │   Tepper     │ [cell] │ [cell]   │
  │ Fri 8–16 ×6  │              │        │          │
  │              │  (scrolls)   │        │          │
  │ [+ Add day]  │              │        │          │
  └──────────────┴──────────────────────────────────┘
```

When Schedule Assistant is open:

```
  ┌──────────────┬──────────────────────┬───────────┐
  │              │ grid (narrower)      │ ASSISTANT │
  │ config panel │                      │ ───────── │
  │              │                      │ [issue 1] │
  │              │                      │ [issue 2] │
  └──────────────┴──────────────────────┴───────────┘
```

---

## 11. Open questions for review (not blocking prototype)

1. **Config panel width** — 220px is estimated. If the Work Calendar time inputs feel cramped at 220px, prototype should try 240px and note which feels better.
2. **Metric strip stepper placement** — could also move to the context bar (right-aligned, replacing phase dots). Worth testing both in prototype if time allows.
3. **Schedule Assistant drawer width** — 300px is estimated. If issue cards feel cramped, try 320px.
4. **Work Calendar editing** — during scheduling, clicking a time or crew value triggers an inline input. Prototype does not need to implement this but rows should have a clear hover state that implies editability.
