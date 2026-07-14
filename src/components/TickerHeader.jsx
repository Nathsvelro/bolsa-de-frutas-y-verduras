import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Share2 } from 'lucide-react';
import { formatMXN, formatPercent, formatRelativeTime, formatClock } from '../utils/format';

export default function TickerHeader({ products, updatedAt, isLive, onToggleLive, onShare }) {
  const [isPaused, setIsPaused] = useState(false);

  const tapeItems = useMemo(() => products.concat(products), [products]);

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
            <p className="mt-0.5 hidden text-xs text-slate-400 sm:block">
              CDMX · Mercado en vivo
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <motion.button
            type="button"
            onClick={onToggleLive}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 rounded-full border border-white/5 bg-surface-800/70 px-2 py-1 transition-colors hover:border-white/10 sm:px-3 sm:py-1.5"
          >
            <span
              className={
                isLive
                  ? 'h-2 w-2 rounded-full bg-bull-500 animate-pulse-live'
                  : 'h-2 w-2 rounded-full bg-slate-500'
              }
            />
            <span className="text-[10px] font-semibold tracking-wide text-slate-200 sm:text-xs">
              {isLive ? 'EN VIVO' : 'PAUSADO'}
            </span>
          </motion.button>

          <div className="hidden flex-col items-end leading-tight md:flex">
            <span className="text-xs text-slate-400">
              Actualizado {formatRelativeTime(updatedAt)}
            </span>
            <span className="ticker-num text-xs text-slate-500">{formatClock(updatedAt)}</span>
          </div>

          <span className="ticker-num text-xs text-slate-400 md:hidden">
            {formatClock(updatedAt)}
          </span>

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
            const isUp = product.changePct > 0;
            const isDown = product.changePct < 0;
            const colorClass = isUp
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
                <span className="ticker-num text-slate-300">{formatMXN(product.avgPrice)}</span>
                <span className={`ticker-num flex items-center gap-0.5 font-semibold ${colorClass}`}>
                  {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : null}
                  {formatPercent(product.changePct)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.header>
  );
}
