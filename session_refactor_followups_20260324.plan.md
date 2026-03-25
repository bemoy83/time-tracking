---
name: Session refactor follow-ups
overview: Handoff document capturing non-urgent refactor candidates surfaced during the Today View, Field Plan, and Task Detail cleanup work on 2026-03-24. Intended for a later session so these opportunities do not get lost.
todos:
  - id: completion-flow-unify
    content: Evaluate converging useTaskDetail completion logic with useCompletionFlow shared list completion behavior
    status: pending
  - id: taskdetail-perf-investigation
    content: Profile TaskDetail time/productivity hooks before any scoped useTaskTimes or attribution refactor
    status: pending
  - id: field-plan-row-api
    content: Revisit FieldPlanLineItemRow canExecute prop duplication vs lineItem.planCanExecute
    status: pending
  - id: attributed-refresh-stability
    content: Optionally stabilize useAttributedPersonHours refresh identity if effect churn becomes measurable
    status: pending
isProject: false
---

# Refactor Handoff: Follow-ups From 2026-03-24

## Summary

This document captures refactor candidates that surfaced while implementing targeted cleanup work in:

- `TodayView`
- `FieldPlan`
- `TaskDetail`

None of these were urgent enough to justify widening the delivery scope during the session, but they are real follow-up opportunities. The goal here is to preserve context, tradeoffs, and recommended order so the next session can start from a decision-ready baseline instead of re-discovering the same issues.

---

## Priority order

### 1. Completion-flow duplication in Task Detail vs list views

**Why it surfaced**

- `[src/lib/hooks/useTaskDetail.ts](src/lib/hooks/useTaskDetail.ts)` contains its own parent/subtask completion state machine.
- `[src/lib/hooks/useCompletionFlow.ts](src/lib/hooks/useCompletionFlow.ts)` contains the same product behavior for Today/Project list flows.

**Why it matters**

- Product-rule changes to completion/prompt/undo behavior currently require edits in two places.
- This is the clearest medium-sized architectural duplication seen during the session.

**Why it was deferred**

- There is no existing Task Detail test surface.
- The current cleanup work did not change completion behavior.
- Refactoring this without a product change or stronger tests would increase regression risk.

**Recommended next session**

- First add narrow behavioral tests around the shared completion rules.
- Then decide whether to:
  - extract shared pure helpers used by both hooks, or
  - generalize `useCompletionFlow` to support Task Detail.

**Success criteria**

- One source of truth for parent/subtask completion decisions.
- No behavior drift between Task Detail, Today, and Project Detail.

---

### 2. Task Detail time/productivity performance investigation

**Why it surfaced**

Task Detail currently depends on broad task-store inputs in multiple places:

- `[src/lib/hooks/useTaskDetail.ts](src/lib/hooks/useTaskDetail.ts)` uses `useTaskTimes(tasks, activeTimers)`
- `[src/lib/hooks/useTaskTimeBreakdown.ts](src/lib/hooks/useTaskTimeBreakdown.ts)` derives a `taskKey` from all tasks
- `[src/lib/hooks/useAttributedPersonHours.ts](src/lib/hooks/useAttributedPersonHours.ts)` also derives a `taskKey` from all tasks

**Why it matters**

- There may be redundant recomputation when opening Task Detail for large datasets.
- This is the most likely performance hotspot in the slice, but not yet proven.

**Why it was deferred**

- Profiling was not done this session.
- Refactoring `useTaskTimes` alone may not materially help if the heavier work is actually in attribution/time-breakdown hooks.

**Recommended next session**

- Measure first.
- Add lightweight dev timings or use React Profiler on Task Detail open / time-entry edits / subtask changes.
- If a hotspot is confirmed, evaluate one of:
  - subtree-scoped time maps for subtask rows,
  - narrower dependency keys for Task Detail hooks,
  - shared cached task-subtree selectors for attribution/time breakdown.

**Do not do first**

- Do not start by rewriting `useTaskTimes` in isolation without evidence.

---

### 3. Field Plan row API duplication

**Why it surfaced**

- `[src/pages/field-plan/components/FieldPlanLineItemRow.tsx](src/pages/field-plan/components/FieldPlanLineItemRow.tsx)` still receives `canExecute` as a prop.
- The same execution eligibility already exists on `lineItem.planCanExecute`.

**Why it matters**

- The current API works, but it carries an avoidable invariant between parent props and row data.
- It is easy for a future caller to drift if they pass a mismatched value.

**Why it was deferred**

- The session’s field-plan work only needed eligibility unification, not a public row API refactor.
- Removing the prop would create broader churn across row call sites for little immediate product value.

**Recommended next session**

- When touching Field Plan row composition again, consider collapsing execution gating to `lineItem` only.
- If done, update both by-plan and by-phase call sites in the same change.

**Success criteria**

- `FieldPlanLineItemRow` derives execution state from one source.
- Parents no longer need to maintain a consistency invariant manually.

---

### 4. `useAttributedPersonHours` refresh identity stability

**Why it surfaced**

- `[src/components/TaskProductivity.tsx](src/components/TaskProductivity.tsx)` was fixed this session to register `onAttributedRefresh` in an effect instead of during render.
- `[src/lib/hooks/useAttributedPersonHours.ts](src/lib/hooks/useAttributedPersonHours.ts)` still returns a freshly created `refresh` function on each render.

**Why it matters**

- React purity is now fixed.
- There may still be benign effect churn because `refresh` identity is not stable.

**Why it was deferred**

- This is not a correctness bug.
- No evidence yet that the effect churn is measurable or user-visible.

**Recommended next session**

- Only touch this if profiling or debugging shows it matters.
- Likely solution: wrap `refresh` / `fetchAttributed` in `useCallback` with stable dependencies.

---

## Explicit non-follow-ups

These came up indirectly but should **not** be treated as current refactor work:

- `TodayView` model extraction already landed; no further architecture action is needed unless a new Today feature appears.
- Field Plan metrics/filter semantics were intentionally left as documentation-only; changing header/filter behavior is a product decision, not a cleanup refactor.
- Task Detail completion unification should not be combined with performance work in the same pass.

---

## Recommended next-session order

1. Decide whether the next session is about **behavior unification** or **performance investigation**.
2. If behavior: tackle completion-flow duplication first, with tests.
3. If performance: measure Task Detail before changing any time hooks.
4. Treat Field Plan row API cleanup as opportunistic refactor work, not a top priority.

---

## Suggested prompt for the next session

“Open `.cursor/plans/session_refactor_followups_20260324.plan.md` and assess the highest-ROI next refactor. Start by validating whether completion-flow unification or Task Detail performance investigation should go first, based on current code and test coverage.”