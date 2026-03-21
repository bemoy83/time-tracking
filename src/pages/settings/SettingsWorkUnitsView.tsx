import { useEffect, useMemo, useState } from 'react';
import { ActionSheet } from '../../components/ActionSheet';
import { IconButton } from '../../components/IconButton';
import { ChevronUpIcon, RulerIcon } from '../../components/icons';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import {
  archiveWorkUnitDefinition,
  createWorkUnitDefinition,
  deleteWorkUnitDefinitionById,
  getWorkUnitUsageSummary,
  reorderWorkUnitDefinitions,
  unarchiveWorkUnitDefinition,
  updateWorkUnitDefinitionLabel,
  useWorkUnitStore,
} from '../../lib/stores/work-unit-store';
import type { WorkUnitDefinition } from '../../lib/types';
import './settings-styles';

interface SettingsWorkUnitsViewProps {
  onBack: () => void;
}

export function SettingsWorkUnitsView({ onBack }: SettingsWorkUnitsViewProps) {
  const { definitions } = useWorkUnitStore();
  const [editingDefinition, setEditingDefinition] = useState<WorkUnitDefinition | null | undefined>(undefined);
  const [draftLabel, setDraftLabel] = useState('');
  const [usageSummary, setUsageSummary] = useState<Awaited<ReturnType<typeof getWorkUnitUsageSummary>> | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const orderedDefinitions = useMemo(
    () => [...definitions].sort((a, b) => a.sortIndex - b.sortIndex),
    [definitions],
  );

  useEffect(() => {
    if (editingDefinition === undefined) {
      setDraftLabel('');
      setUsageSummary(null);
      setError(null);
      return;
    }

    if (editingDefinition === null) {
      setDraftLabel('');
      setUsageSummary(null);
      setError(null);
      return;
    }

    setDraftLabel(editingDefinition.label);
    setIsLoadingUsage(true);
    void getWorkUnitUsageSummary(editingDefinition.id)
      .then((summary) => setUsageSummary(summary))
      .finally(() => setIsLoadingUsage(false));
  }, [editingDefinition]);

  const handleMove = async (definition: WorkUnitDefinition, direction: -1 | 1) => {
    const index = orderedDefinitions.findIndex((item) => item.id === definition.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= orderedDefinitions.length) return;

    const reordered = [...orderedDefinitions];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, removed);
    await reorderWorkUnitDefinitions(reordered.map((item) => item.id));
  };

  const closeSheet = () => {
    setEditingDefinition(undefined);
    setDraftLabel('');
    setUsageSummary(null);
    setError(null);
  };

  const handleSave = async () => {
    const label = draftLabel.trim();
    if (!label) {
      setError('Label is required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (editingDefinition) {
        await updateWorkUnitDefinitionLabel(editingDefinition.id, label);
      } else {
        await createWorkUnitDefinition(label);
      }
      closeSheet();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save work unit.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!editingDefinition) return;
    setIsSaving(true);
    setError(null);
    try {
      if (editingDefinition.archivedAt == null) {
        await archiveWorkUnitDefinition(editingDefinition.id);
      } else {
        await unarchiveWorkUnitDefinition(editingDefinition.id);
      }
      closeSheet();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update archive state.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingDefinition) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteWorkUnitDefinitionById(editingDefinition.id);
      closeSheet();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to delete work unit.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsDetailLayout title="Quantity Units" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Quantity Units</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm btn--circle"
            onClick={() => setEditingDefinition(null)}
          >
            +
          </button>
        </div>
        <p className="settings-view__helper">
          Manage global quantity units used by work types, tasks, templates, plans, and imports.
        </p>

        {orderedDefinitions.length === 0 ? (
          <div className="empty-state">
            <RulerIcon className="empty-state__icon" aria-hidden />
            <p className="empty-state__heading">No quantity units yet</p>
            <p className="empty-state__text">Add one for estimates, tasks, and imports.</p>
          </div>
        ) : (
          <div className="settings-view__list">
            {orderedDefinitions.map((definition, index) => (
              <div key={definition.id} className="settings-view__list-item">
                <button
                  type="button"
                  className="settings-view__row"
                  onClick={() => setEditingDefinition(definition)}
                >
                  <div className="settings-view__template-info">
                    <span className="settings-view__row-label">{definition.label}</span>
                    <span className="settings-view__row-detail">
                      {definition.id}
                      {definition.builtIn ? ' · built-in' : ' · custom'}
                      {definition.archivedAt ? ' · archived' : ''}
                    </span>
                  </div>
                </button>
                <div className="settings-view__list-item-actions">
                  <IconButton
                    variant="ghost"
                    ariaLabel="Move unit up"
                    icon={<ChevronUpIcon className="settings-detail__icon" />}
                    disabled={index === 0}
                    className="icon-btn--reorder"
                    onClick={() => {
                      void handleMove(definition, -1);
                    }}
                  />
                  <IconButton
                    variant="ghost"
                    ariaLabel="Move unit down"
                    icon={
                      <ChevronUpIcon className="settings-detail__icon settings-view__reorder-chevron--down" />
                    }
                    disabled={index === orderedDefinitions.length - 1}
                    className="icon-btn--reorder"
                    onClick={() => {
                      void handleMove(definition, 1);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ActionSheet
        isOpen={editingDefinition !== undefined}
        title={editingDefinition ? 'Edit Quantity Unit' : 'New Quantity Unit'}
        onClose={closeSheet}
      >
        <div className="create-task-sheet__form">
          {error && (
            <div className="calculator__provenance-warning" style={{ padding: '8px 0', color: 'var(--color-danger, #dc2626)' }}>
              {error}
            </div>
          )}
          <input
            type="text"
            className="input"
            placeholder="Label (e.g. pallets)"
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
          />

          {editingDefinition && (
            <div className="settings-view__helper" style={{ marginTop: 8 }}>
              ID: <code>{editingDefinition.id}</code>
              {editingDefinition.builtIn ? ' · Built-in unit' : ' · Custom unit'}
            </div>
          )}

          {editingDefinition && (
            <div className="settings-view__helper" style={{ marginTop: 8 }}>
              {isLoadingUsage
                ? 'Checking usage...'
                : usageSummary
                  ? `In use by ${usageSummary.workTypes} work types, ${usageSummary.tasks} tasks, ${usageSummary.templates} templates, and ${usageSummary.planLineItems} plan line items.`
                  : ''}
            </div>
          )}

          <div className="action-sheet__actions">
            {editingDefinition && !editingDefinition.builtIn && (
              <>
                <button
                  type="button"
                  className="btn btn--ghost btn--lg"
                  onClick={() => {
                    void handleArchiveToggle();
                  }}
                  disabled={isSaving}
                >
                  {editingDefinition.archivedAt == null ? 'Archive' : 'Restore'}
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--lg"
                  onClick={() => {
                    void handleDelete();
                  }}
                  disabled={isSaving || (usageSummary?.total ?? 0) > 0}
                >
                  Delete
                </button>
              </>
            )}
            <div className="action-sheet__actions-right">
              <button type="button" className="btn btn--secondary btn--lg" onClick={closeSheet}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => {
                  void handleSave();
                }}
                disabled={isSaving || draftLabel.trim().length === 0}
              >
                {editingDefinition ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </ActionSheet>
    </SettingsDetailLayout>
  );
}
