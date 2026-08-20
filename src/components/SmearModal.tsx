import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Frame } from '../types/project';
import { storageService } from '../services/storageService';
import { GlassSurface, GlassButton } from './ui';

export type SmearStyle = 'trail' | 'speed_lines' | 'elastic';

interface SmearModalProps {
  visible: boolean;
  onClose: () => void;
  frameA: Frame;
  frameB: Frame;
  projectId: string;
  onInsertSmearFrame: (newFrame: Frame) => void;
  insertIndex: number;
}

export const SmearModal: React.FC<SmearModalProps> = ({
  visible,
  onClose,
  frameA,
  frameB,
  projectId,
  onInsertSmearFrame,
  insertIndex,
}) => {
  const { theme, isDark } = useTheme();
  const [style, setStyle] = useState<SmearStyle>('trail');
  const [intensity, setIntensity] = useState<number>(0.6); // 0.3, 0.6, 0.9
  const [isGenerating, setIsGenerating] = useState(false);

  const previewContainerRef = useRef<View>(null);

  const handleGenerateAndInsert = async () => {
    if (!previewContainerRef.current) return;
    try {
      setIsGenerating(true);

      // Snapshot the composite smear frame to a temporary image file
      const tempUri = await captureRef(previewContainerRef, {
        format: 'jpg',
        quality: 0.92,
      });

      const timestamp = Date.now();
      const frameId = `smear_${timestamp}`;
      const framesDir = storageService.getProjectFramesDirectory(projectId);
      const targetPath = `${framesDir}${frameId}.jpg`;

      if (FileSystem.documentDirectory) {
        await FileSystem.copyAsync({
          from: tempUri,
          to: targetPath,
        });
      }

      const newFrame: Frame = {
        id: frameId,
        uri: FileSystem.documentDirectory ? targetPath : tempUri,
        timestamp,
      };

      setIsGenerating(false);
      onInsertSmearFrame(newFrame);
      onClose();
    } catch (e) {
      setIsGenerating(false);
      console.warn('Smear generation error:', e);
      Alert.alert('Error', 'Could not generate smear frame.');
    }
  };

  const steps = intensity === 0.3 ? [0.35, 0.65] : intensity === 0.6 ? [0.25, 0.5, 0.75] : [0.2, 0.4, 0.6, 0.8];

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
                  <View>
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                      Generate Smear Frame
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                      Creating in-between motion between Frame #{insertIndex} and #{insertIndex + 1}
                    </Text>
                  </View>
                  <GlassButton
                    size="icon"
                    icon="close"
                    iconSize={18}
                    onPress={onClose}
                  />
                </View>

                {/* Composite Viewport Preview (Captured to File) */}
                <View style={styles.previewBox}>
                  <View
                    ref={previewContainerRef}
                    collapsable={false}
                    style={styles.compositeSurface}
                  >
                    {/* Base Background: Frame A */}
                    <Image
                      source={{ uri: frameA.uri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />

                    {/* Multi-Step Motion Trails / Smear Layer */}
                    {style === 'trail' && (
                      <>
                        {steps.map((alpha, idx) => (
                          <Image
                            key={`step_${idx}`}
                            source={{ uri: frameB.uri }}
                            style={[
                              StyleSheet.absoluteFill,
                              {
                                opacity: alpha * 0.7,
                                transform: [
                                  {
                                    scale: 1 + (idx - steps.length / 2) * 0.015 * intensity,
                                  },
                                ],
                              },
                            ]}
                            resizeMode="cover"
                          />
                        ))}
                      </>
                    )}

                    {style === 'speed_lines' && (
                      <>
                        <Image
                          source={{ uri: frameB.uri }}
                          style={[
                            StyleSheet.absoluteFill,
                            { opacity: 0.5 },
                          ]}
                          resizeMode="cover"
                        />
                        {/* Directional streak overlay */}
                        <View
                          style={[
                            StyleSheet.absoluteFill,
                            styles.speedStreakOverlay,
                            { opacity: intensity * 0.8 },
                          ]}
                        />
                      </>
                    )}

                    {style === 'elastic' && (
                      <Image
                        source={{ uri: frameB.uri }}
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            opacity: 0.55,
                            transform: [{ scaleX: 1 + intensity * 0.08 }],
                          },
                        ]}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                </View>

                {/* Smear Style Selector */}
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                  SMEAR STYLE
                </Text>
                <View style={styles.styleRow}>
                  <GlassButton
                    size="sm"
                    color={style === 'trail' ? 'primary' : 'default'}
                    icon="layers"
                    label="Action Trail"
                    onPress={() => setStyle('trail')}
                    style={{ flex: 1 }}
                  />

                  <GlassButton
                    size="sm"
                    color={style === 'speed_lines' ? 'primary' : 'default'}
                    icon="flash"
                    label="Speed Lines"
                    onPress={() => setStyle('speed_lines')}
                    style={{ flex: 1 }}
                  />

                  <GlassButton
                    size="sm"
                    color={style === 'elastic' ? 'primary' : 'default'}
                    icon="resize"
                    label="Elastic Stretch"
                    onPress={() => setStyle('elastic')}
                    style={{ flex: 1 }}
                  />
                </View>

                {/* Intensity Presets */}
                <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 12 }]}>
                  SMEAR INTENSITY
                </Text>
                <View style={styles.intensityRow}>
                  {[
                    { label: 'Subtle', val: 0.3 },
                    { label: 'Balanced', val: 0.6 },
                    { label: 'Extreme (Anime)', val: 0.9 },
                  ].map((item) => {
                    const isSelected = intensity === item.val;
                    return (
                      <GlassButton
                        key={item.val}
                        size="sm"
                        color={isSelected ? 'primary' : 'default'}
                        label={item.label}
                        onPress={() => setIntensity(item.val)}
                        style={{ flex: 1 }}
                      />
                    );
                  })}
                </View>

                {/* Generate & Insert CTA */}
                <GlassButton
                  size="lg"
                  color="primary"
                  icon="sparkles"
                  label={
                    isGenerating
                      ? 'Generating Smear...'
                      : `Insert Smear Frame at Position #${insertIndex + 1}`
                  }
                  disabled={isGenerating}
                  onPress={handleGenerateAndInsert}
                  style={{ marginTop: 10 }}
                />
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 440,
  },
  modalCardContent: {
    padding: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  previewBox: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: '#000000',
    marginBottom: 14,
  },
  compositeSurface: {
    flex: 1,
    position: 'relative',
  },
  speedStreakOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  styleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
});
