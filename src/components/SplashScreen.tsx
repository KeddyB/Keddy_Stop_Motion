import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface SplashScreenProps {
  onFinish: () => void;
}

const { width } = Dimensions.get('window');

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { theme } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const logoSpin = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Staggered cinematic entrance
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, [fadeAnim, scaleAnim, textFadeAnim, containerOpacity, onFinish]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? '#0B0D13' : '#0F172A',
          opacity: containerOpacity,
        },
      ]}
    >
      {/* Background ambient glow */}
      <Animated.View
        style={[
          styles.glowCircle,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Outer Ring */}
        <View style={styles.outerRing}>
          {/* Cursive 'K' Monogram */}
          <Text style={styles.cursiveK}>𝒦</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.textWrapper, { opacity: textFadeAnim }]}>
        <Text style={styles.brandTitle}>Keddy</Text>
        <Text style={styles.brandSubtitle}>STOP MOTION STUDIO</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>v1.0 • Craft your story frame by frame</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  glowCircle: {
    position: 'absolute',
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: (width * 0.75) / 2,
    backgroundColor: '#6366F1',
    opacity: 0.15,
    filter: Platform.OS === 'web' ? 'blur(60px)' : undefined,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2.5,
    borderColor: '#818CF8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  cursiveK: {
    fontSize: 84,
    color: '#FFFFFF',
    fontWeight: '300',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 96,
    includeFontPadding: false,
    textShadowColor: 'rgba(129, 140, 248, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  textWrapper: {
    marginTop: 28,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#818CF8',
    letterSpacing: 4,
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  versionText: {
    fontSize: 12,
    color: '#64748B',
    letterSpacing: 0.5,
  },
});
