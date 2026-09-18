const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMXN(value) {
  return mxn.format(value);
}

export function formatPercent(value, { signed = true } = {}) {
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// Convierte "AAAA-MM-DD" a Date en horario LOCAL (no UTC), para no restar un
// día al formatear fechas que vienen de precios.json.
export function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const fullDateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
});

// "AAAA-MM-DD" -> "17 sep 2026"
export function formatShortDateEsMX(dateStr) {
  const date = parseLocalDate(dateStr);
  if (!date) return "s/f";
  return fullDateFormatter.format(date);
}

// "AAAA-MM-DD" -> "3 sep" (sin año, para ejes de gráfica)
export function formatDayMonthEsMX(dateStr) {
  const date = parseLocalDate(dateStr);
  if (!date) return "";
  return shortDateFormatter.format(date);
}

// Rango de dos "AAAA-MM-DD" -> "16–31 jul 2026" (o con ambos meses si difieren)
export function formatDateRangeEsMX(fromStr, toStr) {
  const from = parseLocalDate(fromStr);
  const to = parseLocalDate(toStr);
  if (!from || !to) return "s/f";
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  if (sameMonth) {
    return `${from.getDate()}–${fullDateFormatter.format(to)}`;
  }
  return `${shortDateFormatter.format(from)} – ${fullDateFormatter.format(to)}`;
}
