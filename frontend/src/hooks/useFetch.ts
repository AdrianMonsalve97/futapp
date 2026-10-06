// Hook de datos: carga, recarga y estados de carga/error (SPEC §10.2).

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../services/api';

export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * `const { data, loading, error, reload } = useFetch<T>(path, deps)`.
 * Si `path` es `null` no consulta (útil para rutas con parámetro aún no listo).
 * `reload` vuelve a disparar la petición conservando los datos anteriores.
 */
export function useFetch<T>(path: string | null, deps: readonly unknown[] = []): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const prevPath = useRef<string | null>(path);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (prevPath.current !== path) {
      prevPath.current = path;
      setData(null); // evita mezclar datos de otra ruta/entidad
    }
    if (path === null) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api<T>(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `deps` controla refetch manual (filtros, identificador de entidad, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, version, ...deps]);

  return { data, loading, error, reload };
}
