# Next Steps — Post Review & Insights

Handoff document for architectural direction after the Planning Review, Wrap-Up, and Insights plan is implemented. Assumes all four phases are complete: hard lineage (Phase 1), progress view (Phase 2), wrap-up review with KPI learning (Phase 3), and insights layer (Phase 4).

## System State After Current Plan

- Tasks carry hard lineage (`sourcePlanId`, `sourceLineItemId`, `excludeFromKpi`)
- Plans have a full lifecycle: `draft → locked → (review-ready, computed) → reviewed`
- Progress view shows live plan-vs-actual per line item (read-only, no side effects)
- Wrap-up review archives project tasks, updates KPIs with outlier deselection, sets `reviewedAt`
- Insights view shows work type KPI trends, confidence, variance — plan-agnostic, inside planning module
- `PlanLineItem` has reserved `scheduledStart` and `scheduledEnd` fields (nullable, unused)
- `PlanLineItem` has `reviewNote` for post-execution annotations
- Planning module uses stack navigation (`PlanningSubView`: list / edit / compare / progress / insights)

## Recommended Sequence

### 1. Planning Workspace (Split-Pane)

**Why next:** The planning module now has five surfaces in the main pane. Stack navigation becomes painful. The workspace restructuring makes every subsequent planning feature more ergonomic and is the structural prerequisite for scheduling.

**What it is:**
- Desktop/tablet (>768px): persistent two-pane layout — PlanList sidebar (always visible) + main content area (PlanEditor / ProgressView / CompareView / WrapUpSheet / InsightsView)
- Mobile (<768px): graceful fallback to current stack navigation — no degradation
- Planning tab enters "workspace mode" — bottom tab bar hides on desktop, replaced by workspace chrome with an exit control
- Selected plan highlighted in sidebar; switching plans updates main pane without navigation
- Main pane gets a tab strip or segmented control: Edit / Progress / Review (context-dependent on plan state)
- Insights accessible from sidebar as a plan-agnostic entry (no plan selection required)
- CompareView: sidebar becomes the selection surface for plan A / plan B comparison

**Key design decisions (already made):**
- Planning workspace replaces app chrome on desktop (modal at navigation level, not coexisting with tab bar)
- Mobile fallback is the current stack model — no behavioral change on small screens
- The workspace is a progressive enhancement, not a requirement

**Open design question:**
- Should the sidebar have sections (e.g., "Active Plans" / "Ready to Review" / "Completed") or a flat list with status badges? The review-ready detection makes sectioning natural but adds visual complexity.

### 2. Scheduling

**Why after workspace:** Scheduling needs desktop-first interaction patterns (timeline views, drag-to-reschedule, wider data tables). Building it into the split-pane workspace produces a better feature than retrofitting it into stack navigation.

**What it is:**
- Place work packages in time using `scheduledStart` and `scheduledEnd` on `PlanLineItem`
- Progress view gains a temporal axis: "on schedule / ahead / behind" alongside quantitative variance
- Direct manipulation from progress view becomes possible (adjust dates when reality diverges from plan)

**Key scoping question (not yet answered):**
- Is scheduling just calendar placement (start/end dates per work package), or does it include dependency relationships between packages? Calendar placement is manageable. Dependencies are substantially more complex and may not be needed — construction/event work packages are often parallel, not sequential. Recommend starting with calendar placement only.

**Related decisions to make:**
- What does the scheduling UI look like? A Gantt-adjacent timeline? A calendar view? A table with date columns? The workspace layout will constrain this.
- Should scheduling affect the Today view? If a work package is scheduled for tomorrow, should its released tasks appear differently in Today? Or is scheduling purely a planning-side concern?
- Fine-grained mid-execution amendment: should individual line item dates be adjustable while the plan stays locked, with amendments logged? This was discussed but not finalized.

### 3. Export / Reporting

**Can be interleaved at any point.** Small enough to fit alongside workspace or scheduling work.

**What it is:**
- Plan-vs-actual review export (CSV or PDF): planned vs actual per line item, variance, unplanned work summary
- Time entry export: date, task, project, hours, workers, person-hours (for payroll/billing)
- Project summary export: completion status, total time, productivity highlights

**Key design question:**
- Is export one-way data egress only, or should the system support round-trip integration? Round-trip increases complexity substantially. Recommend one-way export with a defined, stable schema.
- Export format becomes a de-facto API. Schema changes become breaking. Worth defining the format carefully once.

## Still on the Table (Lower Priority)

These were identified during architectural exploration but are not blocking and have no immediate urgency.

### Named Crew Members / Team Identity
- Current model: `workers` is a headcount number, not identifiable individuals
- Adding named crew members enables payroll integration, individual productivity, accountability
- Fundamentally changes the data model and UI surface area
- Not needed until sync/multi-user becomes a requirement
- **Strategic question:** Is the primary user managing the work (foreman) or doing it (worker)? If managing, headcount is sufficient.

### Sync (Supabase)
- `syncStatus` field on time entries already exists in schema
- A Supabase sync plan exists in `.cursor/plans/`
- **Blocked by:** No defined conflict model or ownership semantics
- Natural write boundary: plans managed by one person, time entries created by executors
- **Prerequisite:** Define who owns what before building sync. Sync without ownership semantics breaks trust.

### Notification / Awareness Surface
- The app is entirely reactive — no proactive signals
- Useful events: timer budget approaching/exceeded, plan partially released but stalled, task running unusually long
- PWA limits OS-level notifications; in-app banners/badges are the pragmatic path
- Progress view partially addresses planner awareness; foreman-side awareness (timer alerts) could be a small standalone feature
- **Scale-dependent:** At 5 tasks, checking the app is trivial. At 20+ active tasks across 4 projects, proactive signals save real time.

### Hierarchical Task Structure (Phases / Milestones)
- Currently: tasks have one level of subtasks, projects are flat containers, build phases are a field
- The natural hierarchy is Event → Phase → Work Package → Task
- Lineage solves the immediate need (which tasks came from which plan)
- Full hierarchy is scope creep for the current single-user profile
- **Revisit when:** Multi-project or multi-phase events become common enough that the flat model causes confusion

### Planning Module as Separate View Mode
- Already decided: planning workspace will eventually be a separate view mode (see item 1 above)
- The split-pane workspace is the first step toward this
- Full separation (e.g., different URL routes, independent navigation state) is a future evolution once the workspace proves its value

## Role Model (Implicit)

These role assumptions should continue to guide layout and UX decisions:

- **Planning module** = planner/lead context, desktop-tolerant, information-dense, reflective
- **Today view** = foreman context, mobile-first, execution-speed, reactive
- No user accounts or role enforcement — the distinction is behavioral and contextual
