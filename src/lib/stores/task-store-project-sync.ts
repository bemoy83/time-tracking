import { getAllProjects } from '../db';
import { setState } from './task-store-state';

export async function refreshProjectsInTaskStore(): Promise<void> {
  try {
    const projects = await getAllProjects();
    setState({ projects, error: null });
  } catch (err) {
    setState({
      error: err instanceof Error ? err.message : 'Failed to refresh projects',
    });
  }
}
