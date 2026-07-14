import { useMemo, useState, useCallback } from "react";
import { usePriceSimulation } from "./hooks/usePriceSimulation";
import { getMarketStats } from "./data/mockData";
import { formatMXN, formatPercent, formatClock } from "./utils/format";

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

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sortProducts(products, sortBy) {
  const sorted = [...products];
  switch (sortBy) {
    case "precio_asc":
      return sorted.sort((a, b) => a.avgPrice - b.avgPrice);
    case "precio_desc":
      return sorted.sort((a, b) => b.avgPrice - a.avgPrice);
    case "variacion_asc":
      return sorted.sort((a, b) => a.changePct - b.changePct);
    case "variacion_desc":
      return sorted.sort((a, b) => b.changePct - a.changePct);
    case "nombre":
    default:
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
}

export default function App() {
  const { products, updatedAt, isLive, setIsLive, notifications, dismissNotification } =
    usePriceSimulation();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  const [sortBy, setSortBy] = useState("nombre");
  const [view, setView] = useState("tabla");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [shareFeedback, setShareFeedback] = useState("");

  const marketStats = useMemo(() => getMarketStats(products), [products]);

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
    const text = [
      "📊 Bolsa de Verduras · CDMX",
      `Precio promedio del mercado: ${formatMXN(marketStats.avgPrice)}/kg`,
      `Mayor ahorro hoy: ${top.product.name} — ahorra ${formatMXN(top.savingsAbs)} (${formatPercent(
        top.savingsPct,
        { signed: false }
      )}) comprando en ${top.best.name} en vez de ${top.worst.name}`,
      `Actualizado ${formatClock(updatedAt)}`,
    ].join("\n");

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
  }, [marketStats, updatedAt]);

  return (
    <div className="min-h-screen pb-16">
      <TickerHeader
        products={products}
        updatedAt={updatedAt}
        isLive={isLive}
        onToggleLive={() => setIsLive((v) => !v)}
        onShare={handleShare}
      />
      <PriceNotifications notifications={notifications} onDismiss={dismissNotification} />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        <StatsBar products={products} />
        <HighlightCards products={products} />

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
                <PriceLineChart product={displayProduct} />
              </div>
            )}
          </div>

          <div className="space-y-6">
            {view === "tabla" && <PriceLineChart product={displayProduct} />}
            <SavingsOpportunities products={products} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrendChart products={products} selectedProduct={displayProduct} />
          <PriceHeatmap products={filtered} />
        </div>
      </main>

      {shareFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-card rounded-full px-4 py-2 text-sm text-slate-100 shadow-lg shadow-black/30">
          {shareFeedback}
        </div>
      )}

      <footer className="text-center text-slate-600 text-xs py-6">
        Precios de ejemplo con fines demostrativos — no reflejan cotizaciones reales del mercado.
      </footer>
    </div>
  );
}
