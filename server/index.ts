import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApi } from './api';
import { MarketEngine } from './engine';
import { db } from './db';

try { process.loadEnvFile('.env'); } catch { /* no .env file: defaults are used */ }
const PORT = Number(process.env.PORT) || 3001;

const engine = new MarketEngine();
engine.start();

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use('/api', (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // lets a Discord bot or other site read prices
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-admin-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  if (_req.method === 'OPTIONS') return void res.sendStatus(204);
  next();
});
app.use('/api', createApi(engine));

const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const server = app.listen(PORT, () => console.log(`Market running on http://localhost:${PORT}`));
const shutdown = () => { engine.stop(); server.close(); db.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
