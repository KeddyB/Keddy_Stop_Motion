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
  Dimensions,
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

  // State: 'idle' | 'countdown' | 'recording' | 'preview'
  const [recordState, setRecordState] = useState<'idle' | 'countdown' | 'recording' | 'preview'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize expo-audio recorder with High Quality preset
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.pause();
        } catch {}
      }
    };
  }, []);

  // Frame animation playback loop helper
  const startFrameLoop = () => {
    if (frames.length === 0) return;
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    setCurrentFrameIndex(0);
    const intervalMs = 1000 / Math.max(1, fps);
    playbackTimerRef.current = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
    }, intervalMs);
  };

  const stopFrameLoop = () => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  // Reset modal state when opened
  useEffect(() => {
    if (visible) {
      setRecordState('idle');
      setCountdown(3);
      setCurrentFrameIndex(0);
      setRecordedUri(null);
      setRecordDuration(0);
    } else {
      stopFrameLoop();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.pause();
        } catch {}
      }
    }
  }, [visible]);

  // Start Countdown Sequence
  const handleStartCountdown = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone Access Needed', 'Please allow microphone access to record voiceovers.');
        return;
      }

      setRecordState('countdown');
      setCountdown(3);

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
      console.warn('Countdown error:', e);
      setRecordState('idle');
    }
  };

  // Begin actual microphone recording
  const beginLiveRecording = async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      setRecordState('recording');
      setRecordDuration(0);

      // Start duration counter
      const startT = Date.now();
      durationTimerRef.current = setInterval(() => {
        setRecordDuration(Math.floor((Date.now() - startT) / 1000));
      }, 1000);

      // Start frame playback loop synced
      startFrameLoop();
    } catch (e) {
      console.warn('Record start error:', e);
      Alert.alert('Recording Failed', 'Could not access audio device to record.');
      setRecordState('idle');
      stopFrameLoop();
    }
  };

  // Stop recording and enter preview mode
  const handleStopRecording = async () => {
    try {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      stopFrameLoop();

      await recorder.stop();
      const outputUri = recorder.uri;

      if (!outputUri) {
        Alert.alert('No Audio', 'No audio was recorded.');
        setRecordState('idle');
        return;
      }

      setRecordedUri(outputUri);
      setRecordState('preview');

      // Play back audio with animation loop
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      try {
        playerRef.current = createAudioPlayer({ uri: outputUri });
        playerRef.current.loop = true;
        playerRef.current.play();
        startFrameLoop();
      } catch (e) {
        console.warn('Preview playback error:', e);
      }
    } catch (e) {
      console.warn('Stop recording error:', e);
      setRecordState('idle');
    }
  };

  // Attach & Save Voiceover
  const handleSaveAndAttach = async () => {
    if (!recordedUri) return;
    try {
      setIsSaving(true);
      if (playerRef.current) {
        try {
          playerRef.current.pause();
        } catch {}
      }
      stopFrameLoop();

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
        name: `Voiceover (${recordDuration}s)`,
        durationSeconds: recordDuration,
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
    if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
    }
    stopFrameLoop();
    setRecordState('idle');
    setRecordedUri(null);
    setRecordDuration(0);
  };

  const activeFrame = frames[currentFrameIndex];

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
            <View style={styles.modalCardWrapper}>
              <GlassSurface
                variant="elevated"
                borderRadius={24}
                contentStyle={styles.modalCardContent}
              >
                {/* Header */}
                <View style={styles.headerRow}>
                  <View style={styles.headerTitleGroup}>
                    <Ionicons name="mic" size={20} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                      Voiceover Studio
                    </Text>
                  </View>
                  <GlassButton
                    size="icon"
                    icon="close"
                    iconSize={18}
                    onPress={onClose}
                  />
                </View>

                {/* Live Animation Screen Box */}
                <View style={styles.previewBox}>
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
                      <Text style={styles.countdownSub}>Get ready to speak...</Text>
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

                {/* Bottom Action Controls */}
                <View style={styles.actionsContainer}>
                  {recordState === 'idle' && (
                    <View style={styles.buttonGroup}>
                      <Text style={[styles.instructionText, { color: theme.textMuted }]}>
                        Tap Record and voice your characters while the scene loops!
                      </Text>
                      <Pressable
                        style={({ pressed }) => [
                          styles.recordStartBtn,
                          { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
                        ]}
                        onPress={handleStartCountdown}
                      >
                        <Ionicons name="mic" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.recordStartBtnText}>Start Recording</Text>
                      </Pressable>
                    </View>
                  )}

                  {recordState === 'countdown' && (
                    <View style={styles.buttonGroup}>
                      <Text style={[styles.instructionText, { color: '#F59E0B' }]}>
                        Starting in {countdown} seconds...
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
                      <Pressable
                        style={({ pressed }) => [
                          styles.recordStopBtn,
                          { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
                        ]}
                        onPress={handleStopRecording}
                      >
                        <Ionicons name="stop" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.recordStopBtnText}>Stop Recording ({recordDuration}s)</Text>
                      </Pressable>
                    </View>
                  )}

                  {recordState === 'preview' && (
                    <View style={styles.previewButtonGroup}>
                      <Pressable
                        style={styles.reRecordBtn}
                        onPress={handleReRecord}
                      >
                        <Ionicons name="refresh" size={18} color="#D1D5DB" style={{ marginRight: 6 }} />
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
                            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.saveAudioText}>Attach Voiceover</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
  },
  modalCardContent: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  previewBox: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#050505',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  emptyFramesBox: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyFramesText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  frameBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  frameBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  countdownText: {
    color: '#F59E0B',
    fontSize: 64,
    fontWeight: '900',
  },
  countdownSub: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  liveRecordIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  redPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  liveRecordText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  previewBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionsContainer: {
    marginTop: 16,
  },
  buttonGroup: {
    alignItems: 'center',
    gap: 12,
  },
  instructionText: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  recordStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  recordStartBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelCountdownBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelCountdownText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  recordStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  recordStopBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  previewButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  reRecordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 12,
    borderRadius: 14,
  },
  reRecordText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '700',
  },
  saveAudioBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 3,
  },
  saveAudioText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
