import { useMemo } from 'react';
import { LOCATIONS } from '../data/mockData';
import { formatMXN } from '../utils/format';

function cellColor(t) {
  const r = Math.round(16 + t * (239 - 16));
  const g = Math.round(185 + t * (68 - 185));
  const b = Math.round(129 + t * (68 - 129));
  const a = 0.18 + t * 0.5;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function shortLocationName(name) {
  return name.split(' ')[0].slice(0, 5);
}

export default function PriceHeatmap({ products }) {
  const rows = useMemo(() => {
    return (products || []).map((product) => {
      const values = Object.values(product.prices);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      const cells = LOCATIONS.map((loc) => {
        const price = product.prices[loc.id];
        const t = (price - min) / range;
        return { locationId: loc.id, price, t, isBest: price === min };
      });
      return { product, cells };
    });
  }, [products]);

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-lg shadow-black/20">
      <h2 className="font-display text-lg sm:text-xl text-white">
        Mapa de calor de precios
      </h2>
      <p className="text-slate-400 text-xs mt-1">
        Mas oscuro / rojo = mas caro para ese producto
      </p>

      <div className="overflow-x-auto mt-4 rounded-xl">
        <table className="border-separate border-spacing-1 w-full">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface-850/95 backdrop-blur z-10 text-left text-[11px] sm:text-xs text-slate-400 font-sans font-normal pr-2 pb-1 whitespace-nowrap">
                Producto
              </th>
              {LOCATIONS.map((loc) => (
                <th
                  key={loc.id}
                  title={loc.name}
                  className="text-[10px] sm:text-xs text-slate-400 font-sans font-normal pb-1 px-1 min-w-[52px] sm:min-w-[72px] truncate"
                >
                  <div className="truncate">{shortLocationName(loc.name)}</div>
                  <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">
                    {loc.tag}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product, cells }) => (
                <tr key={product.id}>
                  <td className="sticky left-0 bg-surface-850/95 backdrop-blur z-10 text-left text-sm whitespace-nowrap pr-2">
                    <span className="mr-1.5">{product.icon}</span>
                    <span className="truncate max-w-[90px] sm:max-w-none inline-block align-middle">
                      {product.name}
                    </span>
                  </td>
                  {cells.map((cell) => (
                    <td
                      key={cell.locationId}
                      title={`${formatMXN(cell.price)} / kg`}
                      style={{ backgroundColor: cellColor(cell.t) }}
                      className={`rounded-lg text-center text-xs sm:text-sm py-1.5 px-1 ticker-num transition-colors duration-500 ${
                        cell.isBest ? 'ring-1 ring-gold-500/50' : ''
                      }`}
                    >
                      {formatMXN(cell.price)}
                    </td>
                  ))}
                </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <span className="text-[11px] text-bull-400">Barato</span>
        <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-bull-500 to-bear-500" />
        <span className="text-[11px] text-bear-400">Caro</span>
      </div>
    </div>
  );
}
