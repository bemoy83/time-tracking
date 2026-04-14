import type { DbUpgradeCallback } from './migration-helpers';
import { migrateV1ToV15 } from './migrate-v1-v15';
import { migrateV16ToV28 } from './migrate-v16-v28';
import { migrateV29ToV38 } from './migrate-v29-v38';

export const applyDbMigrations: DbUpgradeCallback = async (
  db,
  oldVersion,
  _newVersion,
  transaction,
) => {
  const context = { db, oldVersion, transaction };

  await migrateV1ToV15(context);
  await migrateV16ToV28(context);
  await migrateV29ToV38(context);
};

export type { DbUpgradeCallback } from './migration-helpers';
