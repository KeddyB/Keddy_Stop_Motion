import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAppInsets } from '../utils/useAppInsets';
import { GlassButton } from './ui/GlassButton';

interface HeaderProps {
  onOpenSettings?: () => void;
  onReplaySplash?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onReplaySplash }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useAppInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          paddingTop: insets.top + (Platform.OS === 'android' ? 6 : 2),
        },
      ]}
    >
      <View style={styles.innerRow}>
        {/* Brand logo & title */}
        <Pressable
          style={styles.brandContainer}
          unstable_pressDelay={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onReplaySplash}
        >
          <View style={[styles.miniLogo, { backgroundColor: theme.primary }]}>
            <Text style={styles.miniLogoText}>𝒦</Text>
          </View>
          <View style={styles.titleWrapper}>
            <Text style={[styles.title, { color: theme.text }]}>Keddy</Text>
            <Text style={[styles.tagline, { color: theme.primaryLight }]}>STOP MOTION</Text>
          </View>
        </Pressable>

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Theme Switcher */}
          <GlassButton
            size="icon"
            icon={isDark ? 'sunny' : 'moon'}
            iconSize={18}
            onPress={toggleTheme}
            style={styles.headerGlassBtn}
          />

          {/* Settings shortcut button */}
          {onOpenSettings && (
            <GlassButton
              size="icon"
              icon="settings-outline"
              iconSize={18}
              onPress={onOpenSettings}
              style={styles.headerGlassBtn}
            />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  miniLogoText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '300',
    fontStyle: 'italic',
    lineHeight: 26,
    textAlign: 'center',
  },
  titleWrapper: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: -2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerGlassBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
