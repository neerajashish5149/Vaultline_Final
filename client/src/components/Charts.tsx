import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact, pct, usd } from '../format';
import { ASSET_IDS, AssetId, META, Point } from '../types';

const axis = { stroke: '#8A93AD', fontSize: 11, tickLine: false, axisLine: false } as const;
const tickTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Tip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="glass !rounded-xl border-white/15 bg-ink/90 p-3 text-xs shadow-xl">
      <div className="mb-2 text-muted">{new Date(row.ts).toLocaleString()}</div>
      {payload.map((p: any) => {
        const id = String(p.dataKey).replace('Pct', '') as AssetId;
        return (
          <div key={id} className="flex items-center justify-between gap-5 py-0.5">
            <span style={{ color: META[id].color }}>{META[id].icon} {META[id].name}</span>
            <span className="text-right">
              {usd(row[id])}
              {String(p.dataKey).endsWith('Pct') && <span className="ml-2 text-muted">{pct(row[id + 'Pct'])}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Percentage change since the start of the visible window: makes all three assets comparable. */
export function NormalizedChart({ data, enabled }: { data: Point[]; enabled: AssetId[] }) {
  const base = data[0];
  const rows = base
    ? data.map((p) => ({
        ...p,
        goldPct: (p.gold / base.gold - 1) * 100,
        diamondPct: (p.diamond / base.diamond - 1) * 100,
        bitcoinPct: (p.bitcoin / base.bitcoin - 1) * 100,
      }))
    : [];
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={tickTime} minTickGap={50} {...axis} />
        <YAxis tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={54} domain={['auto', 'auto']} {...axis} />
        <Tooltip content={<Tip />} cursor={{ stroke: 'rgba(255,255,255,.25)' }} />
        {ASSET_IDS.filter((a) => enabled.includes(a)).map((a) => (
          <Line key={a} className={META[a].cls} dataKey={`${a}Pct`} type="monotone" dot={false} stroke={META[a].color}
            strokeWidth={2.2} animationDuration={400} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Actual-price chart for one asset. */
export function PriceChart({ data, asset }: { data: Point[]; asset: AssetId }) {
  const m = META[asset];
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span style={{ color: m.color }}>{m.icon} {m.name}</span>
        <span className="text-muted">{data.length ? usd(data[data.length - 1][asset]) : ''}</span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`fill-${asset}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={m.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={m.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
          <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={tickTime} minTickGap={50} {...axis} />
          <YAxis tickFormatter={compact} width={70} domain={[(lo: number) => lo * 0.998, (hi: number) => hi * 1.002]} {...axis} />
          <Tooltip content={<Tip />} cursor={{ stroke: 'rgba(255,255,255,.25)' }} />
          <Area className={m.cls} dataKey={asset} type="monotone" stroke={m.color} strokeWidth={2} fill={`url(#fill-${asset})`}
            dot={false} animationDuration={400} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
