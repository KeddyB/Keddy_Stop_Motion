import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { requestRecordingPermissionsAsync, getRecordingPermissionsAsync } from 'expo-audio';

export interface PermissionStatusResult {
  camera: boolean;
  mediaLibrary: boolean;
  microphone: boolean;
  allGranted: boolean;
}

export const permissionService = {
  /**
   * Check current status of permissions
   */
  async checkPermissions(): Promise<PermissionStatusResult> {
    try {
      const cameraStatus = await Camera.getCameraPermissionsAsync();
      const cameraGranted = cameraStatus.granted;

      let mediaGranted = false;
      try {
        const mediaStatus = await MediaLibrary.getPermissionsAsync();
        mediaGranted = mediaStatus.granted;
      } catch {}

      let microGranted = false;
      try {
        const audioStatus = await getRecordingPermissionsAsync();
        microGranted = audioStatus.granted;
      } catch {}

      return {
        camera: cameraGranted,
        mediaLibrary: mediaGranted,
        microphone: microGranted,
        allGranted: cameraGranted,
      };
    } catch (e) {
      console.warn('Error checking permissions:', e);
      return { camera: false, mediaLibrary: false, microphone: false, allGranted: false };
    }
  },

  /**
   * Request all necessary permissions for stop-motion studio
   */
  async requestAllPermissions(): Promise<PermissionStatusResult> {
    try {
      // 1. Request Camera (Essential)
      const cameraResult = await Camera.requestCameraPermissionsAsync();
      const cameraGranted = cameraResult.granted;

      // 2. Request Media Library / Storage
      let mediaGranted = false;
      try {
        const mediaResult = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video', 'audio']);
        mediaGranted = mediaResult.granted;
      } catch {}

      // 3. Request Microphone (Optional for voiceover)
      let microGranted = false;
      try {
        const audioResult = await requestRecordingPermissionsAsync();
        microGranted = audioResult.granted;
      } catch {}

      return {
        camera: cameraGranted,
        mediaLibrary: mediaGranted,
        microphone: microGranted,
        allGranted: cameraGranted,
      };
    } catch (e) {
      console.warn('Error requesting permissions:', e);
      return { camera: false, mediaLibrary: false, microphone: false, allGranted: false };
    }
  },
};
