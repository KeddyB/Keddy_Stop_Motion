import { Frame } from './project';
import { DoodleStroke } from './doodle';
import { TextOverlay } from './textOverlay';

export type HistoryAction =
  | {
      type: 'ADD_FRAMES';
      frames: Frame[];
      startIndex: number;
    }
  | {
      type: 'DELETE_FRAME';
      frame: Frame;
      index: number;
    }
  | {
      type: 'DUPLICATE_ALL';
      previousFrames: Frame[];
      newFrames: Frame[];
    }
  | {
      type: 'ADD_DOODLE';
      frameIndex: number;
      stroke: DoodleStroke;
    }
  | {
      type: 'CLEAR_DOODLES';
      frameIndex: number;
      previousDoodles: DoodleStroke[];
    }
  | {
      type: 'SET_TEXT_OVERLAYS';
      frameIndex: number;
      previousTextOverlays: TextOverlay[];
      newTextOverlays: TextOverlay[];
    };

