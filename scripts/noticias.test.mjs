import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildNoticias, classifyHeadline, parseNoticiasRss } from './lib/noticias.mjs';
import { updateNoticias } from './fetch-noticias.mjs';

const NOW = new Date('2026-09-18T00:00:00Z');
const rss = (items = '') => `<?xml version="1.0"?><rss version="2.0"><channel><title>Noticias</title><link>https://example.com</link><description>Feed de prueba</description>${items}</channel></rss>`;
const item = ({ title = 'Lluvias afectan cosecha de limón', url = 'https://example.com/limon', date = 'Thu, 17 Sep 2026 12:00:00 GMT', source = 'Medio de prueba' } = {}) => `<item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>${date}</pubDate><source url="https://example.com">${source}</source></item>`;

test('RSS: lee CDATA, entidades y fuente sin copiar HTML de la descripción', () => {
  const result = parseNoticiasRss(rss(item({ title: 'Lluvias <b>afectan</b> limón', source: 'Diario &amp; Campo' })));
  assert.equal(result[0].title, 'Lluvias afectan limón');
  assert.equal(result[0].source.name, 'Diario & Campo');
  assert.equal(result[0].source.url, 'https://example.com');
  assert.deepEqual(parseNoticiasRss(rss().replace('<description>', '<description comparison="a > b">')), []);
});

test('RSS: rechaza HTML, XML truncado, entidades externas y canal sin metadatos', () => {
  for (const invalid of ['<html>Error</html>', rss(item()).slice(0, -6), '<!DOCTYPE rss SYSTEM "file:///etc/passwd">' + rss(), '<rss><channel/></rss>', rss().replace('Noticias', '&unknown;')]) {
    assert.throws(() => parseNoticiasRss(invalid));
  }
  assert.deepEqual(parseNoticiasRss(rss()), []);
});

test('titulares: relaciona solo productos explícitos y evita confundir tomate verde y el papa', () => {
  assert.deepEqual(classifyHeadline('Suben los precios del jitomate y limón').productIds, ['jitomate', 'limon']);
  assert.deepEqual(classifyHeadline('Sube precio de tomate verde').productIds, []);
  assert.equal(classifyHeadline('El papa León habla del mercado mundial'), null);
  assert.equal(classifyHeadline('El Papa pide detener los bloqueos'), null);
  assert.deepEqual(classifyHeadline('El Papa alerta por el precio de los alimentos en México').productIds, []);
  assert.deepEqual(classifyHeadline('Cosecha de papa y chile serrano en México').productIds, ['papa', 'chile_serrano']);
  assert.deepEqual(classifyHeadline('La cosecha de fresa crece').productIds, ['fresa']);
});

test('titulares: excluye recetas, promoción comercial, turismo y consejos de salud', () => {
  for (const title of [
    'Recetas con verduras de temporada',
    'Walmart Martes de Frescura: mejores precios en frutas y verduras',
    '¡Aquí llueven verduras! El pueblo mexiquense que celebra regalando su cosecha',
    'Temporada de lluvias: los tés de jengibre con limón para prevenir gripas',
    'Feria del jitomate: fecha, horario, costo y actividades',
  ]) assert.equal(classifyHeadline(title), null, title);
});

test('titulares: clasifica factores sin generar pronósticos ni atribuir causalidad', () => {
  assert.equal(classifyHeadline('Sequía afecta la cosecha de limón').category, 'clima');
  assert.equal(classifyHeadline('Bloqueos retrasan transporte de verduras').category, 'logistica');
  assert.equal(classifyHeadline('Aumenta la cosecha de mango en México').category, 'produccion');
  const trade = classifyHeadline('Aranceles afectan a productores de hortalizas');
  assert.equal(trade.category, 'mercado');
  assert.match(trade.context, /^Si /);
});

test('noticias: descarta fechas futuras, antiguas e imposibles y enlaces ejecutables', () => {
  const xml = rss([
    item(), item({ date: 'Fri, 18 Sep 2026 12:00:00 GMT' }),
    item({ date: 'Tue, 01 Jul 2026 12:00:00 GMT' }), item({ date: '31 Feb 2026 12:00:00 GMT' }),
    item({ date: 'sin fecha' }), item({ url: 'javascript:alert(1)' }),
    item({ url: 'https://usuario:clave@example.com/' }),
  ].join(''));
  const result = buildNoticias(xml, { now: NOW });
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].publishedAt, '2026-09-17T12:00:00.000Z');
});

test('noticias: ordena y elimina duplicados de título o URL, ignorando rastreo', () => {
  const xml = rss([
    item({ title: 'Lluvias afectan cosecha de limón - Medio de prueba' }),
    item({ title: 'LLUVÍAS AFECTAN COSECHA DE LIMÓN', url: 'https://example.com/copia' }),
    item({ title: 'Lluvias reducen cosecha de limón', url: 'https://example.com/limon?utm_source=rss' }),
    item({ title: 'Aumenta cosecha de mango', url: 'https://example.com/mango', date: 'Wed, 16 Sep 2026 12:00:00 GMT' }),
  ].join(''));
  const result = buildNoticias(xml, { now: NOW });
  assert.equal(result.articles.length, 2);
  assert.equal(result.articles[0].publishedAt, '2026-09-17T12:00:00.000Z');
  assert.equal(result.articles[1].productIds[0], 'mango');
  assert.equal(new Set(result.articles.map((article) => article.id)).size, 2);
  assert.deepEqual(buildNoticias([xml, xml], { now: NOW }).articles, result.articles);
});

test('actualización: conserva último JSON ante errores HTTP, red y XML; publica un feed vacío válido', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'bolsa-noticias-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'noticias.json');
  const previous = JSON.stringify(buildNoticias(rss(item()), { now: NOW }));
  await writeFile(output, previous);
  for (const fetchImpl of [
    async () => new Response('no disponible', { status: 503 }),
    async () => { throw new Error('sin conexión'); },
    async () => new Response('<html>Error</html>'),
    async () => new Response(rss(item()).slice(0, -8)),
    async () => new Response('x', { headers: { 'content-length': '3000000' } }),
  ]) {
    await assert.rejects(updateNoticias({ output, fetchImpl, now: NOW }));
    assert.equal(await readFile(output, 'utf8'), previous);
  }
  const next = await updateNoticias({ output, fetchImpl: async () => new Response(rss()), now: NOW });
  assert.deepEqual(next.articles, []);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), next);
  assert.deepEqual(await readdir(directory), ['noticias.json']);
});
