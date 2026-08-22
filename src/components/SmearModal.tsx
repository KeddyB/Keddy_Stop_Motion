import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../theme/ThemeContext';
import { Frame } from '../types/project';
import { storageService } from '../services/storageService';
import { GlassSurface } from './ui';

export type SmearStyle = 'trail' | 'speed_lines' | 'elastic';
export type SmearDirection = 'horizontal' | 'vertical' | 'diagonal_up' | 'diagonal_down';

interface SmearModalProps {
  visible: boolean;
  onClose: () => void;
  frames: Frame[];
  initialFrameIndex?: number;
  aspectRatio?: number;
  projectId: string;
  onInsertSmearFrame: (newFrame: Frame, insertIndex: number) => void;
}

export const SmearModal: React.FC<SmearModalProps> = ({
  visible,
  onClose,
  frames,
  initialFrameIndex = 0,
  aspectRatio = 16 / 9,
  projectId,
  onInsertSmearFrame,
}) => {
  const { theme } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  // Clamp initial index so frameA and frameB exist (0 <= frameAIndex < frames.length - 1)
  const initialIndexClamped = Math.max(
    0,
    Math.min(frames.length - 2, initialFrameIndex >= frames.length - 1 ? frames.length - 2 : initialFrameIndex)
  );

  const [frameAIndex, setFrameAIndex] = useState(initialIndexClamped);
  const [style, setStyle] = useState<SmearStyle>('trail');
  const [direction, setDirection] = useState<SmearDirection>('horizontal');
  const [intensity, setIntensity] = useState<number>(0.6); // 0.3, 0.6, 0.9
  const [isGenerating, setIsGenerating] = useState(false);

  const previewContainerRef = useRef<View>(null);

  useEffect(() => {
    const clamped = Math.max(
      0,
      Math.min(frames.length - 2, initialFrameIndex >= frames.length - 1 ? frames.length - 2 : initialFrameIndex)
    );
    setFrameAIndex(clamped);
  }, [initialFrameIndex, frames.length]);

  const frameA = frames[frameAIndex] || frames[0];
  const frameB = frames[frameAIndex + 1] || frames[1];
  const insertIndex = frameAIndex + 1;

  const handlePrevPair = () => {
    if (frameAIndex > 0) {
      setFrameAIndex(frameAIndex - 1);
    }
  };

  const handleNextPair = () => {
    if (frameAIndex < frames.length - 2) {
      setFrameAIndex(frameAIndex + 1);
    }
  };

  const handleGenerateAndInsert = async () => {
    if (!previewContainerRef.current) return;
    try {
      setIsGenerating(true);

      // Snapshot the composite smear frame to a temporary image file
      const tempUri = await captureRef(previewContainerRef, {
        format: 'jpg',
        quality: 0.95,
        result: 'tmpfile',
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
      onInsertSmearFrame(newFrame, insertIndex);
      onClose();
    } catch (e) {
      setIsGenerating(false);
      console.warn('Smear generation error:', e);
      Alert.alert('Error', 'Could not generate smear frame.');
    }
  };

  const steps =
    intensity === 0.3 ? [0.35, 0.65] : intensity === 0.6 ? [0.25, 0.5, 0.75] : [0.2, 0.38, 0.58, 0.78];

  // Compute Trail Transforms based on selected direction
  const getTrailTransform = (idx: number) => {
    const centerIdx = (steps.length - 1) / 2;
    const progress = idx - centerIdx; // e.g. -1, 0, 1 for 3 steps
    const stepOffset = progress * 6 * intensity;

    switch (direction) {
      case 'vertical':
        return [
          { scaleY: 1 + Math.abs(progress) * 0.02 * intensity },
          { translateY: stepOffset * 3 },
        ];
      case 'diagonal_up':
        return [
          { scale: 1 + Math.abs(progress) * 0.018 * intensity },
          { translateX: stepOffset * 2.5 },
          { translateY: -stepOffset * 2.5 },
        ];
      case 'diagonal_down':
        return [
          { scale: 1 + Math.abs(progress) * 0.018 * intensity },
          { translateX: stepOffset * 2.5 },
          { translateY: stepOffset * 2.5 },
        ];
      case 'horizontal':
      default:
        return [
          { scaleX: 1 + Math.abs(progress) * 0.02 * intensity },
          { translateX: stepOffset * 3 },
        ];
    }
  };

  // Compute Elastic Squash & Stretch Transforms based on selected direction
  const getElasticTransform = () => {
    const stretch = 1 + intensity * 0.18;
    const squash = 1 - intensity * 0.06;

    switch (direction) {
      case 'vertical':
        return [{ scaleY: stretch }, { scaleX: squash }];
      case 'diagonal_up':
        return [{ rotate: '-40deg' }, { scaleX: stretch }, { scaleY: squash }, { rotate: '40deg' }];
      case 'diagonal_down':
        return [{ rotate: '40deg' }, { scaleX: stretch }, { scaleY: squash }, { rotate: '-40deg' }];
      case 'horizontal':
      default:
        return [{ scaleX: stretch }, { scaleY: squash }];
    }
  };

  // Speed Lines Direction Offset & Streaks
  const getSpeedLinesFrameTransform = () => {
    const offset = 4 * intensity;
    switch (direction) {
      case 'vertical':
        return [{ translateY: offset }];
      case 'diagonal_up':
        return [{ translateX: offset * 0.8 }, { translateY: -offset * 0.8 }];
      case 'diagonal_down':
        return [{ translateX: offset * 0.8 }, { translateY: offset * 0.8 }];
      case 'horizontal':
      default:
        return [{ translateX: offset }];
    }
  };

  const getSpeedStreakStyle = () => {
    switch (direction) {
      case 'vertical':
        return styles.speedStreakVertical;
      case 'diagonal_up':
        return styles.speedStreakDiagonalUp;
      case 'diagonal_down':
        return styles.speedStreakDiagonalDown;
      case 'horizontal':
      default:
        return styles.speedStreakHorizontal;
    }
  };

  // Preview component (reusable in landscape / portrait)
  const renderPreview = (customMaxHeight?: number) => (
    <View style={styles.previewContainer}>
      <View
        ref={previewContainerRef}
        collapsable={false}
        style={[
          styles.compositeSurface,
          {
            aspectRatio: aspectRatio,
            width: aspectRatio >= 1 ? '100%' : 'auto',
            height: aspectRatio >= 1 ? 'auto' : '100%',
            maxHeight: customMaxHeight || 200,
          },
        ]}
      >
        {/* Base Background: Frame A */}
        {frameA && (
          <ExpoImage
            source={{ uri: frameA.proxyUri || frameA.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={0}
            cachePolicy="memory-disk"
            priority="high"
          />
        )}

        {/* Multi-Step Motion Trails / Smear Layer */}
        {frameB && style === 'trail' && (
          <>
            {steps.map((alpha, idx) => (
              <ExpoImage
                key={`step_${idx}`}
                source={{ uri: frameB.proxyUri || frameB.uri }}
                style={[
                  StyleSheet.absoluteFill,
                  {
                    opacity: alpha * 0.75,
                    transform: getTrailTransform(idx),
                  },
                ]}
                contentFit="contain"
                transition={0}
                cachePolicy="memory-disk"
                priority="high"
              />
            ))}
          </>
        )}

        {/* Speed Lines Mode */}
        {frameB && style === 'speed_lines' && (
          <>
            <ExpoImage
              source={{ uri: frameB.proxyUri || frameB.uri }}
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: 0.65,
                  transform: getSpeedLinesFrameTransform(),
                },
              ]}
              contentFit="contain"
              transition={0}
              cachePolicy="memory-disk"
              priority="high"
            />
            {/* Directional streak overlay */}
            <View
              style={[
                StyleSheet.absoluteFill,
                styles.speedStreakBase,
                getSpeedStreakStyle(),
                { opacity: intensity * 0.85 },
              ]}
            />
          </>
        )}

        {/* Elastic Squash & Stretch */}
        {frameB && style === 'elastic' && (
          <ExpoImage
            source={{ uri: frameB.proxyUri || frameB.uri }}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: 0.7,
                transform: getElasticTransform(),
              },
            ]}
            contentFit="contain"
            transition={0}
            cachePolicy="memory-disk"
            priority="high"
          />
        )}
      </View>
    </View>
  );

  // Pair Navigation component
  const renderPairNav = () => (
    <View style={styles.pairNavRow}>
      <Pressable
        style={[styles.navStepBtn, frameAIndex === 0 && styles.navStepBtnDisabled]}
        disabled={frameAIndex === 0}
        onPress={handlePrevPair}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="chevron-back" size={18} color={frameAIndex === 0 ? '#475569' : '#FFFFFF'} />
      </Pressable>

      <View style={styles.pairBadge}>
        <Text style={styles.pairBadgeLabel}>Smearing between</Text>
        <Text style={styles.pairBadgeHighlight}>
          Frame #{frameAIndex + 1} ➔ Frame #{frameAIndex + 2}
        </Text>
      </View>

      <Pressable
        style={[
          styles.navStepBtn,
          frameAIndex >= frames.length - 2 && styles.navStepBtnDisabled,
        ]}
        disabled={frameAIndex >= frames.length - 2}
        onPress={handleNextPair}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={frameAIndex >= frames.length - 2 ? '#475569' : '#FFFFFF'}
        />
      </Pressable>
    </View>
  );

  // Controls component (Style, Direction, Intensity, CTA)
  const renderControls = () => (
    <>
      {/* Smear Style Selector */}
      <Text style={styles.sectionLabel}>SMEAR STYLE</Text>
      <View style={styles.styleRow}>
        {[
          { id: 'trail', label: 'Action Trail', icon: 'layers' as const },
          { id: 'speed_lines', label: 'Speed Lines', icon: 'flash' as const },
          { id: 'elastic', label: 'Elastic', icon: 'resize' as const },
        ].map((st) => {
          const isSelected = style === st.id;
          return (
            <Pressable
              key={st.id}
              style={[styles.choiceBtn, isSelected && styles.choiceBtnActive]}
              onPress={() => setStyle(st.id as SmearStyle)}
            >
              <Ionicons
                name={st.icon}
                size={13}
                color={isSelected ? '#FFFFFF' : '#94A3B8'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[styles.choiceBtnText, isSelected && styles.choiceBtnTextActive]}
                numberOfLines={1}
              >
                {st.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Smear Direction Selector */}
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>SMEAR DIRECTION</Text>
      <View style={styles.styleRow}>
        {[
          { id: 'horizontal', label: 'Horizontal', icon: 'swap-horizontal' as const },
          { id: 'vertical', label: 'Vertical', icon: 'swap-vertical' as const },
          { id: 'diagonal_up', label: 'Diag ↗', icon: 'trending-up' as const },
          { id: 'diagonal_down', label: 'Diag ↘', icon: 'trending-down' as const },
        ].map((dir) => {
          const isSelected = direction === dir.id;
          return (
            <Pressable
              key={dir.id}
              style={[styles.choiceBtn, isSelected && styles.choiceBtnActive]}
              onPress={() => setDirection(dir.id as SmearDirection)}
            >
              <Ionicons
                name={dir.icon}
                size={13}
                color={isSelected ? '#FFFFFF' : '#94A3B8'}
                style={{ marginRight: 3 }}
              />
              <Text
                style={[styles.choiceBtnText, isSelected && styles.choiceBtnTextActive]}
                numberOfLines={1}
              >
                {dir.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Intensity Presets */}
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>SMEAR INTENSITY</Text>
      <View style={styles.intensityRow}>
        {[
          { label: 'Subtle', val: 0.3 },
          { label: 'Balanced', val: 0.6 },
          { label: 'Extreme', val: 0.9 },
        ].map((item) => {
          const isSelected = Math.abs(intensity - item.val) < 0.05;
          return (
            <Pressable
              key={item.val}
              style={[styles.choiceBtn, isSelected && styles.choiceBtnActive]}
              onPress={() => setIntensity(item.val)}
            >
              <Text
                style={[styles.choiceBtnText, isSelected && styles.choiceBtnTextActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Generate & Insert CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.insertCtaBtn,
          isGenerating && styles.insertCtaBtnDisabled,
          { transform: [{ scale: pressed && !isGenerating ? 0.96 : 1 }] },
        ]}
        disabled={isGenerating}
        onPress={handleGenerateAndInsert}
      >
        {isGenerating ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
        ) : (
          <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
        )}
        <Text style={styles.insertCtaBtnText}>
          {isGenerating
            ? 'Generating Smear...'
            : `Insert Smear Frame at Position #${insertIndex + 1}`}
        </Text>
      </Pressable>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalCardWrapper,
            isLandscape && {
              maxWidth: Math.min(windowWidth - 32, 740),
              maxHeight: Math.min(windowHeight - 20, 390),
            },
          ]}
        >
          <GlassSurface
            variant="elevated"
            borderRadius={22}
            contentStyle={[
              styles.modalCardContent,
              isLandscape && styles.modalCardContentLandscape,
            ]}
          >
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="flash" size={17} color="#FBBF24" />
                  <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>
                    Generate Smear Frame
                  </Text>
                </View>
                <Text style={[styles.modalSubtitle, { color: '#94A3B8' }]}>
                  Creates an in-between motion smear frame between two action frames
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  { transform: [{ scale: pressed ? 0.92 : 1 }] },
                ]}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Body: Split Columns in Landscape, Single Scrollable Column in Portrait */}
            {isLandscape ? (
              <View style={styles.landscapeBodyRow}>
                {/* Left Column: Pair Nav & Large Preview */}
                <View style={styles.landscapeLeftCol}>
                  {renderPairNav()}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    {renderPreview(180)}
                  </View>
                </View>

                {/* Right Column: Scrollable Controls & CTA */}
                <ScrollView
                  style={styles.landscapeRightCol}
                  contentContainerStyle={styles.landscapeRightScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {renderControls()}
                </ScrollView>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 4 }}
              >
                {renderPairNav()}
                {renderPreview(200)}
                {renderControls()}
              </ScrollView>
            )}
          </GlassSurface>
        </View>
      </View>
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
    maxWidth: 440,
    maxHeight: '92%',
  },
  modalCardContent: {
    padding: 16,
  },
  modalCardContentLandscape: {
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 10.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  landscapeBodyRow: {
    flexDirection: 'row',
    gap: 14,
    flex: 1,
  },
  landscapeLeftCol: {
    flex: 1.05,
    justifyContent: 'flex-start',
  },
  landscapeRightCol: {
    flex: 1.15,
  },
  landscapeRightScrollContent: {
    paddingBottom: 6,
  },
  pairNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  navStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  navStepBtnDisabled: {
    opacity: 0.35,
  },
  pairBadge: {
    alignItems: 'center',
  },
  pairBadgeLabel: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pairBadgeHighlight: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  previewContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 10,
    padding: 2,
  },
  compositeSurface: {
    position: 'relative',
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  speedStreakBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  speedStreakHorizontal: {
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  speedStreakVertical: {
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  speedStreakDiagonalUp: {
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    transform: [{ rotate: '-15deg' }, { scale: 1.15 }],
  },
  speedStreakDiagonalDown: {
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    transform: [{ rotate: '15deg' }, { scale: 1.15 }],
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#94A3B8',
    marginBottom: 5,
  },
  styleRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 5,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  choiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  choiceBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.65)',
    borderColor: '#818CF8',
  },
  choiceBtnText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '700',
  },
  choiceBtnTextActive: {
    color: '#FFFFFF',
  },
  insertCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    marginTop: 2,
  },
  insertCtaBtnDisabled: {
    opacity: 0.6,
  },
  insertCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});

