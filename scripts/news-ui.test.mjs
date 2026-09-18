import test from 'node:test';
import assert from 'node:assert/strict';
import { filterNews, formatNewsDate, isNewsStale, parseNewsData } from '../src/data/newsUtils.js';

const article = {
  id: 'limon', title: 'Lluvias afectan la cosecha de limón', url: 'https://example.com/limon',
  source: { name: 'Medio de prueba' }, publishedAt: '2026-01-05T12:00:00Z',
  category: 'clima', productIds: ['limon'], context: 'Si cambia la cosecha, puede cambiar la oferta.',
};
const envelope = (articles) => ({ version: 1, updatedAt: '2026-01-06T12:00:00Z', articles });

test('noticias: rechaza respuestas sin contrato y distingue un feed vacío válido', () => {
  assert.throws(() => parseNewsData({ articles: [] }));
  assert.throws(() => parseNewsData({ ...envelope([]), updatedAt: 'sin fecha' }));
  assert.deepEqual(parseNewsData(envelope([])).articles, []);
});

test('noticias: no renderiza enlaces ejecutables, fechas futuras ni factores desconocidos', () => {
  const unsafe = [
    { ...article, url: 'javascript:alert(1)' },
    { ...article, url: 'https://usuario:clave@example.com/' },
    { ...article, publishedAt: '2999-01-01T12:00:00Z' },
    { ...article, publishedAt: 'no es fecha' },
    { ...article, category: 'constructor' },
    { ...article, source: null },
    { ...article, productIds: [null] },
  ];
  assert.throws(() => parseNewsData(envelope(unsafe)));
  assert.deepEqual(parseNewsData(envelope([...unsafe, article])).articles, [article]);
});

test('noticias: combina factor, producto y búsqueda sin acentos', () => {
  const articles = [article, { ...article, id: 'otra', category: 'mercado', productIds: ['papa'] }];
  assert.deepEqual(filterNews(articles, { category: 'clima', productId: 'limon', search: 'LIMÓN' }), [article]);
  assert.deepEqual(filterNews(articles, { category: 'clima', productId: 'papa' }), []);
  assert.deepEqual(filterNews([article], { search: '  medio DE PRUEBA ' }), [article]);
});

test('noticias: marca consulta antigua y muestra la fecha en CDMX', () => {
  assert.equal(isNewsStale('2026-01-01T00:00:00Z', Date.parse('2026-01-05T00:00:00Z')), true);
  assert.equal(isNewsStale('2026-01-04T00:00:00Z', Date.parse('2026-01-05T00:00:00Z')), false);
  assert.match(formatNewsDate('2026-01-06T02:00:00Z'), /^5 /);
});
