import { useState } from 'react';
import { Card, CardBody, CardTitle } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { MediaImage } from '../atoms/MediaImage';
import { Modal } from '../atoms/Modal';
import { ImageUpload } from '../molecules/ImageUpload';
import type { Tournament } from '../types/tournament';

export function TournamentPhoto({ tournament, admin, onSaved }: { tournament: Tournament; admin: boolean; onSaved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  if (!admin && !tournament.imageUrl) return null;
  return <Card><CardBody>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><CardTitle>Foto o afiche del torneo</CardTitle><p className="text-sm text-base-content/60 mt-1">La imagen de la liga en la que va a participar el equipo.</p></div>
      {tournament.imageUrl ? <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>Ampliar foto</Button> : null}
    </div>
    {tournament.imageUrl ? <button type="button" className="w-full rounded-xl overflow-hidden bg-base-200 cursor-zoom-in" aria-label={`Ampliar foto de ${tournament.name}`} onClick={() => setExpanded(true)}>
      <MediaImage src={tournament.imageUrl} alt={`Foto del torneo ${tournament.name}`} className="w-full max-h-96 object-contain" />
    </button> : <div className="rounded-xl border border-dashed border-base-300 bg-base-200 p-8 text-center"><p className="font-semibold">Dale una imagen a esta liga</p><p className="text-sm text-base-content/60 mt-2">Sube el afiche, logo o foto que compartió el organizador.</p></div>}
    {admin ? <>
      <ImageUpload endpoint={`/api/tournaments/${tournament.id}/image`} currentUrl={tournament.imageUrl} label={tournament.imageUrl ? 'Cambiar foto del torneo' : 'Subir foto del torneo'} showPreview={false} onSaved={onSaved} />
      <p className="text-xs text-base-content/55">{tournament.status === 'borrador' ? 'Mientras sea borrador, la foto solo la ve administración. Al publicar, la verá el equipo.' : 'Esta foto está disponible para los jugadores junto con la normativa del torneo.'}</p>
    </> : null}
    {expanded && tournament.imageUrl ? <Modal open title={`Foto de ${tournament.name}`} size="lg" onClose={() => setExpanded(false)}><MediaImage src={tournament.imageUrl} alt={`Foto ampliada del torneo ${tournament.name}`} className="w-full object-contain rounded-xl bg-base-200" /></Modal> : null}
  </CardBody></Card>;
}
