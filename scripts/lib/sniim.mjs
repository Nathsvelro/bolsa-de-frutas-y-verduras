// Parser puro (sin red) del HTML de resultados de SNIIM y normalización por
// producto del catálogo. Ver docs/datos.md para el contrato completo.
//
// SNIIM devuelve una tabla ASPX clásica: antes de la tabla hay un enorme
// __VIEWSTATE y varias tablas de layout; dentro de la tabla de resultados,
// cada fila de datos trae 9 celdas <td class="Datos2"> y las filas que
// agrupan por categoría ("Frutas", "Hortalizas", ...) traen una sola celda
// con colspan="9", así que se descartan solas al exigir 9 celdas.

import { PRODUCTS, median, normalizeText } from '../catalogo.mjs';

// Encabezado exacto que debe tener la tabla de resultados.
const ENCABEZADO_ESPERADO = [
  'Fecha',
  'Producto',
  'Calidad',
  'Presentación',
  'Origen',
  'Precio Mín',
  'Precio Max',
  'Precio Frec',
  'Obs.',
];

// Se lanza cuando no se localiza la tabla de resultados (fila de encabezado
// "Fecha" ausente): esto es lo que fetch-sniim.mjs trata como "HTML sin
// tabla" y por lo tanto reintenta.
export class SniimSinTablaError extends Error {}

// Entidades HTML nombradas más comunes en las respuestas de SNIIM. &amp; se
// decodifica al final para no interferir con el resto (p. ej. "&amp;ntilde;"
// no debe convertirse en "ñ").
const ENTIDADES_NOMBRADAS = [
  [/&nbsp;/g, ' '],
  [/&ntilde;/g, 'ñ'],
  [/&Ntilde;/g, 'Ñ'],
  [/&aacute;/g, 'á'],
  [/&Aacute;/g, 'Á'],
  [/&eacute;/g, 'é'],
  [/&Eacute;/g, 'É'],
  [/&iacute;/g, 'í'],
  [/&Iacute;/g, 'Í'],
  [/&oacute;/g, 'ó'],
  [/&Oacute;/g, 'Ó'],
  [/&uacute;/g, 'ú'],
  [/&Uacute;/g, 'Ú'],
  [/&quot;/g, '"'],
];

function decodeEntidades(str) {
  let out = String(str)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
  for (const [re, reemplazo] of ENTIDADES_NOMBRADAS) out = out.replace(re, reemplazo);
  return out.replace(/&amp;/g, '&');
}

function quitarEtiquetas(str) {
  return String(str).replace(/<[^>]*>/g, '');
}

function textoCelda(raw) {
  return normalizeText(decodeEntidades(quitarEtiquetas(raw)));
}

function celdasDeFila(filaHtml) {
  const celdas = [];
  const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = tdRe.exec(filaHtml))) celdas.push(textoCelda(m[1]));
  return celdas;
}

// "dd/mm/aaaa" → "aaaa-mm-dd"
function fechaAIso(dd_mm_aaaa) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dd_mm_aaaa.trim());
  if (!m) throw new Error(`Fecha con formato inesperado en la tabla SNIIM: "${dd_mm_aaaa}"`);
  const [, dd, mm, aaaa] = m;
  return `${aaaa}-${mm}-${dd}`;
}

// "1,500.00" → 1500
function precioANumero(str) {
  const limpio = str.trim().replace(/,/g, '');
  const num = Number(limpio);
  if (!Number.isFinite(num)) throw new Error(`Precio con formato inesperado en la tabla SNIIM: "${str}"`);
  return num;
}

/**
 * Parser puro del HTML de resultados de SNIIM.
 * @param {string} html
 * @returns {{ window: {from: string, to: string}, pages: {current: number, total: number}, rows: Array }}
 */
export function parseSniimHtml(html) {
  const texto = String(html ?? '');

  // --- Ventana de fechas (span lblFecha) ---
  const fechaSpan = /id=["']lblFecha["'][^>]*>([\s\S]*?)<\/span>/i.exec(texto);
  if (!fechaSpan) throw new Error('No se encontró el span "lblFecha" con la ventana de fechas de SNIIM.');
  const fechaTexto = textoCelda(fechaSpan[1]);
  const fechas = fechaTexto.match(/\d{2}\/\d{2}\/\d{4}/g);
  if (!fechas || fechas.length < 2) {
    throw new Error(`No se pudo interpretar la ventana de fechas de SNIIM: "${fechaTexto}"`);
  }
  const ventana = { from: fechaAIso(fechas[0]), to: fechaAIso(fechas[1]) };

  // --- Paginación (span lblPaginacion) ---
  const pagSpan = /id=["']lblPaginacion["'][^>]*>([\s\S]*?)<\/span>/i.exec(texto);
  if (!pagSpan) throw new Error('No se encontró el span "lblPaginacion" de SNIIM.');
  const pagTexto = textoCelda(pagSpan[1]);
  const numeros = pagTexto.match(/\d+/g);
  if (!numeros || numeros.length < 2) {
    throw new Error(`No se pudo interpretar la paginación de SNIIM: "${pagTexto}"`);
  }
  const paginas = { current: Number(numeros[0]), total: Number(numeros[1]) };
  if (paginas.total > 1) {
    throw new Error(
      `SNIIM devolvió ${paginas.total} páginas de resultados (RegistrosPorPagina insuficiente); ` +
        'hay que subir RegistrosPorPagina en scripts/catalogo.mjs.',
    );
  }

  // --- Localizar la tabla por su fila de encabezado (primera celda "Fecha") ---
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  let celdasEncabezado = null;
  let finEncabezado = -1;
  while ((match = trRe.exec(texto))) {
    const celdas = celdasDeFila(match[1]);
    if (celdas.length && celdas[0] === 'Fecha') {
      celdasEncabezado = celdas;
      finEncabezado = trRe.lastIndex;
      break;
    }
  }
  if (!celdasEncabezado) {
    throw new SniimSinTablaError('No se encontró la tabla de resultados de SNIIM (fila de encabezado "Fecha" ausente).');
  }
  const encabezadoOk =
    celdasEncabezado.length === ENCABEZADO_ESPERADO.length &&
    celdasEncabezado.every((c, i) => c === ENCABEZADO_ESPERADO[i]);
  if (!encabezadoOk) {
    throw new Error(
      `Encabezado de la tabla SNIIM inesperado.\nEsperado: ${ENCABEZADO_ESPERADO.join(' | ')}\nObtenido: ${celdasEncabezado.join(' | ')}`,
    );
  }

  // --- Filas de datos: desde el fin del encabezado hasta el cierre de la tabla ---
  const finTabla = texto.slice(finEncabezado).search(/<\/table/i);
  const cuerpo = finTabla === -1 ? texto.slice(finEncabezado) : texto.slice(finEncabezado, finEncabezado + finTabla);

  const rows = [];
  let filaMatch;
  const filaRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  while ((filaMatch = filaRe.exec(cuerpo))) {
    const celdas = celdasDeFila(filaMatch[1]);
    // Las filas de categoría ("Frutas", "Hortalizas", ...) traen una sola
    // celda (colspan="9") y se descartan al exigir las 9 columnas.
    if (celdas.length !== 9) continue;
    const [fecha, producto, calidad, presentacion, origen, min, max, frec] = celdas;
    rows.push({
      date: fechaAIso(fecha),
      producto,
      calidad,
      presentacion,
      origen,
      min: precioANumero(min),
      max: precioANumero(max),
      frec: precioANumero(frec),
    });
  }

  return { window: ventana, pages: paginas, rows };
}

/**
 * Agrupa las filas ya parseadas por producto del catálogo (según
 * `sniim.match`) y por fecha, calculando la mediana de "Precio Frec", el
 * mínimo de "Precio Mín" y el máximo de "Precio Max" del día.
 * @param {Array} rows
 * @returns {{ products: Record<string, { series: Array }> }}
 */
export function normalizeSniim(rows) {
  const products = {};
  for (const producto of PRODUCTS) {
    if (!producto.sniim) continue; // sniim: null → no aparece
    const filas = rows.filter((r) => producto.sniim.match.test(r.producto));

    const porFecha = new Map();
    for (const fila of filas) {
      if (!porFecha.has(fila.date)) porFecha.set(fila.date, []);
      porFecha.get(fila.date).push(fila);
    }

    const series = [...porFecha.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, grupo]) => ({
        date,
        price: median(grupo.map((g) => g.frec)),
        min: Math.min(...grupo.map((g) => g.min)),
        max: Math.max(...grupo.map((g) => g.max)),
        n: grupo.length,
        presentations: [...new Set(grupo.map((g) => g.presentacion))],
        varieties: [...new Set(grupo.map((g) => g.producto))],
      }));

    products[producto.id] = { series };
  }
  return { products };
}
