import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useFetch } from '../hooks/useFetch';
import { api, apiBlob, errorMessage, uploadFile } from '../services/api';
import { PageHeader } from '../templates/PageHeader';
import { Alert } from '../atoms/Alert';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Card, CardBody } from '../atoms/Card';
import { ClubLogo } from '../atoms/ClubLogo';
import { MediaImage } from '../atoms/MediaImage';
import { TournamentPhoto } from '../organisms/TournamentPhoto';
import { TournamentRoster } from '../organisms/TournamentRoster';
import { EmptyState } from '../atoms/EmptyState';
import { Modal } from '../atoms/Modal';
import { Spinner } from '../atoms/Spinner';
import { FORMAT_LIST, formationsFor } from '../data/formations';
import type { TeamFormat } from '../types/api';
import type { Tournament, TournamentDocument, TournamentRules } from '../types/tournament';

type TournamentInput = Omit<Tournament, 'id' | 'updatedAt' | 'documents' | 'imageUrl'>;
function TournamentEditor({ current, close, saved }: { current: Tournament | null; close: () => void; saved: (row: Tournament) => void }) {
  const { settings } = useSettings();
  const [form, setForm] = useState<TournamentInput>(() => current ? { name: current.name, leagueName: current.leagueName, season: current.season, status: current.status, rules: current.rules, notes: current.notes } : {
    name: '', leagueName: '', season: settings.season, status: 'borrador', notes: '',
    rules: { format: settings.format, periods: 2, minutesPerPeriod: 0, breakMinutes: null, maxSquad: null, maxSubstitutions: null, rollingSubstitutions: null, allowedFormations: formationsFor(settings.format).map(row => row.key), tacticalStyle: 'equilibrado' },
  });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const rule = <K extends keyof TournamentRules>(key: K, value: TournamentRules[K]) => setForm(prev => ({ ...prev, rules: { ...prev.rules, [key]: value } }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try { saved(await api<Tournament>(current ? `/api/tournaments/${current.id}` : '/api/tournaments', { method: current ? 'PUT' : 'POST', json: form })); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return <Modal open onClose={close} title={current ? 'Editar torneo y normativa' : 'Nuevo torneo'} size="lg" closeOnOutside={!busy}>
    <form onSubmit={e => void submit(e)} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <p className="text-sm text-base-content/60">Confirma estos datos con el reglamento. La duración se define por torneo; un nuevo torneo comienza sin minutos asumidos.</p>
      {!current ? <p className="text-sm text-primary">Después de guardar puedes subir la foto o afiche desde la ficha del torneo.</p> : null}
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="form-control">Nombre del torneo<input required maxLength={120} className="input input-bordered w-full mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></label>
        <label className="form-control">Liga u organizador<input required maxLength={120} className="input input-bordered w-full mt-1" value={form.leagueName} onChange={e => setForm(p => ({ ...p, leagueName: e.target.value }))} /></label>
        <label>Temporada<input required maxLength={40} className="input input-bordered w-full mt-1" value={form.season} onChange={e => setForm(p => ({ ...p, season: e.target.value }))} /></label>
        <label>Visibilidad<select className="select select-bordered w-full mt-1" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Tournament['status'] }))}><option value="borrador">Borrador · solo administración</option><option value="publicado">Publicado · todos los jugadores</option><option value="archivado">Archivado · consulta histórica</option></select></label>
        <label>Jugadores en cancha<select className="select select-bordered w-full mt-1" value={form.rules.format} onChange={e => {
          const format = Number(e.target.value) as TeamFormat;
          setForm(p => ({ ...p, rules: { ...p.rules, format, maxSquad: p.rules.maxSquad === null ? null : Math.max(format, p.rules.maxSquad), allowedFormations: formationsFor(format).map(f => f.key) } }));
        }}>{FORMAT_LIST.map(p => <option key={p.format} value={p.format}>{p.name}</option>)}</select></label>
        <label>Límite de convocatoria<input type="number" min={form.rules.format} max={50} className="input input-bordered w-full mt-1" value={form.rules.maxSquad ?? ''} placeholder="Por confirmar" onChange={e => rule('maxSquad', e.target.value === '' ? null : Number(e.target.value))} /></label>
        <label>Número de tiempos<input required type="number" min={1} max={4} className="input input-bordered w-full mt-1" value={form.rules.periods} onChange={e => rule('periods', Number(e.target.value))} /></label>
        <label>Minutos por tiempo<input required type="number" min={1} max={400} className="input input-bordered w-full mt-1" value={form.rules.minutesPerPeriod || ''} placeholder="Según reglamento" onChange={e => rule('minutesPerPeriod', Number(e.target.value))} /></label>
        <label>Descanso entre tiempos (min)<input type="number" min={0} max={60} className="input input-bordered w-full mt-1" value={form.rules.breakMinutes ?? ''} placeholder="Por confirmar" onChange={e => rule('breakMinutes', e.target.value === '' ? null : Number(e.target.value))} /></label>
        <label>Límite de cambios<input type="number" min={0} max={50} className="input input-bordered w-full mt-1" value={form.rules.maxSubstitutions ?? ''} placeholder="Vacío = sin límite" onChange={e => rule('maxSubstitutions', e.target.value === '' ? null : Number(e.target.value))} /></label>
      </div>
      <div className="rounded-xl bg-primary/10 p-3"><strong>{form.rules.periods * form.rules.minutesPerPeriod} minutos de juego</strong><span className="text-sm text-base-content/60"> · {form.rules.breakMinutes === null ? 'Descanso por confirmar' : `${Math.max(0, form.rules.periods - 1) * form.rules.breakMinutes} minutos de descansos`}</span></div>
      <label className="block">Reingreso al campo<select className="select select-bordered w-full mt-1" value={form.rules.rollingSubstitutions === null ? '' : String(form.rules.rollingSubstitutions)} onChange={e => rule('rollingSubstitutions', e.target.value === '' ? null : e.target.value === 'true')}><option value="">Por confirmar con la liga</option><option value="true">Permitido</option><option value="false">No permitido</option></select></label>
      <fieldset className="space-y-2"><legend className="font-semibold text-sm">Formaciones que el entrenador quiere evaluar</legend><div className="flex flex-wrap gap-3">{formationsFor(form.rules.format).map(f => <label key={f.key} className="flex gap-2 items-center text-sm"><input type="checkbox" className="checkbox checkbox-sm" checked={form.rules.allowedFormations.includes(f.key)} onChange={e => rule('allowedFormations', e.target.checked ? [...form.rules.allowedFormations, f.key] : form.rules.allowedFormations.filter(key => key !== f.key))} />{f.key}</label>)}</div></fieldset>
      <label className="block">Enfoque táctico<select className="select select-bordered w-full mt-1" value={form.rules.tacticalStyle} onChange={e => rule('tacticalStyle', e.target.value as TournamentRules['tacticalStyle'])}><option value="equilibrado">Equilibrado</option><option value="ofensivo">Ofensivo</option><option value="defensivo">Defensivo</option></select></label>
      <label className="block">Normas adicionales e indicaciones para el equipo<textarea rows={4} maxLength={20000} className="textarea textarea-bordered w-full mt-1" value={form.notes} placeholder="Desempates, sanciones, inscripciones, edades, fechas, indicaciones tácticas…" onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></label>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={close} disabled={busy}>Cancelar</Button><Button type="submit" loading={busy}>Guardar torneo</Button></div>
    </form>
  </Modal>;
}

function DocumentCard({ document }: { document: TournamentDocument }) {
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true); setError(null);
    try {
      const blob = await apiBlob('/api/media/' + document.assetId); const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a'); a.href = url; a.download = document.fileName; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return <div className="rounded-xl border border-base-300 p-4 space-y-2">
    <div className="flex flex-wrap gap-2 justify-between items-center"><div><p className="font-bold">{document.title}</p><p className="text-xs text-base-content/55">{document.fileName}</p></div><Button size="sm" variant="outline" loading={busy} onClick={() => void download()}>Descargar original</Button></div>
    {document.extractionStatus === 'extraido' ? <details><summary className="cursor-pointer text-sm text-primary">Leer texto del documento</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-sm">{document.extractedText}</pre></details> : <p className="text-sm text-warning">Este archivo no tiene texto extraíble. Consulta el original y registra sus reglas e indicaciones en el torneo.</p>}
    {error ? <Alert tone="error">{error}</Alert> : null}
  </div>;
}

export function TournamentsPage() {
  const { user } = useAuth(); const { id } = useParams(); const navigate = useNavigate();
  const admin = user?.role === 'admin'; const base = `/${admin ? 'admin' : 'jugador'}/torneos`;
  const list = useFetch<Tournament[]>('/api/tournaments');
  const detail = useFetch<Tournament>(id ? `/api/tournaments/${id}` : null);
  const [editor, setEditor] = useState<{ current: Tournament | null } | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const { settings, save, reload: reloadSettings } = useSettings();
  useEffect(() => { setError(null); }, [id]);
  const row = detail.data;
  const upload = async (file?: File) => {
    if (!file || !row) return; setUploadBusy(true); setError(null);
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('El documento debe pesar hasta 12 MB');
      await uploadFile(`/api/tournaments/${row.id}/documents`, file); detail.reload();
    } catch (err) { setError(errorMessage(err)); } finally { setUploadBusy(false); }
  };
  const makeDefault = async () => {
    if (!row) return; setError(null);
    try { await save({ defaultTournamentId: settings.defaultTournamentId === row.id ? null : row.id }); } catch (err) { setError(errorMessage(err)); }
  };
  return <>
    <PageHeader title={row?.name ?? 'Torneos y normativa'} subtitle="La liga, sus reglas y la preparación del equipo en un mismo lugar" actions={admin ? <Button onClick={() => setEditor({ current: id && row ? row : null })}>{id && row ? 'Editar torneo' : 'Nuevo torneo'}</Button> : undefined} />
    {error ? <Alert tone="error" className="mb-4">{error}</Alert> : null}
    {id ? <>
      <Link to={base} className="link text-sm inline-block mb-4">← Todos los torneos</Link>
      {detail.loading && !row ? <Spinner /> : null}
      {detail.error ? <Alert tone="error">{detail.error}</Alert> : null}
      {row ? <div className="space-y-4">
        <section className="tournament-banner"><ClubLogo className="w-24 h-24 shrink-0" /><div><p className="hero-kicker">{row.leagueName} · {row.season}</p><h2 className="text-2xl sm:text-3xl font-black mt-2">{row.name}</h2><p className="mt-3 text-sm text-white/60">Fútbol {row.rules.format} · {row.rules.periods} tiempos de {row.rules.minutesPerPeriod} min · {row.rules.periods * row.rules.minutesPerPeriod} min de juego</p></div><Badge tone={row.status === 'publicado' ? 'success' : 'neutral'}>{row.status}</Badge></section>
        <TournamentRoster key={row.id} tournament={row} admin={admin} />
        <TournamentPhoto tournament={row} admin={admin} onSaved={() => { detail.reload(); list.reload(); }} />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 items-start">
          <Card><CardBody className="space-y-4"><h3 className="font-bold">Reglas confirmadas</h3><dl className="grid grid-cols-2 gap-3 text-sm">{[
            ['En cancha', `${row.rules.format} jugadores`], ['Convocatoria', row.rules.maxSquad === null ? 'Por confirmar' : `Hasta ${row.rules.maxSquad}`], ['Tiempo de juego', `${row.rules.periods * row.rules.minutesPerPeriod} min`], ['Descanso', row.rules.breakMinutes === null ? 'Por confirmar' : `${row.rules.breakMinutes} min entre tiempos`], ['Cambios', row.rules.maxSubstitutions ?? 'Sin límite'], ['Reingreso', row.rules.rollingSubstitutions === null ? 'Por confirmar' : row.rules.rollingSubstitutions ? 'Permitido' : 'No permitido'],
          ].map(([label,value]) => <div key={String(label)} className="rounded-lg bg-base-200 p-3"><dt className="text-xs text-base-content/60">{label}</dt><dd className="font-semibold mt-1">{value}</dd></div>)}</dl><p className="text-sm">Formaciones a evaluar: <strong>{row.rules.allowedFormations.join(' · ')}</strong></p><p className="text-sm">Enfoque: {row.rules.tacticalStyle}</p>{admin && row.status === 'publicado' ? <Button variant="outline" onClick={() => void makeDefault()}>{settings.defaultTournamentId === row.id ? 'Quitar como torneo predeterminado' : 'Usar en nuevos partidos'}</Button> : null}<p className="text-xs text-base-content/55">Cada partido conserva una copia de sus reglas. Editar este torneo se aplica a nuevos partidos o al volver a seleccionarlo en un partido pendiente.</p></CardBody></Card>
          <Card><CardBody className="space-y-3"><h3 className="font-bold">Indicaciones y documentos de la liga</h3>{row.notes ? <p className="whitespace-pre-wrap text-sm">{row.notes}</p> : <p className="text-sm text-base-content/50">Sin indicaciones adicionales.</p>}{admin ? <div className="rounded-xl bg-base-200 p-3 space-y-2"><label className="font-semibold text-sm block" htmlFor="league-document">Agregar reglamento o información del torneo</label><input id="league-document" type="file" className="file-input file-input-bordered file-input-sm w-full" disabled={uploadBusy} accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.webp" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /><p className="text-xs text-base-content/55">PDF, TXT, MD o imagen · hasta 12 MB · PDF hasta 100 páginas. {uploadBusy ? 'Leyendo y guardando…' : 'El original y el texto disponible se comparten al publicar.'}</p></div> : null}{(row.documents ?? []).map(doc => <DocumentCard key={doc.id} document={doc} />)}{!row.documents?.length ? <p className="text-sm text-base-content/50">Todavía no hay documentos.</p> : null}<p className="text-xs text-base-content/55">La IA usa las reglas confirmadas, las posiciones y el rendimiento. El texto del reglamento acompaña el análisis; no modifica las reglas automáticamente.</p></CardBody></Card>
        </div>
      </div> : null}
    </> : <>
      {list.loading ? <Spinner /> : null}{list.error ? <Alert tone="error">{list.error}</Alert> : null}
      {!list.loading && !list.error && !list.data?.length ? <EmptyState icon="clipboard" title="La próxima liga empieza aquí" message={admin ? 'Crea el torneo, confirma sus reglas y carga el reglamento para compartirlo con el equipo.' : 'Los torneos publicados por la administración aparecerán aquí.'} /> : null}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{(list.data ?? []).map(item => <Link key={item.id} to={`${base}/${item.id}`} className="tournament-card card bg-base-100 border border-base-300 hover:border-primary overflow-hidden">{item.imageUrl ? <MediaImage src={item.imageUrl} alt={`Foto del torneo ${item.name}`} className="w-full h-48 object-contain bg-base-200" /> : null}<CardBody><div className="flex justify-between items-center"><span className="text-xs uppercase tracking-wider text-primary">{item.leagueName}</span><Badge size="sm" tone={item.status === 'publicado' ? 'success' : 'neutral'}>{item.status}</Badge></div><h2 className="font-bold text-xl">{item.name}</h2><p className="text-sm text-base-content/60">{item.season} · Fútbol {item.rules.format}</p><div className="flex gap-3 mt-2 text-sm"><strong>{item.rules.periods} × {item.rules.minutesPerPeriod} min</strong><span>{item.rules.maxSquad === null ? 'Convocatoria por confirmar' : `Hasta ${item.rules.maxSquad} convocados`}</span></div><p className="text-xs mt-3 text-primary">{settings.defaultTournamentId === item.id ? 'Torneo predeterminado · ' : ''}Abrir normativa →</p></CardBody></Link>)}</div>
    </>}
    {editor ? <TournamentEditor current={editor.current} close={() => setEditor(null)} saved={saved => { setEditor(null); list.reload(); detail.reload(); reloadSettings(); navigate(`${base}/${saved.id}`); }} /> : null}
  </>;
}
