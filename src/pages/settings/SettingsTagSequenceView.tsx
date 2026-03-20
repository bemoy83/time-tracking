/**
 * SettingsTagSequenceView — define the global execution order for sequencable tags.
 *
 * Shows all tags with `sequencable: true` in the user-defined order.
 * Up/down arrows reorder them. Tags not yet in the stored sequence appear
 * at the end in alphabetical order.
 *
 * This view does NOT manage which tags are sequencable — that's done in
 * the "Tags" settings via the "Include in execution sequence" checkbox on
 * each tag form.
 */

import { useMemo } from 'react';
import { IconButton } from '../../components/IconButton';
import { ChevronUpIcon } from '../../components/icons';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { useTagStore } from '../../lib/stores/tag-store';
import {
  useTagSequenceStore,
  setTagSequenceOrder,
} from '../../lib/stores/tag-sequence-store';
import './settings-styles';

interface SettingsTagSequenceViewProps {
  onBack: () => void;
}

export function SettingsTagSequenceView({ onBack }: SettingsTagSequenceViewProps) {
  useTagStore(); // subscribe for tag data
  const { tags } = useTagStore();
  const { tagIds: sequenceIds } = useTagSequenceStore();

  // Derive ordered list: sequencable tags sorted by their position in sequenceIds,
  // then newly-sequencable tags not yet in the sequence appended alphabetically.
  const orderedTags = useMemo(() => {
    const sequencableTags = tags.filter((t) => t.sequencable);
    const sequenceSet = new Set(sequenceIds);
    const positionMap = new Map(sequenceIds.map((id, i) => [id, i]));

    const inSequence = sequencableTags
      .filter((t) => sequenceSet.has(t.id))
      .sort((a, b) => (positionMap.get(a.id) ?? 0) - (positionMap.get(b.id) ?? 0));

    const notInSequence = sequencableTags
      .filter((t) => !sequenceSet.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...inSequence, ...notInSequence];
  }, [tags, sequenceIds]);

  async function handleMove(index: number, direction: -1 | 1) {
    const newOrder = [...orderedTags];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    // Swap
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    await setTagSequenceOrder(newOrder.map((t) => t.id));
  }

  return (
    <SettingsDetailLayout title="Tag Execution Sequence" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Execution Order</h2>
        </div>
        <p className="settings-view__helper">
          Define the order in which sequencable tags are executed. Use the arrows to reorder.
          To add or remove tags from this sequence, edit the tag in{' '}
          <strong>Tags</strong> settings and toggle{' '}
          <em>Include in execution sequence</em>.
        </p>

        {orderedTags.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__heading">No sequencable tags</p>
            <p className="empty-state__text">
              Go to <strong>Tags</strong> settings, edit a tag, and enable{' '}
              <em>Include in execution sequence</em>.
            </p>
          </div>
        ) : (
          <div className="settings-view__list">
            {orderedTags.map((tag, index) => (
              <div key={tag.id} className="settings-view__list-item">
                <div className="settings-view__row" style={{ cursor: 'default' }}>
                  <div className="settings-view__template-info">
                    <span className="settings-view__row-label settings-view__row-label--with-dot">
                      <span
                        className="tag-settings__tag-dot"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </span>
                    <span className="settings-view__row-detail">
                      Position {index + 1}
                    </span>
                  </div>
                </div>
                <div className="settings-view__list-item-actions">
                  <IconButton
                    variant="ghost"
                    ariaLabel="Move tag up"
                    icon={<ChevronUpIcon className="settings-detail__icon" />}
                    disabled={index === 0}
                    onClick={() => {
                      void handleMove(index, -1);
                    }}
                  />
                  <IconButton
                    variant="ghost"
                    ariaLabel="Move tag down"
                    icon={
                      <ChevronUpIcon className="settings-detail__icon settings-view__reorder-chevron--down" />
                    }
                    disabled={index === orderedTags.length - 1}
                    onClick={() => {
                      void handleMove(index, 1);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsDetailLayout>
  );
}
