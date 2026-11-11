import { useEffect, useState } from 'react';
import { AdminDrawer } from './components/AdminDrawer';
import { AssetCard } from './components/AssetCard';
import { NormalizedChart, PriceChart } from './components/Charts';
import { EventsFeed } from './components/EventsFeed';
import { Ticker } from './components/Ticker';
import { ago, inTime, intervalLabel } from './format';
import { useMarket } from './useMarket';
import { ASSET_IDS, AssetId, META, RANGES, RangeKey } from './types';

export default function App() {
  const [range, setRange] = useState<RangeKey>('all');
  const [enabled, setEnabled] = useState<AssetId[]>([...ASSET_IDS]);
  const [adminOpen, setAdminOpen] = useState(() => window.location.hash === '#admin');
  const [hasKey, setHasKey] = useState(() => !!sessionStorage.getItem('adminKey'));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const f = () => setHash(window.location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const showAdmin = hasKey || hash === '#admin'; // regular visitors see no admin controls
  const { snap, history, moves, live, offset } = useMarket(range);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t); }, []);
  const now = tick + offset; // server-synced clock

  async function runUpdate() {
    const key = sessionStorage.getItem('adminKey');
    if (!key) return setAdminOpen(true);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/update', { method: 'POST', headers: { 'x-admin-key': key } });
      if (res.status === 401) { sessionStorage.removeItem('adminKey'); setHasKey(false); setAdminOpen(true); }
      else if (!res.ok) setNote((await res.json().catch(() => ({}))).error ?? 'Update failed.');
      else setNote('Prices updated.');
    } catch { setNote('Could not reach the server.'); }
    setBusy(false);
    setTimeout(() => setNote(''), 3000);
  }

  const toggle = (a: AssetId) => setEnabled((e) => (e.includes(a) ? e.filter((x) => x !== a) : [...e, a]));
  const status = !live ? { dot: '🔴', text: 'RECONNECTING' } : snap?.paused ? { dot: '🟡', text: 'MARKET PAUSED' } : { dot: '🟢', text: 'MARKET OPEN' };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <div className="sticky top-0 z-40 -mx-4 border-b border-gold/30 bg-ink/90 px-4 py-2 text-center text-xs font-semibold text-gold backdrop-blur">
        FICTIONAL MARKET SIMULATOR — Prices are randomly generated.
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Vaultline</h1>
          <p className="text-sm text-muted">A pretend market for the server. Nothing here is real money.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="glass !rounded-full px-4 py-1.5 font-semibold"><span className={live && !snap?.paused ? 'pulse' : ''}>{status.dot}</span> {status.text}</span>
          {note && <span role="status" className="text-xs text-muted">{note}</span>}
          {hasKey && <button className="btn btn-primary" disabled={busy} onClick={runUpdate}>Update prices</button>}
          {showAdmin && <button className="btn" onClick={() => setAdminOpen(true)}>Admin</button>}
        </div>
      </header>

      {!snap ? (
        <p className="glass p-8 text-center text-muted">Connecting to the market…</p>
      ) : (
        <main className="space-y-6">
          <Ticker moves={moves} />

          {snap.activeEvent && (
            <div className="glass flex flex-wrap items-center gap-3 border-gold/40 px-5 py-3 text-sm">
              <span className="text-2xl">{snap.activeEvent.icon}</span>
              <div className="flex-1"><b>{snap.activeEvent.title}</b> <span className="text-muted">{snap.activeEvent.description}</span></div>
              <span className="text-muted">{snap.activeEvent.once ? 'until the next update' : `ends in ${Math.max(0, Math.round((snap.activeEvent.endsAt - now) / 1000))}s`}</span>
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-3">
            {ASSET_IDS.map((a) => <AssetCard key={a} a={snap.assets[a]} />)}
          </section>

          <section className="glass p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">Price history</h2>
              <div className="flex flex-wrap items-center gap-2">
                {ASSET_IDS.map((a) => (
                  <button key={a} aria-pressed={enabled.includes(a)} onClick={() => toggle(a)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${enabled.includes(a) ? 'bg-white/10' : 'opacity-40'}`}
                    style={{ borderColor: enabled.includes(a) ? META[a].color : 'rgba(255,255,255,.12)' }}>
                    {META[a].icon} {META[a].name}
                  </button>
                ))}
                <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
                {(Object.keys(RANGES) as RangeKey[]).map((r) => (
                  <button key={r} onClick={() => setRange(r)} aria-pressed={range === r}
                    className={`btn !px-2.5 !py-1 ${range === r ? 'btn-primary' : ''}`}>{r === 'all' ? 'All' : r}</button>
                ))}
              </div>
            </div>
            <p className="mb-1 text-xs text-muted">Percentage change since the start of the window (compares all assets on one scale)</p>
            {history.length < 2 && (
              <p className="my-3 rounded-lg bg-white/5 p-3 text-sm text-muted">
                Prices change each time an update runs. The lines appear once there have been two updates.
              </p>
            )}
            <NormalizedChart data={history} enabled={enabled} />
            <p className="mb-2 mt-5 text-xs text-muted">Actual prices</p>
            <div className="grid gap-3 lg:grid-cols-3">
              {ASSET_IDS.filter((a) => enabled.includes(a)).map((a) => <PriceChart key={a} data={history} asset={a} />)}
            </div>
            {enabled.length === 0 && <p className="py-6 text-center text-sm text-muted">Turn on at least one asset to see its chart.</p>}
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2"><EventsFeed events={snap.recentEvents} now={now} /></div>
            <div className="glass p-5">
              <h2 className="font-display mb-3 text-lg font-bold">Market status</h2>
              <dl className="space-y-2 text-sm">
                <Row k="Market time" v={`Day ${snap.day}, ${new Date(now).toISOString().slice(11, 19)} UTC`} />
                <Row k="Last updated" v={snap.paused ? 'Paused' : ago(now - snap.lastTickTs)} />
                <Row k="Update interval" v={snap.settings.autoUpdates ? `Every ${intervalLabel(snap.intervalMs)}` : 'Manual'} />
                <Row k="Next update" v={snap.paused ? 'Paused' : snap.nextTickAt ? `in ${inTime(snap.nextTickAt - now)}` : 'When an admin sends Update'} />
                <Row k="Updates so far" v={snap.activity.updates.toLocaleString()} />
                <Row k="Total movement" v={`${snap.activity.totalMovePct.toFixed(0)}% combined`} />
              </dl>
            </div>
          </section>
        </main>
      )}

      <footer className="mt-10 text-center text-xs text-muted">FICTIONAL MARKET SIMULATOR — Prices are randomly generated and have no real-world value.</footer>
      {adminOpen && snap && <AdminDrawer snap={snap} onClose={() => { setAdminOpen(false); setHasKey(!!sessionStorage.getItem('adminKey')); }} />}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
);
