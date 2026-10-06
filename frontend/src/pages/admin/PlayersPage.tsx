import { useMemo, useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
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

  const filtered = useMemo(() => {
    const items = data ?? [];
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
      await api(`/api/players/${item.player.id}`, {
        method: 'PUT',
        json: { active: !item.user.active },
      });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Jugadores"
        subtitle={`${data?.length ?? 0} integrantes en el plantel`}
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

      <PlayersTable
        players={filtered}
        isLoading={loading}
        error={error}
        onEdit={(item) => {
          setEditing(item);
          setModalOpen(true);
        }}
        onToggleActive={(item) => void toggleActive(item)}
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
