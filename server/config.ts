// Central configuration: assets, defaults and settings validation.
export const ASSETS = ['gold', 'diamond', 'bitcoin'] as const;
export type AssetId = (typeof ASSETS)[number];
export type Prices = Record<AssetId, number>;

const DIAMOND_START = 100_000_000;
export const ASSET_META: Record<AssetId, { name: string; icon: string; start: number }> = {
  gold: { name: 'Gold', icon: '🥇', start: 50_000_000 },
  diamond: { name: 'Diamond', icon: '💎', start: DIAMOND_START },
  bitcoin: { name: 'Bitcoin', icon: '₿', start: DIAMOND_START * 10 }, // always exactly 10x Diamond
};
export const START_PRICES: Prices = {
  gold: ASSET_META.gold.start,
  diamond: ASSET_META.diamond.start,
  bitcoin: ASSET_META.bitcoin.start,
};

/** No single update may ever move a price by more than this (percent). */
export const HARD_MAX_MOVE_PCT = 15;
/** DEFAULT price limits (in dollars). Admins can change them live from the Admin drawer; the saved values live in Settings.bounds. */
export const PRICE_BOUNDS: Record<AssetId, { min: number; max: number }> = {
  gold: { min: 25_000_000, max: 100_000_000 },
  diamond: { min: 50_000_000, max: 150_000_000 },
  bitcoin: { min: 500_000_000, max: 1_500_000_000 },
};
export const HISTORY_RETENTION_MS = 365 * 24 * 3600 * 1000; // keep one year of history

export interface Settings {
  autoUpdates: boolean; // also update on a timer (otherwise only when an admin sends "Update")
  intervalMs: number; // time between automatic updates
  volatility: number; // multiplier on every move (1 = normal)
  eventsEnabled: boolean;
  eventChance: number; // percent chance that a random event starts on each update
  ranges: Record<AssetId, { min: number; max: number }>; // per-update move size in percent
  bounds: Record<AssetId, { min: number; max: number }>; // price limits in dollars (editable by admins)
}

/** Absolute sanity limits for admin-entered price limits (dollars). */
export const BOUND_FLOOR = 1;
export const BOUND_CEIL = 1e15;

export const DEFAULT_SETTINGS: Settings = {
  autoUpdates: false, // manual: prices change when an admin sends "Update"
  intervalMs: 20 * 60 * 1000, // one update every 20 minutes
  volatility: 1,
  eventsEnabled: true,
  eventChance: 3, // about 2 events a day at 20-minute updates
  ranges: {
    gold: { min: 2.5, max: 15 },
    diamond: { min: 2.5, max: 15 },
    bitcoin: { min: 2.5, max: 15 },
  },
  bounds: structuredClone(PRICE_BOUNDS),
};

const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** Validates untrusted input and returns a complete, safe Settings object. */
export function sanitizeSettings(input: any, base: Settings): Settings {
  const s: Settings = structuredClone(base);
  if (!input || typeof input !== 'object') return s;
  if ('autoUpdates' in input) s.autoUpdates = Boolean(input.autoUpdates);
  if ('intervalMs' in input) s.intervalMs = num(input.intervalMs, 500, 7 * 24 * 3600 * 1000, s.intervalMs);
  if ('volatility' in input) s.volatility = num(input.volatility, 0.1, 5, s.volatility);
  if ('eventsEnabled' in input) s.eventsEnabled = Boolean(input.eventsEnabled);
  if ('eventChance' in input) s.eventChance = num(input.eventChance, 0, 100, s.eventChance);
  if (input.ranges && typeof input.ranges === 'object') {
    for (const a of ASSETS) {
      const r = input.ranges[a];
      if (!r) continue;
      let min = num(r.min, 0.01, HARD_MAX_MOVE_PCT, s.ranges[a].min);
      let max = num(r.max, 0.01, HARD_MAX_MOVE_PCT, s.ranges[a].max);
      if (min > max) [min, max] = [max, min];
      s.ranges[a] = { min, max };
    }
  }
  if (input.bounds && typeof input.bounds === 'object') {
    for (const a of ASSETS) {
      const r = input.bounds[a];
      if (!r) continue;
      const min = Math.round(num(r.min, BOUND_FLOOR, BOUND_CEIL, s.bounds[a].min));
      const max = Math.round(num(r.max, BOUND_FLOOR, BOUND_CEIL, s.bounds[a].max));
      if (min < max) s.bounds[a] = { min, max }; // an invalid pair keeps the previous limits
    }
  }
  return s;
}

/** Returns an error message if the admin-entered price limits are unusable, otherwise null. */
export function validateBounds(input: any): string | null {
  if (!input || typeof input !== 'object' || !input.bounds || typeof input.bounds !== 'object') return null;
  for (const a of ASSETS) {
    const r = input.bounds[a];
    if (!r) continue;
    const min = Number(r.min), max = Number(r.max);
    const name = ASSET_META[a].name;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return `${name}: the minimum and maximum price must be numbers.`;
    if (min < BOUND_FLOOR || max > BOUND_CEIL) return `${name}: limits must be between $${BOUND_FLOOR} and $${BOUND_CEIL.toLocaleString('en-US')}.`;
    if (min >= max) return `${name}: the minimum price must be lower than the maximum price.`;
  }
  return null;
}
