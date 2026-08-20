import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAppInsets } from '../utils/useAppInsets';

export type TabKey = 'home' | 'settings';

interface LiquidGlassTabBarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onPressNewAnimation?: () => void;
}

const BAR_WIDTH = 266;
const BAR_HEIGHT = 60;
const PADDING = 6;
const TAB_WIDTH = (BAR_WIDTH - PADDING * 2) / 2;
const FAB_SIZE = 60;
const FAB_RADIUS = FAB_SIZE / 2;

export const LiquidGlassTabBar: React.FC<LiquidGlassTabBarProps> = ({
  activeTab,
  onSelectTab,
  onPressNewAnimation,
}) => {
  const { theme, isDark } = useTheme();
  const insets = useAppInsets();

  const translateX = useRef(new Animated.Value(activeTab === 'home' ? 0 : TAB_WIDTH)).current;

  // Ultra-fast immediate animation
  const animateTo = (targetX: number) => {
    Animated.timing(translateX, {
      toValue: targetX,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const targetX = activeTab === 'home' ? 0 : TAB_WIDTH;
    animateTo(targetX);
  }, [activeTab]);

  const handlePress = (tabKey: TabKey) => {
    if (tabKey === activeTab) return;
    const targetX = tabKey === 'home' ? 0 : TAB_WIDTH;
    animateTo(targetX); // Start moving instantly before parent render
    onSelectTab(tabKey);
  };

  const tabs: Array<{
    key: TabKey;
    label: string;
    iconActive: keyof typeof Ionicons.glyphMap;
    iconInactive: keyof typeof Ionicons.glyphMap;
  }> = [
    {
      key: 'home',
      label: 'Studio',
      iconActive: 'film',
      iconInactive: 'film-outline',
    },
    {
      key: 'settings',
      label: 'Settings',
      iconActive: 'settings',
      iconInactive: 'settings-outline',
    },
  ];

  const bottomOffset = Math.max(insets.bottom, 22) + 10;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.floatingContainer,
        {
          bottom: bottomOffset,
        },
      ]}
    >
      <View style={styles.tabBarRow}>
        {/* Main Tab Capsule */}
        <View
          style={[
            styles.glassWrapper,
            {
              shadowColor: isDark ? '#000000' : '#4F46E5',
              backgroundColor: isDark
                ? '#181F30'
                : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.22)'
                : 'rgba(203, 213, 225, 0.9)',
            },
          ]}
        >
          <BlurView
            pointerEvents="none"
            intensity={Platform.OS === 'ios' ? 70 : 90}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />

          {/* Snappy Gliding Active Indicator Pill */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.slidingPill,
              {
                backgroundColor: isDark
                  ? 'rgba(99, 102, 241, 0.40)'
                  : 'rgba(79, 70, 229, 0.18)',
                borderColor: isDark
                  ? '#818CF8'
                  : '#6366F1',
                transform: [{ translateX }],
              },
            ]}
          />

          {/* Tab Buttons Row */}
          <View style={styles.tabRow}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  unstable_pressDelay={0}
                  pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => handlePress(tab.key)}
                  style={({ pressed }) => [
                    styles.tabButton,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Ionicons
                    name={isActive ? tab.iconActive : tab.iconInactive}
                    size={18}
                    color={isActive ? (isDark ? '#818CF8' : '#4F46E5') : theme.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabLabel,
                      {
                        color: isActive
                          ? isDark
                            ? '#F8FAFC'
                            : '#4F46E5'
                          : theme.textMuted,
                        fontWeight: isActive ? '800' : '600',
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Circular Floating Plus Button to Start New Animation */}
        {onPressNewAnimation && (
          <Pressable
            unstable_pressDelay={0}
            pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.fabButton,
              {
                marginLeft: 12,
                shadowColor: isDark ? '#000000' : '#4F46E5',
                backgroundColor: isDark
                  ? 'rgba(20, 24, 36, 0.78)'
                  : 'rgba(255, 255, 255, 0.84)',
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.20)'
                  : 'rgba(255, 255, 255, 0.85)',
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
            onPress={onPressNewAnimation}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 70 : 90}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />

            {/* Specular highlight border overlay */}
            <View
              style={[
                styles.fabSpecularBorder,
                {
                  borderColor: isDark
                    ? 'rgba(129, 140, 248, 0.40)'
                    : 'rgba(255, 255, 255, 0.9)',
                },
              ]}
            />

            {/* Internal glass color wash tint */}
            <View
              style={[
                styles.fabInnerGlow,
                {
                  backgroundColor: isDark
                    ? 'rgba(99, 102, 241, 0.24)'
                    : 'rgba(79, 70, 229, 0.12)',
                },
              ]}
            />

            <Ionicons
              name="add"
              size={26}
              color={isDark ? '#818CF8' : '#4F46E5'}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassWrapper: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    flexShrink: 0,
    borderWidth: 1.5,
    overflow: 'hidden',
    paddingTop: PADDING,
    paddingBottom: PADDING,
    paddingLeft: PADDING,
    paddingRight: PADDING,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
    position: 'relative',
  },
  specularBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    opacity: 0.6,
  },
  slidingPill: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    paddingRight: PADDING,
    width: TAB_WIDTH,
    borderRadius: (BAR_HEIGHT - PADDING * 2) / 2,
    borderWidth: 1.5,
    zIndex: 1,
  },
  tabRow: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    right: PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    borderRadius: (BAR_HEIGHT - PADDING * 2) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabLabel: {
    fontSize: 13.5,
    letterSpacing: 0.1,
    includeFontPadding: false,
    textAlign: 'center',
  },
  fabButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_RADIUS,
    flexShrink: 0,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
    position: 'relative',
  },
  fabSpecularBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: FAB_RADIUS,
    borderWidth: 1,
    opacity: 0.7,
  },
  fabInnerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: FAB_RADIUS,
  },
});
