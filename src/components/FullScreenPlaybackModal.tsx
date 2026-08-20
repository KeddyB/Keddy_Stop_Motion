import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  useWindowDimensions,
  StatusBar,
  Easing,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LiquidGlassContainerView,
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { Frame } from '../types/project';
import { useAppSettings } from '../context/SettingsContext';

interface FullScreenPlaybackModalProps {
  visible: boolean;
  onClose: () => void;
  frames: Frame[];
  initialFrameIndex?: number;
  initialFps?: number;
  onFpsChange?: (newFps: number) => void;
  aspectRatio?: number;
}

// Convert doodle points to SVG path
const pointsToSvgPath = (points: Array<{ x: number; y: number }>) => {
  if (!points || points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
};

// Memoized Canvas View: Prevents image reloads while controls are interacted with
const FullScreenCanvas = memo(({ imageUri, doodles }: { imageUri: string; doodles?: any[] }) => (
  <View style={styles.canvasContainer} pointerEvents="none">
    {imageUri ? (
      <ExpoImage
        source={{ uri: imageUri }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={0}
        cachePolicy="memory-disk"
        priority="high"
      />
    ) : null}

    {doodles && doodles.length > 0 && (
      <Svg style={StyleSheet.absoluteFill}>
        {doodles.map((stroke) => (
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
  </View>
));

export const FullScreenPlaybackModal: React.FC<FullScreenPlaybackModalProps> = ({
  visible,
  onClose,
  frames,
  initialFrameIndex = 0,
  initialFps = 12,
  onFpsChange,
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { settings } = useAppSettings();

  const isLiquidEnabled = settings?.liquidGlassEnabled ?? true;

  const [currentIndex, setCurrentIndex] = useState(
    Math.min(frames.length - 1, Math.max(0, initialFrameIndex))
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(initialFps);
  const [loopMode, setLoopMode] = useState<'loop' | 'once' | 'bounce'>('loop');
  const [showControls, setShowControls] = useState(true);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  // Smooth fade animation for controls (keeps views mounted to eliminate render stalls)
  const animateControls = (toValue: number) => {
    Animated.timing(controlsOpacity, {
      toValue,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const resetControlsTimer = () => {
    setShowControls(true);
    animateControls(1);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
      animateControls(0);
    }, 3200);
  };

  const handleToggleControls = () => {
    if (!showControls) {
      resetControlsTimer();
    } else {
      setShowControls(false);
      animateControls(0);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
  };

  // Sync initial state on modal open
  useEffect(() => {
    if (visible) {
      setCurrentIndex(Math.min(frames.length - 1, Math.max(0, initialFrameIndex)));
      setFps(initialFps);
      setIsPlaying(true);
      resetControlsTimer();
    }
  }, [visible]);

  // Pre-warm proxy and full-res frame textures into memory cache
  useEffect(() => {
    if (visible && frames.length > 0) {
      const proxyUris = frames.map((f) => f.proxyUri).filter(Boolean) as string[];
      const fullUris = frames.map((f) => f.uri).filter(Boolean) as string[];
      ExpoImage.prefetch(proxyUris.length > 0 ? proxyUris : fullUris);
    }
  }, [visible, frames]);

  // High precision frame-by-frame timer for playback loop
  useEffect(() => {
    if (!visible || !isPlaying || frames.length <= 1) return;

    const intervalMs = Math.max(16, Math.round(1000 / fps));
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (loopMode === 'once') {
          if (prev >= frames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        } else if (loopMode === 'loop') {
          return (prev + 1) % frames.length;
        } else {
          // Bounce
          if (direction === 'forward') {
            if (prev >= frames.length - 1) {
              setDirection('backward');
              return Math.max(0, prev - 1);
            }
            return prev + 1;
          } else {
            if (prev <= 0) {
              setDirection('forward');
              return Math.min(frames.length - 1, 1);
            }
            return prev - 1;
          }
        }
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [visible, isPlaying, frames.length, fps, loopMode, direction]);

  const handlePrevFrame = () => {
    setIsPlaying(false);
    resetControlsTimer();
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextFrame = () => {
    setIsPlaying(false);
    resetControlsTimer();
    setCurrentIndex((prev) => Math.min(frames.length - 1, prev + 1));
  };

  const handleTogglePlay = () => {
    resetControlsTimer();
    setIsPlaying((prev) => !prev);
  };

  const handleToggleLoopMode = () => {
    resetControlsTimer();
    if (loopMode === 'loop') setLoopMode('bounce');
    else if (loopMode === 'bounce') setLoopMode('once');
    else setLoopMode('loop');
  };

  const handleFpsChange = (newFps: number) => {
    resetControlsTimer();
    setFps(newFps);
    if (onFpsChange) onFpsChange(newFps);
  };

  const activeFrame = frames[currentIndex] || frames[0];
  const currentTimeSec = (currentIndex / fps).toFixed(2);
  const totalTimeSec = (frames.length / fps).toFixed(2);

  // During active high-speed playback, use optimized proxy textures for silky 60/120 FPS.
  // When paused, load the original crystal clear capture!
  const imageSourceUri = isPlaying
    ? (activeFrame?.proxyUri || activeFrame?.uri || '')
    : (activeFrame?.uri || activeFrame?.proxyUri || '');

  const progressPercent = frames.length > 1
    ? (currentIndex / (frames.length - 1)) * 100
    : 100;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Full Screen High-Performance Playback Canvas */}
        <FullScreenCanvas imageUri={imageSourceUri} doodles={activeFrame?.doodles} />

        {/* Dedicated Background Tap Area (behind HUD in z-index so buttons are never obstructed) */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleToggleControls}
          unstable_pressDelay={0}
        />

        {/* HUD Controls (Smoothly Animated Opacity - 0 Layout Lag) */}
        <Animated.View
          style={[styles.hudOverlay, { opacity: controlsOpacity }]}
          pointerEvents={showControls ? 'box-none' : 'none'}
        >
          {/* Top Bar with Liquid Glass Badge */}
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <View style={styles.topInfoBadge}>
              {isLiquidEnabled && isLiquidGlassSupported ? (
                <LiquidGlassView
                  style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                  effect="clear"
                  interactive
                />
              ) : null}
              <Ionicons name="film-outline" size={16} color="#818CF8" style={{ marginRight: 6 }} />
              <Text style={styles.topInfoText}>
                {isPlaying ? 'Studio Playback' : 'Full-Resolution Inspection'} • {frames.length} frames
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.exitBtn,
                { transform: [{ scale: pressed ? 0.90 : 1 }] },
              ]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={onClose}
            >
              {isLiquidEnabled && isLiquidGlassSupported ? (
                <LiquidGlassView
                  style={[StyleSheet.absoluteFill, { borderRadius: 19 }]}
                  effect="clear"
                  interactive
                />
              ) : null}
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Bottom Controls Card (Translucent Liquid Glass) */}
          <View style={[styles.bottomControlWrapper, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
            <View style={styles.bottomControlCard}>
              {isLiquidEnabled && isLiquidGlassSupported ? (
                <LiquidGlassView
                  style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
                  effect="clear"
                  interactive
                />
              ) : null}

              {/* Time & Frame Counter Row */}
              <View style={styles.timecodeRow}>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeText}>
                    Frame {currentIndex + 1} / {frames.length}
                  </Text>
                </View>
                <Text style={styles.timeSubText}>
                  {currentTimeSec}s / {totalTimeSec}s @ {fps} FPS
                </Text>
              </View>

              {/* Interactive Scrubber / Timeline Bar */}
              <View style={styles.scrubberContainer}>
                <View style={styles.scrubberTrack}>
                  <View style={[styles.scrubberProgress, { width: `${progressPercent}%` }]} />
                </View>
                {/* Scrubber Touch Area */}
                <View
                  style={styles.scrubberTouchOverlay}
                  onStartShouldSetResponder={() => true}
                  onResponderGrant={(evt) => {
                    setIsPlaying(false);
                    resetControlsTimer();
                    const x = evt.nativeEvent.locationX;
                    const targetIdx = Math.max(
                      0,
                      Math.min(
                        frames.length - 1,
                        Math.round((x / (screenWidth - 64)) * frames.length)
                      )
                    );
                    setCurrentIndex(targetIdx);
                  }}
                  onResponderMove={(evt) => {
                    const x = evt.nativeEvent.locationX;
                    const targetIdx = Math.max(
                      0,
                      Math.min(
                        frames.length - 1,
                        Math.round((x / (screenWidth - 64)) * frames.length)
                      )
                    );
                    setCurrentIndex(targetIdx);
                  }}
                />
              </View>

              {/* Primary Playback Buttons */}
              <View style={styles.controlsRow}>
                {/* Loop Mode Switcher */}
                <Pressable
                  style={({ pressed }) => [
                    styles.modeBtn,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                  onPress={handleToggleLoopMode}
                >
                  <Ionicons
                    name={
                      loopMode === 'loop'
                        ? 'repeat'
                        : loopMode === 'bounce'
                        ? 'swap-horizontal'
                        : 'arrow-forward'
                    }
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.modeBtnText}>
                    {loopMode.toUpperCase()}
                  </Text>
                </Pressable>

                {/* Previous Frame */}
                <Pressable
                  style={({ pressed }) => [
                    styles.stepBtn,
                    { transform: [{ scale: pressed ? 0.90 : 1 }] },
                  ]}
                  onPress={handlePrevFrame}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="play-skip-back" size={18} color="#FFFFFF" />
                </Pressable>

                {/* Big Play / Pause Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.playPauseBtn,
                    { transform: [{ scale: pressed ? 0.92 : 1 }] },
                  ]}
                  onPress={handleTogglePlay}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={26}
                    color="#FFFFFF"
                  />
                </Pressable>

                {/* Next Frame */}
                <Pressable
                  style={({ pressed }) => [
                    styles.stepBtn,
                    { transform: [{ scale: pressed ? 0.90 : 1 }] },
                  ]}
                  onPress={handleNextFrame}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="play-skip-forward" size={18} color="#FFFFFF" />
                </Pressable>

                {/* Quick FPS Presets */}
                <View style={styles.fpsSelector}>
                  {[6, 12, 24].map((rate) => (
                    <Pressable
                      key={rate}
                      style={[
                        styles.fpsChip,
                        fps === rate && styles.fpsChipActive,
                      ]}
                      onPress={() => handleFpsChange(rate)}
                    >
                      <Text
                        style={[
                          styles.fpsChipText,
                          fps === rate && styles.fpsChipTextActive,
                        ]}
                      >
                        {rate}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    zIndex: 100,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  topInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  topInfoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  exitBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomControlWrapper: {
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
  },
  bottomControlCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    padding: 16,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  timecodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.30)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#818CF8',
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  timeSubText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  scrubberContainer: {
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  scrubberTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  scrubberProgress: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  scrubberTouchOverlay: {
    ...StyleSheet.absoluteFill,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    gap: 6,
  },
  modeBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366F1',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  fpsSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    padding: 3,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  fpsChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  fpsChipActive: {
    backgroundColor: '#6366F1',
  },
  fpsChipText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    fontWeight: '700',
  },
  fpsChipTextActive: {
    color: '#FFFFFF',
  },
});
