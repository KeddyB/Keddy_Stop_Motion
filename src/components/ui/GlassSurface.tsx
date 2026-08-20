import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeContext';

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
  /** Additional styles for the outer container */
  style?: StyleProp<ViewStyle>;
  /** Additional styles for the inner content wrapper */
  contentStyle?: StyleProp<ViewStyle>;
}

const VARIANT_CONFIG = {
  default: {
    dark: {
      background: '#141A29',
      border: 'rgba(255, 255, 255, 0.18)',
      specular: 'rgba(129, 140, 248, 0.30)',
      blur: Platform.OS === 'ios' ? 70 : 90,
      shadow: '#000000',
    },
    light: {
      background: '#FFFFFF',
      border: 'rgba(226, 232, 240, 0.95)',
      specular: 'rgba(255, 255, 255, 0.95)',
      blur: Platform.OS === 'ios' ? 70 : 90,
      shadow: '#4F46E5',
    },
  },
  elevated: {
    dark: {
      background: '#1C2338',
      border: 'rgba(255, 255, 255, 0.24)',
      specular: 'rgba(129, 140, 248, 0.45)',
      blur: Platform.OS === 'ios' ? 80 : 100,
      shadow: '#000000',
    },
    light: {
      background: '#FFFFFF',
      border: 'rgba(203, 213, 225, 0.95)',
      specular: 'rgba(255, 255, 255, 0.98)',
      blur: Platform.OS === 'ios' ? 80 : 100,
      shadow: '#4F46E5',
    },
  },
  subtle: {
    dark: {
      background: 'rgba(20, 26, 41, 0.70)',
      border: 'rgba(255, 255, 255, 0.12)',
      specular: 'rgba(129, 140, 248, 0.20)',
      blur: Platform.OS === 'ios' ? 50 : 60,
      shadow: '#000000',
    },
    light: {
      background: '#F8FAFC',
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
  style,
  contentStyle,
}) => {
  const { isDark } = useTheme();
  const mode = isDark ? 'dark' : 'light';
  const config = VARIANT_CONFIG[variant][mode];

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          backgroundColor: config.background,
          borderColor: config.border,
          shadowColor: config.shadow,
        },
        style,
      ]}
    >
      {/* Blur layer */}
      <BlurView
        pointerEvents="none"
        intensity={blurIntensity ?? config.blur}
        tint={isDark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

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
  content: {
    position: 'relative',
    zIndex: 2,
  },
});
