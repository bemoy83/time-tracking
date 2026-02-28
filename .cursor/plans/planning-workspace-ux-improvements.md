# Planning Workspace — UX & UI Improvement Proposal

**Context:** App usage from [BRIEF.md](../../BRIEF.md); recent work from [strategy-roadmap.md](./strategy-roadmap.md).  
**Scope:** Restructuring and optimizing the planning workspace. Functionality is built; UX/UI has room for improvement.

---

## Executive Summary

The planning workspace (two-pane layout, sidebar + main pane) is implemented per `feature-planning-workspace.md`, but several spec-aligned behaviors and UX refinements are missing or under-polished. This document proposes targeted improvements with rationale and visualized layouts.

**Schedule View** is the most UX-deficient surface. A dedicated section proposes event-planner-centric refinements: feasibility-first layout, event-relative day labels, over-allocation visibility in the grid, inline amendment flow (replacing `window.prompt`), and an actionable unscheduled list.

---

## Improvement 1: Add a Dedicated Review Tab

**Current:** Wrap-up is reachable only via a "Wrap Up" button on plan items in the sidebar or in the Progress view header. There is no Review tab in the main pane.

**Proposed:** Add a "Review" tab to the tab strip when a plan is active, has linked tasks, and is review-ready (wrap-up available). The tab either surfaces a Review panel inline or clearly launches the wrap-up sheet with context.

**Why:**
- **Discoverability:** Review is a core planner flow. Hiding it behind a small button on list items or in another tab makes it easy to miss.
- **Spec alignment:** `feature-planning-workspace.md` explicitly lists "Edit · Progress · Schedule · Review" as available tabs when wrap-up is available.
- **Consistency:** Edit, Progress, Schedule, Report are all tabs. Review should be treated as a first-class tab.

---

## Improvement 2: Relocate Insights to Sidebar Footer

**Current:** Insights is placed in the sidebar header next to "New Plan" as a secondary button. Both buttons share similar visual weight.

**Proposed:** Move Insights to a persistent footer area at the bottom of the sidebar, separated from the plan list by a visual divider. Style it as a distinct, secondary nav entry.

**Why:**
- **Spec alignment:** The spec states "Below both zones, a persistent Insights entry — plan-agnostic, always accessible from the sidebar footer."
- **Visual hierarchy:** Create is the primary action; plans are the main navigation; Insights is secondary (estimation calibration across all reviewed plans). Footer placement reinforces this.
- **Scannability:** When the plan list grows, Insights remains reachable without scrolling past many plans.

---

## Improvement 3: Collapsible Archive Zone

**Current:** Archive zone is always expanded.

**Proposed:** Archive zone is collapsed by default. A chevron or toggle expands/collapses it. State persists for the session.

**Why:**
- **Spec alignment:** "Collapsed by default; expandable."
- **Focus:** Planner typically works with active plans; archive is reference-only. Collapsing reduces noise and cognitive load.
- **Scalability:** As reviewed plans accumulate, the sidebar stays manageable.

---

## Improvement 4: Collapsible Sidebar

**Current:** Sidebar has a fixed width; no way to collapse it.

**Proposed:** Add a toggle at the sidebar's right edge (or in the header) to collapse the sidebar to a narrow strip (icons only) or hide it entirely. State persists across the session. Main pane expands to use freed space.

**Why:**
- **Spec alignment:** "The sidebar can be collapsed to give the main pane more space."
- **Context:** When editing a plan with many line items or viewing a dense schedule grid, horizontal space is valuable.
- **Tablet:** On smaller tablets, extra main-pane space improves readability.

---

## Improvement 5: Improve Empty State for "No Plan Selected"

**Current:** Plain text: "Select a plan from the sidebar to begin editing."

**Proposed:** A friendly empty state with:
- A subtle illustration or icon (e.g., clipboard/list)
- Short guidance: "Select a plan to edit, or create a new one."
- If no plans exist: "Create your first plan to get started" with a prominent CTA

**Why:**
- **Onboarding:** New users need clear next steps.
- **Tone:** Matches the spec's emphasis on "empty-state messaging" and professional polish.

---

## Improvement 6: Differentiate "New Plan" Visually

**Current:** New Plan and Insights (before relocation) share similar button styling. New Plan has primary color border but competes with Insights.

**Proposed:** Make "New Plan" the clear primary action:
- Slightly larger tap target and font weight
- Solid primary fill or stronger primary accent
- Insights, after moving to footer, is styled as a lower-emphasis nav link

**Why:**
- **Spec:** "A persistent create action lives in the sidebar header. Always visible, never buried."
- **Primary action:** Create is the most common entry point for new work. Visual hierarchy should reflect that.

---

## Improvement 7: Improve Exit Control Labeling

**Current:** "Exit" with chevron-left icon.

**Proposed:** Use "All Plans" or "Back to plans" with chevron. Optionally add a home icon for familiarity.

**Why:**
- **Clarity:** "Exit" is vague; "All Plans" or "Back to plans" describes the destination.
- **Spec:** Spec suggests "← All Plans" or home icon.

---

## Improvement 8: Insights Active State in Sidebar

**Current:** When Insights is the active view (main pane shows InsightsView), no plan is selected. There is no visual indication that Insights is active in the sidebar.

**Proposed:** When `activeTab === 'insights'`, highlight the Insights footer entry (e.g., background, border, or icon state) to indicate it is the current view.

**Why:**
- **Spatial consistency:** The sidebar is the nav backbone. The active view should always be visibly indicated there.

---

## Improvement 9: Tab Strip Overflow Handling

**Current:** Tabs (Edit, Schedule, Progress, Compare, Report, Review) are inline. On narrow tablets, they could wrap or overflow awkwardly.

**Proposed:** Ensure horizontal scroll with `overflow-x: auto` and `overflow-y: hidden` on the tab strip. Optional: fade indicator at the right edge when more tabs exist off-screen. Or use a compact tab design (e.g., shorter labels or icons) at smaller breakpoints.

**Why:**
- **Responsiveness:** Spec requires the workspace to adapt to tablet and desktop. Tabs must remain usable on all supported widths.

---

## Improvement 10: Compare Mode Sidebar Behavior

**Current:** Compare mode is triggered from Edit; sidebar does not shift into "comparison selection" mode. Plan B selection is not surfaced in the sidebar.

**Proposed:** When in compare mode:
- Plan A (current plan) is highlighted with an "A" badge
- Hovering other plans shows "Compare as B" affordance
- Clicking a plan assigns it as Plan B
- "Exit comparison" control returns to prior tab

**Why:**
- **Spec alignment:** Spec describes this exact sidebar behavior for comparison.
- **Ergonomics:** Selecting Plan B from the sidebar is more natural than navigating to a separate compare screen and selecting there.

---

## Visual Layout — Current vs Proposed

### Current Layout (Simplified)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Exit                                                                  │
├────────────────────┬─────────────────────────────────────────────────────┤
│  [New Plan] [Insights]                                                    │
│  ───────────────   │  [Edit] [Schedule] [Progress] [Compare] [Report]     │
│  Active            │                                                      │
│  • Plan A     [Wrap Up]                                                   │
│  • Plan B     [Wrap Up]                                                   │
│  Archive           │           Main Pane                                 │
│  • Plan C          │     (PlanEditor / ProgressView / etc.)               │
│  • Plan D          │                                                      │
│                    │                                                      │
└────────────────────┴─────────────────────────────────────────────────────┘
```

### Proposed Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← All Plans                                                    [≡]      │  ← Exit + collapse toggle
├────────────────────┬─────────────────────────────────────────────────────┤
│  [+ New Plan]      │  [Edit] [Schedule] [Progress] [Review] [Compare] [Report]  ← Review tab added
│  ───────────────   │                                                      │
│  Active            │                                                      │
│  • Plan A  ●       │           Main Pane                                  │
│  • Plan B  ●       │     (contextual content)                              │
│  ───────────────   │                                                      │
│  ▼ Archive         │                                                      │
│    • Plan C        │                                                      │
│    • Plan D        │                                                      │
│  ───────────────   │                                                      │
│  Insights    ✦     │                                                      │  ← Footer, highlighted when active
└────────────────────┴─────────────────────────────────────────────────────┘

Legend: ● = status badge   ▼ = collapsed/expandable   ✦ = active state
```

### Proposed Layout — Collapsed Sidebar

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [≡]  ← All Plans                                                         │
├────┬─────────────────────────────────────────────────────────────────────┤
│ +  │  [Edit] [Schedule] [Progress] [Review] [Compare] [Report]            │
│ ─  │                                                                      │
│ ●  │                                                                      │
│ ●  │           Main Pane — Expanded                                       │
│ ▼  │           More horizontal space for line items, schedule grid         │
│ ✦  │                                                                      │
└────┴─────────────────────────────────────────────────────────────────────┘
     ↑ Narrow icon strip when collapsed
```

---

## Priority Order (Recommended)

| # | Improvement | Effort | Impact | Dependency |
|---|-------------|--------|--------|------------|
| 1 | Relocate Insights to sidebar footer | Low | Medium | — |
| 2 | Differentiate New Plan visually | Low | Medium | — |
| 3 | Improve exit control labeling | Trivial | Low | — |
| 4 | Insights active state | Low | Low | #1 |
| 5 | Add Review tab | Medium | High | — |
| 6 | Collapsible Archive zone | Medium | Medium | — |
| 7 | Improve empty state | Low | Medium | — |
| 8 | Tab strip overflow | Low | Medium | — |
| 9 | Collapsible sidebar | Medium | High | — |
| 10 | Compare mode sidebar behavior | Medium | Medium | — |

---

## Schedule View & Grid — Worst Offenders

ScheduleView and ScheduleGrid are the most UX/UI-deficient surfaces in the planning module. Below are the specific issues and proposed fixes.

---

### ScheduleView.tsx — Issues

| Issue | Location | Why It's a Problem |
|-------|----------|-------------------|
| **`window.prompt()` for amendment note** | Line 63 | Native `prompt()` is a modal blocker. It looks dated, provides no context, blocks the flow, and cannot be styled or extended. Unacceptable in a production UI. |
| **Vertical stacking** | Overall layout | Event Inputs → Work Calendar → Schedule Grid → Capacity Summary stack vertically. The scheduling spec emphasizes horizontal space. On desktop/tablet, inputs and calendar could share a row to free vertical space for the grid. |
| **No at-a-glance structure** | — | The capacity summary is buried at the bottom. Key feasibility signals (headroom, over-allocated days) should be visible near the grid or in a compact summary bar. |

---

### ScheduleGrid.tsx — Issues

| Issue | Location | Why It's a Problem |
|-------|----------|-------------------|
| **Line-item column scrolls away** | Grid layout | When the grid scrolls horizontally (many event days), the "Work package" column scrolls with it. The planner loses row context. The first column must be **sticky** so it stays visible. |
| **● (bullet) for assigned state** | Line 71 | A single Unicode bullet is minimal and low-affordance. No hover hint, no clear checkbox metaphor. Looks unfinished. |
| **Cell affordance** | Cells | Clickable cells don't read as interactive. Assigned vs empty needs clearer visual distinction (e.g., checkmark icon, filled square vs outline). |
| **Utilization footer readability** | Lines 84–95 | `12.5 / 32.0h (39%)` is dense. Over-allocated uses red but the format is identical. Could use progress-bar styling or clearer hierarchy. |
| **Unscheduled list is dead-end** | Lines 100–112 | Flat list of titles. No link to edit the item, no hours, no quick "assign" action. Feels like a dump rather than actionable. |
| **Grid column alignment risk** | CSS | `repeat(auto-fit, minmax(88px, 1fr))` with a variable number of day columns can produce inconsistent widths. Day columns should use `repeat(N, minmax(72px, 1fr))` with explicit count for predictable alignment. |
| **No hover/focus feedback** | Cells | Cells have minimal feedback. Hover should show "Click to assign/unassign" or similar. Focus ring for keyboard users. |

---

### WorkCalendarEditor — Related Issues

| Issue | Location | Why It's a Problem |
|-------|----------|-------------------|
| **Fixed grid breaks on narrow screens** | `schedule-calendar__row` | `grid-template-columns: 140px 110px 110px 110px 120px` — at 780px it collapses to `1fr` (vertical stack). Field order and labels may become unclear. |
| **Crew override label** | Line 67 | Placeholder "default" is vague. Should explicitly say "Crew (override)" or similar when plan-level default exists. |

---

### Schedule View — Event Planner UX

The schedule surface serves the **event planner** (Bjørn): designs work, allocates resources, estimates capacity. The layout should optimize for their mental model: *"Does this fit? Where do I put each package? Which days are overloaded?"*

| # | Improvement | Why for Event Planner |
|---|-------------|------------------------|
| **E1** | **Feasibility bar (sticky, top)** | The planner's primary question is "does it fit?" Put headroom, over-allocated count, and totals in a persistent top bar — never buried below the grid. |
| **E2** | **Event-relative day labels (Day 1, 2, 3)** | Planners think in "Day 1 of build" not just "Mon 3 Mar." Show both: `Day 1 \| Mon 3 Mar`. Supports communication with foremen ("we're behind on Day 2"). |
| **E3** | **Over-allocation visible in grid** | Over-allocated days should be obvious in the grid: red tint or border on the column, badge in the day header (e.g. "125%"). Don't rely on footer only. |
| **E4** | **Inline amendment flow** | Replace `window.prompt` with a small popover near the edited cell: what changed, optional reason field. Non-blocking, in-context. |
| **E5** | **Unscheduled as assignable** | Unscheduled list should be actionable: show hours per item, "Assign to Day 1 / Day 2" buttons or date picker, or drag onto grid. Optional "Suggest schedule" to spread evenly. |
| **E6** | **Compact event context bar** | One-line summary at top: "Event: 3–5 Mar · 3 days · 5 crew · 120h available" with [Edit] link. Orient the planner at a glance. |
| **E7** | **Group by build phase** | Planners think in build-up vs tear-down. Group rows by phase (collapsible sections or visual bands) to reduce cognitive load when scanning. |
| **E8** | **Drag-and-drop assignment** | Clicking every cell is tedious. Allow drag row onto day column, or drag from Unscheduled into grid. Optional "Spread evenly" for quick baseline. |
| **E9** | **Keyboard navigation** | Arrow keys between cells, Enter to toggle. Power users on desktop will move faster. |
| **E10** | **Print / export schedule** | Planners hand off to foremen. "Print schedule" or "Export PDF" from the Schedule tab supports field use. |

---

### Proposed Schedule Improvements (Priority)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| **S1** | Replace `window.prompt` with inline amendment popover (E4) | Medium | High |
| **S2** | Make ScheduleGrid first column (Work package) sticky on horizontal scroll | Low | High |
| **S3** | Feasibility bar: sticky top with headroom, over-allocated, totals (E1) | Medium | High |
| **S4** | Event-relative day labels: Day 1 / Mon 3 Mar (E2) | Low | High |
| **S5** | Over-allocation visible in grid: column tint, header badge (E3) | Low | High |
| **S6** | Improve cell affordance: checkmark, outline, hover tooltip | Low | Medium |
| **S7** | Compact event context bar (E6) | Low | Medium |
| **S8** | Unscheduled as assignable: hours, Assign buttons/drag (E5) | Medium | Medium |
| **S9** | Group rows by build phase (E7) | Medium | Medium |
| **S10** | Two-column layout for Event Inputs + Work Calendar on desktop | Low | Medium |
| **S11** | Drag-and-drop assignment (E8) | Medium | Medium |
| **S12** | Keyboard navigation (E9) | Low | Medium |
| **S13** | Print / export schedule (E10) | Medium | Medium |
| **S14** | Utilization footer: progress bars, clearer hierarchy | Low | Low |
| **S15** | Add `role="grid"`, `aria-rowindex`, `aria-colindex` for a11y | Low | Low |

---

### Schedule Grid — Event Planner Layout (Proposed)

![Proposed schedule grid layout](/Users/bemoy/.cursor/projects/Users-bemoy-Developer-time-tracking/assets/schedule-grid-proposed-layout.png)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Event: 3–5 Mar · 3 days · 5 crew · 120h available        Headroom: +24h ✓       │
│ [Edit] · [Print]                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Work Calendar   Mon ✓ 08–16   Tue ✓ 08–16   Wed ✓ 08–16   [Edit]                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                 Day 1           Day 2           Day 3        │  Unscheduled (2)   │
│                 Mon 3 Mar       Tue 4 Mar      Wed 5 Mar    │  Lay carpet 8h      │
│ ┌─────────────────────┬────────────┬────────────┬────────────┤  [Assign ▾]      │
│ │ Work package        │ 32h ✓      │ 40h ⚠ 125% │ 48h ✓      │  Install walls 4h  │
│ │ (sticky)            │            │            │            │  [Assign ▾]      │
│ ├─────────────────────┼────────────┼────────────┼────────────┤                    │
│ │ ▶ Build-up          │            │            │            │                    │
│ │   Lay carpet 120m²  │    ☑       │            │    ☑       │                    │
│ │   Install walls 50m │            │    ☑       │            │                    │
│ │ ▶ Tear-down         │            │            │            │                    │
│ │   Remove carpet     │            │    ☑       │    ☑       │                    │
│ └─────────────────────┴────────────┴────────────┴────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key elements:**
- **Top bar:** Feasibility always visible. Compact event context. Print/export for handoff.
- **Day headers:** Event-relative (Day 1, 2, 3) + calendar date. Utilization per day with over-allocation badge (⚠ 125%).
- **Sticky first column:** Work package names stay visible during horizontal scroll.
- **Phase grouping:** Build-up / Tear-down sections with collapsible rows.
- **Unscheduled panel:** Hours per item, Assign dropdown or drag target.

---

## Summary

These improvements bring the planning workspace closer to the approved spec, improve discoverability of key flows (especially Review), and refine visual hierarchy and responsiveness.

**Schedule View/Grid** merit separate focus: the event planner needs feasibility at a glance, event-relative day labels, over-allocation visibility, an inline amendment flow (no `window.prompt`), and an actionable unscheduled list. Implement sticky first column, feasibility bar, and day labels as highest-impact fixes; follow with cell affordance and unscheduled assignability.
