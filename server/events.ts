// MARKET EVENTS — add, remove or tweak events here.
import { Prices } from './config';

export interface EventDef {
  id: string;
  icon: string;
  title: string;
  description: string;
  weight: number; // relative likelihood
  drift: Prices; // extra percent per update (at the default 3s interval) while active
  minSec: number;
  maxSec: number;
}

export interface ActiveEvent {
  id: string;
  icon: string;
  title: string;
  description: string;
  drift: Prices;
  startedAt: number;
  endsAt: number;
  once?: boolean; // lasts for exactly one update
  applied?: boolean;
}

export const EVENT_DEFS: EventDef[] = [
  { id: 'boom', icon: '📈', title: 'Market Boom', description: 'Buyers flood in. Every asset climbs.', weight: 3, drift: { gold: 0.3, diamond: 0.4, bitcoin: 1.0 }, minSec: 30, maxSec: 75 },
  { id: 'crash', icon: '📉', title: 'Market Crash', description: 'Panic selling. Every asset drops.', weight: 3, drift: { gold: -0.3, diamond: -0.45, bitcoin: -1.1 }, minSec: 30, maxSec: 75 },
  { id: 'diamond-shortage', icon: '💎', title: 'Diamond Shortage', description: 'Supply dries up and Diamond spikes.', weight: 2, drift: { gold: 0, diamond: 0.9, bitcoin: 0 }, minSec: 25, maxSec: 60 },
  { id: 'gold-rush', icon: '🪙', title: 'Gold Rush', description: 'A new vein is found and Gold rises.', weight: 2, drift: { gold: 0.7, diamond: 0, bitcoin: 0 }, minSec: 25, maxSec: 60 },
  { id: 'btc-rally', icon: '₿', title: 'Bitcoin Rally', description: 'Bitcoin surges on heavy demand.', weight: 2, drift: { gold: 0, diamond: 0, bitcoin: 1.6 }, minSec: 25, maxSec: 60 },
  { id: 'btc-crash', icon: '₿', title: 'Bitcoin Crash', description: 'Bitcoin tumbles as holders bail.', weight: 2, drift: { gold: 0, diamond: 0, bitcoin: -1.8 }, minSec: 25, maxSec: 60 },
];

export function pickEvent(): EventDef {
  const total = EVENT_DEFS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of EVENT_DEFS) if ((r -= e.weight) <= 0) return e;
  return EVENT_DEFS[0];
}

export function activate(def: EventDef, now: number): ActiveEvent {
  const dur = (def.minSec + Math.random() * (def.maxSec - def.minSec)) * 1000;
  return { id: def.id, icon: def.icon, title: def.title, description: def.description, drift: def.drift, startedAt: now, endsAt: now + dur };
}
