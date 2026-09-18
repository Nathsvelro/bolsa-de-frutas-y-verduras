import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { usePriceData } from "./hooks/usePriceData";
import { getMarketStats } from "./data/priceUtils";
import { formatMXN, formatPercent, formatShortDateEsMX, formatDateRangeEsMX } from "./utils/format";

import TickerHeader from "./components/TickerHeader";
import PriceNotifications from "./components/PriceNotifications";
import StatsBar from "./components/StatsBar";
import HighlightCards from "./components/HighlightCards";
import SearchFilterBar from "./components/SearchFilterBar";
import PriceTable from "./components/PriceTable";
import PriceLineChart from "./components/PriceLineChart";
import PriceHeatmap from "./components/PriceHeatmap";
import TrendChart from "./components/TrendChart";
import SavingsOpportunities from "./components/SavingsOpportunities";

const NOTIFICATION_THRESHOLD = 4.5;
const MAX_NOTIFICATIONS = 4;

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
  const [category, setCategory] = useState("todos");
  const [sortBy, setSortBy] = useState("nombre");
  const [view, setView] = useState("tabla");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [shareFeedback, setShareFeedback] = useState("");
  const [notifications, setNotifications] = useState([]);
  const notifiedRef = useRef(false);

  const marketStats = useMemo(() => getMarketStats(products, locations), [products, locations]);

  // Notificaciones de cambios importantes en mayoreo, generadas una sola vez
  // cuando los datos terminan de cargar.
  useEffect(() => {
    if (notifiedRef.current || loading || error || !products.length) return;
    notifiedRef.current = true;

    const now = Date.now();
    const relevant = products
      .filter((p) => typeof p.changePct === "number" && Math.abs(p.changePct) >= NOTIFICATION_THRESHOLD)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, MAX_NOTIFICATIONS)
      .map((p) => ({
        id: `${p.id}-${now}`,
        productId: p.id,
        name: p.name,
        icon: p.icon,
        changePct: p.changePct,
        direction: p.changePct > 0 ? "up" : "down",
        timestamp: now,
      }));

    if (relevant.length) setNotifications(relevant);
  }, [products, loading, error]);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

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

  const handleShare = useCallback(async () => {
    const top = marketStats.opportunities[0];
    const lines = ["📊 Bolsa de Verduras · CDMX"];

    if (marketStats.avgPrice !== null) {
      lines.push(`Precio promedio del mercado (menudeo): ${formatMXN(marketStats.avgPrice)}`);
    }
    if (top) {
      lines.push(
        `Mayor ahorro hoy: ${top.product.name} — ahorra ${formatMXN(top.savingsAbs)} (${formatPercent(
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
      <PriceNotifications notifications={notifications} onDismiss={dismissNotification} />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        {error ? (
          <ErrorState onRetry={reload} />
        ) : loading && !products.length ? (
          <LoadingSkeleton />
        ) : (
          <>
            <StatsBar products={products} locations={locations} sources={sources} />
            <HighlightCards products={products} locations={locations} />

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
                <SavingsOpportunities products={products} locations={locations} />
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
