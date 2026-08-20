import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface, GlassButton } from './ui';

interface PermissionPromptModalProps {
  visible: boolean;
  onGrant: () => void;
  onSkip: () => void;
  reasonText?: string;
}

export const PermissionPromptModal: React.FC<PermissionPromptModalProps> = ({
  visible,
  onGrant,
  onSkip,
  reasonText = 'To start your animation project and capture frames, Keddy needs access to your camera, storage, and microphone:',
}) => {
  const { theme, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
    >
      <TouchableWithoutFeedback onPress={onSkip}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCardWrapper}>
              <GlassSurface
                variant="elevated"
                borderRadius={24}
                contentStyle={styles.modalCardContent}
              >
                {/* Top Icon Badge */}
                <View style={styles.topIconWrapper}>
                  <View
                    style={[
                      styles.topIconCircle,
                      {
                        backgroundColor: isDark
                          ? 'rgba(99, 102, 241, 0.2)'
                          : 'rgba(79, 70, 229, 0.1)',
                        borderColor: theme.primaryLight,
                      },
                    ]}
                  >
                    <Ionicons name="shield-checkmark" size={32} color={theme.primaryLight} />
                  </View>
                </View>

                {/* Title & Description */}
                <Text style={[styles.title, { color: theme.text }]}>
                  Studio Access Required
                </Text>
                <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                  {reasonText}
                </Text>

                {/* Permission List Items */}
                <View style={styles.itemList}>
                  {/* 1. Camera Permission */}
                  <View
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.itemIconBg,
                        { backgroundColor: theme.primary },
                      ]}
                    >
                      <Ionicons name="camera" size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.itemTextContainer}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                        Camera Access
                      </Text>
                      <Text style={[styles.itemDesc, { color: theme.textMuted }]}>
                        Live viewfinder, photo capture, and onion skinning.
                      </Text>
                    </View>
                  </View>

                  {/* 2. Storage / Media Library Permission */}
                  <View
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.itemIconBg,
                        { backgroundColor: theme.primaryLight },
                      ]}
                    >
                      <Ionicons name="folder" size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.itemTextContainer}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                        Device Storage & Gallery
                      </Text>
                      <Text style={[styles.itemDesc, { color: theme.textMuted }]}>
                        Save your animation frames and import pictures from storage.
                      </Text>
                    </View>
                  </View>

                  {/* 3. Microphone Permission */}
                  <View
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.itemIconBg,
                        { backgroundColor: '#10B981' },
                      ]}
                    >
                      <Ionicons name="mic" size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.itemTextContainer}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                        Microphone & Audio
                      </Text>
                      <Text style={[styles.itemDesc, { color: theme.textMuted }]}>
                        Record sound effects and sync soundtracks with your animation.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <GlassButton
                  size="lg"
                  color="primary"
                  icon="checkmark-circle"
                  label="Grant Permissions & Start"
                  onPress={onGrant}
                  style={{ marginTop: 14 }}
                />

                <GlassButton
                  size="md"
                  label="Cancel"
                  onPress={onSkip}
                  style={{ marginTop: 8 }}
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
    padding: 16,
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 440,
  },
  modalCardContent: {
    padding: 24,
    alignItems: 'center',
  },
  topIconWrapper: {
    marginBottom: 12,
  },
  topIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  itemList: {
    width: '100%',
    gap: 8,
    marginBottom: 20,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  itemIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  grantBtn: {
    width: '100%',
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
    marginBottom: 8,
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: 6,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
