import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const EXPORT_DIR_URI_KEY = '@keddy_export_directory_uri';
export const EXPORT_DIR_NAME_KEY = '@keddy_export_directory_name';

export interface SelectedFolder {
  uri: string;
  name: string;
}

/**
 * Parses and formats Android Storage Access Framework (SAF) URI into a clean, human-readable path
 */
export function formatSafDirectoryName(directoryUri: string): string {
  try {
    const decoded = decodeURIComponent(directoryUri);
    if (decoded.includes('primary:')) {
      const parts = decoded.split('primary:');
      const folderPart = parts[1]?.split('/document/')[0] || '';
      return folderPart ? `Internal Storage / ${folderPart}` : 'Internal Storage (Root)';
    } else if (decoded.includes('/tree/')) {
      const treePart = decoded.split('/tree/')[1]?.split('/document/')[0] || '';
      const afterColon = treePart.split(':')[1] || treePart;
      return afterColon ? `Storage / ${afterColon}` : 'Selected Folder';
    }
    return 'Custom Folder';
  } catch {
    return 'Custom Folder';
  }
}

/**
 * Prompts user to pick a target export folder via system directory picker
 */
export async function pickCustomExportFolder(): Promise<SelectedFolder | null> {
  if (Platform.OS === 'android') {
    try {
      const { StorageAccessFramework } = FileSystem;
      if (!StorageAccessFramework?.requestDirectoryPermissionsAsync) {
        return null;
      }
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted && permissions.directoryUri) {
        const friendlyName = formatSafDirectoryName(permissions.directoryUri);
        await AsyncStorage.setItem(EXPORT_DIR_URI_KEY, permissions.directoryUri);
        await AsyncStorage.setItem(EXPORT_DIR_NAME_KEY, friendlyName);
        return {
          uri: permissions.directoryUri,
          name: friendlyName,
        };
      }
    } catch (err) {
      console.warn('Error picking export directory:', err);
    }
  }
  return null;
}

/**
 * Loads saved export folder from storage if available
 */
export async function getSavedExportFolder(): Promise<SelectedFolder | null> {
  try {
    const [uri, name] = await Promise.all([
      AsyncStorage.getItem(EXPORT_DIR_URI_KEY),
      AsyncStorage.getItem(EXPORT_DIR_NAME_KEY),
    ]);
    if (uri) {
      return { uri, name: name || formatSafDirectoryName(uri) };
    }
  } catch (err) {
    console.warn('Error reading saved export directory:', err);
  }
  return null;
}

/**
 * Clears saved custom folder preference, restoring default gallery album saving
 */
export async function clearSavedExportFolder(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(EXPORT_DIR_URI_KEY),
      AsyncStorage.removeItem(EXPORT_DIR_NAME_KEY),
    ]);
  } catch (err) {
    console.warn('Error resetting export directory:', err);
  }
}
