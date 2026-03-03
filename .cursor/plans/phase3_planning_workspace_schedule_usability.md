# Phase 3 — Planning Workspace and Schedule Usability

**Design exploration:** WHAT to build and WHY.  
**Scope:** Highest-friction planner workflows, density, responsiveness.  
**Role:** Product/architecture definition before implementation.

**Decisions (user input):**
- Sidebar collapse: **Deferred** — optimization not needed for now
- Minimum breakpoint: **820px** (tablet/desktop)
- Metadata rebalance: **Schedule first**; Progress/Insights later
- Main focus this session: **Schedule grid redesign** → see [schedule_grid_redesign_next_steps.md](./schedule_grid_redesign_next_steps.md)

---

## Goal

Address highest-friction planner workflows with density and responsiveness fixes so the schedule is readable and actionable at supported breakpoints (≥820px). Progress/Insights rebalance deferred.

---

## 1. Workspace Navigation Clarity

### 1.1 Sidebar Collapsed-State — DEFERRED

**Decision:** Sidebar collapse optimization deferred. No changes in scope.

~~**Current behavior:** Sidebar has three states — expanded, icons-only, hidden.~~

---

### 1.2 Clear Active-State Indication for Plan vs Insights Contexts

**Current behavior:** 
- Footer has `--active` styling for Insights when `activeTab === 'insights'`.
- Selected plan in sidebar has `planning-view__item--selected`.
- **Gap:** When Insights is active, no plan is selected. Main pane shows InsightsView. Does the planner clearly see "I'm in Insights, not a plan"? The footer highlight helps, but the sidebar plan list remains visible and may draw attention.

**Design direction — active context:**

| Context | Intent |
|---------|--------|
| Plan selected | Sidebar plan item clearly highlighted. Main pane shows plan tabs. Planner should read: "I'm editing/viewing Plan X." |
| Insights active | Footer Insights entry clearly highlighted. Main pane shows Insights. No plan selected. Planner should read: "I'm in estimation calibration view." |
| Sidebar (always expanded for now) | Selected plan icon or Insights footer must communicate active context. |

**Design choices:**
- **Visual distinction:** Plan context vs Insights context should feel like different "modes" — e.g. different header treatment, or a persistent contextual label (e.g. "Insights" in main pane header when Insights is active).
- **No ambiguity:** When Insights is active, the sidebar should not suggest a plan is selected. Deselecting plan when opening Insights, or explicitly showing "Insights" in the main pane chrome, reduces confusion.

**Exit criterion:** Planner can always tell whether they are in a plan context or Insights context.

---

### 1.3 Reliable Tab-Strip Overflow at Narrow Desktop/Tablet Widths

**Current behavior:** Tab strip has `overflow-x: auto`, hidden scrollbar, gradient fade at edges. Tabs use `white-space: nowrap`. Supported planner breakpoints per strategy: tablet and desktop (planning is not optimized for phone).

**Design direction — tab overflow:**

| Concern | Intent |
|---------|--------|
| Tabs wrap or truncate awkwardly | Tabs must not wrap. Horizontal scroll is the right behavior; ensure it's smooth and discoverable. |
| Scroll indication | Gradient shadows already hint at overflow. Consider: scroll-position indicators (e.g. faint "more" affordance) or ensuring the active tab is always brought into view when switching. |
| Minimum usable width | **820px** — validate that all tabs remain reachable by scroll at this width. |
| Compact variant | At very narrow widths, consider shorter labels (e.g. "Edit" → "Edit", "Schedule" → "Sched", "Progress" → "Prog") or icon+label to reduce horizontal demand. Tradeoff: brevity vs clarity. |

**Reliability criteria:**
- Tab strip never overlaps content or breaks layout.
- All tabs remain reachable (scroll if needed).
- Active tab is visible by default; switching tabs does not leave the user disoriented.

**Exit criterion:** Tab strip behaves reliably at narrow desktop/tablet widths — no wrapping, no overlap, scroll when needed, active tab discoverable.

---

## 2. Schedule Readability and Actionability

### 2.1 Grid Information Hierarchy and Day/Cell Legibility

**Current state (from Schedule Cell Redesign + planning docs):**
- Assigned cells: hours badge, CheckIcon/PeopleIcon, light blue bg.
- Day headers: utilization badge (e.g. `54h (7 crew → 56h) 56%`).
- First column (work package names) should be sticky — critical for horizontal scroll.

**Design direction — hierarchy:**

| Layer | Intent |
|-------|--------|
| **Primary scan:** Row identity | Work package name is the anchor. Must remain visible (sticky first column). |
| **Primary scan:** Day identity | Day headers should answer "which day?" and "what's the load?" Event-relative labels (Day 1, Day 2) + calendar date support planner communication. |
| **Secondary scan:** Cell state | Empty vs assigned. Assigned = crew + hours. Over-worker / at-risk = distinct visual treatment. |
| **Tertiary:** Inline editing | Crew controls, amendment flow — present but not dominant. |

**Cell legibility:**
- Empty cells: minimal, clearly clickable. No visual competition with assigned cells.
- Assigned cells: hours and crew are the two key facts. Icon (PeopleIcon) reinforces "crew here." Over-worker state (WarningIcon, "Xh need") should stand out.
- State emphasis: normal / over / at-risk must be distinguishable at a glance. Color, icon, or badge — not just text.

**Exit criterion:** Schedule view is readable and actionable at supported planner breakpoints. Grid hierarchy supports fast scanning.

---

### 2.2 Rebalance Dense Metadata Blocks (Schedule / Progress / Insights)

**Problem:** All three surfaces present multiple metadata fields in similar density. Planners must parse labels repeatedly.

**Schedule:**
- Day utilization badges: `54h (7 crew → 56h) 56%` — already information-dense.
- Feasibility bar, event context, work calendar, conflict banner.
- Cell badges and crew controls.

**Progress:**
- Per item: work type, build phase, unit, task count, deadline status, due date, block reason.
- Summary: work done, deadline, pace.

**Insights:**
- Per row: work type, unit, phase.
- Stats: rate, samples, confidence, CV, trend, outliers — six metrics in a grid.

**Design direction — rebalance:**

| Surface | Intent |
|---------|--------|
| **Schedule** | Prioritize feasibility and assignment. Day badge: lead with the number that matters (utilization or deficit). Crew/capacity detail on hover or in expandable area for users who need it. |
| **Progress** | Lead with status and variance. Work type + phase + unit are context; consider collapsing into a single "context" line or making phase/unit secondary. Block reason is critical when present — keep prominent. |
| **Insights** | Estimation calibration frames the value. Lead with rate and confidence; samples, CV, trend, outliers are supporting. Consider: primary row = rate + confidence, secondary = "N samples · trend · outliers" or similar. |

**Principle:** *Progressive disclosure* — show what supports the primary task; defer the rest to hover, expand, or a compact secondary row.

**Exit criterion:** Progress and Insights are scannable without requiring repeated interpretation of dense labels. Primary metrics surface first; secondary metrics don't compete.

---

### 2.3 Row/Column Scan Rhythm and State Emphasis (Normal / Over / At-Risk)

**Design direction:**

| Aspect | Intent |
|--------|--------|
| **Row rhythm** | Consistent row height and spacing. Alternating subtle background (zebra) can help scan but may add noise — validate with content density. |
| **Column rhythm** | Day columns uniform width. Over-allocated columns: distinct column-level treatment (tint, border) so the eye catches overload before reading numbers. |
| **State emphasis** | Normal = neutral. Over/at-risk = color + icon. Order: color first (fast), then icon, then text. Avoid "all neutral" — at-risk must pop. |

**Schedule states:**
- Normal day: neutral.
- Over-allocated day: column tint or border; badge shows deficit.
- At-risk line item (pace): row or cell indicator.

**Progress states:**
- On track, behind, at risk — already have status badges. Ensure variance (under/near/over) reinforces at a glance.

**Exit criterion:** Scan rhythm is predictable; state emphasis (normal/over/at-risk) is immediately discernible.

---

## 3. Planning Editor Clarity

### 3.1 Tighten Summary/Action Hierarchy

**Current structure (PlanEditor):**
- Title + project (editable)
- Metric cards: Work days, Available, (optionally) High risk
- Phase filter pills (Build-up / Tear-down)
- Actions: Schedule, Progress, Hand off, Activate/Revert
- FAB: Add work package
- Line items

**Design direction:**

| Layer | Intent |
|-------|--------|
| **Summary** | Metric cards answer "does it fit?" — work days, available hours, headroom. These are the primary summary. High-risk count is secondary; consider placement (e.g. with cards vs. inline with actions). |
| **Actions** | Primary: Activate / Revert (plan state). Secondary: Schedule, Progress, Hand off — navigation and export. Tertiary: phase filter. Create (FAB) is always primary but spatially separate. |
| **Hierarchy** | Summary → Actions → Content. Reduce competition: e.g. group actions into "Plan" (Activate) vs "Navigate" (Schedule, Progress, Hand off). |

**Principle:** Planner's first questions — "What's the scope?" and "Can I activate?" — should be answerable without scanning past lower-priority controls.

---

### 3.2 Reduce Visual Competition Between Primary and Secondary Controls

**Problem:** MetricCard, StatusBadge, phase pills, and action buttons share similar visual weight. All compete for attention.

**Design direction:**

| Control | Primary or Secondary | Treatment |
|---------|----------------------|-----------|
| Metric cards | Primary (summary) | Slightly larger, clear numbers. |
| Activate / Revert | Primary (plan state) | Distinct — success/green when locked; secondary when draft. |
| Schedule, Progress, Hand off | Secondary | Softer styling; read as "navigation/utility" not "primary action." |
| Phase filter | Secondary | Pill style is fine; ensure it doesn't read as important as Activate. |
| FAB | Primary (create) | Already distinct (floating). Keep. |

**Techniques:**
- Size: primary controls larger or bolder.
- Color: primary actions use primary color; secondary use muted or outline.
- Grouping: visual separation between "summary," "plan state," and "navigation."

**Exit criterion:** Primary and secondary controls have clear hierarchy; planner is not visually overloaded.

---

## 4. Cross-Cutting Considerations

### Breakpoint Definition

Define **supported planner breakpoints** explicitly. Strategy says tablet/desktop. Propose:
- Desktop: ≥1024px — full layout.
- Tablet: 768px–1023px — same layout, possibly tighter spacing; tab strip may scroll.
- Below 768px: stack mode (mobile) — different layout, may not be in Phase 3 scope.

Phase 3 exit criteria should be validated at the minimum supported width (e.g. 768px).

---

### Dependencies and Sequencing

| Workstream | Depends on | Notes |
|------------|------------|-------|
| Sidebar discoverability | Existing collapse behavior | Enhances current implementation. |
| Active-state indication | Sidebar + footer structure | Small addition. |
| Tab strip overflow | Current tab strip | Validation + possible compact variant. |
| Schedule hierarchy/legibility | Schedule Cell Redesign, FeasibilityBar | May align with or follow those plans. |
| Metadata rebalance | Progress, Insights, Schedule structure | Can be done per-surface independently. |
| PlanEditor hierarchy | PlanEditor structure | Self-contained. |

Schedule Cell Redesign and Assigned Crew vs Estimate Feedback introduce additional schedule UI (PeopleIcon, crew inline, excess capacity). Phase 3 should ensure the resulting schedule surface still meets hierarchy and legibility goals — avoid layering changes that conflict.

---

### Risks and Tradeoffs

| Risk | Mitigation |
|------|------------|
| Over-simplifying metadata loses power-user value | Progressive disclosure: primary visible, secondary on expand/hover. |
| Compact tab labels reduce clarity | Prefer scroll over abbreviation; only shorten at very narrow widths if needed. |
| Hierarchy changes feel like a regression | Iterate; validate with planner (Bjørn). |
| Schedule + Progress + Insights changes in one release | Consider phasing: workspace nav first, then schedule, then Progress/Insights. |

---

## 5. Exit Criteria Summary

| Area | Criterion |
|------|-----------|
| Workspace nav | Planning workspace remains clear in expanded and collapsed sidebar modes. |
| Active context | Planner can always tell plan vs Insights context. |
| Tab strip | Reliable overflow behavior at narrow desktop/tablet widths. |
| Schedule | Readable and actionable at supported breakpoints; hierarchy supports scanning. |
| Progress/Insights | Scannable without repeated interpretation of dense labels. |
| PlanEditor | Summary/action hierarchy tightened; primary vs secondary controls clearly distinguished. |

---

## 6. Open Questions

1. **Icons-only plan identity:** When sidebar is icons-only, how much plan identity does the planner need? Tooltip on hover? Badge? Or is main pane content sufficient?
2. **Supported minimum width:** Confirm 768px as the Phase 3 validation breakpoint, or define explicitly.
3. **Metadata rebalance scope:** Which surfaces are in scope for Phase 3 — all three (Schedule, Progress, Insights) or a subset?
4. **Schedule Cell Redesign alignment:** Does Phase 3 assume Schedule Cell Redesign and Assigned Crew changes ship first, or should Phase 3 design accommodate both current and future schedule states?
