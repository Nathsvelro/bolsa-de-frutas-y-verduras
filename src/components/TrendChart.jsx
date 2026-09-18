import { useMemo } from 'react';
import {
  ComposedChart,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatMXN, formatDayMonthEsMX } from '../utils/format';

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default function TrendChart({ products, selectedProduct }) {
  const data = useMemo(() => {
    const dates = new Set();
    for (const product of products || []) {
      for (const point of product.history || []) dates.add(point.date);
    }
    const sortedDates = [...dates].sort();

    return sortedDates.map((date) => {
      const values = (products || [])
        .map((p) => p.history?.find((h) => h.date === date)?.price)
        .filter((v) => typeof v === 'number');
      const indice = values.length ? round2(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
      const productoPunto = selectedProduct?.history?.find((h) => h.date === date)?.price;

      return {
        date,
        label: formatDayMonthEsMX(date),
        indice,
        producto: typeof productoPunto === 'number' ? productoPunto : undefined,
      };
    });
  }, [products, selectedProduct]);

  const title = selectedProduct
    ? `Central de Abastos (mayoreo) · últimos 14 días · ${selectedProduct.name}`
    : 'Central de Abastos (mayoreo) · últimos 14 días';

  if (!data.length) {
    return (
      <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-lg shadow-black/20">
        <h3 className="font-display text-sm sm:text-base text-slate-200 mb-4">{title}</h3>
        <div className="flex items-center justify-center py-16 text-center">
          <p className="text-slate-500 text-sm">Sin historial disponible todavía</p>
        </div>
      </div>
    );
  }

  const ChartWrapper = selectedProduct ? ComposedChart : AreaChart;

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-lg shadow-black/20">
      <h3 className="font-display text-sm sm:text-base text-slate-200 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ChartWrapper data={data}>
          <defs>
            <linearGradient id="indiceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2233" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: '#0e131c',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              color: '#e2e8f0',
            }}
            formatter={(value, name) => [
              formatMXN(value),
              name === 'indice' ? 'Índice de mercado' : selectedProduct?.name || 'Producto',
            ]}
          />
          <Area
            type="monotone"
            dataKey="indice"
            stroke="#10b981"
            fill="url(#indiceFill)"
            strokeWidth={2}
            isAnimationActive
            animationDuration={700}
            connectNulls
          />
          {selectedProduct && (
            <Line
              type="monotone"
              dataKey="producto"
              stroke="#f59e0b"
              strokeWidth={3}
              dot={false}
              isAnimationActive
              animationDuration={700}
            />
          )}
        </ChartWrapper>
      </ResponsiveContainer>
    </div>
  );
}
