import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import App from './App';

// Prevent native splash screen from hiding until custom animated splash is ready
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

// Suppress known non-fatal upstream SVG filter Codegen development warnings
LogBox.ignoreLogs([
  "Codegen didn't run for RNSVG",
]);

registerRootComponent(App);

