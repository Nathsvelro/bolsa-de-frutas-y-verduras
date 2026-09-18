// Pruebas de scripts/lib/precios.mjs (función pura construirPrecios) y de
// scripts/build-precios.mjs como proceso completo, con datos mínimos
// escritos en un directorio temporal (las rutas se parametrizan con
// variables de entorno: ver "Uso" en build-precios.mjs). No usan red.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construirPrecios } from './lib/precios.mjs';
import { LOCATIONS, PRODUCTS } from './catalogo.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCATION_IDS = LOCATIONS.map((l) => l.id).sort();

const sniimMinimo = {
  fetchedAt: '2026-09-17T12:00:00.000Z',
  products: {
    jitomate: {
      series: [
        { date: '2026-09-16', price: 20, min: 18, max: 22, n: 2, presentations: ['Caja de 12 kg.'], varieties: ['Tomate Saladette'] },
        { date: '2026-09-17', price: 21, min: 19, max: 23, n: 2, presentations: ['Caja de 12 kg.'], varieties: ['Tomate Saladette'] },
      ],
    },
    // "papa" tiene sniim configurado en el catálogo pero sin filas en esta
    // corrida mínima: debe quedar en null con nota "sin datos", distinta de
    // la nota de cilantro (que es null porque no es comparable).
    papa: { series: [] },
  },
};

const profecoMinimo = {
  fetchedAt: '2026-09-01T12:00:00.000Z',
  zipUrl: 'https://datos.profeco.gob.mx/datos_abiertos/file.php?t=x',
  period: '07-2026_Q2',
  previousPeriod: '07-2026_Q1',
  dataDate: '2026-07-31',
  dataDateFrom: '2026-07-16',
  products: {
    jitomate: {
      walmart: { price: 25.9, min: 19.9, max: 29.9, n: 12, date: '2026-07-30', presentation: '1 Kg. Granel. Saladette' },
    },
  },
  previous: {
    period: '07-2026_Q1',
    dataDate: '2026-07-15',
    dataDateFrom: '2026-07-01',
    products: {
      jitomate: {
        walmart: { price: 24.5, min: 18.9, max: 28.9, n: 10, date: '2026-07-14', presentation: '1 Kg. Granel. Saladette' },
      },
    },
  },
};

const HOY = { y: 2026, m: 9, d: 17 };

test('construirPrecios: forma general del documento', () => {
  const doc = construirPrecios({ sniim: sniimMinimo, profeco: profecoMinimo, hoy: HOY });
  assert.equal(doc.version, 1);
  assert.equal(typeof doc.generatedAt, 'string');
  assert.equal(doc.locations.length, LOCATIONS.length);
  assert.equal(doc.locations.at(-1).id, 'central_abastos');
  assert.equal(doc.locations.at(-1).source, 'sniim');
  assert.equal(doc.products.length, PRODUCTS.length);
});

test('construirPrecios: todo lugar aparece en prices/prevPrices/detail de cada producto', () => {
  const doc = construirPrecios({ sniim: sniimMinimo, profeco: profecoMinimo, hoy: HOY });
  for (const producto of doc.products) {
    assert.deepEqual(Object.keys(producto.prices).sort(), LOCATION_IDS);
    assert.deepEqual(Object.keys(producto.prevPrices).sort(), LOCATION_IDS);
    assert.deepEqual(Object.keys(producto.detail).sort(), LOCATION_IDS);
  }
});

test('construirPrecios: central_abastos usa el último punto de la serie y prevPrices el anterior', () => {
  const doc = construirPrecios({ sniim: sniimMinimo, profeco: profecoMinimo, hoy: HOY });
  const jitomate = doc.products.find((p) => p.id === 'jitomate');
  assert.equal(jitomate.prices.central_abastos, 21);
  assert.equal(jitomate.prevPrices.central_abastos, 20);
  assert.deepEqual(jitomate.history, [
    { date: '2026-09-16', price: 20 },
    { date: '2026-09-17', price: 21 },
  ]);
  assert.equal(jitomate.detail.central_abastos.source, 'sniim');
  assert.equal(jitomate.detail.central_abastos.variety, 'Tomate Saladette');
});

test('construirPrecios: PROFECO llena precio actual y anterior por lugar', () => {
  const doc = construirPrecios({ sniim: sniimMinimo, profeco: profecoMinimo, hoy: HOY });
  const jitomate = doc.products.find((p) => p.id === 'jitomate');
  assert.equal(jitomate.prices.walmart, 25.9);
  assert.equal(jitomate.prevPrices.walmart, 24.5);
  assert.equal(jitomate.detail.walmart.n, 12);
  assert.equal(jitomate.detail.walmart.period, '07-2026_Q2');
  // Un lugar PROFECO sin observaciones para este producto: nota, no error.
  assert.equal(jitomate.prices.la_comer, null);
  assert.equal(jitomate.detail.la_comer.note, 'sin observaciones en el periodo');
});

test('construirPrecios: distingue "no comparable" de "sin datos" en central_abastos', () => {
  const doc = construirPrecios({ sniim: sniimMinimo, profeco: profecoMinimo, hoy: HOY });
  const cilantro = doc.products.find((p) => p.id === 'cilantro');
  const papa = doc.products.find((p) => p.id === 'papa');
  assert.equal(cilantro.prices.central_abastos, null);
  assert.equal(cilantro.detail.central_abastos.note, 'no comparable en Central de Abastos');
  assert.equal(papa.prices.central_abastos, null);
  assert.equal(papa.detail.central_abastos.note, 'sin datos en Central de Abastos');
});

test('construirPrecios: sources.sniim "ok" cuando dataDate es de hoy, "stale" a más de 4 días', () => {
  const fresco = construirPrecios({ sniim: sniimMinimo, profeco: profecoMinimo, hoy: HOY });
  assert.equal(fresco.sources.sniim.status, 'ok');
  assert.equal(fresco.sources.sniim.dataDate, '2026-09-17');

  const tarde = construirPrecios({ sniim: sniimMinimo, profeco: profecoMinimo, hoy: { y: 2026, m: 9, d: 23 } });
  assert.equal(tarde.sources.sniim.status, 'stale');
});

test('construirPrecios: sin data/sniim.json ni historial, sources.sniim queda en error y todo central_abastos en null', () => {
  const doc = construirPrecios({ sniim: null, profeco: profecoMinimo, hoy: HOY });
  assert.equal(doc.sources.sniim.status, 'error');
  assert.equal(doc.sources.sniim.error, 'sin datos');
  for (const producto of doc.products) {
    assert.equal(producto.prices.central_abastos, null);
  }
});

test('construirPrecios: sin data/profeco.json, sources.profeco en error y todos los lugares PROFECO en null', () => {
  const doc = construirPrecios({ sniim: sniimMinimo, profeco: null, hoy: HOY });
  assert.equal(doc.sources.profeco.status, 'error');
  assert.equal(doc.sources.profeco.error, 'sin datos');
  const jitomate = doc.products.find((p) => p.id === 'jitomate');
  for (const lugar of LOCATIONS.filter((l) => l.source === 'profeco')) {
    assert.equal(jitomate.prices[lugar.id], null);
    assert.equal(jitomate.detail[lugar.id].note, 'sin datos');
  }
  // central_abastos no depende de profeco y sigue con dato.
  assert.equal(jitomate.prices.central_abastos, 21);
});

test('build-precios.mjs (proceso completo): escribe precios.json con datos mínimos en un directorio temporal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bolsa-verduras-build-precios-'));
  try {
    const rutaHistorial = join(dir, 'sniim-historial.json');
    const rutaProfeco = join(dir, 'profeco.json');
    const rutaSalida = join(dir, 'precios.json');
    writeFileSync(rutaHistorial, JSON.stringify({ updatedAt: sniimMinimo.fetchedAt, products: sniimMinimo.products }));
    writeFileSync(rutaProfeco, JSON.stringify(profecoMinimo));

    const script = join(__dirname, 'build-precios.mjs');
    execFileSync(process.execPath, [script], {
      env: {
        ...process.env,
        SNIIM_HISTORIAL_PATH: rutaHistorial,
        SNIIM_JSON_PATH: join(dir, 'no-existe-sniim.json'),
        PROFECO_JSON_PATH: rutaProfeco,
        PRECIOS_OUT_PATH: rutaSalida,
      },
      encoding: 'utf-8',
    });

    const doc = JSON.parse(readFileSync(rutaSalida, 'utf-8'));
    assert.equal(doc.version, 1);
    assert.equal(doc.products.length, PRODUCTS.length);
    assert.equal(doc.sources.profeco.status, 'ok');
    const jitomate = doc.products.find((p) => p.id === 'jitomate');
    assert.equal(jitomate.prices.central_abastos, 21);
    assert.equal(jitomate.prices.walmart, 25.9);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('build-precios.mjs (proceso completo): sin profeco.json, sources.profeco queda en error pero el script no falla', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bolsa-verduras-build-precios-sinprofeco-'));
  try {
    const rutaHistorial = join(dir, 'sniim-historial.json');
    const rutaSalida = join(dir, 'precios.json');
    writeFileSync(rutaHistorial, JSON.stringify({ updatedAt: sniimMinimo.fetchedAt, products: sniimMinimo.products }));

    const script = join(__dirname, 'build-precios.mjs');
    execFileSync(process.execPath, [script], {
      env: {
        ...process.env,
        SNIIM_HISTORIAL_PATH: rutaHistorial,
        SNIIM_JSON_PATH: join(dir, 'no-existe-sniim.json'),
        PROFECO_JSON_PATH: join(dir, 'no-existe-profeco.json'),
        PRECIOS_OUT_PATH: rutaSalida,
      },
      encoding: 'utf-8',
    });

    const doc = JSON.parse(readFileSync(rutaSalida, 'utf-8'));
    assert.equal(doc.sources.profeco.status, 'error');
    assert.equal(doc.sources.profeco.error, 'sin datos');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
