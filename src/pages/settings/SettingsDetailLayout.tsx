import { ReactNode } from 'react';
import { BackIcon } from '../../components/icons';

interface SettingsDetailLayoutProps {
  title: string;
  onBack: () => void;
  children: ReactNode;
}

export function SettingsDetailLayout({ title, onBack, children }: SettingsDetailLayoutProps) {
  return (
    <div className="settings-detail">
      <header className="settings-detail__header">
        <button className="settings-detail__back" onClick={onBack}>
          <BackIcon className="settings-detail__icon" />
          <span>Back</span>
        </button>
      </header>
      <h1 className="settings-detail__title">{title}</h1>
      {children}
    </div>
  );
}
