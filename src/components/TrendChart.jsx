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
import { formatMXN } from '../utils/format';

export default function TrendChart({ products, selectedProduct }) {
  const data = useMemo(() => {
    if (!products || products.length === 0) return [];
    return products[0].history.map((h, i) => {
      const indice =
        Math.round(
          (products.reduce((sum, p) => sum + p.history[i].avg, 0) / products.length) * 100
        ) / 100;
      return {
        day: h.day,
        indice,
        producto: selectedProduct ? selectedProduct.history[i].avg : undefined,
      };
    });
  }, [products, selectedProduct]);

  const title = selectedProduct
    ? `Tendencia de ${selectedProduct.name} vs indice de mercado (7 dias)`
    : 'Indice de mercado — ultimos 7 dias';

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
          <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
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
              name === 'indice' ? 'Indice de mercado' : selectedProduct?.name || 'Producto',
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
