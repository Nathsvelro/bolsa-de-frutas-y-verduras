import { createHash } from 'node:crypto';
import { PRODUCTS } from '../catalogo.mjs';

export const NOTICIAS_WINDOW_DAYS = 45;
const factors = '(precios OR cosecha OR sequía OR lluvias OR bloqueos OR aranceles OR exportaciones)';
const rssUrl = (q) => `https://news.google.com/rss/search?${new URLSearchParams({ q, hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' })}`;
export const NOTICIAS_QUERY = `México (frutas OR verduras OR hortalizas OR jitomate OR limón OR aguacate) ${factors} when:45d`;
export const NOTICIAS_RSS_URL = rssUrl(NOTICIAS_QUERY);
// Consultas cortas por grupos: una sola consulta con todo el catálogo pierde
// cobertura por los límites del buscador. Los resultados se deduplican juntos.
export const NOTICIAS_RSS_URLS = [NOTICIAS_RSS_URL];
for (let index = 0; index < PRODUCTS.length; index += 5) {
  const terms = PRODUCTS.slice(index, index + 5).map(({ name }) => `"${name.toLowerCase()}"`).join(' OR ');
  NOTICIAS_RSS_URLS.push(rssUrl(`México (${terms}) ${factors} when:45d`));
}

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cleanText = (value) => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function decodeXml(value) {
  return value.replace(/&([^;\s]*);|&/g, (entity, body) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(named, body)) return named[body];
    if (/^#(?:\d+|x[\da-f]+)$/i.test(body ?? '')) {
      const point = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      if (point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)) return String.fromCodePoint(point);
    }
    throw new Error(`Entidad XML inválida: ${entity}`);
  });
}

// Parser XML limitado a RSS: valida la estructura completa antes de publicar.
// No resuelve DTD ni entidades externas. Un HTML de error nunca es un feed vacío.
function parseXml(xml) {
  if (typeof xml !== 'string' || !xml.trim() || xml.length > 2_000_000) throw new Error('RSS vacío o demasiado grande');
  const document = { name: '#document', children: [], text: '' };
  const stack = [document];
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w:.-]*(?:\s+(?:"[^"]*"|'[^']*'|[^"'<>])*)?\s*\/?>|[^<]+/gy;
  let position = 0;
  while (position < xml.length) {
    tokens.lastIndex = position;
    const match = tokens.exec(xml);
    if (!match) throw new Error('XML incompleto o declaración no admitida');
    const token = match[0];
    position = tokens.lastIndex;
    const parent = stack.at(-1);
    if (token.startsWith('<!--') || token.startsWith('<?')) continue;
    if (token.startsWith('<![CDATA[')) {
      if (stack.length === 1) throw new Error('CDATA fuera de la raíz RSS');
      parent.text += token.slice(9, -3);
    } else if (token.startsWith('</')) {
      const name = /^<\/([\w:.-]+)\s*>$/.exec(token)?.[1];
      if (stack.length === 1 || parent.name !== name) throw new Error('Etiquetas XML sin cerrar o desordenadas');
      stack.pop();
    } else if (token.startsWith('<')) {
      const opening = /^<([\w:.-]+)([\s\S]*?)(\/?)>$/.exec(token);
      if (!opening) throw new Error('Etiqueta XML inválida');
      const [, name, attrText, selfClosing] = opening;
      const attrs = {};
      const attrPattern = /\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/gy;
      let offset = 0;
      while (attrText.slice(offset).trim()) {
        attrPattern.lastIndex = offset;
        const attr = attrPattern.exec(attrText);
        if (!attr || Object.hasOwn(attrs, attr[1])) throw new Error('Atributo XML inválido');
        attrs[attr[1]] = decodeXml(attr[2] ?? attr[3]);
        offset = attrPattern.lastIndex;
      }
      const node = { name, attrs, children: [], text: '' };
      parent.children.push(node);
      if (!selfClosing) stack.push(node);
    } else {
      if (stack.length === 1 && token.trim()) throw new Error('Contenido fuera de la raíz RSS');
      parent.text += decodeXml(token);
    }
  }
  if (stack.length !== 1 || document.children.length !== 1) throw new Error('XML truncado o con varias raíces');
  return document.children[0];
}

function child(node, name) {
  return node.children.find((item) => item.name === name);
}

function field(node, name) {
  return cleanText(child(node, name)?.text ?? '');
}

export function parseNoticiasRss(xml) {
  const root = parseXml(xml.replace(/^\uFEFF/, ''));
  const channels = root.children.filter((item) => item.name === 'channel');
  if (root.name !== 'rss' || channels.length !== 1) throw new Error('La respuesta no es un RSS con channel');
  const channel = channels[0];
  if (!field(channel, 'title') || !field(channel, 'link') || !child(channel, 'description')) {
    throw new Error('El canal RSS no contiene los metadatos obligatorios');
  }
  return channel.children.filter((item) => item.name === 'item').map((item) => ({
    title: field(item, 'title'),
    url: field(item, 'link'),
    publishedAt: field(item, 'pubDate'),
    source: { name: field(item, 'source'), url: child(item, 'source')?.attrs.url ?? '' },
  }));
}

const PRODUCT_TERMS = {
  jitomate: /\bjitomates?\b|\btomates? (?:rojos?|saladette|bola)\b/,
  cebolla: /\bcebollas?\b/,
  lechuga: /\blechugas?\b/,
  papa: /\bpapas?\b|\bpatatas?\b/,
  cilantro: /\bcilantro\b/,
  chile_serrano: /\bchiles? serranos?\b/,
  chile_jalapeno: /\bchiles? jalapenos?\b/,
  zanahoria: /\bzanahorias?\b/,
  pepino: /\bpepinos?\b/,
  calabacita: /\bcalabacitas?\b|\bcalabazas? italianas?\b/,
  brocoli: /\bbrocolis?\b/,
  elote: /\belotes?\b/,
  aguacate: /\baguacates?\b/,
  limon: /\blimon(?:es)?\b/,
  manzana: /\bmanzanas?\b/,
  platano: /\bplatanos?\b|\bbananos?\b/,
  naranja: /\bnaranjas?\b/,
  mango: /\bmangos?\b/,
  fresa: /\bfresas?\b/,
  uva: /\buvas?\b/,
};

const RELIGION = /\b(?:pontifice|vaticano|papal|papado|santo padre|el papa|papa (?:leon|francisco|benedicto|juan))\b/;
const NON_MARKET = /\b(?:recetas?|como (?:preparar|cocinar)|beneficios para|propiedades (?:nutritivas|nutricionales)|horoscopo|vestidos?|ropa|martimiercoles|miercoles de plaza|martes de frescura|ofertas en|promociones|papa caliente|movimiento naranja|regalando su cosecha|lluvia de verduras|tes de|infusiones|prevenir gripas|feria del|festival del)\b/;
const FOOD = /\b(?:frutas?|verduras?|hortalizas?|alimentos?|alimentari\w*|agricol\w*|agricultura|agroalimentari\w*|frutic\w*|canasta basica|tomates?)\b/;
const CLIMATE = /\b(?:sequia\w*|lluvia\w*|helada\w*|huracan\w*|inundaci\w*|clima\w*|granizo|calor|ciclones?|tormentas?)\b/;
const LOGISTICS = /\b(?:bloqueo\w*|transporte\w*|carretera\w*|fletes?|logistica|distribuci\w*|desabasto|abastecimiento)\b/;
const PRODUCTION = /\b(?:cosecha\w*|producci\w*|productores?|siembra\w*|cultivo\w*|plagas?|fertilizantes?|riego|temporada)\b/;
const MARKET = /\b(?:precios?|costos?|inflaci\w*|arancel\w*|export\w*|import\w*|oferta|demanda|encarec\w*|escasez|canasta basica|mercado\w*|bajan?|suben?|barat\w*)\b/;
const TRADE = /\b(?:arancel\w*|export\w*|importaci\w*)\b/;

const CONTEXT = {
  clima: 'Si el clima altera las cosechas o su distribución, puede cambiar la disponibilidad y los precios.',
  produccion: 'Si cambia el volumen de cosecha o el costo de producir, puede variar la oferta y el precio.',
  logistica: 'Si cambia el transporte o el abastecimiento, puede variar la disponibilidad y el costo de los productos.',
  mercado: 'Si cambian la demanda, el comercio o los costos de venta, pueden cambiar los precios al consumidor.',
};

export function classifyHeadline(title) {
  const text = normalize(title);
  const productIds = PRODUCTS.filter(({ id }) => PRODUCT_TERMS[id]?.test(text) && !(id === 'papa' && RELIGION.test(text))).map(({ id }) => id);
  const relevant = !NON_MARKET.test(text) && (productIds.length > 0 || FOOD.test(text)) && [CLIMATE, LOGISTICS, PRODUCTION, MARKET].some((pattern) => pattern.test(text));
  if (!relevant) return null;
  const category = CLIMATE.test(text) ? 'clima' : LOGISTICS.test(text) ? 'logistica' : TRADE.test(text) ? 'mercado' : PRODUCTION.test(text) ? 'produccion' : 'mercado';
  return { category, productIds, context: CONTEXT[category] };
}

function httpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// RSS usa fechas RFC 2822. Validamos además el calendario, porque Date.parse
// convierte silenciosamente «31 Feb» a marzo. Se admiten UTC/GMT y offsets.
function parseDate(value) {
  const match = /^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(GMT|UTC|[+-]\d{4})$/i.exec(value);
  if (!match) return null;
  const [, day, month, year, hour, minute, second = '0', zone] = match;
  const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(month.toLowerCase());
  if (+day < 1 || +day > new Date(Date.UTC(+year, monthIndex + 1, 0)).getUTCDate() || +hour > 23 || +minute > 59 || +second > 59) return null;
  if (/^[+-]/.test(zone) && (+zone.slice(1, 3) > 23 || +zone.slice(3) > 59)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildNoticias(xml, { now = new Date(), sourceUrl = NOTICIAS_RSS_URL } = {}) {
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs) || !httpUrl(sourceUrl)) throw new Error('Fecha de actualización o URL de fuente inválida');
  const earliest = nowMs - NOTICIAS_WINDOW_DAYS * 86_400_000;
  const candidates = (Array.isArray(xml) ? xml : [xml]).flatMap(parseNoticiasRss).flatMap((item) => {
    const url = httpUrl(item.url);
    const sourceUrl = httpUrl(item.source.url);
    const timestamp = parseDate(item.publishedAt);
    if (!url || !sourceUrl || !item.title || !item.source.name || timestamp === null || timestamp < earliest || timestamp > nowMs) return [];
    // Google añade « - Medio» al titular; no se usa ese sufijo al clasificar.
    const suffix = ` - ${item.source.name}`;
    const title = item.title.endsWith(suffix) ? item.title.slice(0, -suffix.length).trim() : item.title;
    const classification = classifyHeadline(title);
    if (!classification) return [];
    return [{
      id: createHash('sha256').update(url).digest('hex').slice(0, 20),
      title,
      url,
      source: { name: item.source.name, url: sourceUrl },
      publishedAt: new Date(timestamp).toISOString(),
      ...classification,
    }];
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
  // Un titular repetido puede usar otra URL, y una URL repetida otro titular.
  // Agrupamos ambas coincidencias antes de elegir la versión más reciente.
  const roots = candidates.map((_, index) => index);
  const findRoot = (index) => {
    while (roots[index] !== index) {
      roots[index] = roots[roots[index]];
      index = roots[index];
    }
    return index;
  };
  const keys = new Map();
  candidates.forEach((article, index) => {
    const titleKey = normalize(article.title).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const canonicalUrl = new URL(article.url);
    canonicalUrl.hash = '';
    for (const key of [...canonicalUrl.searchParams.keys()]) {
      if (/^(?:utm_|gclid|fbclid)/i.test(key)) canonicalUrl.searchParams.delete(key);
    }
    for (const key of [`url:${canonicalUrl.href}`, `title:${titleKey}`]) {
      if (keys.has(key)) {
        const first = findRoot(keys.get(key));
        const current = findRoot(index);
        roots[Math.max(first, current)] = Math.min(first, current);
      }
      keys.set(key, index);
    }
  });
  const articles = candidates.filter((_, index) => findRoot(index) === index);
  return { version: 1, updatedAt: new Date(nowMs).toISOString(), source: { name: 'Google Noticias', url: sourceUrl }, articles };
}
