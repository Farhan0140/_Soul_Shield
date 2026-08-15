import { Stack } from 'expo-router';

/** headerShown: false here (and belt-and-suspenders again in [taskId].tsx's
 * own Stack.Screen options, matching counter/_layout.tsx's pattern) — this
 * route builds its own custom top row instead of the native header. */
export default function TimerTaskLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[taskId]" />
    </Stack>
  );
}
