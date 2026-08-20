import * as ScreenOrientation from 'expo-screen-orientation';
import { OrientationMode } from '../types/settings';

export const orientationHelper = {
  /**
   * Lock orientation based on project orientation mode
   */
  async lockForProject(mode: OrientationMode): Promise<void> {
    try {
      if (mode === 'landscape') {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } else {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
      }
    } catch (e) {
      console.warn('Screen orientation lock error:', e);
    }
  },

  /**
   * Reset orientation back to default portrait
   */
  async resetToPortrait(): Promise<void> {
    try {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
    } catch (e) {
      console.warn('Screen orientation reset error:', e);
    }
  },
};
