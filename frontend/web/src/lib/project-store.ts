import { create } from 'zustand';
import { projectApi } from './api';
import type { Project } from './types';

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  loadProjects: () => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  hydrate: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProject: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const res = await projectApi.getMine();
      const projects = res.data?.data ?? res.data ?? [];
      set({ projects, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveProject: (project) => {
    if (typeof window !== 'undefined') {
      if (project) {
        localStorage.setItem('apex_active_project', JSON.stringify(project));
      } else {
        localStorage.removeItem('apex_active_project');
      }
    }
    set({ activeProject: project });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('apex_active_project');
    if (stored) {
      try {
        set({ activeProject: JSON.parse(stored) });
      } catch { /* ignore */ }
    }
  },
}));
