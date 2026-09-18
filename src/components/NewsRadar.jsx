import { useMemo, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, CloudRain, ExternalLink,
  Info, Leaf, Newspaper, Radio, RefreshCw, Search, SearchX, Sprout, Truck, X,
} from 'lucide-react';
import { useNewsData } from '../hooks/useNewsData';
import { filterNews, formatNewsDate, isNewsStale, NEWS_CATEGORIES } from '../data/newsUtils';

const CATEGORY_ICONS = { clima: CloudRain, produccion: Sprout, logistica: Truck, mercado: Leaf };
const CATEGORY_STYLES = {
  clima: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
  produccion: 'text-bull-300 bg-bull-400/10 border-bull-400/20',
  logistica: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  mercado: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
};
const EMPTY_ARTICLES = [];

function NewsCard({ article, products, onViewProduct }) {
  const Icon = CATEGORY_ICONS[article.category];
  const related = products.filter((product) => article.productIds.includes(product.id));
  return (
    <article className="glass-card flex h-full min-w-0 flex-col rounded-2xl p-5 sm:p-6 transition-colors hover:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${CATEGORY_STYLES[article.category]}`}>
          <Icon size={13} aria-hidden="true" />{NEWS_CATEGORIES[article.category].label}
        </span>
        <time dateTime={article.publishedAt} className="text-xs text-slate-400">{formatNewsDate(article.publishedAt)}</time>
      </div>

      <p className="mt-5 text-xs font-medium text-slate-400">{article.source.name}</p>
      <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-slate-100">
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-control rounded-sm hover:text-bull-300">
          {article.title}<ArrowUpRight className="ml-1 inline h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="sr-only"> (abre en otra pestaña)</span>
        </a>
      </h3>

      <div className="mt-5 rounded-xl border border-white/5 bg-surface-900/70 p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300"><BookOpen size={13} aria-hidden="true" />Cómo podría influir · contexto general</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{article.context}</p>
      </div>

      <div className="mt-5 flex-1">
        {related.length ? (
          <>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Mencionados en el titular · ver precios</p>
            <div className="flex flex-wrap gap-2">
              {related.map((product) => (
                <button key={product.id} type="button" onClick={() => onViewProduct(product.id)}
                  aria-label={`Ver precios de ${product.name}`}
                  className="news-control inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-surface-800 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-bull-500/40 hover:text-bull-300">
                  <span aria-hidden="true">{product.icon}</span>{product.name}<ArrowRight size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          </>
        ) : <p className="text-xs text-slate-500">Contexto del sector · sin producto identificado</p>}
      </div>

      <a href={article.url} target="_blank" rel="noopener noreferrer"
        className="news-control mt-5 inline-flex w-fit items-center gap-1.5 rounded-sm text-xs font-semibold text-bull-300 hover:text-bull-400">
        Leer noticia<ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> en {article.source.name} (otra pestaña)</span>
      </a>
    </article>
  );
}

export default function NewsRadar({ products, onViewProduct, initialProductId = '' }) {
  const { data, loading, error, reload } = useNewsData();
  const [category, setCategory] = useState('todos');
  const [productId, setProductId] = useState(initialProductId);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(6);
  const articles = data?.articles || EMPTY_ARTICLES;
  const filtered = useMemo(() => filterNews(articles, { category, productId, search }, products), [articles, category, productId, search, products]);
  const matchingProducts = useMemo(() => filterNews(articles, { productId, search }, products), [articles, productId, search, products]);
  const sourceCount = new Set(articles.map((article) => article.source.name)).size;
  const hasFilters = category !== 'todos' || productId || search;
  const stale = data && isNewsStale(data.updatedAt);

  function clearFilters() {
    setCategory('todos'); setProductId(''); setSearch(''); setLimit(6);
  }

  return (
    <section aria-labelledby="news-heading" className="space-y-6">
      <div className="news-hero relative overflow-hidden rounded-3xl border border-bull-500/15 p-6 sm:p-9">
        <div className="relative z-10 max-w-2xl">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-bull-300"><Radio size={15} aria-hidden="true" />Radar de noticias</p>
          <h2 id="news-heading" tabIndex={-1} className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight outline-none sm:text-4xl">Entiende lo que hay<br className="hidden sm:block" /> detrás de los precios.</h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">Del clima a la cosecha: noticias del sector para entender qué podría influir en el precio de tu próxima compra.</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-bull-400" aria-hidden="true" />Fuente y fecha visibles</span>
            <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-bull-400" aria-hidden="true" />Productos relacionados</span>
            <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-bull-400" aria-hidden="true" />Acceso a precios reales</span>
          </div>
        </div>
        <div aria-hidden="true" className="news-orbit pointer-events-none absolute -right-12 top-1/2 hidden h-72 w-72 -translate-y-1/2 items-center justify-center rounded-full border border-bull-400/10 lg:flex">
          <div className="flex h-52 w-52 items-center justify-center rounded-full border border-bull-400/15"><div className="flex h-32 w-32 items-center justify-center rounded-full border border-bull-400/20 bg-bull-400/5"><Sprout size={44} strokeWidth={1.2} className="text-bull-300/60" /></div></div>
          <CloudRain className="absolute left-7 top-9 text-bull-300/40" size={24} /><Truck className="absolute bottom-10 left-8 text-bull-300/40" size={24} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Filtrar noticias por factor">
        {Object.entries(NEWS_CATEGORIES).map(([id, item]) => {
          const Icon = CATEGORY_ICONS[id];
          const count = matchingProducts.filter((article) => article.category === id).length;
          const active = category === id;
          return (
            <button key={id} type="button" aria-pressed={active}
              onClick={() => { setCategory(active ? 'todos' : id); setLimit(6); }}
              className={`news-control rounded-2xl border p-4 text-left transition-colors ${active ? 'border-bull-400/50 bg-bull-400/8' : 'border-white/[0.06] bg-surface-850/80 hover:border-white/20'}`}>
              <div className="flex items-center justify-between"><span className={`rounded-lg border p-2 ${CATEGORY_STYLES[id]}`}><Icon size={18} aria-hidden="true" /></span><span className="font-mono text-xs text-slate-500">{loading && !data ? '—' : `${count} ${count === 1 ? 'nota' : 'notas'}`}</span></div>
              <p className="mt-3 text-sm font-semibold text-slate-200">{item.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{item.description}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Noticias para tu canasta</h3>
          <p className="mt-1 text-xs text-slate-400">{data ? `${articles.length} noticias · ${sourceCount} medios · más recientes primero` : 'Clima, producción, transporte y mercado'}</p>
        </div>
        {data && <p className={`text-xs ${stale ? 'text-amber-300' : 'text-slate-500'}`}>Última consulta: <time dateTime={data.updatedAt}>{formatNewsDate(data.updatedAt)}</time></p>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-500" aria-hidden="true" />
          <input type="search" aria-label="Buscar noticias" placeholder="Buscar noticia, producto o fuente…" value={search}
            onChange={(event) => { setSearch(event.target.value); setLimit(6); }}
            className="news-control w-full rounded-xl border border-white/8 bg-surface-850 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500" />
        </div>
        <select aria-label="Filtrar noticias por producto" value={productId} onChange={(event) => { setProductId(event.target.value); setLimit(6); }}
          className="news-control rounded-xl border border-white/8 bg-surface-850 px-4 py-3 text-sm text-slate-300 sm:w-56">
          <option value="">Todos los productos</option>
          {[...products].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((product) => <option key={product.id} value={product.id}>{product.icon} {product.name}</option>)}
        </select>
      </div>

      {hasFilters && <div className="flex items-center justify-between gap-3 text-xs"><p role="status" className="text-slate-400">{filtered.length} {filtered.length === 1 ? 'noticia encontrada' : 'noticias encontradas'}{category !== 'todos' ? ` · ${NEWS_CATEGORIES[category].label}` : ''}</p><button type="button" onClick={clearFilters} className="news-control flex items-center gap-1 rounded text-bull-300"><X size={13} aria-hidden="true" />Limpiar filtros</button></div>}

      {stale && <p role="status" className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-xs leading-relaxed text-amber-200/80">La última consulta tiene más de 3 días. Revisa la fecha de cada noticia; el contexto puede haber cambiado.</p>}

      {error && <div role="alert" className="glass-card flex flex-col items-start justify-between gap-3 rounded-xl p-5 sm:flex-row sm:items-center"><div><p className="text-sm font-medium text-slate-200">No se pudieron cargar las noticias</p><p className="mt-1 text-xs text-slate-400">{data ? 'Mostramos la última consulta disponible.' : 'Puedes seguir consultando los precios e intentarlo de nuevo.'}</p></div><button type="button" onClick={reload} disabled={loading} className="news-control inline-flex items-center gap-2 rounded-lg bg-surface-700 px-3 py-2 text-xs disabled:opacity-50"><RefreshCw size={13} aria-hidden="true" />{loading ? 'Cargando…' : 'Reintentar'}</button></div>}

      {loading && !data ? (
        <div role="status" aria-label="Cargando noticias" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((index) => <div key={index} className="glass-card h-80 animate-pulse rounded-2xl" />)}<span className="sr-only">Cargando noticias…</span></div>
      ) : filtered.length ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.slice(0, limit).map((article) => <NewsCard key={article.id} article={article} products={products} onViewProduct={onViewProduct} />)}</div>
          {limit < filtered.length && <div className="text-center"><button type="button" onClick={() => setLimit((value) => value + 6)} className="news-control rounded-full border border-white/10 bg-surface-800 px-5 py-2.5 text-sm text-slate-200 hover:border-bull-400/40">Ver más noticias ({filtered.length - limit})</button></div>}
        </>
      ) : !error && (
        <div className="glass-card rounded-2xl px-6 py-12 text-center">
          {hasFilters ? <SearchX className="mx-auto text-slate-500" size={28} aria-hidden="true" /> : <Newspaper className="mx-auto text-slate-500" size={28} aria-hidden="true" />}
          <p className="mt-4 text-sm font-semibold text-slate-200">{hasFilters ? 'No hay noticias con estos filtros' : 'Todavía no hay noticias recientes disponibles'}</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">{hasFilters ? 'Prueba otro producto o consulta todos los factores. Una búsqueda sin resultados no significa que el precio vaya a mantenerse.' : 'Las notas aparecerán aquí cuando haya publicaciones relevantes en las fuentes consultadas.'}</p>
          {hasFilters && <button type="button" onClick={clearFilters} className="news-control mt-4 rounded text-xs font-semibold text-bull-300">Ver todas las noticias</button>}
        </div>
      )}

      <aside className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-surface-900/60 p-5">
        <Info size={17} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        <div className="text-xs leading-relaxed text-slate-400"><p className="font-medium text-slate-300">Contexto para entender, no una predicción</p><p className="mt-1">Noticias recopiladas mediante Google Noticias. Los factores y productos se identifican automáticamente en los titulares; la explicación describe un posible mecanismo, no un efecto confirmado. Consulta la nota completa y compara con la fecha de los precios: mayoreo y menudeo corresponden a periodos distintos.</p></div>
      </aside>
    </section>
  );
}
