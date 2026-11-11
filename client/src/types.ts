export type AssetId = 'gold' | 'diamond' | 'bitcoin';
export const ASSET_IDS: AssetId[] = ['gold', 'diamond', 'bitcoin'];

export interface AssetSnap {
  id: AssetId; name: string; icon: string; price: number; open24h: number; change: number; changePct: number;
  tickChange: number; tickChangePct: number; high24h: number; low24h: number; allTimeHigh: number; allTimeLow: number;
}
export interface MarketEvent { id: number; ts: number; type: string; icon: string; title: string; description: string; endsAt: number | null }
export interface Settings {
  intervalMs: number; volatility: number; autoUpdates: boolean; eventsEnabled: boolean; eventChance: number;
  ranges: Record<AssetId, { min: number; max: number }>;
  bounds: Record<AssetId, { min: number; max: number }>; // price limits in dollars
}
export interface Snapshot {
  now: number; lastTickTs: number; nextTickAt: number | null; paused: boolean; marketStart: number; day: number; intervalMs: number;
  assets: Record<AssetId, AssetSnap>;
  activeEvent: { id: string; icon: string; title: string; description: string; startedAt: number; endsAt: number; once: boolean } | null;
  recentEvents: MarketEvent[];
  activity: { updates: number; totalMovePct: number };
  settings: Settings;
}
export interface Point { ts: number; gold: number; diamond: number; bitcoin: number }
export interface Move { key: string; id: AssetId; price: number; pct: number }

export const META: Record<AssetId, { name: string; icon: string; color: string; cls: string }> = {
  gold: { name: 'Gold', icon: '🥇', color: '#F2C14E', cls: 'line-gold' },
  diamond: { name: 'Diamond', icon: '💎', color: '#5CE1FF', cls: 'line-diamond' },
  bitcoin: { name: 'Bitcoin', icon: '₿', color: '#B38CFF', cls: 'line-bitcoin' },
};
export const RANGES = { '1h': 3600e3, '6h': 6 * 3600e3, '24h': 24 * 3600e3, '7d': 7 * 24 * 3600e3, '30d': 30 * 24 * 3600e3, all: Infinity } as const;
export type RangeKey = keyof typeof RANGES;
