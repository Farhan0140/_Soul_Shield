import { useCallback, useEffect, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 3;

/** Exported so duration-picker.tsx can align its h/min/sec labels under each
 * wheel column without duplicating the width value. */
export const WHEEL_COLUMN_WIDTH = 64;

interface WheelRowProps {
  value: number;
  index: number;
  scrollY: SharedValue<number>;
  textColor: string;
  mutedColor: string;
}

/** One number in the wheel — its size/opacity/color are driven entirely by
 * its distance from the centered scroll offset, computed on the UI thread so
 * scrolling stays smooth regardless of JS thread load (the countdown itself
 * never depends on this component at all). */
function WheelRow({ value, index, scrollY, textColor, mutedColor }: WheelRowProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.max(-1, Math.min(1, scrollY.value / ITEM_HEIGHT - index));
    return {
      opacity: interpolate(distance, [-1, 0, 1], [0.35, 1, 0.35]),
      transform: [{ scale: interpolate(distance, [-1, 0, 1], [0.84, 1, 0.84]) }],
      color: interpolateColor(Math.abs(distance), [0, 1], [textColor, mutedColor]),
    };
  });

  return (
    <Animated.Text style={[styles.item, { fontFamily: Fonts.mono }, animatedStyle]}>
      {String(value).padStart(2, '0')}
    </Animated.Text>
  );
}

interface WheelPickerProps {
  values: number[];
  selected: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** A single scrolling, snapping wheel column (hours, minutes, or seconds —
 * see duration-picker.tsx) — the darker-center/lighter-edges look from the
 * reference screenshot, built from an Animated.ScrollView (not FlatList: this
 * list is small and bounded — at most 60 rows — so it never benefits from
 * virtualization, and DurationPicker now also gets embedded inside a
 * scrolling task-creation form, where a VirtualizedList would trigger RN's
 * "VirtualizedLists should never be nested inside plain ScrollViews with the
 * same orientation" warning) and Reanimated's own scroll-driven style
 * interpolation (no third-party picker library — see color-picker.tsx's doc
 * comment on why this codebase avoids those with Reanimated 4's worklets
 * runtime). */
export function WheelPicker({ values, selected, onChange, disabled }: WheelPickerProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const scrollY = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);

  const selectedIndex = Math.max(0, values.indexOf(selected));
  // Set right before calling onChange from the list's own settle handler, so
  // the effect below can tell "the list just told us its new value" apart
  // from "something external changed the selection" (e.g. the persisted
  // selection finishing its async load, or the picker being reset). Only the
  // latter should imperatively re-scroll the list — doing it unconditionally
  // meant every commit from the user's own scroll re-issued a
  // scrollToOffset an instant later, which could collide with a *new*
  // gesture or an in-flight native snap animation and yank the wheel back to
  // the previous value mid-scroll.
  const isInternalChange = useRef(false);

  useEffect(() => {
    scrollY.value = selectedIndex * ITEM_HEIGHT;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    // Only re-sync when the selected value itself changes (e.g. persisted
    // selection finishing its async load) — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Deliberately only wired to onMomentumScrollEnd, not onScrollEndDrag:
  // with snapToInterval set, RN still runs the snap as a momentum/settle
  // phase even from a slow, near-zero-velocity release, so
  // onMomentumScrollEnd reliably fires either way. Committing from
  // onScrollEndDrag too was the other half of the "goes backward" bug — it
  // fires the instant the finger lifts, before momentum has carried the list
  // to its *actual* resting index, so it could commit an intermediate value
  // that the corrective effect above then snapped back to mid-scroll.
  const handleSettle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, index));
      isInternalChange.current = true;
      onChange(values[clamped]);
    },
    [values, onChange]
  );

  return (
    <View style={[styles.container, { opacity: disabled ? 0.5 : 1 }]}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!disabled}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleSettle}
        contentContainerStyle={styles.content}>
        {values.map((value, index) => (
          <WheelRow
            key={value}
            value={value}
            index={index}
            scrollY={scrollY}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: ITEM_HEIGHT * VISIBLE_ROWS, width: WHEEL_COLUMN_WIDTH, overflow: 'hidden' },
  content: { paddingVertical: ITEM_HEIGHT },
  item: { height: ITEM_HEIGHT, lineHeight: ITEM_HEIGHT, fontSize: 22, textAlign: 'center' },
});
