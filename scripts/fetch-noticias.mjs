#!/usr/bin/env node
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildNoticias, NOTICIAS_RSS_URLS } from './lib/noticias.mjs';

const OUTPUT = fileURLToPath(new URL('../public/data/noticias.json', import.meta.url));
const MAX_BYTES = 2_000_000;

async function fetchRss(fetchImpl, url) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(25_000), headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!response.ok) throw new Error(`Google Noticias respondió HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('RSS demasiado grande');
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('RSS demasiado grande');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Exportada para probar fallos y conservación en directorios temporales.
export async function updateNoticias({ output = OUTPUT, fixture = process.env.NOTICIAS_RSS, fetchImpl = fetch, now = new Date() } = {}) {
  const xml = fixture ? await readFile(fixture, 'utf8') : await Promise.all(NOTICIAS_RSS_URLS.map((url) => fetchRss(fetchImpl, url)));
  const data = buildNoticias(xml, { now });
  data.source.urls = NOTICIAS_RSS_URLS;
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
  return data;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updateNoticias().then((data) => {
    console.log(`Noticias OK: ${data.articles.length} titulares relevantes en los últimos 45 días; actualizado ${data.updatedAt}.`);
  }).catch((error) => {
    console.error(`Error en fetch-noticias: ${error.message}. Se conserva noticias.json anterior.`);
    process.exitCode = 1;
  });
}
