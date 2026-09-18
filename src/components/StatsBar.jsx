import { motion } from 'framer-motion';
import { BarChart3, PiggyBank, Activity, CalendarClock } from 'lucide-react';
import { getMarketStats } from '../data/priceUtils';
import { formatMXN, formatPercent, formatShortDateEsMX, formatDateRangeEsMX } from '../utils/format';

export default function StatsBar({ products, locations, sources }) {
  const stats = getMarketStats(products, locations);
  const moverHasChange = typeof stats.biggestMover?.changePct === 'number';
  const moverIsUp = moverHasChange && stats.biggestMover.changePct > 0;
  const moverColorClass = moverHasChange ? (moverIsUp ? 'text-bear-400' : 'text-bull-400') : 'text-slate-500';

  const mayoreoDate = sources?.sniim?.dataDate ? formatShortDateEsMX(sources.sniim.dataDate) : null;
  const menudeoRange =
    sources?.profeco?.dataDateFrom && sources?.profeco?.dataDate
      ? formatDateRangeEsMX(sources.profeco.dataDateFrom, sources.profeco.dataDate)
      : null;

  const cards = [
    {
      key: 'avg',
      label: 'Precio promedio (menudeo)',
      icon: BarChart3,
      iconClass: 'text-slate-400',
      content:
        stats.avgPrice !== null ? (
          <span className="font-display text-xl sm:text-2xl text-white">{formatMXN(stats.avgPrice)}</span>
        ) : (
          <span className="font-display text-xl sm:text-2xl text-slate-500">—</span>
        ),
    },
    {
      key: 'savings',
      label: 'Ahorro maximo',
      icon: PiggyBank,
      iconClass: 'text-gold-400',
      content: stats.maxSavings ? (
        <div className="flex flex-col">
          <span className="font-display text-xl sm:text-2xl text-gold-400">
            {formatMXN(stats.maxSavings.savingsAbs)}
          </span>
          <span className="text-slate-400 text-xs truncate">
            en {stats.maxSavings.product.name}
          </span>
        </div>
      ) : (
        <span className="font-display text-xl sm:text-2xl text-slate-500">—</span>
      ),
    },
    {
      key: 'mover',
      label: 'Mayor movimiento (mayoreo · día)',
      icon: Activity,
      iconClass: moverColorClass,
      content: stats.biggestMover ? (
        <div className="flex flex-col">
          <span className="font-display text-xl sm:text-2xl text-white truncate">
            {stats.biggestMover.name}
          </span>
          <span className={`ticker-num text-sm ${moverColorClass}`}>
            {moverHasChange ? formatPercent(stats.biggestMover.changePct) : 's/d'}
          </span>
        </div>
      ) : (
        <span className="font-display text-xl sm:text-2xl text-slate-500">—</span>
      ),
    },
    {
      key: 'updated',
      label: 'Actualizado',
      icon: CalendarClock,
      iconClass: 'text-slate-400',
      content: (
        <div className="flex flex-col">
          <span className="font-display text-xl sm:text-2xl text-white">{mayoreoDate || '—'}</span>
          <span className="text-slate-400 text-xs truncate">
            Menudeo: quincena {menudeoRange || 's/f'}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-2xl p-4 hover:border-white/10 transition-colors"
          >
            <Icon className={`w-5 h-5 mb-2 ${card.iconClass}`} />
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              {card.label}
            </p>
            {card.content}
          </motion.div>
        );
      })}
    </div>
  );
}
