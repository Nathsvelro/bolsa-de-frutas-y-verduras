// Catálogo compartido del pipeline de datos reales.
// Es la única fuente de verdad sobre qué productos y lugares existen y cómo se
// localizan en cada fuente. La app no importa este archivo: recibe el resultado
// ya resuelto en public/data/precios.json (ver docs/datos.md).

// Lugares de venta. `source` indica de qué fuente sale su precio:
// - 'sniim'   → precios al mayoreo, Central de Abasto de Iztapalapa (diario)
// - 'profeco' → precios al menudeo, "Quién es Quién en los Precios" (quincenal)
// `profecoChains` son los valores EXACTOS de la columna `cadena_comercial` que
// se agrupan bajo ese lugar (verificados en el CSV 07-2026_Q2, estado CDMX).
// Quedan fuera a propósito: 'Sumesa' (formato chico de La Comer, precios
// distintos), 'Superissste' y 'U.n.a.m.' (tiendas de acceso restringido) y
// 'Central de Abasto' de PROFECO (menudeo dentro de la central; el lugar
// central_abastos usa el mayoreo de SNIIM).
export const LOCATIONS = [
  { id: 'walmart_express', name: 'Walmart Express', short: 'W. Express', tag: 'antes Superama', source: 'profeco', profecoChains: ['Wal-mart Express'] },
  { id: 'walmart', name: 'Walmart', short: 'Walmart', tag: 'Cadena', source: 'profeco', profecoChains: ['Wal-mart'] },
  { id: 'bodega_aurrera', name: 'Bodega Aurrera', short: 'Aurrera', tag: 'Cadena', source: 'profeco', profecoChains: ['Bodega Aurrera', 'Bodega Aurrera Express'] },
  { id: 'soriana', name: 'Soriana', short: 'Soriana', tag: 'Cadena', source: 'profeco', profecoChains: ['Hipermercado Soriana', 'Mega Soriana', 'Soriana Super', 'Mercado Soriana'] },
  { id: 'chedraui', name: 'Chedraui', short: 'Chedraui', tag: 'Cadena', source: 'profeco', profecoChains: ['Chedraui', 'Chedraui Selecto'] },
  { id: 'la_comer', name: 'La Comer', short: 'La Comer', tag: 'Premium', source: 'profeco', profecoChains: ['La Comer'] },
  { id: 'mercado_publico', name: 'Mercado Público', short: 'Mercado', tag: 'Menudeo', source: 'profeco', profecoChains: ['Mercado Publico'] },
  { id: 'central_abastos', name: 'Central de Abastos', short: 'C. Abastos', tag: 'Mayoreo', source: 'sniim' },
];

// Productos. `unit` es la unidad en la que se expresan TODOS los precios del
// producto en precios.json ('kg' | 'pieza' | 'manojo'); cada fuente se
// normaliza a esa unidad o se deja en null si no es comparable.
//
// sniim.match: regex contra la columna "Producto" de SNIIM (ya con entidades
//   HTML decodificadas y normalizado a NFC). Se consulta con PreciosPorId=2,
//   que devuelve el precio por kilogramo para presentaciones en kg y el precio
//   por pieza para "Docena"/"Pieza", así que no hace falta convertir.
//   Si hay varias filas el mismo día (varias presentaciones, calidades u
//   orígenes) se toma la MEDIANA de "Precio Frec".
// profeco.producto: valor EXACTO de la columna `producto`.
// profeco.presentacion: regex contra `presentacion` (case-insensitive) para
//   quedarse solo con la variedad/presentación comparable.
// profeco.kgFactor: multiplicador para llevar el precio a la unidad del
//   producto (p. ej. canastilla de 454 g → por kg).
export const PRODUCTS = [
  { id: 'jitomate', name: 'Jitomate', icon: '🍅', category: 'verdura', unit: 'kg',
    sniim: { match: /^Tomate Saladette$/ },
    profeco: { producto: 'Jitomate', presentacion: /saladette/i } },
  { id: 'cebolla', name: 'Cebolla', icon: '🧅', category: 'verdura', unit: 'kg',
    sniim: { match: /^Cebolla Bola$/ },
    profeco: { producto: 'Cebolla', presentacion: /blanca/i } },
  { id: 'lechuga', name: 'Lechuga', icon: '🥬', category: 'verdura', unit: 'pieza',
    sniim: { match: /^Lechuga Romanita/ },
    profeco: { producto: 'Lechuga', presentacion: /romana/i } },
  { id: 'papa', name: 'Papa', icon: '🥔', category: 'verdura', unit: 'kg',
    sniim: { match: /^Papa Alpha$/ },
    profeco: { producto: 'Papa', presentacion: /alfa|blanca/i } },
  { id: 'cilantro', name: 'Cilantro', icon: '🌿', category: 'verdura', unit: 'manojo',
    // SNIIM cotiza el manojo mayorista de 5 kg en $/kg; no es comparable con el
    // manojo de menudeo, así que Central de Abastos queda en null para cilantro.
    sniim: null,
    profeco: { producto: 'Cilantro', presentacion: /^Manojo$/i } },
  { id: 'chile_serrano', name: 'Chile Serrano', icon: '🌶️', category: 'verdura', unit: 'kg',
    sniim: { match: /^Chile Serrano/ },
    profeco: { producto: 'Chile Fresco', presentacion: /serrano/i } },
  { id: 'chile_jalapeno', name: 'Chile Jalapeño', icon: '🫑', category: 'verdura', unit: 'kg',
    sniim: { match: /^Chile Jalapeño/ },
    profeco: { producto: 'Chile Fresco', presentacion: /jalapeño/i } },
  { id: 'zanahoria', name: 'Zanahoria', icon: '🥕', category: 'verdura', unit: 'kg',
    sniim: { match: /^Zanahoria mediana$/ },
    profeco: { producto: 'Zanahoria', presentacion: /mediana/i } },
  { id: 'pepino', name: 'Pepino', icon: '🥒', category: 'verdura', unit: 'kg',
    sniim: { match: /^Pepino$/ },
    profeco: { producto: 'Pepino', presentacion: /^1 Kg/i } },
  { id: 'calabacita', name: 'Calabacita', icon: '🟢', category: 'verdura', unit: 'kg',
    sniim: { match: /^Calabacita Italiana$/ },
    profeco: { producto: 'Calabaza', presentacion: /italiana/i } },
  { id: 'brocoli', name: 'Brócoli', icon: '🥦', category: 'verdura', unit: 'kg',
    sniim: { match: /^Brócoli$/ },
    profeco: { producto: 'Brócoli', presentacion: /^1 Kg/i } },
  { id: 'elote', name: 'Elote', icon: '🌽', category: 'verdura', unit: 'pieza',
    sniim: { match: /^Elote grande$/ },
    profeco: { producto: 'Elote', presentacion: /^Pieza$/i } },
  { id: 'aguacate', name: 'Aguacate', icon: '🥑', category: 'fruta', unit: 'kg',
    sniim: { match: /^Aguacate Hass$/ },
    profeco: { producto: 'Aguacate', presentacion: /hass/i } },
  { id: 'limon', name: 'Limón', icon: '🍋', category: 'fruta', unit: 'kg',
    sniim: { match: /^Limón c\/semilla/ },
    profeco: { producto: 'Limón', presentacion: /con semilla/i } },
  { id: 'manzana', name: 'Manzana', icon: '🍎', category: 'fruta', unit: 'kg',
    sniim: { match: /^Manzana Red Delicious$/ },
    profeco: { producto: 'Manzana', presentacion: /red delicious/i } },
  { id: 'platano', name: 'Plátano', icon: '🍌', category: 'fruta', unit: 'kg',
    sniim: { match: /^Plátano (Tabasco|Chiapas)$/ },
    profeco: { producto: 'Plátano', presentacion: /tabasco/i } },
  { id: 'naranja', name: 'Naranja', icon: '🍊', category: 'fruta', unit: 'kg',
    sniim: { match: /^Naranja Valencia mediana$/ },
    profeco: { producto: 'Naranja', presentacion: /valencia/i } },
  { id: 'mango', name: 'Mango', icon: '🥭', category: 'fruta', unit: 'kg',
    sniim: { match: /^Mango Ataulfo$/ },
    profeco: { producto: 'Mango', presentacion: /ataulfo/i } },
  { id: 'fresa', name: 'Fresa', icon: '🍓', category: 'fruta', unit: 'kg',
    sniim: { match: /^Fresa$/ },
    profeco: { producto: 'Fresa', presentacion: /454/, kgFactor: 1 / 0.454 } },
  { id: 'uva', name: 'Uva', icon: '🍇', category: 'fruta', unit: 'kg',
    sniim: { match: /^Uva sin semilla$/ },
    profeco: { producto: 'Uva', presentacion: /sin semilla/i } },
];

// Parámetros de las fuentes.
export const SNIIM = {
  name: 'SNIIM · Central de Abasto de Iztapalapa',
  url: 'https://www.economia-sniim.gob.mx/nuevo/Consultas/MercadosNacionales/PreciosDeMercado/Agricolas/ResultadosConsultaFechaFrutasYHortalizas.aspx',
  destinoId: 100, // "DF: Central de Abasto de Iztapalapa DF"
  preciosPorId: 2, // 2 = precio por kilogramo (1 = por presentación)
  registrosPorPagina: 5000,
  diasVentana: 14,
};

export const PROFECO = {
  name: 'PROFECO · Quién es Quién en los Precios',
  pageUrl: 'https://datos.profeco.gob.mx/datos_abiertos/qqp.php',
  zipUrl: 'https://datos.profeco.gob.mx/datos_abiertos/file.php?t=9d62040eae6dcc63e36b8ac821427647', // "Quien es Quien en los Precios 2026"
  estado: 'Ciudad de México',
  catalogo: 'Frutas y Legumbres',
};

export function normalizeText(str) {
  return String(str ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function median(values) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}
