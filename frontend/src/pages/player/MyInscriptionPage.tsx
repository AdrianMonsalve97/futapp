import type { ReactNode } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Badge } from '../../atoms/Badge';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { EmptyState } from '../../atoms/EmptyState';
import { ProgressBar } from '../../atoms/ProgressBar';
import { Spinner } from '../../atoms/Spinner';
import { DateLabel } from '../../molecules/DateLabel';
import { Money } from '../../molecules/Money';
import { StatusBadge } from '../../molecules/StatusBadge';
import { QrPaymentPanel } from '../../organisms/QrPaymentPanel';
import { formatDate, formatMoney, pendingAmount } from '../../utils/format';
import type { MeInscriptionResponse } from '../../types/api';

interface SummaryItem {
  label: string;
  value: ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'info';
}

/** Fila compacta de indicadores usada en el desglose de la inscripción. */
function StatTilesRow({ items }: { items: SummaryItem[] }) {
  const toneClass: Record<NonNullable<SummaryItem['tone']>, string> = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    info: 'text-info',
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-base-200 px-3 py-2.5">
          <p className="text-xs text-base-content/60">{item.label}</p>
          <p className={`text-lg font-bold leading-tight ${toneClass[item.tone ?? 'primary']}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Mi inscripción (SPEC §10.4): estado, progreso, cuotas y pagos. */
export function MyInscriptionPage() {
  const { data, loading, error, reload } = useFetch<MeInscriptionResponse>('/api/me/inscription');

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
        <PageHeader title="Mi inscripción" subtitle="Estado de tu cuota anual" />
        <Alert tone="error" title="No se pudo cargar la inscripción" onClose={reload}>
          {error}
        </Alert>
      </>
    );
  }

  const inscription = data?.inscription ?? null;
  const payments = data?.payments ?? [];

  return (
    <>
      <PageHeader title="Mi inscripción" subtitle="Estado de tu cuota anual y movimientos" />

      {!inscription ? (
        <EmptyState
          title="Todavía no tenés una inscripción"
          message="Cuando el administrador te genere la inscripción de la temporada vas a ver el detalle y los pagos acá."
          icon="dinero"
        />
      ) : (
        <div className="space-y-4">
          {/* Estado grande */}
          <Card>
            <CardBody className="gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-base-content/60">Temporada {inscription.season}</p>
                  <p className="text-lg font-bold">{inscription.concept}</p>
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-3">
                  <StatusBadge status={inscription.status} size="lg" />
                  <Badge tone="neutral" size="sm">
                    Vence <DateLabel value={inscription.dueDate} />
                  </Badge>
                </div>
              </div>

              <ProgressBar
                value={inscription.paid}
                max={inscription.amount}
                tone={inscription.status === 'pagada' ? 'success' : 'primary'}
                showPercent
                label="Avance del pago"
                className="h-4"
              />

              <StatTilesRow
                items={[
                  { label: 'Monto total', value: <Money value={inscription.amount} />, tone: 'primary' },
                  { label: 'Pagado', value: <Money value={inscription.paid} />, tone: 'success' },
                  {
                    label: 'Pendiente',
                    value: <Money value={pendingAmount(inscription.amount, inscription.paid)} />,
                    tone: 'warning',
                  },
                  {
                    label: 'Condición de pago',
                    value:
                      inscription.status === 'pagada'
                        ? 'Al día'
                        : inscription.status === 'parcial'
                          ? 'Pago parcial'
                          : 'Pendiente',
                    tone: inscription.status === 'pagada' ? 'success' : 'warning',
                  },
                ]}
              />
            </CardBody>
          </Card>

          {/* Desglose de la cuota */}
          <QrPaymentPanel kind="inscription" onSaved={reload} refreshKey={data} />
          <Card>
            <CardBody className="gap-2">
              <CardTitle className="text-base">Desglose de la cuota</CardTitle>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <tbody>
                    <tr>
                      <td className="text-base-content/60">Concepto</td>
                      <td className="font-medium">{inscription.concept}</td>
                    </tr>
                    <tr>
                      <td className="text-base-content/60">Temporada</td>
                      <td className="font-medium">{inscription.season}</td>
                    </tr>
                    <tr>
                      <td className="text-base-content/60">Monto</td>
                      <td className="font-medium">
                        <Money value={inscription.amount} />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-base-content/60">Pagado</td>
                      <td className="font-medium text-success">
                        <Money value={inscription.paid} />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-base-content/60">Saldo</td>
                      <td className="font-medium text-warning">
                        <Money value={pendingAmount(inscription.amount, inscription.paid)} />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-base-content/60">Vencimiento</td>
                      <td className="font-medium">{formatDate(inscription.dueDate)}</td>
                    </tr>
                    {inscription.notes ? (
                      <tr>
                        <td className="text-base-content/60">Notas</td>
                        <td>{inscription.notes}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Pagos */}
          <Card>
            <CardBody className="gap-2">
              <CardTitle className="text-base">Historial de pagos</CardTitle>
              {payments.length === 0 ? (
                <EmptyState
                  title="Sin pagos registrados"
                  message="Todavía no se registró ningún pago sobre esta inscripción."
                  icon="dinero"
                />
              ) : (
                <div className="overflow-x-auto scroll-slim rounded-xl border border-base-200">
                  <table className="table table-sm">
                    <thead className="bg-base-200">
                      <tr>
                        <th>Fecha</th>
                        <th>Método</th>
                        <th>Referencia</th>
                        <th>Notas</th>
                        <th className="text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover">
                          <td className="whitespace-nowrap">{formatDate(payment.paidAt)}</td>
                          <td className="capitalize">{payment.method}</td>
                          <td className="font-mono text-sm">{payment.reference ?? '—'}</td>
                          <td className="text-sm text-base-content/60">{payment.notes ?? '—'}{payment.registeredByName && <p className="text-xs mt-1">Registrado por {payment.registeredByName}</p>}</td>
                          <td className="text-right font-semibold">
                            <Money value={payment.amount} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="font-semibold text-right">
                          Total pagado
                        </td>
                        <td className="text-right font-bold">
                          {formatMoney(
                            payments.reduce((acc, payment) => acc + payment.amount, 0),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
