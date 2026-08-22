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
import { Image as ExpoImage } from 'expo-image';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useTheme } from '../theme/ThemeContext';

interface SplashScreenProps {
  onFinish: () => void;
}

const { width } = Dimensions.get('window');

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { theme } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide native OS splash screen once the custom animated component is mounted
    ExpoSplashScreen.hideAsync().catch(() => {});

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
      {/* Background cinematic image */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <ExpoImage
          source={require('../../assets/splash-bg.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        {/* Dark overlay to ensure text readability */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11, 13, 19, 0.45)' }]} />
      </Animated.View>

      <Animated.View style={[styles.textWrapper, { opacity: textFadeAnim }]}>
        <Text style={styles.brandTitle}>Keddy</Text>
        <Text style={styles.brandSubtitle}>STOP MOTION WORKSHOP</Text>
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
