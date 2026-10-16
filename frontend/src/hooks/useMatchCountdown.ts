import { useEffect, useState } from "react";
import { kickoffTime, matchClock } from "../utils/match-clock";

export function useMatchCountdown(kickOff: string, active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () => {
      setNow(Date.now());
      if (timer) clearInterval(timer);
      const kickoff = kickoffTime(kickOff);
      if (!document.hidden && Number.isFinite(kickoff) && Date.now() < kickoff)
        timer = setInterval(() => {
          setNow(Date.now());
          if (Date.now() >= kickoff && timer) {
            clearInterval(timer);
            timer = undefined;
          }
        }, 1000);
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [kickOff, active]);
  return matchClock(kickOff, now);
}
