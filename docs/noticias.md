# Radar de noticias

El radar usa un archivo estático independiente de los precios. No requiere claves ni llamadas a terceros desde el navegador.

## Actualización

```sh
npm run datos:noticias
```

`scripts/fetch-noticias.mjs` consulta búsquedas RSS de Google Noticias en español para México: una general y cuatro grupos de cinco productos del catálogo. Las consultas cortas evitan perder cobertura por una expresión demasiado larga. Incluyen términos de precios, cosechas, clima, transporte y comercio; sus URLs quedan en `source.urls`. Los resultados se unen y deduplican. Conserva publicaciones de los últimos 45 días y escribe `public/data/noticias.json` de forma atómica.

El workflow `actualizar-precios.yml` consulta noticias en sus ejecuciones existentes, de lunes a sábado en horario de CDMX. Cada fuente se descarga por separado. Un fallo HTTP, de conexión o del formato RSS conserva el archivo anterior y deja una advertencia en el job (no lo marca como fallido: Google bloquea a veces las IPs de GitHub Actions y eso no debe ocultar el estado de los precios). Un feed válido sin resultados produce `articles: []`.

Los cambios del workflow se activan cuando se publican en la rama usada por GitHub Actions; no hace falta crear una automatización de Codex. Actualizar la página vuelve a leer el JSON publicado, no ejecuta una nueva consulta a Google.

Para pruebas locales puede usarse `NOTICIAS_RSS=/ruta/feed.xml npm run datos:noticias`. Las pruebas de `npm test` no utilizan red ni modifican datos publicados.

## Contrato

```js
{
  version: 1,
  updatedAt: '2026-09-18T00:19:51.910Z', // Fecha de consulta, no de publicación
  source: { name: 'Google Noticias', url: 'https://news.google.com/rss/search?...' },
  articles: [{
    id: 'identificador-estable',
    title: 'Titular del medio',
    url: 'https://news.google.com/rss/articles/...',
    source: { name: 'Nombre del medio', url: 'https://medio.example' },
    publishedAt: '2026-09-17T12:00:00.000Z',
    category: 'clima', // clima | produccion | logistica | mercado
    productIds: ['limon'],
    context: 'Si el clima altera las cosechas o su distribución, puede cambiar la disponibilidad y los precios.'
  }]
}
```

## Interpretación y límites

- Solo se lee el **titular**. No se descargan cuerpos de artículos, imágenes ni textos de pago. Los enlaces de Google Noticias redirigen a la publicación original.
- La clasificación es automática y orientativa: clima, logística, comercio explícito y producción tienen prioridad en ese orden. Puede haber falsos positivos u omisiones. No es una selección exhaustiva ni una validación editorial de cada medio.
- Se excluyen recetas, promociones y ciertos contenidos de salud y turismo; se rechazan enlaces que no sean HTTP(S), fechas inválidas o futuras, y duplicados por título o URL.
- Los productos se relacionan por mención explícita. “Tomate verde” no se asigna a jitomate; un titular que solo dice “chile” no se asigna a una variedad. Los productos relacionados no necesariamente comparten variedad, mercado o región con el precio de CDMX.
- `context` es una explicación general condicional del factor. No es un resumen de la noticia, un pronóstico ni evidencia de que causó un movimiento del precio. No se calcula un porcentaje de impacto ni una dirección futura.
- La interfaz muestra fechas en CDMX, advierte cuando la última consulta tiene más de tres días y mantiene la consulta de precios disponible si falla el radar. SNIIM y PROFECO tienen periodos distintos.
- El RSS de Google declara uso personal no comercial en sus metadatos. Para una distribución comercial, revisar las condiciones del proveedor y sustituir la fuente por una que permita ese uso. El formato estático facilita ese cambio.

## Archivos

- `scripts/lib/noticias.mjs`: lectura RSS, validación, filtros, clasificación y deduplicación.
- `scripts/fetch-noticias.mjs`: descarga y escritura atómica.
- `src/hooks/useNewsData.js`: carga independiente, cancelación y reintento.
- `src/components/NewsRadar.jsx`: filtros, tarjetas, estados y acceso al comparador.
- `scripts/noticias.test.mjs` y `scripts/news-ui.test.mjs`: regresiones del pipeline y del consumo de datos.
