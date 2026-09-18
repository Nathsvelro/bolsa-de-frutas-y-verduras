export const NEWS_CATEGORIES = {
  clima: { label: 'Clima', description: 'Lluvias, sequías y heladas' },
  produccion: { label: 'Cosechas', description: 'Producción y disponibilidad' },
  logistica: { label: 'Transporte', description: 'Rutas y distribución' },
  mercado: { label: 'Mercado', description: 'Precios, demanda y comercio' },
};

export function normalizeNewsText(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function isNewsUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Validamos también en el cliente: una fuente con datos inválidos no debe
// romper las tarjetas ni introducir enlaces ejecutables.
export function parseNewsData(data) {
  if (data?.version !== 1 || !Array.isArray(data.articles) || !Number.isFinite(Date.parse(data.updatedAt))) {
    throw new Error('El formato de noticias no es válido.');
  }
  const articles = data.articles.filter((article) => (
    typeof article?.id === 'string' && typeof article.title === 'string' && article.title.trim()
    && isNewsUrl(article.url) && typeof article.source?.name === 'string'
    && Object.hasOwn(NEWS_CATEGORIES, article.category)
    && Number.isFinite(Date.parse(article.publishedAt))
    && Date.parse(article.publishedAt) <= Date.now()
    && Array.isArray(article.productIds) && article.productIds.every((id) => typeof id === 'string')
    && typeof article.context === 'string'
  ));
  if (data.articles.length && !articles.length) throw new Error('Las noticias recibidas no son válidas.');
  return { ...data, articles: articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)) };
}

export function filterNews(articles, { category = 'todos', productId = '', search = '' }, products = []) {
  const term = normalizeNewsText(search.trim());
  const names = new Map(products.map((product) => [product.id, product.name]));
  return articles.filter((article) => (
    (category === 'todos' || article.category === category)
    && (!productId || article.productIds.includes(productId))
    && (!term || normalizeNewsText([
      article.title, article.source.name, article.context,
      ...article.productIds.map((id) => names.get(id) || id),
    ].join(' ')).includes(term))
  ));
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City',
});

export function formatNewsDate(value) {
  return dateFormatter.format(new Date(value));
}

export function isNewsStale(updatedAt, now = Date.now()) {
  return now - Date.parse(updatedAt) > 3 * 24 * 60 * 60 * 1000;
}
