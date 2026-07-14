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

export function formatRelativeTime(timestamp) {
  if (!timestamp) return "sin datos";
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return "justo ahora";
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.round(diffMin / 60);
  return `hace ${diffHr} h`;
}

export function formatClock(timestamp) {
  if (!timestamp) return "--:--:--";
  return new Date(timestamp).toLocaleTimeString("es-MX", { hour12: false });
}
