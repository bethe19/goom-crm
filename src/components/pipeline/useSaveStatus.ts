import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Tracks the save state of a field: "saving" while the promise runs, then "saved" briefly, or "error". */
export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = async (fn: () => Promise<unknown>) => {
    clearTimeout(timer.current);
    setStatus("saving");
    try {
      await fn();
      setStatus("saved");
      timer.current = setTimeout(() => setStatus("idle"), 1600);
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  };
  return { status, run };
}
