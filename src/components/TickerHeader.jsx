import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Share2 } from 'lucide-react';
import { formatMXN, formatPercent, formatShortDateEsMX, formatDateRangeEsMX } from '../utils/format';

export default function TickerHeader({ products, sources, onShare }) {
  const [isPaused, setIsPaused] = useState(false);

  const tapeItems = useMemo(() => products.concat(products), [products]);

  const mayoreoDate = sources?.sniim?.dataDate ? formatShortDateEsMX(sources.sniim.dataDate) : null;
  const menudeoRange =
    sources?.profeco?.dataDateFrom && sources?.profeco?.dataDate
      ? formatDateRangeEsMX(sources.profeco.dataDateFrom, sources.profeco.dataDate)
      : null;

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="sticky top-0 z-30 bg-surface-950/90 backdrop-blur border-b border-white/[0.06]"
    >
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <TrendingUp className="shrink-0 text-bull-400" size={22} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-sm font-bold leading-none tracking-tight sm:text-lg">
              BOLSA DE VERDURAS
            </h1>
            <p className="mt-0.5 hidden text-xs text-slate-400 sm:block">CDMX · Datos reales</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-surface-800/70 px-2 py-1 sm:px-3 sm:py-1.5">
            <span className="h-2 w-2 rounded-full bg-bull-500" />
            <span className="text-[10px] font-semibold tracking-wide text-slate-200 sm:text-xs">
              DATOS REALES
            </span>
          </div>

          <div className="flex flex-col items-end leading-tight">
            <span className="ticker-num text-[10px] text-slate-400 sm:text-xs">
              Mayoreo · <span className="text-slate-300">{mayoreoDate || 's/f'}</span>
            </span>
            {menudeoRange && (
              <span className="ticker-num hidden text-[10px] text-slate-400 sm:block sm:text-xs">
                Menudeo · <span className="text-slate-300">{menudeoRange}</span>
              </span>
            )}
          </div>

          <motion.button
            type="button"
            onClick={onShare}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 rounded-full border border-white/5 bg-surface-800/70 px-2 py-1 transition-colors hover:border-white/10 hover:bg-surface-700 sm:px-3 sm:py-1.5"
          >
            <Share2 size={14} className="text-slate-300" />
            <span className="hidden text-xs font-medium text-slate-200 sm:inline">Compartir</span>
          </motion.button>
        </div>
      </div>

      <div
        className="overflow-hidden border-t border-white/[0.04] bg-surface-900/60 py-1.5 sm:py-2"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className="flex w-max gap-8 px-4 animate-ticker"
          style={isPaused ? { animationPlayState: 'paused' } : undefined}
        >
          {tapeItems.map((product, idx) => {
            const hasChange = typeof product.changePct === 'number';
            const isUp = hasChange && product.changePct > 0;
            const isDown = hasChange && product.changePct < 0;
            const colorClass = !hasChange
              ? 'text-slate-500'
              : isUp
              ? 'text-bear-400'
              : isDown
              ? 'text-bull-400'
              : 'text-slate-400';
            return (
              <div
                key={`${product.id}-${idx}`}
                className="flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm"
              >
                <span className="text-base">{product.icon}</span>
                <span className="font-medium text-slate-200">{product.name}</span>
                <span className="ticker-num text-slate-300">
                  {product.avgPrice !== null ? formatMXN(product.avgPrice) : '—'}
                </span>
                <span className={`ticker-num flex items-center gap-0.5 font-semibold ${colorClass}`}>
                  {hasChange && isUp ? <TrendingUp size={12} /> : null}
                  {hasChange && isDown ? <TrendingDown size={12} /> : null}
                  {hasChange ? formatPercent(product.changePct) : 's/d'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.header>
  );
}
