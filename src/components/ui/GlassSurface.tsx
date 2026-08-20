import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useTheme } from '../../theme/ThemeContext';
import { useAppSettings } from '../../context/SettingsContext';

export type GlassVariant = 'default' | 'elevated' | 'subtle';

interface GlassSurfaceProps {
  children: ReactNode;
  /** Visual intensity variant */
  variant?: GlassVariant;
  /** Border radius (defaults to 16) */
  borderRadius?: number;
  /** Show specular highlight border (defaults to true) */
  specular?: boolean;
  /** Blur intensity override (defaults per variant) */
  blurIntensity?: number;
  /** Force liquid glass effect style ('clear' | 'regular' | 'none') */
  effect?: 'clear' | 'regular' | 'none';
  /** Additional styles for the outer container */
  style?: StyleProp<ViewStyle>;
  /** Additional styles for the inner content wrapper */
  contentStyle?: StyleProp<ViewStyle>;
}

const VARIANT_CONFIG = {
  default: {
    dark: {
      backgroundBase: 'rgba(20, 26, 41, ALPHA)',
      border: 'rgba(255, 255, 255, 0.18)',
      specular: 'rgba(129, 140, 248, 0.30)',
      blur: Platform.OS === 'ios' ? 70 : 90,
      shadow: '#000000',
    },
    light: {
      backgroundBase: 'rgba(255, 255, 255, ALPHA)',
      border: 'rgba(226, 232, 240, 0.95)',
      specular: 'rgba(255, 255, 255, 0.95)',
      blur: Platform.OS === 'ios' ? 70 : 90,
      shadow: '#4F46E5',
    },
  },
  elevated: {
    dark: {
      backgroundBase: 'rgba(28, 35, 56, ALPHA)',
      border: 'rgba(255, 255, 255, 0.24)',
      specular: 'rgba(129, 140, 248, 0.45)',
      blur: Platform.OS === 'ios' ? 80 : 100,
      shadow: '#000000',
    },
    light: {
      backgroundBase: 'rgba(255, 255, 255, ALPHA)',
      border: 'rgba(203, 213, 225, 0.95)',
      specular: 'rgba(255, 255, 255, 0.98)',
      blur: Platform.OS === 'ios' ? 80 : 100,
      shadow: '#4F46E5',
    },
  },
  subtle: {
    dark: {
      backgroundBase: 'rgba(15, 23, 42, ALPHA)',
      border: 'rgba(255, 255, 255, 0.12)',
      specular: 'rgba(129, 140, 248, 0.20)',
      blur: Platform.OS === 'ios' ? 50 : 60,
      shadow: '#000000',
    },
    light: {
      backgroundBase: 'rgba(248, 250, 252, ALPHA)',
      border: 'rgba(226, 232, 240, 0.85)',
      specular: 'rgba(255, 255, 255, 0.85)',
      blur: Platform.OS === 'ios' ? 50 : 60,
      shadow: '#4F46E5',
    },
  },
};

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  variant = 'default',
  borderRadius = 16,
  specular = true,
  blurIntensity,
  effect = 'clear',
  style,
  contentStyle,
}) => {
  const { isDark } = useTheme();
  const { settings } = useAppSettings();

  const mode = isDark ? 'dark' : 'light';
  const config = VARIANT_CONFIG[variant][mode];

  const isLiquidEnabled = settings?.liquidGlassEnabled ?? true;
  const transparency = settings?.liquidGlassTransparency ?? 0.75;

  // Compute dynamic background alpha from transparency setting
  const alphaVal = isLiquidEnabled
    ? Math.max(0.15, Math.min(0.95, (1 - transparency * 0.75))).toFixed(2)
    : '0.98';

  const backgroundColor = config.backgroundBase.replace('ALPHA', alphaVal);
  const calculatedBlur = Math.round((blurIntensity ?? config.blur) * (isLiquidEnabled ? transparency : 0.9));

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          backgroundColor,
          borderColor: config.border,
          shadowColor: config.shadow,
        },
        style,
      ]}
    >
      {/* Native Apple Liquid Glass View when supported & enabled */}
      {isLiquidEnabled && isLiquidGlassSupported ? (
        <LiquidGlassView
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          effect={effect}
          interactive
        />
      ) : (
        /* Cross-Platform Fallback: Expo Blur with customized dynamic transparency */
        <BlurView
          pointerEvents="none"
          intensity={calculatedBlur}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      )}

      {/* Specular Highlight Rim */}
      {specular && isLiquidEnabled && (
        <View
          pointerEvents="none"
          style={[
            styles.specularRim,
            {
              borderRadius,
              borderColor: config.specular,
            },
          ]}
        />
      )}

      {/* Content */}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
    position: 'relative',
  },
  specularRim: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    opacity: 0.6,
  },
  content: {
    position: 'relative',
    zIndex: 2,
  },
});
