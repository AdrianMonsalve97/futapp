import { useEffect, useState } from "react";

/** Playback is opt-in, stops at the end and pauses when the page is hidden. */
export function useTacticalPlayback(sequence: string, length: number) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = Math.max(0, length - 1);
  const current = Math.min(step, last);
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [sequence]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  useEffect(() => {
    if (!playing || current >= last) return;
    const timer = window.setTimeout(() => {
      setStep(current + 1);
      if (current + 1 >= last) setPlaying(false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [playing, current, last, sequence]);
  const seek = (target: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(last, target)));
  };
  const toggle = () => {
    if (length < 2) return;
    if (!playing && current >= last) setStep(0);
    setPlaying((value) => !value);
  };
  return { step: current, playing, seek, toggle };
}
