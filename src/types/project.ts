import { AspectRatioOption, OrientationMode } from './settings';
import { DoodleStroke } from './doodle';
import { TextOverlay } from './textOverlay';

export interface Frame {
  id: string;
  uri: string; // The high-res master image URI
  proxyUri?: string; // The low-res proxy thumbnail URI for hardware playback
  timestamp: number;
  doodles?: DoodleStroke[];
  textOverlays?: TextOverlay[];
}

export interface AudioTrack {
  uri: string;
  name: string;
  durationSeconds?: number;
  startOffsetSeconds?: number; // Starting delay / offset along animation timeline (in seconds)
  volume?: number; // 0.0 to 1.0 (default 1.0)
  waveformSamples?: number[]; // Normalized waveform amplitude peaks [0.0 - 1.0] for visual display
}

export interface StopMotionProject {
  id: string;
  title: string;
  orientation: OrientationMode;
  frameCount: number;
  fps: number;
  durationSeconds: number;
  lastModified: string;
  thumbnailUri?: string;
  aspectRatio: AspectRatioOption;
  frames?: Frame[];
  audioTrack?: AudioTrack;
}
