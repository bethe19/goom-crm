import { useEffect, useState } from "react";
import { addDays, isSameDay, startOfDay } from "date-fns";

/**
 * "Now" for pages that bucket by day or month. The value is stable between local midnights (safe
 * as a memo dependency) and moves forward at each midnight, so a dashboard left open overnight
 * from Sep 30 to Oct 1 starts showing October. Also re-checks when the tab becomes visible again,
 * because timers can fire late after the computer sleeps.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // A second past midnight, so an early-firing timer still lands on the new day.
    const delay = startOfDay(addDays(now, 1)).getTime() - Date.now() + 1000;
    const timer = setTimeout(() => setNow(new Date()), Math.max(delay, 1000));
    const onVisible = () => {
      if (document.visibilityState === "visible" && !isSameDay(now, new Date())) setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [now]);

  return now;
}
