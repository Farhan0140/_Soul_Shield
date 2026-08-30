import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps } from 'react-native';

interface KeyboardAvoidingScrollViewProps extends ScrollViewProps {
  keyboardVerticalOffset?: number;
}

export function KeyboardAvoidingScrollView({
  children,
  keyboardVerticalOffset = 0,
  ...scrollViewProps
}: KeyboardAvoidingScrollViewProps) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      // AndroidManifest.xml sets windowSoftInputMode="adjustResize" (Expo's
      // default), so Android already natively resizes the whole screen when
      // the keyboard opens. Giving KeyboardAvoidingView a behavior here too
      // would resize/pad it a second time on top of that, which is what was
      // leaving a large empty gap above the keyboard (and, since the two
      // resize sources can fall out of sync, sometimes left it stuck there
      // after the keyboard closed too). iOS has no such native resize, so it
      // still needs 'padding' here.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        {...scrollViewProps}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
