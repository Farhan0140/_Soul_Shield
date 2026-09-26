import { createContext, useContext, useEffect, useRef } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  UIManager,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type TextInputProps,
} from 'react-native';

// Derived from TextInputProps['onFocus'] itself rather than importing RN's
// internal FocusEvent type directly (not part of the package's public
// exports) - this way it can never drift from whatever type TextInput's own
// onFocus actually expects.
type FocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];

const KeyboardScrollContext = createContext<((event: FocusEvent) => void) | null>(null);

/** Scrolls whichever input just focused up above the keyboard - pass this as
 * (or call it from) that input's `onFocus`. TextField already wires this up
 * for every labeled field app-wide (Sign In, Sign Up, Create Task, Create
 * Category, ...); a few raw TextInputs outside TextField do the same (see
 * color-picker.tsx). A no-op outside a KeyboardAvoidingScrollView - e.g. an
 * input inside a centered Modal, which isn't part of that scroll view's
 * layout and wouldn't be helped by scrolling it - so it's always safe to
 * call. */
export function useScrollToFocusedInput() {
  return useContext(KeyboardScrollContext) ?? undefined;
}

interface KeyboardAvoidingScrollViewProps extends ScrollViewProps {
  keyboardVerticalOffset?: number;
}

/** Breathing room kept between the scrolled-to field and the top of the
 * keyboard, so it doesn't end up flush against it. */
const KEYBOARD_GAP = 24;

export function KeyboardAvoidingScrollView({
  children,
  keyboardVerticalOffset = 0,
  onScroll,
  ...scrollViewProps
}: KeyboardAvoidingScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  // Last measured scroll offset, so a scroll-to-reveal-the-field call can
  // move *relative* to wherever the user already scrolled instead of
  // guessing/resetting it.
  const scrollY = useRef(0);
  const focusedHandle = useRef<number | null>(null);
  // 0 = keyboard closed. Tracked ourselves (RN's own internal ScrollResponder
  // tracking of this turned out unreliable here - see below) so a focus that
  // happens while the keyboard is *already* open (tabbing from one field to
  // the next) can still be handled, not just the one that first opens it.
  const keyboardHeight = useRef(0);

  const revealFocusedInput = () => {
    const handle = focusedHandle.current;
    if (handle == null || keyboardHeight.current === 0) return;
    UIManager.measureInWindow(handle, (x, y, width, height) => {
      const keyboardTop = Dimensions.get('window').height - keyboardHeight.current;
      const overlap = y + height - keyboardTop;
      if (overlap > 0) {
        scrollRef.current?.scrollTo({ y: scrollY.current + overlap + KEYBOARD_GAP, animated: true });
      }
    });
  };

  useEffect(() => {
    // *Will* on iOS (fires before the animation, so the scroll can run
    // alongside it) vs *Did* on Android (RN doesn't emit `keyboardWillShow`
    // there).
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      keyboardHeight.current = e.endCoordinates.height;
      revealFocusedInput();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.current = 0;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // The measure-and-scroll itself lives in revealFocusedInput above,
  // reused by both paths: the keyboard-show listener above handles the
  // field that's opening the keyboard for the first time; this one handles
  // moving between fields while it's already open, when no new show event
  // ever fires.
  const scrollToFocusedInput = (event: FocusEvent) => {
    focusedHandle.current = event.nativeEvent.target;
    if (keyboardHeight.current > 0) revealFocusedInput();
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
    onScroll?.(event);
  };

  return (
    <KeyboardScrollContext.Provider value={scrollToFocusedInput}>
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
          ref={scrollRef}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          {...scrollViewProps}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardScrollContext.Provider>
  );
}
