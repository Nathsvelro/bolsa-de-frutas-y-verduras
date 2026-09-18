# Datos reales: fuentes, pipeline y formato de `precios.json`

La app ya no simula precios. Un pipeline (scripts en `scripts/`, ejecutados por GitHub Actions) descarga datos públicos, los normaliza con el catálogo de `scripts/catalogo.mjs` y escribe `public/data/precios.json`, que es lo único que la app lee (`fetch('/data/precios.json')`).

## Fuentes

| Fuente | Qué es | Lugares que alimenta | Frecuencia | Retraso típico |
|---|---|---|---|---|
| **SNIIM** (Secretaría de Economía) | Precios al **mayoreo** en la Central de Abasto de Iztapalapa. Consulta GET a `ResultadosConsultaFechaFrutasYHortalizas.aspx` con `DestinoId=100`, `PreciosPorId=2` (precio por kg; por pieza en Docena/Pieza), ventana de 14 días. HTML con una tabla cuyo encabezado es `Fecha, Producto, Calidad, Presentación, Origen, Precio Mín, Precio Max, Precio Frec, Obs.`; los precios usan separador de miles (`1,500.00`) y el pie dice `Página 1 de N` (debe ser 1 de 1). | `central_abastos` | Diaria (lun–vie, publicado ~17:00 CDMX) | Mismo día |
| **PROFECO QQP** (Quién es Quién en los Precios) | Precios al **menudeo** levantados en tiendas. ZIP anual (~195 MB) con un CSV por quincena (`QQP_2026/MM-2026_QN.csv`, UTF-8 con BOM, columnas `producto, presentacion, marca, categoria, catalogo, precio, fecha_registro, cadena_comercial, giro, nombre_comercial, direccion, estado, municipio, latitud, longitud`; `fecha_registro` es `AAAA/MM/DD`). Se filtra `estado = Ciudad de México` y `catalogo = Frutas y Legumbres`. | Todos los demás lugares | Quincenal | 4–7 semanas (el CSV de la 2.ª quincena de julio se publicó el 4 de septiembre) |

No hay fuente pública para Costco ni para tianguis, por eso ya no aparecen.

## Reglas de normalización

- La unidad de cada producto (`unit`: `kg`, `pieza` o `manojo`) la fija el catálogo; todos los precios del producto están en esa unidad. Si una fuente no es comparable, el precio queda en `null` (ej. cilantro en Central de Abastos).
- **SNIIM**: por producto y fecha, mediana de `Precio Frec` de todas las filas cuyo `Producto` cumple `sniim.match` (varias presentaciones/calidades/orígenes).
- **PROFECO**: por producto y lugar, se toman las filas del periodo cuyo `producto` es exactamente `profeco.producto`, cuya `presentacion` cumple `profeco.presentacion` y cuya `cadena_comercial` está en `profecoChains` del lugar; se multiplica por `kgFactor` si existe; el precio es la **mediana** (una fila = una visita a una sucursal). `n < 3` se conserva pero se reporta en `detail`.
- **Atípicos**: un precio de menudeo que queda por debajo de 0.35× o por encima de 3× la mediana de las otras tiendas (mínimo 3 con dato) se pone en `null` y se anota en `detail` (`note: "descartado como atípico: ..."`), conservando `min`/`max`/`n`. Casi siempre son errores de captura de PROFECO; sin esta regla acabarían marcados como "mejor precio".
- Precio anterior (`prevPrices`): para `central_abastos` es el último día hábil anterior con dato; para lugares PROFECO es el mismo cálculo sobre el periodo quincenal anterior (CSV previo dentro del mismo ZIP).

## Archivos

```
data/sniim.json            salida cruda normalizada de fetch-sniim (por producto: serie diaria)
data/sniim-historial.json  serie diaria acumulada (se fusiona por fecha, se conservan 120 días)
data/profeco.json          salida de fetch-profeco: último periodo y periodo anterior, por producto y lugar
public/data/precios.json   lo que consume la app (build-precios une lo anterior con el catálogo)
```

Cada script es Node ≥ 20 sin dependencias npm (usa `fetch`, `fs`, `zlib`, `child_process` para `unzip -p`). Si una fuente falla, el script sale con código ≠ 0 **sin** sobrescribir su archivo previo; `build-precios` siempre puede reconstruir `precios.json` con lo último disponible y refleja la fecha real del dato, no la de ejecución.

Variables de entorno útiles en local: `PROFECO_ZIP=/ruta/QQP_2026.zip` evita descargar el ZIP; `SNIIM_HTML=/ruta/archivo.html` evita la consulta HTTP.

## Formato de `public/data/precios.json`

```jsonc
{
  "version": 1,
  "generatedAt": "2026-09-17T23:40:12.000Z",      // cuándo corrió build-precios (UTC)
  "sources": {
    "sniim": {
      "id": "sniim",
      "name": "SNIIM · Central de Abasto de Iztapalapa",
      "url": "https://www.economia-sniim.gob.mx/...",
      "kind": "mayoreo",
      "cadence": "diaria",
      "dataDate": "2026-09-17",                  // fecha del dato más reciente (AAAA-MM-DD)
      "fetchedAt": "2026-09-17T23:39:50.000Z",
      "status": "ok",                            // "ok" | "stale" | "error"
      "error": null
    },
    "profeco": {
      "id": "profeco",
      "name": "PROFECO · Quién es Quién en los Precios",
      "url": "https://datos.profeco.gob.mx/datos_abiertos/qqp.php",
      "kind": "menudeo",
      "cadence": "quincenal",
      "period": "07-2026_Q2",                    // nombre del CSV usado
      "previousPeriod": "07-2026_Q1",
      "dataDate": "2026-07-31",                  // fecha_registro máxima del periodo
      "dataDateFrom": "2026-07-16",
      "fetchedAt": "2026-09-17T23:35:00.000Z",
      "status": "ok",
      "error": null
    }
  },
  "locations": [
    { "id": "walmart_express", "name": "Walmart Express", "short": "W. Express", "tag": "antes Superama", "source": "profeco" },
    // ... mismo orden que scripts/catalogo.mjs; central_abastos al final con source "sniim"
  ],
  "products": [
    {
      "id": "jitomate",
      "name": "Jitomate",
      "icon": "🍅",
      "category": "verdura",                     // "fruta" | "verdura"
      "unit": "kg",                              // "kg" | "pieza" | "manojo"
      "prices":     { "walmart_express": 27.9, "walmart": 25.9, "central_abastos": 34.0, "la_comer": null },
      "prevPrices": { "walmart_express": 26.9, "walmart": 24.5, "central_abastos": 33.0, "la_comer": null },
      "history": [                               // serie diaria de central_abastos (SNIIM), ascendente, hasta 14 puntos
        { "date": "2026-09-03", "price": 33.0 },
        { "date": "2026-09-17", "price": 34.0 }
      ],
      "detail": {                                // metadatos por lugar, para tooltips y honestidad
        "central_abastos": { "source": "sniim", "date": "2026-09-17", "variety": "Tomate Saladette", "presentation": "Caja de 12 kg.", "min": 33.0, "max": 36.0, "n": 3 },
        "walmart": { "source": "profeco", "date": "2026-07-31", "period": "07-2026_Q2", "presentation": "1 Kg. Granel. Saladette/huaje o Tomate Saladette/huaje", "min": 19.9, "max": 29.9, "n": 12 },
        "la_comer": { "source": "profeco", "note": "sin observaciones en el periodo" }
      }
    }
  ]
}
```

Todo lugar del catálogo aparece como clave en `prices`, `prevPrices` y `detail` de cada producto (con `null` / nota cuando no hay dato). La app calcula lo derivado (promedio, variación, mejor precio, ahorro) a partir de esto; nada derivado se guarda en el JSON.

Semántica que la app debe respetar:

- **Variación diaria** (`changePct`, flecha, ticker, tendencia de 7 días): se calcula sobre `central_abastos` (`history`), porque es la única serie que cambia a diario. Se etiqueta como variación de mayoreo.
- **Precio promedio / más barato / más caro / ahorro**: sobre los lugares de menudeo (todos menos `central_abastos`) con precio no nulo; si no hay ninguno, se usa `central_abastos`.
- **Fechas**: la UI muestra la fecha real de cada fuente (`sources.*.dataDate`), nunca "hace unos segundos". Los precios de menudeo pueden tener semanas de antigüedad y eso debe verse.

## GitHub Actions (`.github/workflows/actualizar-precios.yml`)

- `schedule` diario a las 00:30 UTC de martes a sábado (= 18:30 CDMX de lunes a viernes; México no tiene horario de verano): corre `datos:sniim` y `datos:build`.
- `schedule` semanal lunes 06:00 UTC: además corre `datos:profeco` (descarga el ZIP completo).
- `workflow_dispatch` con input `profeco: boolean` para forzar la descarga de PROFECO.
- Permisos `contents: write`; commit solo si cambió algo en `data/` o `public/data/`, con autor `github-actions[bot]` y mensaje `datos: SNIIM <fecha> · PROFECO <periodo>`; `git pull --rebase` antes de `push`. El push a `main` dispara el redespliegue en Vercel.
- Ningún paso debe fallar en silencio: si un fetcher sale con error, el job falla (queda visible en Actions) pero `precios.json` conserva el último dato válido.
