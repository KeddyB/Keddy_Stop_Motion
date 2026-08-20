import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import App from './App';

// Suppress known non-fatal upstream SVG filter Codegen development warnings
LogBox.ignoreLogs([
  "Codegen didn't run for RNSVG",
]);

registerRootComponent(App);
