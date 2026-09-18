import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, Newspaper, Radio, RefreshCw } from "lucide-react";
import { usePriceData } from "./hooks/usePriceData";
import { getMarketStats } from "./data/priceUtils";
import { formatMXN, formatPercent, formatShortDateEsMX, formatDateRangeEsMX } from "./utils/format";

import TickerHeader from "./components/TickerHeader";
import StatsBar from "./components/StatsBar";
import HighlightCards from "./components/HighlightCards";
import SearchFilterBar from "./components/SearchFilterBar";
import PriceTable from "./components/PriceTable";
import PriceLineChart from "./components/PriceLineChart";
import PriceHeatmap from "./components/PriceHeatmap";
import TrendChart from "./components/TrendChart";
import SavingsOpportunities from "./components/SavingsOpportunities";
import NewsRadar from "./components/NewsRadar";

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Orden por precio/variación: los productos sin dato (null) siempre van al
// final, sin importar la dirección del orden.
function sortProducts(products, sortBy) {
  const sorted = [...products];
  switch (sortBy) {
    case "precio_asc":
      return sorted.sort((a, b) => {
        if (a.avgPrice === null) return 1;
        if (b.avgPrice === null) return -1;
        return a.avgPrice - b.avgPrice;
      });
    case "precio_desc":
      return sorted.sort((a, b) => {
        if (a.avgPrice === null) return 1;
        if (b.avgPrice === null) return -1;
        return b.avgPrice - a.avgPrice;
      });
    case "variacion_asc":
      return sorted.sort((a, b) => {
        if (a.changePct === null) return 1;
        if (b.changePct === null) return -1;
        return a.changePct - b.changePct;
      });
    case "variacion_desc":
      return sorted.sort((a, b) => {
        if (a.changePct === null) return 1;
        if (b.changePct === null) return -1;
        return b.changePct - a.changePct;
      });
    case "nombre":
    default:
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-card rounded-2xl p-4 h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-6 h-36 animate-pulse" />
        <div className="glass-card rounded-2xl p-6 h-36 animate-pulse" />
      </div>
      <div className="glass-card rounded-2xl h-14 animate-pulse" />
      <div className="glass-card rounded-2xl h-80 animate-pulse" />
      <p className="text-center text-sm text-slate-500">Cargando precios reales…</p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="glass-card rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center gap-3">
      <AlertTriangle className="h-10 w-10 text-bear-400" />
      <p className="text-slate-100 font-medium">No se pudieron cargar los precios</p>
      <p className="text-slate-400 text-sm max-w-md">
        Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, es posible que
        <code className="mx-1 text-slate-300">data/precios.json</code>
        todavía no se haya generado.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-surface-800 px-4 py-2 text-sm font-medium text-slate-200 hover:border-white/20 hover:bg-surface-700 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Reintentar
      </button>
    </div>
  );
}

export default function App() {
  const { products, locations, sources, loading, error, reload } = usePriceData();

  const [search, setSearch] = useState("");
  const [section, setSection] = useState('mercado');
  const [newsProductId, setNewsProductId] = useState('');
  const marketRef = useRef(null);
  const [category, setCategory] = useState("todos");
  const [sortBy, setSortBy] = useState("nombre");
  const [view, setView] = useState("tabla");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [shareFeedback, setShareFeedback] = useState("");

  const marketStats = useMemo(() => getMarketStats(products, locations), [products, locations]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const byFilters = products.filter((p) => {
      const matchesCategory = category === "todos" || p.category === category;
      const matchesSearch = !term || normalize(p.name).includes(term);
      return matchesCategory && matchesSearch;
    });
    return sortProducts(byFilters, sortBy);
  }, [products, search, category, sortBy]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );
  const displayProduct = selectedProduct || marketStats.biggestMover;

  const openNews = useCallback((productId = '') => {
    setNewsProductId(productId);
    setSection('noticias');
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => document.getElementById('news-heading')?.focus({ preventScroll: true }));
  }, []);

  const viewProductFromNews = useCallback((id) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setSelectedProductId(id);
    setSearch(product.name);
    setCategory('todos');
    setView('tabla');
    setSection('mercado');
    requestAnimationFrame(() => {
      marketRef.current?.scrollIntoView({ block: 'start' });
      marketRef.current?.focus({ preventScroll: true });
    });
  }, [products]);

  const handleShare = useCallback(async () => {
    const top = marketStats.opportunities[0];
    const lines = ["📊 Bolsa de Verduras · CDMX"];

    if (marketStats.avgPrice !== null) {
      lines.push(`Precio promedio del mercado (menudeo): ${formatMXN(marketStats.avgPrice)}`);
    }
    if (top) {
      lines.push(
        `Mayor ahorro en el periodo disponible: ${top.product.name} — diferencia de ${formatMXN(top.savingsAbs)} (${formatPercent(
          top.savingsPct,
          { signed: false }
        )}) comprando en ${top.best.name} en vez de ${top.worst.name}`
      );
    }
    if (sources?.sniim?.dataDate) {
      lines.push(`Mayoreo (Central de Abastos): dato del ${formatShortDateEsMX(sources.sniim.dataDate)}`);
    }
    if (sources?.profeco?.dataDateFrom && sources?.profeco?.dataDate) {
      lines.push(
        `Menudeo (PROFECO): quincena ${formatDateRangeEsMX(sources.profeco.dataDateFrom, sources.profeco.dataDate)}`
      );
    }
    const text = lines.join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: "Bolsa de Verduras", text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareFeedback("Comparación copiada al portapapeles");
        setTimeout(() => setShareFeedback(""), 2500);
      }
    } catch {
      // el usuario cancelo el share sheet o el portapapeles no esta disponible
    }
  }, [marketStats, sources]);

  return (
    <div className="min-h-screen pb-16">
      <TickerHeader products={products} sources={sources} onShare={handleShare} />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        <nav aria-label="Secciones del tablero" className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div className="flex gap-1 rounded-xl border border-white/5 bg-surface-900 p-1">
            <button type="button" aria-pressed={section === 'mercado'} onClick={() => setSection('mercado')}
              className={`news-control flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${section === 'mercado' ? 'bg-surface-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <BarChart3 size={16} aria-hidden="true" />Precios
            </button>
            <button type="button" aria-pressed={section === 'noticias'} onClick={() => openNews()}
              className={`news-control flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${section === 'noticias' ? 'bg-surface-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              <Newspaper size={16} aria-hidden="true" />Noticias y contexto
            </button>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">Tu mercado, con perspectiva.</span>
        </nav>

        {section === 'noticias' ? (
          <NewsRadar key={newsProductId} products={products} initialProductId={newsProductId} onViewProduct={viewProductFromNews} />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : loading && !products.length ? (
          <LoadingSkeleton />
        ) : (
          <>
            <StatsBar products={products} locations={locations} sources={sources} />
            <HighlightCards products={products} locations={locations} sources={sources} />

            <button type="button" onClick={() => openNews()}
              className="news-control group flex w-full items-center gap-4 rounded-2xl border border-bull-500/15 bg-bull-500/5 p-4 text-left transition-colors hover:border-bull-400/35 sm:px-5">
              <span className="rounded-xl border border-bull-400/15 bg-bull-400/10 p-2.5 text-bull-300"><Radio size={21} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-200">¿Qué puede mover los precios?</span><span className="mt-1 block text-xs leading-relaxed text-slate-400">Clima, cosechas y transporte. Explora las noticias detrás de tu canasta.</span></span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-bull-300"><span className="hidden sm:inline">Explorar radar</span><ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span>
            </button>

            <div ref={marketRef} tabIndex={-1} className="scroll-mt-32 space-y-4 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-bull-400" aria-label="Comparador de precios">
              <SearchFilterBar
                search={search}
                onSearchChange={setSearch}
                category={category}
                onCategoryChange={setCategory}
                sortBy={sortBy}
                onSortChange={setSortBy}
                view={view}
                onViewChange={setView}
              />
              {selectedProduct && <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                <p className="text-slate-400">Producto seleccionado: <span className="text-slate-200">{selectedProduct.icon} {selectedProduct.name}</span></p>
                <button type="button" onClick={() => openNews(selectedProduct.id)} className="news-control flex items-center gap-1.5 rounded text-bull-300"><Newspaper size={13} aria-hidden="true" />Ver noticias de {selectedProduct.name}<ArrowRight size={13} aria-hidden="true" /></button>
              </div>}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              <div className="xl:col-span-2 space-y-4">
                {view === "tabla" ? (
                  <PriceTable
                    products={filtered}
                    locations={locations}
                    onSelectProduct={setSelectedProductId}
                    selectedProductId={selectedProductId}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {filtered.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedProductId(p.id)}
                          className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition-colors ${
                            displayProduct?.id === p.id
                              ? "bg-bull-500/20 border-bull-500/40 text-bull-300"
                              : "bg-surface-800 border-white/[0.06] text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <span>{p.icon}</span>
                          <span>{p.name}</span>
                        </button>
                      ))}
                    </div>
                    <PriceLineChart product={displayProduct} locations={locations} />
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {view === "tabla" && <PriceLineChart product={displayProduct} locations={locations} />}
                <SavingsOpportunities products={products} locations={locations} sources={sources} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrendChart products={products} selectedProduct={displayProduct} />
              <PriceHeatmap products={filtered} locations={locations} />
            </div>
          </>
        )}
      </main>

      {shareFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-card rounded-full px-4 py-2 text-sm text-slate-100 shadow-lg shadow-black/30">
          {shareFeedback}
        </div>
      )}

      <footer className="text-center text-slate-500 text-xs py-6 px-4 max-w-3xl mx-auto leading-relaxed">
        {sources?.profeco?.status === "error" ? (
          <span className="text-amber-400">menudeo: sin datos · </span>
        ) : null}
        Fuentes:{" "}
        <a
          href={sources?.sniim?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted hover:text-slate-300"
        >
          SNIIM
        </a>{" "}
        (mayoreo, Central de Abasto de Iztapalapa
        {sources?.sniim?.dataDate ? `, dato del ${formatShortDateEsMX(sources.sniim.dataDate)}` : ""}) y{" "}
        <a
          href={sources?.profeco?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted hover:text-slate-300"
        >
          PROFECO Quién es Quién en los Precios
        </a>{" "}
        (menudeo
        {sources?.profeco?.dataDateFrom && sources?.profeco?.dataDate
          ? `, quincena ${formatDateRangeEsMX(sources.profeco.dataDateFrom, sources.profeco.dataDate)}`
          : ""}
        ). Los precios de menudeo pueden tener semanas de antigüedad.
      </footer>
    </div>
  );
}
