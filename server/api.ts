// HTTP API — read endpoints are public (for the dashboard and Discord bots); admin endpoints need ADMIN_KEY.
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { ASSETS, ASSET_META, AssetId, validateBounds } from './config';
import { MarketEngine } from './engine';
import { EVENT_DEFS } from './events';
import { getEvents, getHistory } from './db';

// Default admin key. Set the ADMIN_KEY environment variable to override it.
const ADMIN_KEY = (process.env.ADMIN_KEY || 'abyss51.49').trim();
const RANGES: Record<string, number> = { '15m': 15 * 60e3, '1h': 3600e3, '6h': 6 * 3600e3, '24h': 24 * 3600e3, '7d': 7 * 24 * 3600e3, '30d': 30 * 24 * 3600e3, '72h': 72 * 3600e3, all: Infinity };
const isAsset = (v: unknown): v is AssetId => ASSETS.includes(v as AssetId);

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const given = Buffer.from(String(req.header('x-admin-key') ?? ''));
  const real = Buffer.from(ADMIN_KEY);
  if (!ADMIN_KEY || given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
    return res.status(401).json({ error: 'Invalid or missing admin key.' });
  }
  next();
}

export function createApi(engine: MarketEngine) {
  const r = Router();

  // --- live stream (Server-Sent Events): everyone receives the same ticks ---
  const clients = new Set<Response>();
  engine.on('snapshot', (snap) => {
    const msg = `event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`;
    clients.forEach((c) => c.write(msg));
  });
  setInterval(() => clients.forEach((c) => c.write(': ping\n\n')), 25_000).unref();

  r.get('/stream', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: snapshot\ndata: ${JSON.stringify(engine.snapshot())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
  });

  // --- public read API ---
  r.get('/prices', (_req, res) => res.json(engine.simplePrices())); // { gold:{price,change}, ... }
  r.get('/market', (_req, res) => res.json(engine.snapshot())); // everything
  r.get('/prices/:asset', (req, res) => {
    if (!isAsset(req.params.asset)) return res.status(404).json({ error: `Unknown asset. Use: ${ASSETS.join(', ')}` });
    res.json(engine.snapshot().assets[req.params.asset]);
  });
  r.get('/history', (req, res) => {
    const range = String(req.query.range ?? '1h');
    const span = RANGES[range];
    if (span === undefined) return res.status(400).json({ error: `range must be one of ${Object.keys(RANGES).join(', ')}` });
    const points = Math.min(5000, Math.max(10, Number(req.query.points) || 900));
    let data = getHistory(span === Infinity ? 0 : Date.now() - span, points);
    const asset = req.query.asset;
    if (asset !== undefined) {
      if (!isAsset(asset)) return res.status(400).json({ error: 'Unknown asset.' });
      return res.json({ asset, range, points: data.map((p) => ({ ts: p.ts, price: p[asset] })) });
    }
    res.json({ range, points: data });
  });
  r.get('/events', (req, res) => res.json({ events: getEvents(Math.min(100, Number(req.query.limit) || 20)) }));
  r.get('/event-types', (_req, res) => res.json(EVENT_DEFS.map(({ id, icon, title }) => ({ id, icon, title }))));

  // --- admin API ---
  const admin = Router();
  admin.use(requireAdmin);
  admin.get('/check', (_req, res) => res.json({ ok: true }));
  admin.put('/settings', (req, res) => {
    const err = validateBounds(req.body);
    if (err) return res.status(400).json({ error: err });
    engine.updateSettings(req.body);
    res.json(engine.snapshot().settings);
  });
  admin.post('/pause', (_req, res) => { engine.setPaused(true); res.json({ paused: true }); });
  admin.post('/resume', (_req, res) => { engine.setPaused(false); res.json({ paused: false }); });
  admin.post('/update', (_req, res) => {
    if (!engine.updateNow()) return res.status(409).json({ error: 'The market is paused. Resume it first.' });
    res.json({ ok: true, prices: engine.simplePrices() });
  });
  admin.post('/auto', (req, res) => {
    engine.updateSettings({ autoUpdates: Boolean(req.body?.enabled) });
    res.json({ autoUpdates: engine.snapshot().settings.autoUpdates });
  });
  admin.post('/reset', (_req, res) => { engine.reset(); res.json({ ok: true }); });
  admin.post('/price', (req, res) => {
    const { asset, price } = req.body ?? {};
    const p = Number(price);
    if (!isAsset(asset)) return res.status(400).json({ error: 'Unknown asset.' });
    const b = engine.snapshot().settings.bounds[asset]; // admin-editable limits
    if (!Number.isFinite(p) || p < b.min || p > b.max)
      return res.status(400).json({ error: `${ASSET_META[asset].name} must be between $${b.min.toLocaleString('en-US')} and $${b.max.toLocaleString('en-US')}.` });
    engine.setPrice(asset, p);
    res.json({ ok: true });
  });
  admin.post('/event', (req, res) => {
    if (!engine.triggerEvent(String(req.body?.id))) return res.status(400).json({ error: 'Unknown event id.' });
    res.json({ ok: true });
  });
  r.use('/admin', admin);

  r.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  return r;
}
