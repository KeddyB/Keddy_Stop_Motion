import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppSettings,
  DEFAULT_SETTINGS,
} from '../types/settings';

const SETTINGS_STORAGE_KEY = '@keddy_app_settings';

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // 1. Load saved settings from storage on startup
  useEffect(() => {
    const loadSavedSettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings((prev) => ({
            ...prev,
            ...parsed,
          }));
        }
      } catch (e) {
        console.warn('Failed to load app settings from storage:', e);
      }
    };
    loadSavedSettings();
  }, []);

  // 2. Persist setting change immediately to storage
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        [key]: value,
      };
      AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
        console.warn('Failed to save setting to storage:', e)
      );
      return updated;
    });
  };

  // 3. Reset settings to factory defaults
  const resetSettings = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS)).catch((e) =>
      console.warn('Failed to reset settings in storage:', e)
    );
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useAppSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within a SettingsProvider');
  }
  return context;
};
