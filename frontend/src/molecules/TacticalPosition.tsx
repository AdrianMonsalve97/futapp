import { RefereePendingDot } from "../atoms/RefereePendingDot";
import { Avatar } from "../atoms/Avatar";
import type { PitchSlot } from "../types/tactics";

export const TACTICAL_ROLE_NAMES = {
  POR: "Guardameta",
  DEF: "Defensa",
  MED: "Mediocampo",
  DEL: "Ataque",
};
export function TacticalPosition({
  slot,
  selected,
  onSelect,
}: {
  slot: PitchSlot;
  selected: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      className="fc-position"
      data-role={slot.role}
      data-empty={slot.playerId == null}
      data-own={slot.highlighted === true}
      title={`${slot.playerName ?? "Vacante"} · ${slot.label} · ${TACTICAL_ROLE_NAMES[slot.role]}`}
      aria-pressed={selected}
      onClick={onSelect}
      disabled={!onSelect}
      aria-label={`${slot.label}: ${slot.playerName ?? "Vacante"}${slot.shirtNumber != null ? `, dorsal ${slot.shirtNumber}` : ""}. ${TACTICAL_ROLE_NAMES[slot.role]}${slot.highlighted ? " · Tu posición" : ""}${slot.refereePaymentPending && slot.playerId != null ? ", arbitraje pendiente de pago aprobado" : ""}`}
    >
      {slot.refereePaymentPending && slot.playerId != null && (
        <RefereePendingDot />
      )}
      <span className="fc-position-top">
        <b>{slot.label}</b>
        <span
          title={
            slot.shirtNumber != null ? `Dorsal ${slot.shirtNumber}` : undefined
          }
        >
          {slot.shirtNumber ?? (slot.playerId ? "—" : "+")}
        </span>
      </span>
      <span className="fc-position-photo" aria-hidden="true">
        <Avatar
          key={slot.playerId ?? "vacante"}
          name={slot.playerName ?? slot.label}
          src={slot.playerId != null ? slot.avatarUrl : null}
          size="lg"
          className="fc-position-portrait"
        />
      </span>
      <strong>
        {slot.playerName ?? (onSelect ? "Elegir jugador" : "Vacante")}
      </strong>
    </button>
  );
}
