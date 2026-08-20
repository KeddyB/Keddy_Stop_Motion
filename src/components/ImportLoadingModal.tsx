import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface ImportLoadingModalProps {
  visible: boolean;
  current: number;
  total: number;
  stageMessage?: string;
}

export const ImportLoadingModal: React.FC<ImportLoadingModalProps> = ({
  visible,
  current,
  total,
  stageMessage = 'Sorting chronologically by snap time...',
}) => {
  const { theme, isDark } = useTheme();

  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
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
          <View style={styles.iconCircle}>
            <ActivityIndicator size="large" color={theme.primaryLight} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            Importing Photos
          </Text>

          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {stageMessage}
          </Text>

          {total > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTextRow}>
                <Text style={[styles.countText, { color: theme.textMuted }]}>
                  {current} of {total} frames
                </Text>
                <Text style={[styles.percentText, { color: theme.primaryLight }]}>
                  {percent}%
                </Text>
              </View>

              <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceSubtle }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${percent}%`,
                      backgroundColor: theme.primary,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 16,
  },
  progressContainer: {
    width: '100%',
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  percentText: {
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
});
