import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface, GlassButton } from './ui';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onReplaySplash: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onReplaySplash,
}) => {
  const { theme, activeSchemeMode, setScheme } = useTheme();

  const themeOptions: Array<{ mode: 'dark' | 'light' | 'system'; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { mode: 'dark', label: 'Dark', icon: 'moon' },
    { mode: 'light', label: 'Light', icon: 'sunny' },
    { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ];

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
            <View style={styles.modalContentWrapper}>
              <GlassSurface
                variant="elevated"
                borderRadius={24}
                contentStyle={styles.modalContent}
              >
                {/* Header */}
                <View style={styles.header}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Settings</Text>
                  <GlassButton
                    size="icon"
                    icon="close"
                    iconSize={18}
                    onPress={onClose}
                  />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Theme Selection Section */}
                  <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                    APPEARANCE
                  </Text>
                  <View style={styles.themeSelectorRow}>
                    {themeOptions.map((opt) => {
                      const isSelected = activeSchemeMode === opt.mode;
                      return (
                        <GlassButton
                          key={opt.mode}
                          size="md"
                          color={isSelected ? 'primary' : 'default'}
                          icon={opt.icon}
                          label={opt.label}
                          onPress={() => setScheme(opt.mode)}
                          style={{ flex: 1 }}
                        />
                      );
                    })}
                  </View>

                  {/* About & Splash Preview */}
                  <Text style={[styles.sectionTitle, { color: theme.textMuted, marginTop: 24 }]}>
                    PREVIEW & EXTRAS
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionRow,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => {
                      onClose();
                      onReplaySplash();
                    }}
                  >
                    <View style={styles.actionLeft}>
                      <View style={[styles.actionIconBg, { backgroundColor: theme.badgeBg }]}>
                        <Text style={[styles.cursiveKSmall, { color: theme.primaryLight }]}>𝒦</Text>
                      </View>
                      <Text style={[styles.actionText, { color: theme.text }]}>
                        Replay Cursive Splash Screen
                      </Text>
                    </View>
                    <Ionicons name="play-outline" size={18} color={theme.textMuted} />
                  </Pressable>

                  {/* App Info */}
                  <View style={styles.aboutBox}>
                    <Text style={[styles.aboutTitle, { color: theme.text }]}>
                      Keddy Stop Motion Studio
                    </Text>
                    <Text style={[styles.aboutText, { color: theme.textMuted }]}>
                      Designed for fast, clutter-free stop motion animation. Lightweight and ultra-responsive.
                    </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentWrapper: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  modalContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  themeOptionText: {
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cursiveKSmall: {
    fontSize: 18,
    fontWeight: '300',
    fontStyle: 'italic',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aboutBox: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
    alignItems: 'center',
  },
  aboutTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  aboutText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
