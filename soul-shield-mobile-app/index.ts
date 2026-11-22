// App entry. Expo Router's entry must load first; the widget task handler is
// registered here (not in a route file) because Android renders home-screen
// widgets by launching the JS bundle headlessly — no React tree mounts, so
// anything registered from app/_layout.tsx never runs for widget updates.
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './lib/widget/task-widget';

registerWidgetTaskHandler(widgetTaskHandler);
