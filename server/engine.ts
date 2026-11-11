// MARKET ENGINE — the single authoritative source of prices.
// Every browser and Discord bot reads from this one instance.
import { EventEmitter } from 'node:events';
import {
  ASSETS, ASSET_META, AssetId, DEFAULT_SETTINGS, HISTORY_RETENTION_MS, Prices, Settings, START_PRICES, sanitizeSettings,
} from './config';
import { nextPrice } from './priceGenerator';
import { ActiveEvent, EVENT_DEFS, activate, pickEvent } from './events';
import * as store from './db';

const DAY = 24 * 3600 * 1000;

interface Persisted {
  prices: Prices;
  ath: Prices;
  atl: Prices;
  paused: boolean;
  settings: Settings;
  activeEvent: ActiveEvent | null;
  updates: number;
  totalMovePct: number;
  marketStart: number;
  nextTickAt: number; // when the next price update is due (survives restarts)
  lastTick: number;
  schema: number;
}

const fresh = (): Persisted => ({
  prices: { ...START_PRICES }, ath: { ...START_PRICES }, atl: { ...START_PRICES }, paused: false,
  settings: structuredClone(DEFAULT_SETTINGS), activeEvent: null, updates: 0, totalMovePct: 0, marketStart: Date.now(),
  nextTickAt: Date.now() + DEFAULT_SETTINGS.intervalMs, lastTick: Date.now(), schema: 4,
});

export class MarketEngine extends EventEmitter {
  private s: Persisted;
  private prev: Prices;
  private lastTickTs = 0;
  private timer?: NodeJS.Timeout;
  private housekeeping?: NodeJS.Timeout;
  private win = { open: { ...START_PRICES }, high: { ...START_PRICES }, low: { ...START_PRICES } };
  private recent: store.EventRow[] = [];

  constructor() {
    super();
    const saved = store.getKV<Persisted>('market');
    const base = fresh();
    this.s = saved ? { ...base, ...saved, settings: sanitizeSettings(saved.settings, base.settings) } : base;
    const schema = saved?.schema ?? 0;
    if (saved && schema < 4) {
      // One-time migrations for older databases.
      if (schema < 3) {
        this.s.settings = { ...this.s.settings, ranges: structuredClone(DEFAULT_SETTINGS.ranges) }; // 2.5% to 15% moves
        for (const a of ASSETS) this.s.prices[a] = Math.min(this.s.settings.bounds[a].max, Math.max(this.s.settings.bounds[a].min, this.s.prices[a]));
      }
      // Updates every 20 minutes.
      this.s.settings = { ...this.s.settings, intervalMs: DEFAULT_SETTINGS.intervalMs, eventChance: DEFAULT_SETTINGS.eventChance };
      this.s.nextTickAt = Date.now() + this.s.settings.intervalMs;
      this.s.schema = 4;
    }
    this.prev = { ...this.s.prices };
    if (!saved) store.insertTick(Date.now(), this.s.prices);
    this.lastTickTs = this.s.lastTick || Date.now();
    this.refreshWindow();
    this.recent = store.getEvents(15);
  }

  start() {
    this.persist();
    this.schedule();
    this.housekeeping = setInterval(() => {
      this.refreshWindow();
      store.pruneHistory(Date.now() - HISTORY_RETENTION_MS);
    }, 60_000);
  }
  stop() {
    clearTimeout(this.timer);
    clearInterval(this.housekeeping);
  }

  // ---------- simulation loop ----------
  private schedule() {
    clearTimeout(this.timer);
    if (!this.s.settings.autoUpdates) return; // manual mode: no timer
    // Based on a saved due-time, so restarting the server never postpones an update.
    const wait = Math.min(2 ** 31 - 1, Math.max(0, this.s.nextTickAt - Date.now()));
    this.timer = setTimeout(() => this.tick(), wait);
  }

  private tick() {
    const now = Date.now();
    this.s.nextTickAt = now + this.s.settings.intervalMs;
    if (!this.s.paused && this.s.settings.autoUpdates) this.applyUpdate(now);
    else this.persist();
    this.schedule();
  }

  /** Runs one price update right now (the "Update" command). Returns false while the market is paused. */
  updateNow() {
    if (this.s.paused) return false;
    const now = Math.max(Date.now(), this.lastTickTs + 1);
    this.s.nextTickAt = now + this.s.settings.intervalMs;
    this.applyUpdate(now);
    this.schedule();
    return true;
  }

  /** One update: every asset moves randomly within its limits. */
  private applyUpdate(now: number) {
    this.updateEvents(now);
    const iv = this.s.settings.intervalMs;
    const slow = iv >= 60_000 || !this.s.settings.autoUpdates;
    const scale = slow ? 3 : Math.min(1, iv / 3000); // slow/manual updates get a stronger event push
    const before = { ...this.s.prices };
    const ev = this.s.activeEvent;
    for (const a of ASSETS) {
      const bias = ev ? ev.drift[a] * scale * (0.5 + Math.random()) : 0;
      const r = nextPrice(a, before[a], { settings: this.s.settings, anchor: START_PRICES[a], bias });
      this.s.prices[a] = r.price;
      this.s.totalMovePct += Math.abs(r.pct);
      this.s.ath[a] = Math.max(this.s.ath[a], r.price);
      this.s.atl[a] = Math.min(this.s.atl[a], r.price);
      this.win.high[a] = Math.max(this.win.high[a], r.price);
      this.win.low[a] = Math.min(this.win.low[a], r.price);
    }
    if (ev) ev.applied = true;
    this.prev = before;
    this.s.updates++;
    this.lastTickTs = now;
    store.insertTick(now, this.s.prices);
    this.persist();
    this.emit('snapshot', this.snapshot());
  }

  private updateEvents(now: number) {
    const s = this.s;
    const cur = s.activeEvent;
    if (cur && (cur.once ? cur.applied : now >= cur.endsAt)) s.activeEvent = null;
    if (!s.settings.eventsEnabled || s.activeEvent || s.settings.eventChance <= 0) return;
    if (Math.random() * 100 < s.settings.eventChance) this.beginEvent(pickEvent().id, now);
  }

  private beginEvent(id: string, now: number) {
    const def = EVENT_DEFS.find((e) => e.id === id);
    if (!def) return false;
    const ev = activate(def, now);
    // With slow updates the event lasts for one full update period.
    if (this.s.settings.intervalMs >= 60_000 || !this.s.settings.autoUpdates) { ev.once = true; ev.endsAt = now + 24 * 3600e3; }
    this.s.activeEvent = ev;
    this.log({ ts: now, type: def.id, icon: def.icon, title: def.title, description: def.description, endsAt: ev.endsAt });
    return true;
  }

  private log(e: Parameters<typeof store.logEvent>[0]) {
    store.logEvent(e);
    this.recent = store.getEvents(15);
  }

  private refreshWindow() {
    const w = store.windowStats(Date.now() - DAY);
    if (w) this.win = w;
    for (const a of ASSETS) {
      this.win.high[a] = Math.max(this.win.high[a], this.s.prices[a]);
      this.win.low[a] = Math.min(this.win.low[a], this.s.prices[a]);
    }
  }

  private persist() {
    this.s.lastTick = this.lastTickTs;
    store.setKV('market', this.s);
  }

  // ---------- public read API ----------
  get prices(): Prices { return { ...this.s.prices }; }

  snapshot() {
    const now = Date.now();
    const assets = {} as Record<AssetId, any>;
    for (const a of ASSETS) {
      const price = this.s.prices[a];
      const open = this.win.open[a] || price;
      const tick = price - this.prev[a];
      assets[a] = {
        id: a, name: ASSET_META[a].name, icon: ASSET_META[a].icon, price,
        open24h: open, change: price - open, changePct: ((price - open) / open) * 100,
        tickChange: tick, tickChangePct: this.prev[a] ? (tick / this.prev[a]) * 100 : 0,
        high24h: this.win.high[a], low24h: this.win.low[a],
        allTimeHigh: this.s.ath[a], allTimeLow: this.s.atl[a],
      };
    }
    const ev = this.s.activeEvent;
    return {
      now, lastTickTs: this.lastTickTs, nextTickAt: this.s.settings.autoUpdates && !this.s.paused ? this.s.nextTickAt : null, paused: this.s.paused, marketStart: this.s.marketStart,
      day: Math.floor((now - this.s.marketStart) / DAY) + 1, intervalMs: this.s.settings.intervalMs,
      assets,
      activeEvent: ev ? { id: ev.id, icon: ev.icon, title: ev.title, description: ev.description, startedAt: ev.startedAt, endsAt: ev.endsAt, once: !!ev.once } : null,
      recentEvents: this.recent,
      activity: { updates: this.s.updates, totalMovePct: this.s.totalMovePct },
      settings: this.s.settings,
    };
  }

  /** Compact shape for Discord bots. `change` is the 24h percentage change. */
  simplePrices() {
    const snap = this.snapshot();
    const out = {} as Record<AssetId, { price: number; change: number }>;
    for (const a of ASSETS) out[a] = { price: snap.assets[a].price, change: Number(snap.assets[a].changePct.toFixed(2)) };
    return out;
  }

  // ---------- admin actions ----------
  updateSettings(input: unknown) {
    const wasAuto = this.s.settings.autoUpdates;
    this.s.settings = sanitizeSettings(input, this.s.settings);
    this.s.nextTickAt = !wasAuto && this.s.settings.autoUpdates ? Date.now() + this.s.settings.intervalMs : this.lastTickTs + this.s.settings.intervalMs;
    this.enforceBounds(); // if the limits moved past the current prices, bring prices back inside
    this.persist();
    this.schedule();
    this.emit('snapshot', this.snapshot());
  }

  /** Pulls any price that is outside the (possibly just-changed) limits back to the nearest limit. */
  private enforceBounds() {
    const moved: AssetId[] = [];
    for (const a of ASSETS) {
      const b = this.s.settings.bounds[a];
      const p = Math.round(Math.min(b.max, Math.max(b.min, this.s.prices[a])));
      if (p === this.s.prices[a]) continue;
      this.prev[a] = this.s.prices[a];
      this.s.prices[a] = p;
      this.s.ath[a] = Math.max(this.s.ath[a], p);
      this.s.atl[a] = Math.min(this.s.atl[a], p);
      moved.push(a);
    }
    if (!moved.length) return;
    const now = Date.now();
    this.lastTickTs = Math.max(now, this.lastTickTs + 1);
    store.insertTick(this.lastTickTs, this.s.prices);
    for (const a of moved) {
      this.log({ ts: now, type: 'admin', icon: '🛠️', title: `${ASSET_META[a].name} price adjusted`, description: 'The price limits changed, so this price was moved back inside them.' });
    }
    this.refreshWindow();
  }
  setPaused(paused: boolean) {
    this.s.paused = paused;
    this.persist();
    this.emit('snapshot', this.snapshot());
  }
  setPrice(asset: AssetId, price: number) {
    const now = Date.now();
    this.prev = { ...this.s.prices };
    this.s.prices[asset] = Math.min(this.s.settings.bounds[asset].max, Math.max(this.s.settings.bounds[asset].min, Math.round(price)));
    this.s.ath[asset] = Math.max(this.s.ath[asset], price);
    this.s.atl[asset] = Math.min(this.s.atl[asset], price);
    this.lastTickTs = Math.max(now, this.lastTickTs + 1);
    store.insertTick(this.lastTickTs, this.s.prices);
    this.log({ ts: now, type: 'admin', icon: '🛠️', title: `${ASSET_META[asset].name} price adjusted`, description: 'An admin set this price manually.' });
    this.refreshWindow();
    this.persist();
    this.emit('snapshot', this.snapshot());
  }
  triggerEvent(id: string) {
    const ok = this.beginEvent(id, Date.now());
    if (ok) { this.persist(); this.emit('snapshot', this.snapshot()); }
    return ok;
  }
  reset() {
    const settings = this.s.settings;
    const paused = this.s.paused;
    store.wipeMarketData();
    this.s = { ...fresh(), settings, paused };
    for (const a of ASSETS) { // starting prices are clamped into the current (admin-set) limits
      const b = settings.bounds[a];
      const p = Math.min(b.max, Math.max(b.min, this.s.prices[a]));
      this.s.prices[a] = this.s.ath[a] = this.s.atl[a] = p;
    }
    this.s.nextTickAt = Date.now() + settings.intervalMs;
    this.prev = { ...this.s.prices };
    this.lastTickTs = Date.now();
    store.insertTick(this.lastTickTs, this.s.prices);
    this.log({ ts: this.lastTickTs, type: 'reset', icon: '🔄', title: 'Market reset', description: 'All prices returned to their starting values.' });
    this.win = { open: { ...this.s.prices }, high: { ...this.s.prices }, low: { ...this.s.prices } };
    this.persist();
    this.schedule();
    this.emit('snapshot', this.snapshot());
  }
}
