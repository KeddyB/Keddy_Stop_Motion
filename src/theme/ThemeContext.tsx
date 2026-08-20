import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorTheme, darkTheme, lightTheme } from './colors';

const THEME_STORAGE_KEY = '@keddy_theme_mode';

interface ThemeContextType {
  theme: ColorTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setScheme: (mode: 'dark' | 'light' | 'system') => void;
  activeSchemeMode: 'dark' | 'light' | 'system';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [schemeMode, setSchemeMode] = useState<'dark' | 'light' | 'system'>('dark');

  // Load saved theme on startup
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setSchemeMode(saved);
        }
      } catch (e) {
        console.warn('Failed to load theme preference:', e);
      }
    };
    loadTheme();
  }, []);

  const isDark =
    schemeMode === 'system'
      ? systemColorScheme === 'dark'
      : schemeMode === 'dark';

  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setSchemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  };

  const setScheme = (mode: 'dark' | 'light' | 'system') => {
    setSchemeMode(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        setScheme,
        activeSchemeMode: schemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
