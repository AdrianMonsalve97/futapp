import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiBlob } from '../services/api';
export function useMediaUrl(src?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const { token } = useAuth();
  useEffect(() => {
    let cancelled = false; let objectUrl: string | null = null;
    setUrl(null);
    if (src?.startsWith('/api/media/') && token) {
      void apiBlob(src).then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
      }).catch(() => {});
    }
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, token]);
  return src?.startsWith('/api/media/') ? url : src ?? null;
}
