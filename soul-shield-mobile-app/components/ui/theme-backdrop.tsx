import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { useAppTheme } from '@/context/theme-context';

const RULE_SPACING = 32;

/** The page behind every screen: ruled notebook paper under the Paper
 * style; under Pencil and Normal the screen keeps its plain background
 * color (the navigation theme already paints it), so nothing is drawn. */
function ThemeBackdrop() {
  const { styleTokens, palette } = useAppTheme();
  const patternId = `rule${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (styleTokens.style !== 'paper') return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.background }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={patternId} patternUnits="userSpaceOnUse" width={RULE_SPACING} height={RULE_SPACING}>
            <Line
              x1={0}
              y1={RULE_SPACING - 0.5}
              x2={RULE_SPACING}
              y2={RULE_SPACING - 0.5}
              stroke={styleTokens.ruleLine}
              strokeWidth={1}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
}

/** Passed as a navigator's `screenLayout` (see app/_layout.tsx and the
 * nested layouts) so each screen gets the active style's page backdrop
 * without any screen changing. The wrapper is always rendered — even under
 * Normal, where it's an invisible flex:1 View — so switching styles never
 * remounts screens (or resets a nested navigator's state). */
export function ThemeScreenLayout({ children }: { children: ReactNode }) {
  return (
    <View style={styles.fill}>
      <ThemeBackdrop />
      {children}
    </View>
  );
}

export const themeScreenLayout = ({ children }: { children: ReactNode }) => (
  <ThemeScreenLayout>{children}</ThemeScreenLayout>
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
