import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAppSettings } from '../context/SettingsContext';
import { AspectRatioOption, OrientationMode } from '../types/settings';
import { GlassSurface, GlassButton } from './ui';

interface NewProjectModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    orientation: OrientationMode;
    aspectRatio: AspectRatioOption;
    fps: number;
    sharedImageUris?: string[];
  }) => void;
  nextIndex: number;
  sharedImageUris?: string[];
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  visible,
  onClose,
  onCreate,
  nextIndex,
  sharedImageUris,
}) => {
  const { theme, isDark } = useTheme();
  const { settings } = useAppSettings();

  // Initialize with in-app default settings
  const defaultIsPortrait = settings.defaultAspectRatio === '9:16';
  const [title, setTitle] = useState(`Animation #${nextIndex}`);
  const [orientation, setOrientation] = useState<OrientationMode>(
    defaultIsPortrait ? 'portrait' : 'landscape'
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>(
    settings.defaultAspectRatio || '16:9'
  );
  const [projectFps, setProjectFps] = useState<number>(settings.playbackFps || 12);

  // Sync with global settings when modal opens
  useEffect(() => {
    if (visible) {
      const isPort = settings.defaultAspectRatio === '9:16';
      setOrientation(isPort ? 'portrait' : 'landscape');
      setAspectRatio(settings.defaultAspectRatio || '16:9');
      setProjectFps(settings.playbackFps || 12);
      setTitle(`Animation #${nextIndex}`);
    }
  }, [visible, settings, nextIndex]);

  const handleSelectOrientation = (mode: OrientationMode) => {
    setOrientation(mode);
    if (mode === 'landscape') {
      setAspectRatio(settings.defaultAspectRatio !== '9:16' ? settings.defaultAspectRatio : '16:9');
    } else {
      setAspectRatio('9:16');
    }
  };

  const handleCreate = () => {
    onCreate({
      title: title.trim() || `Animation #${nextIndex}`,
      orientation,
      aspectRatio,
      fps: projectFps,
      sharedImageUris,
    });
    onClose();
  };

  const landscapeRatios: AspectRatioOption[] = ['16:9', '4:3', '21:9', '1:1'];
  const portraitRatios: AspectRatioOption[] = ['9:16', '4:3', '1:1'];
  const availableRatios = orientation === 'landscape' ? landscapeRatios : portraitRatios;

  const fpsOptions = [6, 8, 12, 15, 24, 30];

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
                      New Animation Project
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                      Configured with your in-app default settings
                    </Text>
                  </View>
                  <GlassButton
                    size="icon"
                    icon="close"
                    iconSize={18}
                    onPress={onClose}
                  />
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* Shared Images Banner if coming from Native Photos app */}
                  {sharedImageUris && sharedImageUris.length > 0 && (
                    <View style={styles.sharedBanner}>
                      <Ionicons name="images" size={18} color="#10B981" style={{ marginRight: 8 }} />
                      <Text style={styles.sharedBannerText}>
                        Importing {sharedImageUris.length} photos shared from your Gallery
                      </Text>
                    </View>
                  )}

                  {/* Project Title Input */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textMuted }]}>
                      PROJECT NAME
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      value={title}
                      onChangeText={setTitle}
                      placeholder={`Animation #${nextIndex}`}
                      placeholderTextColor={theme.textSubtle}
                      selectionColor={theme.primary}
                    />
                  </View>

                  {/* Orientation Selection Cards */}
                  <Text style={[styles.label, { color: theme.textMuted, marginTop: 14 }]}>
                    ORIENTATION
                  </Text>
                  <View style={styles.orientationRow}>
                    {/* Landscape / Horizontal Option */}
                    <Pressable
                      unstable_pressDelay={0}
                      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={({ pressed }) => [
                        styles.orientationCard,
                        {
                          backgroundColor:
                            orientation === 'landscape'
                              ? isDark
                                ? 'rgba(99, 102, 241, 0.18)'
                                : 'rgba(79, 70, 229, 0.1)'
                              : theme.surfaceSubtle,
                          borderColor:
                            orientation === 'landscape'
                              ? theme.primary
                              : theme.border,
                          opacity: pressed ? 0.75 : 1,
                          transform: [{ scale: pressed ? 0.96 : 1 }],
                        },
                      ]}
                      onPress={() => handleSelectOrientation('landscape')}
                    >
                      <View
                        style={[
                          styles.iconCircle,
                          {
                            backgroundColor:
                              orientation === 'landscape'
                                ? theme.primary
                                : theme.surfaceElevated,
                          },
                        ]}
                      >
                        <Ionicons
                          name="phone-landscape-outline"
                          size={22}
                          color={orientation === 'landscape' ? '#FFFFFF' : theme.textMuted}
                        />
                      </View>
                      <Text
                        style={[
                          styles.orientationTitle,
                          {
                            color:
                              orientation === 'landscape'
                                ? theme.primaryLight
                                : theme.text,
                          },
                        ]}
                      >
                        Horizontal
                      </Text>
                      <Text style={[styles.orientationDesc, { color: theme.textMuted }]}>
                        Landscape • 16:9 Cinema & Widescreen
                      </Text>
                    </Pressable>

                    {/* Portrait / Vertical Option */}
                    <Pressable
                      unstable_pressDelay={0}
                      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={({ pressed }) => [
                        styles.orientationCard,
                        {
                          backgroundColor:
                            orientation === 'portrait'
                              ? isDark
                                ? 'rgba(99, 102, 241, 0.18)'
                                : 'rgba(79, 70, 229, 0.1)'
                              : theme.surfaceSubtle,
                          borderColor:
                            orientation === 'portrait'
                              ? theme.primary
                              : theme.border,
                          opacity: pressed ? 0.75 : 1,
                          transform: [{ scale: pressed ? 0.96 : 1 }],
                        },
                      ]}
                      onPress={() => handleSelectOrientation('portrait')}
                    >
                      <View
                        style={[
                          styles.iconCircle,
                          {
                            backgroundColor:
                              orientation === 'portrait'
                                ? theme.primary
                                : theme.surfaceElevated,
                          },
                        ]}
                      >
                        <Ionicons
                          name="phone-portrait-outline"
                          size={22}
                          color={orientation === 'portrait' ? '#FFFFFF' : theme.textMuted}
                        />
                      </View>
                      <Text
                        style={[
                          styles.orientationTitle,
                          {
                            color:
                              orientation === 'portrait'
                                ? theme.primaryLight
                                : theme.text,
                          },
                        ]}
                      >
                        Vertical
                      </Text>
                      <Text style={[styles.orientationDesc, { color: theme.textMuted }]}>
                        Portrait • 9:16 Shorts & Reels
                      </Text>
                    </Pressable>
                  </View>

                  {/* Aspect Ratio Picker Chips */}
                  <Text style={[styles.label, { color: theme.textMuted, marginTop: 14 }]}>
                    ASPECT RATIO
                  </Text>
                  <View style={styles.ratioRow}>
                    {availableRatios.map((ratio) => {
                      const isSelected = aspectRatio === ratio;
                      return (
                        <Pressable
                          key={ratio}
                          unstable_pressDelay={0}
                          pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          style={({ pressed }) => [
                            styles.ratioChip,
                            {
                              backgroundColor: isSelected
                                ? theme.primary
                                : theme.surfaceSubtle,
                              borderColor: isSelected
                                ? theme.primaryLight
                                : theme.border,
                              opacity: pressed ? 0.75 : 1,
                              transform: [{ scale: pressed ? 0.96 : 1 }],
                            },
                          ]}
                          onPress={() => setAspectRatio(ratio)}
                        >
                          <Text
                            style={[
                              styles.ratioChipText,
                              {
                                color: isSelected ? '#FFFFFF' : theme.text,
                                fontWeight: isSelected ? '800' : '600',
                              },
                            ]}
                          >
                            {ratio}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* FPS Selection - Responsive 3-Column Multi-line Grid */}
                  <View style={styles.fpsSectionHeader}>
                    <Text style={[styles.label, { color: theme.textMuted, marginTop: 0 }]}>
                      FRAME RATE (FPS)
                    </Text>
                    <Text style={[styles.selectedFpsBadge, { color: theme.primaryLight }]}>
                      {projectFps} FPS
                    </Text>
                  </View>

                  <View style={styles.fpsGrid}>
                    {fpsOptions.map((f) => {
                      const isSelected = projectFps === f;
                      return (
                        <Pressable
                          key={f}
                          unstable_pressDelay={0}
                          pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          style={({ pressed }) => [
                            styles.fpsChip,
                            {
                              backgroundColor: isSelected
                                ? theme.primary
                                : theme.surfaceSubtle,
                              borderColor: isSelected
                                ? theme.primaryLight
                                : theme.border,
                              opacity: pressed ? 0.75 : 1,
                              transform: [{ scale: pressed ? 0.96 : 1 }],
                            },
                          ]}
                          onPress={() => setProjectFps(f)}
                        >
                          <Text
                            style={[
                              styles.fpsChipNumber,
                              { color: isSelected ? '#FFFFFF' : theme.text },
                            ]}
                          >
                            {f}
                          </Text>
                          <Text
                            style={[
                              styles.fpsChipUnit,
                              {
                                color: isSelected
                                  ? 'rgba(255, 255, 255, 0.85)'
                                  : theme.textMuted,
                              },
                            ]}
                          >
                            FPS
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.fpsDescriptionText, { color: theme.textMuted }]}>
                    {projectFps === 12
                      ? '12 FPS • Standard Stop Motion (Recommended)'
                      : projectFps <= 8
                      ? `${projectFps} FPS • Chunky Claymation style`
                      : projectFps === 24
                      ? '24 FPS • Cinematic Standard motion'
                      : `${projectFps} FPS • Smooth high-speed animation`}
                  </Text>

                  {/* Create Action CTA Button */}
                  <GlassButton
                    size="lg"
                    color="primary"
                    icon="sparkles"
                    label={
                      sharedImageUris && sharedImageUris.length > 0
                        ? 'Create Project with Shared Photos'
                        : 'Start Animation Studio'
                    }
                    onPress={handleCreate}
                    style={{ marginTop: 14, marginBottom: 8 }}
                  />
                </ScrollView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
  },
  modalCardContent: {
    padding: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  sharedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 14,
  },
  sharedBannerText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  orientationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  orientationCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  orientationTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  orientationDesc: {
    fontSize: 9.5,
    textAlign: 'center',
    lineHeight: 13,
  },
  ratioRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  ratioChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratioChipText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  fpsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  selectedFpsBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  fpsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  fpsChip: {
    flexBasis: '31%',
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  fpsChipNumber: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  fpsChipUnit: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  fpsDescriptionText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  createBtn: {
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginTop: 6,
    marginBottom: 10,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
