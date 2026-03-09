Unified Work Package Rows — Migration Plan

 Context

 The planning workspace editor shows work packages as a flat list of cards spanning full width with no phase grouping.
 Build-up and tear-down are the same physical work (carpet, walls, furniture) with different productivity characteristics per
 phase, but the current model forces them into separate line items and separate work type records. This creates duplication,
 poor scannability, and a disconnect between how planners think ("Carpet Hall A needs build-up and tear-down numbers") and how
  the UI presents it.

 Goal: A single row per work package with shared identity fields (title, type, qty) and per-phase columns (rate, crew, hours)
 for both build-up and tear-down. Work types become phase-agnostic with dual rates.

 Critical constraint: The unified row is a planning-side presentation only. At handoff to execution, each active phase of a
 work package must become its own independent task/line-item — "Carpet Hall A build-up" and "Carpet Hall A tear-down" are
 separate executable work items with independent status, time tracking, crew, and blocking state.

 ---
 Phase 1: WorkType model migration

 Make WorkType phase-agnostic. One record per work category instead of two.

 Changes

 src/lib/types.ts — WorkType interface:
 - Remove buildPhase: BuildPhase
 - Replace expectedProductivity: number with buildUpRate: number and tearDownRate: number
 - Either rate can be 0 to indicate "not applicable for this phase"

 src/lib/db/schema.ts — Index:
 - Change 'by-title-unit-phase': [string, string, string] to 'by-title-unit': [string, string]
 - DB version bump with migration

 src/lib/db/work-types-repo.ts:
 - findWorkTypeByKey() — remove buildPhase param, use new 2-part index

 src/lib/stores/work-type-store.ts:
 - createWorkType() — uniqueness check on (title, workUnit) only
 - findWorkTypeByCompositeKey() — remove buildPhase param
 - ensureWorkTypeExistsOrCreate() — remove buildPhase param, accept buildUpRate/tearDownRate
 - updateWorkTypeFields() — duplicate check on (title, workUnit) only
 - DB migration: detect paired records (same title+unit, different phase) and merge into single records with dual rates

 src/components/WorkTypeFormSheet.tsx:
 - Remove build phase radio selector
 - Two rate inputs: "Build-up rate" and "Tear-down rate" (either can be 0)

 src/pages/settings/SettingsWorkTypesView.tsx:
 - Update list — remove phase label, show both rates

 src/components/WorkTypePicker.tsx:
 - Option labels: "{title} · {unit}" (drop phase)

 src/lib/interop/work-type-import.ts / work-type-export.ts:
 - CSV columns: remove buildPhase, add buildUpRate, tearDownRate
 - Update validation, mapping keys, preview generation

 ---
 Phase 2: PlanLineItem model migration

 Transform line items from single-phase to dual-phase per work package.

 New PlanLineItem shape

 interface PlanLineItem {
   // Identity (shared)
   id: string;
   title: string;
   workTypeTitle: string;
   workUnit: WorkUnit;
   workTypeId: string | null;
   workQuantity: number;               // shared quantity (default)
   tearDownQuantity?: number | null;    // override when unlinked

   // Build-up assumptions
   buildUpRate: number;                // 0 = phase not applicable
   buildUpCrew: number;
   buildUpTimeHours: number;
   buildUpRateSource: RateSource;

   // Tear-down assumptions
   tearDownRate: number;               // 0 = phase not applicable
   tearDownCrew: number;
   tearDownTimeHours: number;
   tearDownRateSource: RateSource;

   // Build-up scheduling (independent per phase)
   buildUpScheduledStart: string | null;
   buildUpScheduledEnd: string | null;
   buildUpOriginalScheduledStart: string | null;
   buildUpOriginalScheduledEnd: string | null;
   buildUpCrewByDate?: Record<string, number>;

   // Tear-down scheduling (independent per phase)
   tearDownScheduledStart: string | null;
   tearDownScheduledEnd: string | null;
   tearDownOriginalScheduledStart: string | null;
   tearDownOriginalScheduledEnd: string | null;
   tearDownCrewByDate?: Record<string, number>;

   // Build-up execution state
   buildUpExecutionStatus: LineItemExecutionStatus;
   buildUpBlockReason: string | null;
   buildUpBlockCategory: BlockCategory | null;
   buildUpExecutorNote: string | null;
   buildUpDeferredNote: string | null;

   // Tear-down execution state
   tearDownExecutionStatus: LineItemExecutionStatus;
   tearDownBlockReason: string | null;
   tearDownBlockCategory: BlockCategory | null;
   tearDownExecutorNote: string | null;
   tearDownDeferredNote: string | null;

   // Shared
   rationale: string | null;
   reviewNote?: string | null;
   removedFromSource: boolean;
   amendmentNote: string | null;
   amendedAt: string | null;
 }

 Remove: buildPhase, productivityRate, crew, timeHours, rateSource, scheduledStart/End, originalScheduledStart/End,
 crewByDate, executionStatus, blockReason, blockCategory, executorNote, deferredNote

 Helper: phase field accessor

 To avoid duplicating read logic everywhere, add a utility:

 // In plan-model.ts or work-package-core.ts
 function getPhaseFields(item: PlanLineItem, phase: BuildPhase) {
   const prefix = phase === 'build-up' ? 'buildUp' : 'tearDown';
   return {
     rate: item[`${prefix}Rate`],
     crew: item[`${prefix}Crew`],
     timeHours: item[`${prefix}TimeHours`],
     rateSource: item[`${prefix}RateSource`],
     scheduledStart: item[`${prefix}ScheduledStart`],
     scheduledEnd: item[`${prefix}ScheduledEnd`],
     crewByDate: item[`${prefix}CrewByDate`],
     executionStatus: item[`${prefix}ExecutionStatus`],
     // ...etc
   };
 }
 function isPhaseActive(item: PlanLineItem, phase: BuildPhase): boolean {
   const { rate, crew, timeHours } = getPhaseFields(item, phase);
   return rate > 0 || crew > 0 || timeHours > 0;
 }

 This keeps downstream code clean — schedule, capacity, field plan all call getPhaseFields(item, phase) instead of hardcoding
 prefix logic.

 Files affected

 src/lib/planning/plan-model.ts:
 - Update PlanLineItem interface
 - Update createLineItem() — accept per-phase params
 - Update duplicateLineItem() — copy all per-phase fields
 - Update planTotalPersonHours() — sum both phases
 - Update getEffectiveCrewForDate() — add phase param
 - Update lineItemEffectiveCrew() — add phase param
 - Add getPhaseFields() and isPhaseActive() helpers
 - Migration: On plan load from DB, detect old single-phase format and convert

 src/lib/work-package-core.ts:
 - lineItemWorkTypeKey() — remove buildPhase from key
 - WorkPackageCore — update to dual-phase or keep as single-phase (used for task creation, see Phase 5)

 src/lib/kpi.ts:
 - WorkTypeKey — remove buildPhase from key
 - workTypeKeyString() — drop phase from key string
 - KPI actuals from tasks still carry buildPhase — KPI lookup for suggestions can still be phase-specific by filtering
 task-level data

 src/lib/planning/plan-suggestions.ts:
 - Provide per-phase rate/crew/time recommendations
 - Look up KPIs by work type key (without phase), filter historical data by phase for each suggestion

 ---
 Phase 3: Schedule & capacity adaptation

 Schedule view groups by phase — each work package appears in both phase groups (when active for that phase).

 src/pages/planning/schedule/ScheduleGrid.tsx:
 - groupByPhase(): iterate items, include in a phase group if isPhaseActive(item, phase). Each "row" in the group carries {
 item, phase } so renderers know which phase fields to read.

 src/lib/planning/scheduling/auto-schedule.ts:
 - Read getPhaseFields(item, phase) for crew, timeHours when auto-scheduling

 src/lib/planning/scheduling/capacity-core.ts:
 - Same — read phase-specific fields via accessor

 src/lib/planning/scheduling/shared-row-aggregates.ts:
 - Update to use getPhaseFields()

 src/lib/planning/scheduling/schedule-hierarchy.ts:
 - Each line item produces up to two schedule rows (one per active phase)

 ---
 Phase 4: Editor UI — unified rows

 Replace the flat card list with the work package table.

 Layout

 ┌──────────────────────────────┬──────────────────────┬──────────────────────┐
 │  WORK PACKAGE                │  BUILD-UP            │  TEAR-DOWN           │
 │  Title     Type    Qty  Unit │  Rate  Crew  Hrs     │  Rate  Crew  Hrs     │
 ├──────────────────────────────┼──────────────────────┼──────────────────────┤
 │  Carpet A  Carpet  1200  m²  │  12.4   6    16.1    │  18.6   4    16.1   │
 │  Walls A   Walls    340  m   │   8.2   4    10.4    │  11.0   3    10.3   │
 │  [+ Add work package...]     │                      │                      │
 └──────────────────────────────┴──────────────────────┴──────────────────────┘

 Interaction model:
 - Cells are inline-editable (click to focus, tab between cells)
 - Phase columns with all-zero values appear greyed/disabled
 - Clicking a greyed phase cell activates it (sets crew=1)
 - Row actions (duplicate, delete, magic apply) on hover or trailing column
 - Inline add row at bottom

 src/pages/planning/PlanEditor.tsx:
 - Remove phase pill segmented control
 - Remove AddLineItemForm usage
 - Render new WorkPackageTable component
 - Header shows count + total person-hours per phase

 New: src/pages/planning/WorkPackageTable.tsx:
 - Table component with sticky column headers
 - Phase column group headers
 - Inline-editable cells
 - Add row at bottom

 src/pages/planning/LineItemCard.tsx:
 - Keep for mobile / expanded detail view (future consideration, not this scope)

 New: src/styles/components/planning/work-package-table.css:
 - Compact row height (~44px)
 - Phase column group visual separation
 - Greyed-out treatment for inactive phase cells
 - Hover/focus states

 ---
 Phase 5: Handoff — splitting work packages into phase tasks

 This is the critical integration point. The unified work package must split into separate phase-specific items at two
 boundaries:

 A. Plan handoff to executor (plan-package export)

 src/lib/interop/data-transfer/plan-package.ts:
 - When building the export payload, expand each PlanLineItem into up to two line items in the serialized format:
   - If isPhaseActive(item, 'build-up'): emit a build-up line item with buildPhase: 'build-up', the build-up
 rate/crew/time/schedule fields, and a sourceWorkPackageId: item.id to track lineage
   - If isPhaseActive(item, 'tear-down'): emit a tear-down line item similarly
 - The exported format uses the old single-phase PlanLineItem shape (backward compatible for executor devices that haven't
 updated)
 - DIFF_FIELDS: compare per-phase fields when re-importing

 B. Task creation from plan (release flow)

 src/lib/planning/release-plan.ts / src/lib/planning/release-selection.ts:
 - lineItemToCreateTaskInput() already takes a single line item and produces one task
 - Add a phase param: lineItemToCreateTaskInput(item, phase, overrides)
 - Reads from getPhaseFields(item, phase) to populate the task's crew, rate, time, quantity
 - Task title includes phase: "${item.title} — Build-up" or "${item.title} — Tear-down"
 - Task gets buildPhase set to the specific phase
 - Task gets sourceLineItemId: item.id (same for both phases — tracks back to the unified work package)

 src/components/AddFromPlanSheet.tsx:
 - Selection UI shows each work package with checkboxes per active phase (or a single checkbox that creates both)
 - Each checked phase creates a separate task

 C. Field plan view (executor side)

 src/pages/field-plan/field-plan-model.ts:
 - buildFieldPlanLineItemSummaries(): When working with the new dual-phase format, iterate phases and build separate summaries
  per active phase
 - When working with imported old-format plans (single-phase line items), behave as today

 src/pages/field-plan/FieldPlanLineItemRow.tsx:
 - Each row = one phase of one work package (independent status, actions, crew)
 - No change to executor interaction model — they see and act on phase-specific work items

 D. Execution return

 src/lib/interop/data-transfer/execution-return.ts:
 - Exports per-phase execution state (status, notes, crew overrides)
 - On planner-side import: maps returned phase-specific results back onto the unified work package's per-phase execution
 fields

 ---
 Phase 6: Downstream consumers

 src/lib/planning/plan-progress.ts:
 - Per-phase progress tracking — build separate LineItemProgress entries per active phase
 - plannedPersonHours for each phase independently

 src/lib/planning/wrap-up-v2-projection.ts:
 - Phase-aware projections using per-phase fields

 src/lib/stores/task-store.ts:
 - createTask() — no interface change needed, already accepts buildPhase as a field
 - The splitting happens upstream in release-plan/release-selection

 src/lib/remediation/worktype-classify.ts:
 - Work type matching no longer uses phase as part of the key — match by (title, workUnit) only

 ---
 Implementation order

 1. WorkType migration (Phase 1) — foundational, unblocks everything
 2. PlanLineItem migration (Phase 2) — data model + getPhaseFields() accessor
 3. Schedule adaptation (Phase 3) — schedule view works with new model
 4. Handoff splitting (Phase 5) — ensure execution path works before changing UI
 5. Editor UI (Phase 4) — the visible payoff, built on working model
 6. Downstream (Phase 6) — progress, wrap-up, field plan

 Note: Phase 5 (handoff) is implemented before Phase 4 (UI) because the execution path must work correctly before we change
 how planners interact with the data. This ensures no regression in the critical plan→task flow.

 ---
 Verification

 - Run test suite after each phase (vitest)
 - WorkType migration: Create paired work types in old format, verify merge on migration, verify settings UI shows dual rates
 - PlanLineItem migration: Create plans with old-format items, verify auto-migration, verify getPhaseFields() returns correct
 data
 - Schedule: Verify items appear in correct phase groups, capacity math is correct
 - Handoff: Export a unified work package → verify two separate line items in payload. Create tasks from plan → verify
 separate tasks per phase with correct crew/rate/time
 - Editor UI: Desktop viewport testing at 1280px and 1920px. Inline editing, tab navigation, greyed-out phase cells, add row
 - Round-trip: Plan with dual-phase items → handoff → execution → return → verify phase-specific results map back correctly