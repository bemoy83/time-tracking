import { useEffect, useRef } from 'react';
import { ImportIcon } from './icons';
import { IconButton } from './IconButton';

export interface CsvImportAction {
  trigger: () => void;
}

export type CsvImportActionRef = React.MutableRefObject<CsvImportAction | null>;

interface CsvImportInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  /** Called after file is loaded. Use to auto-trigger parse. */
  onFileLoaded?: () => void;
  /** When provided, parent can trigger import (parse + file picker) from header button. */
  importActionRef?: React.MutableRefObject<CsvImportAction | null>;
  /** When true, hide the inline Import button (use with importActionRef for header placement). */
  hideImportButton?: boolean;
}

export function CsvImportInput({
  value,
  onChange,
  placeholder = '',
  rows = 8,
  className = 'input input--textarea',
  onFileLoaded,
  importActionRef,
  hideImportButton = false,
}: CsvImportInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trigger = () => {
    onFileLoaded?.();
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (importActionRef) {
      importActionRef.current = { trigger };
      return () => {
        importActionRef.current = null;
      };
    }
  }, [importActionRef, onFileLoaded]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      if (typeof text === 'string') {
        onChange(text);
        onFileLoaded?.();
      }
    };
    reader.onerror = () => {
      onChange('');
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {!hideImportButton && (
          <IconButton
            icon={<ImportIcon className="settings-view__import-icon" />}
            ariaLabel="Import"
            onClick={trigger}
          />
        )}
      </div>
      <textarea
        className={className}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
