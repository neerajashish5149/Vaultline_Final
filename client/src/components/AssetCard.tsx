import { arrow, pct, usd, usdSigned } from '../format';
import { AssetSnap, META } from '../types';

export function AssetCard({ a }: { a: AssetSnap }) {
  const m = META[a.id];
  const up = a.changePct >= 0;
  const flash = a.tickChange > 0 ? 'flash-up' : a.tickChange < 0 ? 'flash-down' : '';
  return (
    <article className="glass relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-25 blur-3xl" style={{ background: m.color }} />
      <header className="flex items-center justify-between">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold tracking-wide">
          <span className="text-2xl">{m.icon}</span> {m.name.toUpperCase()}
        </h2>
        <span className={`text-xs ${a.tickChange >= 0 ? 'text-up' : 'text-down'}`}>{arrow(a.tickChange)} {pct(a.tickChangePct)} last update</span>
      </header>
      <div key={a.price} className={`font-display mt-4 text-3xl font-bold sm:text-4xl ${flash}`}>{usd(a.price)}</div>
      <div className={`mt-2 flex flex-wrap items-baseline gap-x-3 text-sm font-semibold ${up ? 'text-up' : 'text-down'}`}>
        <span className="text-base">{arrow(a.changePct)} {pct(a.changePct)}</span>
        <span>{usdSigned(a.change)}</span>
        <span className="font-normal text-muted">24h</span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-sm">
        <Stat label="24h high" value={usd(a.high24h)} />
        <Stat label="24h low" value={usd(a.low24h)} />
        <Stat label="All-time high" value={usd(a.allTimeHigh)} />
        <Stat label="All-time low" value={usd(a.allTimeLow)} />
      </dl>
    </article>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div><dt className="text-xs text-muted">{label}</dt><dd className="truncate">{value}</dd></div>
);
