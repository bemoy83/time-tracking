# Field Operations Workspace
## Product Overview & Development Status
**March 2026**

---

## 1. What This Is

A planning and execution workspace for exhibition and trade fair assembly/dismantle operations. It serves two distinct users with a structured handoff workflow between them.

### The Two-User Model

**Planner** — office or site manager, desktop-first
- Creates work packages for upcoming events
- Defines scope: work types, quantities, crew, phase schedules
- Exports plan packages to field operators
- Reviews execution returns and refines productivity benchmarks

**Field Operator** — floor manager, mobile-first
- Receives plan packages on their device
- Executes work: starts timers, logs time, marks tasks blocked or complete
- Works offline in unstable connectivity environments
- Exports execution returns back to the planner

The handoff is peer-to-peer via versioned JSON packages — no server required.

---

## 2. Background

The company manages assembly and dismantle work for large-scale exhibitions and events. Each event involves numerous vendor booths requiring delivery and installation of materials: carpet tiles, booth walls, furniture.

**The core problem:** labor efficiency was tracked manually and inconsistently, making it difficult to:
- Accurately estimate future staffing needs
- Measure productivity per crew member
- Identify inefficiencies across work categories

The app introduces quantifiable task tracking integrated with time and personnel data, building a historical foundation for labor planning and performance analytics.

---

## 3. Architecture

### Tech Stack
- **React 18 + TypeScript** — UI
- **Vite + PWA plugin** — build, offline capability
- **IndexedDB (idb)** — all data stored locally, offline-first
- **Custom store pattern** (`useSyncExternalStore`) — reactive state, no external state library

### Key Decisions

**No server** — IndexedDB-first. Peer-to-peer data transfer via JSON plan packages and execution returns. Server sync infrastructure exists but is not enabled.

**All time computed from UTC timestamps** — no stored durations, no clock drift. Elapsed time is always derived fresh from `startUtc`/`endUtc` pairs.

**WorkType is the only classification model** — no categories, no tags, no freeform grouping. All analytics flow through WorkType.

---

## 4. Core Data Model

```
WorkType (canonical classification)
├── title, workUnit (m²|m|pcs|orders)
├── assemblyRate, dismantleRate  (units/person-hour)
└── readOnly flag  (for plan-scoped imported types)

Task
├── title, status (active|completed|blocked), blockReason
├── workQuantity, workUnit, workTypeId → WorkType
├── crew, estimatedMinutes, phase
├── parentId → Task  (one level deep only)
├── projectId → Project
├── sourcePlanId, sourceLineItemId  (plan lineage)
└── archivedAt, excludeFromKpi

TimeEntry
├── taskId → Task
├── startUtc, endUtc  (ISO 8601 UTC)
├── workers  (crew size at time of entry)
└── source  (manual|resumed|logged)

Plan
├── projectId, title, status
├── lineItems[]  → PlanLineItem
└── workCalendar[]  (dates, access windows, crew overrides)

PlanLineItem
├── workTypeId, workQuantity, dismantleQuantity
├── Assembly: rate, crew, hours, scheduled dates, crew by date, execution state
├── Dismantle: rate, crew, hours, scheduled dates, crew by date, execution state
└── shared notes and amendment metadata
```

Person-hours = duration (hours) × workers — consistent everywhere.

---

## 5. Feature Status

### Execution (Field Operator)

| Feature | Status |
|---|---|
| One-tap timer start/stop | ✅ Live |
| Parallel timers (multiple tasks simultaneously) | ✅ Live (flagged) |
| Task hierarchy — one-level subtasks | ✅ Live |
| Blocked task state with reason | ✅ Live |
| Swipe gestures + long-press fallback | ✅ Live |
| Offline operation | ✅ Live |
| Manual time entry | ✅ Live |
| Budget status (green/amber/red vs estimate) | ✅ Live |
| Task archive with integrity check | ✅ Live |
| Append-only task notes with audit trail | ✅ Live |
| Field Plan import (receive plan package) | ✅ Live (flagged) |
| Execution return export | ✅ Live (flagged) |

### Planning (Planner)

| Feature | Status |
|---|---|
| Work package editor with line items | ✅ Live |
| Dual-phase support (assembly / dismantle) | ✅ Live |
| Work calendar with crew-by-day and access windows | ✅ Live |
| Plan state machine | ✅ Live |
| Plan package export | ✅ Live |
| Execution return import and review | ✅ Live |
| Desktop dual-pane workspace | ✅ Live (flagged) |
| Schedule grid view | ✅ Live (flagged) |
| Progress view | ✅ Live |
| Insights view | ✅ Live |

### Productivity & Analytics

| Feature | Status |
|---|---|
| KPI engine — avg productivity per WorkType | ✅ Live |
| Confidence levels (insufficient / low / medium / high) | ✅ Live |
| Outlier detection (IQR method) | ✅ Live |
| Stability metric (coefficient of variation) | ✅ Live |
| Productivity calculator | ✅ Live |
| Multi-scenario calculator cards | ✅ Live (flagged) |
| Attribution engine | ✅ Live |
| Attribution policy (strict / soft) | ✅ Live |
| Attribution remediation tools | ✅ Live |

### Configuration & Data Management

| Feature | Status |
|---|---|
| WorkType library | ✅ Live |
| Task template library | ✅ Live |
| CSV import/export | ✅ Live |
| JSON backup/restore | ✅ Live |
| Telemetry (local aggregate event counters) | ✅ Live |
| Server sync | 🔲 Infrastructure built, not enabled |

---

## 6. Plan Lifecycle

```
Planner:   draft → active → reviewed
                                 ↓  export package
Executor:              received → session-closed
                                 ↓  export return
Planner:   ← import return, review, archive
```

Work types embedded in a plan package are imported as read-only on the executor device, scoped to that plan. Tasks released from a plan carry `sourcePlanId` and `sourceLineItemId` for full traceability.

---

## 7. Productivity Model

```
Productivity  =  Quantity ÷ Person-Hours
Person-Hours  =  Duration (hours) × Workers
```

WorkType rates (units/person-hour) are maintained separately for assembly and dismantle phases.

The KPI engine groups completed, archived tasks by WorkType and computes:
- Average achieved productivity
- Sample count with confidence classification: insufficient (n < 3), low (3–4), medium (5–9), high (≥ 10)
- Outlier detection via IQR
- Stability metric via coefficient of variation

These rates feed the calculator, which solves for crew size or time given quantity and a productivity rate.

---

## 8. Attribution Engine

Time entries logged against non-measurable tasks are attributed to measurable owners via a deterministic, snapshot-cached engine.

**Heuristic ranking (descending priority):**
1. Exact WorkType ID match
2. Matching unit + phase
3. Nearest measurable task within project scope
4. Unattributed

**Attribution policies:**
- `strict_block` — unattributed entries block archival
- `soft_allow_flag` — archival proceeds, entry flagged for review
- `soft_allow_pick_nearest` — nearest heuristic auto-applied

Snapshots are cached with `computedAt` timestamp and engine version. Attribution reassignments append an `[AUDIT]` note — immutable, never deleted.

---

## 9. Design Principles

**Two surfaces, two priorities**
The Today view (field operator) must stay fast, glanceable, and one-handed friendly. The planning workspace is designed for wide screens and deliberate work. Neither degrades the other.

**WorkType is the only classification model**
No categories, no tags. `findWorkTypeByKey(title, unit)` is the canonical lookup. Do not introduce `workCategory` or equivalent.

**Offline first, server optional**
The app must function fully without connectivity. Server sync is a future enhancement, not a current dependency.

**Timestamps over durations**
All time stored as UTC start/end pairs. Elapsed time is always computed. No stored durations.

**Append-only notes**
Task and template notes have no `updatedAt`. `[AUDIT]`-prefixed notes are programmatically generated and never modified.

**Templates accelerate, never enforce**
Templates pre-fill fields at task creation. The resulting task is indistinguishable from any manually created task.

---

## 10. Active Feature Flags / Toggles

| Flag | Feature |
|---|---|
| `parallelTimers` | Multiple simultaneous task timers |
| `wrapUpReviewV2` | Updated wrap-up review flow |

Planning workspace is dual-pane on desktop (wide screens only). Hidden on smaller screens. No toggle.
