export type ExportFormat = 'jpeg_sequence' | 'png_sequence' | 'gif_animation' | 'mp4_video';

export type ExportQuality = 'standard' | 'high' | 'ultra';

export type ExportResolution = 'original' | '1080p' | '720p' | '480p';

export interface ExportConfig {
  format: ExportFormat;
  quality: ExportQuality;
  resolution: ExportResolution;
  customFileName?: string;
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  format: 'mp4_video',
  quality: 'high',
  resolution: 'original',
};
