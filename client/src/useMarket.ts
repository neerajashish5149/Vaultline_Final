import { useEffect, useRef, useState } from 'react';
import { Move, Point, RANGES, RangeKey, Snapshot, ASSET_IDS } from './types';

const MAX_POINTS = 4000;

/** Loads history for the chosen range and keeps it live via the server's SSE stream. */
export function useMarket(range: RangeKey) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Point[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [live, setLive] = useState(false);
  const [offset, setOffset] = useState(0); // server clock minus browser clock
  const rangeRef = useRef(range);
  rangeRef.current = range;

  useEffect(() => {
    let cancel = false;
    fetch(`/api/history?range=${range}&points=900`)
      .then((r) => r.json())
      .then((d) => { if (!cancel && d.points) setHistory(d.points); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [range]);

  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener('snapshot', (e) => {
      const s: Snapshot = JSON.parse((e as MessageEvent).data);
      setSnap(s);
      setOffset(s.now - Date.now());
      setHistory((h) => {
        if (h.length && h[h.length - 1].ts >= s.lastTickTs) return h;
        const span = RANGES[rangeRef.current];
        const cutoff = span === Infinity ? 0 : s.now - span;
        const next = [...h, { ts: s.lastTickTs, gold: s.assets.gold.price, diamond: s.assets.diamond.price, bitcoin: s.assets.bitcoin.price }];
        return next.filter((p) => p.ts >= cutoff).slice(-MAX_POINTS);
      });
      setMoves((m) => {
        if (s.paused || s.activity.updates === 0) return m;
        const add = ASSET_IDS.map((id) => ({ key: `${s.lastTickTs}-${id}`, id, price: s.assets[id].price, pct: s.assets[id].tickChangePct }));
        const seen = new Set(m.map((x) => x.key));
        return [...add.filter((x) => !seen.has(x.key)), ...m].slice(0, 18);
      });
    });
    return () => es.close();
  }, []);

  return { snap, history, moves, live, offset };
}
