import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type FabAction = (() => void) | null;

const FabContext = createContext<{
  action: FabAction;
  setAction: (action: FabAction) => void;
} | null>(null);

export function FabProvider({ children }: { children: ReactNode }) {
  const [action, setActionState] = useState<FabAction>(null);
  // Wrap so callers can pass a function value directly without it being
  // mistaken for a React state updater.
  const setAction = useCallback((next: FabAction) => setActionState(() => next), []);

  const value = useMemo(() => ({ action, setAction }), [action, setAction]);

  return <FabContext.Provider value={value}>{children}</FabContext.Provider>;
}

export function useFab() {
  const ctx = useContext(FabContext);
  if (!ctx) throw new Error('useFab must be used within a FabProvider');
  return ctx;
}

/** Registers `onPress` as the tab bar's floating action button while the
 * calling screen is focused, hiding it again on blur/unmount or whenever
 * `onPress` is null (e.g. a screen that only wants the FAB some of the time). */
export function useFabAction(onPress: (() => void) | null) {
  const { setAction } = useFab();
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const isActive = onPress !== null;

  useFocusEffect(
    useCallback(() => {
      if (!isActive) {
        setAction(null);
        return;
      }
      setAction(() => onPressRef.current?.());
      return () => setAction(null);
    }, [setAction, isActive])
  );
}
