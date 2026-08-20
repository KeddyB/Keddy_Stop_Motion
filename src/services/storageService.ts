import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StopMotionProject } from '../types/project';

const PROJECTS_INDEX_KEY = '@keddy_stopmotion_projects_index';
const FIRST_LAUNCH_KEY = '@keddy_stopmotion_first_launch_done';
const BASE_PROJECTS_DIR = `${FileSystem.documentDirectory ?? ''}projects/`;

export const storageService = {
  /**
   * Ensure base projects folder exists on device storage
   */
  async initStorage(): Promise<void> {
    try {
      if (!FileSystem.documentDirectory) return;
      const dirInfo = await FileSystem.getInfoAsync(BASE_PROJECTS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(BASE_PROJECTS_DIR, { intermediates: true });
      }
    } catch (e) {
      console.warn('Storage init error:', e);
    }
  },

  /**
   * Get the directory path for a specific project
   */
  getProjectDirectory(projectId: string): string {
    return `${BASE_PROJECTS_DIR}${projectId}/`;
  },

  /**
   * Get the frames folder path for a specific project
   */
  getProjectFramesDirectory(projectId: string): string {
    return `${BASE_PROJECTS_DIR}${projectId}/frames/`;
  },

  /**
   * Load all saved projects from storage
   */
  async loadProjects(): Promise<StopMotionProject[]> {
    try {
      await this.initStorage();
      const raw = await AsyncStorage.getItem(PROJECTS_INDEX_KEY);
      if (!raw) return [];
      const list: StopMotionProject[] = JSON.parse(raw);
      return list;
    } catch (e) {
      console.warn('Failed to load projects from storage:', e);
      return [];
    }
  },

  /**
   * Save / Update a project in storage and on disk
   */
  async saveProject(project: StopMotionProject): Promise<void> {
    try {
      await this.initStorage();

      if (FileSystem.documentDirectory) {
        // 1. Create project & frames directory on device disk
        const projectDir = this.getProjectDirectory(project.id);
        const framesDir = this.getProjectFramesDirectory(project.id);
        
        const dirInfo = await FileSystem.getInfoAsync(projectDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(projectDir, { intermediates: true });
        }
        const framesInfo = await FileSystem.getInfoAsync(framesDir);
        if (!framesInfo.exists) {
          await FileSystem.makeDirectoryAsync(framesDir, { intermediates: true });
        }

        // 2. Save project manifest to file
        const manifestPath = `${projectDir}project.json`;
        await FileSystem.writeAsStringAsync(manifestPath, JSON.stringify(project, null, 2));
      }

      // 3. Update AsyncStorage index
      const projects = await this.loadProjects();
      const existingIdx = projects.findIndex((p) => p.id === project.id);
      let updated: StopMotionProject[];
      if (existingIdx >= 0) {
        updated = [...projects];
        updated[existingIdx] = project;
      } else {
        updated = [project, ...projects];
      }
      await AsyncStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save project:', e);
      throw e;
    }
  },

  /**
   * Delete a project and remove its folder and images from device storage
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      if (FileSystem.documentDirectory) {
        // 1. Delete physical directory on phone storage
        const projectDir = this.getProjectDirectory(projectId);
        const dirInfo = await FileSystem.getInfoAsync(projectDir);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(projectDir, { idempotent: true });
        }
      }

      // 2. Update AsyncStorage index
      const projects = await this.loadProjects();
      const filtered = projects.filter((p) => p.id !== projectId);
      await AsyncStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to delete project:', e);
      throw e;
    }
  },

  /**
   * Duplicate a project, cloning its physical frame files into a new project directory
   */
  async duplicateProject(originalProject: StopMotionProject): Promise<StopMotionProject> {
    try {
      await this.initStorage();
      const newId = `proj_${Date.now()}`;
      const newFramesDir = this.getProjectFramesDirectory(newId);

      if (FileSystem.documentDirectory) {
        await FileSystem.makeDirectoryAsync(newFramesDir, { intermediates: true });
      }

      const duplicatedFrames = [];
      if (originalProject.frames && originalProject.frames.length > 0) {
        for (let i = 0; i < originalProject.frames.length; i++) {
          const f = originalProject.frames[i];
          const newFrameId = `frame_${Date.now()}_${i}`;
          const newFilename = `${newFrameId}.jpg`;
          const newUri = `${newFramesDir}${newFilename}`;

          let copied = false;
          try {
            if (FileSystem.documentDirectory) {
              const info = await FileSystem.getInfoAsync(f.uri);
              if (info.exists) {
                await FileSystem.copyAsync({ from: f.uri, to: newUri });
                copied = true;
              }
            }
          } catch (copyErr) {
            console.warn(`Failed to copy frame file ${f.uri}:`, copyErr);
          }

          duplicatedFrames.push({
            ...f,
            id: newFrameId,
            uri: copied ? newUri : f.uri,
            proxyUri: copied ? newUri : f.proxyUri,
          });
        }
      }

      const duplicatedProject: StopMotionProject = {
        ...originalProject,
        id: newId,
        title: `${originalProject.title} (Copy)`,
        lastModified: 'Just now',
        frames: duplicatedFrames,
        frameCount: duplicatedFrames.length,
      };

      await this.saveProject(duplicatedProject);
      return duplicatedProject;
    } catch (e) {
      console.warn('Failed to duplicate project:', e);
      throw e;
    }
  },

  /**
   * Check if this is the first time the app is launched
   */
  async isFirstLaunch(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
      return value === null;
    } catch {
      return true;
    }
  },

  /**
   * Mark first launch as completed
   */
  async setFirstLaunchComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    } catch (e) {
      console.warn('Failed to set first launch flag:', e);
    }
  },
};
