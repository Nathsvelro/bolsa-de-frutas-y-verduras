// Fuente de datos simulada: productos, lugares de venta y motor de precios.
// Todos los precios son de ejemplo (MXN, por kg) y no reflejan cotizaciones reales.

export const CATEGORIES = {
  fruta: { label: "Frutas", icon: "🍇" },
  verdura: { label: "Verduras", icon: "🥦" },
};

export const LOCATIONS = [
  { id: "superama", name: "Superama", tag: "Premium", factor: 1.16, volatility: 0.02 },
  { id: "walmart", name: "Walmart", tag: "Cadena", factor: 1.0, volatility: 0.02 },
  { id: "soriana", name: "Soriana", tag: "Cadena", factor: 0.95, volatility: 0.022 },
  { id: "costco", name: "Costco", tag: "Mayoreo", factor: 0.88, volatility: 0.028 },
  { id: "mercado_abastos", name: "Mercado de Abastos", tag: "Mercado", factor: 0.76, volatility: 0.04 },
  { id: "tianguis", name: "Tianguis Local", tag: "Tianguis", factor: 0.8, volatility: 0.05 },
  { id: "central_abastos", name: "Central de Abastos", tag: "Mayoreo", factor: 0.6, volatility: 0.06 },
];

export const PRODUCTS_META = [
  { id: "jitomate", name: "Jitomate", icon: "🍅", category: "verdura", basePrice: 24 },
  { id: "cebolla", name: "Cebolla", icon: "🧅", category: "verdura", basePrice: 18 },
  { id: "lechuga", name: "Lechuga", icon: "🥬", category: "verdura", basePrice: 21 },
  { id: "papa", name: "Papa", icon: "🥔", category: "verdura", basePrice: 20 },
  { id: "cilantro", name: "Cilantro", icon: "🌿", category: "verdura", basePrice: 9 },
  { id: "chile_serrano", name: "Chile Serrano", icon: "🌶️", category: "verdura", basePrice: 34 },
  { id: "chile_jalapeno", name: "Chile Jalapeño", icon: "🫑", category: "verdura", basePrice: 28 },
  { id: "zanahoria", name: "Zanahoria", icon: "🥕", category: "verdura", basePrice: 16 },
  { id: "pepino", name: "Pepino", icon: "🥒", category: "verdura", basePrice: 17 },
  { id: "calabacita", name: "Calabacita", icon: "🟢", category: "verdura", basePrice: 19 },
  { id: "brocoli", name: "Brócoli", icon: "🥦", category: "verdura", basePrice: 32 },
  { id: "elote", name: "Elote", icon: "🌽", category: "verdura", basePrice: 15 },
  { id: "aguacate", name: "Aguacate", icon: "🥑", category: "fruta", basePrice: 58 },
  { id: "limon", name: "Limón", icon: "🍋", category: "fruta", basePrice: 27 },
  { id: "manzana", name: "Manzana", icon: "🍎", category: "fruta", basePrice: 44 },
  { id: "platano", name: "Plátano", icon: "🍌", category: "fruta", basePrice: 18 },
  { id: "naranja", name: "Naranja", icon: "🍊", category: "fruta", basePrice: 19 },
  { id: "mango", name: "Mango", icon: "🥭", category: "fruta", basePrice: 30 },
  { id: "fresa", name: "Fresa", icon: "🍓", category: "fruta", basePrice: 55 },
  { id: "uva", name: "Uva", icon: "🍇", category: "fruta", basePrice: 68 },
];

const DAY_LABELS = ["Hace 6d", "Hace 5d", "Hace 4d", "Hace 3d", "Anteayer", "Ayer", "Hoy"];

// PRNG determinista (mulberry32) para que el dataset inicial sea reproducible.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function roundToHalf(n) {
  return Math.round(n * 2) / 2;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildHistory(basePrice, volatility, rng) {
  const history = [];
  let price = basePrice * (1 + (rng() - 0.5) * 0.1);
  const min = basePrice * 0.65;
  const max = basePrice * 1.4;
  for (let i = 0; i < 7; i++) {
    const drift = (rng() - 0.48) * volatility * 2.2;
    price = clamp(price * (1 + drift), min, max);
    history.push({ day: DAY_LABELS[i], avg: round2(price) });
  }
  return history;
}

function computeAvg(prices) {
  const values = Object.values(prices);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function buildLocationPrices(todayAvg, rng) {
  const prices = {};
  for (const loc of LOCATIONS) {
    const noise = (rng() - 0.5) * loc.volatility * 1.5;
    prices[loc.id] = roundToHalf(todayAvg * loc.factor * (1 + noise));
  }
  return prices;
}

export function generateInitialDataset() {
  const rng = mulberry32(20260713);
  const products = PRODUCTS_META.map((meta) => {
    const history = buildHistory(meta.basePrice, 0.05, rng);
    const todayAvg = history[history.length - 1].avg;
    const yesterdayAvg = history[history.length - 2].avg;
    const prices = buildLocationPrices(todayAvg, rng);
    const avgPrice = round2(computeAvg(prices));
    return {
      ...meta,
      unit: "kg",
      prices,
      prevPrices: { ...prices },
      avgPrice,
      prevAvgPrice: yesterdayAvg,
      changePct: round2(((avgPrice - yesterdayAvg) / yesterdayAvg) * 100),
      history,
      lastChangedAt: null,
      flash: null,
    };
  });

  return { products, updatedAt: Date.now() };
}

// Aplica un "tick" de mercado: mueve un subconjunto aleatorio de productos y
// devuelve el dataset actualizado junto con eventos de cambio significativo.
export function simulateTick(dataset, { maxUpdates = 4, threshold = 4.5 } = {}) {
  const productCount = dataset.products.length;
  const updates = Math.min(productCount, 1 + Math.floor(Math.random() * maxUpdates));
  const indexes = new Set();
  while (indexes.size < updates) {
    indexes.add(Math.floor(Math.random() * productCount));
  }

  const notifications = [];
  const now = Date.now();

  const products = dataset.products.map((product, idx) => {
    if (!indexes.has(idx)) {
      return product.flash ? { ...product, flash: null } : product;
    }

    const prevPrices = product.prices;
    const prevAvgPrice = product.avgPrice;
    const volatility = 0.035;
    const nextPrices = {};
    for (const loc of LOCATIONS) {
      const noise = (Math.random() - 0.47) * volatility * 2 * (loc.volatility / 0.03);
      const base = prevPrices[loc.id];
      nextPrices[loc.id] = clamp(
        roundToHalf(base * (1 + noise)),
        product.basePrice * loc.factor * 0.55,
        product.basePrice * loc.factor * 1.6
      );
    }

    const avgPrice = round2(computeAvg(nextPrices));
    const changePct = round2(((avgPrice - prevAvgPrice) / prevAvgPrice) * 100);
    const flash = avgPrice > prevAvgPrice ? "up" : avgPrice < prevAvgPrice ? "down" : null;

    const history = product.history.slice();
    history[history.length - 1] = { ...history[history.length - 1], avg: avgPrice };

    if (Math.abs(changePct) >= threshold) {
      notifications.push({
        id: `${product.id}-${now}`,
        productId: product.id,
        name: product.name,
        icon: product.icon,
        changePct,
        direction: changePct > 0 ? "up" : "down",
        timestamp: now,
      });
    }

    return {
      ...product,
      prices: nextPrices,
      prevPrices,
      avgPrice,
      prevAvgPrice,
      changePct,
      history,
      lastChangedAt: now,
      flash,
    };
  });

  return { dataset: { products, updatedAt: now }, notifications };
}

export function getBestLocation(product) {
  let best = LOCATIONS[0];
  for (const loc of LOCATIONS) {
    if (product.prices[loc.id] < product.prices[best.id]) best = loc;
  }
  return best;
}

export function getWorstLocation(product) {
  let worst = LOCATIONS[0];
  for (const loc of LOCATIONS) {
    if (product.prices[loc.id] > product.prices[worst.id]) worst = loc;
  }
  return worst;
}

export function getSavingsOpportunities(products) {
  return products
    .map((product) => {
      const best = getBestLocation(product);
      const worst = getWorstLocation(product);
      const bestPrice = product.prices[best.id];
      const worstPrice = product.prices[worst.id];
      const savingsAbs = round2(worstPrice - bestPrice);
      const savingsPct = round2((savingsAbs / worstPrice) * 100);
      return { product, best, worst, bestPrice, worstPrice, savingsAbs, savingsPct };
    })
    .sort((a, b) => b.savingsPct - a.savingsPct);
}

export function getMarketStats(products) {
  const avgPrice = products.reduce((sum, p) => sum + p.avgPrice, 0) / products.length;
  const opportunities = getSavingsOpportunities(products);
  const maxSavings = opportunities[0];
  const cheapest = products.reduce((a, b) => (a.avgPrice < b.avgPrice ? a : b));
  const mostExpensive = products.reduce((a, b) => (a.avgPrice > b.avgPrice ? a : b));
  const biggestMover = products.reduce((a, b) =>
    Math.abs(b.changePct) > Math.abs(a.changePct) ? b : a
  );
  return { avgPrice, maxSavings, cheapest, mostExpensive, biggestMover, opportunities };
}
