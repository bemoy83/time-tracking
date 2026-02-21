---
name: attribution-engine-v1-revised
overview: Revise the attribution engine plan to explicitly adopt soft-first rollout milestones with measurable strict-switch gates, and add a policy-gated ambiguity tiebreaker framework that is implemented now but disabled by default.
todos:
  - id: policy-model
    content: Add attribution policy config/types and engine versioning, including suggestion fields for unresolved ambiguity.
    status: pending
  - id: heuristic-framework
    content: Implement deterministic tiebreaker chain with policy gates; default to suggestion-only behavior in soft mode.
    status: pending
  - id: soft-rollout-observability
    content: Add attribution quality counters, unresolved reason breakdowns, and strict-readiness metrics to Settings/KPI surfaces.
    status: pending
  - id: kpi-calculator-parity
    content: Refactor KPI and calculator to consume unified attributed output and excluded buckets.
    status: pending
  - id: reassignment-audit
    content: Implement reassignment operations/UI and audit logging for remediation workflows.
    status: pending
  - id: snapshot-backfill
    content: Add attribution snapshot cache, lazy backfill, and manual recompute controls.
    status: pending
  - id: tests-policy-and-parity
    content: Add tests for policy behavior, heuristic suggestion-only mode, KPI/calculator parity, and reassignment integrity.
    status: pending
isProject: false
---

# Attribution Engine Full V1 (Revised)

## Goal

Implement a high-reward attribution system that preserves raw logs, delivers reliable KPI/calculator math, and rolls out safely via soft-first policy with clear criteria to move to strict rules.

## New Revisions Included

- **Soft-first rollout path** with explicit strict-switch metrics and timeline.
- **Policy-gated ambiguity heuristics** implemented in engine architecture, but **off by default** under current policy.

## Policy Baseline (Current)

- Active policy: `soft_allow_flag`.
- Ambiguous or unattributed time is excluded from KPI denominator and surfaced with reasons.
- Raw time entry/task links are never mutated by attribution.

## Attribution Engine Design

- Keep versioned deterministic engine in `[/Users/bemoy/Developer/time-tracking/src/lib/attribution/engine.ts](/Users/bemoy/Developer/time-tracking/src/lib/attribution/engine.ts)`.
- Add policy types/config in `[/Users/bemoy/Developer/time-tracking/src/lib/types.ts](/Users/bemoy/Developer/time-tracking/src/lib/types.ts)`:
  - `AttributionPolicy = soft_allow_flag | strict_block | soft_allow_pick_nearest`
  - `AttributionEngineVersion = v1`
- Result schema includes:
  - `status` (`attributed | unattributed | ambiguous`)
  - `reason`
  - optional `suggestedOwnerTaskId` (for unresolved ambiguous entries)
  - optional `heuristicUsed`

## Policy-Gated Heuristic Framework (New)

- Implement deterministic resolver chain now, but gate execution by policy:
  - Under `soft_allow_flag`: compute **suggestions only** (no KPI impact).
  - Under `soft_allow_pick_nearest`: apply selected resolver outcome.
  - Under `strict_block`: prevent new ambiguous structures in create/edit flows.
- Initial resolver order:
  1. Nearest measurable ancestor with exact `workCategory + workUnit + buildPhase` match.
  2. Nearest measurable ancestor with `workCategory + workUnit` match.
  3. Otherwise unresolved ambiguous.
- Expose counters in Settings/KPI UI:
  - `ambiguous_count`
  - `ambiguous_suggested_resolutions`
  - `ambiguous_resolved_by_policy`.

## Soft-First Rollout Milestones (New)

1. **M1: Engine + visibility (soft mode)**
  - KPI/calculator consume attributed-only hours.
  - Show excluded buckets and reasons.
  - Show suggestion metrics from heuristic framework (no auto-apply).
2. **M2: Guided remediation**
  - Reassignment UX + measurable-owner hints in task detail/settings.
  - Track fix rate and recurring ambiguity causes.
3. **M3: Strict readiness review**
  - Evaluate strict-switch gates (below) for at least 2 weeks of live usage.
4. **M4: Strict-on for new edits (optional)**
  - Enable `strict_block` for create/edit paths only.
  - Keep legacy data in soft mode with remediation queue.

## Strict-Switch Criteria (New)

Move from soft to strict only when all are met:

- Ambiguous hours < 10% of KPI-eligible hours for 2 consecutive weeks.
- Unattributed hours trend stable/downward week-over-week.
- Top 3 ambiguity reasons each have a documented UX fix path.
- Reassignment/remediation completion rate > 80% for flagged issues.
- No KPI/calculator parity regressions in test suite.

## Existing Full-V1 Workstreams (Retained)

### 1) KPI + Calculator Integration

- Wire KPI and calculator to shared engine output in:
  - `[/Users/bemoy/Developer/time-tracking/src/components/KpiSection.tsx](/Users/bemoy/Developer/time-tracking/src/components/KpiSection.tsx)`
  - `[/Users/bemoy/Developer/time-tracking/src/components/CalculatorSheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/CalculatorSheet.tsx)`
  - `[/Users/bemoy/Developer/time-tracking/src/lib/kpi.ts](/Users/bemoy/Developer/time-tracking/src/lib/kpi.ts)`

### 2) Observability + Attribution Explainability

- Add task-level attribution breakdown component and wire into detail view:
  - new `[/Users/bemoy/Developer/time-tracking/src/components/TaskAttributionBreakdown.tsx](/Users/bemoy/Developer/time-tracking/src/components/TaskAttributionBreakdown.tsx)`
  - update `[/Users/bemoy/Developer/time-tracking/src/pages/TaskDetail.tsx](/Users/bemoy/Developer/time-tracking/src/pages/TaskDetail.tsx)`
- Extend Settings productivity section with attribution quality counters in `[/Users/bemoy/Developer/time-tracking/src/pages/SettingsView.tsx](/Users/bemoy/Developer/time-tracking/src/pages/SettingsView.tsx)`.

### 3) Reassignment + Audit Trail

- Implement reassignment operations in `[/Users/bemoy/Developer/time-tracking/src/lib/db.ts](/Users/bemoy/Developer/time-tracking/src/lib/db.ts)`.
- Add reassignment UI:
  - new `[/Users/bemoy/Developer/time-tracking/src/components/ReassignEntrySheet.tsx](/Users/bemoy/Developer/time-tracking/src/components/ReassignEntrySheet.tsx)`
- Log reassignment audit events via existing notes/activity mechanisms.

### 4) Snapshot Cache + Backfill

- Add optional attribution snapshot cache store (DB version bump) in `[/Users/bemoy/Developer/time-tracking/src/lib/db.ts](/Users/bemoy/Developer/time-tracking/src/lib/db.ts)`.
- Add lazy recompute/backfill orchestration on app init in `[/Users/bemoy/Developer/time-tracking/src/App.tsx](/Users/bemoy/Developer/time-tracking/src/App.tsx)`.
- Add “Recompute attribution” diagnostics control in Settings.

### 5) Test Matrix

- Engine tests: `[/Users/bemoy/Developer/time-tracking/src/lib/attribution/engine.test.ts](/Users/bemoy/Developer/time-tracking/src/lib/attribution/engine.test.ts)`
- KPI/calculator parity tests: `[/Users/bemoy/Developer/time-tracking/src/lib/kpi.test.ts](/Users/bemoy/Developer/time-tracking/src/lib/kpi.test.ts)`
- Reassignment DB tests: `[/Users/bemoy/Developer/time-tracking/src/lib/db.test.ts](/Users/bemoy/Developer/time-tracking/src/lib/db.test.ts)`
- Policy-behavior tests (new): ensure `soft_allow_flag` only suggests and never auto-applies.

## Acceptance Criteria (Updated)

- In `soft_allow_flag`, ambiguous time is excluded and visible; heuristic suggestions are visible but not auto-applied.
- KPI and calculator remain parity-consistent from the same attributed dataset.
- Reassignment path resolves flagged ambiguity without mutating raw historical meaning.
- Strict-switch dashboard metrics are available and actionable.

