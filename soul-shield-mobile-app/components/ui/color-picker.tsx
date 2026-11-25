import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, TextInput, View, type GestureResponderEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { hexToHsv, hsvToHex, isValidHex, type HSV } from '@/lib/color';

const SV_SIZE = 220;
const HUE_SIZE = 220;
const HUE_HEIGHT = 24;
const THUMB_SIZE = 22;

const HUE_GRADIENT =
  'linear-gradient(to right, #FF0000 0%, #FFFF00 16.67%, #00FF00 33.33%, #00FFFF 50%, #0000FF 66.67%, #FF00FF 83.33%, #FF0000 100%)';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

/** HSV color picker (saturation/value square + hue slider) with a hex input
 * for manual entry — replaces a fixed preset-swatch palette so any color can
 * be picked, not just a curated list. Built on PanResponder + Expo's CSS
 * gradient support (experimental_backgroundImage) rather than a third-party
 * picker library, since react-native-reanimated 4's worklets runtime broke
 * compatibility with most existing RN color-picker packages. */
export function ColorPicker({ value, onChange, label = 'Color' }: ColorPickerProps) {
  const borderColor = useThemeColor({}, 'border');
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const dangerColor = useThemeColor({}, 'danger');

  const initialHex = isValidHex(value) ? value : '#4F46E5';
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(initialHex));
  const [hexInput, setHexInput] = useState(initialHex.toUpperCase());
  const [error, setError] = useState('');

  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  useEffect(() => {
    if (isValidHex(value) && value.toUpperCase() !== hsvToHex(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v)) {
      setHsv(hexToHsv(value));
      setHexInput(value.toUpperCase());
      setError('');
    }
  }, [value]);

  const commit = (next: HSV) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setHexInput(hex);
    setError('');
    onChange(hex);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const handleSvTouch = (x: number, y: number) => {
    const clampedX = Math.min(Math.max(x, 0), SV_SIZE);
    const clampedY = Math.min(Math.max(y, 0), SV_SIZE);
    commitRef.current({
      ...hsvRef.current,
      s: (clampedX / SV_SIZE) * 100,
      v: 100 - (clampedY / SV_SIZE) * 100,
    });
  };
  const handleSvTouchRef = useRef(handleSvTouch);
  handleSvTouchRef.current = handleSvTouch;

  const handleHueTouch = (x: number) => {
    const clampedX = Math.min(Math.max(x, 0), HUE_SIZE);
    commitRef.current({ ...hsvRef.current, h: (clampedX / HUE_SIZE) * 360 });
  };
  const handleHueTouchRef = useRef(handleHueTouch);
  handleHueTouchRef.current = handleHueTouch;

  const svResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) =>
        handleSvTouchRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
      onPanResponderMove: (evt: GestureResponderEvent) =>
        handleSvTouchRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
    })
  ).current;

  const hueResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => handleHueTouchRef.current(evt.nativeEvent.locationX),
      onPanResponderMove: (evt: GestureResponderEvent) => handleHueTouchRef.current(evt.nativeEvent.locationX),
    })
  ).current;

  const handleHexChange = (text: string) => {
    let clean = text.trim();
    if (clean && !clean.startsWith('#')) clean = '#' + clean;
    setHexInput(clean);
    if (clean.length !== 4 && clean.length !== 7) {
      setError('');
      return;
    }
    if (isValidHex(clean)) {
      commit(hexToHsv(clean));
    } else {
      setError("That doesn't look like a valid color code.");
    }
  };

  const hueHex = hsvToHex(hsv.h, 100, 100);
  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <View style={styles.container}>
      {label ? <ThemedText style={[styles.label, { color: mutedColor }]}>{label}</ThemedText> : null}

      <View style={styles.previewRow}>
        <View style={[styles.preview, { backgroundColor: currentHex, borderColor }]} />
        <TextInput
          value={hexInput}
          onChangeText={handleHexChange}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          placeholder="#4F46E5"
          placeholderTextColor={mutedColor}
          style={[
            styles.hexInput,
            { color: textColor, borderColor: error ? dangerColor : borderColor, backgroundColor: cardColor },
          ]}
        />
      </View>
      {error ? <ThemedText style={[styles.error, { color: dangerColor }]}>{error}</ThemedText> : null}

      {/* Saturation/value square: horizontal axis picks saturation (white → full
          hue color), vertical axis picks value/brightness (bright → black). */}
      <View
        style={[styles.svSquare, { backgroundColor: hueHex, borderColor }]}
        {...svResponder.panHandlers}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { experimental_backgroundImage: 'linear-gradient(to right, #FFFFFF 0%, transparent 100%)' } as object,
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { experimental_backgroundImage: 'linear-gradient(to bottom, transparent 0%, #000000 100%)' } as object,
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.svThumb,
            {
              left: (hsv.s / 100) * SV_SIZE - THUMB_SIZE / 2,
              top: (1 - hsv.v / 100) * SV_SIZE - THUMB_SIZE / 2,
              backgroundColor: currentHex,
            },
          ]}
        />
      </View>

      {/* Hue slider */}
      <View
        style={[styles.hueBar, { borderColor, experimental_backgroundImage: HUE_GRADIENT } as object]}
        {...hueResponder.panHandlers}>
        <View
          pointerEvents="none"
          style={[
            styles.hueThumb,
            { left: (hsv.h / 360) * HUE_SIZE - THUMB_SIZE / 2, backgroundColor: hueHex },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderCurve: 'continuous' },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderCurve: 'continuous',
  },
  error: { fontSize: 13 },
  svSquare: {
    width: SV_SIZE,
    height: SV_SIZE,
    borderRadius: 14,
    borderWidth: 1,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  svThumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: '#fff',
  },
  hueBar: {
    width: HUE_SIZE,
    height: HUE_HEIGHT,
    borderRadius: HUE_HEIGHT / 2,
    borderWidth: 1,
    borderCurve: 'continuous',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  hueThumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: '#fff',
  },
});
