// Helpers null-safe sobre los datos reales de precios.json. Todos reciben
// `locations` como parámetro (vienen del hook usePriceData, no de un
// catálogo importado aquí) y toleran productos o listas vacías.

export const CATEGORIES = {
  fruta: { label: "Frutas", icon: "🍇" },
  verdura: { label: "Verduras", icon: "🥦" },
};

const UNIT_SUFFIX = {
  kg: "/kg",
  pieza: "/pza",
  manojo: "/manojo",
};

export function formatUnit(unit) {
  return UNIT_SUFFIX[unit] || `/${unit}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function priceAt(product, locationId) {
  const value = product?.prices?.[locationId];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Lugares de menudeo: todos menos central_abastos (mayoreo).
export function getRetailLocations(locations) {
  return (locations || []).filter((loc) => loc.id !== "central_abastos");
}

// Devuelve el lugar (de la lista dada) con el precio más bajo, ignorando
// null. null si ninguno tiene precio.
export function getBestLocation(product, locations) {
  let best = null;
  let bestPrice = null;
  for (const loc of locations || []) {
    const price = priceAt(product, loc.id);
    if (price === null) continue;
    if (bestPrice === null || price < bestPrice) {
      best = loc;
      bestPrice = price;
    }
  }
  return best;
}

// Igual que getBestLocation pero con el precio más alto.
export function getWorstLocation(product, locations) {
  let worst = null;
  let worstPrice = null;
  for (const loc of locations || []) {
    const price = priceAt(product, loc.id);
    if (price === null) continue;
    if (worstPrice === null || price > worstPrice) {
      worst = loc;
      worstPrice = price;
    }
  }
  return worst;
}

// Solo productos con al menos 2 precios de menudeo no nulos entran en la
// comparación (si no, "ahorro" no tiene sentido).
export function getSavingsOpportunities(products, locations) {
  const retail = getRetailLocations(locations);
  const opportunities = [];

  for (const product of products || []) {
    const withPrice = retail.filter((loc) => priceAt(product, loc.id) !== null);
    if (withPrice.length < 2) continue;

    const best = getBestLocation(product, withPrice);
    const worst = getWorstLocation(product, withPrice);
    if (!best || !worst || best.id === worst.id) continue;

    const bestPrice = priceAt(product, best.id);
    const worstPrice = priceAt(product, worst.id);
    const savingsAbs = round2(worstPrice - bestPrice);
    const savingsPct = worstPrice ? round2((savingsAbs / worstPrice) * 100) : 0;

    opportunities.push({ product, best, worst, bestPrice, worstPrice, savingsAbs, savingsPct });
  }

  return opportunities.sort((a, b) => b.savingsPct - a.savingsPct);
}

// avgPrice de mercado (media de los avgPrice de menudeo por producto),
// cheapest/mostExpensive por avgPrice y biggestMover por |changePct|
// (variación de mayoreo). Todo tolerante a productos sin dato.
export function getMarketStats(products, locations) {
  const list = products || [];

  const withAvg = list.filter((p) => typeof p.avgPrice === "number");
  const avgPrice = withAvg.length
    ? round2(withAvg.reduce((sum, p) => sum + p.avgPrice, 0) / withAvg.length)
    : null;

  const opportunities = getSavingsOpportunities(list, locations);
  const maxSavings = opportunities[0] || null;

  const cheapest = withAvg.length
    ? withAvg.reduce((a, b) => (b.avgPrice < a.avgPrice ? b : a))
    : null;
  const mostExpensive = withAvg.length
    ? withAvg.reduce((a, b) => (b.avgPrice > a.avgPrice ? b : a))
    : null;

  const withChange = list.filter((p) => typeof p.changePct === "number");
  const biggestMover = withChange.length
    ? withChange.reduce((a, b) => (Math.abs(b.changePct) > Math.abs(a.changePct) ? b : a))
    : null;

  return { avgPrice, opportunities, maxSavings, cheapest, mostExpensive, biggestMover };
}
