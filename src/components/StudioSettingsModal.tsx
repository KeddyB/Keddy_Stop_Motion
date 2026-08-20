import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TouchableWithoutFeedback,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { PreviewResolution } from '../types/settings';
import { GlassSurface, GlassButton } from './ui';

export interface OnionSkinConfig {
  enabled: boolean;
  mode?: 'ghost' | 'blink' | 'difference';
  blinkSpeedHz?: number; // 2, 4, 6
  prevOpacity: number; // 0 to 1
  nextOpacity: number; // 0 to 1
  showNext: boolean; // show forward frames if available
  depth: 1 | 2 | 3; // how many frames back/forward
  colorTint: boolean; // colored ghosting: red for previous, green for next
}

interface StudioSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  fps: number;
  onChangeFps: (fps: number) => void;
  previewResolution: PreviewResolution;
  onChangeResolution: (res: PreviewResolution) => void;
  onionConfig: OnionSkinConfig;
  onChangeOnionConfig: (config: OnionSkinConfig) => void;
}

const FPS_PRESETS = [1, 6, 8, 12, 15, 24, 30, 60];

export const StudioSettingsModal: React.FC<StudioSettingsModalProps> = ({
  visible,
  onClose,
  fps,
  onChangeFps,
  previewResolution,
  onChangeResolution,
  onionConfig,
  onChangeOnionConfig,
}) => {
  const { theme, isDark } = useTheme();
  const currentMode = onionConfig.mode || 'ghost';

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
                      Studio Controls
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                      Frame rate, onion skinning & playback
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
                  {/* 1. Bidirectional Onion Skinning Section */}
                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                        ONION SKINNING (GHOSTING)
                      </Text>
                      <Switch
                        value={onionConfig.enabled}
                        onValueChange={(val) =>
                          onChangeOnionConfig({ ...onionConfig, enabled: val })
                        }
                        trackColor={{ false: theme.surfaceSubtle, true: theme.primary }}
                        thumbColor={onionConfig.enabled ? '#FFFFFF' : theme.textSubtle}
                      />
                    </View>

                    {onionConfig.enabled && (
                      <View style={[styles.cardBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                        {/* Onion Mode Selector */}
                        <View style={styles.controlRow}>
                          <Text style={[styles.controlLabel, { color: theme.text }]}>
                            Ghosting Style
                          </Text>
                          <View style={styles.opacityPillsRow}>
                            {[
                              { label: 'Ghost', val: 'ghost' },
                              { label: 'Blink', val: 'blink' },
                              { label: 'Diff', val: 'difference' },
                            ].map((m) => (
                              <Pressable
                                key={m.val}
                                style={[
                                  styles.opacityPill,
                                  currentMode === m.val && {
                                    backgroundColor: theme.primary,
                                    borderColor: theme.primaryLight,
                                  },
                                ]}
                                onPress={() =>
                                  onChangeOnionConfig({ ...onionConfig, mode: m.val as any })
                                }
                              >
                                <Text
                                  style={[
                                    styles.opacityPillText,
                                    { color: currentMode === m.val ? '#FFFFFF' : theme.textMuted },
                                  ]}
                                >
                                  {m.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>

                        {/* Blink Speed Selector when in Blink Mode */}
                        {currentMode === 'blink' && (
                          <>
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            <View style={styles.controlRow}>
                              <Text style={[styles.controlLabel, { color: theme.text }]}>
                                Blink Frequency
                              </Text>
                              <View style={styles.opacityPillsRow}>
                                {[
                                  { label: '2 Hz', val: 2 },
                                  { label: '4 Hz', val: 4 },
                                  { label: '6 Hz', val: 6 },
                                ].map((sp) => (
                                  <Pressable
                                    key={sp.val}
                                    style={[
                                      styles.opacityPill,
                                      (onionConfig.blinkSpeedHz || 4) === sp.val && {
                                        backgroundColor: '#10B981',
                                        borderColor: '#6EE7B7',
                                      },
                                    ]}
                                    onPress={() =>
                                      onChangeOnionConfig({ ...onionConfig, blinkSpeedHz: sp.val })
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.opacityPillText,
                                        {
                                          color:
                                            (onionConfig.blinkSpeedHz || 4) === sp.val
                                              ? '#FFFFFF'
                                              : theme.textMuted,
                                        },
                                      ]}
                                    >
                                      {sp.label}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          </>
                        )}

                        {/* Previous Frame Opacity */}
                        {currentMode !== 'blink' && (
                          <>
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            <View style={styles.controlRow}>
                              <View style={styles.controlLeft}>
                                <View style={[styles.tintIndicator, { backgroundColor: onionConfig.colorTint ? '#EF4444' : '#6366F1' }]} />
                                <Text style={[styles.controlLabel, { color: theme.text }]}>
                                  Previous Frame Opacity
                                </Text>
                              </View>
                              <View style={styles.opacityPillsRow}>
                                {[0.25, 0.5, 0.75].map((op) => (
                                  <Pressable
                                    key={op}
                                    unstable_pressDelay={0}
                                    pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    style={({ pressed }) => [
                                      styles.opacityPill,
                                      onionConfig.prevOpacity === op && {
                                        backgroundColor: theme.primary,
                                        borderColor: theme.primaryLight,
                                      },
                                      { opacity: pressed ? 0.75 : 1 },
                                    ]}
                                    onPress={() =>
                                      onChangeOnionConfig({ ...onionConfig, prevOpacity: op })
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.opacityPillText,
                                        { color: onionConfig.prevOpacity === op ? '#FFFFFF' : theme.textMuted },
                                      ]}
                                    >
                                      {Math.round(op * 100)}%
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          </>
                        )}

                        {/* Next Frame (Forward Ghosting) Toggle & Opacity */}
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <View style={styles.controlRow}>
                          <View style={styles.controlLeft}>
                            <View style={[styles.tintIndicator, { backgroundColor: onionConfig.colorTint ? '#10B981' : '#A855F7' }]} />
                            <View>
                              <Text style={[styles.controlLabel, { color: theme.text }]}>
                                Show Next Frame (Ahead)
                              </Text>
                              <Text style={[styles.controlSublabel, { color: theme.textMuted }]}>
                                View upcoming frames when editing in between
                              </Text>
                            </View>
                          </View>
                          <Switch
                            value={onionConfig.showNext}
                            onValueChange={(val) =>
                              onChangeOnionConfig({ ...onionConfig, showNext: val })
                            }
                            trackColor={{ false: theme.surfaceElevated, true: theme.primary }}
                            thumbColor={onionConfig.showNext ? '#FFFFFF' : theme.textSubtle}
                          />
                        </View>

                        {onionConfig.showNext && (
                          <View style={styles.controlRow}>
                            <Text style={[styles.controlSublabel, { color: theme.textMuted }]}>
                              Next Frame Opacity
                            </Text>
                            <View style={styles.opacityPillsRow}>
                              {[0.25, 0.5, 0.75].map((op) => (
                                <Pressable
                                  key={op}
                                  unstable_pressDelay={0}
                                  pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  style={({ pressed }) => [
                                    styles.opacityPill,
                                    onionConfig.nextOpacity === op && {
                                      backgroundColor: theme.primary,
                                      borderColor: theme.primaryLight,
                                    },
                                    { opacity: pressed ? 0.75 : 1 },
                                  ]}
                                  onPress={() =>
                                    onChangeOnionConfig({ ...onionConfig, nextOpacity: op })
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.opacityPillText,
                                      { color: onionConfig.nextOpacity === op ? '#FFFFFF' : theme.textMuted },
                                    ]}
                                  >
                                    {Math.round(op * 100)}%
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        )}

                        {/* Color Tinting Toggle */}
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <View style={styles.controlRow}>
                          <View>
                            <Text style={[styles.controlLabel, { color: theme.text }]}>
                              Color Coded Ghosting
                            </Text>
                            <Text style={[styles.controlSublabel, { color: theme.textMuted }]}>
                              Red for previous frames • Green for upcoming
                            </Text>
                          </View>
                          <Switch
                            value={onionConfig.colorTint}
                            onValueChange={(val) =>
                              onChangeOnionConfig({ ...onionConfig, colorTint: val })
                            }
                            trackColor={{ false: theme.surfaceElevated, true: theme.primary }}
                            thumbColor={onionConfig.colorTint ? '#FFFFFF' : theme.textSubtle}
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  {/* 2. Framerate (FPS) Selector */}
                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                        PLAYBACK FRAME RATE ({fps} FPS)
                      </Text>
                      <View style={styles.fpsStepper}>
                        <Pressable
                          unstable_pressDelay={0}
                          pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          style={({ pressed }) => [
                            styles.miniStepBtn,
                            { backgroundColor: theme.surfaceSubtle, opacity: pressed ? 0.7 : 1 },
                          ]}
                          onPress={() => onChangeFps(Math.max(1, fps - 1))}
                        >
                          <Ionicons name="remove" size={16} color={theme.text} />
                        </Pressable>
                        <Text style={[styles.fpsValueText, { color: theme.primaryLight }]}>
                          {fps}
                        </Text>
                        <Pressable
                          unstable_pressDelay={0}
                          pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          style={({ pressed }) => [
                            styles.miniStepBtn,
                            { backgroundColor: theme.surfaceSubtle, opacity: pressed ? 0.7 : 1 },
                          ]}
                          onPress={() => onChangeFps(Math.min(60, fps + 1))}
                        >
                          <Ionicons name="add" size={16} color={theme.text} />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.presetsGrid}>
                      {FPS_PRESETS.map((f) => {
                        const isSelected = fps === f;
                        return (
                          <GlassButton
                            key={f}
                            size="sm"
                            color={isSelected ? 'primary' : 'default'}
                            label={`${f}`}
                            onPress={() => onChangeFps(f)}
                            style={{ minWidth: 38 }}
                          />
                        );
                      })}
                    </View>
                  </View>

                {/* 3. Playback Quality (High Res vs Low Res) */}
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                    VIEWPORT PLAYBACK RESOLUTION
                  </Text>
                  <View style={[styles.cardBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                    <Pressable
                      unstable_pressDelay={0}
                      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={({ pressed }) => [
                        styles.resOption,
                        previewResolution === 'full' && styles.selectedResOption,
                        { opacity: pressed ? 0.75 : 1 },
                      ]}
                      onPress={() => onChangeResolution('full')}
                    >
                      <Ionicons
                        name={previewResolution === 'full' ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={previewResolution === 'full' ? theme.primary : theme.textSubtle}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resTitle, { color: theme.text }]}>
                          High Resolution (Full Quality)
                        </Text>
                        <Text style={[styles.resDesc, { color: theme.textMuted }]}>
                          Uncompressed clarity during live sequence playback.
                        </Text>
                      </View>
                    </Pressable>

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <Pressable
                      unstable_pressDelay={0}
                      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={({ pressed }) => [
                        styles.resOption,
                        previewResolution === 'reduced' && styles.selectedResOption,
                        { opacity: pressed ? 0.75 : 1 },
                      ]}
                      onPress={() => onChangeResolution('reduced')}
                    >
                      <Ionicons
                        name={previewResolution === 'reduced' ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={previewResolution === 'reduced' ? theme.primary : theme.textSubtle}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resTitle, { color: theme.text }]}>
                          Low Resolution (Performance & Battery)
                        </Text>
                        <Text style={[styles.resDesc, { color: theme.textMuted }]}>
                          Smoother playback with lightweight memory caching.
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  {/* Guaranteed Export Note */}
                  <View style={styles.exportNoteBox}>
                    <Ionicons name="sparkles" size={14} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={styles.exportNoteText}>
                      Note: All exported movies will always render in full 100% pristine high quality.
                    </Text>
                  </View>
                </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
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
  section: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  cardBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  controlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tintIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  controlSublabel: {
    fontSize: 10.5,
    marginTop: 2,
  },
  opacityPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  opacityPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  opacityPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  fpsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fpsValueText: {
    fontSize: 14,
    fontWeight: '800',
  },
  presetsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: 11,
  },
  resOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  selectedResOption: {},
  resTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  resDesc: {
    fontSize: 10.5,
    marginTop: 2,
  },
  exportNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 10,
  },
  exportNoteText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
});
