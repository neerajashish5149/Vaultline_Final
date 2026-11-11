# Vaultline: Fictional Market Simulator

A real-time, server-authoritative market simulator for a Discord community.
**All prices are randomly generated. Nothing is connected to real markets.**

- **Backend:** Node + Express + SQLite (`better-sqlite3`). One market engine, so every viewer sees the same prices. Live updates over Server-Sent Events.
- **Frontend:** React + TypeScript + Tailwind + Recharts (built by Vite).

```
server/
  config.ts          assets, defaults, settings validation
  priceGenerator.ts  the random-walk algorithm (edit this to change behaviour)
  events.ts          market event definitions
  engine.ts          market engine: tick loop, events, admin actions
  db.ts              SQLite storage (state, history, events)
  api.ts             REST + live stream
  index.ts           server entry
client/src/          dashboard, charts, ticker, events feed, admin drawer
```

## 1. Install dependencies
Requires Node.js 18+ (20 or 22 recommended).
```bash
npm install
```

## 2. Start the app
**Development** (hot reload, site at http://localhost:5173):
```bash
npm run dev
```
**Production** (site and API at http://localhost:3001):
```bash
npm run build
npm start
```
Prices and history are stored in `data/market.db` (change with `DB_PATH`) and survive refreshes and restarts.

## 3. Configure the market
Click **Admin** on the dashboard and enter the admin key (`abyss51.49` by default; set the `ADMIN_KEY` environment variable or `.env` file to change it). You can set the update interval, volatility, per-asset min/max move, event on/off and frequency, pause/resume, manually set a price, trigger an event, and reset (with confirmation).
Defaults live in `server/config.ts`. The algorithm is in `server/priceGenerator.ts` and the events in `server/events.ts`.
Rules built in: every update moves each asset by 2.5% to 15% (up or down), no update can exceed 15%, and Bitcoin starts at exactly 10x Diamond. Prices stay inside limits and bounce off them. The default limits are Gold $25M to $100M, Diamond $50M to $150M, Bitcoin $500M to $1.5B, and admins can change them any time under **Price limits** in the Admin drawer (then click **Save settings**). Saved limits persist across restarts; if a price is outside its new limits it is moved to the nearest limit. The defaults live in `PRICE_BOUNDS` in `server/config.ts`.

Prices change **when you send the Update command**. Click **Update prices** (shown in the header once you've unlocked Admin) or use the "Update prices now" button or the command box in the Admin drawer (type `update`). Every asset then moves randomly by 2.5% to 15% and stays inside its limits. **Only admins can update:** the server rejects the Update request without the admin key, and regular visitors don't see the Admin or Update buttons (open `your-site/#admin` to log in). Use the **Automatic updates** switch at the top of the Admin drawer to turn the timer on or off instantly (every 20 minutes by default, or whatever you set under "Minutes between automatic updates"); the next due time is saved across restarts. In manual mode a market event applies to the next update only.

## 4. Connect a Discord bot later
Read endpoints are public JSON (CORS enabled):

| Endpoint | Returns |
|---|---|
| `GET /api/prices` | `{ gold:{price,change}, diamond:{...}, bitcoin:{...} }` (`change` = 24h %) |
| `GET /api/prices/gold` | full detail for one asset (24h high/low, all-time high/low, ...) |
| `GET /api/market` | everything: prices, status, active event, settings |
| `GET /api/history?range=24h&asset=bitcoin` | history (`1h`,`6h`,`24h`,`72h`,`7d`,`30d`,`all`; optional `points`) |
| `GET /api/events?limit=10` | recent market events |
| `GET /api/stream` | live Server-Sent Events stream |

Example discord.js slash command:
```js
const res = await fetch('https://your-domain.com/api/prices');
const m = await res.json();
await interaction.reply(`🥇 $${m.gold.price.toLocaleString()} (${m.gold.change}%)`);
```
Admin routes (`PUT /api/admin/settings`, `POST /api/admin/update|auto|pause|resume|reset|price|event`) need the header `x-admin-key: <ADMIN_KEY>`.

Turn automatic updates on or off with `POST /api/admin/auto` and body `{"enabled": true}`.

Trigger an update from a script or bot:
```bash
curl -X POST https://your-domain.com/api/admin/update -H "x-admin-key: abyss51.49"
```

## 5. Deploy online
Short version for Railway: see **DEPLOY_TO_RAILWAY.md**.

The app needs a long-running Node process and a persistent disk (SQLite file).
- **VPS** (any provider): install Node, clone, `npm install && npm run build`, optionally set `ADMIN_KEY` and `PORT`, run `npm start` under `pm2` or systemd, put Nginx/Caddy in front with HTTPS. For Nginx, add `proxy_buffering off;` for `/api/stream`.
- **Railway / Render / Fly.io**: build command `npm install && npm run build`, start command `npm start`, and **attach a persistent volume** with `DB_PATH` pointing to it (for example `/data/market.db`). Without a volume the history resets on each deploy.
- Run **one instance only**. The engine lives in memory, so scaling to several instances would create separate markets.
