import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '../types/api';
import { Card, CardBody, CardTitle } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Alert } from '../atoms/Alert';
import { Icon } from '../atoms/Icon';
import { MatchMeta } from '../molecules/MatchMeta';
import { api, errorMessage } from '../services/api';

export function MatchBroadcast({ match, admin = false, onSaved, showMatchDetails = false }: {
  match: Match; admin?: boolean; onSaved?: () => void; showMatchDetails?: boolean;
}) {
  const [url, setUrl] = useState(match.streamUrl ?? '');
  const [watch, setWatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const id = match.streamUrl?.match(/^https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})$/)?.[1];

  useEffect(() => { setUrl(match.streamUrl ?? ''); setWatch(false); }, [match.id, match.streamUrl]);

  const save = async (value: string | null) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api<Match>(`/api/matches/${match.id}`, { method: 'PUT', json: { streamUrl: value } });
      setUrl(saved.streamUrl ?? ''); setWatch(false);
      setNotice(saved.streamUrl ? 'Enlace guardado. Los integrantes ya pueden abrirlo desde Transmisiones.' : 'Transmisión retirada de este partido.');
      onSaved?.();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  if (!admin && !id) return null;
  return <Card className={showMatchDetails ? '' : 'mb-5'}><CardBody>
    <CardTitle><Icon name="video" size={22} />{showMatchDetails ? `vs. ${match.opponent}` : 'Transmisión del partido'}</CardTitle>
    {showMatchDetails ? <><MatchMeta match={match} /><Link className="link text-sm" to={`/${admin ? 'admin' : 'jugador'}/partidos/${match.id}`}>Ver ficha del partido →</Link></> : null}
    {admin ? <form className="grid gap-4" onSubmit={e => { e.preventDefault(); void save(url.trim() || null); }}>
      <p className="text-sm text-base-content/65">Inicia la emisión en YouTube Live desde tu celular o software de transmisión y pega su enlace aquí. Los integrantes podrán verla dentro de la app. El enlace también puede apuntar a la grabación del partido.</p>
      <label className="grid gap-2 text-sm">Enlace de YouTube Live<Input type="url" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={e => setUrl(e.target.value)} maxLength={500} disabled={busy} /></label>
      <div className="flex flex-wrap gap-3"><Button type="submit" loading={busy} disabled={!url.trim()}>Guardar transmisión</Button>
        {match.streamUrl ? <Button variant="ghost" disabled={busy} onClick={() => void save(null)}>Quitar transmisión</Button> : null}</div>
    </form> : <p className="text-sm text-base-content/65">Sigue al equipo desde donde estés. La reproducción estará disponible cuando YouTube inicie la emisión o publique el video.</p>}
    {error ? <Alert tone="error">{error}</Alert> : null}
    {notice ? <p role="status" className="text-sm text-success">{notice}</p> : null}
    {id ? <><div className="broadcast-actions flex gap-3 flex-wrap"><Button variant="outline" onClick={() => setWatch(v => !v)} aria-expanded={watch}>{watch ? 'Cerrar reproductor' : 'Ver transmisión aquí'}</Button><a className="btn btn-ghost" href={match.streamUrl!} target="_blank" rel="noreferrer">Abrir en YouTube</a></div>
      {watch ? <iframe key={id} className="aspect-video w-full max-w-full rounded-xl border-0" src={`https://www.youtube-nocookie.com/embed/${id}`} title={`Transmisión contra ${match.opponent}`} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : null}
    </> : admin ? <p className="text-sm text-base-content/55">Este partido todavía no tiene un enlace de transmisión.</p> : null}
  </CardBody></Card>;
}
