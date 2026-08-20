import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import { ImagePickerAsset } from 'expo-image-picker';

export const photoTimestampHelper = {
  /**
   * Parse EXIF date string (format "YYYY:MM:DD HH:MM:SS" or ISO) into epoch milliseconds
   */
  parseExifDate(dateStr?: string | null): number | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    try {
      // Handle EXIF standard "YYYY:MM:DD HH:MM:SS"
      const match = dateStr.match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const [_, year, month, day, hour, min, sec] = match;
        const date = new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(min, 10),
          parseInt(sec, 10)
        );
        const time = date.getTime();
        if (!isNaN(time)) return time;
      }

      const parsed = new Date(dateStr).getTime();
      return isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  },

  /**
   * Try to extract timestamp from standard camera filename patterns (e.g. IMG_20260819_011642.jpg)
   */
  extractTimestampFromFilename(filenameOrUri?: string | null): number | null {
    if (!filenameOrUri) return null;
    try {
      // Pattern 1: YYYYMMDD_HHMMSS
      const dateMatch = filenameOrUri.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
      if (dateMatch) {
        const [_, year, month, day, hour, min, sec] = dateMatch;
        const date = new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(min, 10),
          parseInt(sec, 10)
        );
        const time = date.getTime();
        if (!isNaN(time)) return time;
      }

      // Pattern 2: 13-digit epoch timestamp (e.g. 1724029384920)
      const epochMatch = filenameOrUri.match(/(\d{13})/);
      if (epochMatch) {
        const epoch = parseInt(epochMatch[1], 10);
        if (epoch > 946684800000 && epoch < 2524608000000) {
          return epoch;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Accurately resolve the true camera capture timestamp for an asset
   */
  async getExactCaptureTime(asset: ImagePickerAsset | { uri: string; assetId?: string; fileName?: string; exif?: any }): Promise<number> {
    // 1. Try MediaLibrary native asset info if assetId is available
    if (asset.assetId) {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset.assetId);
        if (info.creationTime && info.creationTime > 0) {
          return info.creationTime;
        }
        if (info.modificationTime && info.modificationTime > 0) {
          return info.modificationTime;
        }
      } catch (e) {
        // Fallback to EXIF/Filename
      }
    }

    // 2. Try EXIF DateTimeOriginal or DateTimeDigitized
    if (asset.exif) {
      const exifOriginal =
        this.parseExifDate(asset.exif.DateTimeOriginal) ||
        this.parseExifDate(asset.exif.DateTimeDigitized) ||
        this.parseExifDate(asset.exif.DateTime) ||
        this.parseExifDate(asset.exif['{Exif}']?.DateTimeOriginal) ||
        this.parseExifDate(asset.exif['{TIFF}']?.DateTime);

      if (exifOriginal) return exifOriginal;
    }

    // 3. Try filename timestamp extraction
    const filenameTime =
      this.extractTimestampFromFilename(asset.fileName) ||
      this.extractTimestampFromFilename(asset.uri);
    if (filenameTime) return filenameTime;

    // 4. Try FileSystem modification time
    try {
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      if (fileInfo.exists && (fileInfo as any).modificationTime) {
        return (fileInfo as any).modificationTime * 1000;
      }
    } catch (e) {
      // Fallback
    }

    return Date.now();
  },
};
