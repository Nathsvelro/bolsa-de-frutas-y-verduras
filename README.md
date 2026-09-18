# Bolsa de Verduras · CDMX

Tablero de precios de frutas y verduras con React y Vite. Compara datos de SNIIM y PROFECO e incluye un radar de noticias para explorar factores que podrían influir en los precios.

## Desarrollo

Requiere Node 22.12 o posterior.

```sh
npm ci
npm run dev
```

```sh
npm run build      # Compilación para producción
npm run lint       # Revisión estática
npm test           # Pruebas locales, sin red
```

## Datos

- `npm run datos`: descarga y genera los precios de SNIIM y PROFECO (no incluye las noticias).
- `npm run datos:noticias`: descarga titulares RSS de Google Noticias y genera `public/data/noticias.json`.
- El workflow de GitHub Actions corre ambos y conserva la última versión válida si una fuente falla: un fallo de precios marca el job como fallido; un fallo solo de noticias deja una advertencia. Los cambios locales al workflow entran en vigor al publicarlos en el repositorio.

En **Noticias y contexto** puedes buscar por titular, fuente o producto, filtrar por factor y pasar a los precios del producto mencionado. La clasificación parte del titular; las explicaciones son contexto general, no pronósticos ni pruebas de causalidad. Las fechas de las noticias y los periodos de los precios se muestran por separado.

Contratos, fuentes y limitaciones: [precios](docs/datos.md) y [noticias](docs/noticias.md).
