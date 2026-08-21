export interface TextOverlay {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  x: number; // 0..1 relative position on canvas
  y: number; // 0..1 relative position on canvas
  rotation?: number; // degrees
  scale?: number;
  align?: 'left' | 'center' | 'right';
  shadow?: boolean;
}

export type FontCategory =
  | 'all'
  | 'pixel'
  | 'cinematic'
  | 'cursive'
  | 'comic'
  | 'scifi'
  | 'spooky'
  | 'modern';

export interface FontItem {
  id: string;
  name: string;
  family: string;
  category: FontCategory;
  url?: string;
}
