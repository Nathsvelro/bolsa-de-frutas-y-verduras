#!/usr/bin/env node
// Descarga (o reutiliza) el ZIP de PROFECO "Quién es Quién en los Precios",
// extrae en streaming el CSV de la quincena más reciente y el de la
// inmediata anterior, los agrega con scripts/lib/profeco.mjs y escribe
// data/profeco.json. Node >= 20, sin dependencias npm.
//
// Uso:
//   node scripts/fetch-profeco.mjs
//   PROFECO_ZIP=/ruta/local/QQP_2026.zip node scripts/fetch-profeco.mjs

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, open, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import { LOCATIONS, PRODUCTS, PROFECO } from './catalogo.mjs';
import { parseCsv } from './lib/csv.mjs';
import { aggregateProfeco, parsePeriodo, pickPeriods } from './lib/profeco.mjs';

const RUTA_SALIDA = fileURLToPath(new URL('../data/profeco.json', import.meta.url));
const TIMEOUT_DESCARGA_MS = 15 * 60 * 1000;
const REINTENTOS_DESCARGA = 2;
const TAMANO_MINIMO_BYTES = 10 * 1024 * 1024;
const FIRMA_ZIP = Buffer.from([0x50, 0x4b]); // "PK"

class FetchProfecoError extends Error {}

function log(...args) {
  console.log(...args);
}

function logError(...args) {
  console.error(...args);
}

// Descarga PROFECO.zipUrl en streaming a un archivo temporal, con timeout y
// reintentos. Devuelve la ruta del archivo descargado.
async function descargarZip() {
  const dirTemp = await mkdtemp(join(tmpdir(), 'bolsa-verduras-profeco-'));
  const destino = join(dirTemp, 'QQP.zip');

  let ultimoError;
  for (let intento = 0; intento <= REINTENTOS_DESCARGA; intento++) {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), TIMEOUT_DESCARGA_MS);
    try {
      log(`Descargando ZIP de PROFECO (intento ${intento + 1}/${REINTENTOS_DESCARGA + 1})…`);
      const respuesta = await fetch(PROFECO.zipUrl, { signal: controlador.signal });
      if (!respuesta.ok || !respuesta.body) {
        throw new FetchProfecoError(
          `Descarga de PROFECO falló: HTTP ${respuesta.status} ${respuesta.statusText}`,
        );
      }
      await pipeline(Readable.fromWeb(respuesta.body), createWriteStream(destino));
      await verificarZip(destino);
      clearTimeout(timer);
      return destino;
    } catch (err) {
      clearTimeout(timer);
      ultimoError = err;
      logError(`  intento ${intento + 1} falló: ${err.message}`);
    }
  }
  await rm(dirTemp, { recursive: true, force: true }).catch(() => {});
  throw new FetchProfecoError(
    `No se pudo descargar el ZIP de PROFECO tras ${REINTENTOS_DESCARGA + 1} intentos: ${ultimoError?.message}`,
  );
}

// Confirma que el archivo empieza con la firma PK de ZIP y pesa > 10 MB.
async function verificarZip(ruta) {
  const info = await stat(ruta);
  if (info.size <= TAMANO_MINIMO_BYTES) {
    throw new FetchProfecoError(
      `El archivo descargado pesa ${info.size} bytes (se esperaba > ${TAMANO_MINIMO_BYTES}); probablemente no es el ZIP completo`,
    );
  }
  const fh = await open(ruta, 'r');
  try {
    const buf = Buffer.alloc(2);
    await fh.read(buf, 0, 2, 0);
    if (!buf.equals(FIRMA_ZIP)) {
      throw new FetchProfecoError('El archivo descargado no tiene firma de ZIP (PK)');
    }
  } finally {
    await fh.close();
  }
}

// Ejecuta un comando y junta su stdout como string; rechaza si el proceso
// termina con código distinto de 0 o no se puede lanzar (p. ej. ENOENT).
function ejecutar(cmd, args) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    hijo.stdout?.on('data', (d) => {
      stdout += d;
    });
    hijo.stderr?.on('data', (d) => {
      stderr += d;
    });
    hijo.on('error', (err) => {
      reject(new FetchProfecoError(`No se pudo ejecutar "${cmd}": ${err.message}`));
    });
    hijo.on('close', (code) => {
      if (code !== 0) {
        reject(
          new FetchProfecoError(`"${cmd} ${args.join(' ')}" salió con código ${code}: ${stderr.trim()}`),
        );
        return;
      }
      resolve(stdout);
    });
  });
}

// Lista las entradas del ZIP con `unzip -Z1` (formato simple, un nombre por
// línea); si no está disponible, intenta `unzip -l` como respaldo.
async function listarEntradas(rutaZip) {
  try {
    const salida = await ejecutar('unzip', ['-Z1', rutaZip]);
    return salida.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch (errZ1) {
    try {
      const salida = await ejecutar('unzip', ['-l', rutaZip]);
      // Formato de `unzip -l`: encabezado, líneas "  length  date time  name", pie.
      return salida
        .split('\n')
        .map((linea) => {
          const m = /^\s*\d+\s+[\d-]+\s+[\d:]+\s+(.+)$/.exec(linea);
          return m ? m[1].trim() : null;
        })
        .filter(Boolean);
    } catch (errL) {
      throw new FetchProfecoError(
        `No se pudo listar el ZIP con "unzip" (¿no está instalado?): ${errZ1.message} / ${errL.message}`,
      );
    }
  }
}

// Extrae en streaming una entrada del ZIP con `unzip -p` y la agrega con
// aggregateProfeco, sin cargar el CSV completo en memoria.
async function procesarPeriodo(rutaZip, entrada) {
  const hijo = spawn('unzip', ['-p', rutaZip, entrada], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  hijo.stderr.on('data', (d) => {
    stderr += d;
  });

  const filas = parseCsv(hijo.stdout);
  const { value: header, done } = await filas.next();
  if (done || !header) {
    throw new FetchProfecoError(`El CSV "${entrada}" está vacío o no se pudo leer`);
  }

  const resultadoPromesa = aggregateProfeco(filas, header);

  const codigoSalida = await new Promise((resolve, reject) => {
    hijo.on('error', (err) => reject(new FetchProfecoError(`No se pudo ejecutar "unzip -p": ${err.message}`)));
    hijo.on('close', resolve);
  });

  const resultado = await resultadoPromesa;

  if (codigoSalida !== 0) {
    throw new FetchProfecoError(
      `"unzip -p ${rutaZip} ${entrada}" salió con código ${codigoSalida}: ${stderr.trim()}`,
    );
  }

  return resultado;
}

function imprimirResumen(periodo, resultado) {
  log(`\nPeriodo ${periodo}: ${resultado.rowsRead} filas leídas, ${resultado.rowsMatched} filas CDMX/Frutas y Legumbres.`);
  log(`  dataDateFrom=${resultado.dataDateFrom}  dataDate=${resultado.dataDate}`);

  const lugares = LOCATIONS.filter((l) => l.source === 'profeco');
  const productos = PRODUCTS.filter((p) => p.profeco);
  const tabla = {};
  const sinDatos = [];
  for (const p of productos) {
    const fila = {};
    let tieneAlguno = false;
    for (const l of lugares) {
      const n = resultado.products[p.id]?.[l.id]?.n;
      fila[l.short] = n ?? '-';
      if (n) tieneAlguno = true;
      else sinDatos.push(`${p.id}/${l.id}`);
    }
    tabla[p.id] = fila;
    if (!tieneAlguno) logError(`  AVISO: "${p.id}" no tiene datos en ningún lugar PROFECO en este periodo.`);
  }
  console.table(tabla);
  if (sinDatos.length) {
    log(`  Combinaciones producto/lugar sin datos en este periodo (${sinDatos.length}): ${sinDatos.join(', ')}`);
  }
}

async function main() {
  const rutaZipEnv = process.env.PROFECO_ZIP;
  let rutaZip = rutaZipEnv;
  let dirTempDescarga = null;

  if (rutaZip) {
    log(`Usando ZIP local (PROFECO_ZIP): ${rutaZip}`);
    await verificarZip(rutaZip);
  } else {
    rutaZip = await descargarZip();
    dirTempDescarga = join(rutaZip, '..');
  }

  try {
    const entradas = await listarEntradas(rutaZip);
    const csvs = entradas.filter((e) => /\.csv$/i.test(e));
    const { latest, previous } = pickPeriods(csvs);
    if (!latest) {
      throw new FetchProfecoError('No se encontró ningún CSV con el patrón MM-AAAA_QN.csv dentro del ZIP');
    }

    log(`Periodo más reciente: ${latest}${previous ? ` · anterior: ${previous}` : ' (sin periodo anterior en el ZIP)'}`);

    const resultadoLatest = await procesarPeriodo(rutaZip, latest);
    if (resultadoLatest.rowsMatched === 0) {
      throw new FetchProfecoError(
        `0 filas coincidentes (estado="${PROFECO.estado}", catalogo="${PROFECO.catalogo}") en el periodo más reciente (${latest})`,
      );
    }
    imprimirResumen(latest, resultadoLatest);

    let resultadoPrevious = null;
    if (previous) {
      resultadoPrevious = await procesarPeriodo(rutaZip, previous);
      imprimirResumen(previous, resultadoPrevious);
    } else {
      logError('AVISO: no hay periodo anterior en el ZIP; "previous" quedará vacío en data/profeco.json.');
    }

    const periodoLatest = parsePeriodo(latest);
    const periodoPrevious = previous ? parsePeriodo(previous) : null;

    const salida = {
      fetchedAt: new Date().toISOString(),
      zipUrl: PROFECO.zipUrl,
      period: periodoLatest?.label ?? latest,
      previousPeriod: periodoPrevious?.label ?? previous ?? null,
      dataDate: resultadoLatest.dataDate,
      dataDateFrom: resultadoLatest.dataDateFrom,
      products: resultadoLatest.products,
      previous: resultadoPrevious
        ? {
            period: periodoPrevious?.label ?? previous,
            dataDate: resultadoPrevious.dataDate,
            dataDateFrom: resultadoPrevious.dataDateFrom,
            products: resultadoPrevious.products,
          }
        : null,
    };

    await writeFile(RUTA_SALIDA, `${JSON.stringify(salida, null, 2)}\n`, 'utf8');
    log(`\nEscrito ${RUTA_SALIDA}`);
  } finally {
    if (dirTempDescarga) {
      await rm(dirTempDescarga, { recursive: true, force: true }).catch(() => {});
    }
  }
}

main().catch((err) => {
  logError(`\nError: ${err.message}`);
  process.exitCode = 1;
});
