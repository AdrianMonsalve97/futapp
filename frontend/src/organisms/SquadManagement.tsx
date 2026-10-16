import { useSquadManagement } from "../hooks/useSquadManagement";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Avatar } from "../atoms/Avatar";
import { ConfirmAction } from "../molecules/ConfirmAction";
import { Icon } from "../atoms/Icon";
import { SearchInput } from "../molecules/SearchInput";
import { PlayerFormModal } from "./PlayerFormModal";
import { PlayersTable } from "./PlayersTable";

export function SquadManagement() {
  const {
    total,
    loading,
    error,
    reload,
    query,
    setQuery,
    pending,
    filtered,
    modalOpen,
    editing,
    actionError,
    actionNotice,
    reviewing,
    reactivatingId,
    dismissError,
    dismissNotice,
    createPlayer,
    editPlayer,
    closeEditor,
    deletePlayer,
    reactivate,
    approve,
  } = useSquadManagement();
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold">Gestión de integrantes</h2>
          <p className="text-sm text-base-content/60">
            {total} integrantes · Altas, avales y edición de cuentas del club.
          </p>
          <p className="text-xs text-base-content/50 mt-1">
            Todo el club: integrantes activos, inactivos y solicitudes de
            ingreso.
          </p>
        </div>
        <Button onClick={createPlayer}>
          <Icon name="plus" size={16} />
          Nuevo jugador
        </Button>
      </header>

      <div className="mb-4 max-w-md">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por nombre, dorsal, DNI o posición…"
        />
      </div>

      {actionError ? (
        <Alert tone="error" className="mb-4" onClose={dismissError}>
          {actionError}
        </Alert>
      ) : null}
      {actionNotice ? (
        <Alert tone="success" className="mb-4" onClose={dismissNotice}>
          {actionNotice}
        </Alert>
      ) : null}

      {pending.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-primary/30 bg-base-100 p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="font-bold text-lg">
              Solicitudes de ingreso · {pending.length}
            </h2>
            <p className="text-sm text-base-content/60">
              Revisa cada solicitud. El jugador podrá entrar a la plataforma
              después de tu aval.
            </p>
          </div>
          {pending.map((item) => (
            <div
              key={item.player.id}
              className="flex flex-wrap items-center gap-4 border-t border-base-200 pt-4"
            >
              <Avatar
                name={item.user.fullName}
                src={item.user.avatarUrl}
                size="sm"
              />
              <div className="flex-1 min-w-40">
                <p className="font-semibold">{item.user.fullName}</p>
                <p className="text-sm break-all">{item.user.email}</p>
                <p className="text-xs text-base-content/60">
                  {item.player.position} · Dorsal{" "}
                  {item.player.shirtNumber ?? "por asignar"} ·{" "}
                  {item.user.phone ?? "Sin teléfono"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="sm"
                  loading={reviewing === item.player.id}
                  disabled={reviewing !== null}
                  onClick={() => void approve(item)}
                >
                  Dar aval
                </Button>
                <ConfirmAction
                  size="sm"
                  title="Rechazar solicitud"
                  message={`Se eliminará la solicitud y la cuenta de ${item.user.fullName}. Podrá presentar un nuevo registro.`}
                  confirmLabel="Rechazar y eliminar"
                  variant="danger"
                  onConfirm={() => deletePlayer(item)}
                />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <PlayersTable
        players={filtered}
        isLoading={loading}
        error={error}
        onEdit={editPlayer}
        onDelete={deletePlayer}
        onReactivate={(item) => void reactivate(item)}
        reactivatingId={reactivatingId}
        emptyTitle={query ? "Sin resultados" : "Plantel vacío"}
        emptyMessage={
          query
            ? `No hay jugadores que coincidan con “${query}”.`
            : "Agrega el primer jugador con el botón “Nuevo jugador”."
        }
      />

      <PlayerFormModal
        open={modalOpen}
        onClose={closeEditor}
        player={editing}
        onSaved={reload}
      />
    </>
  );
}
