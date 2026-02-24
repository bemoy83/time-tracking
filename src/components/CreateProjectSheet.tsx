/**
 * CreateProjectSheet — ActionSheet for creating a new project.
 * Name input + ProjectColorPicker + Create/Cancel actions.
 * Mirrors CreateTaskSheet pattern.
 */

import { useState, useEffect } from 'react';
import { PROJECT_COLORS } from '../lib/types';
import { createProject } from '../lib/stores/task-store';
import { ActionSheet } from './ActionSheet';
import { ProjectColorPicker } from './ProjectColorPicker';

interface CreateProjectSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateProjectSheet({ isOpen, onClose, onCreated }: CreateProjectSheetProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setColor(PROJECT_COLORS[0]);
    }
  }, [isOpen]);

  const canCreate = name.trim().length > 0 && !isSaving;

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsSaving(true);
    try {
      await createProject(name.trim(), color);
      onClose();
      onCreated?.();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ActionSheet isOpen={isOpen} title="New Project" onClose={onClose}>
      <div className="create-project-sheet__form">
        <input
          type="text"
          className="input"
          placeholder="Project name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="create-project-sheet__section">
          <label className="entry-modal__label">Color</label>
          <ProjectColorPicker value={color} onChange={setColor} />
        </div>

        <div className="action-sheet__actions">
          <div className="action-sheet__actions-right">
            <button type="button" className="btn btn--secondary btn--lg" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={handleCreate}
              disabled={!canCreate}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </ActionSheet>
  );
}
