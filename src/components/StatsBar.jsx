import { motion } from 'framer-motion';
import { BarChart3, PiggyBank, Activity, ListChecks } from 'lucide-react';
import { getMarketStats } from '../data/mockData';
import { formatMXN, formatPercent } from '../utils/format';

export default function StatsBar({ products }) {
  const stats = getMarketStats(products);
  const moverIsUp = stats.biggestMover.changePct > 0;
  const moverColorClass = moverIsUp ? 'text-bear-400' : 'text-bull-400';

  const cards = [
    {
      key: 'avg',
      label: 'Precio promedio',
      icon: BarChart3,
      iconClass: 'text-slate-400',
      content: (
        <span className="font-display text-xl sm:text-2xl text-white">
          {formatMXN(stats.avgPrice)}
          <span className="text-slate-400 text-sm font-sans"> /kg</span>
        </span>
      ),
    },
    {
      key: 'savings',
      label: 'Ahorro maximo',
      icon: PiggyBank,
      iconClass: 'text-gold-400',
      content: (
        <div className="flex flex-col">
          <span className="font-display text-xl sm:text-2xl text-gold-400">
            {formatMXN(stats.maxSavings.savingsAbs)}
          </span>
          <span className="text-slate-400 text-xs truncate">
            en {stats.maxSavings.product.name}
          </span>
        </div>
      ),
    },
    {
      key: 'mover',
      label: 'Mayor movimiento',
      icon: Activity,
      iconClass: moverColorClass,
      content: (
        <div className="flex flex-col">
          <span className="font-display text-xl sm:text-2xl text-white truncate">
            {stats.biggestMover.name}
          </span>
          <span className={`ticker-num text-sm ${moverColorClass}`}>
            {formatPercent(stats.biggestMover.changePct)}
          </span>
        </div>
      ),
    },
    {
      key: 'count',
      label: 'Productos monitoreados',
      icon: ListChecks,
      iconClass: 'text-slate-400',
      content: (
        <span className="font-display text-xl sm:text-2xl text-white">
          {products.length}
        </span>
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
