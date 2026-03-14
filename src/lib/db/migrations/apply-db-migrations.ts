import { openDB } from 'idb';
import { PROJECT_COLORS, type ActiveTimer } from '../../types';
import type { TimeTrackingDBSchema } from '../schema';

/** Legacy placeholder task ID - removed; migration cleans up any existing instances. */
const LEGACY_UNASSIGNED_TASK_ID = 'unassigned';

function renameField(record: Record<string, unknown>, from: string, to: string): boolean {
  if (!(from in record) || to in record) return false;
  record[to] = record[from];
  delete record[from];
  return true;
}

type OpenDbOptions = NonNullable<Parameters<typeof openDB<TimeTrackingDBSchema>>[2]>;
export type DbUpgradeCallback = NonNullable<OpenDbOptions['upgrade']>;

export const applyDbMigrations: DbUpgradeCallback = (
  db,
  oldVersion,
  _newVersion,
  transaction,
) => {
        // Version 1: Create all stores
        if (oldVersion < 1) {
          // Active timers store (multi-record, one per task)
          const timerStore = db.createObjectStore('activeTimers', { keyPath: 'id' });
          timerStore.createIndex('by-task', 'taskId', { unique: true });

          // Time entries store with indexes
          const entriesStore = db.createObjectStore('timeEntries', { keyPath: 'id' });
          entriesStore.createIndex('by-task', 'taskId');
          entriesStore.createIndex('by-sync-status', 'syncStatus');
          entriesStore.createIndex('by-startUtc', 'startUtc');

          // Tasks store with indexes
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('by-project', 'projectId');
          tasksStore.createIndex('by-parent', 'parentId');
          tasksStore.createIndex('by-status', 'status');

          // Projects store
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        type StoreKey = Extract<keyof TimeTrackingDBSchema, string>;
        const backfillStore = <StoreName extends StoreKey>(
          storeName: StoreName,
          mutate: (record: TimeTrackingDBSchema[StoreName]['value'], index: number) => boolean,
        ) => {
          const store = transaction.objectStore(storeName as never);
          store.getAll().then((records) => {
            records.forEach((record, index) => {
              if (mutate(record, index)) {
                store.put(record);
              }
            });
          });
        };

        // Version 2: Add color to existing projects
        if (oldVersion < 2) {
          backfillStore('projects', (project, index) => {
            const p = project as unknown as Record<string, unknown>;
            if (p.color) return false;
            p.color = PROJECT_COLORS[index % PROJECT_COLORS.length];
            return true;
          });
        }

        // Version 3: Remove legacy "Unassigned" placeholder task
        if (oldVersion < 3) {
          transaction.objectStore('tasks').delete(LEGACY_UNASSIGNED_TASK_ID);
        }

        // Version 5: Add taskNotes store
        if (oldVersion < 5) {
          const notesStore = db.createObjectStore('taskNotes', { keyPath: 'id' });
          notesStore.createIndex('by-task', 'taskId');
        }

        // Version 4: Add workers field to timeEntries and activeTimer
        if (oldVersion < 4 && oldVersion >= 1) {
          backfillStore('timeEntries', (entry) => {
            const e = entry as unknown as Record<string, unknown>;
            if (e.workers !== undefined) return false;
            e.workers = 1;
            return true;
          });
          // Only touch old activeTimer store if it exists (pre-v6)
          if (db.objectStoreNames.contains('activeTimer' as never)) {
            const timerStore = transaction.objectStore('activeTimer' as never);
            timerStore.getAll().then((timers: unknown[]) => {
              timers.forEach((timer) => {
                const t = timer as Record<string, unknown>;
                if (t.workers === undefined) {
                  t.workers = 1;
                  timerStore.put(timer);
                }
              });
            });
          }
        }

        // Version 6: Migrate singleton activeTimer → multi-record activeTimers store
        // Also add by-startUtc index on timeEntries
        if (oldVersion >= 1 && oldVersion < 6) {
          // Create new multi-record store
          const newTimerStore = db.createObjectStore('activeTimers', { keyPath: 'id' });
          newTimerStore.createIndex('by-task', 'taskId', { unique: true });

          // Migrate existing singleton timer if present
          if (db.objectStoreNames.contains('activeTimer' as never)) {
            const oldStore = transaction.objectStore('activeTimer' as never);
            oldStore.getAll().then((timers: unknown[]) => {
              const allTimers = timers as ActiveTimer[];
              if (allTimers.length > 0) {
                const existing = allTimers[0];
                const migrated: ActiveTimer = {
                  ...existing,
                  id: existing.taskId, // use taskId as id
                };
                newTimerStore.add(migrated);
              }
            });
            db.deleteObjectStore('activeTimer' as never);
          }

          // Add by-startUtc index to timeEntries
          const entriesStore = transaction.objectStore('timeEntries');
          if (!entriesStore.indexNames.contains('by-startUtc')) {
            entriesStore.createIndex('by-startUtc', 'startUtc');
          }
        }

        // Version 7: Add estimatedMinutes field to tasks
        if (oldVersion < 7 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.estimatedMinutes !== undefined) return false;
            t.estimatedMinutes = null;
            return true;
          });
        }

        // Version 8: Add workQuantity and workUnit fields to tasks
        if (oldVersion < 8 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.workQuantity !== undefined) return false;
            t.workQuantity = null;
            t.workUnit = null;
            return true;
          });
        }

        // Version 10: Add taskTemplates store
        if (oldVersion < 10) {
          if (!db.objectStoreNames.contains('taskTemplates')) {
            const templateStore = db.createObjectStore('taskTemplates', { keyPath: 'id' });
            templateStore.createIndex('by-phase', 'phase');
          }
        }

        // Version 9: Add crew field to tasks
        if (oldVersion < 9 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.crew !== undefined) return false;
            t.crew = null;
            return true;
          });
        }

        // Version 11: Add targetProductivity field to tasks
        if (oldVersion < 11 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.targetProductivity !== undefined) return false;
            t.targetProductivity = null;
            return true;
          });
        }

        // Version 13: Add attributionSnapshots store
        if (oldVersion < 13) {
          if (!db.objectStoreNames.contains('attributionSnapshots')) {
            db.createObjectStore('attributionSnapshots', { keyPath: 'id' });
          }
        }

        // Version 12: Add phase field to tasks
        if (oldVersion < 12 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.phase !== undefined) return false;
            t.phase = null;
            return true;
          });
        }

        // Version 14: Add archivedAt and archiveVersion fields to tasks
        if (oldVersion < 14 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.archivedAt !== undefined) return false;
            t.archivedAt = null;
            t.archiveVersion = null;
            return true;
          });
        }

        // Version 15: Add plans store for planning workspace
        if (oldVersion < 15) {
          db.createObjectStore('plans', { keyPath: 'id' });
        }

        // Version 16: Add workTypes store and workTypeId field.
        if (oldVersion < 16) {
          const workTypeStore = db.createObjectStore('workTypes', { keyPath: 'id' });
          workTypeStore.createIndex('by-title-unit-phase' as never, ['title', 'workUnit', 'phase'] as never);

          // Backfill workTypeId on existing templates
          if (db.objectStoreNames.contains('taskTemplates')) {
            backfillStore('taskTemplates', (template) => {
              const t = template as unknown as Record<string, unknown>;
              if (t.workTypeId !== undefined) return false;
              t.workTypeId = null;
              return true;
            });
          }

          // Backfill workTypeId on existing tasks
          if (oldVersion >= 1) {
            backfillStore('tasks', (task) => {
              const t = task as unknown as Record<string, unknown>;
              if (t.workTypeId !== undefined) return false;
              t.workTypeId = null;
              return true;
            });
          }
        }

        // Version 17: Add templateNotes store
        if (oldVersion < 17) {
          if (!db.objectStoreNames.contains('templateNotes')) {
            const templateNotesStore = db.createObjectStore('templateNotes', { keyPath: 'id' });
            templateNotesStore.createIndex('by-template', 'templateId');
          }
        }

        // Version 19: Add scheduledStart and scheduledEnd to plan line items
        if (oldVersion < 19 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            let changed = false;
            for (const item of plan.lineItems) {
              const i = item as unknown as Record<string, unknown>;
              if (i.scheduledStart === undefined) { i.scheduledStart = null; changed = true; }
              if (i.scheduledEnd === undefined) { i.scheduledEnd = null; changed = true; }
            }
            return changed;
          });
        }

        // Version 20: Add task lineage and KPI exclusion + plan reviewedAt
        if (oldVersion < 20) {
          if (oldVersion >= 1) {
            backfillStore('tasks', (task) => {
              const t = task as unknown as Record<string, unknown>;
              let changed = false;
              if (t.sourcePlanId === undefined) {
                t.sourcePlanId = null;
                changed = true;
              }
              if (t.sourceLineItemId === undefined) {
                t.sourceLineItemId = null;
                changed = true;
              }
              if (t.excludeFromKpi === undefined) {
                t.excludeFromKpi = false;
                changed = true;
              }
              return changed;
            });
          }
          if (db.objectStoreNames.contains('plans')) {
            backfillStore('plans', (plan) => {
              const p = plan as unknown as Record<string, unknown>;
              if (p.reviewedAt !== undefined) return false;
              p.reviewedAt = null;
              return true;
            });
          }
        }

        // Version 21: Add reviewNote field to plan line items
        if (oldVersion < 21 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            let changed = false;
            for (const item of plan.lineItems) {
              const i = item as unknown as Record<string, unknown>;
              if (i.reviewNote === undefined) {
                i.reviewNote = null;
                changed = true;
              }
            }
            return changed;
          });
        }

        // Version 18: Add projectId field to plans
        if (oldVersion < 18 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            const p = plan as unknown as Record<string, unknown>;
            if (p.projectId !== undefined) return false;
            p.projectId = null;
            return true;
          });
        }

        // Version 22: Migrate plan status 'locked' → 'active', lockedAt → activatedAt
        if (oldVersion < 22 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            const p = plan as unknown as Record<string, unknown>;
            let changed = false;
            if (p.status === 'locked') {
              p.status = 'active';
              changed = true;
            }
            if (p.lockedAt !== undefined) {
              p.activatedAt = p.lockedAt;
              delete p.lockedAt;
              changed = true;
            }
            if (p.activatedAt === undefined) {
              p.activatedAt = null;
              changed = true;
            }
            return changed;
          });
        }

        // Version 23: Backfill executor lifecycle fields and line-item execution annotations
        if (oldVersion < 23 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            const p = plan as unknown as Record<string, unknown>;
            let changed = false;

            if (p.importedAt === undefined) {
              p.importedAt = null;
              changed = true;
            }

            if (p.sessionClosedAt === undefined) {
              p.sessionClosedAt = null;
              changed = true;
            }

            if (p.reviewedAt != null && p.status !== 'reviewed' && p.status !== 'session-closed') {
              p.status = 'reviewed';
              changed = true;
            }

            for (const item of plan.lineItems) {
              const i = item as unknown as Record<string, unknown>;
              if (i.executionStatus === undefined) {
                i.executionStatus = 'pending';
                changed = true;
              }
              if (i.blockReason === undefined) {
                i.blockReason = null;
                changed = true;
              }
              if (i.blockCategory === undefined) {
                i.blockCategory = null;
                changed = true;
              }
              if (i.executorNote === undefined) {
                i.executorNote = null;
                changed = true;
              }
              if (i.deferredNote === undefined) {
                i.deferredNote = null;
                changed = true;
              }
              if (i.removedFromSource === undefined) {
                i.removedFromSource = false;
                changed = true;
              }
            }

            return changed;
          });
        }

        // Version 24: Add execution return import stores for planner-side wrap-up v2
        if (oldVersion < 24) {
          if (!db.objectStoreNames.contains('executionReturns')) {
            const store = db.createObjectStore('executionReturns', { keyPath: 'id' });
            store.createIndex('by-plan', 'planId');
            store.createIndex('by-imported-at', 'importedAt');
          }
          if (!db.objectStoreNames.contains('executionReturnLineItems')) {
            const store = db.createObjectStore('executionReturnLineItems', { keyPath: 'id' });
            store.createIndex('by-plan', 'planId');
            store.createIndex('by-return', 'executionReturnId');
            store.createIndex('by-imported-at', 'importedAt');
          }
          if (!db.objectStoreNames.contains('executionReturnUnplannedTasks')) {
            const store = db.createObjectStore('executionReturnUnplannedTasks', { keyPath: 'id' });
            store.createIndex('by-plan', 'planId');
            store.createIndex('by-return', 'executionReturnId');
            store.createIndex('by-imported-at', 'importedAt');
          }
        }

        // Version 25: Add scheduling/work-calendar and amendment metadata fields
        if (oldVersion < 25 && db.objectStoreNames.contains('plans')) {
          backfillStore('plans', (plan) => {
            const p = plan as unknown as Record<string, unknown>;
            let changed = false;

            if (p.eventStartDate === undefined) {
              p.eventStartDate = null;
              changed = true;
            }
            if (p.eventEndDate === undefined) {
              p.eventEndDate = null;
              changed = true;
            }
            if (p.defaultCrewSize === undefined) {
              p.defaultCrewSize = null;
              changed = true;
            }
            if (!Array.isArray(p.workCalendar)) {
              p.workCalendar = [];
              changed = true;
            }

            for (const item of plan.lineItems) {
              const i = item as unknown as Record<string, unknown>;
              if (i.originalScheduledStart === undefined) {
                i.originalScheduledStart = null;
                changed = true;
              }
              if (i.originalScheduledEnd === undefined) {
                i.originalScheduledEnd = null;
                changed = true;
              }
              if (i.amendmentNote === undefined) {
                i.amendmentNote = null;
                changed = true;
              }
              if (i.amendedAt === undefined) {
                i.amendedAt = null;
                changed = true;
              }
            }

            return changed;
          });
        }

        // Version 26: Rename task/template defaultWorkers -> crew
        if (oldVersion < 26) {
          if (oldVersion >= 1) {
            backfillStore('tasks', (task) => {
              const t = task as unknown as Record<string, unknown>;
              if (t.crew !== undefined) return false;
              t.crew = t.defaultWorkers ?? null;
              delete t.defaultWorkers;
              return true;
            });
          }
          if (db.objectStoreNames.contains('taskTemplates')) {
            backfillStore('taskTemplates', (template) => {
              const t = template as unknown as Record<string, unknown>;
              if (t.crew !== undefined) return false;
              t.crew = t.defaultWorkers ?? null;
              delete t.defaultWorkers;
              return true;
            });
          }
        }

        // Version 27: Rename task blockedReason -> blockReason
        if (oldVersion < 27 && oldVersion >= 1) {
          backfillStore('tasks', (task) => {
            const t = task as unknown as Record<string, unknown>;
            if (t.blockReason !== undefined) return false;
            t.blockReason = t.blockedReason ?? null;
            delete t.blockedReason;
            return true;
          });
        }

        // Version 28: Migrate WorkType from phase-specific to phase-agnostic with dual rates
        if (oldVersion < 28 && db.objectStoreNames.contains('workTypes')) {
          const wtStore = transaction.objectStore('workTypes');

          // Drop old 3-part index and create new 2-part index
          if (wtStore.indexNames.contains('by-title-unit-phase' as never)) {
            wtStore.deleteIndex('by-title-unit-phase' as never);
          }
          if (!wtStore.indexNames.contains('by-title-unit')) {
            wtStore.createIndex('by-title-unit', ['title', 'workUnit']);
          }

          // Merge paired work types (same title+unit, different phase) into single records
          wtStore.getAll().then((workTypes) => {
            // Group by normalized title + unit
            const groups = new Map<string, Array<Record<string, unknown>>>();
            for (const wt of workTypes) {
              const r = wt as unknown as Record<string, unknown>;
              const key = `${String(r.title ?? '').trim().toLowerCase()}:${String(r.workUnit ?? '')}`;
              const arr = groups.get(key) ?? [];
              arr.push(r);
              groups.set(key, arr);
            }

            for (const records of groups.values()) {
              if (records.length === 1) {
                // Single record — convert in place
                const r = records[0];
                const phase = r.phase === 'dismantle' ? 'dismantle' : r.phase === 'assembly' ? 'assembly' : null;
                const rate = (r.expectedProductivity as number) ?? 0;
                r.assemblyRate = phase === 'assembly' ? rate : 0;
                r.dismantleRate = phase === 'dismantle' ? rate : 0;
                delete r.phase;
                delete r.expectedProductivity;
                wtStore.put(r as never);
              } else {
                // Multiple records — merge into first, delete rest
                let assemblyRate = 0;
                let dismantleRate = 0;
                const primary = records[0];
                for (const r of records) {
                  const phase = r.phase === 'dismantle' ? 'dismantle' : r.phase === 'assembly' ? 'assembly' : null;
                  const rate = (r.expectedProductivity as number) ?? 0;
                  if (phase === 'assembly') assemblyRate = rate;
                  if (phase === 'dismantle') dismantleRate = rate;
                }
                primary.assemblyRate = assemblyRate;
                primary.dismantleRate = dismantleRate;
                delete primary.phase;
                delete primary.expectedProductivity;
                wtStore.put(primary as never);

                // Delete merged duplicates
                for (let i = 1; i < records.length; i++) {
                  wtStore.delete(records[i].id as string);
                }
              }
            }
          });
        }

        // Version 30: Rename persisted phase property from buildPhase -> phase.
        if (oldVersion < 30) {
          if (db.objectStoreNames.contains('tasks')) {
            backfillStore('tasks', (task) => {
              const t = task as unknown as Record<string, unknown>;
              return renameField(t, 'buildPhase', 'phase');
            });
          }

          if (db.objectStoreNames.contains('taskTemplates')) {
            const templateStore = transaction.objectStore('taskTemplates');
            if (templateStore.indexNames.contains('by-phase')) {
              templateStore.deleteIndex('by-phase');
            }
            templateStore.createIndex('by-phase', 'phase');

            backfillStore('taskTemplates', (template) => {
              const t = template as unknown as Record<string, unknown>;
              return renameField(t, 'buildPhase', 'phase');
            });
          }

          if (db.objectStoreNames.contains('executionReturnUnplannedTasks')) {
            backfillStore('executionReturnUnplannedTasks', (record) => {
              const task = record as unknown as Record<string, unknown>;
              return renameField(task, 'buildPhase', 'phase');
            });
          }
        }

        // Version 31: Backfill project phase/event dates.
        if (oldVersion < 31 && db.objectStoreNames.contains('projects')) {
          backfillStore('projects', (project) => {
            const p = project as unknown as Record<string, unknown>;
            let changed = false;
            if (p.assemblyStartDate === undefined) {
              p.assemblyStartDate = null;
              changed = true;
            }
            if (p.assemblyEndDate === undefined) {
              p.assemblyEndDate = null;
              changed = true;
            }
            if (p.dismantleStartDate === undefined) {
              p.dismantleStartDate = null;
              changed = true;
            }
            if (p.dismantleEndDate === undefined) {
              p.dismantleEndDate = null;
              changed = true;
            }
            if (p.eventStartDate === undefined) {
              p.eventStartDate = null;
              changed = true;
            }
            if (p.eventEndDate === undefined) {
              p.eventEndDate = null;
              changed = true;
            }
            return changed;
          });
        }
};
