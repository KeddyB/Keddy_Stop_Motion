import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  FlatList,
  Alert,
  Platform,
  ActivityIndicator,
  BackHandler,
  Dimensions,
  PanResponder,
  ScrollView,
  TextInput,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  SharedValue,
  useAnimatedReaction,
  withRepeat,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation
} from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { useAppSettings } from '../context/SettingsContext';
import { orientationHelper } from '../utils/orientationHelper';
import { storageService } from '../services/storageService';
import { StopMotionProject, Frame, AudioTrack } from '../types/project';
import { DoodleCanvas } from '../components/DoodleCanvas';
import { TextOverlayEditor } from '../components/TextOverlayEditor';
import { StudioSettingsModal, OnionSkinConfig } from '../components/StudioSettingsModal';
import { SmearModal } from '../components/SmearModal';
import { FullScreenPlaybackModal } from '../components/FullScreenPlaybackModal';
import { ImportLoadingModal } from '../components/ImportLoadingModal';
import { VoiceoverRecordModal } from '../components/VoiceoverRecordModal';
import { ChromaKeyModal, ChromaKeyConfig } from '../components/ChromaKeyModal';
import { BatchExportModal } from '../components/BatchExportModal';
import { videoExportService, RenderProgressUpdate } from '../services/videoExportService';
import { ExportConfig } from '../types/export';
import { photoTimestampHelper } from '../utils/photoTimestampHelper';
import { DoodleStroke, Point } from '../types/doodle';
import { TextOverlay } from '../types/textOverlay';
import { fontLoader } from '../utils/fontLoader';
import { HistoryAction } from '../types/history';
import { PreviewResolution } from '../types/settings';
import { GlassSurface, GlassButton } from '../components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// -------------------------------------------------------------
// Tiny Memoized Playback Badge (Prevents Full App Re-renders)
// -------------------------------------------------------------
const PlaybackBadge = React.memo(({ activeFrameIndex, totalFrames, fps, hasAudio, previewResolution }: { activeFrameIndex: SharedValue<number>, totalFrames: number, fps: number, hasAudio: boolean, previewResolution: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useAnimatedReaction(
    () => activeFrameIndex.value,
    (curr, prev) => {
      if (curr !== prev) {
        runOnJS(setCurrentIndex)(curr);
      }
    }
  );

  return (
    <View style={styles.playbackBadge}>
      <Text style={styles.playbackBadgeText}>
        Frame {currentIndex + 1}/{totalFrames} ({fps} FPS)
        {hasAudio ? ' • Audio' : ''} • {previewResolution === 'full' ? 'HQ' : 'LQ'}
      </Text>
    </View>
  );
});

interface CameraStudioScreenProps {
  project: StopMotionProject;
  onClose: () => void;
  onUpdateProject: (updated: StopMotionProject) => void;
}

export const CameraStudioScreen: React.FC<CameraStudioScreenProps> = ({
  project,
  onClose,
  onUpdateProject,
}) => {
  const { theme } = useTheme();
  const { settings } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const filmstripRef = useRef<any>(null);

  // Camera Settings
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [isAeAfLocked, setIsAeAfLocked] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [showZoomSlider, setShowZoomSlider] = useState(false);
  const [gridMode, setGridMode] = useState<'ruleOfThirds' | 'crosshair' | 'golden' | 'none'>('ruleOfThirds');

  // Project Framerate & Playback Resolution
  const [fps, setFps] = useState(project.fps || settings.playbackFps || 12);
  const [previewResolution, setPreviewResolution] = useState<PreviewResolution>(
    settings.previewResolution || 'full'
  );

  // Bidirectional Onion Skinning State
  const [onionConfig, setOnionConfig] = useState<OnionSkinConfig>({
    enabled: true,
    prevOpacity: 0.45,
    nextOpacity: 0.35,
    showNext: true,
    depth: 1,
    colorTint: false,
  });

  // Modal State
  const [showStudioSettings, setShowStudioSettings] = useState(false);
  const [showSmearModal, setShowSmearModal] = useState(false);
  const [showVoiceoverModal, setShowVoiceoverModal] = useState(false);
  const [showChromaKeyModal, setShowChromaKeyModal] = useState(false);
  const [showFullScreenPlayback, setShowFullScreenPlayback] = useState(false);

  // Bluetooth Remote Shutter Input Ref
  const remoteShutterInputRef = useRef<TextInput>(null);

  // In-Studio Animation Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<RenderProgressUpdate | null>(null);
  const [isExportComplete, setIsExportComplete] = useState(false);
  const [exportSuccessCount, setExportSuccessCount] = useState(0);

  // Chroma Key State
  const [chromaConfig, setChromaConfig] = useState<ChromaKeyConfig>({
    enabled: false,
    keyColor: 'green',
    similarity: 0.25,
    smoothness: 0.1,
    backdropType: 'preset',
    presetId: 'space',
    backdropUri: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
  });

  // Onion Skin Blink State
  const [isBlinkVisible, setIsBlinkVisible] = useState(true);

  // Frames & Timeline
  const [frames, setFrames] = useState<Frame[]>(project.frames || []);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(
    project.frames && project.frames.length > 0 ? project.frames.length - 1 : null
  );
  const [isSoloView, setIsSoloView] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Multi-Frame Selection State
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);

  // Intervalometer State
  const [isAutoCaptureActive, setIsAutoCaptureActive] = useState(false);
  const [autoCaptureInterval, setAutoCaptureInterval] = useState(3);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState(0);

  // Reanimated shared values for UI-thread frame timing & smooth scrubbing
  const playbackProgress = useSharedValue(0);
  const playbackFrameIndex = useSharedValue(0);
  const scrubFrameIndex = useSharedValue(
    project.frames && project.frames.length > 0 ? project.frames.length - 1 : 0
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const offsetX = event.contentOffset.x;
      const idx = Math.max(0, Math.round(offsetX / 70));
      if (scrubFrameIndex.value !== idx) {
        scrubFrameIndex.value = idx;
      }
    }
  });

  // Pre-warm / prefetch all frame image textures into memory cache for zero-lag scrubbing
  useEffect(() => {
    if (frames.length > 0) {
      const uris = frames.map((f) => f.proxyUri || f.uri).filter(Boolean) as string[];
      ExpoImage.prefetch(uris);
    }
  }, [frames]);

  // Initial mount: scroll to last frame under fixed center square
  useEffect(() => {
    if (frames.length > 0) {
      const initialIndex = frames.length - 1;
      setActiveFrameIndex(initialIndex);
      scrubFrameIndex.value = initialIndex;
      const timer = setTimeout(() => {
        filmstripRef.current?.scrollToOffset({
          offset: initialIndex * 70,
          animated: false,
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Onion Skin Blink Frequency Interval
  useEffect(() => {
    if (!onionConfig.enabled || onionConfig.mode !== 'blink' || isPlaying || isSoloView) {
      setIsBlinkVisible(true);
      return;
    }
    const hz = onionConfig.blinkSpeedHz || 4;
    const intervalMs = Math.round(1000 / (hz * 2));
    const interval = setInterval(() => {
      setIsBlinkVisible((prev) => !prev);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [onionConfig.enabled, onionConfig.mode, onionConfig.blinkSpeedHz, isPlaying, isSoloView]);




  // Import Loading State
  const [importLoadingState, setImportLoadingState] = useState<{
    visible: boolean;
    current: number;
    total: number;
    stageMessage?: string;
  }>({
    visible: false,
    current: 0,
    total: 0,
  });

  // Audio State
  const [audioTrack, setAudioTrack] = useState<AudioTrack | undefined>(project.audioTrack);

  // Doodle Mode State
  const [isDoodleMode, setIsDoodleMode] = useState(false);

  // Text Overlay Mode State (100 Offline Google Fonts)
  const [isTextMode, setIsTextMode] = useState(false);

  // Playback Loop Modes: 'loop' (continuous) | 'bounce' (ping-pong) | 'once'
  const [loopMode, setLoopMode] = useState<'loop' | 'bounce' | 'once'>('loop');
  const [playbackDirection, setPlaybackDirection] = useState<'forward' | 'backward'>('forward');

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);

  const isLandscape = project.orientation === 'landscape';

  // 1. Lock screen orientation on mount & restore on exit
  useEffect(() => {
    orientationHelper.lockForProject(project.orientation);
    return () => {
      orientationHelper.resetToPortrait();
      if (playerRef.current) {
        playerRef.current.release();
        playerRef.current = null;
      }
    };
  }, [project.orientation]);

  // Universal Hardware & Gesture Back Handler
  useEffect(() => {
    const onHardwareBack = () => {
      if (showFullScreenPlayback) {
        setShowFullScreenPlayback(false);
        return true;
      }
      if (showStudioSettings) {
        setShowStudioSettings(false);
        return true;
      }
      if (showSmearModal) {
        setShowSmearModal(false);
        return true;
      }
      if (isDoodleMode) {
        setIsDoodleMode(false);
        return true;
      }
      if (isSoloView) {
        setIsSoloView(false);
        return true;
      }
      if (isPlaying) {
        setIsPlaying(false);
        return true;
      }
      // Otherwise exit studio back to main screen
      onClose();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [showFullScreenPlayback, showStudioSettings, showSmearModal, isDoodleMode, isSoloView, isPlaying, onClose]);

  const audioDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-load / pre-warm audio player whenever audioTrack is changed
  useEffect(() => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.release();
      } catch {}
      playerRef.current = null;
    }

    if (audioTrack?.uri) {
      try {
        const player = createAudioPlayer({ uri: audioTrack.uri });
        player.loop = true;
        player.volume = audioTrack.volume ?? 1.0;
        playerRef.current = player;
      } catch (e) {
        console.warn('Eager audio player init error:', e);
      }
    }

    return () => {
      if (audioDelayTimerRef.current) {
        clearTimeout(audioDelayTimerRef.current);
        audioDelayTimerRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.release();
        } catch {}
      }
    };
  }, [audioTrack?.uri, audioTrack?.volume]);

  // 2. Playback sequence timer & Audio Sync (with Loop / Bounce / Once & startOffset support)
  useEffect(() => {
    const startAudioSync = () => {
      if (audioDelayTimerRef.current) {
        clearTimeout(audioDelayTimerRef.current);
        audioDelayTimerRef.current = null;
      }

      if (audioTrack?.uri) {
        try {
          if (!playerRef.current) {
            playerRef.current = createAudioPlayer({ uri: audioTrack.uri });
            playerRef.current.loop = true;
          }
          playerRef.current.volume = audioTrack.volume ?? 1.0;

          const offsetMs = Math.max(0, Math.round((audioTrack.startOffsetSeconds || 0) * 1000));
          if (offsetMs === 0) {
            playerRef.current.seekTo(0);
            playerRef.current.play();
          } else {
            playerRef.current.pause();
            playerRef.current.seekTo(0);
            audioDelayTimerRef.current = setTimeout(() => {
              if (playerRef.current) {
                playerRef.current.play();
              }
            }, offsetMs);
          }
        } catch (e) {
          console.warn('Audio play error:', e);
        }
      }
    };

    const stopAudioSync = () => {
      if (audioDelayTimerRef.current) {
        clearTimeout(audioDelayTimerRef.current);
        audioDelayTimerRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.seekTo(0);
        } catch (e) {
          console.warn('Audio stop error:', e);
        }
      }
    };

    if (isPlaying && frames.length > 0) {
      // Pre-warm / prefetch all frames in memory cache to eliminate any decode lag
      const uris = frames.map(f => f.uri).filter(uri => !!uri) as string[];
      ExpoImage.prefetch(uris);

      startAudioSync();
      const totalFrames = frames.length;
      const totalDurationMs = (totalFrames / fps) * 1000;

      playbackProgress.value = 0;

      if (loopMode === 'once') {
        playbackProgress.value = withTiming(1, {
          duration: totalDurationMs,
          easing: Easing.linear,
        }, (finished) => {
          if (finished) runOnJS(setIsPlaying)(false);
        });
      } else {
        playbackProgress.value = withRepeat(
          withTiming(1, {
            duration: totalDurationMs,
            easing: Easing.linear,
          }),
          -1, // Loop forever
          loopMode === 'bounce' // true for bounce, false for loop
        );
      }
    } else {
      cancelAnimation(playbackProgress);
      stopAudioSync();
      setPlaybackDirection('forward');
    }

    return () => {
      cancelAnimation(playbackProgress);
      stopAudioSync();
    };
  }, [isPlaying, frames.length, fps, audioTrack, loopMode]);

  useAnimatedReaction(
    () => {
      if (frames.length === 0) return 0;
      return Math.min(frames.length - 1, Math.max(0, Math.floor(playbackProgress.value * frames.length)));
    },
    (nextFrameIndex, prevFrameIndex) => {
      if (nextFrameIndex !== prevFrameIndex) {
        playbackFrameIndex.value = nextFrameIndex;
      }
    },
    [frames.length]
  );

  // 2.5 Auto-Capture Intervalometer Effect
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isAutoCaptureActive && !isPlaying && !isDoodleMode) {
      timer = setInterval(() => {
        setAutoCaptureCountdown((prev) => {
          if (prev <= 1) {
            handleCapture();
            return autoCaptureInterval;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setAutoCaptureCountdown(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAutoCaptureActive, autoCaptureInterval, isPlaying, isDoodleMode, frames.length]);

  // Helper to persist updated frames and notify parent
  const syncProjectChanges = async (
    newFrames: Frame[],
    newFps?: number,
    newAudio?: AudioTrack
  ) => {
    const currentFps = newFps !== undefined ? newFps : fps;
    const durationSeconds = Number((newFrames.length / currentFps).toFixed(1));
    const currentAudio = newAudio !== undefined ? newAudio : audioTrack;
    const updatedProject: StopMotionProject = {
      ...project,
      fps: currentFps,
      frameCount: newFrames.length,
      durationSeconds,
      lastModified: 'Just now',
      thumbnailUri: newFrames.length > 0 ? newFrames[newFrames.length - 1].uri : undefined,
      frames: newFrames,
      audioTrack: currentAudio,
    };
    await storageService.saveProject(updatedProject);
    onUpdateProject(updatedProject);
  };

  const handleChangeFps = async (newFps: number) => {
    setFps(newFps);
    await syncProjectChanges(frames, newFps);
  };

  // 3. Shutter Capture Handler
  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: previewResolution === 'full' ? 0.95 : 0.75,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        setIsCapturing(false);
        return;
      }

      const timestamp = Date.now();
      const frameId = `frame_${timestamp}`;
      const framesDir = storageService.getProjectFramesDirectory(project.id);
      const targetPath = `${framesDir}${frameId}.jpg`;
      const proxyPath = `${framesDir}${frameId}_proxy.jpg`;

      // 1. Calculate Crop Rectangle to match targetAspectRatio exactly with Viewfinder
      let photoW = photo.width || 1920;
      let photoH = photo.height || 1080;
      const isProjectLandscape = targetAspectRatio >= 1.0;
      const isPhotoLandscape = photoW >= photoH;

      const fullManip = ImageManipulator.manipulate(photo.uri);

      // If photo was captured in opposite orientation due to phone gyro angle, normalize rotation to project orientation
      if (isProjectLandscape !== isPhotoLandscape) {
        fullManip.rotate(90);
        const temp = photoW;
        photoW = photoH;
        photoH = temp;
      }

      const photoRatio = photoW / photoH;
      const targetRatio = targetAspectRatio;

      let cropOriginX = 0;
      let cropOriginY = 0;
      let cropW = photoW;
      let cropH = photoH;

      if (Math.abs(photoRatio - targetRatio) > 0.01) {
        if (photoRatio > targetRatio) {
          // Photo is wider than viewfinder target ratio -> crop left/right sides
          cropH = photoH;
          cropW = Math.round(photoH * targetRatio);
          cropOriginX = Math.round((photoW - cropW) / 2);
          cropOriginY = 0;
        } else {
          // Photo is taller than viewfinder target ratio -> crop top/bottom
          cropW = photoW;
          cropH = Math.round(photoW / targetRatio);
          cropOriginX = 0;
          cropOriginY = Math.round((photoH - cropH) / 2);
        }
      }

      // Crop high-res photo to exact viewfinder framing
      if (Math.abs(photoRatio - targetRatio) > 0.01) {
        fullManip.crop({
          originX: cropOriginX,
          originY: cropOriginY,
          width: cropW,
          height: cropH,
        });
      }
      const fullImageRef = await fullManip.renderAsync();
      const fullResult = await fullImageRef.saveAsync({
        compress: previewResolution === 'full' ? 0.95 : 0.80,
        format: SaveFormat.JPEG,
      });

      if (FileSystem.documentDirectory) {
        await FileSystem.makeDirectoryAsync(framesDir, { intermediates: true });
        await FileSystem.copyAsync({
          from: fullResult.uri,
          to: targetPath,
        });
      }

      let finalProxyUri = FileSystem.documentDirectory ? targetPath : fullResult.uri;

      // Generate Proxy if needed
      if (settings.proxyQuality !== 'original') {
        const proxyWidth = settings.proxyQuality === 'high' ? 1080 : settings.proxyQuality === 'medium' ? 720 : 480;
        const proxyManip = ImageManipulator.manipulate(fullResult.uri);
        proxyManip.resize({ width: proxyWidth });
        const proxyImageRef = await proxyManip.renderAsync();
        const proxyResult = await proxyImageRef.saveAsync({ compress: 0.5, format: SaveFormat.JPEG });

        if (FileSystem.documentDirectory) {
          await FileSystem.makeDirectoryAsync(framesDir, { intermediates: true });
          await FileSystem.copyAsync({
            from: proxyResult.uri,
            to: proxyPath,
          });
          finalProxyUri = proxyPath;
        } else {
          finalProxyUri = proxyResult.uri;
        }
      }

      const newFrame: Frame = {
        id: frameId,
        uri: FileSystem.documentDirectory ? targetPath : fullResult.uri,
        proxyUri: finalProxyUri,
        timestamp,
      };

      // Insert immediately after currently active / scrubbed frame
      const insertIndex =
        activeFrameIndex !== null && activeFrameIndex >= 0 && activeFrameIndex < frames.length
          ? activeFrameIndex + 1
          : frames.length;

      const updatedFrames = [
        ...frames.slice(0, insertIndex),
        newFrame,
        ...frames.slice(insertIndex),
      ];

      setFrames(updatedFrames);
      setActiveFrameIndex(insertIndex);
      scrubFrameIndex.value = insertIndex;
      setIsSoloView(false);

      // Auto-scroll newly captured frame to center
      setTimeout(() => {
        filmstripRef.current?.scrollToOffset({
          offset: insertIndex * 70,
          animated: true,
        });
      }, 50);

      // Record in undo stack
      setUndoStack((prev) => [
        ...prev,
        {
          type: 'ADD_FRAMES',
          frames: [newFrame],
          startIndex: insertIndex,
        },
      ]);
      setRedoStack([]);

      await syncProjectChanges(updatedFrames);
    } catch (e) {
      console.warn('Capture error:', e);
      Alert.alert('Capture Error', 'Failed to capture frame from camera.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Web / Desktop & Remote Bluetooth Shutter Hotkeys
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isPlaying && !isCapturing) {
          handleCapture();
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setActiveFrameIndex((prev) => Math.max(0, (prev ?? 0) - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setActiveFrameIndex((prev) => Math.min(frames.length - 1, (prev ?? 0) + 1));
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        setIsAeAfLocked((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isCapturing, frames.length]);

  // Frame Reordering Handlers
  const handleMoveFrameLeft = (index: number) => {
    if (index <= 0 || index >= frames.length) return;
    const updated = [...frames];
    const [moved] = updated.splice(index, 1);
    updated.splice(index - 1, 0, moved);
    setFrames(updated);
    setActiveFrameIndex(index - 1);
    filmstripRef.current?.scrollToOffset({ offset: (index - 1) * 70, animated: true });
    syncProjectChanges(updated);
  };

  const handleMoveFrameRight = (index: number) => {
    if (index < 0 || index >= frames.length - 1) return;
    const updated = [...frames];
    const [moved] = updated.splice(index, 1);
    updated.splice(index + 1, 0, moved);
    setFrames(updated);
    setActiveFrameIndex(index + 1);
    filmstripRef.current?.scrollToOffset({ offset: (index + 1) * 70, animated: true });
    syncProjectChanges(updated);
  };

  // Multi-Select Batch Operations
  const handleToggleSelectFrame = (id: string) => {
    setSelectedFrameIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedFrameIds.length === frames.length) {
      setSelectedFrameIds([]);
    } else {
      setSelectedFrameIds(frames.map((f) => f.id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedFrameIds.length === 0) return;
    Alert.alert(
      'Delete Selected Frames',
      `Are you sure you want to delete ${selectedFrameIds.length} selected frame(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const remaining = frames.filter((f) => !selectedFrameIds.includes(f.id));
            setFrames(remaining);
            setSelectedFrameIds([]);
            setIsMultiSelect(false);
            setActiveFrameIndex(Math.max(0, remaining.length - 1));
            syncProjectChanges(remaining);
          },
        },
      ]
    );
  };

  const handleBatchDuplicate = () => {
    if (selectedFrameIds.length === 0) return;
    const newFrames: Frame[] = [];
    frames.forEach((f) => {
      newFrames.push(f);
      if (selectedFrameIds.includes(f.id)) {
        newFrames.push({
          ...f,
          id: `${f.id}_dup_${Date.now()}`,
          doodles: f.doodles ? [...f.doodles] : undefined,
          textOverlays: f.textOverlays ? [...f.textOverlays] : undefined,
        });
      }
    });
    setFrames(newFrames);
    setSelectedFrameIds([]);
    setIsMultiSelect(false);
    syncProjectChanges(newFrames);
  };

  const handleBatchReverse = () => {
    if (selectedFrameIds.length < 2) return;
    const selectedIndices = frames
      .map((f, idx) => (selectedFrameIds.includes(f.id) ? idx : -1))
      .filter((idx) => idx !== -1);
    const minIdx = Math.min(...selectedIndices);
    const maxIdx = Math.max(...selectedIndices);

    const sliceToReverse = frames.slice(minIdx, maxIdx + 1);
    const reversed = [...sliceToReverse].reverse();

    const updated = [...frames.slice(0, minIdx), ...reversed, ...frames.slice(maxIdx + 1)];
    setFrames(updated);
    setSelectedFrameIds([]);
    setIsMultiSelect(false);
    syncProjectChanges(updated);
  };

  const handleSaveVoiceover = async (savedAudioTrack: AudioTrack) => {
    setAudioTrack(savedAudioTrack);
    await syncProjectChanges(frames, undefined, savedAudioTrack);
  };

  // In-Studio Export Handler
  const handleExecuteStudioExport = async (exportConfig: ExportConfig) => {
    try {
      setIsExporting(true);
      setIsExportComplete(false);
      setExportProgress(null);

      const currentProjectState: StopMotionProject = {
        ...project,
        fps,
        frames,
        audioTrack,
        frameCount: frames.length,
        durationSeconds: frames.length / fps,
      };

      const { successCount, errors } = await videoExportService.renderProjectsBatch(
        [currentProjectState],
        (progressUpdate) => {
          setExportProgress(progressUpdate);
        },
        exportConfig
      );

      setExportSuccessCount(successCount);
      setIsExportComplete(true);

      if (errors.length > 0) {
        Alert.alert('Export Notice', errors.join('\n'));
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'An error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  };

  // 4. Import Images from Storage with Accurate Chronological Snap Time Sorting
  const handleImportImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
        exif: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const totalAssets = result.assets.length;
      setImportLoadingState({
        visible: true,
        current: 0,
        total: totalAssets,
        stageMessage: 'Analyzing photo capture timestamps...',
      });

      // 1. Resolve exact snap times for each asset
      const assetsWithTime: Array<{ asset: ImagePicker.ImagePickerAsset; snapTime: number }> = [];
      for (let i = 0; i < totalAssets; i++) {
        const asset = result.assets[i];
        const snapTime = await photoTimestampHelper.getExactCaptureTime(asset);
        assetsWithTime.push({ asset, snapTime });
      }

      // 2. Sort strictly by photo capture timestamp (oldest first)
      assetsWithTime.sort((a, b) => a.snapTime - b.snapTime);

      const framesDir = storageService.getProjectFramesDirectory(project.id);
      const importedFrames: Frame[] = [];

      // 3. Copy files to project frames directory with live progress
      for (let i = 0; i < assetsWithTime.length; i++) {
        const { asset, snapTime } = assetsWithTime[i];
        const frameId = `import_${snapTime}_${i}`;
        const targetPath = `${framesDir}${frameId}.jpg`;
        const proxyPath = `${framesDir}${frameId}_proxy.jpg`;

        setImportLoadingState((prev) => ({
          ...prev,
          current: i + 1,
          stageMessage: `Preparing frame ${i + 1} of ${totalAssets}...`,
        }));

        // 1. Calculate Crop Rectangle to match targetAspectRatio for imported photo
        const assetW = asset.width || 1920;
        const assetH = asset.height || 1080;
        const assetRatio = assetW / assetH;
        const targetRatio = targetAspectRatio;

        let cropOriginX = 0;
        let cropOriginY = 0;
        let cropW = assetW;
        let cropH = assetH;

        if (Math.abs(assetRatio - targetRatio) > 0.01) {
          if (assetRatio > targetRatio) {
            cropH = assetH;
            cropW = Math.round(assetH * targetRatio);
            cropOriginX = Math.round((assetW - cropW) / 2);
            cropOriginY = 0;
          } else {
            cropW = assetW;
            cropH = Math.round(assetW / targetRatio);
            cropOriginX = 0;
            cropOriginY = Math.round((assetH - cropH) / 2);
          }
        }

        const importManip = ImageManipulator.manipulate(asset.uri);
        if (Math.abs(assetRatio - targetRatio) > 0.01) {
          importManip.crop({
            originX: cropOriginX,
            originY: cropOriginY,
            width: cropW,
            height: cropH,
          });
        }
        const rendered = await importManip.renderAsync();
        const savedResult = await rendered.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });

        if (FileSystem.documentDirectory) {
          await FileSystem.copyAsync({
            from: savedResult.uri,
            to: targetPath,
          });
        }

        let finalProxyUri = FileSystem.documentDirectory ? targetPath : savedResult.uri;

        if (settings.proxyQuality !== 'original') {
          const proxyWidth = settings.proxyQuality === 'high' ? 1080 : settings.proxyQuality === 'medium' ? 720 : 480;
          const proxyManip = ImageManipulator.manipulate(savedResult.uri);
          proxyManip.resize({ width: proxyWidth });
          const imageRef = await proxyManip.renderAsync();
          const proxyResult = await imageRef.saveAsync({ compress: 0.5, format: SaveFormat.JPEG });

          if (FileSystem.documentDirectory) {
            await FileSystem.copyAsync({
              from: proxyResult.uri,
              to: proxyPath,
            });
            finalProxyUri = proxyPath;
          } else {
            finalProxyUri = proxyResult.uri;
          }
        }

        importedFrames.push({
          id: frameId,
          uri: FileSystem.documentDirectory ? targetPath : savedResult.uri,
          proxyUri: finalProxyUri,
          timestamp: snapTime,
        });
      }

      const updatedFrames = [...frames, ...importedFrames];
      setFrames(updatedFrames);

      setUndoStack((prev) => [
        ...prev,
        {
          type: 'ADD_FRAMES',
          frames: importedFrames,
          startIndex: frames.length,
        },
      ]);
      setRedoStack([]);

      await syncProjectChanges(updatedFrames);
      setImportLoadingState({ visible: false, current: 0, total: 0 });
    } catch (e) {
      setImportLoadingState({ visible: false, current: 0, total: 0 });
      console.warn('Import error:', e);
      Alert.alert('Import Failed', 'Could not import images from device storage.');
    }
  };

  // 5. Audio Track Picker
  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const projectDir = storageService.getProjectDirectory(project.id);
      const audioPath = `${projectDir}soundtrack_${Date.now()}.${asset.name.split('.').pop() || 'mp3'}`;

      if (FileSystem.documentDirectory) {
        await FileSystem.copyAsync({
          from: asset.uri,
          to: audioPath,
        });
      }

      const newAudioTrack: AudioTrack = {
        uri: FileSystem.documentDirectory ? audioPath : asset.uri,
        name: asset.name,
      };

      setAudioTrack(newAudioTrack);
      await syncProjectChanges(frames, undefined, newAudioTrack);
      Alert.alert('Audio Synced', `Synced "${asset.name}" with animation playback.`);
    } catch (e) {
      console.warn('Audio pick error:', e);
      Alert.alert('Audio Error', 'Failed to load audio file.');
    }
  };

  const handleRemoveAudio = async () => {
    setAudioTrack(undefined);
    await syncProjectChanges(frames, undefined, undefined);
  };

  // 6. Duplicate All Frames (Hold on 2s)
  const handleDuplicateAllOn2s = () => {
    if (frames.length === 0) return;
    Alert.alert(
      'Hold on 2s (Duplicate All)',
      `Duplicate all ${frames.length} frames so each drawing/photo holds for 2 frames? (Total will become ${frames.length * 2} frames)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Duplicate All on 2s',
          onPress: () => {
            const duplicated: Frame[] = [];
            frames.forEach((f, idx) => {
              duplicated.push(f);
              duplicated.push({
                ...f,
                id: `${f.id}_dup_${idx}_${Date.now()}`,
                doodles: f.doodles ? [...f.doodles] : undefined,
                textOverlays: f.textOverlays ? [...f.textOverlays] : undefined,
              });
            });

            setUndoStack((prev) => [
              ...prev,
              {
                type: 'DUPLICATE_ALL',
                previousFrames: frames,
                newFrames: duplicated,
              },
            ]);
            setRedoStack([]);

            setFrames(duplicated);
            syncProjectChanges(duplicated);
          },
        },
      ]
    );
  };

  // 7. Duplicate Single Frame
  const handleDuplicateSingleFrame = (index: number) => {
    if (index < 0 || index >= frames.length) return;
    const target = frames[index];
    const newFrame: Frame = {
      ...target,
      id: `${target.id}_dup_${Date.now()}`,
      doodles: target.doodles ? [...target.doodles] : undefined,
      textOverlays: target.textOverlays ? [...target.textOverlays] : undefined,
    };

    const updated = [...frames];
    updated.splice(index + 1, 0, newFrame);
    setFrames(updated);
    setActiveFrameIndex(index + 1);

    setUndoStack((prev) => [
      ...prev,
      {
        type: 'ADD_FRAMES',
        frames: [newFrame],
        startIndex: index + 1,
      },
    ]);
    setRedoStack([]);

    syncProjectChanges(updated);
  };

  // 8. Insert Generated Smear Frame
  const handleInsertSmearFrame = (newFrame: Frame, insertIndex?: number) => {
    const insertAt =
      insertIndex !== undefined
        ? insertIndex
        : activeFrameIndex !== null
        ? activeFrameIndex + 1
        : frames.length - 1;
    const updated = [...frames];
    updated.splice(insertAt, 0, newFrame);
    setFrames(updated);
    setActiveFrameIndex(insertAt);
    scrubFrameIndex.value = insertAt;
    setIsSoloView(true);

    setTimeout(() => {
      filmstripRef.current?.scrollToOffset({
        offset: insertAt * 70,
        animated: true,
      });
    }, 50);

    setUndoStack((prev) => [
      ...prev,
      {
        type: 'ADD_FRAMES',
        frames: [newFrame],
        startIndex: insertAt,
      },
    ]);
    setRedoStack([]);

    syncProjectChanges(updated);
  };

  // 9. Delete Frame with Undo Support
  const handleDeleteFrame = (index: number) => {
    if (index < 0 || index >= frames.length) return;
    const frameToDelete = frames[index];

    const updatedFrames = frames.filter((_, idx) => idx !== index);
    setFrames(updatedFrames);
    setActiveFrameIndex(Math.max(0, Math.min(updatedFrames.length - 1, index)));

    setUndoStack((prev) => [
      ...prev,
      {
        type: 'DELETE_FRAME',
        frame: frameToDelete,
        index,
      },
    ]);
    setRedoStack([]);

    syncProjectChanges(updatedFrames);
  };

  // 10. Hand Doodle Handlers
  const currentTargetFrameIndex =
    activeFrameIndex !== null ? activeFrameIndex : Math.max(0, frames.length - 1);
  const currentTargetFrame = frames[currentTargetFrameIndex];

  const handleAddDoodleStroke = (stroke: DoodleStroke) => {
    setFrames((prevFrames) => {
      const targetIndex = activeFrameIndex !== null ? activeFrameIndex : Math.max(0, prevFrames.length - 1);
      const target = prevFrames[targetIndex];
      if (!target) return prevFrames;
      const updatedDoodles = [...(target.doodles || []), stroke];
      const updatedFrames = [...prevFrames];
      updatedFrames[targetIndex] = {
        ...target,
        doodles: updatedDoodles,
      };

      setUndoStack((prev) => [
        ...prev,
        {
          type: 'ADD_DOODLE',
          frameIndex: targetIndex,
          stroke,
        },
      ]);
      setRedoStack([]);

      syncProjectChanges(updatedFrames);
      return updatedFrames;
    });
  };

  const handleUndoDoodleStroke = () => {
    setFrames((prevFrames) => {
      const targetIndex = activeFrameIndex !== null ? activeFrameIndex : Math.max(0, prevFrames.length - 1);
      const target = prevFrames[targetIndex];
      if (!target || !target.doodles || target.doodles.length === 0) return prevFrames;
      const lastStroke = target.doodles[target.doodles.length - 1];
      const updatedDoodles = target.doodles.slice(0, -1);
      const updatedFrames = [...prevFrames];
      updatedFrames[targetIndex] = {
        ...target,
        doodles: updatedDoodles,
      };

      setUndoStack((prev) => [
        ...prev,
        {
          type: 'ADD_DOODLE',
          frameIndex: targetIndex,
          stroke: lastStroke,
        },
      ]);
      setRedoStack([]);

      syncProjectChanges(updatedFrames);
      return updatedFrames;
    });
  };

  const handleClearFrameDoodles = () => {
    setFrames((prevFrames) => {
      const targetIndex = activeFrameIndex !== null ? activeFrameIndex : Math.max(0, prevFrames.length - 1);
      const target = prevFrames[targetIndex];
      if (!target || !target.doodles || target.doodles.length === 0) return prevFrames;
      const prevDoodles = target.doodles;
      const updatedFrames = [...prevFrames];
      updatedFrames[targetIndex] = {
        ...target,
        doodles: [],
      };

      setUndoStack((prev) => [
        ...prev,
        {
          type: 'CLEAR_DOODLES',
          frameIndex: targetIndex,
          previousDoodles: prevDoodles,
        },
      ]);
      setRedoStack([]);

      syncProjectChanges(updatedFrames);
      return updatedFrames;
    });
  };

  // 10B. Text Overlay Handler
  const handleSaveTextOverlays = (updatedOverlays: TextOverlay[]) => {
    setFrames((prevFrames) => {
      const targetIndex = activeFrameIndex !== null ? activeFrameIndex : Math.max(0, prevFrames.length - 1);
      const target = prevFrames[targetIndex];
      if (!target) return prevFrames;
      const prevTextOverlays = target.textOverlays || [];
      const updatedFrames = [...prevFrames];
      updatedFrames[targetIndex] = {
        ...target,
        textOverlays: updatedOverlays,
      };

      setUndoStack((prev) => [
        ...prev,
        {
          type: 'SET_TEXT_OVERLAYS',
          frameIndex: targetIndex,
          previousTextOverlays: prevTextOverlays,
          newTextOverlays: updatedOverlays,
        },
      ]);
      setRedoStack([]);

      syncProjectChanges(updatedFrames);
      return updatedFrames;
    });
  };

  // Reverse Sequence
  const handleReverseFrames = () => {
    if (frames.length < 2) return;
    Alert.alert(
      'Reverse All Frames',
      'Do you want to reverse the order of all captured frames in this animation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reverse',
          onPress: () => {
            const reversed = [...frames].reverse();
            setUndoStack((prev) => [
              ...prev,
              {
                type: 'DUPLICATE_ALL',
                previousFrames: frames,
                newFrames: reversed,
              },
            ]);
            setRedoStack([]);
            setFrames(reversed);
            syncProjectChanges(reversed);
          },
        },
      ]
    );
  };

  // 11. Undo & Redo Handlers
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    const nextUndoStack = undoStack.slice(0, -1);

    if (action.type === 'DELETE_FRAME') {
      const updatedFrames = [...frames];
      updatedFrames.splice(action.index, 0, action.frame);
      setFrames(updatedFrames);
      syncProjectChanges(updatedFrames);
    } else if (action.type === 'ADD_FRAMES') {
      const updatedFrames = frames.filter((f) => !action.frames.some((af) => af.id === f.id));
      setFrames(updatedFrames);
      syncProjectChanges(updatedFrames);
    } else if (action.type === 'DUPLICATE_ALL') {
      setFrames(action.previousFrames);
      syncProjectChanges(action.previousFrames);
    } else if (action.type === 'ADD_DOODLE') {
      const targetFrame = frames[action.frameIndex];
      if (targetFrame && targetFrame.doodles) {
        const updatedDoodles = targetFrame.doodles.filter((s) => s.id !== action.stroke.id);
        const updatedFrames = [...frames];
        updatedFrames[action.frameIndex] = { ...targetFrame, doodles: updatedDoodles };
        setFrames(updatedFrames);
        syncProjectChanges(updatedFrames);
      }
    } else if (action.type === 'CLEAR_DOODLES') {
      const targetFrame = frames[action.frameIndex];
      if (targetFrame) {
        const updatedFrames = [...frames];
        updatedFrames[action.frameIndex] = { ...targetFrame, doodles: action.previousDoodles };
        setFrames(updatedFrames);
        syncProjectChanges(updatedFrames);
      }
    } else if (action.type === 'SET_TEXT_OVERLAYS') {
      const targetFrame = frames[action.frameIndex];
      if (targetFrame) {
        const updatedFrames = [...frames];
        updatedFrames[action.frameIndex] = { ...targetFrame, textOverlays: action.previousTextOverlays };
        setFrames(updatedFrames);
        syncProjectChanges(updatedFrames);
      }
    }

    setUndoStack(nextUndoStack);
    setRedoStack((prev) => [...prev, action]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    const nextRedoStack = redoStack.slice(0, -1);

    if (action.type === 'DELETE_FRAME') {
      const updatedFrames = frames.filter((_, idx) => idx !== action.index);
      setFrames(updatedFrames);
      syncProjectChanges(updatedFrames);
    } else if (action.type === 'ADD_FRAMES') {
      const updatedFrames = [...frames, ...action.frames];
      setFrames(updatedFrames);
      syncProjectChanges(updatedFrames);
    } else if (action.type === 'DUPLICATE_ALL') {
      setFrames(action.newFrames);
      syncProjectChanges(action.newFrames);
    } else if (action.type === 'ADD_DOODLE') {
      const targetFrame = frames[action.frameIndex];
      if (targetFrame) {
        const updatedDoodles = [...(targetFrame.doodles || []), action.stroke];
        const updatedFrames = [...frames];
        updatedFrames[action.frameIndex] = { ...targetFrame, doodles: updatedDoodles };
        setFrames(updatedFrames);
        syncProjectChanges(updatedFrames);
      }
    } else if (action.type === 'CLEAR_DOODLES') {
      const targetFrame = frames[action.frameIndex];
      if (targetFrame) {
        const updatedFrames = [...frames];
        updatedFrames[action.frameIndex] = { ...targetFrame, doodles: [] };
        setFrames(updatedFrames);
        syncProjectChanges(updatedFrames);
      }
    } else if (action.type === 'SET_TEXT_OVERLAYS') {
      const targetFrame = frames[action.frameIndex];
      if (targetFrame) {
        const updatedFrames = [...frames];
        updatedFrames[action.frameIndex] = { ...targetFrame, textOverlays: action.newTextOverlays };
        setFrames(updatedFrames);
        syncProjectChanges(updatedFrames);
      }
    }

    setRedoStack(nextRedoStack);
    setUndoStack((prev) => [...prev, action]);
  };


  // 12. Active Ghost Frame for Onion Skinning
  const activeGhostFrame =
    activeFrameIndex !== null && activeFrameIndex >= 0 && activeFrameIndex < frames.length
      ? frames[activeFrameIndex]
      : frames.length > 0
        ? frames[frames.length - 1]
        : null;

  const forwardGhostFrame =
    activeFrameIndex !== null && activeFrameIndex + 1 < frames.length
      ? frames[activeFrameIndex + 1]
      : null;

  // Smear target frames
  const smearFrameA =
    activeFrameIndex !== null && activeFrameIndex < frames.length - 1
      ? frames[activeFrameIndex]
      : frames.length >= 2
        ? frames[frames.length - 2]
        : null;
  const smearFrameB =
    activeFrameIndex !== null && activeFrameIndex < frames.length - 1
      ? frames[activeFrameIndex + 1]
      : frames.length >= 2
        ? frames[frames.length - 1]
        : null;

  // Render loading spinner while permission state is being resolved
  // Dynamic Aspect Ratio calculation from project settings
  const parseAspectRatioValue = (ratio?: string, landscape?: boolean): number => {
    if (!ratio) return landscape ? 16 / 9 : 9 / 16;
    const parts = ratio.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
      return parts[0] / parts[1];
    }
    return landscape ? 16 / 9 : 9 / 16;
  };

  const targetAspectRatio = parseAspectRatioValue(project.aspectRatio, isLandscape);

  if (!permission) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Render permission request screen only if explicitly not granted
  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: theme.background }]}>
        <View style={styles.permissionCardWrapper}>
          <GlassSurface
            variant="elevated"
            borderRadius={24}
            contentStyle={styles.permissionCardContent}
          >
            <Ionicons name="camera-outline" size={48} color={theme.primary} />
            <Text style={[styles.permissionTitle, { color: theme.text }]}>Camera Access Required</Text>
            <Text style={[styles.permissionText, { color: theme.textMuted }]}>
              Keddy Stop Motion needs access to your device camera to capture frame by frame animation.
            </Text>
            <GlassButton
              size="lg"
              color="primary"
              label="Enable Camera"
              onPress={requestPermission}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <GlassButton
              size="md"
              label="Back to Studio"
              onPress={onClose}
              style={{ width: '100%' }}
            />
          </GlassSurface>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { flexDirection: 'column', backgroundColor: theme.background }]}>
      {/* Top Header HUD Bar */}
      <View
        style={[
          styles.topHud,
          {
            paddingTop: Math.max(insets.top, 10),
            paddingHorizontal: Math.max(insets.left, insets.right, 14),
          },
        ]}
      >
        {/* Back Button */}
        <Pressable
          style={({ pressed }) => [
            styles.hudIconButton,
            {
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.90 : 1 }],
            },
          ]}
          unstable_pressDelay={0}
          pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onClose}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>

        {/* Project Title */}
        <View style={styles.titleInfo}>
          <Text style={styles.hudProjectTitle} numberOfLines={1}>
            {project.title}
          </Text>
          <Text style={styles.hudFrameCountSubtitle}>
            {frames.length} {frames.length === 1 ? 'frame' : 'frames'} • {(frames.length / fps).toFixed(1)}s
          </Text>
        </View>

        {/* Right Header Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Quick In-Studio Settings Modal */}
          <Pressable
            style={({ pressed }) => [
              styles.hudIconButton,
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.90 : 1 }],
              },
            ]}
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => setShowStudioSettings(true)}
          >
            <Ionicons name="options-outline" size={22} color="#FFFFFF" />
          </Pressable>

          {/* Export / Save Animation CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.hudIconButton,
              frames.length === 0 && styles.disabledHudBtn,
              {
                opacity: frames.length === 0 ? 0.35 : pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.90 : 1 }],
                backgroundColor: 'rgba(99, 102, 241, 0.4)',
                borderColor: 'rgba(165, 180, 252, 0.4)',
              },
            ]}
            disabled={frames.length === 0}
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => {
              setIsExportComplete(false);
              setExportProgress(null);
              setShowExportModal(true);
            }}
          >
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Main Viewfinder Canvas Stage Area */}
      <View style={[styles.stageArea, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ width: '100%', height: '100%', position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
          <View
            style={{
              aspectRatio: targetAspectRatio,
              width: targetAspectRatio >= 1 ? '100%' : 'auto',
              height: targetAspectRatio >= 1 ? 'auto' : '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#000000',
              borderRadius: 12,
            }}
          >
            {/* Native Camera Stream */}
            <View style={StyleSheet.absoluteFill}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                enableTorch={torch}
                zoom={zoom}
                autofocus={isAeAfLocked ? 'off' : 'on'}
                responsiveOrientationWhenOrientationLocked={true}
              />
            </View>

            {/* Viewfinder Top-Corner Info Badges ("12fps LQ" section moved inside viewfinder) */}
            <View style={styles.viewfinderCornerBadges} pointerEvents="box-none">
              <View style={styles.viewfinderBadgePill}>
                <Pressable
                  onPress={() => setShowStudioSettings(true)}
                  style={({ pressed }) => [
                    styles.viewfinderBadgeItem,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  unstable_pressDelay={0}
                  pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.viewfinderBadgeHighlightText}>{fps} FPS</Text>
                </Pressable>

                <View style={styles.viewfinderBadgeDivider} />

                <View style={styles.viewfinderBadgeItem}>
                  <Text style={styles.viewfinderBadgeMutedText}>
                    {previewResolution === 'full' ? 'HQ' : 'LQ'}
                  </Text>
                </View>

                <View style={styles.viewfinderBadgeDivider} />

                <View style={styles.viewfinderBadgeItem}>
                  <Text style={styles.viewfinderBadgeMutedText}>
                    {project.aspectRatio || (isLandscape ? '16:9' : '9:16')}
                  </Text>
                </View>

                {isAeAfLocked && (
                  <>
                    <View style={styles.viewfinderBadgeDivider} />
                    <View style={[styles.viewfinderBadgeItem, { flexDirection: 'row', alignItems: 'center' }]}>
                      <Ionicons name="lock-closed" size={10} color="#FBBF24" style={{ marginRight: 3 }} />
                      <Text style={[styles.viewfinderBadgeHighlightText, { color: '#FBBF24' }]}>
                        AE/AF LOCK
                      </Text>
                    </View>
                  </>
                )}

                {zoom > 0 && (
                  <>
                    <View style={styles.viewfinderBadgeDivider} />
                    <View style={styles.viewfinderBadgeItem}>
                      <Text style={[styles.viewfinderBadgeHighlightText, { color: '#60A5FA' }]}>
                        {(1 + zoom * 3).toFixed(1)}x
                      </Text>
                    </View>
                  </>
                )}

                {chromaConfig.enabled && (
                  <>
                    <View style={styles.viewfinderBadgeDivider} />
                    <View style={[styles.viewfinderBadgeItem, { flexDirection: 'row', alignItems: 'center' }]}>
                      <Ionicons name="color-wand" size={10} color="#10B981" style={{ marginRight: 3 }} />
                      <Text style={[styles.viewfinderBadgeHighlightText, { color: '#10B981' }]}>
                        CHROMA
                      </Text>
                    </View>
                  </>
                )}

                {audioTrack && (
                  <>
                    <View style={styles.viewfinderBadgeDivider} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.viewfinderBadgeItem,
                        { flexDirection: 'row', alignItems: 'center' },
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={handleRemoveAudio}
                      unstable_pressDelay={0}
                      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="musical-notes" size={10} color="#10B981" style={{ marginRight: 3 }} />
                      <Text style={[styles.viewfinderBadgeMutedText, { color: '#10B981', maxWidth: 80 }]} numberOfLines={1}>
                        {audioTrack.name}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>

              {/* Fullscreen Viewfinder Mode Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.viewfinderFullscreenBtn,
                  frames.length === 0 && { opacity: 0.35 },
                  { transform: [{ scale: pressed ? 0.90 : 1 }] },
                ]}
                disabled={frames.length === 0}
                onPress={() => setShowFullScreenPlayback(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="expand" size={15} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Aspect Ratio Guide / Letterbox Overlay with Multi-Grid Support */}
            <View style={styles.aspectMaskContainer} pointerEvents="none">
              {gridMode === 'ruleOfThirds' && (
                <View style={styles.gridOverlay}>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCell} />
                    <View style={[styles.gridCell, styles.gridBorderLeft, styles.gridBorderRight]} />
                    <View style={styles.gridCell} />
                  </View>
                  <View style={[styles.gridRow, styles.gridBorderTop, styles.gridBorderBottom]}>
                    <View style={styles.gridCell} />
                    <View style={[styles.gridCell, styles.gridBorderLeft, styles.gridBorderRight]} />
                    <View style={styles.gridCell} />
                  </View>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCell} />
                    <View style={[styles.gridCell, styles.gridBorderLeft, styles.gridBorderRight]} />
                    <View style={styles.gridCell} />
                  </View>
                </View>
              )}

              {gridMode === 'crosshair' && (
                <View style={styles.crosshairOverlay}>
                  <View style={styles.crosshairHLine} />
                  <View style={styles.crosshairVLine} />
                  <View style={styles.crosshairCircle} />
                </View>
              )}

              {gridMode === 'golden' && (
                <View style={styles.goldenOverlay}>
                  <View style={styles.goldenHLine1} />
                  <View style={styles.goldenHLine2} />
                  <View style={styles.goldenVLine1} />
                  <View style={styles.goldenVLine2} />
                </View>
              )}
            </View>

            {/* Floating Zoom Controls Bar */}
            {showZoomSlider && !isPlaying && (
              <View style={styles.floatingZoomContainer} pointerEvents="box-none">
                <GlassSurface variant="elevated" borderRadius={18} contentStyle={styles.floatingZoomContent}>
                  <Pressable
                    style={styles.zoomStepBtn}
                    onPress={() => setZoom((prev) => Math.max(0, Number((prev - 0.05).toFixed(2))))}
                  >
                    <Ionicons name="remove" size={16} color="#FFFFFF" />
                  </Pressable>

                  {[
                    { label: '1.0x', val: 0.0 },
                    { label: '1.5x', val: 0.17 },
                    { label: '2.0x', val: 0.33 },
                    { label: '3.0x', val: 0.67 },
                    { label: '4.0x', val: 1.0 },
                  ].map((preset) => {
                    const isSelected = Math.abs(zoom - preset.val) < 0.05;
                    return (
                      <Pressable
                        key={preset.label}
                        style={[styles.zoomPresetChip, isSelected && styles.zoomPresetChipActive]}
                        onPress={() => setZoom(preset.val)}
                      >
                        <Text style={[styles.zoomPresetText, isSelected && styles.zoomPresetTextActive]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    style={styles.zoomStepBtn}
                    onPress={() => setZoom((prev) => Math.min(1.0, Number((prev + 0.05).toFixed(2))))}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                  </Pressable>

                  <Pressable
                    style={styles.zoomCloseBtn}
                    onPress={() => setShowZoomSlider(false)}
                  >
                    <Ionicons name="close" size={16} color="#9CA3AF" />
                  </Pressable>
                </GlassSurface>
              </View>
            )}

            {isAutoCaptureActive && !isPlaying && (
              <View style={styles.autoTimerBadge}>
                <Ionicons name="timer" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.autoTimerBadgeText}>
                  Auto Snap in {autoCaptureCountdown}s ({autoCaptureInterval}s interval)
                </Text>
              </View>
            )}

            {/* 1. Hardware-Accelerated Onion Skin Layers (60 FPS Native UI-Thread Scrubbing) */}
            {onionConfig.enabled && !isPlaying && !isSoloView && frames.map((frame, index) => (
              <HardwareOnionLayer
                key={`onion_${frame.id}`}
                frame={frame}
                index={index}
                scrubFrameIndex={scrubFrameIndex}
                opacity={onionConfig.prevOpacity}
                tintColor={onionConfig.colorTint ? '#EF4444' : undefined}
                showNext={onionConfig.showNext}
                nextOpacity={onionConfig.nextOpacity}
                aspectFitMode={settings.aspectFitMode}
                mode={onionConfig.mode || 'ghost'}
                isBlinkVisible={isBlinkVisible}
              />
            ))}

            {/* Solo Frame Preview & Real-Time Scrubbing Layer (60 FPS Native UI-Thread Scrubbing) */}
            {isSoloView && !isPlaying && frames.length > 0 && (
              <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {frames.map((frame, index) => (
                  <HardwareFrameLayer
                    key={`solo_${frame.id}`}
                    frame={frame}
                    index={index}
                    activeFrameIndex={scrubFrameIndex}
                    aspectFitMode={settings.aspectFitMode}
                  />
                ))}

                {/* Solo View HUD Bar */}
                <View style={styles.soloViewBadgeRow} pointerEvents="box-none">
                  <Pressable
                    style={({ pressed }) => [
                      styles.liveCameraBtn,
                      { transform: [{ scale: pressed ? 0.94 : 1 }] },
                    ]}
                    unstable_pressDelay={0}
                    pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setIsSoloView(false)}
                  >
                    <Ionicons name="videocam" size={14} color="#FFFFFF" />
                    <Text style={styles.liveCameraBtnText}>Live Camera</Text>
                  </Pressable>

                  {/* Frame Shift & Duplicate/Delete Controls */}
                  <View style={styles.soloFrameActionsRow}>
                    <Pressable
                      style={[
                        styles.soloFrameActionBtn,
                        (activeFrameIndex === null || activeFrameIndex === 0) && styles.disabledHudBtn,
                      ]}
                      disabled={activeFrameIndex === null || activeFrameIndex === 0}
                      onPress={() => activeFrameIndex !== null && handleMoveFrameLeft(activeFrameIndex)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="chevron-back" size={16} color="#FFFFFF" />
                    </Pressable>

                    <View style={styles.soloFrameIndexPill}>
                      <Text style={styles.soloFrameIndexText}>
                        #{(activeFrameIndex ?? 0) + 1}/{frames.length}
                      </Text>
                    </View>

                    <Pressable
                      style={[
                        styles.soloFrameActionBtn,
                        (activeFrameIndex === null || activeFrameIndex >= frames.length - 1) && styles.disabledHudBtn,
                      ]}
                      disabled={activeFrameIndex === null || activeFrameIndex >= frames.length - 1}
                      onPress={() => activeFrameIndex !== null && handleMoveFrameRight(activeFrameIndex)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                    </Pressable>

                    <Pressable
                      style={styles.soloFrameActionBtn}
                      onPress={() => activeFrameIndex !== null && handleDuplicateSingleFrame(activeFrameIndex)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="copy-outline" size={15} color="#60A5FA" />
                    </Pressable>

                    <Pressable
                      style={styles.soloFrameActionBtn}
                      onPress={() => activeFrameIndex !== null && handleDeleteFrame(activeFrameIndex)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* Animation Playback Sequence Preview Overlay with Doodles and Audio */}
            {isPlaying && frames.length > 0 && (
              <View style={styles.playbackOverlay}>
                {/* Full Hardware Frame Layers */}
                {frames.map((frame, index) => (
                  <HardwareFrameLayer
                    key={frame.id}
                    frame={frame}
                    index={index}
                    activeFrameIndex={playbackFrameIndex}
                    aspectFitMode={settings.aspectFitMode}
                  />
                ))}

                {/* Top Playback HUD with Working Exit Button & Loop Selector */}
                <View style={styles.playbackBadgeRow} pointerEvents="box-none">
                  <Pressable
                    style={({ pressed }) => [
                      styles.playbackStopBtn,
                      { transform: [{ scale: pressed ? 0.92 : 1 }] },
                    ]}
                    unstable_pressDelay={0}
                    pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    onPress={() => setIsPlaying(false)}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  >
                    <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
                    <Text style={styles.playbackStopBtnText}>Exit</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.playbackLoopBtn,
                      { transform: [{ scale: pressed ? 0.92 : 1 }] },
                    ]}
                    unstable_pressDelay={0}
                    pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    onPress={() => {
                      if (loopMode === 'loop') setLoopMode('bounce');
                      else if (loopMode === 'bounce') setLoopMode('once');
                      else setLoopMode('loop');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={
                        loopMode === 'loop'
                          ? 'repeat'
                          : loopMode === 'bounce'
                            ? 'swap-horizontal'
                            : 'arrow-forward'
                      }
                      size={13}
                      color="#FFFFFF"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.playbackLoopBtnText}>
                      {loopMode === 'loop' ? 'Loop' : loopMode === 'bounce' ? 'Bounce' : 'Once'}
                    </Text>
                  </Pressable>

                  {/* Extracted Playback Badge to stop re-renders */}
                  <PlaybackBadge
                    activeFrameIndex={playbackFrameIndex}
                    totalFrames={frames.length}
                    fps={fps}
                    hasAudio={!!audioTrack}
                    previewResolution={settings.previewResolution}
                  />
                </View>
              </View>
            )}


          </View>
        </View>

        {/* Floating Viewfinder Controls (Import Plus, Onion Skin, Shutter stacked on top of viewfinder) */}
        <View
          style={[
            styles.floatingViewfinderControls,
            isLandscape ? styles.floatingControlsLandscape : styles.floatingControlsPortrait,
          ]}
          pointerEvents="box-none"
        >
          {/* Plus Button to Import Images from Storage directly in Viewfinder */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.floatingActionBtn,
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={handleImportImages}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </Pressable>

          {/* Onion Skin Quick Toggle */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.floatingActionBtn,
              onionConfig.enabled && styles.floatingOnionBtnActive,
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={() => setOnionConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
          >
            <Ionicons
              name={onionConfig.enabled ? 'layers' : 'layers-outline'}
              size={24}
              color="#FFFFFF"
            />
          </Pressable>

          {/* Tactile Red Stop-Motion Shutter Button */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={isCapturing}
            onPress={handleCapture}
            style={({ pressed }) => [
              styles.shutterOuterRing,
              {
                opacity: isCapturing ? 0.6 : pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
          >
            <View style={styles.shutterInnerCircle}>
              {isCapturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.shutterCore} />
              )}
            </View>
          </Pressable>
        </View>
      </View>

      {/* UNIFIED BOTTOM CONTROL PANEL (UI Action Buttons at Top, Filmstrip at Bottom) */}
      <View
        style={[
          styles.bottomControlPanel,
          {
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Upper Row: Scrollable Studio Action Buttons Toolbar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.studioToolbarRow}
          contentContainerStyle={[
            styles.studioToolbarScrollContent,
            { paddingHorizontal: Math.max(insets.left, insets.right, 10) },
          ]}
        >
          {/* 1. Play / Preview Button */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.playBtn,
              {
                opacity: frames.length === 0 ? 0.4 : pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.90 : 1 }],
              },
            ]}
            disabled={frames.length === 0}
            onPress={() => setIsPlaying(!isPlaying)}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.playBtnText}>{isPlaying ? 'Stop' : 'Play'}</Text>
          </Pressable>

          <View style={styles.toolbarDivider} />

          {/* 2. Undo */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              undoStack.length === 0 && styles.disabledHudBtn,
              {
                opacity: undoStack.length === 0 ? 0.35 : pressed ? 0.65 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            disabled={undoStack.length === 0}
            onPress={handleUndo}
          >
            <Ionicons
              name="arrow-undo"
              size={20}
              color={undoStack.length === 0 ? 'rgba(255,255,255,0.3)' : '#FFFFFF'}
            />
          </Pressable>

          {/* 3. Redo */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              redoStack.length === 0 && styles.disabledHudBtn,
              {
                opacity: redoStack.length === 0 ? 0.35 : pressed ? 0.65 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            disabled={redoStack.length === 0}
            onPress={handleRedo}
          >
            <Ionicons
              name="arrow-redo"
              size={20}
              color={redoStack.length === 0 ? 'rgba(255,255,255,0.3)' : '#FFFFFF'}
            />
          </Pressable>

          {/* 4. Auto Capture Timer */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              isAutoCaptureActive && styles.toolbarIconBtnActiveRed,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={() => {
              setIsAutoCaptureActive(!isAutoCaptureActive);
              if (!isAutoCaptureActive) {
                setAutoCaptureCountdown(autoCaptureInterval);
              } else {
                setAutoCaptureCountdown(0);
              }
            }}
            onLongPress={() => {
              const nextInterval = autoCaptureInterval === 3 ? 5 : autoCaptureInterval === 5 ? 10 : 3;
              setAutoCaptureInterval(nextInterval);
              if (isAutoCaptureActive) {
                setAutoCaptureCountdown(nextInterval);
              }
            }}
            delayLongPress={300}
          >
            <Ionicons
              name={isAutoCaptureActive ? 'timer' : 'timer-outline'}
              size={20}
              color="#FFFFFF"
            />
            <View style={styles.timerBadgeSub}>
              <Text style={styles.timerBadgeSubText}>{autoCaptureInterval}s</Text>
            </View>
          </Pressable>

          {/* 5. AE/AF Lock Toggle (Anti-Flicker) */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              isAeAfLocked && styles.toolbarIconBtnGoldActive,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={() => setIsAeAfLocked(!isAeAfLocked)}
          >
            <Ionicons
              name={isAeAfLocked ? 'lock-closed' : 'lock-open-outline'}
              size={20}
              color={isAeAfLocked ? '#FBBF24' : '#FFFFFF'}
            />
          </Pressable>

          {/* 6. Zoom Toggle */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              (zoom > 0 || showZoomSlider) && styles.toolbarIconBtnActive,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={() => setShowZoomSlider(!showZoomSlider)}
          >
            <Ionicons name="search-outline" size={19} color="#FFFFFF" />
            <View style={styles.zoomBadgeSub}>
              <Text style={styles.zoomBadgeSubText}>
                {(1 + zoom * 3).toFixed(1)}x
              </Text>
            </View>
          </Pressable>

          {/* 7. Grid Mode Toggle (Cycles: 3x3 -> Crosshair -> Golden -> Off) */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              gridMode !== 'none' && styles.toolbarIconBtnActive,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={() => {
              const modes: Array<'ruleOfThirds' | 'crosshair' | 'golden' | 'none'> = [
                'ruleOfThirds',
                'crosshair',
                'golden',
                'none',
              ];
              const nextIndex = (modes.indexOf(gridMode) + 1) % modes.length;
              setGridMode(modes[nextIndex]);
            }}
          >
            <Ionicons
              name={
                gridMode === 'none'
                  ? 'grid-outline'
                  : gridMode === 'crosshair'
                    ? 'locate-outline'
                    : 'grid'
              }
              size={20}
              color="#FFFFFF"
            />
            {gridMode !== 'none' && (
              <View style={styles.gridBadgeSub}>
                <Text style={styles.gridBadgeSubText}>
                  {gridMode === 'ruleOfThirds' ? '3x3' : gridMode === 'crosshair' ? '+' : 'Phi'}
                </Text>
              </View>
            )}
          </Pressable>

          {/* 8. Torch Toggle */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              torch && styles.toolbarIconBtnActive,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={() => setTorch(!torch)}
          >
            <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={20} color="#FFFFFF" />
          </Pressable>

          {/* 9. Camera Facing Flip */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
          >
            <Ionicons name="camera-reverse-outline" size={21} color="#FFFFFF" />
          </Pressable>


          {/* 11. Chroma Key (Green Screen) Studio */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              chromaConfig.enabled && styles.toolbarIconBtnGreenActive,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={() => setShowChromaKeyModal(true)}
          >
            <Ionicons
              name={chromaConfig.enabled ? 'color-wand' : 'color-wand-outline'}
              size={20}
              color={chromaConfig.enabled ? '#FFFFFF' : '#10B981'}
            />
          </Pressable>

          {/* 8. Hand Doodle Toggle */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              isDoodleMode && styles.toolbarIconBtnActive,
              frames.length === 0 && styles.disabledHudBtn,
              {
                opacity: frames.length === 0 ? 0.35 : pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            disabled={frames.length === 0}
            onPress={() => {
              if (!isDoodleMode) {
                const targetIdx = activeFrameIndex !== null ? activeFrameIndex : Math.max(0, frames.length - 1);
                setActiveFrameIndex(targetIdx);
                scrubFrameIndex.value = targetIdx;
              }
              setIsDoodleMode(!isDoodleMode);
            }}
          >
            <Ionicons name="brush-outline" size={20} color="#FFFFFF" />
          </Pressable>

          {/* 8B. Text Tool (100 Offline Google Fonts) */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              isTextMode && styles.toolbarIconBtnActive,
              frames.length === 0 && styles.disabledHudBtn,
              {
                opacity: frames.length === 0 ? 0.35 : pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            disabled={frames.length === 0}
            onPress={() => {
              if (!isTextMode) {
                const targetIdx = activeFrameIndex !== null ? activeFrameIndex : Math.max(0, frames.length - 1);
                setActiveFrameIndex(targetIdx);
                scrubFrameIndex.value = targetIdx;
              }
              setIsTextMode(!isTextMode);
            }}
          >
            <Ionicons name="text-outline" size={20} color="#FFFFFF" />
          </Pressable>

          {/* 9. Generate Smear Tool */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              frames.length < 2 && styles.disabledHudBtn,
              {
                opacity: frames.length < 2 ? 0.35 : pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            disabled={frames.length < 2}
            onPress={() => setShowSmearModal(true)}
          >
            <Ionicons name="flash-outline" size={20} color="#FFFFFF" />
          </Pressable>

          {/* 10. Hold on 2s (Duplicate All Frames) */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              frames.length === 0 && styles.disabledHudBtn,
              {
                opacity: frames.length === 0 ? 0.35 : pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            disabled={frames.length === 0}
            onPress={handleDuplicateAllOn2s}
          >
            <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
          </Pressable>

          {/* 11. Reverse All Frames */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              frames.length < 2 && styles.disabledHudBtn,
              {
                opacity: frames.length < 2 ? 0.35 : pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            disabled={frames.length < 2}
            onPress={handleReverseFrames}
          >
            <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
          </Pressable>

          {/* 12. Audio Track Picker */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              audioTrack && styles.toolbarIconBtnActive,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={handlePickAudio}
          >
            <Ionicons
              name={audioTrack ? 'musical-notes' : 'musical-notes-outline'}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>

          {/* 13. Voiceover Studio Modal Trigger */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={() => setShowVoiceoverModal(true)}
          >
            <Ionicons name="mic-outline" size={20} color="#EF4444" />
          </Pressable>

          {/* 14. Multi-Select Frames Toggle */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.toolbarIconButton,
              isMultiSelect && styles.toolbarIconBtnActive,
              frames.length === 0 && styles.disabledHudBtn,
              {
                opacity: frames.length === 0 ? 0.35 : pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            disabled={frames.length === 0}
            onPress={() => {
              setIsMultiSelect(!isMultiSelect);
              setSelectedFrameIds([]);
            }}
          >
            <Ionicons
              name={isMultiSelect ? 'checkbox' : 'checkbox-outline'}
              size={20}
              color={isMultiSelect ? '#FFFFFF' : '#D1D5DB'}
            />
          </Pressable>

          {/* 15. Plus Button to Import Images from Storage */}
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.importToolbarBtn,
              {
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              },
            ]}
            onPress={handleImportImages}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </ScrollView>

        {/* Lower Row: Ultra-Smooth Centered Numbered Filmstrip Carousel */}
        <View style={styles.filmstripContainer}>
          {/* Fixed Center Square Selection Reticle (never moves) */}
          <View style={styles.fixedCenterSelectionFrame} pointerEvents="none">
            <View style={styles.fixedCenterSquareBorder} />
          </View>

          <Animated.FlatList
            ref={filmstripRef}
            data={frames}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={70}
            decelerationRate={0.985}
            disableIntervalMomentum={false}
            getItemLayout={(_, index) => ({
              length: 70,
              offset: 70 * index,
              index,
            })}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={15}
            removeClippedSubviews={false}
            contentContainerStyle={[
              styles.filmstripContent,
              { paddingHorizontal: Math.max(0, (windowWidth - 70) / 2) },
            ]}
            onScroll={scrollHandler}
            onMomentumScrollEnd={(event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const idx = Math.max(0, Math.min(frames.length - 1, Math.round(offsetX / 70)));
              scrubFrameIndex.value = idx;
              setActiveFrameIndex(idx);
            }}
            onScrollEndDrag={(event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const idx = Math.max(0, Math.min(frames.length - 1, Math.round(offsetX / 70)));
              scrubFrameIndex.value = idx;
              setActiveFrameIndex(idx);
            }}
            scrollEventThrottle={16}
            renderItem={({ item, index }) => {
              const isSelected = selectedFrameIds.includes(item.id);
              return (
                <Pressable
                  unstable_pressDelay={0}
                  pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  style={[
                    styles.frameThumbnailWrapper,
                    isSelected && styles.frameThumbnailWrapperSelected,
                  ]}
                  onPress={() => {
                    if (isMultiSelect) {
                      handleToggleSelectFrame(item.id);
                    } else {
                      scrubFrameIndex.value = index;
                      setActiveFrameIndex(index);
                      setIsSoloView(true);
                      filmstripRef.current?.scrollToOffset({
                        offset: index * 70,
                        animated: true,
                      });
                    }
                  }}
                >
                  <View style={styles.frameThumbnailInnerContainer}>
                    <ExpoImage
                      source={{ uri: item.proxyUri || item.uri }}
                      style={styles.frameThumbnail}
                      transition={0}
                      cachePolicy="memory-disk"
                      priority="high"
                    />

                    {isMultiSelect && (
                      <View style={[styles.selectCheckboxBadge, isSelected && styles.selectCheckboxBadgeActive]}>
                        <Ionicons
                          name={isSelected ? 'checkmark' : 'square-outline'}
                          size={10}
                          color="#FFFFFF"
                        />
                      </View>
                    )}

                    {item.doodles && item.doodles.length > 0 && (
                      <View style={styles.doodleDot}>
                        <Ionicons name="brush" size={8} color="#FFFFFF" />
                      </View>
                    )}

                    {item.textOverlays && item.textOverlays.length > 0 && (
                      <View style={[styles.doodleDot, { top: 4, right: item.doodles && item.doodles.length > 0 ? 18 : 4, backgroundColor: '#6366F1' }]}>
                        <Ionicons name="text" size={7} color="#FFFFFF" />
                      </View>
                    )}

                    <View style={styles.frameIndexBadge}>
                      <Text style={styles.frameIndexText}>{index + 1}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>

        {/* Floating Multi-Select Action Bar */}
        {isMultiSelect && (
          <View style={styles.multiSelectActionBar}>
            <GlassSurface variant="elevated" borderRadius={16} contentStyle={styles.multiSelectActionContent}>
              <Pressable style={styles.multiSelectPill} onPress={handleSelectAll}>
                <Text style={styles.multiSelectPillText}>
                  {selectedFrameIds.length === frames.length ? 'Deselect All' : `Select All (${selectedFrameIds.length})`}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.multiSelectIconBtn, selectedFrameIds.length === 0 && styles.disabledHudBtn]}
                disabled={selectedFrameIds.length === 0}
                onPress={handleBatchDuplicate}
              >
                <Ionicons name="copy-outline" size={16} color="#60A5FA" />
              </Pressable>

              <Pressable
                style={[styles.multiSelectIconBtn, selectedFrameIds.length < 2 && styles.disabledHudBtn]}
                disabled={selectedFrameIds.length < 2}
                onPress={handleBatchReverse}
              >
                <Ionicons name="swap-horizontal" size={16} color="#A78BFA" />
              </Pressable>

              <Pressable
                style={[styles.multiSelectIconBtn, selectedFrameIds.length === 0 && styles.disabledHudBtn]}
                disabled={selectedFrameIds.length === 0}
                onPress={handleBatchDelete}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </Pressable>

              <Pressable
                style={styles.multiSelectCloseBtn}
                onPress={() => {
                  setIsMultiSelect(false);
                  setSelectedFrameIds([]);
                }}
              >
                <Ionicons name="close" size={16} color="#9CA3AF" />
              </Pressable>
            </GlassSurface>
          </View>
        )}
      </View>

      {/* Hand Doodle Canvas Overlay */}
      {isDoodleMode && currentTargetFrame && (
        <DoodleCanvas
          frameUri={currentTargetFrame.proxyUri || currentTargetFrame.uri}
          aspectRatio={targetAspectRatio}
          strokes={currentTargetFrame.doodles || []}
          onAddStroke={handleAddDoodleStroke}
          onUndoLastStroke={handleUndoDoodleStroke}
          onClearDoodles={handleClearFrameDoodles}
          onClose={() => setIsDoodleMode(false)}
          frameIndex={currentTargetFrameIndex}
          totalFrames={frames.length}
        />
      )}

      {/* 100 Offline Google Fonts Text Studio Overlay */}
      {isTextMode && currentTargetFrame && (
        <TextOverlayEditor
          frameUri={currentTargetFrame.proxyUri || currentTargetFrame.uri}
          aspectRatio={targetAspectRatio}
          textOverlays={currentTargetFrame.textOverlays || []}
          onSaveTextOverlays={handleSaveTextOverlays}
          onClose={() => setIsTextMode(false)}
          frameIndex={currentTargetFrameIndex}
          totalFrames={frames.length}
        />
      )}

      {/* In-Studio Settings Modal */}
      <StudioSettingsModal
        visible={showStudioSettings}
        onClose={() => setShowStudioSettings(false)}
        fps={fps}
        onChangeFps={handleChangeFps}
        previewResolution={previewResolution}
        onChangeResolution={(res) => setPreviewResolution(res)}
        onionConfig={onionConfig}
        onChangeOnionConfig={(cfg) => setOnionConfig(cfg)}
      />

      {/* Smear Frame Generator Modal */}
      {showSmearModal && frames.length >= 2 && (
        <SmearModal
          visible={showSmearModal}
          onClose={() => setShowSmearModal(false)}
          frames={frames}
          initialFrameIndex={activeFrameIndex !== null ? activeFrameIndex : Math.max(0, frames.length - 2)}
          aspectRatio={targetAspectRatio}
          projectId={project.id}
          onInsertSmearFrame={handleInsertSmearFrame}
        />
      )}

      {/* Full Screen High-Resolution Studio Playback */}
      {showFullScreenPlayback && (
        <FullScreenPlaybackModal
          visible={showFullScreenPlayback}
          onClose={() => setShowFullScreenPlayback(false)}
          frames={frames}
          initialFrameIndex={activeFrameIndex !== null ? activeFrameIndex : 0}
          initialFps={fps}
          onFpsChange={handleChangeFps}
          aspectRatio={targetAspectRatio}
        />
      )}

      {/* Hidden Bluetooth Remote Shutter Receiver (Captures Volume/Enter/Space clicker events) */}
      {settings.remoteShutterEnabled && (
        <TextInput
          ref={remoteShutterInputRef}
          style={styles.hiddenRemoteShutterInput}
          autoFocus
          showSoftInputOnFocus={false}
          blurOnSubmit={false}
          value=""
          onChangeText={() => {
            if (!isCapturing && !isPlaying) {
              handleCapture();
            }
          }}
          onKeyPress={() => {
            if (!isCapturing && !isPlaying) {
              handleCapture();
            }
          }}
          onSubmitEditing={() => {
            if (!isCapturing && !isPlaying) {
              handleCapture();
            }
          }}
        />
      )}

      {/* Voiceover Recording Modal */}
      {showVoiceoverModal && (
        <VoiceoverRecordModal
          visible={showVoiceoverModal}
          onClose={() => setShowVoiceoverModal(false)}
          frames={frames}
          fps={fps}
          projectId={project.id}
          onSaveVoiceover={handleSaveVoiceover}
        />
      )}

      {/* Chroma Key Studio Modal */}
      <ChromaKeyModal
        visible={showChromaKeyModal}
        onClose={() => setShowChromaKeyModal(false)}
        config={chromaConfig}
        onChangeConfig={(cfg) => setChromaConfig(cfg)}
      />

      {/* In-Studio Animation Export Modal */}
      <BatchExportModal
        visible={showExportModal}
        progress={exportProgress}
        isExporting={isExporting}
        isComplete={isExportComplete}
        totalSelected={1}
        successCount={exportSuccessCount}
        defaultTitle={project.title}
        onStartExport={handleExecuteStudioExport}
        onClose={() => setShowExportModal(false)}
      />

      {/* Photo Import Live Progress Loading Modal */}
      <ImportLoadingModal
        visible={importLoadingState.visible}
        current={importLoadingState.current}
        total={importLoadingState.total}
        stageMessage={importLoadingState.stageMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  stageArea: {
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  controlPanel: {
    backgroundColor: 'transparent',
    padding: 8,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionCardWrapper: {
    width: '100%',
    maxWidth: 400,
  },
  permissionCardContent: {
    padding: 28,
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    padding: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  aspectMaskContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
  },
  gridBorderLeft: {
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.35)',
  },
  gridBorderRight: {
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(255, 255, 255, 0.35)',
  },
  gridBorderTop: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  gridBorderBottom: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.35)',
  },
  crosshairOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairHLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.75,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  crosshairVLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0.75,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  crosshairCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    backgroundColor: 'transparent',
  },
  goldenOverlay: {
    ...StyleSheet.absoluteFill,
  },
  goldenHLine1: {
    position: 'absolute',
    top: '38.2%',
    left: 0,
    right: 0,
    height: 0.65,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  goldenHLine2: {
    position: 'absolute',
    top: '61.8%',
    left: 0,
    right: 0,
    height: 0.65,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  goldenVLine1: {
    position: 'absolute',
    left: '38.2%',
    top: 0,
    bottom: 0,
    width: 0.65,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  goldenVLine2: {
    position: 'absolute',
    left: '61.8%',
    top: 0,
    bottom: 0,
    width: 0.65,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  soloFrameActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  soloFrameActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameThumbnailWrapperSelected: {
    transform: [{ scale: 1.08 }],
  },
  selectCheckboxBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  selectCheckboxBadgeActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#93C5FD',
  },
  multiSelectActionBar: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 50,
  },
  multiSelectActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  multiSelectPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  multiSelectPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  multiSelectIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiSelectCloseBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginLeft: 4,
  },
  floatingZoomContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 70,
    alignItems: 'center',
  },
  floatingZoomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  zoomPresetChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  zoomPresetChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#93C5FD',
  },
  zoomPresetText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '700',
  },
  zoomPresetTextActive: {
    color: '#FFFFFF',
  },
  zoomStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginLeft: 4,
  },
  onionSkinWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  onionSkinImage: {
    width: '100%',
    height: '100%',
  },
  playbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  playbackImage: {
    width: '100%',
    height: '100%',
  },
  playbackBadgeRow: {
    position: 'absolute',
    top: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 70,
  },
  playbackStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  playbackStopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  playbackLoopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  playbackLoopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  playbackBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.6)',
  },
  playbackBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  autoTimerBadge: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    zIndex: 60,
  },
  autoTimerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inspectOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 60,
  },
  inspectHeader: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspectHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inspectHeaderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  inspectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  inspectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeInspectBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(11, 13, 19, 0.88)',
    paddingVertical: 10,
    zIndex: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
  },
  hudIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  titleInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  hudProjectTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  hudFrameCountSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  viewfinderCornerBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 80,
  },
  viewfinderFullscreenBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(11, 13, 19, 0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  viewfinderBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 13, 19, 0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  viewfinderBadgeItem: {
    paddingHorizontal: 4,
  },
  viewfinderBadgeDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginHorizontal: 3,
  },
  viewfinderBadgeHighlightText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewfinderBadgeMutedText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '600',
  },
  floatingViewfinderControls: {
    position: 'absolute',
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingControlsLandscape: {
    right: 20,
    top: 0,
    bottom: 0,
  },
  floatingControlsPortrait: {
    right: 16,
    bottom: 16,
  },
  floatingActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.50)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingOnionBtnActive: {
    backgroundColor: '#6366F1',
    borderColor: '#C7D2FE',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomControlPanel: {
    backgroundColor: 'rgba(11, 13, 19, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 10,
    zIndex: 30,
  },
  studioToolbarRow: {
    height: 52,
    marginBottom: 6,
  },
  studioToolbarScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  toolbarDivider: {
    width: 1.5,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginHorizontal: 8,
  },
  toolbarIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  toolbarIconBtnActive: {
    backgroundColor: '#6366F1',
    borderColor: '#C7D2FE',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  toolbarIconBtnActiveRed: {
    backgroundColor: '#EF4444',
    borderColor: '#FECACA',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  toolbarIconBtnGoldActive: {
    backgroundColor: '#D97706',
    borderColor: '#FDE68A',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  toolbarIconBtnGreenActive: {
    backgroundColor: '#059669',
    borderColor: '#A7F3D0',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledHudBtn: {
    opacity: 0.35,
  },
  timerBadgeSub: {
    position: 'absolute',
    bottom: 1,
    right: 2,
  },
  timerBadgeSubText: {
    fontSize: 8.5,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  zoomBadgeSub: {
    position: 'absolute',
    bottom: 1,
    right: 2,
  },
  zoomBadgeSubText: {
    fontSize: 8,
    color: '#60A5FA',
    fontWeight: '800',
  },
  gridBadgeSub: {
    position: 'absolute',
    bottom: 1,
    right: 2,
  },
  gridBadgeSubText: {
    fontSize: 8,
    color: '#A78BFA',
    fontWeight: '800',
  },
  importToolbarBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.65)',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  soloViewBadgeRow: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 60,
  },
  liveCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  liveCameraBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  soloFrameIndexPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  soloFrameIndexText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  filmstripContainer: {
    height: 82,
    marginBottom: 4,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  fixedCenterSelectionFrame: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -32,
    marginTop: -32,
    width: 64,
    height: 64,
    zIndex: 20,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  fixedCenterSquareBorder: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
    elevation: 8,
  },
  filmstripContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  frameThumbnailWrapper: {
    width: 60,
    height: 60,
    marginHorizontal: 5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  frameThumbnailInnerContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  frameThumbnail: {
    width: '100%',
    height: '100%',
  },
  doodleDot: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameIndexBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  frameIndexText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  playBtn: {
    minWidth: 86,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 5,
  },
  playBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  shutterOuterRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  shutterInnerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  shutterCore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  hiddenRemoteShutterInput: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
// Convert points to SVG Path
const pointsToSvgPath = (points: Point[]): string => {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  let path = `M ${first.x} ${first.y}`;
  for (const pt of rest) {
    path += ` L ${pt.x} ${pt.y}`;
  }
  return path;
};

const HardwareFrameLayer = React.memo(({ frame, index, activeFrameIndex, aspectFitMode }: { frame: Frame, index: number, activeFrameIndex: SharedValue<number>, aspectFitMode: string }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeFrameIndex.value === index;
    return {
      opacity: isActive ? 1 : 0,
      transform: [{ translateX: isActive ? 0 : SCREEN_WIDTH * 2 }],
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }, animatedStyle, { zIndex: 10 }]}>
      <ExpoImage
        source={{ uri: frame.proxyUri || frame.uri }}
        style={StyleSheet.absoluteFill}
        contentFit={aspectFitMode === 'cover' ? 'cover' : 'contain'}
        transition={0}
        cachePolicy="memory-disk"
        priority="high"
      />
      {frame.doodles && frame.doodles.length > 0 && (
        <Svg style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
          {frame.doodles.map((stroke) => (
            <Path
              key={stroke.id}
              d={pointsToSvgPath(stroke.points)}
              stroke={stroke.color}
              strokeWidth={stroke.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
      )}
      {frame.textOverlays && frame.textOverlays.length > 0 && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 25 }]} pointerEvents="none">
          {frame.textOverlays.map((ov) => (
            <View
              key={ov.id}
              style={{
                position: 'absolute',
                left: `${(ov.x * 100).toFixed(2)}%` as any,
                top: `${(ov.y * 100).toFixed(2)}%` as any,
                transform: [{ translateX: -50 }, { translateY: -50 }],
              }}
            >
              <View
                style={
                  ov.backgroundColor && ov.backgroundColor !== 'transparent'
                    ? { backgroundColor: ov.backgroundColor, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }
                    : null
                }
              >
                <Text
                  style={[
                    {
                      fontFamily: fontLoader.isFontLoaded(ov.fontFamily)
                        ? ov.fontFamily
                        : undefined,
                      fontSize: ov.fontSize,
                      color: ov.color,
                      textAlign: ov.align || 'center',
                    },
                    ov.shadow && {
                      textShadowColor: 'rgba(0, 0, 0, 0.9)',
                      textShadowOffset: { width: 1.5, height: 1.5 },
                      textShadowRadius: 3,
                    },
                  ]}
                >
                  {ov.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
});

const HardwareOnionLayer = React.memo(({
  frame,
  index,
  scrubFrameIndex,
  opacity,
  tintColor,
  showNext,
  nextOpacity,
  aspectFitMode,
  mode = 'ghost',
  isBlinkVisible = true,
}: {
  frame: Frame;
  index: number;
  scrubFrameIndex: SharedValue<number>;
  opacity: number;
  tintColor?: string;
  showNext?: boolean;
  nextOpacity?: number;
  aspectFitMode: string;
  mode?: 'ghost' | 'blink' | 'difference';
  isBlinkVisible?: boolean;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const isCurrent = scrubFrameIndex.value === index;
    const isForward = showNext && scrubFrameIndex.value === index - 1;

    let targetOpacity = 0;
    if (mode === 'blink') {
      targetOpacity = isCurrent && isBlinkVisible ? 1 : 0;
    } else if (mode === 'difference') {
      targetOpacity = isCurrent ? 0.75 : 0;
    } else {
      if (isCurrent) {
        targetOpacity = opacity;
      } else if (isForward) {
        targetOpacity = nextOpacity ?? 0.35;
      }
    }

    return {
      opacity: targetOpacity,
      transform: [{ translateX: (isCurrent || isForward) ? 0 : SCREEN_WIDTH * 2 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        animatedStyle,
        { zIndex: 15 },
      ]}
    >
      <ExpoImage
        source={{ uri: frame.proxyUri || frame.uri }}
        style={[
          styles.onionSkinImage,
          tintColor ? { tintColor } : undefined,
        ]}
        contentFit={aspectFitMode === 'cover' ? 'cover' : 'contain'}
        transition={0}
        cachePolicy="memory-disk"
        priority="high"
      />
    </Animated.View>
  );
});
