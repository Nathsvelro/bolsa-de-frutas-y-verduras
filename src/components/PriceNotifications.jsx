import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { formatPercent } from '../utils/format';

function NotificationTimer({ id, onDismiss }) {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onDismiss(id);
    }, 6000);
    return () => clearTimeout(timeoutId);
  }, [id, onDismiss]);

  return null;
}

export default function PriceNotifications({ notifications, onDismiss }) {
  return (
    <div className="fixed top-20 right-3 sm:right-6 z-50 flex flex-col gap-2 w-[calc(100%-1.5rem)] max-w-sm pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => {
          const isUp = n.direction === 'up';
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className={`relative glass-card rounded-xl p-3 pointer-events-auto shadow-lg shadow-black/30 border-l-4 ${
                isUp ? 'border-l-bear-500' : 'border-l-bull-500'
              }`}
            >
              <NotificationTimer id={n.id} onDismiss={onDismiss} />
              <button
                type="button"
                onClick={() => onDismiss(n.id)}
                aria-label="Cerrar notificación"
                className="absolute top-2 right-2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-2.5 pr-5">
                <span className="text-2xl leading-none">{n.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-100 truncate">{n.name}</p>
                  <div
                    className={`flex items-center gap-1 mt-0.5 text-xs font-mono ticker-num ${
                      isUp ? 'text-bear-400' : 'text-bull-400'
                    }`}
                  >
                    {isUp ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    <span>Cambio importante: {formatPercent(n.changePct)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
