import { ago } from '../format';
import { MarketEvent } from '../types';

export function EventsFeed({ events, now }: { events: MarketEvent[]; now: number }) {
  return (
    <section className="glass p-5">
      <h2 className="font-display mb-3 text-lg font-bold">Recent market events</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet. Random events appear here when they happen.</p>
      ) : (
        <ul className="space-y-3">
          {events.slice(0, 8).map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="text-xl leading-6">{e.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2"><span className="font-semibold">{e.title}</span><span className="shrink-0 text-xs text-muted">{ago(now - e.ts)}</span></div>
                <p className="text-muted">{e.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
