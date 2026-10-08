import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { EmptyState } from '../../atoms/EmptyState';
import { Select } from '../../atoms/Select';
import { Spinner } from '../../atoms/Spinner';
import { Textarea } from '../../atoms/Textarea';
import { FormField } from '../../molecules/FormField';
import { StatusBadge } from '../../molecules/StatusBadge';
import { DateLabel } from '../../molecules/DateLabel';
import { Money } from '../../molecules/Money';
import { UniformCatalog } from '../../organisms/UniformCatalog';
import { UniformIssueList } from '../../organisms/UniformIssueList';
import { QrPaymentPanel } from '../../organisms/QrPaymentPanel';
import type { MeUniformsResponse, Uniform, UniformRequestCreatedResponse } from '../../types/api';

type Tab = 'mis' | 'solicitar';
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/** Mis uniformes (SPEC §10.4): pestañas "Mis uniformes" y "Solicitar". */
export function MyUniformsPage() {
  const { data, loading, error, reload } = useFetch<MeUniformsResponse>('/api/me/uniforms');
  const [tab, setTab] = useState<Tab>('mis');
  const [selected, setSelected] = useState<Uniform | null>(null);
  const [size, setSize] = useState('M');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submitRequest = async () => {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await api<UniformRequestCreatedResponse>('/api/me/uniform-requests', {
        method: 'POST',
        json: { uniformId: selected.id, size, reason: reason.trim() || undefined },
      });
      setNotice(`Solicitud enviada: ${selected.name} (talla ${size}).`);
      setSelected(null);
      setReason('');
      setSize('M');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) {
    return (
      <>
        <PageHeader title="Mis uniformes" subtitle="Prendas entregadas y solicitudes" />
        <Alert tone="error" title="No se pudo cargar la información" onClose={reload}>
          {error}
        </Alert>
      </>
    );
  }

  const issued = data?.issued ?? [];
  const requests = data?.requests ?? [];
  const catalog = (data?.catalog ?? []).filter((item) => item.active);

  return (
    <>
      <PageHeader title="Mis uniformes" subtitle="Prendas entregadas, solicitudes y catálogo del club" />
      <QrPaymentPanel kind="uniform" onSaved={reload} refreshKey={data} />

      <div role="tablist" className="tabs tabs-boxed w-fit mb-4 bg-base-200 p-1">
        <button
          type="button"
          role="tab"
          className={`tab ${tab === 'mis' ? 'tab-active' : ''}`}
          onClick={() => setTab('mis')}
        >
          Mis uniformes ({issued.length})
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${tab === 'solicitar' ? 'tab-active' : ''}`}
          onClick={() => setTab('solicitar')}
        >
          Solicitar ({requests.length})
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

      {tab === 'mis' ? (
        <UniformIssueList issues={issued} showPlayer={false} />
      ) : (
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold mb-2">Catálogo disponible</h2>
            <UniformCatalog
              uniforms={catalog}
              mode="player"
              selectLabel="Solicitar"
              onSelect={(uniform) => {
                setSelected(uniform);
                setActionError(null);
              }}
              emptyTitle="Sin prendas disponibles"
              emptyMessage="El club todavía no cargó prendas en el catálogo."
            />
          </div>

          {selected ? (
            <Card>
              <CardBody className="gap-3">
                <CardTitle className="text-base">
                  Solicitar {selected.name} · <Money value={selected.price} />
                </CardTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Talla" required>
                    <Select value={size} onChange={(event) => setSize(event.target.value)}>
                      {SIZES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Motivo" hint="¿Por qué necesitás esta prenda?">
                    <Textarea
                      rows={2}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Se me rompió la camiseta titular…"
                    />
                  </FormField>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setSelected(null)} disabled={busy}>
                    Cancelar
                  </Button>
                  <Button onClick={() => void submitRequest()} loading={busy}>
                    Enviar solicitud
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <div>
            <h2 className="font-semibold mb-2">Mis solicitudes</h2>
            {requests.length === 0 ? (
              <EmptyState
                title="Sin solicitudes"
                message="Todavía no pediste ninguna prenda."
                icon="camiseta"
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-base-200 bg-base-100">
                <table className="table table-sm">
                  <thead className="bg-base-200">
                    <tr>
                      <th>Prenda</th>
                      <th>Talla</th>
                      <th>Motivo</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Revisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr key={request.id} className="hover">
                        <td className="font-medium">{request.uniformName ?? `Uniforme #${request.uniformId}`}</td>
                        <td>{request.size}</td>
                        <td className="text-sm text-base-content/60">{request.reason ?? '—'}</td>
                        <td className="whitespace-nowrap text-sm">
                          <DateLabel value={request.createdAt} />
                        </td>
                        <td>
                          <StatusBadge status={request.status} />
                        </td>
                        <td className="text-sm text-base-content/60">{request.reviewNotes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
