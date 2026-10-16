import { useState } from "react";
import type { PitchPhase } from "../types/tactics";

export function useTacticalBoard() {
  const [phase, setPhase] = useState<PitchPhase>("estructura");
  const [focused, setFocused] = useState<number | null>(null);
  const [connections, setConnections] = useState(false);
  return {
    phase,
    setPhase,
    focused,
    setFocused,
    connections,
    setConnections,
  };
}
