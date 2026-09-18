// Pruebas del pipeline de PROFECO usando el fixture real
// scripts/__fixtures__/profeco-cdmx-muestra.csv (600 filas, CDMX / Frutas y
// Legumbres). No usan red: el fixture se lee como stream desde disco.
//
// Las medianas de "jitomate/walmart_express" y "jitomate/bodega_aurrera" se
// calcularon a mano a partir del fixture (ver comentarios abajo) y se
// verificaron imprimiéndolas con aggregateProfeco antes de escribir estas
// aserciones.

import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { test } from 'node:test';

import { PRODUCTS, median } from './catalogo.mjs';
import { parseCsv } from './lib/csv.mjs';
import { aggregateProfeco, pickPeriods } from './lib/profeco.mjs';

const RUTA_FIXTURE = new URL('./__fixtures__/profeco-cdmx-muestra.csv', import.meta.url);

function leerFixture() {
  return createReadStream(RUTA_FIXTURE);
}

async function agregarFixture() {
  const filas = parseCsv(leerFixture());
  const { value: header } = await filas.next();
  return { header, resultado: await aggregateProfeco(filas, header) };
}

test('parseCsv lee las 600 filas de datos + el encabezado del fixture', async () => {
  let total = 0;
  let header = null;
  for await (const fila of parseCsv(leerFixture())) {
    if (!header) header = fila;
    total++;
  }
  assert.deepEqual(header, [
    'producto',
    'presentacion',
    'marca',
    'categoria',
    'catalogo',
    'precio',
    'fecha_registro',
    'cadena_comercial',
    'giro',
    'nombre_comercial',
    'direccion',
    'estado',
    'municipio',
    'latitud',
    'longitud',
  ]);
  assert.equal(total, 601); // encabezado + 600 filas de datos
  // Cada fila (incluido el encabezado) debe tener el mismo número de columnas.
  for await (const fila of parseCsv(leerFixture())) {
    assert.equal(fila.length, header.length);
  }
});

test('aggregateProfeco procesa las 600 filas del fixture (todas CDMX/Frutas y Legumbres)', async () => {
  const { resultado } = await agregarFixture();
  assert.equal(resultado.rowsRead, 600);
  assert.equal(resultado.rowsMatched, 600); // el fixture ya viene filtrado a CDMX/F&L
  assert.equal(resultado.dataDate, '2026-07-31');
  assert.equal(resultado.dataDateFrom, '2026-07-16');
});

test('aggregateProfeco: mediana correcta para jitomate/walmart_express (calculada a mano)', async () => {
  // Filas de "Jitomate" con presentacion que matchea /saladette/i y
  // cadena_comercial "Wal-mart Express" (-> walmart_express):
  //   2026/07/17  16
  //   2026/07/31  16
  // mediana = 16, min = 16, max = 16, n = 2, fecha máxima = 2026-07-31.
  const { resultado } = await agregarFixture();
  const detalle = resultado.products.jitomate.walmart_express;
  assert.deepEqual(detalle, {
    price: 16,
    min: 16,
    max: 16,
    n: 2,
    date: '2026-07-31',
    presentation: '1 Kg. Granel. Saladette/huaje o Tomate Saladette/huaje',
  });
});

test('aggregateProfeco: mediana correcta para jitomate/bodega_aurrera (calculada a mano)', async () => {
  // Filas de "Jitomate" saladette, cadena "Bodega Aurrera" (-> bodega_aurrera):
  //   2026/07/24  15
  //   2026/07/31  15
  // mediana = 15, min = 15, max = 15, n = 2, fecha máxima = 2026-07-31.
  const { resultado } = await agregarFixture();
  const detalle = resultado.products.jitomate.bodega_aurrera;
  assert.deepEqual(detalle, {
    price: 15,
    min: 15,
    max: 15,
    n: 2,
    date: '2026-07-31',
    presentation: '1 Kg. Granel. Saladette/huaje o Tomate Saladette/huaje',
  });
});

test('aggregateProfeco: mediana correcta para jitomate/soriana, agrupando varias cadenas', async () => {
  // "soriana" agrupa Hipermercado Soriana y Mega Soriana. Filas saladette:
  //   2026/07/16  24.9  (Hipermercado Soriana)
  //   2026/07/31  16    (Mega Soriana)
  // mediana = (16 + 24.9) / 2 = 20.45, min = 16, max = 24.9, fecha máxima = 2026-07-31.
  const { resultado } = await agregarFixture();
  const detalle = resultado.products.jitomate.soriana;
  assert.equal(detalle.n, 2);
  assert.equal(detalle.price, 20.45);
  assert.equal(detalle.min, 16);
  assert.equal(detalle.max, 24.9);
  assert.equal(detalle.date, '2026-07-31');
});

test('fresa: el precio queda multiplicado por 1/0.454 (canastilla de 454 g -> $/kg)', async () => {
  const { resultado } = await agregarFixture();
  const fresa = PRODUCTS.find((p) => p.id === 'fresa');
  assert.ok(fresa.profeco.kgFactor);
  assert.ok(Math.abs(fresa.profeco.kgFactor - 1 / 0.454) < 1e-12);

  // Wal-mart Express, presentación "Paquete o Canastilla 454 Gr.":
  //   2026/07/17  78
  //   2026/07/31  78
  // mediana cruda = 78; con kgFactor = 78 / 0.454.
  const detalle = resultado.products.fresa.walmart_express;
  const medianaCruda = 78;
  assert.equal(detalle.n, 2);
  assert.ok(Math.abs(detalle.price - medianaCruda * fresa.profeco.kgFactor) < 1e-9);
  assert.ok(Math.abs(detalle.min - medianaCruda * fresa.profeco.kgFactor) < 1e-9);
  // El precio queda muy por encima del crudo de $78: confirma que sí se multiplicó.
  assert.ok(detalle.price > 170 && detalle.price < 172);
});

test('chile serrano y chile jalapeño se separan de "Chile Fresco" por presentación', async () => {
  const { resultado } = await agregarFixture();

  const serrano = resultado.products.chile_serrano.walmart_express;
  const jalapeno = resultado.products.chile_jalapeno.walmart_express;

  // Filas de "Chile Fresco" / Wal-mart Express, "1 Kg. Granel. Serrano":
  //   2026/07/17  59
  //   2026/07/31  59
  assert.deepEqual(serrano, {
    price: 59,
    min: 59,
    max: 59,
    n: 2,
    date: '2026-07-31',
    presentation: '1 Kg. Granel. Serrano',
  });

  // Filas de "Chile Fresco" / Wal-mart Express, "1 Kg. Granel. Jalapeño o Cuaresmeño":
  //   2026/07/17  25
  //   2026/07/31  25
  assert.deepEqual(jalapeno, {
    price: 25,
    min: 25,
    max: 25,
    n: 2,
    date: '2026-07-31',
    presentation: '1 Kg. Granel. Jalapeño o Cuaresmeño',
  });

  // Ambos vienen del mismo `producto` de PROFECO pero son productos distintos
  // del catálogo, con presentaciones (y por tanto precios) distintas.
  assert.notEqual(serrano.presentation, jalapeno.presentation);
  assert.notEqual(serrano.price, jalapeno.price);
});

test('cadenas fuera del catálogo (p. ej. "Sumesa") no se cuentan en ningún lugar', async () => {
  const { resultado } = await agregarFixture();
  // "Sumesa" no está en profecoChains de ningún lugar de scripts/catalogo.mjs;
  // sus filas de jitomate deben quedar excluidas del conteo total.
  let totalN = 0;
  for (const detalle of Object.values(resultado.products.jitomate)) totalN += detalle.n;
  // 4 lugares con datos (la_comer, walmart_express, bodega_aurrera, soriana)
  // × 2 filas cada uno = 8; las filas de Sumesa (que también vende jitomate
  // saladette en el fixture) no deben sumarse a ningún lugar.
  assert.equal(totalN, 8);
});

test('median: función auxiliar del catálogo (par e impar)', () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('pickPeriods: 07-2026_Q2 gana a 07-2026_Q1 y a 06-2026_Q2', () => {
  const { latest, previous } = pickPeriods([
    'QQP_2026/06-2026_Q2.csv',
    'QQP_2026/07-2026_Q1.csv',
    'QQP_2026/07-2026_Q2.csv',
    'QQP_2026/', // entrada de directorio, debe ignorarse
  ]);
  assert.equal(latest, 'QQP_2026/07-2026_Q2.csv');
  assert.equal(previous, 'QQP_2026/07-2026_Q1.csv');
});

test('pickPeriods: con un solo periodo, "previous" es null', () => {
  const { latest, previous } = pickPeriods(['07-2026_Q2.csv']);
  assert.equal(latest, '07-2026_Q2.csv');
  assert.equal(previous, null);
});

test('pickPeriods: sin coincidencias, ambos son null', () => {
  assert.deepEqual(pickPeriods(['leeme.txt', 'QQP_2026/']), { latest: null, previous: null });
});
