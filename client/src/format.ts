export const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
export const usdSigned = (n: number) => (n < 0 ? '-' : '+') + usd(Math.abs(n));
export const compact = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(3)}B` : `$${(n / 1e6).toFixed(2)}M`);
export const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
export const arrow = (n: number) => (n >= 0 ? '▲' : '▼');
export const timeOnly = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};
export const inTime = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
export const intervalLabel = (ms: number) =>
  ms >= 3600e3 ? `${+(ms / 3600e3).toFixed(2)} hours` : ms >= 60e3 ? `${+(ms / 60e3).toFixed(1)} minutes` : `${+(ms / 1000).toFixed(1)} seconds`;
