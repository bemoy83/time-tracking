import type { DBSchema } from 'idb';
import type {
  ActiveTimer,
  TimeEntry,
  Task,
  Project,
  TaskNote,
  TemplateNote,
  TaskTemplate,
  AttributionSnapshot,
  WorkType,
  WorkUnitDefinition,
} from '../types';
import type { Plan } from '../planning/plan-model';
import type {
  ImportedExecutionReturnLineItemRecord,
  ImportedExecutionReturnRecord,
  ImportedExecutionReturnUnplannedTaskRecord,
} from '../interop/data-transfer/contracts';
import type { Tag, TagCategory, GlobalTagSequence } from '../tags';

/**
 * Database schema for idb type safety.
 */
export interface TimeTrackingDBSchema extends DBSchema {
  // Active timers store (one record per task with active timer)
  activeTimers: {
    key: string;
    value: ActiveTimer;
    indexes: {
      'by-task': string;
    };
  };
  // Time entries with taskId index for querying by task
  timeEntries: {
    key: string;
    value: TimeEntry;
    indexes: {
      'by-task': string;
      'by-sync-status': string;
      'by-startUtc': string;
    };
  };
  // Tasks with projectId and parentId indexes
  tasks: {
    key: string;
    value: Task;
    indexes: {
      'by-project': string;
      'by-parent': string;
      'by-status': string;
    };
  };
  // Projects store
  projects: {
    key: string;
    value: Project;
  };
  // Task notes / activity log
  taskNotes: {
    key: string;
    value: TaskNote;
    indexes: {
      'by-task': string;
    };
  };
  // Template notes / activity log
  templateNotes: {
    key: string;
    value: TemplateNote;
    indexes: {
      'by-template': string;
    };
  };
  // Task templates for recurring tasks
  taskTemplates: {
    key: string;
    value: TaskTemplate;
    indexes: {
      'by-phase': string;
    };
  };
  // Attribution snapshots cache
  attributionSnapshots: {
    key: string;
    value: AttributionSnapshot;
  };
  // Planning workspace plans
  plans: {
    key: string;
    value: Plan;
  };
  // Work type definitions
  workTypes: {
    key: string;
    value: WorkType;
    indexes: {
      'by-title-unit': [string, string];
    };
  };
  // Work unit catalog definitions
  workUnitDefinitions: {
    key: string;
    value: WorkUnitDefinition;
    indexes: {
      'by-sort-index': number;
    };
  };
  // Imported execution-return envelopes (planner-side)
  executionReturns: {
    key: string;
    value: ImportedExecutionReturnRecord;
    indexes: {
      'by-plan': string;
      'by-imported-at': string;
    };
  };
  // Imported execution-return line-item annotations
  executionReturnLineItems: {
    key: string;
    value: ImportedExecutionReturnLineItemRecord;
    indexes: {
      'by-plan': string;
      'by-return': string;
      'by-imported-at': string;
    };
  };
  // Imported execution-return unplanned task snapshots
  executionReturnUnplannedTasks: {
    key: string;
    value: ImportedExecutionReturnUnplannedTaskRecord;
    indexes: {
      'by-plan': string;
      'by-return': string;
      'by-imported-at': string;
    };
  };
  // Tag categories (e.g. "Resource", "Location", "Team")
  tagCategories: {
    key: string;
    value: TagCategory;
    indexes: {
      'by-sort-order': number;
    };
  };
  // Tags (e.g. "Furniture", "Hall A", "Crew 1")
  tags: {
    key: string;
    value: Tag;
    indexes: {
      'by-category': string;
    };
  };
  // Singleton record holding the user-defined execution order for sequencable tags
  globalTagSequence: {
    key: string;
    value: GlobalTagSequence;
  };
}
