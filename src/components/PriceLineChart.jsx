import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { LOCATIONS, getBestLocation, getWorstLocation } from '../data/mockData';
import { formatMXN } from '../utils/format';

function abreviarNombre(name) {
  const palabras = name.split(' ').filter(Boolean);
  if (palabras.length === 1) {
    return palabras[0].slice(0, 3).toUpperCase();
  }
  return palabras
    .map((palabra) => palabra[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

export default function PriceLineChart({ product }) {
  const data = useMemo(() => {
    if (!product) return [];
    return LOCATIONS.map((loc) => ({
      name: loc.name,
      corto: abreviarNombre(loc.name),
      precio: product.prices[loc.id],
    }));
  }, [product]);

  if (!product) {
    return (
      <div className="glass-card rounded-2xl p-6 sm:p-8 flex items-center justify-center text-center min-h-[220px]">
        <p className="text-slate-400 text-sm sm:text-base">
          Selecciona un producto en la tabla para ver el detalle por lugar
        </p>
      </div>
    );
  }

  const bestLocation = getBestLocation(product);
  const worstLocation = getWorstLocation(product);
  const bestPrice = product.prices[bestLocation.id];
  const worstPrice = product.prices[worstLocation.id];

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-lg shadow-black/20 w-full">
      <div className="mb-4">
        <h3 className="font-display text-lg sm:text-xl text-slate-100 flex items-center gap-2">
          <span>{product.icon}</span>
          <span>{product.name}</span>
        </h3>
        <p className="text-slate-400 text-sm">precio por lugar de venta</p>
      </div>

      <div className="w-full">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2233" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip
              contentStyle={{
                background: '#0e131c',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                color: '#e2e8f0',
              }}
              formatter={(value) => [formatMXN(value), 'Precio']}
            />
            <Line
              type="monotone"
              dataKey="precio"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 5, fill: '#10b981' }}
              activeDot={{ r: 7 }}
              isAnimationActive={true}
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-bull-500/10 border border-bull-500/30 p-3">
          <p className="text-xs text-slate-400">Precio mas bajo</p>
          <p className="font-mono ticker-num text-bull-400 text-base sm:text-lg">
            {formatMXN(bestPrice)}
          </p>
          <p className="text-xs text-slate-400 truncate">{bestLocation.name}</p>
        </div>
        <div className="rounded-xl bg-bear-500/10 border border-bear-500/30 p-3">
          <p className="text-xs text-slate-400">Precio mas alto</p>
          <p className="font-mono ticker-num text-bear-400 text-base sm:text-lg">
            {formatMXN(worstPrice)}
          </p>
          <p className="text-xs text-slate-400 truncate">{worstLocation.name}</p>
        </div>
      </div>
    </div>
  );
}
