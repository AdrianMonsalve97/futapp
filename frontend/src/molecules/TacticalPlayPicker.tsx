import { useId } from "react";
import { Select } from "../atoms/Select";
import type { TacticalPlay, TacticalPlayCategory } from "../types/tactics";

const groups: { key: TacticalPlayCategory; label: string }[] = [
  { key: "salida", label: "Salida y portero" },
  { key: "asociacion", label: "Asociación y posesión" },
  { key: "finalizacion", label: "Llegada y finalización" },
  { key: "recuperacion", label: "Recuperación y transiciones" },
];

export function TacticalPlayPicker({
  plays,
  selectedId,
  onSelect,
}: {
  plays: TacticalPlay[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold">
        Biblioteca de jugadas · {plays.length}
      </label>
      <Select
        id={id}
        value={selectedId ?? ""}
        onChange={(event) => onSelect(event.target.value)}
        disabled={!plays.length}
      >
        {!plays.length && (
          <option value="">Sin jugadas para esta formación</option>
        )}
        {groups.map((group) => {
          const entries = plays.filter((play) => play.category === group.key);
          return entries.length ? (
            <optgroup
              key={group.key}
              label={`${group.label} · ${entries.length}`}
            >
              {entries.map((play) => (
                <option key={play.id} value={play.id}>
                  {play.title}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </Select>
      <p className="text-xs text-base-content/65">
        Juego asociativo: pase corto, pausa y tercer hombre. Mira antes de
        recibir, ofrece un nuevo apoyo después de pasar y acelera cuando haya
        ventaja.{" "}
        <a
          className="link"
          href="https://comofootball.com/en/fabregas-sul-futuro-da-coach-del-como-1907/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Inspiración Fàbregas
        </a>
        ; propuestas adaptadas para practicar con el entrenador.
      </p>
    </div>
  );
}
