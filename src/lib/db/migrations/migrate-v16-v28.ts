import type { MigrationContext } from './migration-helpers';
import { backfillStore } from './migration-helpers';

export async function migrateV16ToV28({
  db,
  oldVersion,
  transaction,
}: MigrationContext): Promise<void> {
  if (oldVersion < 16) {
    const workTypeStore = db.createObjectStore('workTypes', { keyPath: 'id' });
    workTypeStore.createIndex('by-title-unit-phase' as never, ['title', 'workUnit', 'phase'] as never);

    if (db.objectStoreNames.contains('taskTemplates')) {
      await backfillStore(transaction, 'taskTemplates', (template) => {
        const t = template as unknown as Record<string, unknown>;
        if (t.workTypeId !== undefined) return false;
        t.workTypeId = null;
        return true;
      });
    }

    if (oldVersion >= 1) {
      await backfillStore(transaction, 'tasks', (task) => {
        const t = task as unknown as Record<string, unknown>;
        if (t.workTypeId !== undefined) return false;
        t.workTypeId = null;
        return true;
      });
    }
  }

  if (oldVersion < 17) {
    if (!db.objectStoreNames.contains('templateNotes')) {
      const templateNotesStore = db.createObjectStore('templateNotes', { keyPath: 'id' });
      templateNotesStore.createIndex('by-template', 'templateId');
    }
  }

  if (oldVersion < 19 && db.objectStoreNames.contains('plans')) {
    await backfillStore(transaction, 'plans', (plan) => {
      let changed = false;
      for (const item of plan.lineItems) {
        const i = item as unknown as Record<string, unknown>;
        if (i.scheduledStart === undefined) {
          i.scheduledStart = null;
          changed = true;
        }
        if (i.scheduledEnd === undefined) {
          i.scheduledEnd = null;
          changed = true;
        }
      }
      return changed;
    });
  }

  if (oldVersion < 20) {
    if (oldVersion >= 1) {
      await backfillStore(transaction, 'tasks', (task) => {
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
      await backfillStore(transaction, 'plans', (plan) => {
        const p = plan as unknown as Record<string, unknown>;
        if (p.reviewedAt !== undefined) return false;
        p.reviewedAt = null;
        return true;
      });
    }
  }

  if (oldVersion < 21 && db.objectStoreNames.contains('plans')) {
    await backfillStore(transaction, 'plans', (plan) => {
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

  if (oldVersion < 18 && db.objectStoreNames.contains('plans')) {
    await backfillStore(transaction, 'plans', (plan) => {
      const p = plan as unknown as Record<string, unknown>;
      if (p.projectId !== undefined) return false;
      p.projectId = null;
      return true;
    });
  }

  if (oldVersion < 22 && db.objectStoreNames.contains('plans')) {
    await backfillStore(transaction, 'plans', (plan) => {
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

  if (oldVersion < 23 && db.objectStoreNames.contains('plans')) {
    await backfillStore(transaction, 'plans', (plan) => {
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

  if (oldVersion < 25 && db.objectStoreNames.contains('plans')) {
    await backfillStore(transaction, 'plans', (plan) => {
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

  if (oldVersion < 26) {
    if (oldVersion >= 1) {
      await backfillStore(transaction, 'tasks', (task) => {
        const t = task as unknown as Record<string, unknown>;
        if (t.crew !== undefined) return false;
        t.crew = t.defaultWorkers ?? null;
        delete t.defaultWorkers;
        return true;
      });
    }
    if (db.objectStoreNames.contains('taskTemplates')) {
      await backfillStore(transaction, 'taskTemplates', (template) => {
        const t = template as unknown as Record<string, unknown>;
        if (t.crew !== undefined) return false;
        t.crew = t.defaultWorkers ?? null;
        delete t.defaultWorkers;
        return true;
      });
    }
  }

  if (oldVersion < 27 && oldVersion >= 1) {
    await backfillStore(transaction, 'tasks', (task) => {
      const t = task as unknown as Record<string, unknown>;
      if (t.blockReason !== undefined) return false;
      t.blockReason = t.blockedReason ?? null;
      delete t.blockedReason;
      return true;
    });
  }

  if (oldVersion < 28 && db.objectStoreNames.contains('workTypes')) {
    const wtStore = transaction.objectStore('workTypes');

    if (wtStore.indexNames.contains('by-title-unit-phase' as never)) {
      wtStore.deleteIndex('by-title-unit-phase' as never);
    }
    if (!wtStore.indexNames.contains('by-title-unit')) {
      wtStore.createIndex('by-title-unit', ['title', 'workUnit']);
    }

    const workTypes = await wtStore.getAll();
    const groups = new Map<string, Array<Record<string, unknown>>>();

    for (const wt of workTypes) {
      const record = wt as unknown as Record<string, unknown>;
      const key = `${String(record.title ?? '').trim().toLowerCase()}:${String(record.workUnit ?? '')}`;
      const records = groups.get(key) ?? [];
      records.push(record);
      groups.set(key, records);
    }

    for (const records of groups.values()) {
      if (records.length === 1) {
        const record = records[0];
        const phase = record.phase === 'dismantle'
          ? 'dismantle'
          : record.phase === 'assembly'
            ? 'assembly'
            : null;
        const rate = (record.expectedProductivity as number) ?? 0;
        record.assemblyRate = phase === 'assembly' ? rate : 0;
        record.dismantleRate = phase === 'dismantle' ? rate : 0;
        delete record.phase;
        delete record.expectedProductivity;
        await wtStore.put(record as never);
        continue;
      }

      let assemblyRate = 0;
      let dismantleRate = 0;
      const primary = records[0];

      for (const record of records) {
        const phase = record.phase === 'dismantle'
          ? 'dismantle'
          : record.phase === 'assembly'
            ? 'assembly'
            : null;
        const rate = (record.expectedProductivity as number) ?? 0;
        if (phase === 'assembly') assemblyRate = rate;
        if (phase === 'dismantle') dismantleRate = rate;
      }

      primary.assemblyRate = assemblyRate;
      primary.dismantleRate = dismantleRate;
      delete primary.phase;
      delete primary.expectedProductivity;
      await wtStore.put(primary as never);

      for (let index = 1; index < records.length; index += 1) {
        await wtStore.delete(records[index].id as string);
      }
    }
  }
}
