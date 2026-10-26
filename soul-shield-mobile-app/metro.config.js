const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// TEMPORARY WORKAROUND (2026-10-24): @expo/metro-runtime@6.1.2's
// `build/location/install.native.js` statically imports `react-native/setup-env`,
// an entry point React Native 0.81.x does not publish (its exports wildcard
// `"./*" -> "./*.js"` points at a file that 404s — see expo/expo PRs #51177 and
// #50863, where Expo's own fix imports InitializeCore instead). Every stable
// metro-runtime release up to 6.1.2 has this import, so bundling any SDK 54
// app on RN 0.81.x fails with
//   Unable to resolve "react-native/setup-env" from
//   "node_modules\@expo\metro-runtime\build\location\install.native.js"
// Alias the specifier to the exact module Expo's fixed sdk-54 code uses.
// REMOVE ONCE @expo/metro-runtime SHIPS A STABLE RELEASE WITH THE CORRECTED
// IMPORT (>= 6.1.3), then run `npx expo start --clear`.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native/setup-env') {
    return context.resolveRequest(
      { ...context, resolveRequest: undefined },
      'react-native/Libraries/Core/InitializeCore',
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
