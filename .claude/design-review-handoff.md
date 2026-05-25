# Design Review Handoff
**Prepared:** May 2026
**For:** New session picking up schedule view redesign
**Status:** Awaiting calendar mockup from separate design agent

---

## App context

**Field Operations Workspace** — planning and execution tool for exhibition/trade fair assembly and dismantle operations.

Two users:
- **Planner** (desktop-first): creates work packages, builds schedules, exports to field
- **Field Operator** (mobile-first, offline): runs timers, logs time

Tech stack: React 18 + TypeScript + Vite + PWA. IndexedDB, offline-first, no server required.

Full context: `/Users/bemoy/Developer/time-tracking/memory/project_overview.md`

---

## What happened this session

### 1. Sidebar plan list fixes (shipped to production code)

Four issues fixed in `src/styles/components/planning/plan-list.css` and `src/styles/components/planning-workspace.css`:

| # | Fix | Detail |
|---|---|---|
| 1 | Flat list → inset dividers | Removed tray container approach (user rejected). Now: `gap: 0` on compact list, `::after` 1px `--color-border` separator on `.planning-view__row:not(:last-child)`, inset `left: var(--space-md)`. iOS Mail pattern. |
| 2 | Amber contrast | `.planning-view__status-icon--draft/review-ready` background changed from `--color-amber` (#d97706, 2.7:1) to `--color-amber-solid` (#b45309, 4.6:1 WCAG AA) |
| 3 | Title weight | `.planning-view__item-title` font-weight `500` → `600` |
| 4 | Zone gap | `.planning-workspace__sidebar-content .planning-view` gap `8px` → `12px` |

Selected items use `--surface-brand-subtle` (rgba(37,99,235,0.08)) — matches tab-nav and template-picker patterns.

**These are merged, not prototype-only.**

---

### 2. Schedule view redesign (prototype only — no production code written)

#### Problem with the current schedule view

Current layout is configuration-first, canvas-last:
1. 4 KPI card tiles (120px)
2. Stepper card (Plan → Crew → Schedule → Hand off)
3. Collapsed "Schedule Inputs" accordion
4. Collapsed "Work Calendar" accordion
5. Schedule Grid — primary work surface, buried halfway down
6. Empty gray void below the grid

The grid can extend to 100+ rows. Nothing can live below it.

#### Design direction decided

**3-zone layout inside the schedule tab:**

```
┌─────────────────────────────────────────────────────────────┐
│  METRIC STRIP  (36px — replaces KPI tiles)                  │
├──────────────────────┬──────────────────────────────────────┤
│                      │  GRID TOOLBAR (44px, sticky)         │
│  CONFIG PANEL        ├──────────────────────────────────────┤
│  (~220px fixed)      │  SCHEDULE GRID                       │
│                      │  (fills remaining width + height,    │
│  • Schedule Inputs   │   scrolls independently)             │
│    (read display)    │                                      │
│                      │                                      │
│  • Work Calendar     │                                      │
│    (interactive,     │                                      │
│     always visible)  │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

**Schedule Assistant** → right drawer, overlays the grid (`position: absolute` on grid column), does NOT flex/shrink the grid. Critical constraint: grid can span 4+ weeks horizontally — shrinking it on drawer open would be disorienting.

**Metric strip** replaces 4 KPI cards: inline `value label` pairs + inline stepper on the right.
`0 h Scheduled · 71.8 h Unscheduled · 144 h Usable · 0 Over-allocated   ✓ Plan · ✓ Crew · Schedule · Hand off`

**Stepper** (Plan → Crew → Schedule → Hand off) moves into the metric strip, right-aligned. Removes the full-width stepper card.

**Sidebar (plan list)** is collapsible. Toggle button lives in the context bar left of the plan title. Collapse animates to `width: 0`. Freed 288px goes to the grid.

#### Key domain constraints that shaped this

- Schedule Inputs (dates, crew, efficiency) are set *before* scheduling — reference only during scheduling
- **Work Calendar is the only section touched *during* scheduling** (add weekend day, extend shift hours, add crew when over-allocated)
- Grid can extend to 100 rows vertically, 4+ weeks horizontally — it must fill remaining viewport height with nothing below it
- The handoff spec is a starting point, not hard rules — break constraints if the design calls for it

---

### 3. Work Calendar — open design problem

This is the pending item. The config panel currently shows a simplified list:
```
Tue  8:00 – 16:00  6
Wed  8:00 – 16:00  6
Fri  8:00 – 16:00  6
[+ Add day]
```

The original work calendar was a **full interactive calendar grid** with:
- Days clickable to toggle on/off as workdays
- Project build phases highlighted (assembly = green, dismantle = purple)
- Out-of-scope days shown as dashed
- Weekends greyed out (but still clickable to add as workday)
- Crew count and shift time per active day

The list loses all of this spatial and phase context. **A separate design agent is producing a mockup** for how to solve the calendar in the narrower panel. That mockup is pending.

When the mockup arrives, review it against:
1. Does it preserve the toggle-on/off interaction?
2. Are phases (assembly/dismantle) still visually represented?
3. Are weekends accessible without "Add day" workaround?
4. Does it fit in a ~220–240px column without feeling cramped?
5. Does crew count and shift time remain accessible per day?

Be open to breaking the 220px constraint if a wider panel serves the calendar better.

---

## Prototype location

**File:** `/Users/bemoy/Developer/time-tracking/.claude/prototype-schedule-view.html`
**Served via:** Copy to `public/` dir, then `http://localhost:5174/time-tracking/prototype-schedule-view.html`
**Target viewport:** 1440×900

The prototype is a static HTML/CSS/minimal-JS file. It is NOT production code. All design tokens are defined as CSS custom properties in a `:root` block at the top of the `<style>` tag.

**What the prototype covers:**
- Full workspace shell (collapsible sidebar + main card)
- Context bar, pill tab strip, metric strip with inline stepper
- Config panel: Schedule Inputs (label/value) + simplified Work Calendar (list — pending redesign)
- Grid toolbar: Auto-schedule button, issue/warning chips, Schedule Assistant toggle
- Schedule grid: sticky header, phase group rows, work package rows, empty dashed cells
- Schedule Assistant drawer: absolute overlay (not flex), slides over grid right edge, two mock issue cards

**What it does NOT cover:**
- Work Calendar redesign (pending mockup)
- Edit tab, Progress tab
- Dark mode
- Any real data or interactions beyond sidebar toggle + assistant drawer toggle

---

## Open items from the design audit

Two findings from the earlier review not yet acted on:

**#5 — Schedule Assistant button badge**
"Schedule Assistant 1" — the `1` count reads as part of the button label rather than a distinct count badge. The toolbar chip style (`1 issue`, `1 warning`) is a better pattern. Consider a pill count badge offset from the button label.

**#6 — Grid card visual terminus**
At short viewport heights the grid card has no bottom edge — it just stops. Low priority since with real data (20+ rows) the grid fills height naturally.

These were deferred pending the calendar work. Can be addressed after the calendar is settled.

---

## Design system reference

All tokens are in `src/styles/_variables.css`. Dark mode overrides in `src/styles/_dark.css`.

Key tokens for the schedule view work:
```
--surface-base-bg:           #e8eaf0   (page bg)
--surface-contained-bg:      #ffffff   (cards, panels)
--surface-contained-inset:   #f3f3f7   (recessed areas, toolbar bg)
--surface-contained-border:  #e0e0e0   (dividers)
--surface-brand-subtle:      rgba(37,99,235,0.08)   (selected state)
--phase-assembly-fg:         #059669   (green)
--phase-dismantle-fg:        #7c3aed   (purple)
--color-amber-solid:         #b45309   (WCAG AA amber, 4.6:1 on white)
--radius-2xl:                26px      (card corners)
--shadow-md:                 0 6px 24px rgba(0,0,0,0.08)...
--ease-enter:                cubic-bezier(0.22, 1, 0.36, 1)
```

Full design audit (tokens, component states, resolved findings):
`/Users/bemoy/Developer/time-tracking/.claude/design-audit.md`

Full schedule view redesign handoff spec (layout, component specs, prototype scope):
`/Users/bemoy/Developer/time-tracking/.claude/handoff-schedule-view-redesign.md`
