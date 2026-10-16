import type { PitchSlot } from "../types/tactics";
import { useState } from "react";
import { Avatar } from "../atoms/Avatar";
import { Button } from "../atoms/Button";
import { Modal } from "../atoms/Modal";
import { Spinner } from "../atoms/Spinner";

import type { PlayerListItem } from "../types/api";

export function PlayerAssignmentDialog({
  slot,
  players,
  slots,
  selectedId,
  onSelect,
  onClose,
  onAssign,
  loading,
}: {
  slot: PitchSlot;
  players: PlayerListItem[];
  slots: PitchSlot[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onAssign: () => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const key = (value: string) =>
    value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
  const filtered = players.filter((row) =>
    key(`${row.user.fullName} ${row.player.shirtNumber ?? ""}`).includes(
      key(search.trim()),
    ),
  );
  return (
    <Modal
      open
      title={`Elegir jugador · ${slot.label}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onAssign} disabled={loading}>
            Confirmar posición
          </Button>
        </>
      }
    >
      <p className="text-sm text-base-content/60 mb-4">
        Solo aparecen jugadores habilitados para el inicial. Si eliges a alguien
        que ya está en la cancha, se moverá a esta posición.
      </p>
      <label className="form-control mb-3">
        <span className="text-xs mb-1">Buscar por nombre o dorsal</span>
        <input
          type="search"
          className="input input-bordered"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </label>
      <div
        className="fc-assignment-list"
        role="group"
        aria-label="Jugador para la posición"
      >
        <button
          type="button"
          className="fc-assignment-option"
          aria-pressed={selectedId === ""}
          onClick={() => onSelect("")}
        >
          <span className="fc-assignment-number">−</span>
          <span>
            <strong>Dejar posición vacante</strong>
            <small>Sin jugador asignado</small>
          </span>
        </button>
        {loading ? (
          <Spinner />
        ) : (
          filtered.map(({ player, user }) => {
            const current = slots.find((row) => row.playerId === player.id);
            return (
              <button
                type="button"
                key={player.id}
                className="fc-assignment-option"
                aria-pressed={selectedId === String(player.id)}
                onClick={() => onSelect(String(player.id))}
              >
                <Avatar name={user.fullName} src={user.avatarUrl} size="md" />
                <span>
                  <strong>{user.fullName}</strong>
                  <small>
                    {player.position}
                    {current
                      ? ` · Actualmente en ${current.label}`
                      : " · Disponible para el inicial"}
                  </small>
                </span>
                <b className="fc-assignment-number">
                  {player.shirtNumber ?? "—"}
                </b>
              </button>
            );
          })
        )}
        {!loading && !filtered.length && (
          <p className="text-sm text-base-content/60 p-4">
            No hay jugadores habilitados con este filtro. Revisa la asistencia,
            inscripción al torneo y pagos aprobados de arbitraje.
          </p>
        )}
      </div>
    </Modal>
  );
}
