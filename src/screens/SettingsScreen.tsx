import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Platform,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAppSettings } from '../context/SettingsContext';
import { useCustomAlert } from '../context/CustomAlertContext';
import { useAppInsets } from '../utils/useAppInsets';
import {
  AspectRatioOption,
  CropMode,
  PreviewResolution,
  AspectFitMode,
} from '../types/settings';
import { GlassSurface, GlassButton } from '../components/ui';

interface SettingsScreenProps {
  onReplaySplash: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onReplaySplash }) => {
  const { theme, isDark, activeSchemeMode, setScheme } = useTheme();
  const { settings, updateSetting, resetSettings } = useAppSettings();
  const { showAlert, showConfirm } = useCustomAlert();
  const insets = useAppInsets();

  const themeOptions: Array<{
    mode: 'dark' | 'light' | 'system';
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { mode: 'dark', label: 'Dark', icon: 'moon' },
    { mode: 'light', label: 'Light', icon: 'sunny' },
    { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ];

  const aspectRatios: AspectRatioOption[] = ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21', '1:1'];

  const fpsPresets = [1, 6, 8, 12, 15, 24, 30, 60];

  const [customFpsModalVisible, setCustomFpsModalVisible] = React.useState(false);
  const [customFpsInput, setCustomFpsInput] = React.useState(String(settings.playbackFps));

  const handleSaveCustomFps = () => {
    const parsed = parseInt(customFpsInput, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 60) {
      showAlert({
        title: 'Invalid FPS',
        message: 'Please enter a valid frame rate between 1 and 60 FPS.',
        destructive: true,
      });
      return;
    }
    updateSetting('playbackFps', parsed);
    setCustomFpsModalVisible(false);
  };

  const handleReset = () => {
    showConfirm({
      title: 'Reset Settings',
      message: 'Are you sure you want to restore all settings to their original factory defaults?',
      confirmText: 'Reset to Defaults',
      cancelText: 'Cancel',
      isDestructive: true,
      icon: 'refresh-circle-outline',
      onConfirm: () => {
        resetSettings();
        showAlert({
          title: 'Settings Reset',
          message: 'All settings have been restored to defaults.',
        });
      },
    });
  };

  const getFpsDescription = (fps: number) => {
    if (fps <= 3) return 'Ultra Slow • Frame analysis / study';
    if (fps <= 8) return 'Chunky Claymation • Classic beginner style';
    if (fps === 12) return 'Standard Stop Motion • 2s on 24fps (Recommended)';
    if (fps === 24) return 'Cinematic Standard • Smooth professional animation';
    if (fps <= 30) return 'Video Standard • Fluid realism';
    return 'Ultra High FPS • Hyper-smooth motion';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 4),
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
          <Text style={[styles.headerSubtitle, { color: theme.primaryLight }]}>
            STUDIO CONFIGURATION & PREFERENCES
          </Text>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Appearance & Theme */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            APPEARANCE & THEME
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            <View style={styles.themeSelectorRow}>
              {themeOptions.map((opt) => {
                const isSelected = activeSchemeMode === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    style={({ pressed }) => [
                      styles.themeOptionBtn,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(99, 102, 241, 0.28)'
                            : 'rgba(79, 70, 229, 0.12)'
                          : theme.surfaceSubtle,
                        borderColor: isSelected ? theme.primaryLight : theme.border,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}
                    onPress={() => setScheme(opt.mode)}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={isSelected ? theme.primaryLight : theme.textMuted}
                    />
                    <Text
                      style={[
                        styles.themeOptionText,
                        {
                          color: isSelected ? (isDark ? '#FFFFFF' : theme.primary) : theme.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* 2. Playback Speed / FPS Setting */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            PLAYBACK SPEED & FPS (1 - 60 FPS)
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            {/* FPS Value Display & Stepper */}
            <View style={styles.fpsTopRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.fpsInfoCol,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                unstable_pressDelay={0}
                pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {
                  setCustomFpsInput(String(settings.playbackFps));
                  setCustomFpsModalVisible(true);
                }}
              >
                <View style={styles.fpsBadgeRow}>
                  <Text style={[styles.fpsNumber, { color: theme.primaryLight }]}>
                    {settings.playbackFps}
                  </Text>
                  <Text style={[styles.fpsUnit, { color: theme.text }]}>FPS</Text>
                  <View
                    style={[
                      styles.fpsEditBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(99, 102, 241, 0.2)'
                          : 'rgba(79, 70, 229, 0.1)',
                      },
                    ]}
                  >
                    <Ionicons name="pencil" size={12} color={theme.primaryLight} />
                  </View>
                </View>
                <Text style={[styles.fpsDesc, { color: theme.textMuted }]}>
                  {getFpsDescription(settings.playbackFps)} • Tap to edit
                </Text>
              </Pressable>

              {/* Stepper Buttons (+ and -) */}
              <View style={styles.stepperContainer}>
                <GlassButton
                  size="icon"
                  icon="remove"
                  iconSize={16}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                  onPress={() =>
                    updateSetting('playbackFps', Math.max(1, settings.playbackFps - 1))
                  }
                />

                <GlassButton
                  size="icon"
                  icon="add"
                  iconSize={16}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                  onPress={() =>
                    updateSetting('playbackFps', Math.min(60, settings.playbackFps + 1))
                  }
                />
              </View>
            </View>

            {/* Quick FPS Presets */}
            <Text style={[styles.subLabel, { color: theme.textSubtle, marginTop: 14 }]}>
              QUICK PRESETS
            </Text>
            <View style={styles.presetsGrid}>
              {fpsPresets.map((fps) => {
                const isSelected = settings.playbackFps === fps;
                return (
                  <GlassButton
                    key={fps}
                    size="sm"
                    color={isSelected ? 'primary' : 'default'}
                    label={`${fps}`}
                    onPress={() => updateSetting('playbackFps', fps)}
                    style={{ minWidth: 38 }}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {/* 3. Crop Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            IMAGE CROPPING MODE
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            {/* Option A: Crop to Aspect Ratio */}
            <Pressable
              style={({ pressed }) => [
                styles.selectableRow,
                settings.cropMode === 'aspect_ratio' && [
                  styles.selectedRowHighlight,
                  {
                    backgroundColor: isDark
                      ? 'rgba(99,102,241,0.12)'
                      : 'rgba(79,70,229,0.06)',
                  },
                ],
                { opacity: pressed ? 0.75 : 1 },
              ]}
              unstable_pressDelay={0}
              pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              onPress={() => updateSetting('cropMode', 'aspect_ratio')}
            >
              <View style={styles.optionInfo}>
                <View style={styles.optionTitleRow}>
                  <Ionicons
                    name="crop"
                    size={16}
                    color={
                      settings.cropMode === 'aspect_ratio'
                        ? theme.primaryLight
                        : theme.textMuted
                    }
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    Crop to Specific Aspect Ratio
                  </Text>
                </View>
                <Text style={[styles.optionSubtitle, { color: theme.textMuted }]}>
                  Conforms all imported and captured frames to the project aspect ratio.
                </Text>
              </View>
              <Ionicons
                name={
                  settings.cropMode === 'aspect_ratio'
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={20}
                color={
                  settings.cropMode === 'aspect_ratio'
                    ? theme.primary
                    : theme.textSubtle
                }
              />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Option B: Use Original Resolution */}
            <Pressable
              style={({ pressed }) => [
                styles.selectableRow,
                settings.cropMode === 'original_resolution' && [
                  styles.selectedRowHighlight,
                  {
                    backgroundColor: isDark
                      ? 'rgba(99,102,241,0.12)'
                      : 'rgba(79,70,229,0.06)',
                  },
                ],
                { opacity: pressed ? 0.75 : 1 },
              ]}
              unstable_pressDelay={0}
              pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              onPress={() => updateSetting('cropMode', 'original_resolution')}
            >
              <View style={styles.optionInfo}>
                <View style={styles.optionTitleRow}>
                  <Ionicons
                    name="expand"
                    size={16}
                    color={
                      settings.cropMode === 'original_resolution'
                        ? theme.primaryLight
                        : theme.textMuted
                    }
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    Keep Original Frame Ratio
                  </Text>
                </View>
                <Text style={[styles.optionSubtitle, { color: theme.textMuted }]}>
                  Preserves whatever dimension the source image was recorded in.
                </Text>
              </View>
              <Ionicons
                name={
                  settings.cropMode === 'original_resolution'
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={20}
                color={
                  settings.cropMode === 'original_resolution'
                    ? theme.primary
                    : theme.textSubtle
                }
              />
            </Pressable>
          </View>
        </View>

        {/* 4. Aspect Ratio & Fit vs Cover */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            DEFAULT ASPECT RATIO & FIT MODE
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            {/* Aspect Ratio Selector Chips */}
            <Text style={[styles.subLabel, { color: theme.textSubtle }]}>
              TARGET ASPECT RATIO
            </Text>
            <View style={styles.ratioGrid}>
              {aspectRatios.map((ratio) => {
                const isSelected = settings.defaultAspectRatio === ratio;
                return (
                  <GlassButton
                    key={ratio}
                    size="sm"
                    color={isSelected ? 'primary' : 'default'}
                    label={ratio}
                    onPress={() => updateSetting('defaultAspectRatio', ratio)}
                    style={{ minWidth: 54 }}
                  />
                );
              })}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Scaling Options: Cover vs Fit */}
            <Text style={[styles.subLabel, { color: theme.textSubtle }]}>
              FRAME SCALING BEHAVIOR
            </Text>
            <View style={styles.fitModeRow}>
              {/* Fit Option */}
              <Pressable
                style={({ pressed }) => [
                  styles.fitModeCard,
                  {
                    backgroundColor:
                      settings.aspectFitMode === 'fit'
                        ? isDark
                          ? 'rgba(99,102,241,0.18)'
                          : 'rgba(79,70,229,0.1)'
                        : theme.surfaceSubtle,
                    borderColor:
                      settings.aspectFitMode === 'fit'
                        ? theme.primary
                        : theme.border,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                ]}
                unstable_pressDelay={0}
                pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => updateSetting('aspectFitMode', 'fit')}
              >
                <Ionicons
                  name="contract-outline"
                  size={20}
                  color={
                    settings.aspectFitMode === 'fit'
                      ? theme.primaryLight
                      : theme.textMuted
                  }
                />
                <Text
                  style={[
                    styles.fitModeTitle,
                    {
                      color:
                        settings.aspectFitMode === 'fit'
                          ? theme.primaryLight
                          : theme.text,
                    },
                  ]}
                >
                  Fit In Frame
                </Text>
                <Text style={[styles.fitModeDesc, { color: theme.textMuted }]}>
                  Letterbox/pillarbox so image is never cropped.
                </Text>
              </Pressable>

              {/* Cover Option */}
              <Pressable
                style={({ pressed }) => [
                  styles.fitModeCard,
                  {
                    backgroundColor:
                      settings.aspectFitMode === 'cover'
                        ? isDark
                          ? 'rgba(99,102,241,0.18)'
                          : 'rgba(79,70,229,0.1)'
                        : theme.surfaceSubtle,
                    borderColor:
                      settings.aspectFitMode === 'cover'
                        ? theme.primary
                        : theme.border,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                ]}
                unstable_pressDelay={0}
                pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => updateSetting('aspectFitMode', 'cover')}
              >
                <Ionicons
                  name="expand-outline"
                  size={20}
                  color={
                    settings.aspectFitMode === 'cover'
                      ? theme.primaryLight
                      : theme.textMuted
                  }
                />
                <Text
                  style={[
                    styles.fitModeTitle,
                    {
                      color:
                        settings.aspectFitMode === 'cover'
                          ? theme.primaryLight
                          : theme.text,
                    },
                  ]}
                >
                  Cover Frame
                </Text>
                <Text style={[styles.fitModeDesc, { color: theme.textMuted }]}>
                  Fills entire ratio, trimming any outer edges.
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* 5. Preview Resolution Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            PLAYBACK PREVIEW RESOLUTION
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            {/* Full Res */}
            <Pressable
              style={({ pressed }) => [
                styles.selectableRow,
                settings.previewResolution === 'full' && [
                  styles.selectedRowHighlight,
                  {
                    backgroundColor: isDark
                      ? 'rgba(99,102,241,0.12)'
                      : 'rgba(79,70,229,0.06)',
                  },
                ],
                { opacity: pressed ? 0.75 : 1 },
              ]}
              unstable_pressDelay={0}
              pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              onPress={() => updateSetting('previewResolution', 'full')}
            >
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>
                  Full Resolution (Best Visual Quality)
                </Text>
                <Text style={[styles.optionSubtitle, { color: theme.textMuted }]}>
                  Renders uncompressed frames for pixel-perfect clarity.
                </Text>
              </View>
              <Ionicons
                name={
                  settings.previewResolution === 'full'
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={20}
                color={
                  settings.previewResolution === 'full'
                    ? theme.primary
                    : theme.textSubtle
                }
              />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Reduced Res */}
            <Pressable
              style={({ pressed }) => [
                styles.selectableRow,
                settings.previewResolution === 'reduced' && [
                  styles.selectedRowHighlight,
                  {
                    backgroundColor: isDark
                      ? 'rgba(99,102,241,0.12)'
                      : 'rgba(79,70,229,0.06)',
                  },
                ],
                { opacity: pressed ? 0.75 : 1 },
              ]}
              unstable_pressDelay={0}
              pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              onPress={() => updateSetting('previewResolution', 'reduced')}
            >
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>
                  Reduced Resolution (Performance & Battery Saver)
                </Text>
                <Text style={[styles.optionSubtitle, { color: theme.textMuted }]}>
                  Optimizes memory for silky smooth playback with 100+ frames.
                </Text>
              </View>
              <Ionicons
                name={
                  settings.previewResolution === 'reduced'
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={20}
                color={
                  settings.previewResolution === 'reduced'
                    ? theme.primary
                    : theme.textSubtle
                }
              />
            </Pressable>
          </View>
        </View>

        {/* 6. Proxy Quality Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            PLAYBACK PROXY QUALITY
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            {[
              { id: 'low', title: 'Low (480p)', desc: 'Best Performance. Uses least memory.' },
              { id: 'medium', title: 'Medium (720p)', desc: 'Balanced Performance and Quality.' },
              { id: 'high', title: 'High (1080p)', desc: 'High Quality. Uses more memory.' },
              { id: 'original', title: 'Original (No Proxy)', desc: 'Uncompressed. May cause lag.' },
            ].map((option, index, arr) => (
              <React.Fragment key={option.id}>
                <Pressable
                  style={({ pressed }) => [
                    styles.selectableRow,
                    settings.proxyQuality === option.id && [
                      styles.selectedRowHighlight,
                      {
                        backgroundColor: isDark
                          ? 'rgba(99,102,241,0.12)'
                          : 'rgba(79,70,229,0.06)',
                      },
                    ],
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                  unstable_pressDelay={0}
                  pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  onPress={() => updateSetting('proxyQuality', option.id as any)}
                >
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      {option.title}
                    </Text>
                    <Text style={[styles.optionSubtitle, { color: theme.textMuted }]}>
                      {option.desc}
                    </Text>
                  </View>
                  <Ionicons
                    name={
                      settings.proxyQuality === option.id
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={20}
                    color={
                      settings.proxyQuality === option.id
                        ? theme.primary
                        : theme.textSubtle
                    }
                  />
                </Pressable>
                {index < arr.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* 7. Liquid Glass UI & Visual Aesthetics */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            LIQUID GLASS & AESTHETICS
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            {/* Toggle Liquid Glass */}
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <View style={styles.optionTitleRow}>
                  <Ionicons
                    name="sparkles-outline"
                    size={20}
                    color={
                      settings.liquidGlassEnabled
                        ? theme.primaryLight
                        : theme.textMuted
                    }
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    Liquid Glass Effects
                  </Text>
                </View>
                <Text style={[styles.optionSubtitle, { color: theme.textMuted }]}>
                  Enables Apple Liquid Glass dynamic background refraction, fluid merging capsules, and frosted surfaces.
                </Text>
              </View>
              <Switch
                value={settings.liquidGlassEnabled}
                onValueChange={(val) => updateSetting('liquidGlassEnabled', val)}
                trackColor={{ false: theme.surfaceSubtle, true: theme.primary }}
                thumbColor={settings.liquidGlassEnabled ? '#FFFFFF' : theme.textSubtle}
              />
            </View>

            {settings.liquidGlassEnabled && (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={{ padding: 14 }}>
                  <Text style={[styles.optionTitle, { color: theme.text, marginBottom: 4 }]}>
                    Glass Transparency & Frosting
                  </Text>
                  <Text style={[styles.optionSubtitle, { color: theme.textMuted, marginBottom: 12 }]}>
                    Control the optical translucency of floating controls, studio HUDs, and tab bars.
                  </Text>

                  {/* Preset Buttons */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    {[
                      { label: 'Subtle', val: 0.35 },
                      { label: 'Balanced', val: 0.60 },
                      { label: 'Frosted', val: 0.75 },
                      { label: 'Crystal', val: 0.90 },
                    ].map((preset) => {
                      const isSelected = Math.abs(settings.liquidGlassTransparency - preset.val) < 0.05;
                      return (
                        <Pressable
                          key={preset.label}
                          style={({ pressed }) => [
                            {
                              flex: 1,
                              paddingVertical: 9,
                              paddingHorizontal: 4,
                              borderRadius: 12,
                              borderWidth: 1.5,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                              borderColor: isSelected ? theme.primaryLight : theme.border,
                              transform: [{ scale: pressed ? 0.94 : 1 }],
                            },
                          ]}
                          onPress={() => updateSetting('liquidGlassTransparency', preset.val)}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: isSelected ? '#FFFFFF' : theme.text,
                            }}
                          >
                            {preset.label}
                          </Text>
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: '600',
                              color: isSelected ? 'rgba(255,255,255,0.8)' : theme.textMuted,
                              marginTop: 1,
                            }}
                          >
                            {Math.round(preset.val * 100)}%
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Live Glass Preview Surface */}
                  <GlassSurface
                    variant="elevated"
                    borderRadius={14}
                    contentStyle={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#6366F1',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="water" size={20} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                        Live Glass Preview
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                        Transparency set to {Math.round(settings.liquidGlassTransparency * 100)}%
                      </Text>
                    </View>
                  </GlassSurface>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 8. Remote Shutter Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            REMOTE HARDWARE SHUTTER
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <View style={styles.optionTitleRow}>
                  <Ionicons
                    name="bluetooth-outline"
                    size={20}
                    color={
                      settings.remoteShutterEnabled
                        ? theme.primaryLight
                        : theme.textMuted
                    }
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    Bluetooth Remote Shutter
                  </Text>
                </View>
                <Text style={[styles.optionSubtitle, { color: theme.textMuted }]}>
                  Use wireless Bluetooth remotes or volume keys to trigger camera frames without touching the screen.
                </Text>
              </View>
              <Switch
                value={settings.remoteShutterEnabled}
                onValueChange={(val) => updateSetting('remoteShutterEnabled', val)}
                trackColor={{ false: theme.surfaceSubtle, true: theme.primary }}
                thumbColor={settings.remoteShutterEnabled ? '#FFFFFF' : theme.textSubtle}
              />
            </View>
          </View>
        </View>

        {/* 7. Splash Replay */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            BRANDING & SPLASH
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.actionRow,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              unstable_pressDelay={0}
              pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onReplaySplash}
            >
              <View style={styles.actionLeft}>
                <View
                  style={[
                    styles.actionIconBg,
                    {
                      backgroundColor: isDark
                        ? 'rgba(99,102,241,0.2)'
                        : 'rgba(79,70,229,0.1)',
                    },
                  ]}
                >
                  <Text style={[styles.cursiveK, { color: theme.primaryLight }]}>𝒦</Text>
                </View>
                <View>
                  <Text style={[styles.actionTitle, { color: theme.text }]}>
                    Replay Splash Animation
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: theme.textMuted }]}>
                    Preview cursive K brand entrance
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* 8. Reset to Factory Defaults */}
        <View style={styles.resetContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.resetBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(239, 68, 68, 0.08)',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.45)' : '#FCA5A5',
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
            onPress={handleReset}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={isDark ? '#FCA5A5' : '#DC2626'}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.resetBtnText,
                { color: isDark ? '#FCA5A5' : '#DC2626' },
              ]}
            >
              Reset Settings to Original Defaults
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerTitle, { color: theme.textSubtle }]}>
            Keddy Stop Motion Studio
          </Text>
          <Text style={[styles.footerText, { color: theme.textSubtle }]}>
            Version 1.0.0 • Precision Frame Capture
          </Text>
        </View>
      </ScrollView>

      {/* Custom FPS Input Modal */}
      <Modal
        visible={customFpsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomFpsModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCustomFpsModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCardWrapper}>
                <GlassSurface
                  variant="elevated"
                  borderRadius={24}
                  contentStyle={styles.modalCardContent}
                >
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={[styles.modalTitle, { color: theme.text }]}>
                        Custom Frame Rate
                      </Text>
                      <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                        Enter your preferred playback speed (1 - 60 FPS)
                      </Text>
                    </View>
                    <GlassButton
                      size="icon"
                      icon="close"
                      iconSize={18}
                      onPress={() => setCustomFpsModalVisible(false)}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[
                        styles.customFpsInput,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      value={customFpsInput}
                      onChangeText={setCustomFpsInput}
                      keyboardType="number-pad"
                      maxLength={2}
                      autoFocus
                      selectTextOnFocus
                      selectionColor={theme.primary}
                    />
                    <Text style={[styles.inputFpsUnit, { color: theme.primaryLight }]}>
                      FPS
                    </Text>
                  </View>

                  <View style={styles.modalActionsRow}>
                    <GlassButton
                      size="md"
                      label="Cancel"
                      onPress={() => setCustomFpsModalVisible(false)}
                      style={{ flex: 1 }}
                    />
                    <GlassButton
                      size="md"
                      color="primary"
                      label="Set FPS"
                      onPress={handleSaveCustomFps}
                      style={{ flex: 1 }}
                    />
                  </View>
                </GlassSurface>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerContent: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  themeOptionText: {
    fontSize: 13,
  },
  fpsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  fpsInfoCol: {
    flex: 1,
    paddingRight: 10,
  },
  fpsBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fpsEditBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    alignSelf: 'center',
  },
  fpsNumber: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  fpsUnit: {
    fontSize: 16,
    fontWeight: '700',
  },
  fpsDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    flex: 1,
    minWidth: 36,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: 12,
  },
  selectableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  selectedRowHighlight: {
    paddingHorizontal: 8,
  },
  optionInfo: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionSubtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  ratioRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  ratioChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratioChipText: {
    fontSize: 12,
  },
  fitModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fitModeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  fitModeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },
  fitModeDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchInfo: {
    flex: 1,
    paddingRight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cursiveK: {
    fontSize: 24,
    fontWeight: '300',
    fontStyle: 'italic',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  resetContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  resetBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  footerText: {
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  modalCardContent: {
    padding: 20,
  },
  modalHeader: {
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  customFpsInput: {
    width: 80,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  inputFpsUnit: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ratioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
});
