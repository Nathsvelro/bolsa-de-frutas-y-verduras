import { motion } from 'framer-motion';
import { PiggyBank } from 'lucide-react';
import { getSavingsOpportunities } from '../data/priceUtils';
import { formatMXN, formatPercent } from '../utils/format';

export default function SavingsOpportunities({ products, locations }) {
  const opportunities = getSavingsOpportunities(products, locations).slice(0, 5);

  if (!opportunities.length) {
    return (
      <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2 mb-1">
          <PiggyBank className="w-5 h-5 text-gold-400" />
          <h2 className="font-display text-lg sm:text-xl text-white">
            Oportunidades de ahorro
          </h2>
        </div>
        <p className="text-slate-500 text-sm mt-4 text-center">Sin datos suficientes todavía</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-lg shadow-black/20">
      <div className="flex items-center gap-2 mb-1">
        <PiggyBank className="w-5 h-5 text-gold-400" />
        <h2 className="font-display text-lg sm:text-xl text-white">
          Oportunidades de ahorro
        </h2>
      </div>
      <p className="text-slate-400 text-xs mb-4">
        La mayor diferencia de precio entre lugares, hoy
      </p>

      <div className="space-y-2 sm:space-y-3">
          {opportunities.map((opportunity) => (
            <motion.div
              key={opportunity.product.id}
              whileHover={{ scale: 1.02 }}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/60 hover:bg-surface-800 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0">{opportunity.product.icon}</span>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">
                    {opportunity.product.name}
                  </p>
                  <p className="text-slate-400 text-xs truncate">
                    {opportunity.best.name} vs {opportunity.worst.name}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="font-display text-lg sm:text-xl text-bull-400 font-semibold">
                  {formatMXN(opportunity.savingsAbs)}
                </p>
                <p className="text-slate-400 text-xs">
                  {formatPercent(opportunity.savingsPct, { signed: false })} de ahorro
                </p>
              </div>
            </motion.div>
          ))}
      </div>
    </div>
  );
}
