import { useEffect, useId, useState } from 'react';
import { api, errorMessage, uploadFile } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { MediaImage } from '../atoms/MediaImage';
export function ImageUpload({ endpoint, currentUrl, label, onSaved, showPreview = true }: { endpoint: string; currentUrl?: string | null; label: string; onSaved: () => void; showPreview?: boolean }) {
  const id = useId();
  const [savedUrl, setSavedUrl] = useState(currentUrl);
  useEffect(() => { setSavedUrl(currentUrl); }, [currentUrl]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const change = async (file?: File) => {
    if (!file) return;
    setError(null);
    if (file.size > 8 * 1024 * 1024) { setError('La imagen debe pesar hasta 8 MB'); return; }
    setBusy(true);
    try { const result = await uploadFile<{ url: string }>(endpoint, file); setSavedUrl(result.url); onSaved(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const clear = async () => {
    setBusy(true); setError(null);
    try { await api(endpoint, { method: 'DELETE' }); setSavedUrl(endpoint.includes('/settings/logo') ? '/brand/aag-logo.jpg' : null); onSaved(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return <div className="image-upload w-full space-y-2">
    {showPreview && savedUrl ? <MediaImage src={savedUrl} alt={label} className="h-36 w-full rounded-xl object-contain bg-black" /> : null}
    <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="file-input file-input-bordered file-input-sm w-full" onChange={e => { void change(e.target.files?.[0]); e.target.value = ''; }} />
    <p className="text-xs text-base-content/55">JPG, PNG o WEBP · hasta 8 MB. {busy ? 'Guardando…' : 'Se guarda al seleccionar la imagen.'}</p>
    {savedUrl && !savedUrl.startsWith('/brand/') ? <Button variant="ghost" size="xs" disabled={busy} onClick={() => void clear()}>Quitar imagen</Button> : null}
    {error ? <Alert tone="error">{error}</Alert> : null}
  </div>;
}
