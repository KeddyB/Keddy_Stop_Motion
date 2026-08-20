import React, { ReactNode, useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  StyleProp,
  Platform,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

type GlassButtonSize = 'sm' | 'md' | 'lg' | 'icon';
type GlassButtonColor = 'default' | 'primary' | 'danger' | 'success';

interface GlassButtonProps {
  /** Button label text */
  label?: string;
  /** Ionicons icon name */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon size override */
  iconSize?: number;
  /** Size preset */
  size?: GlassButtonSize;
  /** Color accent */
  color?: GlassButtonColor;
  /** Custom border radius (defaults per size) */
  borderRadius?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Press handler */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Additional container styles */
  style?: StyleProp<ViewStyle>;
  /** Additional label styles */
  labelStyle?: StyleProp<TextStyle>;
  /** Render custom children instead of label/icon */
  children?: ReactNode;
}

const SIZE_CONFIG = {
  sm: { height: 34, paddingH: 14, fontSize: 12, iconDefault: 16, radius: 10 },
  md: { height: 44, paddingH: 18, fontSize: 14, iconDefault: 18, radius: 12 },
  lg: { height: 52, paddingH: 22, fontSize: 15, iconDefault: 20, radius: 14 },
  icon: { height: 42, paddingH: 0, fontSize: 0, iconDefault: 20, radius: 12 },
};

const COLOR_CONFIG = {
  default: {
    dark: {
      bg: '#1E2538',
      border: 'rgba(255, 255, 255, 0.20)',
      specular: 'rgba(129, 140, 248, 0.35)',
      tint: 'rgba(99, 102, 241, 0.15)',
      text: '#F8FAFC',
      icon: '#E2E8F0',
      shadow: '#000000',
    },
    light: {
      bg: '#FFFFFF',
      border: 'rgba(226, 232, 240, 0.95)',
      specular: 'rgba(255, 255, 255, 0.95)',
      tint: 'rgba(79, 70, 229, 0.06)',
      text: '#0F172A',
      icon: '#334155',
      shadow: '#4F46E5',
    },
  },
  primary: {
    dark: {
      bg: '#6366F1',
      border: '#A5B4FC',
      specular: 'rgba(255, 255, 255, 0.60)',
      tint: 'rgba(255, 255, 255, 0.10)',
      text: '#FFFFFF',
      icon: '#FFFFFF',
      shadow: '#6366F1',
    },
    light: {
      bg: '#4F46E5',
      border: '#818CF8',
      specular: 'rgba(255, 255, 255, 0.50)',
      tint: 'rgba(255, 255, 255, 0.10)',
      text: '#FFFFFF',
      icon: '#FFFFFF',
      shadow: '#4F46E5',
    },
  },
  danger: {
    dark: {
      bg: 'rgba(239, 68, 68, 0.35)',
      border: '#EF4444',
      specular: 'rgba(252, 165, 165, 0.50)',
      tint: 'rgba(239, 68, 68, 0.20)',
      text: '#FFFFFF',
      icon: '#FFFFFF',
      shadow: '#DC2626',
    },
    light: {
      bg: '#EF4444',
      border: '#F87171',
      specular: 'rgba(255, 255, 255, 0.40)',
      tint: 'rgba(255, 255, 255, 0.10)',
      text: '#FFFFFF',
      icon: '#FFFFFF',
      shadow: '#DC2626',
    },
  },
  success: {
    dark: {
      bg: '#10B981',
      border: '#6EE7B7',
      specular: 'rgba(255, 255, 255, 0.50)',
      tint: 'rgba(255, 255, 255, 0.10)',
      text: '#FFFFFF',
      icon: '#FFFFFF',
      shadow: '#059669',
    },
    light: {
      bg: '#059669',
      border: '#34D399',
      specular: 'rgba(255, 255, 255, 0.40)',
      tint: 'rgba(255, 255, 255, 0.10)',
      text: '#FFFFFF',
      icon: '#FFFFFF',
      shadow: '#059669',
    },
  },
};

export const GlassButton: React.FC<GlassButtonProps> = ({
  label,
  icon,
  iconSize,
  size = 'md',
  color = 'default',
  borderRadius: borderRadiusOverride,
  disabled = false,
  onPress,
  onLongPress,
  style,
  labelStyle,
  children,
}) => {
  const { isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const mode = isDark ? 'dark' : 'light';
  const sizeConf = SIZE_CONFIG[size];
  const colorConf = COLOR_CONFIG[color][mode];
  const radius = borderRadiusOverride ?? sizeConf.radius;
  const finalIconSize = iconSize ?? sizeConf.iconDefault;

  const onPressIn = useCallback(() => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [scaleAnim, disabled]);

  const onPressOut = useCallback(() => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [scaleAnim, disabled]);

  const isIconOnly = size === 'icon' || (!label && !children && icon);

  // Pre-calculated base style to reduce spread operations in render
  const baseContainerStyle = {
    height: sizeConf.height,
    borderRadius: radius,
    backgroundColor: colorConf.bg,
    borderColor: colorConf.border,
    shadowColor: colorConf.shadow,
    ...(isIconOnly
      ? { width: sizeConf.height, paddingHorizontal: 0 }
      : { paddingHorizontal: sizeConf.paddingH }),
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      unstable_pressDelay={0}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={({ pressed }) => [
        styles.container,
        baseContainerStyle,
        style,
        {
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      {/* Content */}
      <View pointerEvents="none" style={styles.content}>
        {children ?? (
          <>
            {icon && (
              <Ionicons
                name={icon}
                size={finalIconSize}
                color={colorConf.icon}
                style={label ? { marginRight: 8 } : undefined}
              />
            )}
            {label && (
              <Text
                style={[
                  styles.label,
                  {
                    fontSize: sizeConf.fontSize,
                    color: colorConf.text,
                  },
                  labelStyle,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
