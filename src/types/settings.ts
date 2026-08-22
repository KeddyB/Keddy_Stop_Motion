export type OrientationMode = 'portrait' | 'landscape';

export type AspectRatioOption = '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21' | '1:1';

export type CropMode = 'aspect_ratio' | 'original_resolution';

export type PreviewResolution = 'full' | 'reduced';

export type AspectFitMode = 'cover' | 'fit';

export type ProxyQuality = 'low' | 'medium' | 'high' | 'original';

export interface AppSettings {
  // Crop settings
  cropMode: CropMode;
  
  // Preview settings
  previewResolution: PreviewResolution;
  proxyQuality: ProxyQuality;
  
  // Remote Bluetooth shutter
  remoteShutterEnabled: boolean;
  
  // Aspect ratio & scaling
  defaultAspectRatio: AspectRatioOption;
  aspectFitMode: AspectFitMode;
  
  // Speed / Frame Rate
  playbackFps: number; // 1 to 60 FPS

  // Liquid Glass & Visual Aesthetics
  liquidGlassEnabled: boolean;
  liquidGlassTransparency: number; // 0.1 to 1.0 (defaults to 0.75)
}

export const DEFAULT_SETTINGS: AppSettings = {
  cropMode: 'aspect_ratio',
  previewResolution: 'full',
  proxyQuality: 'medium',
  remoteShutterEnabled: false,
  defaultAspectRatio: '16:9',
  aspectFitMode: 'fit',
  playbackFps: 12, // Classic stop motion default
  liquidGlassEnabled: true,
  liquidGlassTransparency: 0.75,
};
