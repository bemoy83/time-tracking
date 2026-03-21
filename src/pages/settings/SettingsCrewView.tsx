/**
 * SettingsCrewView — configure system-level crew headcounts per skill tag.
 *
 * Lists all tags marked `skillTag: true` and allows the user to set how many
 * workers with each skill are available. This feeds the schedule assistant's
 * per-skill capacity constraint.
 *
 * This view does NOT manage which tags are skill tags — that's done in
 * the "Tags" settings via the "Include as skill" checkbox on each tag form.
 */

import { useMemo } from 'react';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { useTagStore } from '../../lib/stores/tag-store';
import {
  useCrewPoolStore,
  setSkillCrewCount,
  setSystemDefaultCrewSize,
} from '../../lib/stores/crew-pool-store';
import './settings-styles';

interface SettingsCrewViewProps {
  onBack: () => void;
}

export function SettingsCrewView({ onBack }: SettingsCrewViewProps) {
  useTagStore(); // subscribe for tag data
  const { tags } = useTagStore();
  const { allocations, defaultCrewSize } = useCrewPoolStore();

  const skillTags = useMemo(
    () => tags.filter((t) => t.skillTag).sort((a, b) => a.name.localeCompare(b.name)),
    [tags],
  );

  return (
    <SettingsDetailLayout title="Crew" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Default Crew Size</h2>
        </div>
        <p className="settings-view__helper">
          Total crew on site. Used as the capacity baseline for plans and as the
          fallback for work types with no skill constraint.
        </p>
        <div className="settings-view__row" style={{ cursor: 'default' }}>
          <span className="settings-view__row-label">Crew size</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              className="input"
              min={0}
              max={999}
              step={1}
              value={defaultCrewSize ?? ''}
              placeholder="—"
              onChange={(e) => {
                const raw = parseInt(e.target.value, 10);
                void setSystemDefaultCrewSize(Number.isFinite(raw) && raw > 0 ? raw : null);
              }}
              style={{ width: 72, textAlign: 'right' }}
              aria-label="Default crew size"
            />
            <span style={{ fontSize: 13, color: 'var(--color-secondary, #6b7280)' }}>
              workers
            </span>
          </div>
        </div>
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Skill Headcounts</h2>
        </div>
        <p className="settings-view__helper">
          Set how many workers are available for each skill. The schedule assistant
          uses these counts as a per-skill capacity constraint on every plan.
          To add a skill, edit a tag in <strong>Tags</strong> settings and enable{' '}
          <em>Include as skill</em>.
        </p>

        {skillTags.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__heading">No skill tags</p>
            <p className="empty-state__text">
              Go to <strong>Tags</strong> settings, edit a tag, and enable{' '}
              <em>Include as skill</em>.
            </p>
          </div>
        ) : (
          <div className="settings-view__list">
            {skillTags.map((tag) => (
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
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      max={999}
                      step={1}
                      value={allocations[tag.id] ?? 0}
                      onChange={(e) => {
                        const count = Math.max(0, parseInt(e.target.value, 10) || 0);
                        void setSkillCrewCount(tag.id, count);
                      }}
                      style={{ width: 72, textAlign: 'right' }}
                      aria-label={`Crew count for ${tag.name}`}
                    />
                    <span style={{ fontSize: 13, color: 'var(--color-secondary, #6b7280)' }}>
                      workers
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsDetailLayout>
  );
}
