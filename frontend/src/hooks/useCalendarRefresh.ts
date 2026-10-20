import { useEffect, useState } from "react";

/** Keep visible calendars current, without polling in a hidden tab. */
export function useCalendarRefresh(reload: () => void) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      setNow(Date.now());
      reload();
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);
  return now;
}
