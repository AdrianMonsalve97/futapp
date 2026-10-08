import { useFetch } from '../hooks/useFetch';
import { Card,CardBody,CardTitle } from '../atoms/Card';
import { Alert } from '../atoms/Alert';
import { QrPaymentPanel } from './QrPaymentPanel';
import { formatMoney,formatColombiaDateTime } from '../utils/format';
import type { MatchRefereeView,RefereePaymentStatus } from '../types/referee';
const labels:Record<RefereePaymentStatus,string>={sin_cobro:'Sin cobro',no_asiste:'Sin asistencia confirmada',pendiente:'Pendiente de pago',en_revision:'Soporte en revisión',a_tiempo:'Pago a tiempo · habilitado para titular',tardio:'Pago tardío · solo suplente'};
const deadline=formatColombiaDateTime;
export function RefereePaymentPanel({matchId,admin=false,onChanged,refreshKey}:{matchId:number;admin?:boolean;onChanged?:()=>void;refreshKey?:unknown}) {
  const view=useFetch<MatchRefereeView>(`/api/matches/${matchId}/referee`,[refreshKey]);
  const data=view.data;
  const reload=()=>{view.reload();onChanged?.();};
  return <section className="mb-5 min-w-0">
    <Card><CardBody className="gap-4"><CardTitle className="text-base">Arbitraje del partido</CardTitle>
      {view.error?<Alert tone="error">{view.error}</Alert>:null}
      {data?<><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-base-200 p-3"><p className="text-xs">Valor total</p><strong>{formatMoney(data.total)}</strong></div><div className="rounded-xl bg-base-200 p-3"><p className="text-xs">Asistentes confirmados</p><strong>{data.attendees}</strong></div><div className="rounded-xl bg-base-200 p-3"><p className="text-xs">Pago para poder ser titular · hora de Colombia</p><strong className="text-sm">{deadline(data.dueAt)}</strong></div></div>
        <p className="text-sm text-base-content/65">El arbitraje se divide entre quienes confirman asistencia. La cuota se actualiza si cambia la convocatoria; los abonos se conservan y los excedentes aparecen como saldo a favor. El redondeo se reparte en pesos enteros.</p>
        <Alert tone="info">Confirma tu asistencia y adjunta el soporte del pago. Para ser titular, el pago completo debe corresponder a una transferencia realizada al menos 48 horas antes del partido y estar aprobado. Un pago tardío aprobado permite ser suplente. Los soportes pendientes no habilitan la alineación.</Alert>
        {admin?<><div className="flex flex-wrap gap-3 text-sm"><span>Pagado: {formatMoney(data.collected)}</span><span>En revisión: {formatMoney(data.pending)}</span><span>Saldo pendiente: {formatMoney(data.outstanding)}</span><span>Saldos a favor: {formatMoney(data.credits)}</span></div><div className="overflow-x-auto"><table className="table table-sm"><thead><tr><th>Jugador</th><th>Cuota</th><th>Pagado</th><th>Saldo</th><th>Habilitación</th></tr></thead><tbody>{data.rows.filter(row=>row.amount>0||row.paid>0||row.pending>0).map(row=><tr key={row.playerId}><td>{row.playerName}</td><td>{formatMoney(row.amount)}</td><td>{formatMoney(row.paid)}</td><td>{formatMoney(row.outstanding)}{row.credit>0?<p className="text-xs">A favor: {formatMoney(row.credit)}</p>:null}</td><td className={row.starterEligible?'text-success':row.benchEligible?'text-warning':'text-error'}>{labels[row.status]}</td></tr>)}</tbody></table></div><a href="/admin/pagos-qr" className="link text-primary text-sm">Revisar soportes de arbitraje</a></>:data.rows.map(row=><div key={row.playerId} className="rounded-xl border border-base-300 p-4"><p className="font-semibold">Tu cuota: {formatMoney(row.amount)}</p><p className="text-sm">{labels[row.status]}</p><p className="text-sm">Pagado: {formatMoney(row.paid)} · pendiente: {formatMoney(row.outstanding)}{row.credit>0?` · saldo a favor: ${formatMoney(row.credit)}`:''}</p></div>)}
      </>:<p className="text-sm">Calculando arbitraje…</p>}
    </CardBody></Card>
    {!admin?<QrPaymentPanel kind="referee" matchId={matchId} onSaved={reload} refreshKey={refreshKey}/>:null}
  </section>;
}
