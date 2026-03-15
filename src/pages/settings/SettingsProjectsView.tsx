import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { ProjectColorDot } from '../../components/ProjectColorDot';
import { ProjectFormSheet } from '../../components/ProjectFormSheet';
import { DeleteProjectConfirm } from '../../components/DeleteProjectConfirm';
import { ExportIcon, TaskListIcon } from '../../components/icons';
import { IconButton } from '../../components/IconButton';
import { useTaskStore, deleteProjectWithMode, getDeleteProjectPreview } from '../../lib/stores/task-store';
import type { DeleteProjectPreview } from '../../lib/stores/task-store';
import type { Project } from '../../lib/types';
import { downloadCsv } from '../../lib/interop/download-csv';
import { exportProjectCsvSample, exportProjectsCsv } from '../../lib/interop/project-export';
import {
  applyProjectImport,
  generateProjectImportPreview,
  parseProjectCsv,
  type ProjectImportPreview,
} from '../../lib/interop/project-import';
import { SettingsDetailLayout } from './SettingsDetailLayout';
import { ProjectImportCard } from './ProjectImportCard';
import './settings-styles';

interface SettingsProjectsViewProps {
  onBack: () => void;
}

function formatProjectDates(project: Project): string {
  const parts: string[] = [];
  if (project.assemblyStartDate && project.assemblyEndDate) {
    parts.push(`Assembly ${project.assemblyStartDate} to ${project.assemblyEndDate}`);
  }
  if (project.eventStartDate && project.eventEndDate) {
    parts.push(`Event ${project.eventStartDate} to ${project.eventEndDate}`);
  }
  if (project.dismantleStartDate && project.dismantleEndDate) {
    parts.push(`Dismantle ${project.dismantleStartDate} to ${project.dismantleEndDate}`);
  }
  return parts.join(' · ');
}

export function SettingsProjectsView({ onBack }: SettingsProjectsViewProps) {
  const { projects } = useTaskStore();
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [projectPreview, setProjectPreview] = useState<ProjectImportPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [deletePreview, setDeletePreview] = useState<DeleteProjectPreview | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddProject = () => {
    setEditingProject(null);
    setShowProjectForm(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowProjectForm(true);
  };

  const closeProjectForm = () => {
    setShowProjectForm(false);
    setEditingProject(null);
  };

  const openDeleteConfirm = useCallback(async (project: Project) => {
    const preview = await getDeleteProjectPreview(project.id);
    setProjectPendingDelete(project);
    setDeletePreview(preview);
    setShowDeleteConfirm(true);
  }, []);

  const handleExportProjects = () => {
    setIsExporting(true);
    try {
      const csv = exportProjectsCsv(projects);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`projects-${stamp}.csv`, csv);
      setImportSummary(`Exported ${projects.length} projects.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSample = () => {
    downloadCsv('projects-sample.csv', exportProjectCsvSample());
  };

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setImportSummary(null);
    setProjectPreview(null);
    setIsLoadingPreview(true);

    try {
      const text = await file.text();
      const parsed = parseProjectCsv(text);
      if (!parsed.valid) {
        setImportSummary(parsed.errors.map((error) => `Row ${error.row}: ${error.field} - ${error.message}`).join('; '));
        return;
      }
      setProjectPreview(generateProjectImportPreview(parsed.items, projects));
    } finally {
      setIsLoadingPreview(false);
    }
  }, [projects]);

  const handleApplyImport = async () => {
    if (!projectPreview) return;
    setIsApplyingImport(true);
    try {
      const result = await applyProjectImport(projectPreview.items.map((item) => item.item));
      setImportSummary(`Applied import: ${result.created} created, ${result.updated} updated.`);
      setProjectPreview(null);
    } finally {
      setIsApplyingImport(false);
    }
  };

  const handleDeleteUnassign = async () => {
    if (!projectPendingDelete) return;
    await deleteProjectWithMode(projectPendingDelete.id, 'unassign');
    setShowDeleteConfirm(false);
    setDeletePreview(null);
    setProjectPendingDelete(null);
  };

  const handleDeleteTasks = async () => {
    if (!projectPendingDelete) return;
    await deleteProjectWithMode(projectPendingDelete.id, 'delete_tasks');
    setShowDeleteConfirm(false);
    setDeletePreview(null);
    setProjectPendingDelete(null);
  };

  return (
    <SettingsDetailLayout title="Projects / Events" onBack={onBack}>
      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Projects / Events</h2>
          <button
            type="button"
            className="btn btn--primary btn--sm btn--circle"
            onClick={handleAddProject}
          >
            +
          </button>
        </div>
        <p className="settings-view__helper">Import event schedule and manage project phase dates</p>

        {projects.length === 0 ? (
          <div className="empty-state">
            <TaskListIcon className="empty-state__icon" aria-hidden />
            <p className="empty-state__heading">No projects yet</p>
            <p className="empty-state__text">Create one manually or import from CSV.</p>
          </div>
        ) : (
          <div className="settings-view__list">
            {projects.map((project) => (
              <button
                key={project.id}
                className="settings-view__row"
                onClick={() => handleEditProject(project)}
              >
                <div className="settings-view__template-info">
                  <span className="settings-view__row-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ProjectColorDot color={project.color} />
                    {project.name}
                  </span>
                  <span className="settings-view__row-detail">
                    {formatProjectDates(project) || 'No phase dates set'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="settings-view__card">
        <div className="settings-view__card-header">
          <h2 className="settings-view__sub-header">Export Projects</h2>
          <IconButton
            icon={<ExportIcon className="settings-view__export-icon" />}
            ariaLabel={isExporting ? 'Exporting...' : 'Export projects'}
            onClick={handleExportProjects}
            disabled={isExporting}
          />
        </div>
        <p className="settings-view__helper">Export projects and dates as CSV.</p>
      </div>

      <ProjectImportCard
        summaryMessage={importSummary}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        preview={projectPreview}
        isLoadingPreview={isLoadingPreview}
        isApplying={isApplyingImport}
        onApply={() => {
          void handleApplyImport();
        }}
        onDownloadSample={handleDownloadSample}
      />

      <ProjectFormSheet
        isOpen={showProjectForm}
        project={editingProject}
        onClose={closeProjectForm}
        onDelete={editingProject ? () => {
          setShowProjectForm(false);
          void openDeleteConfirm(editingProject);
        } : undefined}
      />

      <DeleteProjectConfirm
        isOpen={showDeleteConfirm}
        projectName={projectPendingDelete?.name ?? ''}
        taskCount={deletePreview?.taskCount ?? 0}
        totalTimeMs={deletePreview?.totalTimeMs ?? 0}
        onUnassign={() => {
          void handleDeleteUnassign();
        }}
        onDeleteTasks={() => {
          void handleDeleteTasks();
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeletePreview(null);
          setProjectPendingDelete(null);
        }}
      />
    </SettingsDetailLayout>
  );
}
