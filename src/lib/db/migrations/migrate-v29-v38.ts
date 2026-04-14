import { buildSeededWorkUnitDefinitions } from '../../types';
import type { MigrationContext } from './migration-helpers';
import {
  accessHoursForDay,
  backfillStore,
  listDateRange,
  renameField,
} from './migration-helpers';

export async function migrateV29ToV38({
  db,
  oldVersion,
  transaction,
}: MigrationContext): Promise<void> {
  if (oldVersion < 30) {
    if (db.objectStoreNames.contains('tasks')) {
      await backfillStore(transaction, 'tasks', (task) => {
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

      await backfillStore(transaction, 'taskTemplates', (template) => {
        const t = template as unknown as Record<string, unknown>;
        return renameField(t, 'buildPhase', 'phase');
      });
    }

    if (db.objectStoreNames.contains('executionReturnUnplannedTasks')) {
      await backfillStore(transaction, 'executionReturnUnplannedTasks', (record) => {
        const task = record as unknown as Record<string, unknown>;
        return renameField(task, 'buildPhase', 'phase');
      });
    }
  }

  if (oldVersion < 31 && db.objectStoreNames.contains('projects')) {
    await backfillStore(transaction, 'projects', (project) => {
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

  if (oldVersion < 32 && db.objectStoreNames.contains('plans')) {
    await backfillStore(transaction, 'plans', (plan) => {
      const p = plan as unknown as Record<string, unknown>;
      const workCalendar = Array.isArray(p.workCalendar)
        ? (p.workCalendar as Array<Record<string, unknown>>)
        : [];
      const dayByDate = new Map(workCalendar.map((day) => [String(day.date ?? ''), day]));
      let changed = false;

      for (const item of plan.lineItems) {
        const record = item as unknown as Record<string, unknown>;
        for (const prefix of ['assembly', 'dismantle'] as const) {
          const personHoursKey = `${prefix}PersonHoursByDate`;
          const crewByDateKey = `${prefix}CrewByDate`;
          const scheduledStartKey = `${prefix}ScheduledStart`;
          const scheduledEndKey = `${prefix}ScheduledEnd`;
          if (record[personHoursKey] !== undefined) continue;

          const start = typeof record[scheduledStartKey] === 'string' ? String(record[scheduledStartKey]) : null;
          const end = typeof record[scheduledEndKey] === 'string' ? String(record[scheduledEndKey]) : null;
          const rate = Number(record[`${prefix}Rate`] ?? 0);
          const crew = Number(record[`${prefix}Crew`] ?? 0);
          const timeHours = Number(record[`${prefix}TimeHours`] ?? 0);
          const quantity = prefix === 'dismantle'
            ? Number(record.dismantleQuantity ?? record.workQuantity ?? 0)
            : Number(record.workQuantity ?? 0);
          const requiredPH = timeHours > 0 && crew > 0
            ? timeHours * crew
            : rate > 0 && quantity > 0
              ? quantity / rate
              : null;
          const legacy = record[crewByDateKey] && typeof record[crewByDateKey] === 'object'
            ? (record[crewByDateKey] as Record<string, unknown>)
            : undefined;
          const migrated: Record<string, number> = {};
          let remaining = requiredPH ?? 0;

          if (start && end && requiredPH != null && requiredPH > 0) {
            for (const date of listDateRange(start, end)) {
              const day = dayByDate.get(date);
              if (day && day.isWorkDay === false) continue;
              const legacyCrew = Number((legacy?.[date] ?? crew) ?? 0);
              const dayCap = Math.max(0, legacyCrew * accessHoursForDay(day));
              const assigned = Math.min(remaining, dayCap);
              if (assigned > 0) {
                migrated[date] = Number(assigned.toFixed(2));
                remaining -= assigned;
              }
              if (remaining <= 0.01) break;
            }
          }

          record[personHoursKey] = Object.keys(migrated).length > 0 ? migrated : undefined;
          const dates = Object.keys(migrated).sort();
          record[scheduledStartKey] = dates.length > 0 ? dates[0] : null;
          record[scheduledEndKey] = dates.length > 0 ? dates[dates.length - 1] : null;
          delete record[crewByDateKey];
          changed = true;
        }
      }

      return changed;
    });
  }

  if (oldVersion < 33) {
    const now = new Date().toISOString();
    const seeds = buildSeededWorkUnitDefinitions(now);

    if (!db.objectStoreNames.contains('workUnitDefinitions')) {
      const store = db.createObjectStore('workUnitDefinitions', { keyPath: 'id' });
      store.createIndex('by-sort-index', 'sortIndex');

      for (const definition of seeds) {
        await store.put(definition);
      }
    } else {
      const store = transaction.objectStore('workUnitDefinitions');
      const definitions = await store.getAll();
      const existingById = new Map(
        definitions.map((definition) => [String(definition.id), definition as unknown as Record<string, unknown>]),
      );

      for (const [index, seed] of seeds.entries()) {
        const existing = existingById.get(seed.id);
        if (!existing) {
          await store.put(seed as never);
          continue;
        }

        let changed = false;
        if (existing.builtIn !== true) {
          existing.builtIn = true;
          changed = true;
        }
        if (existing.archivedAt !== null) {
          existing.archivedAt = null;
          changed = true;
        }
        if (typeof existing.sortIndex !== 'number') {
          existing.sortIndex = index;
          changed = true;
        }
        if (typeof existing.createdAt !== 'string') {
          existing.createdAt = seed.createdAt;
          changed = true;
        }
        if (typeof existing.updatedAt !== 'string') {
          existing.updatedAt = seed.updatedAt;
          changed = true;
        }
        if (typeof existing.label !== 'string' || existing.label.trim() === '') {
          existing.label = seed.label;
          changed = true;
        }

        if (changed) {
          await store.put(existing as never);
        }
      }
    }
  }

  if (oldVersion < 34) {
    // no structural changes
  }

  if (oldVersion < 35) {
    const tagCategoriesStore = db.createObjectStore('tagCategories', { keyPath: 'id' });
    tagCategoriesStore.createIndex('by-sort-order', 'sortOrder');

    const tagsStore = db.createObjectStore('tags', { keyPath: 'id' });
    tagsStore.createIndex('by-category', 'categoryId');

    if (db.objectStoreNames.contains('workTypes')) {
      await backfillStore(transaction, 'workTypes', (workType) => {
        const wt = workType as unknown as Record<string, unknown>;
        if (!Array.isArray(wt.tagIds)) {
          wt.tagIds = [];
          return true;
        }
        return false;
      });
    }

    if (db.objectStoreNames.contains('tasks')) {
      await backfillStore(transaction, 'tasks', (task) => {
        const t = task as unknown as Record<string, unknown>;
        if (!Array.isArray(t.additionalTagIds)) {
          t.additionalTagIds = [];
          return true;
        }
        return false;
      });
    }

    if (db.objectStoreNames.contains('plans')) {
      await backfillStore(transaction, 'plans', (plan) => {
        const p = plan as unknown as Record<string, unknown>;
        const lineItems = p.lineItems;
        if (!Array.isArray(lineItems)) return false;
        let changed = false;
        for (const item of lineItems as Array<Record<string, unknown>>) {
          if (!Array.isArray(item.tagIds)) {
            item.tagIds = [];
            changed = true;
          }
        }
        return changed;
      });
    }
  }

  if (oldVersion < 36) {
    if (!db.objectStoreNames.contains('globalTagSequence')) {
      db.createObjectStore('globalTagSequence', { keyPath: 'id' });
    }

    if (db.objectStoreNames.contains('tags')) {
      await backfillStore(transaction, 'tags', (tag) => {
        const t = tag as unknown as Record<string, unknown>;
        if (t.sequencable === undefined) {
          t.sequencable = false;
          return true;
        }
        return false;
      });
    }
  }

  if (oldVersion < 37) {
    if (!db.objectStoreNames.contains('crewPool')) {
      db.createObjectStore('crewPool', { keyPath: 'id' });
    }

    if (db.objectStoreNames.contains('tags')) {
      await backfillStore(transaction, 'tags', (tag) => {
        const t = tag as unknown as Record<string, unknown>;
        if (t.skillTag === undefined) {
          t.skillTag = false;
          return true;
        }
        return false;
      });
    }
  }

  if (oldVersion < 38) {
    if (db.objectStoreNames.contains('plans')) {
      await backfillStore(transaction, 'plans', (plan) => {
        const p = plan as unknown as Record<string, unknown>;
        if (p.lastExecutionReturnExportedAt !== undefined) return false;
        p.lastExecutionReturnExportedAt = null;
        return true;
      });
    }

    if (db.objectStoreNames.contains('executionReturns')) {
      await backfillStore(transaction, 'executionReturns', (record) => {
        const r = record as unknown as Record<string, unknown>;
        if (r.mergeSummary !== undefined) return false;
        const importedAt = typeof r.importedAt === 'string' ? r.importedAt : '';
        r.mergeSummary = {
          importedAt,
          importedEntryCount: 0,
          skippedDuplicateEntryCount: 0,
          mergedTaskCount: 0,
          lineItemCount: 0,
        };
        return true;
      });
    }
  }
}
