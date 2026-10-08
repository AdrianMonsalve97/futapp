import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { EmptyState } from '../atoms/EmptyState';
import { Icon } from '../atoms/Icon';
import { ProgressBar } from '../atoms/ProgressBar';
import { Spinner } from '../atoms/Spinner';
import { Money } from '../molecules/Money';
import { StatusBadge } from '../molecules/StatusBadge';
import { ConfirmAction } from '../molecules/ConfirmAction';
import { DateLabel } from '../molecules/DateLabel';
import { pendingAmount } from '../utils/format';
import type { Inscription } from '../types/api';
import { Fragment } from 'react';
import { formatDate } from '../utils/format';

export interface InscriptionsTableProps {
  items: Inscription[];
  onPay?: (inscription: Inscription) => void;
  onEdit?: (inscription: Inscription) => void;
  onDelete?: (inscription: Inscription) => void;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyMessage?: string;
}

/** Tabla de inscripciones con barra de progreso de pago y acciones de cobro. */
export function InscriptionsTable({
  items,
  onPay,
  onEdit,
  onDelete,
  isLoading = false,
  error = null,
  emptyTitle = 'Sin inscripciones',
  emptyMessage = 'No hay inscripciones registradas con los filtros aplicados.',
}: InscriptionsTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) return <Alert tone="error">No se pudieron cargar las inscripciones: {error}</Alert>;
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} icon="dinero" />;
  }

  return (
    <div className="overflow-x-auto scroll-slim rounded-xl border border-base-200 bg-base-100">
      <table className="table table-sm">
        <thead className="bg-base-200">
          <tr>
            <th>Jugador</th>
            <th>Temporada</th>
            <th>Concepto</th>
            <th className="text-right">Monto</th>
            <th className="w-48">Pagado</th>
            <th className="text-right">Pendiente</th>
            <th>Vence</th>
            <th>Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const pending = pendingAmount(item.amount, item.paid);
            const progressTone =
              item.status === 'pagada' ? 'success' : item.status === 'parcial' ? 'primary' : 'warning';
            return (
              <Fragment key={item.id}><tr className="hover">
                <td className="font-medium whitespace-nowrap">{item.playerName ?? `Jugador #${item.playerId}`}</td>
                <td>{item.season}</td>
                <td className="text-sm text-base-content/70">{item.concept}</td>
                <td className="text-right">
                  <Money value={item.amount} />
                </td>
                <td>
                  <ProgressBar
                    value={item.paid}
                    max={item.amount}
                    tone={progressTone}
                    showPercent
                    label={<Money value={item.paid} />}
                  />
                </td>
                <td className="text-right">
                  <Money
                    value={pending}
                    className={pending > 0 ? 'font-semibold text-warning' : 'text-base-content/40'}
                  />
                </td>
                <td className="whitespace-nowrap text-sm">
                  <DateLabel value={item.dueDate} />
                </td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    {onPay && item.status !== 'pagada' ? (
                      <Button size="xs" variant="primary" onClick={() => onPay(item)}>
                        <Icon name="dinero" size={14} />
                        Cobrar
                      </Button>
                    ) : null}
                    {onEdit ? (
                      <Button size="xs" variant="ghost" title="Editar inscripción" onClick={() => onEdit(item)}>
                        <Icon name="edit" size={15} />
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <ConfirmAction
                        title="Eliminar inscripción"
                        message={`Se eliminará la inscripción de ${item.playerName ?? 'este jugador'} en ${item.season} y sus pagos asociados. ¿Continuar?`}
                        confirmLabel="Eliminar"
                        size="xs"
                        variant="ghost"
                        onConfirm={() => onDelete(item)}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
              {Boolean(item.payments?.length) && <tr><td colSpan={9} className="!py-0"><details className="payment-history"><summary className="cursor-pointer text-xs text-base-content/55 py-3">Historial · {item.payments!.length} pagos</summary><div className="grid gap-2 sm:grid-cols-2 pb-4">{item.payments!.map(payment => <div className="rounded-xl bg-base-200 p-3 text-xs" key={payment.id}><div className="flex flex-wrap justify-between gap-2"><strong>{formatDate(payment.paidAt)} · {payment.method}</strong><Money value={payment.amount} /></div><p className="text-base-content/60 mt-1">Registrado por {payment.registeredByName ?? 'Sin registro histórico'} · Ref. {payment.reference ?? '—'}</p>{payment.notes && <p className="text-base-content/55 mt-1">{payment.notes}</p>}</div>)}</div></details></td></tr>}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
