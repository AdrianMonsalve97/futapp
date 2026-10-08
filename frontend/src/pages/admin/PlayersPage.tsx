import { useMemo, useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
import { Avatar } from '../../atoms/Avatar';
import { ConfirmAction } from '../../molecules/ConfirmAction';
import { Icon } from '../../atoms/Icon';
import { SearchInput } from '../../molecules/SearchInput';
import { PlayerFormModal } from '../../organisms/PlayerFormModal';
import { PlayersTable } from '../../organisms/PlayersTable';
import type { PlayerListItem } from '../../types/api';

/** Jugadores (SPEC §10.4): buscador, tabla del plantel y alta/edición/baja. */
export function PlayersPage() {
  const { data, loading, error, reload } = useFetch<PlayerListItem[]>('/api/players');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reactivatingId,setReactivatingId] = useState<number|null>(null);
  const pending = (data ?? []).filter(item => item.pendingApproval);

  const filtered = useMemo(() => {
    const items = (data ?? []).filter(item => !item.pendingApproval);
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const haystack = [
        item.user.fullName,
        item.user.email,
        String(item.player.shirtNumber ?? ''),
        item.player.position,
        item.player.dni ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data, query]);

  const toggleActive = async (item: PlayerListItem) => {
    setActionError(null);
    try {
      const result = await api<{ok:true;filesPending:boolean}>(`/api/players/${item.player.id}`, {
        method: 'DELETE',
      });
      setActionNotice(result.filesPending ? 'Jugador eliminado. La limpieza de algunos archivos privados sigue pendiente y se reintentará automáticamente.' : 'Jugador eliminado junto con sus datos vinculados.');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const reactivate = async (item: PlayerListItem) => {
    if(item.user.active||item.pendingApproval||reactivatingId!==null)return;
    setReactivatingId(item.player.id);setActionError(null);setActionNotice(null);
    try {
      await api(`/api/players/${item.player.id}`,{method:'PUT',json:{active:true}});
      setActionNotice('Jugador reactivado. Conserva sus datos y puede volver a iniciar sesión con su contraseña.');
      reload();
    } catch(err) {setActionError(errorMessage(err));} finally {setReactivatingId(null);}
  };

  const approve = async (item: PlayerListItem) => {
    setReviewing(item.player.id); setActionError(null);
    try { await api(`/api/players/${item.player.id}/approval`, {method:'POST',json:{}}); reload(); }
    catch (err) { setActionError(errorMessage(err)); } finally { setReviewing(null); }
  };

  return (
    <>
      <PageHeader
        title="Jugadores"
        subtitle={`${(data ?? []).filter(item => !item.pendingApproval).length} integrantes en el plantel`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Icon name="plus" size={16} />
            Nuevo jugador
          </Button>
        }
      />

      <div className="mb-4 max-w-md">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por nombre, dorsal, DNI o posición…"
        />
      </div>

      {actionError ? (
        <Alert tone="error" className="mb-4" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}
      {actionNotice ? <Alert tone="success" className="mb-4" onClose={()=>setActionNotice(null)}>{actionNotice}</Alert> : null}

      {pending.length > 0 ? <section className="mb-6 rounded-2xl border border-primary/30 bg-base-100 p-4 sm:p-6 space-y-4">
        <div><h2 className="font-bold text-lg">Solicitudes de ingreso · {pending.length}</h2><p className="text-sm text-base-content/60">Revisa cada solicitud. El jugador podrá entrar a la plataforma después de tu aval.</p></div>
        {pending.map(item => <div key={item.player.id} className="flex flex-wrap items-center gap-4 border-t border-base-200 pt-4">
          <Avatar name={item.user.fullName} src={item.user.avatarUrl} size="sm" />
          <div className="flex-1 min-w-40"><p className="font-semibold">{item.user.fullName}</p><p className="text-sm break-all">{item.user.email}</p><p className="text-xs text-base-content/60">{item.player.position} · Dorsal {item.player.shirtNumber ?? 'por asignar'} · {item.user.phone ?? 'Sin teléfono'}</p></div>
          <div className="flex flex-wrap gap-3"><Button size="sm" loading={reviewing===item.player.id} disabled={reviewing!==null} onClick={() => void approve(item)}>Dar aval</Button>
            <ConfirmAction size="sm" title="Rechazar solicitud" message={`Se eliminará la solicitud y la cuenta de ${item.user.fullName}. Podrá presentar un nuevo registro.`} confirmLabel="Rechazar y eliminar" variant="danger" onConfirm={() => toggleActive(item)} />
          </div>
        </div>)}
      </section> : null}

      <PlayersTable
        players={filtered}
        isLoading={loading}
        error={error}
        onEdit={(item) => {
          setEditing(item);
          setModalOpen(true);
        }}
        onToggleActive={(item) => void toggleActive(item)}
        onReactivate={(item) => void reactivate(item)}
        reactivatingId={reactivatingId}
        emptyTitle={query ? 'Sin resultados' : 'Plantel vacío'}
        emptyMessage={
          query
            ? `No hay jugadores que coincidan con “${query}”.`
            : 'Cargá el primer jugador con el botón “Nuevo jugador”.'
        }
      />

      <PlayerFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        player={editing}
        onSaved={reload}
      />
    </>
  );
}
