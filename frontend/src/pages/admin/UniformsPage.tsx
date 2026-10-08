import { useEffect, useState } from 'react';
import { ImageUpload } from '../../molecules/ImageUpload';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage, uploadFile } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { Icon } from '../../atoms/Icon';
import { Input } from '../../atoms/Input';
import { Modal } from '../../atoms/Modal';
import { Select } from '../../atoms/Select';
import { FormField } from '../../molecules/FormField';
import { UniformCatalog } from '../../organisms/UniformCatalog';
import { UniformIssueList } from '../../organisms/UniformIssueList';
import { UniformRequestsPanel } from '../../organisms/UniformRequestsPanel';
import { UniformRecipientFields } from '../../molecules/UniformRecipientFields';
import { CHILD_SIZES,UNIFORM_SIZES,uniformKindLabel,uniformVariantLabel } from '../../utils/uniforms';
import type {
  PlayerListItem,
  Uniform,
  UniformCondition,
  UniformIssue,
  UniformKind,
  UniformRequest,
  UniformRequestStatus,
  UniformVariant,
  UniformRecipientType,
} from '../../types/api';

type Tab = 'catalogo' | 'entregas' | 'solicitudes';

interface UniformForm {
  name: string;
  kind: UniformKind;
  variant: UniformVariant;
  price: string;
  stock: string;
  minStock: string;
}

const EMPTY_UNIFORM: UniformForm = {
  name: '',
  kind: 'camiseta',
  variant: 'titular',
  price: '30000',
  stock: '10',
  minStock: '3',
};

/** Modal de alta/edición de prenda del catálogo. */
function UniformFormModal({
  open,
  onClose,
  uniform,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  uniform: Uniform | null;
  onSaved: () => void;
}) {
  const [newImage, setNewImage] = useState<File | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [form, setForm] = useState<UniformForm>({ ...EMPTY_UNIFORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNewImage(null); setCreatedId(null);
    setForm(
      uniform
        ? {
            name: uniform.name,
            kind: uniform.kind,
            variant: uniform.variant,
            price: String(uniform.price),
            stock: String(uniform.stock),
            minStock: String(uniform.minStock),
          }
        : { ...EMPTY_UNIFORM },
    );
  }, [open, uniform]);

  const submit = async () => {
    if (newImage && newImage.size > 8 * 1024 * 1024) { setError('La imagen debe pesar hasta 8 MB'); return; }
    if (!form.name.trim()) {
      setError('Ingresá el nombre de la prenda.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        kind: form.kind,
        variant: form.variant,
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
      };
      let id = uniform?.id ?? createdId;
      if (id) await api(`/api/uniforms/${id}`, { method: 'PUT', json: payload });
      else { const response = await api<Uniform>('/api/uniforms', { method: 'POST', json: payload }); id = response.id; setCreatedId(id); }
      if (newImage) {
        try { await uploadFile(`/api/uniforms/${id}/image`, newImage); }
        catch (err) { onSaved(); throw new Error(`La prenda quedó guardada. Imagen: ${errorMessage(err)}. Selecciona otra imagen y vuelve a guardar.`); }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={uniform ? `Editar · ${uniform.name}` : 'Nueva prenda'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {uniform ? 'Guardar cambios' : 'Crear prenda'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {uniform ? <ImageUpload endpoint={`/api/uniforms/${uniform.id}/image`} currentUrl={uniform.imageUrl} label="Imagen de referencia del uniforme" onSaved={onSaved} /> : <label className="block text-sm font-semibold">Imagen de referencia del uniforme<input type="file" accept="image/jpeg,image/png,image/webp" className="file-input file-input-bordered file-input-sm w-full mt-2" onChange={e => { setNewImage(e.target.files?.[0] ?? null); }} /><span className="block text-xs font-normal text-base-content/55 mt-1">Opcional · JPG, PNG o WEBP · hasta 8 MB. Se guarda al crear la prenda.</span></label>}
        <FormField label="Nombre" required>
          <Input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Camiseta local 2026"
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Tipo">
            <Select
              value={form.kind}
              onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as UniformKind }))}
            >
              <option value="camiseta">Solo camiseta</option>
              <option value="completo">Uniforme completo: camiseta, pantaloneta y medias</option>
              <option value="pantalon">Pantalón</option>
              <option value="medias">Medias</option>
              <option value="buzo">Buzo</option>
              <option value="entrenamiento">Entrenamiento</option>
              <option value="guantes">Guantes</option>
            </Select>
          </FormField>
          <FormField label="Variante">
            <Select
              value={form.variant}
              onChange={(event) => setForm((prev) => ({ ...prev, variant: event.target.value as UniformVariant }))}
            >
              <option value="titular">Local</option>
              <option value="alterna">Visitante</option>
              <option value="entrenamiento">Entrenamiento</option>
            </Select>
          </FormField>
          <FormField label="Precio">
            <Input
              type="number"
              min={0}
              step={1000}
              value={form.price}
              onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
            />
          </FormField>
          <FormField label="Stock">
            <Input
              type="number"
              min={0}
              value={form.stock}
              onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
            />
          </FormField>
          <FormField label="Stock mínimo" hint="Debajo de este valor se alerta.">
            <Input
              type="number"
              min={0}
              value={form.minStock}
              onChange={(event) => setForm((prev) => ({ ...prev, minStock: event.target.value }))}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

/** Modal de entrega de uniforme a un jugador. */
function IssueFormModal({
  open,
  onClose,
  players,
  uniforms,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  players: PlayerListItem[];
  uniforms: Uniform[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    playerId: '',
    uniformId: '',
    size: 'M',
    cost: '',
    condition: 'nuevo' as UniformCondition,
    notes: '',
    recipientType:'jugador' as UniformRecipientType,
    recipientName:'',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      playerId: players[0] ? String(players[0].player.id) : '',
      uniformId: uniforms[0] ? String(uniforms[0].id) : '',
      size: 'M',
      cost: uniforms[0] ? String(uniforms[0].price) : '',
      condition: 'nuevo',
      notes: '',
      recipientType:'jugador',
      recipientName:'',
    });
  }, [open, players, uniforms]);

  const submit = async () => {
    if (!form.playerId || !form.uniformId) {
      setError('Seleccioná jugador y prenda.');
      return;
    }
    if(form.recipientType!=='jugador'&&!form.recipientName.trim()){setError('Indica el nombre de la pareja o hijo.');return;}
    setBusy(true);
    setError(null);
    try {
      await api('/api/uniform-issues', {
        method: 'POST',
        json: {
          playerId: Number(form.playerId),
          uniformId: Number(form.uniformId),
          size: form.size,
          cost: Number(form.cost) || 0,
          condition: form.condition,
          notes: form.notes.trim() || null,
          recipientType:form.recipientType,
          recipientName:form.recipientType==='jugador'?null:form.recipientName.trim(),
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar entrega de uniforme"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            Registrar entrega
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormField label="Jugador" required>
          <Select
            value={form.playerId}
            onChange={(event) => setForm((prev) => ({ ...prev, playerId: event.target.value }))}
          >
            <option value="">— Seleccioná —</option>
            {players.map((item) => (
              <option key={item.player.id} value={item.player.id}>
                {item.player.shirtNumber ?? '—'} · {item.user.fullName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Prenda" required>
          <Select
            value={form.uniformId}
            onChange={(event) => {
              const uniform = uniforms.find((item) => String(item.id) === event.target.value);
              setForm((prev) => ({
                ...prev,
                uniformId: event.target.value,
                recipientType:'jugador',recipientName:'',size:'M',
                cost: uniform ? String(uniform.price) : prev.cost,
              }));
            }}
          >
            <option value="">— Seleccioná —</option>
            {uniforms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {uniformVariantLabel(item.variant)} · {uniformKindLabel(item.kind)} · stock {item.stock}
              </option>
            ))}
          </Select>
        </FormField>
        <UniformRecipientFields kind={uniforms.find(item=>String(item.id)===form.uniformId)?.kind??'camiseta'} recipientType={form.recipientType} recipientName={form.recipientName} onTypeChange={recipientType=>setForm(prev=>({...prev,recipientType,recipientName:'',size:recipientType==='hijo'?'8':'M'}))} onNameChange={recipientName=>setForm(prev=>({...prev,recipientName}))}/>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Talla">
            <Select value={form.size} onChange={(event) => setForm((prev) => ({ ...prev, size: event.target.value }))}>
              {(form.recipientType==='hijo'?[...CHILD_SIZES,...UNIFORM_SIZES]:UNIFORM_SIZES).map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Costo">
            <Input
              type="number"
              min={0}
              value={form.cost}
              onChange={(event) => setForm((prev) => ({ ...prev, cost: event.target.value }))}
            />
          </FormField>
          <FormField label="Condición">
            <Select
              value={form.condition}
              onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value as UniformCondition }))}
            >
              <option value="nuevo">Nuevo</option>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="danado">Dañado</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Detalle del pedido">
          <Input
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Observaciones de la entrega…"
          />
        </FormField>
      </div>
    </Modal>
  );
}

/** Uniformes (SPEC §10.4): pestañas Catálogo, Entregas y Solicitudes. */
export function UniformsPage() {
  const [tab, setTab] = useState<Tab>('catalogo');
  const uniforms = useFetch<Uniform[]>('/api/uniforms');
  const issues = useFetch<UniformIssue[]>('/api/uniform-issues');
  const requests = useFetch<UniformRequest[]>('/api/uniform-requests');
  const players = useFetch<PlayerListItem[]>('/api/players');

  const [uniformFormOpen, setUniformFormOpen] = useState(false);
  const [editingUniform, setEditingUniform] = useState<Uniform | null>(null);
  const [issueFormOpen, setIssueFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, success?: string) => {
    setActionError(null);
    setNotice(null);
    try {
      await fn();
      if (success) setNotice(success);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const deleteUniform = async (uniform: Uniform) =>
    run(async () => {
      await api(`/api/uniforms/${uniform.id}`, { method: 'DELETE' });
      uniforms.reload();
    }, `"${uniform.name}" se dio de baja del catálogo.`);

  const returnIssue = async (issue: UniformIssue) =>
    run(async () => {
      await api(`/api/uniform-issues/${issue.id}`, { method: 'PUT', json: { returned: true } });
      issues.reload();
      uniforms.reload();
    }, 'Devolución registrada. El stock volvió a sumarse.');

  const reviewRequest = (request: UniformRequest, status: UniformRequestStatus) => {
    void run(async () => {
      await api(`/api/uniform-requests/${request.id}`, { method: 'PUT', json: { status } });
      requests.reload();
      issues.reload();
      uniforms.reload();
    }, `Solicitud ${status === 'aprobada' ? 'aprobada' : status === 'rechazada' ? 'rechazada' : 'entregada'}.`);
  };

  const pendingRequests = (requests.data ?? []).filter((item) => item.status === 'pendiente').length;
  const lowStock = (uniforms.data ?? []).filter((item) => item.stock <= item.minStock);

  return (
    <>
      <PageHeader
        title="Uniformes"
        subtitle="Catálogo, entregas y solicitudes"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIssueFormOpen(true);
              }}
            >
              <Icon name="plus" size={16} />
              Registrar entrega
            </Button>
            <Button
              onClick={() => {
                setEditingUniform(null);
                setUniformFormOpen(true);
              }}
            >
              <Icon name="plus" size={16} />
              Nueva prenda
            </Button>
          </>
        }
      />

      <div role="tablist" className="tabs tabs-boxed w-fit mb-4 bg-base-200 p-1 flex-wrap">
        <button
          type="button"
          role="tab"
          className={`tab ${tab === 'catalogo' ? 'tab-active' : ''}`}
          onClick={() => setTab('catalogo')}
        >
          Catálogo ({uniforms.data?.length ?? 0})
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${tab === 'entregas' ? 'tab-active' : ''}`}
          onClick={() => setTab('entregas')}
        >
          Entregas ({issues.data?.length ?? 0})
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${tab === 'solicitudes' ? 'tab-active' : ''}`}
          onClick={() => setTab('solicitudes')}
        >
          Solicitudes{pendingRequests > 0 ? ` (${pendingRequests})` : ''}
        </button>
      </div>

      {notice ? (
        <Alert tone="success" className="mb-4" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="error" className="mb-4" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      {tab === 'catalogo' ? (
        <UniformCatalog
          uniforms={uniforms.data ?? []}
          mode="admin"
          isLoading={uniforms.loading}
          error={uniforms.error}
          onCreate={() => {
            setEditingUniform(null);
            setUniformFormOpen(true);
          }}
          onEdit={(uniform) => {
            setEditingUniform(uniform);
            setUniformFormOpen(true);
          }}
          onDelete={(uniform) => void deleteUniform(uniform)}
        />
      ) : null}

      {tab === 'entregas' ? (
        <UniformIssueList
          issues={issues.data ?? []}
          showPlayer
          isLoading={issues.loading}
          error={issues.error}
          onReturn={(issue) => void returnIssue(issue)}
        />
      ) : null}

      {tab === 'solicitudes' ? (
        <UniformRequestsPanel
          requests={requests.data ?? []}
          onReview={reviewRequest}
          isLoading={requests.loading}
          error={requests.error}
        />
      ) : null}

      {tab === 'catalogo' && lowStock.length > 0 ? (
        <Card className="mt-4">
          <CardBody>
            <CardTitle className="text-base">Reposición sugerida</CardTitle>
            <p className="text-sm text-base-content/70">
              {lowStock.map((item) => `${item.name} (${item.stock}/${item.minStock})`).join(' · ')}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <UniformFormModal
        open={uniformFormOpen}
        onClose={() => setUniformFormOpen(false)}
        uniform={editingUniform}
        onSaved={uniforms.reload}
      />

      <IssueFormModal
        open={issueFormOpen}
        onClose={() => setIssueFormOpen(false)}
        players={players.data ?? []}
        uniforms={(uniforms.data ?? []).filter((item) => item.active && item.stock > 0)}
        onSaved={() => {
          issues.reload();
          uniforms.reload();
        }}
      />
    </>
  );
}
