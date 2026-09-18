#!/usr/bin/env node
// Descarga (o lee de SNIIM_HTML) el reporte de precios de SNIIM para la
// Central de Abasto de Iztapalapa, lo normaliza con scripts/lib/sniim.mjs y
// escribe data/sniim.json + fusiona data/sniim-historial.json.
//
// Uso:
//   node scripts/fetch-sniim.mjs                       # consulta real
//   SNIIM_HTML=ruta/archivo.html node scripts/fetch-sniim.mjs   # usa un HTML local
//
// Si algo falla: mensaje claro a stderr, exit code 1, y los archivos
// data/sniim.json y data/sniim-historial.json NO se tocan.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SNIIM } from './catalogo.mjs';
import { parseSniimHtml, normalizeSniim, SniimSinTablaError } from './lib/sniim.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..');
const RUTA_SNIIM = join(RAIZ, 'data', 'sniim.json');
const RUTA_HISTORIAL = join(RAIZ, 'data', 'sniim-historial.json');

const TIMEOUT_MS = 60_000;
const BACKOFF_MS = [2_000, 8_000, 30_000];
const HISTORIAL_DIAS = 120;

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Devuelve la fecha de hoy en America/Mexico_City como {y, m, d}. México no
// observa horario de verano, pero de todas formas resolvemos con Intl para
// no depender de la zona horaria del proceso que ejecuta el script.
function hoyMexico() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const partes = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { y: Number(partes.year), m: Number(partes.month), d: Number(partes.day) };
}

// Aritmética de días evitando líos de DST: ancla al mediodía UTC.
function sumarDias({ y, m, d }, delta) {
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function aDdMmAaaa({ y, m, d }) {
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

function aIso({ y, m, d }) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function construirUrl() {
  const hoy = hoyMexico();
  const inicio = sumarDias(hoy, -(SNIIM.diasVentana - 1));
  const params = new URLSearchParams({
    fechaInicio: aDdMmAaaa(inicio),
    fechaFinal: aDdMmAaaa(hoy),
    ProductoId: '-1',
    OrigenId: '-1',
    DestinoId: String(SNIIM.destinoId),
    PreciosPorId: String(SNIIM.preciosPorId),
    RegistrosPorPagina: String(SNIIM.registrosPorPagina),
  });
  return `${SNIIM.url}?${params.toString()}`;
}

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Error de red o HTTP 5xx: se reintenta con backoff, igual que
// SniimSinTablaError (HTML sin la tabla de resultados).
class SniimFetchError extends Error {}

async function descargarHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status >= 500) {
      throw new SniimFetchError(`SNIIM respondió HTTP ${res.status}`);
    }
    if (!res.ok) {
      // 4xx no es transitorio: no tiene sentido reintentar.
      throw new Error(`SNIIM respondió HTTP ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new SniimFetchError(`Tiempo de espera agotado (${TIMEOUT_MS} ms) consultando SNIIM`);
    }
    if (err instanceof SniimFetchError) throw err;
    // Errores de red (fetch failed, DNS, etc.) también son transitorios.
    throw new SniimFetchError(`Error de red consultando SNIIM: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function obtenerYParsear(url) {
  let ultimoError;
  for (let intento = 0; intento <= BACKOFF_MS.length; intento++) {
    try {
      const html = await descargarHtml(url);
      return parseSniimHtml(html);
    } catch (err) {
      const reintentable = err instanceof SniimFetchError || err instanceof SniimSinTablaError;
      ultimoError = err;
      if (!reintentable || intento === BACKOFF_MS.length) throw err;
      console.error(`Aviso: intento ${intento + 1} de SNIIM falló (${err.message}); reintentando…`);
      await dormir(BACKOFF_MS[intento]);
    }
  }
  throw ultimoError;
}

function leerJsonSiExiste(ruta) {
  if (!existsSync(ruta)) return null;
  const texto = readFileSync(ruta, 'utf-8');
  try {
    return JSON.parse(texto);
  } catch (err) {
    throw new Error(`No se pudo leer ${ruta} como JSON válido: ${err.message}`);
  }
}

// Fusiona `products` (salida de normalizeSniim) dentro del historial
// acumulado por producto y fecha, conservando los últimos HISTORIAL_DIAS
// días de calendario respecto a `hoy` y ordenado ascendente por fecha.
function fusionarHistorial(historialPrevio, productsNuevo, hoy) {
  const cortaEn = aIso(sumarDias(hoy, -(HISTORIAL_DIAS - 1)));
  const products = { ...(historialPrevio?.products ?? {}) };

  for (const [id, { series }] of Object.entries(productsNuevo)) {
    const porFecha = new Map((products[id]?.series ?? []).map((punto) => [punto.date, punto]));
    for (const punto of series) porFecha.set(punto.date, punto);
    const combinada = [...porFecha.values()]
      .filter((punto) => punto.date >= cortaEn)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    products[id] = { series: combinada };
  }

  return products;
}

async function main() {
  const hoy = hoyMexico();
  const url = construirUrl();

  let parsed;
  const rutaLocal = process.env.SNIIM_HTML;
  if (rutaLocal) {
    if (!existsSync(rutaLocal)) {
      throw new Error(`SNIIM_HTML apunta a un archivo que no existe: ${rutaLocal}`);
    }
    const html = readFileSync(rutaLocal, 'utf-8');
    parsed = parseSniimHtml(html);
  } else {
    parsed = await obtenerYParsear(url);
  }

  const { products } = normalizeSniim(parsed.rows);
  const productosConDatos = Object.values(products).filter((p) => p.series.length > 0);
  if (productosConDatos.length === 0) {
    throw new Error('0 productos del catálogo coincidieron con las filas de SNIIM; revisa scripts/catalogo.mjs (sniim.match).');
  }

  let dataDate = null;
  for (const { series } of Object.values(products)) {
    for (const punto of series) {
      if (dataDate === null || punto.date > dataDate) dataDate = punto.date;
    }
  }

  const fetchedAt = new Date().toISOString();
  const salidaSniim = {
    fetchedAt,
    url,
    window: parsed.window,
    dataDate,
    products,
  };

  const historialPrevio = leerJsonSiExiste(RUTA_HISTORIAL);
  const productsHistorial = fusionarHistorial(historialPrevio, products, hoy);
  const salidaHistorial = { updatedAt: fetchedAt, products: productsHistorial };

  mkdirSync(dirname(RUTA_SNIIM), { recursive: true });
  writeFileSync(RUTA_SNIIM, `${JSON.stringify(salidaSniim, null, 2)}\n`);
  writeFileSync(RUTA_HISTORIAL, `${JSON.stringify(salidaHistorial, null, 2)}\n`);

  console.log(
    `SNIIM OK: ventana ${parsed.window.from}..${parsed.window.to}, dataDate ${dataDate}, ` +
      `${productosConDatos.length}/${Object.keys(products).length} productos con datos.`,
  );
}

main().catch((err) => {
  console.error(`Error en fetch-sniim: ${err.message}`);
  process.exitCode = 1;
});
