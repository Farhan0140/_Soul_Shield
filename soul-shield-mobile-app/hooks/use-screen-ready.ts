import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

type Listenable = {
  addListener?: (event: 'transitionEnd', cb: (e: { data?: { closing?: boolean } }) => void) => () => void;
  getParent?: () => Listenable | undefined;
};

/** Longest a screen waits for its open animation to report it has finished
 * (e.g. a screen shown without an animation never reports it). */
const FALLBACK_MS = 450;

/**
 * False on a screen's first render, true once its open animation has
 * finished. A screen renders its header plus a skeleton until then and its
 * heavy content (task cards, forms, long lists, big local reads) after.
 *
 * Why: a stack screen only starts sliding in once its first render is done,
 * so rendering ten task cards (or a 90-day read) in that first render is
 * exactly the "tap, nothing happens for a moment, then the screen appears"
 * delay. With this, the screen appears on the tap and its content fills in
 * as soon as the animation ends.
 *
 * The screens under app/<group>/ open inside their group's own stack, which
 * the ROOT stack slides in - so the open animation is reported to the
 * parent's navigation, not this screen's. Both are listened to.
 */
export function useScreenReady(): boolean {
  const navigation = useNavigation() as unknown as Listenable;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    const unsubscribers: (() => void)[] = [];
    let target: Listenable | undefined = navigation;
    for (let depth = 0; target && depth < 2; depth += 1) {
      const off = target.addListener?.('transitionEnd', (e) => {
        if (!e?.data?.closing) finish();
      });
      if (off) unsubscribers.push(off);
      target = target.getParent?.();
    }
    const timer = setTimeout(finish, FALLBACK_MS);
    return () => {
      clearTimeout(timer);
      unsubscribers.forEach((off) => off());
    };
    // Once per mount: only the screen's own opening matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}
