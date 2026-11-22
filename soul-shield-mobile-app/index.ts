// App entry. Expo Router's entry must load first.
//
// Everything Android/iOS can run WITHOUT opening the app is set up here, not
// in a route file: for a home-screen widget update, a background task or a
// data-only push, the OS launches the JS bundle headlessly. No React tree
// mounts, so app/_layout.tsx (and anything it imports) never runs, and a
// handler registered there would be missing exactly when it's needed.
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

// Side effects: TaskManager.defineTask for the daily background sync (which
// also completes timers that finished while the app was closed) and for the
// data-only "data-change" push. Defining a task must happen at startup of
// every launch, headless ones included.
import './lib/background-sync/task';
import './lib/background-sync/data-change-task';
import { widgetTaskHandler } from './lib/widget/task-widget';

registerWidgetTaskHandler(widgetTaskHandler);
