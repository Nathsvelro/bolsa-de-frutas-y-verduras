# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

"Bolsa de Verduras": dashboard tipo bolsa de valores que compara precios de frutas y verduras en 7 puntos de venta de la Ciudad de México. SPA en React 19 + Vite 8, sin backend. Toda la UI y los comentarios están en español (es-MX); los precios se formatean como MXN por kg.

Los precios actuales son **simulados** (ver `src/data/mockData.js`); el footer lo advierte. No presentar los datos como reales.

## Comandos

```bash
npm run dev       # servidor Vite en http://localhost:5173 (también definido en .claude/launch.json para la vista previa)
npm run build     # build de producción en dist/
npm run preview   # sirve dist/
npm run lint      # oxlint (plugins react + oxc; rules-of-hooks es error)
```

No hay suite de pruebas.

Despliegue: el repo está en GitHub (`Nathsvelro/bolsa-de-verduras`) pensado para Vercel, que detecta Vite sin configuración extra.

## Arquitectura

### Flujo de datos

`src/data/mockData.js` es la única fuente del dominio y concentra tres cosas:

- Catálogos: `LOCATIONS` (7 lugares, cada uno con `factor` de precio relativo y `volatility`) y `PRODUCTS_META` (20 productos con `basePrice` y `category` = `'fruta' | 'verdura'`).
- Motor de simulación: `generateInitialDataset()` genera el dataset inicial de forma **determinista** (PRNG mulberry32 con semilla fija) y `simulateTick()` aplica un paseo aleatorio a un subconjunto de productos y devuelve además las notificaciones de cambios "importantes" (|changePct| ≥ 4.5 %).
- Derivados: `getBestLocation`, `getWorstLocation`, `getSavingsOpportunities`, `getMarketStats`. Los componentes reciben el arreglo `products` crudo y llaman a estos helpers ellos mismos; no hay un store global de estadísticas.

`src/hooks/usePriceSimulation.js` es el dueño del estado: carga el dataset desde `localStorage` (clave `bolsa-de-verduras:dataset`) o genera uno nuevo, lo persiste en cada cambio, ejecuta `simulateTick` cada 4.5 s mientras `isLive` es true y mantiene como máximo 6 notificaciones. Para "reiniciar" la app en desarrollo hay que borrar esa clave de localStorage (o usar `reset()` del hook, que hoy no está conectado a la UI).

Forma de cada producto en el estado:

```
{ id, name, icon, category, basePrice, unit: 'kg',
  prices: { [locationId]: number }, prevPrices,
  avgPrice, prevAvgPrice, changePct,
  history: [{ day, avg }] (7 entradas; la última es "Hoy" y se sobrescribe en cada tick),
  lastChangedAt, flash: 'up' | 'down' | null }
```

`flash` solo vive un tick: `PriceTable` lo usa para la animación de fondo y `simulateTick` lo limpia en los productos que no cambiaron.

### Convención de colores (no intuitiva)

Los tokens se llaman como en bolsa (`bull-*` verde, `bear-*` rojo) pero la semántica está **invertida respecto a una bolsa real**: una **subida** de precio se pinta en rojo (`bear`) y una **bajada** en verde (`bull`), porque para el comprador lo bueno es que baje. `gold-*` marca el mejor precio. Esta regla se repite en `TickerHeader`, `PriceTable`, `StatsBar`, `HighlightCards` y `PriceNotifications`; mantenerla al agregar componentes.

### Estilos

Tailwind v4 vía `@tailwindcss/vite`: **no hay `tailwind.config.js`**. Los tokens de tema (`surface-*`, `bull-*`, `bear-*`, `gold-*`, fuentes `font-display`/`font-sans`/`font-mono`, y las animaciones `animate-pulse-live`, `animate-flash-up/down`, `animate-ticker`, `animate-rise`) se declaran en el bloque `@theme` de `src/index.css`, junto con los keyframes y las utilidades compuestas `.glass-card` y `.ticker-num`. Las fuentes (Inter, Space Grotesk, JetBrains Mono) se cargan desde Google Fonts en `index.html`.

Las gráficas usan Recharts con `ResponsiveContainer` de altura fija y colores hardcodeados en hex que coinciden con los tokens del tema (Recharts no lee clases de Tailwind).

### Composición de la UI (`src/App.jsx`)

`App` es el único lugar con estado de UI: búsqueda (normaliza acentos), filtro por categoría, orden, vista `'tabla' | 'grafico'` y `selectedProductId`. Cuando no hay producto seleccionado, el detalle (`PriceLineChart`, `TrendChart`) muestra `marketStats.biggestMover`. El botón Compartir usa `navigator.share` con fallback a portapapeles.

El heatmap y la tabla reciben la lista **filtrada**; las tarjetas de estadísticas, oportunidades y el ticker reciben la lista **completa**.
