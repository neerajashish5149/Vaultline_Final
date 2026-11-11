// STORAGE — SQLite (file on disk). Survives reloads and server restarts.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { Prices } from './config';

// On Railway, an attached Volume is detected automatically and the database is stored on it.
const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const file = process.env.DB_PATH ?? (volume ? path.join(volume, 'market.db') : path.resolve('data/market.db'));
fs.mkdirSync(path.dirname(file), { recursive: true });
export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS history (ts INTEGER PRIMARY KEY, gold REAL NOT NULL, diamond REAL NOT NULL, bitcoin REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, type TEXT NOT NULL, icon TEXT NOT NULL,
    title TEXT NOT NULL, description TEXT NOT NULL, ends_at INTEGER
  );
`);

export interface HistoryPoint extends Prices { ts: number }
export interface EventRow { id: number; ts: number; type: string; icon: string; title: string; description: string; endsAt: number | null }

const q = {
  getKV: db.prepare('SELECT value FROM kv WHERE key = ?'),
  setKV: db.prepare('INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
  insertTick: db.prepare('INSERT OR REPLACE INTO history(ts, gold, diamond, bitcoin) VALUES(?, ?, ?, ?)'),
  since: db.prepare('SELECT ts, gold, diamond, bitcoin FROM history WHERE ts >= ? ORDER BY ts'),
  prune: db.prepare('DELETE FROM history WHERE ts < ?'),
  stats: db.prepare('SELECT MIN(gold) gl, MAX(gold) gh, MIN(diamond) dl, MAX(diamond) dh, MIN(bitcoin) bl, MAX(bitcoin) bh FROM history WHERE ts >= ?'),
  base: db.prepare('SELECT ts FROM history WHERE ts <= ? ORDER BY ts DESC LIMIT 1'),
  first: db.prepare('SELECT gold, diamond, bitcoin FROM history WHERE ts >= ? ORDER BY ts LIMIT 1'),
  insertEvent: db.prepare('INSERT INTO events(ts, type, icon, title, description, ends_at) VALUES(?,?,?,?,?,?)'),
  events: db.prepare('SELECT id, ts, type, icon, title, description, ends_at AS endsAt FROM events ORDER BY id DESC LIMIT ?'),
};

export const getKV = <T>(key: string): T | null => {
  const row = q.getKV.get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : null;
};
export const setKV = (key: string, value: unknown) => void q.setKV.run(key, JSON.stringify(value));
export const insertTick = (ts: number, p: Prices) => void q.insertTick.run(ts, p.gold, p.diamond, p.bitcoin);
export const pruneHistory = (olderThan: number) => void q.prune.run(olderThan);

/** Returns history since `since`, thinned to roughly `maxPoints` points. */
export function getHistory(since: number, maxPoints: number): HistoryPoint[] {
  const rows = q.since.all(since) as HistoryPoint[];
  if (rows.length <= maxPoints) return rows;
  const stride = Math.ceil(rows.length / maxPoints);
  const out = rows.filter((_, i) => i % stride === 0);
  if (out[out.length - 1] !== rows[rows.length - 1]) out.push(rows[rows.length - 1]);
  return out;
}

export function windowStats(since: number) {
  // Baseline = the last update at or before the window start, so slow update intervals still give a 24h change.
  const b = q.base.get(since) as { ts: number } | undefined;
  const from = b ? b.ts : since;
  const s = q.stats.get(from) as { gl: number; gh: number; dl: number; dh: number; bl: number; bh: number } | undefined;
  const f = q.first.get(from) as Prices | undefined;
  if (!s || !f || s.gl == null) return null;
  return {
    open: { gold: f.gold, diamond: f.diamond, bitcoin: f.bitcoin },
    high: { gold: s.gh, diamond: s.dh, bitcoin: s.bh },
    low: { gold: s.gl, diamond: s.dl, bitcoin: s.bl },
  };
}

export function logEvent(e: { ts: number; type: string; icon: string; title: string; description: string; endsAt?: number | null }) {
  q.insertEvent.run(e.ts, e.type, e.icon, e.title, e.description, e.endsAt ?? null);
}
export const getEvents = (limit: number) => q.events.all(limit) as EventRow[];

export function wipeMarketData() {
  db.exec("DELETE FROM history; DELETE FROM events;");
}
