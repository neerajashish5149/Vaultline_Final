// PRICE GENERATION — edit this file to change how prices move.
import { AssetId, HARD_MAX_MOVE_PCT, Settings } from './config';

export interface PriceContext {
  settings: Settings;
  anchor: number; // long-run reference price (the starting price)
  bias: number; // extra percent drift per update (set by market events)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * One update of the random walk:
 *  - every update moves the price by at least `min` percent and at most `max` percent (never less than min)
 *  - move size is random, skewed a little toward the smaller end
 *  - direction is random, with a gentle pull back toward the starting price
 *  - an active market event pushes the move in its direction and makes it larger
 *  - prices bounce off their minimum and maximum instead of sticking to them
 *  - a hard cap per update keeps prices from ever jumping wildly
 * Returns the new price and the percent move actually applied.
 */
export function nextPrice(asset: AssetId, price: number, ctx: PriceContext) {
  const { min, max } = ctx.settings.ranges[asset];
  const vol = ctx.settings.volatility;
  const bounds = ctx.settings.bounds[asset]; // admin-editable price limits

  const size = (min + (max - min) * Math.pow(Math.random(), 1.6)) * vol;
  const deviation = Math.log(price / ctx.anchor);
  const pUp = clamp(0.5 - deviation * 0.15, 0.35, 0.65);
  let dir = Math.random() < pUp ? 1 : -1;
  const bs = Math.sign(ctx.bias);
  if (bs !== 0 && Math.random() < 0.85) dir = bs;

  let pct = dir * size + (dir === bs ? ctx.bias : 0);
  if (Math.abs(pct) < min * vol) pct = dir * min * vol; // guarantee the minimum move
  pct = clamp(pct, -HARD_MAX_MOVE_PCT, HARD_MAX_MOVE_PCT);

  let next = price * (1 + pct / 100);
  if (next > bounds.max || next < bounds.min) next = price * (1 - pct / 100); // bounce off the limit
  next = Math.round(clamp(next, bounds.min, bounds.max));
  return { price: next, pct: (next / price - 1) * 100 };
}
