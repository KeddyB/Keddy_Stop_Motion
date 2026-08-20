import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface, GlassButton } from './ui';

export interface ChromaKeyConfig {
  enabled: boolean;
  keyColor: 'green' | 'blue' | 'custom';
  customHex?: string;
  similarity: number; // 0.1 to 0.6
  smoothness: number; // 0.05 to 0.3
  backdropType: 'preset' | 'custom';
  presetId?: string;
  backdropUri?: string;
}

interface ChromaKeyModalProps {
  visible: boolean;
  onClose: () => void;
  config: ChromaKeyConfig;
  onChangeConfig: (newConfig: ChromaKeyConfig) => void;
}

const PRESET_BACKDROPS = [
  {
    id: 'space',
    title: 'Deep Space',
    uri: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'forest',
    title: 'Mystic Forest',
    uri: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'city',
    title: 'Cyber Skyline',
    uri: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'sunset',
    title: 'Golden Sunset',
    uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
  },
];

export const ChromaKeyModal: React.FC<ChromaKeyModalProps> = ({
  visible,
  onClose,
  config,
  onChangeConfig,
}) => {
  const { theme } = useTheme();

  const handlePickCustomBackdrop = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const pickedAsset = result.assets[0];
      onChangeConfig({
        ...config,
        enabled: true,
        backdropType: 'custom',
        backdropUri: pickedAsset.uri,
      });
    } catch (e) {
      console.warn('Pick backdrop error:', e);
      Alert.alert('Error', 'Failed to select backdrop image.');
    }
  };

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
                    <Ionicons name="color-wand" size={20} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                      Chroma Key Studio
                    </Text>
                  </View>
                  <GlassButton
                    size="icon"
                    icon="close"
                    iconSize={18}
                    onPress={onClose}
                  />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Enable Switch */}
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                      GREEN / BLUE SCREEN REMOVAL
                    </Text>
                    <Switch
                      value={config.enabled}
                      onValueChange={(val) =>
                        onChangeConfig({ ...config, enabled: val })
                      }
                      trackColor={{ false: theme.surfaceSubtle, true: '#10B981' }}
                      thumbColor={config.enabled ? '#FFFFFF' : theme.textSubtle}
                    />
                  </View>

                  {config.enabled && (
                    <View style={styles.configContainer}>
                      {/* 1. Key Color Selection */}
                      <Text style={[styles.inputLabel, { color: theme.text }]}>
                        Screen Color to Remove
                      </Text>
                      <View style={styles.colorPillsRow}>
                        <Pressable
                          style={[
                            styles.colorPill,
                            config.keyColor === 'green' && styles.colorPillGreenActive,
                          ]}
                          onPress={() => onChangeConfig({ ...config, keyColor: 'green' })}
                        >
                          <View style={[styles.colorDot, { backgroundColor: '#10B981' }]} />
                          <Text style={[styles.colorPillText, config.keyColor === 'green' && styles.colorPillTextActive]}>
                            Green Screen
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.colorPill,
                            config.keyColor === 'blue' && styles.colorPillBlueActive,
                          ]}
                          onPress={() => onChangeConfig({ ...config, keyColor: 'blue' })}
                        >
                          <View style={[styles.colorDot, { backgroundColor: '#3B82F6' }]} />
                          <Text style={[styles.colorPillText, config.keyColor === 'blue' && styles.colorPillTextActive]}>
                            Blue Screen
                          </Text>
                        </Pressable>
                      </View>

                      {/* 2. Tolerance / Similarity Stepper */}
                      <View style={styles.sliderSection}>
                        <View style={styles.sliderLabelRow}>
                          <Text style={[styles.inputLabel, { color: theme.text }]}>
                            Removal Sensitivity (Tolerance)
                          </Text>
                          <Text style={[styles.valueBadgeText, { color: '#10B981' }]}>
                            {Math.round(config.similarity * 100)}%
                          </Text>
                        </View>
                        <View style={styles.stepButtonsRow}>
                          {[0.15, 0.25, 0.35, 0.45].map((val) => (
                            <Pressable
                              key={val}
                              style={[
                                styles.stepChip,
                                config.similarity === val && styles.stepChipActive,
                              ]}
                              onPress={() => onChangeConfig({ ...config, similarity: val })}
                            >
                              <Text
                                style={[
                                  styles.stepChipText,
                                  config.similarity === val && styles.stepChipTextActive,
                                ]}
                              >
                                {val === 0.15 ? 'Low' : val === 0.25 ? 'Medium' : val === 0.35 ? 'High' : 'Ultra'}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      {/* 3. Backdrop Replacement Selection */}
                      <Text style={[styles.inputLabel, { color: theme.text, marginTop: 12 }]}>
                        Replacement Backdrop
                      </Text>

                      {/* Presets Grid */}
                      <View style={styles.presetsGrid}>
                        {PRESET_BACKDROPS.map((preset) => {
                          const isSelected =
                            config.backdropType === 'preset' && config.presetId === preset.id;
                          return (
                            <Pressable
                              key={preset.id}
                              style={[
                                styles.presetCard,
                                isSelected && styles.presetCardActive,
                              ]}
                              onPress={() =>
                                onChangeConfig({
                                  ...config,
                                  backdropType: 'preset',
                                  presetId: preset.id,
                                  backdropUri: preset.uri,
                                })
                              }
                            >
                              <ExpoImage
                                source={{ uri: preset.uri }}
                                style={styles.presetImage}
                                contentFit="cover"
                                transition={0}
                              />
                              <View style={styles.presetLabelPill}>
                                <Text style={styles.presetLabelText}>{preset.title}</Text>
                              </View>
                              {isSelected && (
                                <View style={styles.presetCheckmark}>
                                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Custom Photo Button */}
                      <Pressable
                        style={({ pressed }) => [
                          styles.customPhotoBtn,
                          config.backdropType === 'custom' && styles.customPhotoBtnActive,
                          { opacity: pressed ? 0.8 : 1 },
                        ]}
                        onPress={handlePickCustomBackdrop}
                      >
                        <Ionicons
                          name="image-outline"
                          size={18}
                          color={config.backdropType === 'custom' ? '#10B981' : '#FFFFFF'}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.customPhotoBtnText,
                            config.backdropType === 'custom' && { color: '#10B981' },
                          ]}
                        >
                          {config.backdropType === 'custom'
                            ? 'Custom Image Selected (Tap to Change)'
                            : 'Pick Custom Image from Gallery'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </ScrollView>

                {/* Bottom Done Button */}
                <View style={styles.modalFooter}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.doneBtn,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                    onPress={onClose}
                  >
                    <Text style={styles.doneBtnText}>Apply Settings</Text>
                  </Pressable>
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
    maxWidth: 480,
    maxHeight: '90%',
  },
  modalCardContent: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  configContainer: {
    marginTop: 8,
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  colorPillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
  },
  colorPillGreenActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  colorPillBlueActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  colorPillText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
  },
  colorPillTextActive: {
    color: '#FFFFFF',
  },
  sliderSection: {
    marginTop: 10,
    gap: 6,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  stepChipActive: {
    backgroundColor: '#10B981',
    borderColor: '#6EE7B7',
  },
  stepChipText: {
    color: '#D1D5DB',
    fontSize: 11.5,
    fontWeight: '700',
  },
  stepChipTextActive: {
    color: '#FFFFFF',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetCard: {
    width: '48%',
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  presetCardActive: {
    borderColor: '#10B981',
  },
  presetImage: {
    width: '100%',
    height: '100%',
  },
  presetLabelPill: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  presetLabelText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  presetCheckmark: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  customPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginTop: 6,
  },
  customPhotoBtnActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  customPhotoBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  modalFooter: {
    marginTop: 14,
  },
  doneBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
