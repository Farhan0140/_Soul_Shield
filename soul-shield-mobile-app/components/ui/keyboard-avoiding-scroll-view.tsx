import { StyleSheet, View, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

/** Breathing room kept between the focused field (its caret) and the top of
 * the keyboard, so it doesn't end up flush against it. */
const KEYBOARD_GAP = 24;

/**
 * Scroll view for any screen with text inputs: when the keyboard opens, the
 * focused input scrolls up to just above it, and moving to the next field
 * (or a multiline field growing as you type) keeps the caret in view. When
 * the keyboard closes the content settles back.
 *
 * Why a library: the app is edge-to-edge on Android (Expo SDK 54 always is),
 * so Android no longer resizes the window for the keyboard and
 * windowSoftInputMode="adjustResize" does nothing - with RN's own
 * KeyboardAvoidingView/ScrollView the keyboard simply covered fields near
 * the bottom. react-native-keyboard-controller (Expo's recommended fix; set
 * up by <KeyboardProvider> in app/_layout.tsx) tracks the keyboard itself,
 * identically on iOS and Android, and finds the focused input on its own, so
 * inputs don't need any onFocus wiring.
 */
export function KeyboardAvoidingScrollView({ children, contentContainerStyle, ...scrollViewProps }: ScrollViewProps) {
  // The library appends a spacer view after the content to make room for
  // the keyboard. Keeping the screen's own content in one wrapper View means
  // that spacer doesn't join the content's `gap` / `justifyContent: center`
  // layout (which would shift the screens' layout slightly even with the
  // keyboard closed).
  const grows = StyleSheet.flatten(contentContainerStyle)?.flexGrow != null;
  return (
    <KeyboardAwareScrollView
      bottomOffset={KEYBOARD_GAP}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      {...scrollViewProps}
      contentContainerStyle={grows ? styles.grow : undefined}>
      <View style={contentContainerStyle}>{children}</View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
});
