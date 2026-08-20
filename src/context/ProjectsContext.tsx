import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { StopMotionProject } from '../types/project';
import { storageService } from '../services/storageService';
import { AspectRatioOption, OrientationMode } from '../types/settings';

interface ProjectsContextType {
  projects: StopMotionProject[];
  loading: boolean;
  createProject: (data: {
    title: string;
    orientation: OrientationMode;
    aspectRatio: AspectRatioOption;
    fps: number;
  }) => Promise<StopMotionProject>;
  duplicateProject: (project: StopMotionProject) => Promise<StopMotionProject>;
  updateProject: (updatedProject: StopMotionProject) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export const ProjectsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<StopMotionProject[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAllProjects = useCallback(async () => {
    try {
      setLoading(true);
      const loaded = await storageService.loadProjects();
      setProjects(loaded);
    } catch (e) {
      console.warn('Error loading projects:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllProjects();
  }, [loadAllProjects]);

  const createProject = useCallback(async (data: {
    title: string;
    orientation: OrientationMode;
    aspectRatio: AspectRatioOption;
    fps: number;
  }): Promise<StopMotionProject> => {
    const newId = `proj_${Date.now()}`;
    const newProject: StopMotionProject = {
      id: newId,
      title: data.title,
      orientation: data.orientation,
      frameCount: 0,
      fps: data.fps,
      durationSeconds: 0,
      lastModified: 'Just now',
      aspectRatio: data.aspectRatio,
      frames: [],
    };

    await storageService.saveProject(newProject);
    setProjects((prev) => [newProject, ...prev]);
    return newProject;
  }, []);

  const duplicateProject = useCallback(async (originalProject: StopMotionProject): Promise<StopMotionProject> => {
    const duplicatedProject = await storageService.duplicateProject(originalProject);
    setProjects((prev) => [duplicatedProject, ...prev]);
    return duplicatedProject;
  }, []);

  const updateProject = useCallback(async (updatedProject: StopMotionProject): Promise<void> => {
    await storageService.saveProject(updatedProject);
    setProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== updatedProject.id);
      return [updatedProject, ...filtered];
    });
  }, []);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    await storageService.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = React.useMemo(() => ({
    projects,
    loading,
    createProject,
    duplicateProject,
    updateProject,
    deleteProject,
    refreshProjects: loadAllProjects,
  }), [projects, loading, createProject, duplicateProject, updateProject, deleteProject, loadAllProjects]);

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
};

export const useProjects = (): ProjectsContextType => {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
};
