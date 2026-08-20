import { Platform, StatusBar } from 'react-native';
import {
  useSafeAreaInsets as useNativeSafeAreaInsets,
  EdgeInsets,
} from 'react-native-safe-area-context';

const DEFAULT_INSETS: EdgeInsets = {
  top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44,
  bottom: Platform.OS === 'ios' ? 34 : 16,
  left: 0,
  right: 0,
};

export const useAppInsets = (): EdgeInsets => {
  try {
    const insets = useNativeSafeAreaInsets();
    if (!insets) return DEFAULT_INSETS;
    return {
      top: insets.top > 0 ? insets.top : DEFAULT_INSETS.top,
      bottom: insets.bottom > 0 ? insets.bottom : DEFAULT_INSETS.bottom,
      left: insets.left,
      right: insets.right,
    };
  } catch {
    return DEFAULT_INSETS;
  }
};
