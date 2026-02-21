---
name: planning-intelligence-phases-v2
overview: Create a fresh phased roadmap (starting from Phase 1) that moves from trusted execution data to planning intelligence, prioritized into must-have and should-have outcomes with minimal later notes for easy sequencing.
todos:
  - id: phase1-data-trust
    content: Complete attribution baseline, shared KPI/calculator dataset, counters, and policy tests.
    status: pending
  - id: phase2-kpi-reliability
    content: Add sample/confidence guardrails and deterministic KPI quality behavior.
    status: pending
  - id: phase3-calculator-v1
    content: Ship advisory calculator with provenance and override-safe workflow.
    status: pending
  - id: phase4-archive-loop
    content: Establish explicit archive boundary and versioned historical computation.
    status: pending
  - id: phase5-remediation
    content: Implement issue queues and reassignment workflows with audit trail.
    status: pending
  - id: phase6-interop
    content: Deliver export/import contracts with stable mapping and validation preview.
    status: pending
  - id: phase7-desktop-planning
    content: Create dedicated planning workspace separated from mobile execution UX.
    status: pending
isProject: false
---

# Planning Intelligence Roadmap (Fresh Phase 1+)

## Framing

Phases 1-4 of the original mission are considered shipped. This roadmap restarts at **Phase 1 (new)** focused on planning intelligence maturity, while preserving fast execution UX.

## Phase 1 — Data Trust Baseline

### Must Have

- Stabilize attribution as the single KPI source-of-truth (`attributed`, `ambiguous`, `unattributed`).
- Keep raw time entries immutable; attribution is computed, not destructive.
- Ensure KPI and calculator consume the same attributed dataset.
- Add visible data-quality counters (attributed/excluded hours + reasons).
- Add deterministic automated tests for attribution policy behavior and KPI parity.

### Should Have

- Add suggestion-only ambiguity heuristics (policy-gated, off by default behavior changes).
- Add “recompute attribution” control for diagnostics.
- Add lightweight attribution explainability panel in task detail.

### Later (pick-up)

- Background snapshot caching for large datasets.

## Phase 2 — KPI Reliability for Planning

### Must Have

- Formalize KPI metrics by Work Type (`workCategory + workUnit + buildPhase`).
- Add minimum-sample guardrails (e.g., insufficient-data state).
- Add confidence signals (sample count + stability indicator).
- Enforce that excluded/ambiguous time is never silently included in productivity.

### Should Have

- Outlier handling mode (documented, deterministic).
- KPI trend view (recent vs baseline periods).
- KPI quality badge per Work Type (high/medium/low confidence).

### Later (pick-up)

- Variance decomposition by crew size or context tags.

## Phase 3 — Advisory Calculator V1

### Must Have

- Calculator uses two explicit sources: template target and historical KPI.
- Show assumptions and source provenance for every recommendation.
- Keep output advisory and overrideable (no enforced values on tasks).
- Support both equations reliably:
  - crew = work / (time × productivity)
  - time = work / (crew × productivity)

### Should Have

- Confidence-aware output messaging (e.g., “low confidence due to low samples”).
- Side-by-side compare source A vs source B recommendations.
- Save selected recommendation into task/template with audit note.

### Later (pick-up)

- Multi-scenario calculator comparison cards.

## Phase 4 — Archive & Learning Loop

### Must Have

- Introduce explicit archive boundary for completed execution records.
- Ensure KPI computations run on archive-grade records (not transient live state only).
- Define archive schema versioning so metric logic changes are traceable.
- Add archival integrity checks (missing work/unit/category, broken links, duplicates).

### Should Have

- Archive maintenance jobs (integrity scan + repair suggestions).
- Historical recomputation tooling by engine version.
- “What changed” report when recomputing archived KPIs.

### Later (pick-up)

- Cold-storage/export strategy for long history.

## Phase 5 — Remediation Workflows

### Must Have

- Provide reassignment flow for fixing ambiguous/unattributed time.
- Add clear issue queues: “Needs measurable owner”, “Ambiguous owner”, “No work context”.
- Require audit trail for remediation actions.

### Should Have

- Bulk fix actions for common issue patterns.
- Smart fix suggestions (nearest measurable owner, matching work type).
- Team-facing “data quality progress” summary.

### Later (pick-up)

- Rule-based auto-remediation jobs with approval.

## Phase 6 — Planner Interop Foundation

### Must Have

- Define export contract for KPI and work-type summaries (CSV/Excel first).
- Define import contract for planned work packages to tasks/templates.
- Preserve stable IDs/mapping keys for round-trip reliability.

### Should Have

- Import validation preview (diff before apply).
- Export profiles (ops summary, estimator summary, phase summary).
- Conflict handling for duplicate or stale imports.

### Later (pick-up)

- Direct integrations with external planning systems.

## Phase 7 — Desktop Planning Workspace

### Must Have

- Add dedicated planning surface (separate from Today execution flow).
- Show work-package planning with KPI-backed suggestions.
- Allow editable assumptions and explicit plan locking/saving.
- Keep execution UX unchanged and shallow on mobile.

### Should Have

- Compare multiple plan scenarios.
- Highlight risk areas (low-confidence work types, high variability).
- Attach rationale notes to planning decisions.

### Later (pick-up)

- Collaborative planning roles and approvals.

## Cross-Phase Guardrails

### Must Have

- No regression to Today core actions (start/stop/complete/swipe).
- Advisory outputs remain non-authoritative.
- Every recommendation has explainable provenance.

### Should Have

- Feature flags for risky rollouts.
- Telemetry for quality and adoption (without polluting execution flow).

### Later (pick-up)

- Automated rollout gates based on production quality metrics.

## Suggested Execution Order

1. Phase 1 (Data Trust Baseline)
2. Phase 2 (KPI Reliability)
3. Phase 3 (Calculator V1)
4. Phase 4 (Archive & Learning Loop)
5. Phase 5 (Remediation)
6. Phase 6 (Interop)
7. Phase 7 (Desktop Workspace)

