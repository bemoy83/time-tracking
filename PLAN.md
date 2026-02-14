# TodoApp — Mobile-First Web Mission Plan

**(Optimized for On-Site Time Tracking & Floor Management)**

---

## 1. Product Mission (Revised)

TodoApp is a **mobile-first web application** designed for **real-time work tracking in physical environments**, where attention is fragmented and speed matters more than precision UI.

Its primary mission is to let a floor manager:

* Start and stop time instantly
* See what is blocked or ready *at a glance*
* Track work across crews, zones, or phases
* Make progress visible without stopping work

The app must work **one-handed, under pressure, on a phone**, with minimal cognitive load.

---

## 2. Primary Use Context

**User Environment**

* On the exhibition floor
* Gloves, dust, noise, interruptions
* Frequent task switching
* Limited time to “manage the app”

**Key Implication**

> Every interaction must be fast, forgiving, and obvious —
> *no hunting, no dense screens, no precision taps.*

---

## 3. Mobile-First Product Pillars

### 3.1 Time Tracking Is the Primary Action

Time tracking is not a feature — it is the *main workflow*.

**Design Rules**

* Start/stop timer must be reachable within **one tap**
* Timer controls must be:

  * Large
  * High contrast
  * Always visible on task detail
* Active timer state must be unmistakable (color + motion)

**Mobile Optimization**

* Sticky bottom timer controls
* Full-width buttons (thumb-friendly)
* Visual “recording” state visible even when scrolling

---

### 3.2 Tasks as Work Units, Not Admin Objects

Tasks represent **physical work being done** (rigging, lighting, booth assembly, teardown).

**Implications**

* Task titles must be scannable
* Status must be visually encoded (color > text)
* Blocked tasks must clearly explain *why* they’re blocked
* Completion should require minimal confirmation

---

### 3.3 Hierarchy Without Navigation Depth

Task hierarchy exists, but **navigation depth must stay shallow**.

**Rules**

* One-level subtasks only
* Inline expansion instead of drill-down where possible
* Parent tasks show:

  * Subtask completion
  * Aggregated time
  * Current active work indicator

**Mobile Goal**

> Never force the user to “go back” more than one level.

---

## 4. Mobile-First UX Strategy

### 4.1 View Priority Order

1. **Today / Active Work**
2. **Project / Event Phase**
3. **Task Detail (timer-focused)**

List views are optimized for **glanceability**, not editing.

---

### 4.2 List Views (Primary Surface)

**Optimized For**

* One-handed scrolling
* Fast scanning
* Quick timer access

**Design Characteristics**

* Compact rows
* High-contrast progress bars
* Minimal metadata (only what matters *now*)
* Inline subtask expansion
* Swipe gestures for:

  * Complete
  * Start/stop timer
  * Quick actions

---

### 4.3 Task Detail Views (Secondary Surface)

**Purpose**

* Start/stop time
* Understand blockers
* Adjust estimates if needed

**Structure**

* Large title
* Prominent status section
* Timer controls always visible
* Secondary data collapsible by default

**Mobile Rule**

> Editing exists, but never blocks timing.

---

## 5. Time & Progress (Mobile Adaptation)

### 5.1 Time Precision Strategy

* **Live tracking:** second precision (internal)
* **Display:** rounded, readable values
* **Floor-friendly formatting:**

  * “1h 45m”
  * “12m left”
  * “Over by 25m”

No small text. No dense tables.

---

### 5.2 Progress Visualization

* Always visible when relevant
* Color-first communication
* Animations subtle but noticeable
* Percentages secondary to bar + color

---

## 6. Interaction Model (Mobile)

### 6.1 One-Handed Rules

* All primary actions reachable by thumb
* No top-only critical buttons
* No tiny icons as sole affordances
* No modal-heavy flows during active timing

---

### 6.2 Error Tolerance

* Prevent invalid actions instead of warning
* Clear disabled states (blocked tasks)
* Undo-friendly destructive actions
* Optimistic UI for all timer actions

---

## 7. Web Architecture (Mobile-Driven)

### 7.1 Frontend

**Requirements**

* Mobile-first responsive layout
* PWA-ready (offline tolerance for spotty signal)
* Fast startup on cold load
* No heavy initial data fetch

**Key Patterns**

* Query-driven state
* Derived relationships, never cached
* Background sync for time entries

---

### 7.2 Offline & Reliability

**Critical**

* Timer must not break if connectivity drops
* Time entries cached locally
* Server reconciliation on reconnect
* Conflict-safe aggregation

> Losing tracked time is unacceptable.

---

## 8. Accessibility in Physical Environments

* High contrast mode
* Large tap targets (44px+ minimum)
* Clear visual states (not color-only)
* Reduce motion option
* Readable in bright light

---

## 9. Deployment Goals

* Mobile web first (phone-sized view drives design)
* Desktop as secondary (planning/review)
* PWA installable on iOS & Android
* API-first backend for future native app if needed

---

## 10. Success Criteria (Revised)

The app succeeds if:

* A floor manager can start tracking time **in under 1 second**
* Active work is visible without navigating
* Blocked work is immediately understandable
* The app survives poor signal conditions
* The UI stays calm during chaotic workdays

---

**This is a work companion, not a planner.
It must disappear while the work happens — and be perfect when needed.**
