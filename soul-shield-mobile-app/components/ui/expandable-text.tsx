import { useState } from 'react';
import { Pressable, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';

interface ExpandableTextProps extends Omit<ThemedTextProps, 'numberOfLines' | 'onTextLayout'> {
  text: string;
  /** Collapsed line cap — only text longer than this becomes tappable.
   * Shorter text renders exactly like a plain ThemedText, with no control. */
  maxLines?: number;
  /** Layout style for the wrapper (e.g. `{ flex: 1 }` when the text sits in
   * a row alongside other elements — the text itself receives `style`). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Visual text style. */
  style?: StyleProp<TextStyle>;
}

/** Long titles/descriptions collapse to `maxLines` by default; tapping
 * expands to the full text, tapping again collapses back. Truncation is
 * measured from the text's own layout (onTextLayout), so text that fits
 * naturally never shows any expansion affordance.
 *
 * The wrapping Pressable is DISABLED while the text fits (and once fully
 * expanded-but-untruncated), which in React Native makes taps fall straight
 * through to any outer Pressable — a truncated card title claims the tap
 * for expand/collapse, while a short one keeps toggling the card's details
 * section, and a counter/timer sub-task row still routes to its page unless
 * its title happens to be long enough to truncate. */
export function ExpandableText({ text, maxLines = 2, containerStyle, style, type, ...rest }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [canToggle, setCanToggle] = useState(false);

  return (
    <Pressable disabled={!canToggle} onPress={() => setExpanded((v) => !v)} hitSlop={4} style={containerStyle}>
      <ThemedText
        type={type}
        numberOfLines={expanded ? undefined : maxLines}
        onTextLayout={(e) => {
          const lineCount = e.nativeEvent.lines?.length ?? 0;
          if (expanded) {
            // Re-measured without the cap: if the full text never exceeded
            // maxLines it wasn't actually truncated — collapse back and stop
            // claiming taps.
            if (lineCount <= maxLines) {
              setExpanded(false);
              setCanToggle(false);
            }
            return;
          }
          setCanToggle(lineCount >= maxLines);
        }}
        style={style}
        {...rest}>
        {text}
      </ThemedText>
    </Pressable>
  );
}
