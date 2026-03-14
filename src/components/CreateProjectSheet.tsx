import { ProjectFormSheet } from './ProjectFormSheet';

interface CreateProjectSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateProjectSheet({ isOpen, onClose, onCreated }: CreateProjectSheetProps) {
  return (
    <ProjectFormSheet
      isOpen={isOpen}
      project={null}
      onClose={onClose}
      onSaved={onCreated}
    />
  );
}
