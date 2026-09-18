// Pruebas del parser puro de SNIIM contra el fixture real
// scripts/__fixtures__/sniim-iztapalapa-14d.html. No usan red.
//
// Los valores esperados se calcularon a mano a partir del fixture (ver el
// comentario de cada prueba) y se comprobaron imprimiéndolos antes de
// escribir los asserts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSniimHtml, normalizeSniim } from './lib/sniim.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '__fixtures__', 'sniim-iztapalapa-14d.html');
const html = readFileSync(FIXTURE, 'utf-8');

test('parseSniimHtml: ventana, paginación y número de filas del fixture', () => {
  const parsed = parseSniimHtml(html);
  // `grep -c 'colspan="1">'` sobre el fixture da 720 filas de datos (las
  // filas de categoría como "Frutas"/"Hortalizas" traen colspan="9" y no
  // cuentan).
  assert.equal(parsed.rows.length, 720);
  // Span lblFecha: "Registros del 03/09/2026 al 17/09/2026".
  assert.deepEqual(parsed.window, { from: '2026-09-03', to: '2026-09-17' });
  // Span lblPaginacion: "Página  1 de  1".
  assert.deepEqual(parsed.pages, { current: 1, total: 1 });
});

test('parseSniimHtml: decodifica y normaliza el texto de las celdas', () => {
  const parsed = parseSniimHtml(html);
  const primera = parsed.rows[0];
  assert.deepEqual(primera, {
    date: '2026-09-03',
    producto: 'Aguacate Hass',
    calidad: 'Primera',
    presentacion: 'Caja de 9 kg.',
    origen: 'Michoacán',
    min: 36.67,
    max: 42.22,
    frec: 38.89,
  });
});

test('parseSniimHtml: lanza error descriptivo si falta la tabla de resultados', () => {
  assert.throws(() => parseSniimHtml('<html><body>sin tabla aquí</body></html>'), /lblFecha/);
});

test('normalizeSniim: aguacate 2026-09-17 tiene una sola fila y price 38.89', () => {
  const { rows } = parseSniimHtml(html);
  const { products } = normalizeSniim(rows);
  const punto = products.aguacate.series.find((s) => s.date === '2026-09-17');
  // Fixture, línea única para esa fecha: min 37.78, max 41.11, frec 38.89.
  assert.equal(punto.n, 1);
  assert.equal(punto.price, 38.89);
  assert.equal(punto.min, 37.78);
  assert.equal(punto.max, 41.11);
});

test('normalizeSniim: jitomate (Tomate Saladette) 2026-09-17 usa la mediana de 3 presentaciones', () => {
  const { rows } = parseSniimHtml(html);
  const { products } = normalizeSniim(rows);
  const punto = products.jitomate.series.find((s) => s.date === '2026-09-17');
  // Frec del día: Caja de 12 kg. → 30.00, Caja de 13 kg. → 21.54, Caja de 25
  // kg. → 19.20. Ordenados: [19.20, 21.54, 30.00] → mediana = 21.54.
  assert.equal(punto.n, 3);
  assert.equal(punto.price, 21.54);
  assert.equal(punto.min, 17.2);
  assert.equal(punto.max, 36.67);
  assert.equal(punto.varieties.length, 1);
  assert.equal(punto.varieties[0], 'Tomate Saladette');
  assert.equal(punto.presentations.length, 3);
});

test('normalizeSniim: la serie de un producto queda ordenada ascendente por fecha', () => {
  const { rows } = parseSniimHtml(html);
  const { products } = normalizeSniim(rows);
  const fechas = products.jitomate.series.map((s) => s.date);
  const ordenadas = [...fechas].sort();
  assert.deepEqual(fechas, ordenadas);
  assert.equal(fechas.length, 10); // 10 días con dato dentro de la ventana de 14
});

test('normalizeSniim: cilantro no aparece (sniim: null en el catálogo)', () => {
  const { rows } = parseSniimHtml(html);
  const { products } = normalizeSniim(rows);
  assert.equal('cilantro' in products, false);
});

test('normalizeSniim: todos los demás productos del catálogo con sniim configurado sí aparecen', () => {
  const { rows } = parseSniimHtml(html);
  const { products } = normalizeSniim(rows);
  // 20 productos en el catálogo, 1 (cilantro) tiene sniim: null.
  assert.equal(Object.keys(products).length, 19);
  for (const serie of Object.values(products)) {
    assert.ok(Array.isArray(serie.series));
  }
});
