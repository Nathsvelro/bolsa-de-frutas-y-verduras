# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

"Bolsa de Frutas y Verduras": dashboard tipo bolsa de valores que compara precios de frutas y verduras en 8 puntos de venta de la Ciudad de México (7 de menudeo + Central de Abastos al mayoreo). SPA en React 19 + Vite 8, sin backend propio. Toda la UI y los comentarios están en español (es-MX); los precios se formatean como MXN.

Los precios son **reales**: un pipeline en `scripts/` (ver `docs/datos.md`) descarga SNIIM (mayoreo) y PROFECO "Quién es Quién en los Precios" (menudeo), y genera `public/data/precios.json`. La sección "Noticias y contexto" lee aparte `public/data/noticias.json` (titulares RSS de Google Noticias clasificados por factor; ver `docs/noticias.md`). La app solo lee esos dos JSON estáticos.

## Comandos

```bash
npm run dev          # servidor Vite en http://localhost:5173 (también definido en .claude/launch.json para la vista previa)
npm run build        # build de producción en dist/
npm run preview      # sirve dist/
npm run lint         # oxlint (plugins react + oxc; rules-of-hooks es error)

npm run datos:sniim    # descarga/normaliza SNIIM -> data/sniim.json, data/sniim-historial.json
npm run datos:profeco  # descarga/normaliza PROFECO -> data/profeco.json
npm run datos:build    # une catálogo + data/*.json -> public/data/precios.json
npm run datos           # los tres anteriores en orden (no incluye noticias)
npm run datos:noticias  # RSS de Google Noticias -> public/data/noticias.json (NOTICIAS_RSS=archivo.xml para no usar red)

npm test              # node --test scripts/*.test.mjs (pipeline y utilidades de noticias, sin red)
```

Despliegue: el repo está en GitHub (`Nathsvelro/bolsa-de-frutas-y-verduras`) pensado para Vercel, que detecta Vite sin configuración extra. Un workflow de GitHub Actions (`.github/workflows/actualizar-precios.yml`) corre el pipeline y hace commit de los datos nuevos.

## Arquitectura

### Flujo de datos

`scripts/catalogo.mjs` es el catálogo compartido (qué productos y lugares existen, cómo se localizan en cada fuente); solo lo usa el pipeline de `scripts/`, la app **no** lo importa. El contrato completo del formato de `public/data/precios.json` (fuentes, reglas de normalización, semántica de cada campo) está documentado al detalle en `docs/datos.md` — leerlo antes de tocar cualquier parte de este flujo.

`src/hooks/usePriceData.js` es el dueño del estado en la app: hace `fetch(BASE_URL + 'data/precios.json', { cache: 'no-store' })`, expone `{ products, locations, sources, generatedAt, loading, error, reload }`, y deriva por producto lo que el JSON no trae:

- `avgPrice`: media de los precios de menudeo no nulos (todos los lugares menos `central_abastos`); si no hay ninguno, cae a `central_abastos`.
- `changePct`: variación entre los dos últimos puntos de `history` (serie diaria de `central_abastos`/SNIIM); `null` si no hay dos.
- `flash`: `'up' | 'down'` según el signo de `changePct`, solo la primera vez que los datos cargan; se limpia a los 1.5 s (animación de `PriceTable` al entrar).

`src/data/priceUtils.js` son helpers puros y null-safe que reciben `locations` como parámetro (no hay catálogo global en la app): `getRetailLocations`, `getBestLocation`/`getWorstLocation` (ignoran `null`, devuelven `null` si no hay precios), `getSavingsOpportunities` (solo productos con ≥ 2 precios de menudeo no nulos), `getMarketStats`, `formatUnit`, y el catálogo estático `CATEGORIES` (etiquetas de fruta/verdura). Los componentes reciben `products` y `locations` y llaman a estos helpers ellos mismos; no hay un store global de estadísticas.

Forma de cada producto que consumen los componentes (JSON + derivados del hook):

```
{ id, name, icon, category, unit: 'kg' | 'pieza' | 'manojo',
  prices: { [locationId]: number | null }, prevPrices, detail: { [locationId]: {...} | null },
  history: [{ date: 'AAAA-MM-DD', price }] (serie diaria de central_abastos, hasta 14 puntos),
  avgPrice, changePct, flash: 'up' | 'down' | null }
```

Cualquier lugar del catálogo puede venir en `null` (sin dato comparable o sin observaciones esa quincena); los componentes deben tratarlo como "—" / "s/d", nunca como 0.

### Noticias

`App` alterna entre dos secciones (`'mercado' | 'noticias'`); `NewsRadar` se monta solo en la segunda y se remonta con `key={newsProductId}` cuando se llega desde "Ver noticias de {producto}". `src/hooks/useNewsData.js` descarga `noticias.json` y lo cachea a nivel de módulo (un remontaje no vuelve a descargar; "Reintentar" sí). `src/data/newsUtils.js` valida el contrato en el cliente (`parseNewsData` rechaza enlaces no HTTP, fechas futuras y categorías desconocidas) y filtra; sus pruebas viven en `scripts/news-ui.test.mjs` porque son módulos puros. La clasificación por titular (`scripts/lib/noticias.mjs`) es orientativa y la UI lo dice: el `context` de cada nota es un mecanismo posible, no un pronóstico.

### Convención de colores (no intuitiva)

Los tokens se llaman como en bolsa (`bull-*` verde, `bear-*` rojo) pero la semántica está **invertida respecto a una bolsa real**: una **subida** de precio se pinta en rojo (`bear`) y una **bajada** en verde (`bull`), porque para el comprador lo bueno es que baje. `gold-*` marca el mejor precio. Esta regla se repite en `TickerHeader`, `PriceTable`, `StatsBar` y `HighlightCards`; mantenerla al agregar componentes.

### Estilos

Tailwind v4 vía `@tailwindcss/vite`: **no hay `tailwind.config.js`**. Los tokens de tema (`surface-*`, `bull-*`, `bear-*`, `gold-*`, fuentes `font-display`/`font-sans`/`font-mono`, y las animaciones `animate-pulse-live`, `animate-flash-up/down`, `animate-ticker`, `animate-rise`) se declaran en el bloque `@theme` de `src/index.css`, junto con los keyframes y las utilidades compuestas `.glass-card` y `.ticker-num`. Las fuentes (Inter, Space Grotesk, JetBrains Mono) se cargan desde Google Fonts en `index.html`.

Las gráficas usan Recharts con `ResponsiveContainer` de altura fija y colores hardcodeados en hex que coinciden con los tokens del tema (Recharts no lee clases de Tailwind).

### Composición de la UI (`src/App.jsx`)

`App` es el único lugar con estado de UI: búsqueda (normaliza acentos), filtro por categoría, orden, vista `'tabla' | 'grafico'` y `selectedProductId`. Cuando no hay producto seleccionado, el detalle (`PriceLineChart`, `TrendChart`) muestra `marketStats.biggestMover`. El botón Compartir usa `navigator.share` con fallback a portapapeles.

El heatmap y la tabla reciben la lista **filtrada**; las tarjetas de estadísticas, oportunidades y el ticker reciben la lista **completa**.
