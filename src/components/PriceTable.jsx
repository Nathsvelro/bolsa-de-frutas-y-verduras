import { SearchX } from 'lucide-react';
import { getBestLocation, getRetailLocations, formatUnit } from '../data/priceUtils';
import { formatMXN, formatPercent, formatShortDateEsMX } from '../utils/format';

function cellTitle(detail) {
  if (!detail) return undefined;
  const parts = [];
  if (detail.date) parts.push(formatShortDateEsMX(detail.date));
  if (typeof detail.n === 'number') parts.push(`${detail.n} obs.`);
  if (detail.presentation) parts.push(detail.presentation);
  if (detail.variety) parts.push(detail.variety);
  if (!parts.length && detail.note) parts.push(detail.note);
  return parts.join(' · ') || undefined;
}

export default function PriceTable({ products, locations, onSelectProduct, selectedProductId }) {
  const retailLocations = getRetailLocations(locations);

  if (!products.length) {
    return (
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-slate-500">
          <SearchX className="h-10 w-10" />
          <p className="text-sm font-medium">No se encontraron productos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden shadow-lg shadow-black/20">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="sticky left-0 z-20 bg-surface-850/95 backdrop-blur px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Producto
              </th>
              {locations.map((loc) => (
                <th
                  key={loc.id}
                  className="px-2 sm:px-3 py-2.5 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap"
                >
                  <span title={loc.name} className="hidden sm:block truncate mx-auto">
                    {loc.name}
                  </span>
                  <span title={loc.name} className="block sm:hidden truncate mx-auto">
                    {loc.short}
                  </span>
                  <span className="block text-[9px] sm:text-[10px] font-normal normal-case text-slate-600">
                    {loc.tag}
                  </span>
                </th>
              ))}
              <th className="px-2 sm:px-3 py-2.5 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                Var. mayoreo
                <span className="block text-[9px] sm:text-[10px] font-normal normal-case text-slate-600">
                  día
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const best = getBestLocation(product, retailLocations);
              const hasChange = typeof product.changePct === 'number';
              const isUp = hasChange && product.changePct > 0;
              const isDown = hasChange && product.changePct < 0;
              const isSelected = product.id === selectedProductId;
              const flashClass =
                product.flash === 'up'
                  ? 'animate-flash-up'
                  : product.flash === 'down'
                    ? 'animate-flash-down'
                    : '';

              return (
                <tr
                  key={product.id}
                  onClick={() => onSelectProduct(product.id)}
                  className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-surface-800/60 ${flashClass} ${
                    isSelected
                      ? 'bg-surface-800 border-l-2 border-bull-400'
                      : 'border-l-2 border-transparent'
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 px-3 py-2 backdrop-blur ${
                      isSelected ? 'bg-surface-800' : 'bg-surface-850/95'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg sm:text-xl">{product.icon}</span>
                      <div className="flex flex-col leading-tight">
                        <span className="font-display text-sm font-medium text-white whitespace-nowrap">
                          {product.name}
                        </span>
                        <span className="text-[10px] text-slate-500">{formatUnit(product.unit)}</span>
                      </div>
                    </div>
                  </td>
                  {locations.map((loc) => {
                    const price = product.prices[loc.id];
                    const hasPrice = typeof price === 'number';
                    const isBest = hasPrice && best?.id === loc.id;
                    return (
                      <td
                        key={loc.id}
                        title={cellTitle(product.detail?.[loc.id])}
                        className="px-2 sm:px-3 py-2 text-center whitespace-nowrap"
                      >
                        {hasPrice ? (
                          <span
                            className={`ticker-num inline-block px-2 py-0.5 ${
                              isBest
                                ? 'rounded-lg ring-1 ring-bull-500/30 font-semibold text-bull-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {formatMXN(price)}
                          </span>
                        ) : (
                          <span className="ticker-num inline-block px-2 py-0.5 text-slate-600">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 sm:px-3 py-2 text-center whitespace-nowrap">
                    {hasChange ? (
                      <span
                        className={`ticker-num inline-flex items-center gap-1 font-semibold ${
                          isUp ? 'text-bear-400' : isDown ? 'text-bull-400' : 'text-slate-400'
                        }`}
                      >
                        {isUp ? '↑' : isDown ? '↓' : '—'}
                        {formatPercent(product.changePct)}
                      </span>
                    ) : (
                      <span className="ticker-num text-slate-600">s/d</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
