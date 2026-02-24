/**
 * EditableTitle component.
 * Click-to-edit title with inline input + Save/Cancel actions.
 * Used by TaskDetailHeader and ProjectDetail.
 */

import { useState } from 'react';

interface EditableTitleProps {
  value: string;
  onSave: (newValue: string) => void | Promise<void>;
  className?: string;
}

export function EditableTitle({ value, onSave, className = '' }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleSave = async () => {
    if (!editValue.trim()) return;
    await onSave(editValue.trim());
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="editable-title__edit">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="input"
          autoFocus
        />
        <div className="editable-title__actions">
          <button className="btn btn--secondary" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <h1
      className={`editable-title ${className}`.trim()}
      onClick={() => {
        setEditValue(value);
        setIsEditing(true);
      }}
    >
      {value}
    </h1>
  );
}
