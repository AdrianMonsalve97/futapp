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
      aria-pressed={selected}
      onClick={onSelect}
      disabled={!onSelect}
      aria-label={`${slot.label}: ${slot.playerName ?? "Vacante"}${slot.shirtNumber != null ? `, dorsal ${slot.shirtNumber}` : ""}. ${TACTICAL_ROLE_NAMES[slot.role]}${slot.highlighted ? " · Tu posición" : ""}`}
    >
      <span className="fc-position-top">
        <b>
          {slot.label}
          {slot.highlighted && <small> TÚ</small>}
        </b>
        <span>{slot.shirtNumber ?? (slot.playerId ? "—" : "+")}</span>
      </span>
      <span className="fc-position-photo" aria-hidden="true">
        <Avatar
          name={slot.playerName ?? slot.label}
          src={slot.playerId != null ? slot.avatarUrl : null}
          size="sm"
        />
      </span>
      <strong>
        {slot.playerName ?? (onSelect ? "Elegir jugador" : "Vacante")}
      </strong>
      <small>{TACTICAL_ROLE_NAMES[slot.role]}</small>
    </button>
  );
}
