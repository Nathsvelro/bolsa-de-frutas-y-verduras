# Bolsa de Frutas y Verduras · CDMX

Un tablero tipo **bolsa de valores** para comparar, con datos reales, cuánto cuestan las frutas y verduras en la Ciudad de México: precios al mayoreo de la Central de Abastos actualizados a diario y precios al menudeo de siete cadenas y mercados, más un radar de noticias para entender qué puede estar moviendo esos precios.

Hecho con React 19, Vite 8, Tailwind CSS v4, Recharts y Framer Motion. Sin backend: un pipeline en GitHub Actions genera dos archivos JSON estáticos y Vercel publica la app.

## Qué muestra

- **Tabla comparativa** de 20 productos × 8 lugares con el mejor precio de menudeo destacado, la unidad real de cada producto (kg, pieza o manojo) y un tooltip por celda con la fecha del dato, el número de observaciones y la presentación.
- **Variación diaria** (flechas, ticker y notificaciones de cambios fuertes) calculada sobre el mayoreo, que es la única serie que se mueve cada día.
- **Tendencia de 14 días** del índice de mercado y del producto seleccionado, **gráfica de precio por lugar** y **mapa de calor**.
- **Estadísticas rápidas** (precio promedio de menudeo, ahorro máximo, mayor movimiento, fecha de actualización), tarjetas de más barato / más caro y **oportunidades de ahorro** entre tiendas.
- **Buscador**, filtro frutas/verduras, orden por precio o variación, vista tabla/gráfico y botón de compartir.
- **Noticias y contexto**: titulares recientes del sector clasificados por factor (clima, cosechas, transporte, mercado) y relacionados con los productos del catálogo, con enlace directo a sus precios.
- Diseño oscuro, responsive (pensado para verse bien en móvil) y con animaciones respetuosas de `prefers-reduced-motion`.

## De dónde salen los datos

| Fuente | Qué aporta | Lugares | Frecuencia | Retraso típico |
|---|---|---|---|---|
| [SNIIM](https://www.economia-sniim.gob.mx/) (Secretaría de Economía) | Precios al **mayoreo** en la Central de Abasto de Iztapalapa, por kilo | Central de Abastos | Diaria (lun–vie) | Mismo día |
| [PROFECO · Quién es Quién en los Precios](https://datos.profeco.gob.mx/datos_abiertos/qqp.php) | Precios al **menudeo** levantados en sucursales de CDMX | Walmart, Walmart Express (antes Superama), Bodega Aurrera, Soriana, Chedraui, La Comer, Mercado Público | Quincenal | 4–7 semanas |
| Google Noticias (RSS) | Titulares de los últimos 45 días sobre precios, cosechas, clima y transporte | — | Diaria | Mismo día |

Reglas que mantienen los datos honestos:

- Cada producto tiene **una sola unidad** y todas sus columnas están en esa unidad; si una fuente no es comparable, la celda queda vacía (por ejemplo, cilantro en Central de Abastos, donde SNIIM cotiza manojos de 5 kg).
- Los precios de menudeo son la **mediana** de las visitas de PROFECO a esa cadena en la quincena; un valor que se aleja demasiado de las demás tiendas se descarta como atípico y queda anotado.
- La app muestra siempre la **fecha real** de cada fuente, nunca "hace unos segundos". Los precios de menudeo pueden tener semanas de antigüedad y eso se ve.
- **No hay Costco ni tianguis**: no existe ninguna fuente pública de sus precios, así que no se inventan.
- Las noticias solo aportan **contexto**: la clasificación se hace sobre el titular y la explicación de cada nota es un mecanismo posible, no un pronóstico ni una prueba de causalidad.

Los detalles (nombres exactos por fuente, normalización, contrato de los JSON) están en [docs/datos.md](docs/datos.md) y [docs/noticias.md](docs/noticias.md).

## Cómo funciona

```
scripts/fetch-sniim.mjs     ──► data/sniim.json, data/sniim-historial.json ─┐
scripts/fetch-profeco.mjs   ──► data/profeco.json ───────────────────────────┼─► scripts/build-precios.mjs ─► public/data/precios.json ─┐
scripts/fetch-noticias.mjs  ──► public/data/noticias.json ───────────────────┘                                                          ├─► app (React)
                                                                                                                                       ┘
```

- `scripts/catalogo.mjs` es la única fuente de verdad sobre qué productos y lugares existen y cómo se llaman en cada fuente.
- Los scripts son Node puro, **sin dependencias npm**, y nunca sobrescriben un archivo válido si la fuente falla.
- `.github/workflows/actualizar-precios.yml` corre a diario (SNIIM y noticias) y los lunes (PROFECO, ZIP de ~195 MB), ejecuta las pruebas, reconstruye los JSON y hace commit solo si cambió algo. Un fallo de precios marca el job como fallido; un fallo solo de noticias deja una advertencia.
- Cada push a `main` redespliega la app en Vercel.

## Desarrollo

Requiere Node 22.12 o posterior.

```bash
npm ci
npm run dev        # http://localhost:5173
```

```bash
npm run build      # build de producción en dist/
npm run preview    # sirve dist/
npm run lint       # oxlint
npm test           # pruebas del pipeline y de las utilidades de noticias (sin red)
```

### Actualizar los datos a mano

```bash
npm run datos            # SNIIM + PROFECO + build (PROFECO descarga ~195 MB)
npm run datos:noticias   # RSS de Google Noticias -> public/data/noticias.json
```

Atajos para no usar la red en local:

```bash
PROFECO_ZIP=/ruta/QQP_2026.zip npm run datos:profeco
SNIIM_HTML=scripts/__fixtures__/sniim-iztapalapa-14d.html npm run datos:sniim
NOTICIAS_RSS=/ruta/feed.xml npm run datos:noticias
```

## Despliegue

1. Importa el repositorio en [Vercel](https://vercel.com) (detecta Vite sin configuración extra).
2. En GitHub, revisa que el workflow pueda escribir en el repo: *Settings → Actions → General → Workflow permissions → Read and write permissions*.
3. La primera actualización de datos puede lanzarse a mano desde la pestaña *Actions* con "Run workflow" (marca `profeco` para descargar también PROFECO).

## Estructura

```
scripts/            pipeline de datos (catálogo, fetchers, build, pruebas, fixtures reales)
data/               salidas intermedias del pipeline (versionadas para conservar historial)
public/data/        precios.json y noticias.json, lo único que lee la app
src/hooks/          usePriceData, useNewsData
src/data/           priceUtils, newsUtils (helpers puros y null-safe)
src/components/     TickerHeader, StatsBar, HighlightCards, PriceTable, PriceLineChart,
                    TrendChart, PriceHeatmap, SavingsOpportunities, PriceNotifications, NewsRadar
docs/               contratos y decisiones: datos.md, noticias.md
```

## Avisos

- Los precios son de referencia y provienen de fuentes públicas con distinta frecuencia; no constituyen una oferta ni un pronóstico.
- El RSS de Google Noticias declara uso personal no comercial. Para una distribución comercial habría que sustituirlo por fuentes con licencia explícita; basta cambiar `NOTICIAS_RSS_URLS` en `scripts/lib/noticias.mjs`.
- SNIIM y PROFECO son datos abiertos del gobierno mexicano. Este proyecto no está afiliado a ninguna de las instituciones ni cadenas mencionadas.
