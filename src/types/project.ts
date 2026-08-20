import { AspectRatioOption, OrientationMode } from './settings';
import { DoodleStroke } from './doodle';

export interface Frame {
  id: string;
  uri: string; // The high-res master image URI
  proxyUri?: string; // The low-res proxy thumbnail URI for hardware playback
  timestamp: number;
  doodles?: DoodleStroke[];
}

export interface AudioTrack {
  uri: string;
  name: string;
  durationSeconds?: number;
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
