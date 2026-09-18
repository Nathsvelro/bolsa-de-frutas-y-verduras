import { useCallback, useEffect, useState } from 'react';
import { parseNewsData } from '../data/newsUtils';

// NewsRadar se monta y desmonta al cambiar de sección o de producto; el último
// noticias.json válido se conserva a nivel de módulo para no volver a
// descargarlo en cada montaje. "Reintentar" sí vuelve a pedirlo.
let cachedData = null;

export function useNewsData() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState(() => ({ data: cachedData, loading: cachedData === null, error: false }));
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (attempt === 0 && cachedData !== null) return undefined;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setState((previous) => ({ ...previous, loading: true, error: false }));

    async function load() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/noticias.json`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = parseNewsData(await response.json());
        cachedData = data;
        if (active) setState({ data, loading: false, error: false });
      } catch {
        if (active) setState((previous) => ({ ...previous, loading: false, error: true }));
      } finally {
        clearTimeout(timeout);
      }
    }
    load();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return { ...state, reload };
}
