#!/usr/bin/env node
// Une scripts/catalogo.mjs + data/sniim-historial.json (o data/sniim.json si
// no hay historial) + data/profeco.json (puede no existir) y escribe
// public/data/precios.json con el formato de docs/datos.md.
//
// Las rutas de entrada/salida se pueden sobrescribir con variables de
// entorno (útil para pruebas en un directorio temporal):
//   SNIIM_HISTORIAL_PATH, SNIIM_JSON_PATH, PROFECO_JSON_PATH, PRECIOS_OUT_PATH

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construirPrecios } from './lib/precios.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..');

const RUTA_HISTORIAL = process.env.SNIIM_HISTORIAL_PATH ?? join(RAIZ, 'data', 'sniim-historial.json');
const RUTA_SNIIM = process.env.SNIIM_JSON_PATH ?? join(RAIZ, 'data', 'sniim.json');
const RUTA_PROFECO = process.env.PROFECO_JSON_PATH ?? join(RAIZ, 'data', 'profeco.json');
const RUTA_SALIDA = process.env.PRECIOS_OUT_PATH ?? join(RAIZ, 'public', 'data', 'precios.json');

function leerJsonSiExiste(ruta) {
  if (!existsSync(ruta)) return null;
  const texto = readFileSync(ruta, 'utf-8');
  try {
    return JSON.parse(texto);
  } catch (err) {
    throw new Error(`No se pudo leer ${ruta} como JSON válido: ${err.message}`);
  }
}

// Prefiere el historial acumulado; si no existe (o está vacío) cae a
// data/sniim.json (una sola corrida sin historial previo).
function cargarSniim() {
  const historial = leerJsonSiExiste(RUTA_HISTORIAL);
  if (historial?.products && Object.keys(historial.products).length) {
    return { products: historial.products, fetchedAt: historial.updatedAt ?? null };
  }
  const sniimJson = leerJsonSiExiste(RUTA_SNIIM);
  if (sniimJson?.products) {
    return { products: sniimJson.products, fetchedAt: sniimJson.fetchedAt ?? null };
  }
  return null;
}

function main() {
  const sniim = cargarSniim();
  const profeco = leerJsonSiExiste(RUTA_PROFECO);

  const precios = construirPrecios({ sniim, profeco });

  mkdirSync(dirname(RUTA_SALIDA), { recursive: true });
  writeFileSync(RUTA_SALIDA, `${JSON.stringify(precios, null, 2)}\n`);

  const conSniim = precios.products.filter((p) => p.prices.central_abastos !== null).length;
  console.log(
    `precios.json OK: ${precios.products.length} productos, sniim ${precios.sources.sniim.status} ` +
      `(${conSniim} con dato de Central de Abastos), profeco ${precios.sources.profeco.status}.`,
  );
}

try {
  main();
} catch (err) {
  console.error(`Error en build-precios: ${err.message}`);
  process.exitCode = 1;
}
