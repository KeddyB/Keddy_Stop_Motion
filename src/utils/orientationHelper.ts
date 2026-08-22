import * as ScreenOrientation from 'expo-screen-orientation';
import { OrientationMode } from '../types/settings';

export const orientationHelper = {
  /**
   * Lock orientation based on project orientation mode without gyro-flipping
   */
  async lockForProject(mode: OrientationMode): Promise<void> {
    try {
      if (mode === 'landscape') {
        // Allows rotating between Landscape Left and Landscape Right (while preventing flipping to Portrait)
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } else {
        // Strict portrait lock (prevents flipping to Landscape)
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
      }
    } catch (e) {
      console.warn('Screen orientation lock error:', e);
    }
  },

  /**
   * Unlock orientation so the app adapts naturally to device orientation (portrait or landscape)
   */
  async unlockOrientation(): Promise<void> {
    try {
      await ScreenOrientation.unlockAsync();
    } catch (e) {
      console.warn('Screen orientation unlock error:', e);
    }
  },

  /**
   * Reset orientation back to device natural orientation
   */
  async resetToPortrait(): Promise<void> {
    try {
      await ScreenOrientation.unlockAsync();
    } catch (e) {
      console.warn('Screen orientation reset error:', e);
    }
  },
};
