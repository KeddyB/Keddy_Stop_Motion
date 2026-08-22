import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GlassSurface } from './GlassSurface';
import { GlassButton } from './GlassButton';

export interface CustomAlertButtonConfig {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

export interface CustomAlertConfig {
  visible: boolean;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  buttons?: CustomAlertButtonConfig[];
}

export interface CustomAlertModalProps extends CustomAlertConfig {
  onClose: () => void;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  visible,
  title,
  message,
  icon = 'help-circle-outline',
  iconColor,
  iconBgColor,
  buttons = [],
  onClose,
}) => {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();

  if (!visible) return null;

  const defaultIconColor = iconColor || theme.primary;
  const defaultIconBg = iconBgColor || (isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.1)');

  const isTwoButtons = buttons.length === 2;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalWrapper, { maxWidth: Math.min(420, width - 40) }]}>
              <GlassSurface
                variant="elevated"
                borderRadius={24}
                contentStyle={styles.glassContent}
              >
                {/* Glowing Top Icon Badge */}
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: defaultIconBg,
                      borderColor: defaultIconColor + '40',
                    },
                  ]}
                >
                  <Ionicons name={icon} size={30} color={defaultIconColor} />
                </View>

                {/* Title */}
                <Text style={[styles.title, { color: theme.text }]}>
                  {title}
                </Text>

                {/* Optional Message Body */}
                {!!message && (
                  <Text style={[styles.message, { color: theme.textMuted }]}>
                    {message}
                  </Text>
                )}

                {/* Action Buttons */}
                <View
                  style={[
                    styles.buttonsContainer,
                    isTwoButtons ? styles.twoButtonsRow : styles.stackedButtons,
                  ]}
                >
                  {buttons.map((btn, index) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestructive = btn.style === 'destructive';

                    const buttonColor = isDestructive
                      ? 'danger'
                      : isCancel
                      ? 'default'
                      : 'primary';

                    return (
                      <GlassButton
                        key={`${btn.text}-${index}`}
                        size="md"
                        color={buttonColor}
                        label={btn.text}
                        onPress={() => {
                          if (btn.onPress) {
                            btn.onPress();
                          } else {
                            onClose();
                          }
                        }}
                        style={isTwoButtons ? styles.flexButton : styles.fullWidthButton}
                      />
                    );
                  })}
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalWrapper: {
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 24,
  },
  glassContent: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  message: {
    fontSize: 14.5,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  buttonsContainer: {
    width: '100%',
    marginTop: 6,
  },
  twoButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stackedButtons: {
    flexDirection: 'column',
    gap: 10,
  },
  flexButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
  },
  fullWidthButton: {
    width: '100%',
    height: 46,
    borderRadius: 14,
  },
});
