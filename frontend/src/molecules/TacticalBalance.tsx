import type { PitchSlot } from "../types/tactics";

import { TACTICAL_ROLE_NAMES } from "./TacticalPosition";

export function TacticalBalance({ slots }: { slots: PitchSlot[] }) {
  return (
    <div className="fc-tactical-balance">
      <h4>Distribución del sistema</h4>
      {(["POR", "DEF", "MED", "DEL"] as const).map((role) => {
        const count = slots.filter((slot) => slot.role === role).length;
        return (
          <div key={role}>
            <span>{TACTICAL_ROLE_NAMES[role]}</span>
            <progress
              max={slots.length || 1}
              value={count}
              aria-label={`${count} posiciones de ${TACTICAL_ROLE_NAMES[role]}`}
            />
            <b>{count}</b>
          </div>
        );
      })}
      <small>
        Posiciones de la formación · No es una valoración de rendimiento.
      </small>
    </div>
  );
}
