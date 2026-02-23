# planning-intelligence-phases-v2 Follow-On Execution Checklist

Source:
- `.cursor/plans/planning-intelligence-phases-v2_should-later-consolidated.md`
- Quick gap scan completed on 2026-02-22

Goal:
- Close remaining `Should Have` gaps first.
- Promote only high-leverage `Later` items after `Should Have` closure.

## Iteration 1 (Should-Have Closure, Core UX + Data Integrity)

- [x] **P3-9 (partial)** Add save-to-template path for calculator recommendations with audit note parity to task save.
  Targets: `src/components/CalculatorSheet.tsx`, `src/lib/calculator-save.ts`, `src/lib/calculator-save.test.ts`.
- [x] **P2-4 (partial)** Add explicit outlier handling mode (default deterministic/report-only, optional exclusion mode).
  Targets: `src/lib/kpi.ts`, `src/lib/kpi.test.ts`, `src/pages/settings/SettingsProductivityView.tsx`.
- [x] **P6-18 (partial)** Add stale import conflict handling beyond duplicate-key detection (existing changed since preview).
  Targets: `src/lib/interop/import-preview.ts`, `src/pages/settings/SettingsInteropView.tsx`, `src/lib/interop/import-preview.test.ts`.
- [x] **P4-10 (partial)** Wire archive maintenance scan to a user/ops entrypoint (manual run action + summary output).
  Targets: `src/lib/archive/maintenance.ts`, settings UI page (new or existing), tests.

## Iteration 2 (Should-Have Closure, Archive Intelligence + Governance)

- [x] **P4-11 (missing)** Build historical KPI recomputation tooling by `archiveVersion` / engine version.
  Targets: new `src/lib/archive/recompute.ts` (+ tests), integrate with archive utilities.
- [x] **P4-12 (missing)** Add recomputation diff report (“what changed”) for KPI outputs.
  Targets: new `src/lib/archive/recompute-report.ts` (+ tests), UI surfacing in archive/ops settings.
- [x] **Cross-22 (missing)** Add feature flag framework for risky rollouts.
  Targets: new `src/lib/flags/*`, gate new flows in planning/interop/archive paths.
- [x] **Cross-23 (missing)** Add lightweight telemetry for quality/adoption events.
  Targets: new `src/lib/telemetry/*`, instrument key events (calculator save, import apply, remediation apply, plan compare/lock).

## Iteration 3 (Promoted Later Items, High ROI)

- [x] **Later-1 (partial)** Extend attribution snapshot caching for large datasets (background refresh strategy, not only on-demand recompute).
  Targets: `src/lib/attribution/cache.ts`, diagnostics loader, performance tests/bench checks.
- [x] **Later-8 (missing)** Add rollout gates based on production quality metrics.
  Targets: flag + telemetry integration; block/allow logic in risky flows.
- [x] **Later-3 (done)** Multi-scenario calculator comparison cards.
  Targets: `src/lib/calculator-scenarios.ts`, `src/components/CalculatorSheet.tsx`, `src/lib/flags/feature-flags.ts`, `src/lib/telemetry/telemetry.ts`.

## Backlog (Later Items Not Yet Promoted)

- [ ] Later-2 Variance decomposition by crew size/context tags.
- [ ] Later-4 Cold-storage/export strategy for long history.
- [ ] Later-5 Rule-based auto-remediation with approval.
- [ ] Later-6 Direct integrations with external planning systems.
- [ ] Later-7 Collaborative planning roles and approvals.

## Acceptance Checks (Per Iteration)

- [x] Unit tests updated and passing for touched modules.
- [x] `npm test` passes.
- [x] `npm run build` passes.
- [ ] Manual smoke for changed surfaces passes.

## Definition of Done (Follow-On Program)

- [x] All remaining `Should Have` items are `done`.
- [x] At least 2 promoted `Later` items are `done` (or explicitly deferred with rationale).
- [x] Checklist status reflects implementation truth with file-level evidence.
