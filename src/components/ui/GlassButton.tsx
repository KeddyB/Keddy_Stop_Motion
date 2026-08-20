import React, { ReactNode, useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
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
  sm: { height: 34, paddingH: 12, fontSize: 12, iconDefault: 15, radius: 10 },
  md: { height: 44, paddingH: 16, fontSize: 13.5, iconDefault: 18, radius: 12 },
  lg: { height: 50, paddingH: 20, fontSize: 14.5, iconDefault: 20, radius: 14 },
  icon: { height: 42, paddingH: 0, fontSize: 0, iconDefault: 20, radius: 12 },
};

const COLOR_CONFIG = {
  default: {
    dark: {
      bg: 'rgba(255, 255, 255, 0.08)',
      border: 'rgba(255, 255, 255, 0.16)',
      text: '#F8FAFC',
      icon: '#E2E8F0',
    },
    light: {
      bg: 'rgba(0, 0, 0, 0.05)',
      border: 'rgba(0, 0, 0, 0.10)',
      text: '#0F172A',
      icon: '#334155',
    },
  },
  primary: {
    dark: {
      bg: '#6366F1',
      border: '#818CF8',
      text: '#FFFFFF',
      icon: '#FFFFFF',
    },
    light: {
      bg: '#4F46E5',
      border: '#818CF8',
      text: '#FFFFFF',
      icon: '#FFFFFF',
    },
  },
  danger: {
    dark: {
      bg: 'rgba(239, 68, 68, 0.22)',
      border: '#EF4444',
      text: '#FCA5A5',
      icon: '#FCA5A5',
    },
    light: {
      bg: 'rgba(239, 68, 68, 0.10)',
      border: '#DC2626',
      text: '#DC2626',
      icon: '#DC2626',
    },
  },
  success: {
    dark: {
      bg: '#10B981',
      border: '#6EE7B7',
      text: '#FFFFFF',
      icon: '#FFFFFF',
    },
    light: {
      bg: '#059669',
      border: '#34D399',
      text: '#FFFFFF',
      icon: '#FFFFFF',
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
      toValue: 0.94,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start();
  }, [scaleAnim, disabled]);

  const onPressOut = useCallback(() => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start();
  }, [scaleAnim, disabled]);

  const isIconOnly = size === 'icon' || (!label && !children && icon);

  const baseContainerStyle = {
    height: sizeConf.height,
    borderRadius: radius,
    backgroundColor: colorConf.bg,
    borderColor: colorConf.border,
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
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.container,
        baseContainerStyle,
        style,
        {
          opacity: disabled ? 0.40 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <View pointerEvents="none" style={styles.content}>
        {children ?? (
          <>
            {icon && (
              <Ionicons
                name={icon}
                size={finalIconSize}
                color={colorConf.icon}
                style={label ? { marginRight: 6 } : undefined}
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
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
