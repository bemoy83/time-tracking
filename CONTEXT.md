# TodoApp — Project Context & Technical Constraints

**Mobile-First · Offline-Resilient · Timer-Critical · Zero Paid Libraries**

---

## Purpose

This repository contains a **mobile-first Progressive Web App (PWA)** for **on-site time tracking** during **build-up and tear-down of exhibitions and trade fairs**.

Primary user:

* Floor manager
* Constant movement
* One-handed phone usage
* Poor or unstable connectivity
* Frequent interruptions

Primary goal:

* Track time accurately
* Never lose time data
* Minimize interaction friction

This app must behave like a **reliable work tool**, not a demo or experiment.

---

## Constraint Declaration (Non-Negotiable)

This is a **private, unpaid hobby project used at work**.

**Hard constraints:**

* ❌ No paid libraries
* ❌ No per-seat SaaS tools
* ❌ No usage-based APIs with hidden costs
* ❌ No vendor lock-in
* ✅ Open-source libraries only
* ✅ Native Web APIs preferred
* ✅ Self-hostable backend (optional)

All architectural and tooling decisions **must respect these constraints**.

---

## Platform Goals

The app must:

* Be mobile-first
* Be installable as a PWA
* Work offline
* Support long-running active timers
* Feel reliable under real-world pressure

Mobile phones are the **primary device**.
Desktop is secondary (review / planning only).

---

## PWA Core Requirements

### Installability

* Standards-compliant Web App Manifest
* Installable on iOS Safari and Android Chrome
* Standalone display mode
* No third-party install SDKs

---

### Offline Capability (Critical)

The app **must track time fully offline**.

Required behaviors:

* Start / stop timers without network
* Persist active timer state locally
* Queue time entries for later sync
* Resume timers after reload, crash, or OS eviction
* Prevent duplicate or overlapping sessions

Storage:

* IndexedDB (native or small OSS helper)
* Local persistence for tasks, projects, timers, and unsynced entries

---

## Service Worker Requirements

Responsibilities:

* Cache static assets
* Enable offline startup
* Intercept API requests
* Queue offline mutations
* Sync on reconnect

Caching strategy:

* Static assets: cache-first
* API reads: stale-while-revalidate
* API writes: network-first with offline fallback

No paid background or push services.

---

## Timer System (Mission-Critical)

Timer data model:

* Task ID
* Start timestamp (UTC)
* End timestamp (nullable)
* Source (manual / resumed)
* Sync status

Rules:

* Only one active timer per user
* Timer start blocked on blocked tasks
* Timer stop always allowed
* Timers survive reload, backgrounding, and offline use

Accuracy:

* Time calculated from timestamps only
* No reliance on `setInterval`
* UI timers are display-only
* Elapsed time recalculated on resume

---

## Frontend Architecture

* Open-source framework only
* TypeScript preferred
* IndexedDB for persistence
* Service Worker required
* Local-first state model
* Minimal backend unless clearly needed

State rules:

* Normalized entities
* Derived relationships
* No cached nested objects
* Query-driven recomputation

---

## Mobile Interaction Constraints

* Minimum 44px tap targets
* Full-width primary actions
* Sticky bottom timer controls
* Thumb-reachable UI
* Swipe actions with long-press fallback
* No gesture-only critical actions

---

## Accessibility & Field Conditions

* High contrast support
* Large readable typography
* Reduce motion support
* Clear visual states (not color-only)
* Usable in bright exhibition halls

---

## Non-Negotiable Rules

* **No paid libraries**
* **No silent time loss**
* **Offline-first**
* **Mobile-first**
* **Accuracy over convenience**

---

This file is the **source of truth** for this project.
Any AI agent or contributor must follow it.
