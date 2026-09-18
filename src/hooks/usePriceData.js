import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Cuánto dura el destello (verde/rojo) sobre la fila de PriceTable al
// cargar los datos por primera vez.
const FLASH_MS = 1500;

// Referencia estable para cuando todavía no hay datos (evita recrear un
// arreglo nuevo en cada render mientras `raw` es null).
const EMPTY_LOCATIONS = [];

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Precio promedio de menudeo (todos los lugares menos central_abastos) con
// precio no nulo; si ninguno tiene dato, cae a central_abastos.
function computeAvgPrice(product, locations) {
  const retailIds = (locations || [])
    .filter((loc) => loc.id !== "central_abastos")
    .map((loc) => loc.id);

  const values = retailIds
    .map((id) => product.prices?.[id])
    .filter((v) => typeof v === "number" && Number.isFinite(v));

  if (values.length) {
    return round2(values.reduce((sum, v) => sum + v, 0) / values.length);
  }

  const fallback = product.prices?.central_abastos;
  return typeof fallback === "number" && Number.isFinite(fallback) ? fallback : null;
}

// Variación diaria a partir de los dos últimos puntos de history
// (serie diaria de central_abastos / SNIIM). null si no hay dos puntos.
function computeChangePct(product) {
  const history = product.history;
  if (!Array.isArray(history) || history.length < 2) return null;
  const prev = history[history.length - 2]?.price;
  const curr = history[history.length - 1]?.price;
  if (
    typeof prev !== "number" ||
    typeof curr !== "number" ||
    !Number.isFinite(prev) ||
    !Number.isFinite(curr) ||
    prev === 0
  ) {
    return null;
  }
  return round2(((curr - prev) / prev) * 100);
}

async function fetchPrecios() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/precios.json`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo cargar precios.json (HTTP ${res.status})`);
  }
  return res.json();
}

export function usePriceData() {
  const [status, setStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [flashMap, setFlashMap] = useState({});
  const flashTimeoutRef = useRef(null);
  const hasFlashedRef = useRef(false);

  const load = useCallback(() => {
    hasFlashedRef.current = false;
    setStatus("loading");
    setError(null);
    fetchPrecios()
      .then((json) => {
        setRaw(json);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err);
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => clearTimeout(flashTimeoutRef.current), []);

  const locations = raw?.locations ?? EMPTY_LOCATIONS;

  const products = useMemo(() => {
    if (!raw?.products) return [];
    return raw.products.map((product) => ({
      ...product,
      avgPrice: computeAvgPrice(product, locations),
      changePct: computeChangePct(product),
      flash: flashMap[product.id] ?? null,
    }));
  }, [raw, locations, flashMap]);

  // La primera vez que los datos quedan listos, marca flash 'up'/'down' por
  // producto según el signo de su changePct, y lo limpia después de 1.5s
  // para que la animación de PriceTable ocurra al cargar.
  useEffect(() => {
    if (status !== "ready" || hasFlashedRef.current || !raw?.products) return;
    hasFlashedRef.current = true;

    const nextFlash = {};
    for (const product of raw.products) {
      const changePct = computeChangePct(product);
      if (changePct > 0) nextFlash[product.id] = "up";
      else if (changePct < 0) nextFlash[product.id] = "down";
    }

    if (Object.keys(nextFlash).length) {
      setFlashMap(nextFlash);
      flashTimeoutRef.current = setTimeout(() => setFlashMap({}), FLASH_MS);
    }
  }, [status, raw]);

  return {
    products,
    locations,
    sources: raw?.sources ?? null,
    generatedAt: raw?.generatedAt ?? null,
    loading: status === "loading",
    error: status === "error" ? error : null,
    reload: load,
  };
}
