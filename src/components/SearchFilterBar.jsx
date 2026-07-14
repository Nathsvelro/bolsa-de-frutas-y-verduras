import { Search, Table2, LineChart as LineChartIcon } from 'lucide-react';
import { CATEGORIES } from '../data/mockData';

const CATEGORY_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'fruta', label: CATEGORIES.fruta.label },
  { value: 'verdura', label: CATEGORIES.verdura.label },
];

const SORT_OPTIONS = [
  { value: 'nombre', label: 'Nombre A-Z' },
  { value: 'precio_asc', label: 'Precio: menor a mayor' },
  { value: 'precio_desc', label: 'Precio: mayor a menor' },
  { value: 'variacion_desc', label: 'Variación: mayor alza' },
  { value: 'variacion_asc', label: 'Variación: mayor baja' },
];

export default function SearchFilterBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sortBy,
  onSortChange,
  view,
  onViewChange,
}) {
  return (
    <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      <div className="relative flex-1 min-w-0 sm:min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full bg-surface-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none border border-transparent focus:border-bull-500/40 transition-colors"
        />
      </div>

      <div className="flex gap-1.5 flex-wrap sm:flex-nowrap">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onCategoryChange(opt.value)}
            className={`px-3 py-2 rounded-full text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap ${
              category === opt.value
                ? 'bg-bull-500/20 text-bull-300 border-bull-500/40'
                : 'bg-surface-800 text-slate-400 border-transparent hover:border-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="bg-surface-800 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none border border-transparent focus:border-bull-500/40 transition-colors"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="flex bg-surface-800 rounded-xl p-1 self-start sm:self-auto shrink-0">
        <button
          type="button"
          onClick={() => onViewChange('tabla')}
          aria-label="Ver como tabla"
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            view === 'tabla' ? 'bg-surface-700 text-white' : 'text-slate-500'
          }`}
        >
          <Table2 className="h-4 w-4" />
          <span className="hidden sm:inline">Tabla</span>
        </button>
        <button
          type="button"
          onClick={() => onViewChange('grafico')}
          aria-label="Ver como gráfico"
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            view === 'grafico' ? 'bg-surface-700 text-white' : 'text-slate-500'
          }`}
        >
          <LineChartIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Gráfico</span>
        </button>
      </div>
    </div>
  );
}
