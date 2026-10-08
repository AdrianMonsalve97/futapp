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
        <p className="text-sm text-base-content/65">El arbitraje se divide entre quienes confirman asistencia. Si ya pagaste y marcas que no asistes, tu pago aprobado queda acumulado y se aplica automáticamente a tus siguientes fechas confirmadas. Si no alcanza, pagas la diferencia; si sobra, conservas el resto. El redondeo se reparte en pesos enteros.</p>
        <Alert tone="info">Confirma tu asistencia. Tu saldo acumulado aprobado se aplica sin subir otro soporte; si falta dinero, paga la diferencia y adjunta el comprobante. Para ser titular, la cuota completa debe estar cubierta por transferencias realizadas al menos 48 horas antes del partido y aprobadas. Un pago tardío aprobado permite ser suplente. Los soportes pendientes no habilitan la alineación.</Alert>
        {admin?<><div className="flex flex-wrap gap-3 text-sm"><span>Cubierto: {formatMoney(data.collected)}</span><span>En revisión: {formatMoney(data.pending)}</span><span>Saldo pendiente: {formatMoney(data.outstanding)}</span><span>A favor en esta fecha: {formatMoney(data.credits)}</span></div><div className="overflow-x-auto"><table className="table table-sm"><thead><tr><th>Jugador</th><th>Cuota</th><th>Cubierto</th><th>Saldo pendiente</th><th>Acumulado disponible</th><th>Habilitación</th></tr></thead><tbody>{data.rows.filter(row=>row.amount>0||row.paid>0||row.pending>0||row.creditTransferred>0||row.walletCredit>0).map(row=><tr key={row.playerId}><td>{row.playerName}</td><td>{formatMoney(row.amount)}</td><td>{formatMoney(row.paid)}{row.creditApplied>0?<p className="text-xs">Acumulado aplicado: {formatMoney(row.creditApplied)}</p>:null}{row.creditTransferred>0?<p className="text-xs">Aplicado a otras fechas: {formatMoney(row.creditTransferred)}</p>:null}</td><td>{formatMoney(row.outstanding)}</td><td>{formatMoney(row.walletCredit)}</td><td className={row.starterEligible?'text-success':row.benchEligible?'text-warning':'text-error'}>{labels[row.status]}</td></tr>)}</tbody></table></div><a href="/admin/pagos-qr" className="link text-primary text-sm">Revisar soportes de arbitraje</a></>:data.rows.map(row=><div key={row.playerId} className="rounded-xl border border-base-300 p-4"><p className="font-semibold">Tu cuota: {formatMoney(row.amount)}</p><p className="text-sm">{labels[row.status]}</p><p className="text-sm">Cubierto: {formatMoney(row.paid)} · pendiente: {formatMoney(row.outstanding)}</p>{row.creditApplied>0?<p className="text-sm text-success">Saldo de fechas anteriores aplicado: {formatMoney(row.creditApplied)}</p>:null}{row.creditTransferred>0?<p className="text-sm">De tu pago en esta fecha se aplicaron {formatMoney(row.creditTransferred)} a otras fechas confirmadas.</p>:null}<p className="text-sm font-semibold">Saldo acumulado disponible: {formatMoney(row.walletCredit)}</p></div>)}
      </>:<p className="text-sm">Calculando arbitraje…</p>}
    </CardBody></Card>
    {!admin?<QrPaymentPanel kind="referee" matchId={matchId} onSaved={reload} refreshKey={refreshKey}/>:null}
  </section>;
}
