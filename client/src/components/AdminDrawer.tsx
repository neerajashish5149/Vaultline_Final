import { useEffect, useState } from 'react';
import { intervalLabel } from '../format';
import { ASSET_IDS, AssetId, META, Settings, Snapshot } from '../types';

const EVENT_OPTIONS = [
  ['boom', '📈 Market Boom'], ['crash', '📉 Market Crash'], ['diamond-shortage', '💎 Diamond Shortage'],
  ['gold-rush', '🪙 Gold Rush'], ['btc-rally', '₿ Bitcoin Rally'], ['btc-crash', '₿ Bitcoin Crash'],
];

export function AdminDrawer({ snap, onClose }: { snap: Snapshot; onClose: () => void }) {
  const [key, setKey] = useState(() => sessionStorage.getItem('adminKey') ?? '');
  const [authed, setAuthed] = useState(false);
  const [form, setForm] = useState<Settings>(snap.settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState(String(+(snap.settings.intervalMs / 60_000).toFixed(2)));
  const [cmd, setCmd] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [priceAsset, setPriceAsset] = useState<AssetId>('gold');
  const [priceValue, setPriceValue] = useState('');
  const [eventId, setEventId] = useState('boom');

  async function call(path: string, method = 'POST', body?: unknown) {
    try {
      const res = await fetch(`/api/admin${path}`, {
        method, headers: { 'content-type': 'application/json', 'x-admin-key': key.trim() }, body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      return data;
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
      return null;
    }
  }
  const done = (text: string) => setMsg({ ok: true, text });
  async function toggleAuto() {
    const on = !snap.settings.autoUpdates;
    if (await call('/auto', 'POST', { enabled: on })) done(on ? 'Automatic updates turned on.' : 'Automatic updates turned off.');
  }
  async function runUpdate() { if (await call('/update')) done('Prices updated.'); }
  async function runCommand() {
    const c = cmd.trim().toLowerCase().replace(/^\//, '');
    if (!c) return;
    if (c === 'update') await runUpdate(); else setMsg({ ok: false, text: 'Unknown command. Try: update' });
    setCmd('');
  }

  async function login() {
    if (await call('/check', 'GET')) { sessionStorage.setItem('adminKey', key.trim()); setAuthed(true); setMsg(null); }
  }
  useEffect(() => { if (key) void login(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setBound = (a: AssetId, k: 'min' | 'max', v: string) =>
    setForm((f) => ({ ...f, bounds: { ...f.bounds, [a]: { ...f.bounds[a], [k]: Number(v.replace(/[^\d]/g, '')) } } }));
  const setRange = (a: AssetId, k: 'min' | 'max', v: string) =>
    setForm((f) => ({ ...f, ranges: { ...f.ranges, [a]: { ...f.ranges[a], [k]: Number(v) } } }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label="Market controls" className="glass h-full w-full max-w-md overflow-y-auto !rounded-none !rounded-l-2xl bg-ink/95 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Market controls</h2>
          <div className="flex gap-2">
            {authed && <button className="btn" onClick={() => { sessionStorage.removeItem('adminKey'); onClose(); }}>Lock</button>}
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>

        {!authed ? (
          <div className="space-y-3">
            <label className="label" htmlFor="ak">Admin key</label>
            <input id="ak" className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
            <button className="btn btn-primary" onClick={login}>Unlock controls</button>
          </div>
        ) : (
          <div className="space-y-7">
            <section className="space-y-2">
              <button className="btn btn-primary w-full !py-3 text-base" onClick={runUpdate}>Update prices now</button>
              <input aria-label="Command" className="input" placeholder='Or type a command: update' value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runCommand()} />
              <p className="text-xs text-muted">Every asset moves randomly (2.5% to 15% by default) and stays inside its price limits.</p>
            </section>
            <section className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div>
                <div className="text-sm font-semibold">Automatic updates: {snap.settings.autoUpdates ? 'ON' : 'OFF'}</div>
                <div className="text-xs text-muted">{snap.settings.autoUpdates ? `Prices change every ${intervalLabel(snap.settings.intervalMs)}.` : 'Prices only change when an admin sends Update.'}</div>
              </div>
              <button role="switch" aria-checked={snap.settings.autoUpdates} className={`btn ${snap.settings.autoUpdates ? 'btn-primary' : ''}`} onClick={toggleAuto}>
                {snap.settings.autoUpdates ? 'Turn off' : 'Turn on'}
              </button>
            </section>
            <section className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={async () => (await call(snap.paused ? '/resume' : '/pause')) && done(snap.paused ? 'Market resumed.' : 'Market paused.')}>
                {snap.paused ? 'Resume market' : 'Pause market'}
              </button>
              <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>Reset market</button>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">Simulation</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Minutes between automatic updates</label>
                  <input className="input" type="number" min={0.01} max={10080} step="any" value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} /></div>
                <div><label className="label">Volatility ({form.volatility.toFixed(1)}x)</label>
                  <input className="mt-2 w-full accent-[#5CE1FF]" type="range" min={0.1} max={3} step={0.1} value={form.volatility} onChange={(e) => setForm({ ...form, volatility: Number(e.target.value) })} /></div>
              </div>
              <p className="text-xs text-muted">Move size per update, in percent (minimum to maximum):</p>
              {ASSET_IDS.map((a) => (
                <div key={a} className="grid grid-cols-[90px_1fr_1fr] items-center gap-2 text-sm">
                  <span style={{ color: META[a].color }}>{META[a].icon} {META[a].name}</span>
                  <input aria-label={`${a} minimum`} className="input" type="number" step={0.05} min={0.01} max={15} value={form.ranges[a].min} onChange={(e) => setRange(a, 'min', e.target.value)} />
                  <input aria-label={`${a} maximum`} className="input" type="number" step={0.05} min={0.01} max={15} value={form.ranges[a].max} onChange={(e) => setRange(a, 'max', e.target.value)} />
                </div>
              ))}
              <p className="text-xs text-muted">Price limits in dollars (lowest to highest price each asset can reach):</p>
              {ASSET_IDS.map((a) => (
                <div key={a} className="grid grid-cols-[90px_1fr_1fr] items-center gap-2 text-sm">
                  <span style={{ color: META[a].color }}>{META[a].icon} {META[a].name}</span>
                  <input aria-label={`${a} lowest price`} className="input" inputMode="numeric" value={form.bounds[a].min.toLocaleString('en-US')} onChange={(e) => setBound(a, 'min', e.target.value)} />
                  <input aria-label={`${a} highest price`} className="input" inputMode="numeric" value={form.bounds[a].max.toLocaleString('en-US')} onChange={(e) => setBound(a, 'max', e.target.value)} />
                </div>
              ))}
              <p className="text-xs text-muted">If a price is outside its new limits when you save, it is moved to the nearest limit.</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#5CE1FF]" checked={form.eventsEnabled} onChange={(e) => setForm({ ...form, eventsEnabled: e.target.checked })} /> Enable random market events</label>
              <div><label className="label">Event chance on each update (%)</label>
                <input className="input" type="number" min={0} max={100} step={1} value={form.eventChance} onChange={(e) => setForm({ ...form, eventChance: Number(e.target.value) })} /></div>
              <button className="btn btn-primary" onClick={async () => (await call('/settings', 'PUT', { ...form, intervalMs: Number(intervalMinutes) * 60_000, autoUpdates: snap.settings.autoUpdates })) && done('Settings saved.')}>Save settings</button>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Set a price manually</h3>
              <div className="flex gap-2">
                <select className="input !w-36" value={priceAsset} onChange={(e) => setPriceAsset(e.target.value as AssetId)}>
                  {ASSET_IDS.map((a) => <option key={a} value={a}>{META[a].icon} {META[a].name}</option>)}
                </select>
                <input className="input" inputMode="numeric" placeholder="New price in dollars" value={priceValue} onChange={(e) => setPriceValue(e.target.value.replace(/[^\d]/g, ''))} />
                <button className="btn btn-primary" disabled={!priceValue} onClick={async () => (await call('/price', 'POST', { asset: priceAsset, price: Number(priceValue) })) && (done(`${META[priceAsset].name} price updated.`), setPriceValue(''))}>Set</button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Trigger an event now</h3>
              <div className="flex gap-2">
                <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  {EVENT_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <button className="btn btn-primary" onClick={async () => (await call('/event', 'POST', { id: eventId })) && done('Event started. It affects the next update.')}>Start</button>
              </div>
            </section>
          </div>
        )}

        {msg && <p role="status" className={`mt-5 text-sm ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.text}</p>}
      </aside>

      {confirmReset && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4">
          <div role="alertdialog" aria-labelledby="rt" className="glass max-w-sm bg-ink/95 p-6">
            <h3 id="rt" className="font-display text-lg font-bold">Reset the market?</h3>
            <p className="mt-2 text-sm text-muted">This deletes all price history and events, and returns every asset to its starting price. It can't be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={async () => { setConfirmReset(false); (await call('/reset')) && done('Market reset.'); }}>Reset market</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
