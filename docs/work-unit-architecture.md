# Work Unit Architecture

The work-unit system has three layers:

- `src/lib/work-unit-domain.ts`
  Pure rules for seeded built-ins, id generation, reorder behavior, archived-current selection, and import upsert planning.
- `src/lib/work-unit-service.ts`
  Persistence and cross-entity usage operations. This is the only layer that should talk to IndexedDB repos for work-unit definitions and usage counting.
- `src/lib/stores/work-unit-store.ts`
  External-store state, initialization, and thin orchestration over the domain/service layers.

Formatting and UI rules have their own shared seams:

- `src/lib/work-unit-formatting.ts`
  Use `formatQuantityWithUnit()`, `formatWorkTypeWithUnit()`, and `formatUnitRate()` instead of reading `WORK_UNIT_LABELS` directly.
- `src/lib/hooks/useSelectableWorkUnits.ts`
  Use this for “active units plus archived current value” picker behavior.
- `src/components/WorkUnitPillGroup.tsx`
  Use this for work-unit pill rendering instead of reimplementing the radio group.
- `src/lib/hooks/useWorkUnitImportPreview.ts`
  Use this to derive import preview state and the “apply file labels” toggle.
- `src/components/WorkUnitImportPreviewPanel.tsx`
  Use this to render import unit summaries and conflict toggles.

Import and transfer code should keep file-shape parsing local, but route all work-unit specifics through `src/lib/interop/work-unit-import.ts`:

- `parseWorkUnitReference()` for shared id validation and optional label extraction
- `collectWorkUnitRefsFromItems()` for gathering refs
- `provisionWorkUnitsForImport()` for pre-persist provisioning

Contributor guardrails:

- Do not read `WORK_UNIT_LABELS[...]` outside `src/lib/work-units.ts` and tests.
- Do not put work-unit business rules back into `work-unit-store.ts`.
- Do not duplicate import conflict/toggle UI when `WorkUnitImportPreviewPanel` fits the job.
