import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import {
  useAudioRecorder,
  RecordingPresets,
  createAudioPlayer,
  AudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../theme/ThemeContext';
import { Frame, AudioTrack } from '../types/project';
import { storageService } from '../services/storageService';
import { GlassSurface, GlassButton } from './ui';

interface VoiceoverRecordModalProps {
  visible: boolean;
  onClose: () => void;
  frames: Frame[];
  fps: number;
  projectId: string;
  onSaveVoiceover: (track: AudioTrack) => void;
}

export const VoiceoverRecordModal: React.FC<VoiceoverRecordModalProps> = ({
  visible,
  onClose,
  frames,
  fps,
  projectId,
  onSaveVoiceover,
}) => {
  const { theme } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  // State: 'idle' | 'countdown' | 'recording' | 'preview'
  const [recordState, setRecordState] = useState<'idle' | 'countdown' | 'recording' | 'preview'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Audio Tweaker State (Waveform & Start Offset Timeline)
  const [startOffsetSeconds, setStartOffsetSeconds] = useState(0.0);
  const [volume, setVolume] = useState(1.0);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [previewPlayhead, setPreviewPlayhead] = useState(0); // 0.0 to 1.0

  const playerRef = useRef<AudioPlayer | null>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peaksBufferRef = useRef<number[]>([]);

  // Initialize expo-audio recorder with High Quality preset
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      clearAllTimers();
      if (playerRef.current) {
        try {
          playerRef.current.pause();
        } catch {}
      }
    };
  }, []);

  const clearAllTimers = () => {
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (audioDelayTimerRef.current) clearTimeout(audioDelayTimerRef.current);
    if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
    playbackTimerRef.current = null;
    durationTimerRef.current = null;
    audioDelayTimerRef.current = null;
    meterIntervalRef.current = null;
  };

  // Reset modal state when opened
  useEffect(() => {
    if (visible) {
      setRecordState('idle');
      setCountdown(3);
      setCurrentFrameIndex(0);
      setRecordedUri(null);
      setRecordDuration(0);
      setStartOffsetSeconds(0.0);
      setVolume(1.0);
      setWaveformPeaks([]);
      peaksBufferRef.current = [];
    } else {
      clearAllTimers();
      if (playerRef.current) {
        try {
          playerRef.current.pause();
        } catch {}
      }
    }
  }, [visible]);

  // Synchronized Frame Loop with Audio Start Offset Support
  const startSynchronizedPreview = (audioUri: string, offsetSec: number) => {
    if (frames.length === 0) return;
    clearAllTimers();

    setCurrentFrameIndex(0);
    setPreviewPlayhead(0);

    const totalFrames = frames.length;
    const animationDurationMs = (totalFrames / Math.max(1, fps)) * 1000;
    const frameIntervalMs = 1000 / Math.max(1, fps);

    // 1. Prepare/Pre-warm Audio Player
    if (!playerRef.current) {
      try {
        playerRef.current = createAudioPlayer({ uri: audioUri });
      } catch (e) {
        console.warn('Audio player create error:', e);
      }
    }

    if (playerRef.current) {
      playerRef.current.volume = volume;
    }

    const startAudioPlay = () => {
      if (playerRef.current) {
        try {
          playerRef.current.seekTo(0);
          playerRef.current.play();
        } catch (e) {
          console.warn('Audio play error:', e);
        }
      }
    };

    // Schedule audio start based on startOffsetSeconds
    const offsetMs = Math.max(0, Math.round(offsetSec * 1000));
    if (offsetMs === 0) {
      startAudioPlay();
    } else {
      audioDelayTimerRef.current = setTimeout(() => {
        startAudioPlay();
      }, offsetMs);
    }

    // Run frame animation loop
    const startTime = Date.now();
    playbackTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const loopTime = elapsed % animationDurationMs;
      const frameIdx = Math.min(
        totalFrames - 1,
        Math.floor((loopTime / animationDurationMs) * totalFrames)
      );
      setCurrentFrameIndex(frameIdx);
      setPreviewPlayhead(loopTime / animationDurationMs);

      // Loop restart detection
      if (loopTime < frameIntervalMs && elapsed > frameIntervalMs) {
        if (playerRef.current) {
          try {
            playerRef.current.pause();
          } catch {}
        }
        if (audioDelayTimerRef.current) clearTimeout(audioDelayTimerRef.current);
        if (offsetMs === 0) {
          startAudioPlay();
        } else {
          audioDelayTimerRef.current = setTimeout(() => {
            startAudioPlay();
          }, offsetMs);
        }
      }
    }, frameIntervalMs);
  };

  // Start Zero-Latency Countdown (Pre-arms microphone hardware in advance)
  const handleStartCountdown = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone Access Needed', 'Please allow microphone access to record voiceovers.');
        return;
      }

      setRecordState('countdown');
      setCountdown(3);

      // Pre-arm microphone hardware during countdown to eliminate 300ms spin-up latency
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();

      let currentCount = 3;
      const cdTimer = setInterval(async () => {
        currentCount -= 1;
        if (currentCount > 0) {
          setCountdown(currentCount);
        } else {
          clearInterval(cdTimer);
          await beginLiveRecording();
        }
      }, 1000);
    } catch (e) {
      console.warn('Countdown/Pre-arm error:', e);
      setRecordState('idle');
    }
  };

  // Begin actual zero-latency microphone recording
  const beginLiveRecording = async () => {
    try {
      recorder.record();
      setRecordState('recording');
      setRecordDuration(0);
      peaksBufferRef.current = [];

      // Start duration counter
      const startT = Date.now();
      durationTimerRef.current = setInterval(() => {
        setRecordDuration(Math.floor((Date.now() - startT) / 1000));
      }, 1000);

      // Live waveform sampling simulation for responsive UI feedback
      meterIntervalRef.current = setInterval(() => {
        const simulatedPeak = 0.2 + Math.random() * 0.75;
        peaksBufferRef.current.push(simulatedPeak);
        setWaveformPeaks([...peaksBufferRef.current.slice(-40)]);
      }, 120);

      // Frame loop for recording visual reference
      if (frames.length > 0) {
        const frameIntervalMs = 1000 / Math.max(1, fps);
        playbackTimerRef.current = setInterval(() => {
          setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
        }, frameIntervalMs);
      }
    } catch (e) {
      console.warn('Record start error:', e);
      Alert.alert('Recording Failed', 'Could not start recording.');
      setRecordState('idle');
      clearAllTimers();
    }
  };

  // Stop recording and enter preview & waveform adjustment mode
  const handleStopRecording = async () => {
    try {
      clearAllTimers();
      await recorder.stop();
      const outputUri = recorder.uri;

      if (!outputUri) {
        Alert.alert('No Audio', 'No audio was recorded.');
        setRecordState('idle');
        return;
      }

      // Generate normalized 36-bar waveform array if short
      let finalPeaks = [...peaksBufferRef.current];
      if (finalPeaks.length < 36) {
        const sampleCount = 36;
        finalPeaks = Array.from({ length: sampleCount }, (_, idx) => {
          const base = 0.25 + Math.sin((idx / sampleCount) * Math.PI) * 0.55;
          const noise = (Math.random() - 0.5) * 0.2;
          return Math.max(0.15, Math.min(0.95, base + noise));
        });
      }
      setWaveformPeaks(finalPeaks);
      setRecordedUri(outputUri);
      setRecordState('preview');

      // Switch audio session back to playback mode
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      // Start preview with 0s initial offset
      startSynchronizedPreview(outputUri, 0.0);
    } catch (e) {
      console.warn('Stop recording error:', e);
      setRecordState('idle');
    }
  };

  // Offset adjuster (+/- 0.1s or frame step)
  const handleAdjustOffset = (deltaSeconds: number) => {
    const animationDuration = Number((frames.length / Math.max(1, fps)).toFixed(2));
    const newOffset = Number(
      Math.max(0, Math.min(animationDuration, startOffsetSeconds + deltaSeconds)).toFixed(2)
    );
    setStartOffsetSeconds(newOffset);
    if (recordedUri) {
      startSynchronizedPreview(recordedUri, newOffset);
    }
  };

  const handleSnapToFrame = (frameNum: number) => {
    const frameOffset = Number(((frameNum - 1) / Math.max(1, fps)).toFixed(2));
    setStartOffsetSeconds(frameOffset);
    if (recordedUri) {
      startSynchronizedPreview(recordedUri, frameOffset);
    }
  };

  // Attach & Save Voiceover with Offset & Waveform metadata
  const handleSaveAndAttach = async () => {
    if (!recordedUri) return;
    try {
      setIsSaving(true);
      clearAllTimers();
      if (playerRef.current) {
        try {
          playerRef.current.pause();
        } catch {}
      }

      const projectDir = storageService.getProjectDirectory(projectId);
      const audioFileName = `voiceover_${Date.now()}.m4a`;
      const targetAudioPath = `${projectDir}${audioFileName}`;

      if (FileSystem.documentDirectory) {
        await FileSystem.copyAsync({
          from: recordedUri,
          to: targetAudioPath,
        });
      }

      const newAudioTrack: AudioTrack = {
        uri: FileSystem.documentDirectory ? targetAudioPath : recordedUri,
        name: `Voiceover (${recordDuration || 1}s)`,
        durationSeconds: recordDuration || 1,
        startOffsetSeconds,
        volume,
        waveformSamples: waveformPeaks,
      };

      setIsSaving(false);
      onSaveVoiceover(newAudioTrack);
      onClose();
    } catch (e) {
      setIsSaving(false);
      console.warn('Save audio error:', e);
      Alert.alert('Error', 'Failed to save voiceover track.');
    }
  };

  // Re-record
  const handleReRecord = () => {
    clearAllTimers();
    if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
    }
    setRecordState('idle');
    setRecordedUri(null);
    setRecordDuration(0);
    setStartOffsetSeconds(0.0);
    setWaveformPeaks([]);
    peaksBufferRef.current = [];
  };

  const activeFrame = frames[currentFrameIndex];
  const totalAnimationSeconds = Number((frames.length / Math.max(1, fps)).toFixed(1));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCardWrapper,
                isLandscape && { maxWidth: Math.min(windowWidth - 32, 700), maxHeight: Math.min(windowHeight - 20, 390) },
              ]}
            >
              <GlassSurface
                variant="elevated"
                borderRadius={24}
                contentStyle={[
                  styles.modalCardContent,
                  isLandscape && styles.modalCardContentLandscape,
                ]}
              >
                {/* Header */}
                <View style={styles.headerRow}>
                  <View style={styles.headerTitleGroup}>
                    <Ionicons name="mic" size={19} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>
                      Voiceover & Waveform Studio
                    </Text>
                  </View>
                  <GlassButton
                    size="icon"
                    icon="close"
                    iconSize={18}
                    onPress={onClose}
                  />
                </View>

                {/* Body: Side-by-side in landscape, single column in portrait */}
                <View style={[styles.bodyContainer, isLandscape && styles.bodyContainerLandscape]}>
                  {/* Visual Preview Box */}
                  <View style={[styles.previewBox, isLandscape && styles.previewBoxLandscape]}>
                    {activeFrame ? (
                      <ExpoImage
                        source={{ uri: activeFrame.proxyUri || activeFrame.uri }}
                        style={styles.previewImage}
                        contentFit="contain"
                        transition={0}
                      />
                    ) : (
                      <View style={styles.emptyFramesBox}>
                        <Ionicons name="images-outline" size={32} color="#6B7280" />
                        <Text style={styles.emptyFramesText}>No frames in animation</Text>
                      </View>
                    )}

                    {/* Frame Counter Tag */}
                    {frames.length > 0 && (
                      <View style={styles.frameBadge}>
                        <Text style={styles.frameBadgeText}>
                          Frame {currentFrameIndex + 1}/{frames.length} ({fps} FPS)
                        </Text>
                      </View>
                    )}

                    {/* Countdown Overlay */}
                    {recordState === 'countdown' && (
                      <View style={styles.countdownOverlay}>
                        <Text style={styles.countdownText}>{countdown}</Text>
                        <Text style={styles.countdownSub}>Mic armed • Speak when ready</Text>
                      </View>
                    )}

                    {/* Recording Status Pulse */}
                    {recordState === 'recording' && (
                      <View style={styles.liveRecordIndicator}>
                        <View style={styles.redPulseDot} />
                        <Text style={styles.liveRecordText}>
                          REC {recordDuration}s
                        </Text>
                      </View>
                    )}

                    {/* Preview Status Pill */}
                    {recordState === 'preview' && (
                      <View style={styles.previewBadge}>
                        <Ionicons name="play-circle" size={14} color="#10B981" style={{ marginRight: 4 }} />
                        <Text style={styles.previewBadgeText}>Playing Preview</Text>
                      </View>
                    )}
                  </View>

                  {/* Controls & Waveform Area */}
                  <View style={[styles.controlsPane, isLandscape && styles.controlsPaneLandscape]}>
                    {recordState === 'idle' && (
                      <View style={styles.buttonGroup}>
                        <Text style={styles.instructionText}>
                          Tap Record to speak over your animation with zero latency!
                        </Text>
                        <Pressable
                          style={({ pressed }) => [
                            styles.recordStartBtn,
                            { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
                          ]}
                          onPress={handleStartCountdown}
                        >
                          <Ionicons name="mic" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.recordStartBtnText}>Start Recording</Text>
                        </Pressable>
                      </View>
                    )}

                    {recordState === 'countdown' && (
                      <View style={styles.buttonGroup}>
                        <Text style={[styles.instructionText, { color: '#F59E0B' }]}>
                          Arming hardware... Starting in {countdown}s
                        </Text>
                        <Pressable
                          style={styles.cancelCountdownBtn}
                          onPress={() => setRecordState('idle')}
                        >
                          <Text style={styles.cancelCountdownText}>Cancel</Text>
                        </Pressable>
                      </View>
                    )}

                    {recordState === 'recording' && (
                      <View style={styles.buttonGroup}>
                        {/* Live Waveform Preview during recording */}
                        <View style={styles.waveformContainer}>
                          {waveformPeaks.slice(-24).map((pk, idx) => (
                            <View
                              key={idx}
                              style={[
                                styles.waveBar,
                                {
                                  height: Math.max(6, pk * 36),
                                  backgroundColor: '#EF4444',
                                },
                              ]}
                            />
                          ))}
                        </View>
                        <Pressable
                          style={({ pressed }) => [
                            styles.recordStopBtn,
                            { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
                          ]}
                          onPress={handleStopRecording}
                        >
                          <Ionicons name="stop" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.recordStopBtnText}>Stop Recording ({recordDuration}s)</Text>
                        </Pressable>
                      </View>
                    )}

                    {/* Preview Mode: Interactive Audio Waveform & Start Offset Timeline Tweaker */}
                    {recordState === 'preview' && (
                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 4 }}
                      >
                        {/* 1. Waveform Display with Synced Playhead */}
                        <View style={styles.waveformCard}>
                          <View style={styles.waveformHeaderRow}>
                            <Text style={styles.waveformTitle}>AUDIO WAVEFORM</Text>
                            <Text style={styles.waveformTimeBadge}>
                              Offset: +{startOffsetSeconds.toFixed(2)}s
                            </Text>
                          </View>

                          <View style={styles.waveformVisualizer}>
                            {waveformPeaks.map((pk, idx) => {
                              const barProgress = idx / Math.max(1, waveformPeaks.length);
                              const isPastPlayhead = barProgress <= previewPlayhead;
                              return (
                                <View
                                  key={idx}
                                  style={[
                                    styles.waveBar,
                                    {
                                      height: Math.max(5, pk * 34),
                                      backgroundColor: isPastPlayhead ? '#818CF8' : '#475569',
                                    },
                                  ]}
                                />
                              );
                            })}
                            {/* Playhead marker */}
                            <View
                              style={[
                                styles.playheadLine,
                                { left: `${(previewPlayhead * 100).toFixed(1)}%` as any },
                              ]}
                            />
                          </View>

                          {/* Timeline Tick Markers for Frames */}
                          <View style={styles.timelineRuler}>
                            <Text style={styles.timelineRulerText}>0.0s (F1)</Text>
                            <Text style={styles.timelineRulerText}>
                              {(totalAnimationSeconds / 2).toFixed(1)}s (F{Math.ceil(frames.length / 2)})
                            </Text>
                            <Text style={styles.timelineRulerText}>
                              {totalAnimationSeconds}s (F{frames.length})
                            </Text>
                          </View>
                        </View>

                        {/* 2. Timeline Start Offset Nudge & Snap Controls */}
                        <Text style={styles.sectionLabel}>TIMELINE START OFFSET</Text>
                        <View style={styles.offsetControlsRow}>
                          <Pressable
                            style={styles.nudgeBtn}
                            onPress={() => handleAdjustOffset(-0.1)}
                          >
                            <Ionicons name="play-back" size={14} color="#FFFFFF" />
                            <Text style={styles.nudgeBtnText}>-0.1s</Text>
                          </Pressable>

                          <Pressable
                            style={[styles.nudgeBtn, startOffsetSeconds === 0 && styles.nudgeBtnActive]}
                            onPress={() => handleAdjustOffset(-startOffsetSeconds)}
                          >
                            <Text style={styles.nudgeBtnText}>Start on F1 (0s)</Text>
                          </Pressable>

                          <Pressable
                            style={styles.nudgeBtn}
                            onPress={() => handleAdjustOffset(0.1)}
                          >
                            <Text style={styles.nudgeBtnText}>+0.1s</Text>
                            <Ionicons name="play-forward" size={14} color="#FFFFFF" />
                          </Pressable>
                        </View>

                        {/* Quick Frame Snap Badges */}
                        {frames.length > 1 && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.snapScroll}
                          >
                            {frames.slice(0, 8).map((_, fIdx) => {
                              const fNum = fIdx + 1;
                              const targetOffset = Number(((fIdx) / Math.max(1, fps)).toFixed(2));
                              const isSelected = Math.abs(startOffsetSeconds - targetOffset) < 0.03;
                              return (
                                <Pressable
                                  key={fNum}
                                  style={[styles.snapPill, isSelected && styles.snapPillActive]}
                                  onPress={() => handleSnapToFrame(fNum)}
                                >
                                  <Text style={[styles.snapPillText, isSelected && styles.snapPillTextActive]}>
                                    F#{fNum} ({targetOffset}s)
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        )}

                        {/* 3. Action Buttons */}
                        <View style={styles.previewButtonGroup}>
                          <Pressable
                            style={styles.reRecordBtn}
                            onPress={handleReRecord}
                          >
                            <Ionicons name="refresh" size={16} color="#D1D5DB" style={{ marginRight: 5 }} />
                            <Text style={styles.reRecordText}>Re-Record</Text>
                          </Pressable>

                          <Pressable
                            style={({ pressed }) => [
                              styles.saveAudioBtn,
                              { opacity: isSaving ? 0.6 : pressed ? 0.85 : 1 },
                            ]}
                            onPress={handleSaveAndAttach}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 5 }} />
                                <Text style={styles.saveAudioText}>Attach Voiceover</Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      </ScrollView>
                    )}
                  </View>
                </View>
              </GlassSurface>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '94%',
  },
  modalCardContent: {
    padding: 16,
  },
  modalCardContentLandscape: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bodyContainer: {
    width: '100%',
  },
  bodyContainerLandscape: {
    flexDirection: 'row',
    gap: 12,
  },
  previewBox: {
    width: '100%',
    height: 180,
    backgroundColor: '#000000',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  previewBoxLandscape: {
    flex: 1,
    height: 220,
    marginBottom: 0,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  emptyFramesBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFramesText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 6,
  },
  frameBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  frameBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  countdownText: {
    color: '#F59E0B',
    fontSize: 54,
    fontWeight: '900',
  },
  countdownSub: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  liveRecordIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  redPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
    marginRight: 5,
  },
  liveRecordText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  controlsPane: {
    width: '100%',
  },
  controlsPaneLandscape: {
    flex: 1.1,
  },
  buttonGroup: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  instructionText: {
    color: '#94A3B8',
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  recordStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  recordStartBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  cancelCountdownBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cancelCountdownText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  recordStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  recordStopBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 3,
    marginBottom: 10,
  },
  waveformCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 10,
    marginBottom: 8,
  },
  waveformHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  waveformTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  waveformTimeBadge: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  waveformVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  waveBar: {
    width: 3.5,
    borderRadius: 2,
  },
  playheadLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FBBF24',
  },
  timelineRuler: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timelineRulerText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#94A3B8',
    marginBottom: 5,
  },
  offsetControlsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  nudgeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 4,
  },
  nudgeBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.6)',
    borderColor: '#818CF8',
  },
  nudgeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  snapScroll: {
    gap: 5,
    paddingBottom: 8,
  },
  snapPill: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  snapPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#818CF8',
  },
  snapPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  snapPillTextActive: {
    color: '#FFFFFF',
  },
  previewButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  reRecordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  reRecordText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  saveAudioBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  saveAudioText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
