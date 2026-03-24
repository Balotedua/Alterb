import { useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { useAlterStore } from '../../../store/alterStore';
import { deleteEntry } from '../../../vault/vaultService';
import type { VaultEntry } from '../../../types';
import { TabBar } from './shared';

// ── Locale helpers ────────────────────────────────────────────
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYS_IT   = ['Lu','Ma','Me','Gi','Ve','Sa','Do'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString('it-IT', opts);
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function entryDate(e: VaultEntry): Date {
  return new Date((e.data.scheduled_at as string) ?? e.created_at);
}

// ── DeleteBtn ─────────────────────────────────────────────────
function DeleteBtn({ entry }: { entry: VaultEntry }) {
  return (
    <button
      onClick={async ev => {
        ev.stopPropagation();
        await deleteEntry(entry.id);
        const store = useAlterStore.getState();
        const w = store.activeWidget;
        if (w) store.setActiveWidget({ ...w, entries: w.entries.filter(x => x.id !== entry.id) });
      }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a3f52', padding: '0 2px', fontSize: 9, opacity: 0.6, flexShrink: 0, lineHeight: 1 }}
      onMouseEnter={ev => { const t = ev.target as HTMLElement; t.style.color = '#f87171'; t.style.opacity = '1'; }}
      onMouseLeave={ev => { const t = ev.target as HTMLElement; t.style.color = '#3a3f52'; t.style.opacity = '0.6'; }}
    >✕</button>
  );
}

// ── TimelineRow ───────────────────────────────────────────────
type DotStyle = 'glow' | 'ring' | 'dim';

function TimelineRow({ time, timeColor, dotStyle, accentColor, isLast, children }: {
  time: string; timeColor: string; dotStyle: DotStyle; accentColor: string; isLast: boolean; children: ReactNode;
}) {
  const base: CSSProperties = { width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 4 };
  const dot: CSSProperties =
    dotStyle === 'glow' ? { ...base, background: accentColor, boxShadow: `0 0 10px ${accentColor}70` } :
    dotStyle === 'ring' ? { ...base, background: 'transparent', border: `2px solid ${accentColor}` } :
                          { ...base, background: 'transparent', border: '1.5px solid rgba(255,255,255,0.1)' };
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: isLast ? 0 : 14 }}>
      <div style={{ minWidth: 38, textAlign: 'right', fontSize: 10, color: timeColor, fontWeight: 600, flexShrink: 0, paddingTop: 4, letterSpacing: '0.02em' }}>
        {time}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={dot} />
        {!isLast && <div style={{ width: 1, flex: 1, minHeight: 18, background: 'rgba(255,255,255,0.04)', marginTop: 3 }} />}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

// ── CalendarioTab ─────────────────────────────────────────────
function CalendarioTab({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sel,   setSel]   = useState<Date | null>(null);

  const events = entries.filter(e => e.data.type === 'event' || e.data.is_event);

  function eventsOn(day: number) {
    return events.filter(e => sameDay(entryDate(e), new Date(year, month, day)));
  }
  function prevM() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextM() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  const daysCount = new Date(year, month + 1, 0).getDate();
  const offsetDow = (() => { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const cells     = [...Array(offsetDow).fill(null), ...Array.from({ length: daysCount }, (_, i) => i + 1)];

  const selEvts = sel
    ? events.filter(e => sameDay(entryDate(e), sel)).sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime())
    : [];

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <button onClick={prevM}
          style={{ background: 'none', border: 'none', color: '#4b5268', cursor: 'pointer', fontSize: 22, padding: '0 10px', lineHeight: 1, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = color)}
          onMouseLeave={e => (e.currentTarget.style.color = '#4b5268')}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#d0d8e8', letterSpacing: '0.05em' }}>
          {MONTHS_IT[month]} {year}
        </span>
        <button onClick={nextM}
          style={{ background: 'none', border: 'none', color: '#4b5268', cursor: 'pointer', fontSize: 22, padding: '0 10px', lineHeight: 1, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = color)}
          onMouseLeave={e => (e.currentTarget.style.color = '#4b5268')}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 6 }}>
        {DAYS_IT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 8, color: '#3a3f52', fontWeight: 700, letterSpacing: '0.1em' }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const d       = new Date(year, month, day);
          const isToday = sameDay(d, today);
          const isSel   = !!sel && sameDay(d, sel);
          const hasEvts = eventsOn(day).length > 0;
          return (
            <button key={day} onClick={() => setSel(isSel ? null : d)} style={{
              aspectRatio: '1', borderRadius: 8, border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              background: isSel ? `${color}22` : isToday ? 'rgba(255,255,255,0.05)' : 'transparent',
              outline: isSel ? `1px solid ${color}60` : isToday ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              transition: 'all 0.12s',
            }}
              onMouseEnter={ev => { if (!isSel) ev.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={ev => { if (!isSel) ev.currentTarget.style.background = isToday ? 'rgba(255,255,255,0.05)' : 'transparent'; }}
            >
              <span style={{ fontSize: 10, color: isSel ? color : isToday ? '#e2e8f0' : '#6b7280', fontWeight: (isToday || isSel) ? 700 : 400, lineHeight: 1 }}>
                {day}
              </span>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: hasEvts ? color : 'transparent', opacity: 0.9 }} />
            </button>
          );
        })}
      </div>

      {/* Selected day */}
      {sel && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            {fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {selEvts.length === 0
            ? <p style={{ fontSize: 11, color: '#3a3f52', textAlign: 'center', padding: '6px 0' }}>Nessun evento</p>
            : selEvts.map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
                borderRadius: 8, background: 'rgba(255,255,255,0.025)', borderLeft: `2px solid ${color}50`, marginBottom: 5,
              }}>
                <span style={{ fontSize: 10, color, fontWeight: 700, minWidth: 36, flexShrink: 0 }}>{fmtTime(entryDate(e))}</span>
                <span style={{ fontSize: 12, color: '#b0bcd4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(e.data.title as string) ?? (e.data.raw as string) ?? '—'}
                </span>
                <DeleteBtn entry={e} />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── AgendaTab ─────────────────────────────────────────────────
function AgendaTab({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const events = entries
    .filter(e => e.data.type === 'event' || e.data.is_event)
    .sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime());
  const reminders = entries.filter(e => e.data.type === 'reminder');

  const groups = new Map<string, { label: string; items: VaultEntry[] }>();
  for (const e of events) {
    const dt  = entryDate(e);
    const key = dt.toDateString();
    if (!groups.has(key)) groups.set(key, { label: fmtDate(dt, { weekday: 'long', day: 'numeric', month: 'long' }), items: [] });
    groups.get(key)!.items.push(e);
  }

  if (groups.size === 0 && reminders.length === 0) {
    return <p style={{ fontSize: 12, color: '#3a3f52', textAlign: 'center', padding: '28px 0' }}>Nessun appuntamento in agenda.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[...groups.entries()].map(([key, { label, items }]) => (
        <div key={key}>
          <div style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
          {items.map(e => {
            const dt     = entryDate(e);
            const isPast = dt < new Date();
            return (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 10, marginBottom: 5,
                background: isPast ? 'rgba(255,255,255,0.008)' : 'rgba(255,255,255,0.028)',
                borderLeft: `2px solid ${color}${isPast ? '18' : '55'}`,
                opacity: isPast ? 0.45 : 1,
              }}>
                <span style={{ fontSize: 10, color: isPast ? '#4b5268' : color, fontWeight: 700, minWidth: 36, flexShrink: 0 }}>{fmtTime(dt)}</span>
                <span style={{ fontSize: 12, color: isPast ? '#4b5268' : '#b0bcd4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(e.data.title as string) ?? (e.data.raw as string) ?? '—'}
                </span>
                <DeleteBtn entry={e} />
              </div>
            );
          })}
        </div>
      ))}

      {reminders.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: '#3a3f52', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Ricorrenti</div>
          {reminders.map(e => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              borderRadius: 10, marginBottom: 5, background: 'rgba(255,255,255,0.018)', borderLeft: `2px solid ${color}28`,
            }}>
              <span style={{ fontSize: 10, color: color + '90', fontWeight: 700, minWidth: 36, flexShrink: 0 }}>{(e.data.time as string) || '—'}</span>
              <span style={{ fontSize: 12, color: '#8090a8', flex: 1 }}>{(e.data.title as string) ?? '—'}</span>
              <span style={{ fontSize: 9, color: '#3a3f52', flexShrink: 0 }}>{(e.data.recurrence as string) === 'weekly' ? '↻ sett.' : '↻ giorn.'}</span>
              <DeleteBtn entry={e} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RoutineTab ────────────────────────────────────────────────
function RoutineTab({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const today     = new Date();
  const routines  = entries.filter(e => e.data.type === 'routine');
  const reminders = entries.filter(e => e.data.type === 'reminder');
  const todayEvts = entries
    .filter(e => (e.data.type === 'event' || e.data.is_event) && sameDay(entryDate(e), today))
    .sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime());

  type Slot = { activity: string; start: string; end?: string };
  const slots: Slot[] = routines.flatMap(r => (r.data.slots as Slot[] | undefined) ?? []);

  type Item =
    | { kind: 'slot';     sort: string; slot: Slot }
    | { kind: 'reminder'; sort: string; entry: VaultEntry }
    | { kind: 'event';    sort: string; entry: VaultEntry };

  const items: Item[] = ([
    ...slots.map(s    => ({ kind: 'slot'     as const, sort: s.start,                                         slot: s })),
    ...reminders.map(e => ({ kind: 'reminder' as const, sort: (e.data.time as string) || '00:00',              entry: e })),
    ...todayEvts.map(e => ({ kind: 'event'    as const, sort: fmtTime(entryDate(e)),                           entry: e })),
  ] as Item[]).sort((a, b) => a.sort.localeCompare(b.sort));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
          Oggi — {fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        {items.length === 0
          ? (
            <p style={{ fontSize: 11, color: '#3a3f52', lineHeight: 1.7 }}>
              Aggiungi una routine o un promemoria per costruire la tua giornata.<br />
              <span style={{ color: '#252830', fontSize: 10 }}>es. "routine: lavoro 9-15 allenamento 18"</span>
            </p>
          )
          : items.map((item, i) => {
            const isLast = i === items.length - 1;
            if (item.kind === 'slot') {
              const s = item.slot;
              return (
                <TimelineRow key={`s${i}`} time={s.start} timeColor={color} dotStyle="glow" accentColor={color} isLast={isLast}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#c8d4e8', fontWeight: 500 }}>{s.activity}</div>
                    {s.end && <div style={{ fontSize: 10, color: '#3a3f52', marginTop: 2 }}>fino alle {s.end}</div>}
                  </div>
                </TimelineRow>
              );
            }
            if (item.kind === 'reminder') {
              const e = item.entry;
              return (
                <TimelineRow key={`r${e.id}`} time={(e.data.time as string) || '—'} timeColor="#4b5268" dotStyle="dim" accentColor={color} isLast={isLast}>
                  <span style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>{(e.data.title as string) ?? '—'}</span>
                  <span style={{ fontSize: 9, color: '#2a2e3a' }}>↻</span>
                  <DeleteBtn entry={e} />
                </TimelineRow>
              );
            }
            const e = item.entry;
            return (
              <TimelineRow key={`e${e.id}`} time={fmtTime(entryDate(e))} timeColor={color} dotStyle="ring" accentColor={color} isLast={isLast}>
                <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, flex: 1 }}>{(e.data.title as string) ?? '—'}</span>
                <DeleteBtn entry={e} />
              </TimelineRow>
            );
          })
        }
      </div>

      {routines.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: '#3a3f52', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Schema Routine
          </div>
          {routines.map(e => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              borderRadius: 8, marginBottom: 4, background: 'rgba(255,255,255,0.016)', borderLeft: `2px solid ${color}22`,
            }}>
              <span style={{ fontSize: 11, color: '#4b5268', flex: 1 }}>{(e.data.raw as string) ?? '—'}</span>
              <DeleteBtn entry={e} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
const TABS = ['Calendario', 'Agenda', 'Routine'] as const;
type TabType = typeof TABS[number];

export default function TimelineRenderer({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const [tab, setTab] = useState<TabType>('Calendario');
  return (
    <div>
      <TabBar tabs={[...TABS]} active={tab} color={color} onChange={t => setTab(t as TabType)} />
      <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
        {tab === 'Calendario' && <CalendarioTab entries={entries} color={color} />}
        {tab === 'Agenda'     && <AgendaTab     entries={entries} color={color} />}
        {tab === 'Routine'    && <RoutineTab    entries={entries} color={color} />}
      </div>
    </div>
  );
}
