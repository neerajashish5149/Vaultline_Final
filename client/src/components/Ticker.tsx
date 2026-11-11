import { arrow, compact, pct } from '../format';
import { META, Move } from '../types';

export function Ticker({ moves }: { moves: Move[] }) {
  if (!moves.length) return <div className="h-10" />;
  const row = (suffix: string) =>
    moves.map((m) => (
      <span key={m.key + suffix} className="mx-5 inline-flex items-center gap-2 text-sm">
        <span>{META[m.id].icon}</span>
        <span className="text-muted">{META[m.id].name}</span>
        <span>{compact(m.price)}</span>
        <span className={m.pct >= 0 ? 'text-up' : 'text-down'}>{arrow(m.pct)} {pct(m.pct)}</span>
      </span>
    ));
  return (
    <div className="glass overflow-hidden !rounded-xl py-2" aria-label="Recent price movements">
      <div className="marquee flex w-max whitespace-nowrap">
        <div>{row('a')}</div>
        <div aria-hidden>{row('b')}</div>
      </div>
    </div>
  );
}
