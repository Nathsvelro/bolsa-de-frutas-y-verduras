import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { getBestLocation, getMarketStats } from '../data/mockData';
import { formatMXN, formatPercent } from '../utils/format';

export default function HighlightCards({ products }) {
  const stats = getMarketStats(products);
  const cheapest = stats.cheapest;
  const mostExpensive = stats.mostExpensive;
  const cheapestLocation = getBestLocation(cheapest);
  const mostExpensiveLocation = getBestLocation(mostExpensive);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="glass-card relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-lg shadow-black/20 border border-bull-500/30 hover:border-bull-500/50 transition-colors"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-bull-500/10 to-transparent rounded-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-bull-400">
              Mas Barato Hoy
            </span>
            <TrendingDown className="h-5 w-5 text-bull-400" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-4xl">{cheapest.icon}</span>
            <div>
              <p className="font-sans text-sm text-slate-300">{cheapest.name}</p>
              <p className="font-display text-2xl sm:text-3xl font-bold text-white ticker-num">
                {formatMXN(cheapest.avgPrice)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Mejor en{' '}
              <span className="font-semibold text-slate-200">{cheapestLocation.name}</span>
            </p>
            <span
              className={`font-mono ticker-num text-sm font-semibold ${
                cheapest.changePct > 0 ? 'text-bear-400' : 'text-bull-400'
              }`}
            >
              {formatPercent(cheapest.changePct)}
            </span>
          </div>
        </div>
      </motion.div>

      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="glass-card relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-lg shadow-black/20 border border-bear-500/30 hover:border-bear-500/50 transition-colors"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-bear-500/10 to-transparent rounded-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-bear-400">
              Mas Caro Hoy
            </span>
            <TrendingUp className="h-5 w-5 text-bear-400" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-4xl">{mostExpensive.icon}</span>
            <div>
              <p className="font-sans text-sm text-slate-300">{mostExpensive.name}</p>
              <p className="font-display text-2xl sm:text-3xl font-bold text-white ticker-num">
                {formatMXN(mostExpensive.avgPrice)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Mejor en{' '}
              <span className="font-semibold text-slate-200">{mostExpensiveLocation.name}</span>
            </p>
            <span
              className={`font-mono ticker-num text-sm font-semibold ${
                mostExpensive.changePct > 0 ? 'text-bear-400' : 'text-bull-400'
              }`}
            >
              {formatPercent(mostExpensive.changePct)}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
