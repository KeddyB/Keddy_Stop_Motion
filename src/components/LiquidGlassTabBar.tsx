import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  LiquidGlassContainerView,
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAppSettings } from '../context/SettingsContext';
import { useAppInsets } from '../utils/useAppInsets';

export type TabKey = 'home' | 'settings';

interface LiquidGlassTabBarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onPressNewAnimation?: () => void;
}

// Pixel-perfect symmetrical geometry constants
const BORDER_WIDTH = 1.5;
const PADDING = 5;
const PILL_HEIGHT = 48;
const PILL_WIDTH = 126;
const BAR_WIDTH = (PILL_WIDTH * 2) + (PADDING * 2) + (BORDER_WIDTH * 2); // 265px
const BAR_HEIGHT = PILL_HEIGHT + (PADDING * 2) + (BORDER_WIDTH * 2); // 61px
const FAB_SIZE = 58;
const FAB_RADIUS = FAB_SIZE / 2;
const FAB_SPACING = 12;

export const LiquidGlassTabBar: React.FC<LiquidGlassTabBarProps> = ({
  activeTab,
  onSelectTab,
  onPressNewAnimation,
}) => {
  const { theme, isDark } = useTheme();
  const { settings } = useAppSettings();
  const insets = useAppInsets();

  const isLiquidEnabled = settings?.liquidGlassEnabled ?? true;
  const transparency = settings?.liquidGlassTransparency ?? 0.75;

  const translateX = useRef(new Animated.Value(activeTab === 'home' ? 0 : PILL_WIDTH)).current;

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
    const targetX = activeTab === 'home' ? 0 : PILL_WIDTH;
    animateTo(targetX);
  }, [activeTab]);

  const handlePress = (tabKey: TabKey) => {
    if (tabKey === activeTab) return;
    const targetX = tabKey === 'home' ? 0 : PILL_WIDTH;
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

  // Background alpha calculation based on transparency settings
  const alphaVal = isLiquidEnabled
    ? Math.max(0.2, (1 - transparency * 0.7)).toFixed(2)
    : '0.98';

  const capsuleBg = isDark
    ? `rgba(24, 31, 48, ${alphaVal})`
    : `rgba(255, 255, 255, ${alphaVal})`;

  const fabBg = isDark
    ? `rgba(99, 102, 241, 0.25)`
    : `rgba(79, 70, 229, 0.12)`;

  const blurIntensity = Math.round((Platform.OS === 'ios' ? 70 : 90) * (isLiquidEnabled ? transparency : 1.0));

  // Render row content: Tab Switcher and New Project FAB are centered as one unified block
  const renderTabBarRow = () => (
    <View style={styles.tabBarRow}>
      {/* Main Tab Capsule */}
      <View
        style={[
          styles.glassWrapper,
          {
            shadowColor: isDark ? '#000000' : '#4F46E5',
            backgroundColor: capsuleBg,
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.22)'
              : 'rgba(203, 213, 225, 0.9)',
          },
        ]}
      >
        {isLiquidEnabled && isLiquidGlassSupported ? (
          <LiquidGlassView
            style={[StyleSheet.absoluteFill, { borderRadius: BAR_HEIGHT / 2 }]}
            effect="clear"
            interactive
          />
        ) : (
          <BlurView
            pointerEvents="none"
            intensity={blurIntensity}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Specular Top Rim */}
        {isLiquidEnabled && (
          <View
            pointerEvents="none"
            style={[
              styles.specularBorder,
              {
                borderColor: isDark
                  ? 'rgba(129, 140, 248, 0.35)'
                  : 'rgba(255, 255, 255, 0.95)',
              },
            ]}
          />
        )}

        {/* Snappy Gliding Active Indicator Pill */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingPill,
            {
              backgroundColor: isDark
                ? 'rgba(99, 102, 241, 0.40)'
                : 'rgba(79, 70, 229, 0.18)',
              borderColor: isDark ? '#818CF8' : '#6366F1',
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
              marginLeft: FAB_SPACING,
              shadowColor: isDark ? '#000000' : '#4F46E5',
              backgroundColor: fabBg,
              borderColor: isDark ? '#818CF8' : '#6366F1',
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
          onPress={onPressNewAnimation}
        >
          {isLiquidEnabled && isLiquidGlassSupported ? (
            <LiquidGlassView
              style={StyleSheet.absoluteFill}
              effect="clear"
              interactive
            />
          ) : (
            <BlurView
              intensity={blurIntensity}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          )}

          <Ionicons
            name="add"
            size={26}
            color={isDark ? '#FFFFFF' : '#4F46E5'}
          />
        </Pressable>
      )}
    </View>
  );

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
      {isLiquidEnabled && isLiquidGlassSupported ? (
        <LiquidGlassContainerView spacing={FAB_SPACING} style={styles.tabBarRow}>
          {renderTabBarRow()}
        </LiquidGlassContainerView>
      ) : (
        renderTabBarRow()
      )}
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
    borderWidth: BORDER_WIDTH,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
    position: 'relative',
  },
  specularBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    opacity: 0.6,
  },
  slidingPill: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1.5,
    zIndex: 1,
  },
  tabRow: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    right: PADDING,
    bottom: PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  tabButton: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
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
});
