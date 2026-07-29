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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
