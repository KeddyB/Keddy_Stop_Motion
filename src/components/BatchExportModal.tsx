import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { RenderProgressUpdate } from '../services/videoExportService';
import { ExportConfig, ExportFormat, ExportQuality, ExportResolution } from '../types/export';

interface BatchExportModalProps {
  visible: boolean;
  progress: RenderProgressUpdate | null;
  isExporting: boolean;
  isComplete: boolean;
  totalSelected: number;
  successCount: number;
  defaultTitle?: string;
  onStartExport: (config: ExportConfig) => void;
  onClose: () => void;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  visible,
  progress,
  isExporting,
  isComplete,
  totalSelected,
  successCount,
  defaultTitle,
  onStartExport,
  onClose,
}) => {
  const { theme, isDark } = useTheme();

  const [customName, setCustomName] = useState(defaultTitle || '');
  const [format, setFormat] = useState<ExportFormat>('mp4_video');
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [resolution, setResolution] = useState<ExportResolution>('original');

  React.useEffect(() => {
    if (defaultTitle) {
      setCustomName(defaultTitle);
    }
  }, [defaultTitle]);

  React.useEffect(() => {
    // Load saved settings
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.getItem('@keddy_export_format').then(val => val && setFormat(val as ExportFormat));
      AsyncStorage.getItem('@keddy_export_quality').then(val => val && setQuality(val as ExportQuality));
      AsyncStorage.getItem('@keddy_export_resolution').then(val => val && setResolution(val as ExportResolution));
    });
  }, []);

  const saveSetting = async (key: string, value: string) => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(key, value);
  };

  const handleSetFormat = (f: ExportFormat) => { setFormat(f); saveSetting('@keddy_export_format', f); };
  const handleSetQuality = (q: ExportQuality) => { setQuality(q); saveSetting('@keddy_export_quality', q); };
  const handleSetResolution = (r: ExportResolution) => { setResolution(r); saveSetting('@keddy_export_resolution', r); };

  const formatOptions: Array<{ id: ExportFormat; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }> = [
    { id: 'jpeg_sequence', label: 'JPEG Sequence', icon: 'images-outline', desc: 'Standard photo gallery frame sequence' },
    { id: 'png_sequence', label: 'PNG Lossless', icon: 'sparkles-outline', desc: 'Crisp transparency & pixel-perfect quality' },
    { id: 'gif_animation', label: 'GIF Animation', icon: 'film-outline', desc: 'Looping animation for messaging and web' },
    { id: 'mp4_video', label: 'MP4 Video', icon: 'videocam-outline', desc: 'High-framerate video for social media' },
  ];

  const qualityOptions: Array<{ id: ExportQuality; label: string; badge: string }> = [
    { id: 'standard', label: 'Standard', badge: '75%' },
    { id: 'high', label: 'High Quality', badge: '90%' },
    { id: 'ultra', label: 'Ultra / Max', badge: '100%' },
  ];

  const resolutionOptions: Array<{ id: ExportResolution; label: string; desc: string }> = [
    { id: 'original', label: 'Original', desc: 'Native camera size' },
    { id: '1080p', label: '1080p FHD', desc: '1920 × 1080' },
    { id: '720p', label: '720p HD', desc: '1280 × 720' },
    { id: '480p', label: '480p SD', desc: '854 × 480' },
  ];

  const handleStart = () => {
    onStartExport({
      format,
      quality,
      resolution,
      customFileName: customName.trim() || undefined,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isExporting ? undefined : onClose}
    >
      <TouchableWithoutFeedback onPress={isExporting ? undefined : onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  shadowColor: theme.cardShadow,
                },
              ]}
            >
              {/* Header Icon */}
              <View style={styles.iconWrapper}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: isComplete
                        ? 'rgba(16, 185, 129, 0.15)'
                        : isExporting
                        ? 'rgba(99, 102, 241, 0.15)'
                        : 'rgba(99, 102, 241, 0.1)',
                      borderColor: isComplete ? '#10B981' : theme.primaryLight,
                    },
                  ]}
                >
                  {isComplete ? (
                    <Ionicons name="checkmark-done" size={32} color="#10B981" />
                  ) : isExporting ? (
                    <ActivityIndicator size="large" color={theme.primary} />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={30} color={theme.primary} />
                  )}
                </View>
              </View>

              {/* Title & Subtitle */}
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {isComplete
                  ? 'Batch Render Complete!'
                  : isExporting
                  ? 'Rendering Animations...'
                  : `Export ${totalSelected} Project${totalSelected > 1 ? 's' : ''}`}
              </Text>

              <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                {isComplete
                  ? `Successfully rendered and saved ${successCount} of ${totalSelected} projects to your Photos Gallery.`
                  : isExporting
                  ? progress
                    ? `${progress.stageMessage || 'Processing...'} (${progress.projectIndex}/${progress.totalProjects})`
                    : 'Preparing high-resolution renders...'
                  : 'Choose your preferred export format, quality, and resolution.'}
              </Text>

              {/* Configuration View (Before Export Starts) */}
              {!isExporting && !isComplete && (
                <ScrollView 
                  style={styles.configContainer} 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* File Name Section */}
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Save Animation As
                  </Text>
                  <View
                    style={[
                      styles.nameInputBox,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={theme.primary}
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={[styles.nameTextInput, { color: theme.text }]}
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder={defaultTitle || 'Enter animation name'}
                      placeholderTextColor={theme.textMuted}
                      autoCorrect={false}
                      autoCapitalize="words"
                    />
                    <View style={[styles.extBadge, { backgroundColor: theme.surfaceElevated }]}>
                      <Text style={[styles.extBadgeText, { color: theme.primaryLight }]}>
                        {format === 'mp4_video'
                          ? '.mp4'
                          : format === 'gif_animation'
                          ? '.gif'
                          : format === 'png_sequence'
                          ? '.png'
                          : '.jpg'}
                      </Text>
                    </View>
                  </View>

                  {/* Format Section */}
                  <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 14 }]}>Export Format</Text>
                  <View style={styles.formatGrid}>
                    {formatOptions.map((opt) => {
                      const isSelected = format === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          unstable_pressDelay={0}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          style={({ pressed }) => [
                            styles.formatChip,
                            {
                              backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                              borderColor: isSelected ? theme.primaryLight : theme.border,
                              transform: [{ scale: pressed ? 0.94 : 1 }],
                            },
                          ]}
                          onPress={() => handleSetFormat(opt.id)}
                        >
                          <Ionicons
                            name={opt.icon}
                            size={16}
                            color={isSelected ? '#FFFFFF' : theme.textSubtle}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.formatChipText,
                              { color: isSelected ? '#FFFFFF' : theme.text },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Quality Section */}
                  <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 14 }]}>
                    Render Quality
                  </Text>
                  <View style={styles.qualityRow}>
                    {qualityOptions.map((opt) => {
                      const isSelected = quality === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          unstable_pressDelay={0}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          style={({ pressed }) => [
                            styles.qualityChip,
                            {
                              backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                              borderColor: isSelected ? theme.primaryLight : theme.border,
                              transform: [{ scale: pressed ? 0.94 : 1 }],
                            },
                          ]}
                          onPress={() => handleSetQuality(opt.id)}
                        >
                          <Text
                            style={[
                              styles.qualityChipText,
                              { color: isSelected ? '#FFFFFF' : theme.text },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <View
                            style={[
                              styles.qualityBadge,
                              {
                                backgroundColor: isSelected
                                  ? 'rgba(255, 255, 255, 0.25)'
                                  : 'rgba(0, 0, 0, 0.3)',
                              },
                            ]}
                          >
                            <Text style={styles.qualityBadgeText}>{opt.badge}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Resolution Section */}
                  <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 14 }]}>
                    Resolution
                  </Text>
                  <View style={styles.resolutionRow}>
                    {resolutionOptions.map((opt) => {
                      const isSelected = resolution === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          unstable_pressDelay={0}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          style={({ pressed }) => [
                            styles.resolutionChip,
                            {
                              backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                              borderColor: isSelected ? theme.primaryLight : theme.border,
                              transform: [{ scale: pressed ? 0.94 : 1 }],
                            },
                          ]}
                          onPress={() => handleSetResolution(opt.id)}
                        >
                          <Text
                            style={[
                              styles.resolutionChipText,
                              { color: isSelected ? '#FFFFFF' : theme.text },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text
                            style={[
                              styles.resolutionDesc,
                              { color: isSelected ? 'rgba(255,255,255,0.8)' : theme.textMuted },
                            ]}
                          >
                            {opt.desc}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {/* Progress Bar (During Export) */}
              {isExporting && progress && (
                <View style={styles.progressSection}>
                  <View style={styles.progressTextRow}>
                    <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
                      {progress.projectTitle}
                    </Text>
                    <Text style={[styles.progressPercent, { color: theme.primaryLight }]}>
                      {progress.percent}%
                    </Text>
                  </View>

                  <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceSubtle }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progress.percent}%`,
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                {!isExporting && !isComplete && (
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.cancelBtn,
                        { borderColor: theme.border, transform: [{ scale: pressed ? 0.96 : 1 }] },
                      ]}
                      unstable_pressDelay={0}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={onClose}
                    >
                      <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        { backgroundColor: theme.primary, transform: [{ scale: pressed ? 0.96 : 1 }] },
                      ]}
                      unstable_pressDelay={0}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={handleStart}
                    >
                      <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryBtnText}>Start Render</Text>
                    </Pressable>
                  </>
                )}

                {isComplete && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { backgroundColor: theme.primary, width: '100%', transform: [{ scale: pressed ? 0.96 : 1 }] },
                    ]}
                    unstable_pressDelay={0}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={onClose}
                  >
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryBtnText}>Done</Text>
                  </Pressable>
                )}
              </View>
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
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrapper: {
    marginBottom: 12,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  configContainer: {
    width: '100%',
    maxHeight: 280,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
  },
  nameTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  extBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 6,
  },
  extBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  formatChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  qualityChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  qualityBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qualityBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  resolutionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resolutionChip: {
    width: '48%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  resolutionChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resolutionDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  progressSection: {
    width: '100%',
    marginVertical: 14,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
