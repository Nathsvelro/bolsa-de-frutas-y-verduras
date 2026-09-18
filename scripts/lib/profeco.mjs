// Agregación de precios PROFECO (QQP) por producto y lugar, y selección de
// periodos (quincenas) dentro del ZIP. Sin dependencias externas.

import { LOCATIONS, PRODUCTS, PROFECO, median, normalizeText } from '../catalogo.mjs';

const COLUMNAS_REQUERIDAS = [
  'producto',
  'presentacion',
  'precio',
  'fecha_registro',
  'cadena_comercial',
  'estado',
  'catalogo',
];

const FECHA_RE = /^(\d{4})\/(\d{2})\/(\d{2})$/;

function indiceColumnas(header) {
  const idx = {};
  header.forEach((col, i) => {
    idx[normalizeText(col).toLowerCase()] = i;
  });
  for (const nombre of COLUMNAS_REQUERIDAS) {
    if (!(nombre in idx)) {
      throw new Error(`El CSV de PROFECO no tiene la columna requerida "${nombre}"`);
    }
  }
  return idx;
}

// AAAA/MM/DD -> AAAA-MM-DD (o null si el formato no es el esperado).
function normalizarFecha(valor) {
  const m = FECHA_RE.exec(String(valor ?? '').trim());
  if (!m) return null;
  const [, anio, mes, dia] = m;
  return `${anio}-${mes}-${dia}`;
}

// cadena_comercial (valor exacto de PROFECO) -> id del lugar del catálogo.
function mapaCadenas() {
  const mapa = new Map();
  for (const loc of LOCATIONS) {
    if (loc.source !== 'profeco' || !loc.profecoChains) continue;
    for (const cadena of loc.profecoChains) {
      mapa.set(normalizeText(cadena), loc.id);
    }
  }
  return mapa;
}

// Elemento más frecuente de un Map<valor, conteo>; en empate gana el que
// apareció primero (orden de inserción del Map).
function masFrecuente(conteos) {
  let mejor = null;
  let mejorConteo = -1;
  for (const [valor, n] of conteos) {
    if (n > mejorConteo) {
      mejor = valor;
      mejorConteo = n;
    }
  }
  return mejor;
}

/**
 * Agrega las filas (ya sin el encabezado) del CSV de PROFECO por producto y
 * lugar, según el catálogo compartido.
 *
 * @param {AsyncIterable<string[]>|Iterable<string[]>} rows filas de datos
 *   (arreglos de strings), sin incluir la fila de encabezado.
 * @param {string[]} header fila de encabezado del CSV.
 * @returns {Promise<{
 *   dataDate: string|null,
 *   dataDateFrom: string|null,
 *   products: Record<string, Record<string, {
 *     price: number, min: number, max: number, n: number,
 *     date: string, presentation: string|null,
 *   }>>,
 *   rowsRead: number,
 *   rowsMatched: number,
 * }>}
 */
export async function aggregateProfeco(rows, header) {
  const idx = indiceColumnas(header);
  const cadenaALugar = mapaCadenas();
  const estadoObjetivo = normalizeText(PROFECO.estado);
  const catalogoObjetivo = normalizeText(PROFECO.catalogo);

  // productos con presencia en PROFECO, agrupados por su `producto` exacto
  // (varios productos del catálogo, como los dos chiles, pueden compartir el
  // mismo `producto` de PROFECO y separarse solo por `presentacion`).
  const productosPorNombre = new Map();
  for (const p of PRODUCTS) {
    if (!p.profeco) continue;
    const nombre = normalizeText(p.profeco.producto);
    if (!productosPorNombre.has(nombre)) productosPorNombre.set(nombre, []);
    productosPorNombre.get(nombre).push(p);
  }

  // acumuladores[productId][locationId] = { precios, fechaMax, presentaciones }
  const acumuladores = new Map();
  for (const p of PRODUCTS) {
    if (p.profeco) acumuladores.set(p.id, new Map());
  }

  let rowsRead = 0;
  let rowsMatched = 0;
  let dataDate = null;
  let dataDateFrom = null;

  for await (const row of rows) {
    rowsRead++;
    if (normalizeText(row[idx.estado]) !== estadoObjetivo) continue;
    if (normalizeText(row[idx.catalogo]) !== catalogoObjetivo) continue;

    const fecha = normalizarFecha(row[idx.fecha_registro]);
    if (!fecha) continue;
    rowsMatched++;

    if (dataDate === null || fecha > dataDate) dataDate = fecha;
    if (dataDateFrom === null || fecha < dataDateFrom) dataDateFrom = fecha;

    const lugarId = cadenaALugar.get(normalizeText(row[idx.cadena_comercial]));
    if (!lugarId) continue; // cadena sin lugar en el catálogo (p. ej. otra tienda)

    const candidatos = productosPorNombre.get(normalizeText(row[idx.producto]));
    if (!candidatos) continue;

    const presentacionCruda = row[idx.presentacion] ?? '';
    const presentacionNorm = normalizeText(presentacionCruda);
    const precioBase = Number(row[idx.precio]);
    if (!Number.isFinite(precioBase)) continue;

    for (const producto of candidatos) {
      if (!producto.profeco.presentacion.test(presentacionNorm)) continue;
      const precio = precioBase * (producto.profeco.kgFactor ?? 1);

      const porLugar = acumuladores.get(producto.id);
      let acc = porLugar.get(lugarId);
      if (!acc) {
        acc = { precios: [], fechaMax: fecha, presentaciones: new Map() };
        porLugar.set(lugarId, acc);
      }
      acc.precios.push(precio);
      if (fecha > acc.fechaMax) acc.fechaMax = fecha;
      acc.presentaciones.set(
        presentacionNorm,
        (acc.presentaciones.get(presentacionNorm) ?? 0) + 1,
      );
    }
  }

  const products = {};
  for (const [productId, porLugar] of acumuladores) {
    const detalle = {};
    for (const [lugarId, acc] of porLugar) {
      if (!acc.precios.length) continue;
      detalle[lugarId] = {
        price: median(acc.precios),
        min: Math.min(...acc.precios),
        max: Math.max(...acc.precios),
        n: acc.precios.length,
        date: acc.fechaMax,
        presentation: masFrecuente(acc.presentaciones),
      };
    }
    if (Object.keys(detalle).length) products[productId] = detalle;
  }

  return { dataDate, dataDateFrom, products, rowsRead, rowsMatched };
}

const PATRON_PERIODO = /(\d{2})-(\d{4})_Q(\d+)(?:\.csv)?$/i;

// Extrae { year, month, quincena, label } de un nombre de archivo o ruta
// dentro del ZIP (p. ej. "QQP_2026/07-2026_Q2.csv"); null si no coincide.
export function parsePeriodo(nombre) {
  const base = String(nombre).split('/').pop();
  const m = PATRON_PERIODO.exec(base);
  if (!m) return null;
  const [, mes, anio, quincena] = m;
  return {
    year: Number(anio),
    month: Number(mes),
    quincena: Number(quincena),
    label: `${mes}-${anio}_Q${quincena}`,
  };
}

/**
 * Elige, de una lista de nombres de archivo dentro del ZIP, el periodo más
 * reciente y el inmediato anterior, comparando (año, mes, quincena).
 *
 * @param {string[]} nombresDeArchivoEnZip
 * @returns {{ latest: string|null, previous: string|null }}
 */
export function pickPeriods(nombresDeArchivoEnZip) {
  const candidatos = [];
  for (const nombre of nombresDeArchivoEnZip) {
    const periodo = parsePeriodo(nombre);
    if (periodo) candidatos.push({ nombre, periodo });
  }
  candidatos.sort((a, b) => {
    if (a.periodo.year !== b.periodo.year) return b.periodo.year - a.periodo.year;
    if (a.periodo.month !== b.periodo.month) return b.periodo.month - a.periodo.month;
    return b.periodo.quincena - a.periodo.quincena;
  });
  return {
    latest: candidatos[0]?.nombre ?? null,
    previous: candidatos[1]?.nombre ?? null,
  };
}
