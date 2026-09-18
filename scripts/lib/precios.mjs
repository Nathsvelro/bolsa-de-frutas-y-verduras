// Lógica pura (sin I/O) para construir public/data/precios.json a partir del
// catálogo y de los datos ya normalizados de SNIIM y PROFECO. Separada de
// build-precios.mjs para poder probarla con datos mínimos sin tocar disco.
// Ver docs/datos.md para el contrato completo del formato de salida.

import { LOCATIONS, PRODUCTS, SNIIM, PROFECO } from '../catalogo.mjs';

const VERSION = 1;
const HISTORY_MAX = 14;
const SNIIM_STALE_DIAS = 4;

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Fecha de hoy en America/Mexico_City como {y, m, d}.
export function hoyMexico() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const partes = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { y: Number(partes.year), m: Number(partes.month), d: Number(partes.day) };
}

export function aIso({ y, m, d }) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

// Diferencia en días de calendario entre dos fechas "AAAA-MM-DD" (b - a).
export function diasEntre(fechaA, fechaB) {
  const [ay, am, ad] = fechaA.split('-').map(Number);
  const [by, bm, bd] = fechaB.split('-').map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.round((tb - ta) / 86_400_000);
}

function fechaMaxima(productsSniim) {
  let max = null;
  for (const { series } of Object.values(productsSniim)) {
    for (const punto of series) {
      if (max === null || punto.date > max) max = punto.date;
    }
  }
  return max;
}

function construirSourceSniim(sniim, hoyIso) {
  const base = {
    id: 'sniim',
    name: SNIIM.name,
    url: SNIIM.url,
    kind: 'mayoreo',
    cadence: 'diaria',
  };
  if (!sniim || !sniim.products || fechaMaxima(sniim.products) === null) {
    return { ...base, dataDate: null, fetchedAt: sniim?.fetchedAt ?? null, status: 'error', error: 'sin datos' };
  }
  const dataDate = fechaMaxima(sniim.products);
  const atraso = diasEntre(dataDate, hoyIso);
  const status = atraso > SNIIM_STALE_DIAS ? 'stale' : 'ok';
  return { ...base, dataDate, fetchedAt: sniim.fetchedAt ?? null, status, error: null };
}

function construirSourceProfeco(profeco) {
  const base = {
    id: 'profeco',
    name: PROFECO.name,
    url: PROFECO.pageUrl,
    kind: 'menudeo',
    cadence: 'quincenal',
  };
  if (!profeco) {
    return {
      ...base,
      period: null,
      previousPeriod: null,
      dataDate: null,
      dataDateFrom: null,
      fetchedAt: null,
      status: 'error',
      error: 'sin datos',
    };
  }
  return {
    ...base,
    period: profeco.period ?? null,
    previousPeriod: profeco.previousPeriod ?? null,
    dataDate: profeco.dataDate ?? null,
    dataDateFrom: profeco.dataDateFrom ?? null,
    fetchedAt: profeco.fetchedAt ?? null,
    status: 'ok',
    error: null,
  };
}

function construirCentralAbastos(producto, sniim) {
  const series = sniim?.products?.[producto.id]?.series ?? [];
  if (!series.length) {
    const note = producto.sniim === null ? 'no comparable en Central de Abastos' : 'sin datos en Central de Abastos';
    return {
      price: null,
      prevPrice: null,
      history: [],
      detail: { source: 'sniim', note },
    };
  }
  const ultimo = series[series.length - 1];
  const anterior = series.length >= 2 ? series[series.length - 2] : null;
  return {
    price: ultimo.price,
    prevPrice: anterior ? anterior.price : null,
    history: series.slice(-HISTORY_MAX).map((p) => ({ date: p.date, price: p.price })),
    detail: {
      source: 'sniim',
      date: ultimo.date,
      variety: ultimo.varieties.join(' / '),
      presentation: ultimo.presentations.join(' / '),
      min: ultimo.min,
      max: ultimo.max,
      n: ultimo.n,
    },
  };
}

function construirProfecoLugar(producto, locationId, profeco) {
  if (!profeco) {
    return { price: null, prevPrice: null, detail: { source: 'profeco', note: 'sin datos' } };
  }
  const actual = profeco.products?.[producto.id]?.[locationId] ?? null;
  const previo = profeco.previous?.products?.[producto.id]?.[locationId] ?? null;
  const detail = actual
    ? {
        source: 'profeco',
        date: actual.date ?? null,
        period: profeco.period ?? null,
        presentation: actual.presentation ?? null,
        min: actual.min ?? null,
        max: actual.max ?? null,
        n: actual.n ?? null,
      }
    : { source: 'profeco', note: 'sin observaciones en el periodo' };
  return {
    price: actual?.price ?? null,
    prevPrice: previo?.price ?? null,
    detail,
  };
}

// Umbrales de la regla de atípicos: un precio de menudeo que se aleja tanto
// de la mediana de las otras tiendas casi siempre es un error de captura de
// PROFECO (p. ej. jalapeño a $5.70/kg cuando las demás cadenas van de $19 a
// $35). Se necesitan al menos 3 tiendas más para tener una mediana confiable.
const ATIPICO_MIN_OTRAS = 3;
const ATIPICO_FACTOR_BAJO = 0.35;
const ATIPICO_FACTOR_ALTO = 3;

function mediana(valores) {
  const nums = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

// Pone en null los precios de menudeo atípicos y lo deja anotado en detail
// (se conservan min/max/n para que el descarte sea auditable).
export function descartarAtipicos(prices, detail) {
  const retail = LOCATIONS.filter((l) => l.source === 'profeco').map((l) => l.id);
  const originales = { ...prices };
  for (const id of retail) {
    const precio = originales[id];
    if (typeof precio !== 'number') continue;
    const otros = retail.filter((o) => o !== id && typeof originales[o] === 'number').map((o) => originales[o]);
    if (otros.length < ATIPICO_MIN_OTRAS) continue;
    const med = mediana(otros);
    if (precio < med * ATIPICO_FACTOR_BAJO || precio > med * ATIPICO_FACTOR_ALTO) {
      prices[id] = null;
      detail[id] = {
        ...detail[id],
        note: `descartado como atípico: $${precio} vs mediana $${med} de otras ${otros.length} tiendas`,
      };
    }
  }
}

/**
 * Construye el objeto completo de public/data/precios.json (sin escribirlo).
 * @param {{ sniim: {products: object, fetchedAt: string|null}|null, profeco: object|null, hoy?: {y:number,m:number,d:number} }} args
 */
export function construirPrecios({ sniim, profeco, hoy = hoyMexico() }) {
  const hoyIso = aIso(hoy);

  const locations = LOCATIONS.map(({ id, name, short, tag, source }) => ({ id, name, short, tag, source }));

  const products = PRODUCTS.map((producto) => {
    const prices = {};
    const prevPrices = {};
    const detail = {};
    let history = [];

    for (const lugar of LOCATIONS) {
      if (lugar.source === 'sniim') {
        const ca = construirCentralAbastos(producto, sniim);
        prices[lugar.id] = ca.price;
        prevPrices[lugar.id] = ca.prevPrice;
        detail[lugar.id] = ca.detail;
        history = ca.history;
      } else {
        const pl = construirProfecoLugar(producto, lugar.id, profeco);
        prices[lugar.id] = pl.price;
        prevPrices[lugar.id] = pl.prevPrice;
        detail[lugar.id] = pl.detail;
      }
    }

    descartarAtipicos(prices, detail);

    return {
      id: producto.id,
      name: producto.name,
      icon: producto.icon,
      category: producto.category,
      unit: producto.unit,
      prices,
      prevPrices,
      history,
      detail,
    };
  });

  return {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    sources: {
      sniim: construirSourceSniim(sniim, hoyIso),
      profeco: construirSourceProfeco(profeco),
    },
    locations,
    products,
  };
}
