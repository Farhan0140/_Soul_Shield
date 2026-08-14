// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  calendar: 'event',
  'tag.fill': 'label',
  'person.fill': 'person',
  'person.crop.circle.fill': 'account-circle',
  'shield.fill': 'shield',
  'checkmark.circle.fill': 'check-circle',
  checkmark: 'check',
  circle: 'radio-button-unchecked',
  plus: 'add',
  'plus.circle.fill': 'add-circle',
  pencil: 'edit',
  trash: 'delete',
  xmark: 'close',
  'xmark.circle.fill': 'cancel',
  'rectangle.portrait.and.arrow.right': 'logout',
  sparkles: 'auto-awesome',
  'exclamationmark.triangle.fill': 'warning',
  tray: 'inbox',
  'square.grid.2x2': 'apps',
  clock: 'schedule',
  'checkmark.square': 'check-box',
  repeat: 'repeat',
  'line.3.horizontal.decrease': 'filter-list',
  'paintpalette.fill': 'palette',
  'sun.max.fill': 'light-mode',
  'moon.fill': 'dark-mode',
  'circle.fill': 'circle',
  'bell.fill': 'notifications',
  bell: 'notifications-none',
  'folder.fill': 'folder',
  'externaldrive.fill': 'storage',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'arrow.counterclockwise': 'replay',
  'iphone.radiowaves.left.and.right': 'vibration',
  'arrow.up.right.square': 'open-in-new',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
