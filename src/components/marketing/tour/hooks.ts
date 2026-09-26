import { useEffect, useRef, useState, type RefObject } from "react";

/** Tracks the user's `prefers-reduced-motion` setting (live). */
export function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/** True while the element is at least partly on screen and the tab is visible. */
export function useInView<T extends Element>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return [ref, visible && pageVisible];
}

export type DemoStep = [delayMs: number, action: () => void];

/**
 * Runs a scripted sequence of actions (each after its delay, relative to the previous one)
 * while `enabled` is true. Pausing keeps the position; resuming continues from the next step.
 * The script runs once per mount (scenes remount when the tour changes step).
 */
export function useDemoScript(enabled: boolean, steps: DemoStep[]) {
  const index = useRef(0);
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const scheduleNext = () => {
      const step = stepsRef.current[index.current];
      if (!step) return;
      timer = window.setTimeout(() => {
        index.current += 1;
        step[1]();
        scheduleNext();
      }, step[0]);
    };
    scheduleNext();
    return () => window.clearTimeout(timer);
  }, [enabled]);
}

/** Steps that type `text` into a field one character at a time. */
export function typingSteps(text: string, set: (value: string) => void, firstDelay = 400, perChar = 55): DemoStep[] {
  return Array.from(text).map((_, i) => [i === 0 ? firstDelay : perChar, () => set(text.slice(0, i + 1))] as DemoStep);
}
