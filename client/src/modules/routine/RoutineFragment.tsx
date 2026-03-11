import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, MapPin, Clock, RefreshCw, CheckCircle2, Circle, Calendar, Repeat } from 'lucide-react';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { toast } from 'sonner';
import {
  useRoutines, useTodayCompletions, useAddRoutine, useDeleteRoutine, useToggleCompletion,
  useAppointments, useAddAppointment, useDeleteAppointment, useToggleAppointmentDone,
  routineAppliesOn, today,
  type Routine, type RoutineFrequency, type RoutineColor, type Appointment,
} from '@/hooks/useRoutine';

// ── Constants ─────────────────────────────────────────────────────────────────

const ease = [0.16, 1, 0.3, 1] as [number,number,number,number];

const COLOR_MAP: Record<RoutineColor, { border: string; bg: string; dot: string }> = {
  violet: { border: 'rgba(167,139,250,0.5)', bg: 'rgba(167,139,250,0.08)', dot: '#a78bfa' },
  teal:   { border: 'rgba(52,211,153,0.5)',  bg: 'rgba(52,211,153,0.08)',  dot: '#34d399' },
  amber:  { border: 'rgba(251,191,36,0.5)',  bg: 'rgba(251,191,36,0.08)',  dot: '#fbbf24' },
  red:    { border: 'rgba(248,113,113,0.5)', bg: 'rgba(248,113,113,0.08)', dot: '#f87171' },
  blue:   { border: 'rgba(96,165,250,0.5)',  bg: 'rgba(96,165,250,0.08)',  dot: '#60a5fa' },
};

const DAY_LABELS = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
const DAY_FULL   = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

const FREQ_LABELS: Record<RoutineFrequency, string> = {
  daily:   'Ogni giorno',
  weekly:  'Giorni specifici',
  monthly: 'Mensile',
};

const COLORS: RoutineColor[] = ['violet', 'teal', 'amber', 'red', 'blue'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(':');
  return `${h}:${m}`;
}

function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isToday(d: string): boolean  { return d === today(); }
function isPast(d: string):  boolean  { return d < today(); }
function isFuture(d: string): boolean { return d > today(); }

function routineSubLabel(r: Routine): string {
  if (r.frequency === 'daily') return 'Ogni giorno';
  if (r.frequency === 'weekly') {
    const days = (r.days_of_week ?? []).map(d => DAY_FULL[d]).join(', ');
    return days || 'Nessun giorno';
  }
  if (r.frequency === 'monthly') return `Ogni ${r.day_of_month}° del mese`;
  return '';
}

// ── Routine form ──────────────────────────────────────────────────────────────

function RoutineForm({ onClose }: { onClose: () => void }) {
  const { mutate: add, isPending } = useAddRoutine();

  const [title,       setTitle      ] = useState('');
  const [time,        setTime       ] = useState('');
  const [frequency,   setFrequency  ] = useState<RoutineFrequency>('daily');
  const [daysOfWeek,  setDaysOfWeek ] = useState<number[]>([]);
  const [dayOfMonth,  setDayOfMonth ] = useState<number>(1);
  const [color,       setColor      ] = useState<RoutineColor>('violet');
  const [description, setDescription] = useState('');

  function toggleDay(d: number) {
    setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function submit() {
    if (!title.trim()) { toast.error('Inserisci un titolo.'); return; }
    if (frequency === 'weekly' && daysOfWeek.length === 0) {
      toast.error('Seleziona almeno un giorno.'); return;
    }
    add({
      title:        title.trim(),
      description:  description.trim() || null,
      time_of_day:  time || null,
      frequency,
      days_of_week: frequency === 'weekly' ? daysOfWeek : [],
      day_of_month: frequency === 'monthly' ? dayOfMonth : null,
      color,
      is_active: true,
    }, {
      onSuccess: () => { toast.success('Routine aggiunta.'); onClose(); },
      onError:   () => toast.error('Errore durante il salvataggio.'),
    });
  }

  return (
    <motion.div
      className="rt-form"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease }}
      style={{ overflow: 'hidden' }}
    >
      <div className="rt-form-inner">
        <input
          className="rt-input"
          placeholder="Prendi la pastiglia, Medita, Esercizio…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
          maxLength={60}
        />
        <input
          className="rt-input"
          placeholder="Descrizione (opzionale)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={120}
        />
        <div className="rt-form-row">
          <label className="rt-label">Orario</label>
          <input
            type="time"
            className="rt-input rt-input--sm"
            value={time}
            onChange={e => setTime(e.target.value)}
          />
        </div>
        <div className="rt-form-row">
          <label className="rt-label">Frequenza</label>
          <select className="rt-select" value={frequency} onChange={e => setFrequency(e.target.value as RoutineFrequency)}>
            {(Object.entries(FREQ_LABELS) as [RoutineFrequency, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {frequency === 'weekly' && (
          <div className="rt-days">
            {DAY_LABELS.map((lbl, i) => (
              <button
                key={i}
                type="button"
                className={['rt-day-btn', daysOfWeek.includes(i) ? 'rt-day-btn--on' : ''].filter(Boolean).join(' ')}
                onClick={() => toggleDay(i)}
              >
                {lbl}
              </button>
            ))}
          </div>
        )}

        {frequency === 'monthly' && (
          <div className="rt-form-row">
            <label className="rt-label">Giorno del mese</label>
            <input
              type="number"
              className="rt-input rt-input--sm"
              min={1} max={31}
              value={dayOfMonth}
              onChange={e => setDayOfMonth(parseInt(e.target.value) || 1)}
            />
          </div>
        )}

        <div className="rt-form-row">
          <label className="rt-label">Colore</label>
          <div className="rt-colors">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={['rt-color-btn', color === c ? 'rt-color-btn--on' : ''].filter(Boolean).join(' ')}
                style={{ background: COLOR_MAP[c].dot }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="rt-form-actions">
          <button className="rt-btn-cancel" onClick={onClose} type="button">Annulla</button>
          <button className="rt-btn-save" onClick={submit} disabled={isPending} type="button">
            {isPending ? <RefreshCw size={12} className="rt-spin" /> : <Plus size={12} />}
            Aggiungi
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Appointment form ───────────────────────────────────────────────────────────

function AppointmentForm({ onClose }: { onClose: () => void }) {
  const { mutate: add, isPending } = useAddAppointment();

  const [title,       setTitle      ] = useState('');
  const [date,        setDate       ] = useState('');
  const [time,        setTime       ] = useState('');
  const [location,    setLocation   ] = useState('');
  const [description, setDescription] = useState('');
  const [color,       setColor      ] = useState<RoutineColor>('violet');

  function submit() {
    if (!title.trim()) { toast.error('Inserisci un titolo.'); return; }
    if (!date)         { toast.error('Seleziona una data.'); return; }
    add({
      title:            title.trim(),
      description:      description.trim() || null,
      location:         location.trim() || null,
      appointment_date: date,
      appointment_time: time || null,
      is_done: false,
      color,
    }, {
      onSuccess: () => { toast.success('Appuntamento aggiunto.'); onClose(); },
      onError:   () => toast.error('Errore durante il salvataggio.'),
    });
  }

  return (
    <motion.div
      className="rt-form"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease }}
      style={{ overflow: 'hidden' }}
    >
      <div className="rt-form-inner">
        <input
          className="rt-input"
          placeholder="Colloquio a Genova, Visita medica, Riunione…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
          maxLength={80}
        />
        <div className="rt-form-row">
          <label className="rt-label">Data</label>
          <input
            type="date"
            className="rt-input rt-input--sm"
            value={date}
            min={today()}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <div className="rt-form-row">
          <label className="rt-label">Ora</label>
          <input
            type="time"
            className="rt-input rt-input--sm"
            value={time}
            onChange={e => setTime(e.target.value)}
          />
        </div>
        <input
          className="rt-input"
          placeholder="Luogo (opzionale)"
          value={location}
          onChange={e => setLocation(e.target.value)}
          maxLength={80}
        />
        <input
          className="rt-input"
          placeholder="Note (opzionale)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={200}
        />
        <div className="rt-form-row">
          <label className="rt-label">Colore</label>
          <div className="rt-colors">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={['rt-color-btn', color === c ? 'rt-color-btn--on' : ''].filter(Boolean).join(' ')}
                style={{ background: COLOR_MAP[c].dot }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="rt-form-actions">
          <button className="rt-btn-cancel" onClick={onClose} type="button">Annulla</button>
          <button className="rt-btn-save" onClick={submit} disabled={isPending} type="button">
            {isPending ? <RefreshCw size={12} className="rt-spin" /> : <Plus size={12} />}
            Aggiungi
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Routine item ──────────────────────────────────────────────────────────────

function RoutineItem({ routine, done, onToggle, onDelete }: {
  routine:  Routine;
  done:     boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const c = COLOR_MAP[routine.color] ?? COLOR_MAP.violet;
  return (
    <motion.div
      className={['rt-item', done ? 'rt-item--done' : ''].filter(Boolean).join(' ')}
      style={{ borderLeftColor: c.dot }}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2, ease }}
    >
      <button className="rt-check-btn" onClick={onToggle} type="button" aria-label="Completa">
        {done
          ? <CheckCircle2 size={16} style={{ color: c.dot }} />
          : <Circle size={16} style={{ color: 'rgba(255,255,255,0.18)' }} />}
      </button>
      <div className="rt-item-body">
        <div className="rt-item-title">{routine.title}</div>
        <div className="rt-item-sub"><Repeat size={9} />{routineSubLabel(routine)}</div>
      </div>
      {routine.time_of_day && (
        <span className="rt-time-badge"><Clock size={9} />{fmtTime(routine.time_of_day)}</span>
      )}
      <button className="rt-del-btn" onClick={onDelete} type="button" aria-label="Elimina">
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}

// ── Appointment item ───────────────────────────────────────────────────────────

function AppointmentItem({ appt, onToggle, onDelete }: {
  appt:     Appointment;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const c      = COLOR_MAP[appt.color] ?? COLOR_MAP.violet;
  const todayMark  = isToday(appt.appointment_date);
  const pastMark   = isPast(appt.appointment_date);

  return (
    <motion.div
      className={[
        'rt-item',
        appt.is_done ? 'rt-item--done' : '',
        pastMark && !appt.is_done ? 'rt-item--past' : '',
      ].filter(Boolean).join(' ')}
      style={{ borderLeftColor: c.dot }}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2, ease }}
    >
      <button className="rt-check-btn" onClick={onToggle} type="button" aria-label="Fatto">
        {appt.is_done
          ? <CheckCircle2 size={16} style={{ color: c.dot }} />
          : <Circle size={16} style={{ color: 'rgba(255,255,255,0.18)' }} />}
      </button>
      <div className="rt-item-body">
        <div className="rt-item-title">{appt.title}</div>
        {appt.location && (
          <div className="rt-item-sub"><MapPin size={9} />{appt.location}</div>
        )}
        {appt.description && !appt.location && (
          <div className="rt-item-note">{appt.description}</div>
        )}
      </div>
      <div className="rt-appt-right">
        <span className={['rt-date-badge', todayMark ? 'rt-date-badge--today' : ''].filter(Boolean).join(' ')}>
          <Calendar size={8} />{fmtDate(appt.appointment_date)}
        </span>
        {appt.appointment_time && (
          <span className="rt-time-badge"><Clock size={8} />{fmtTime(appt.appointment_time)}</span>
        )}
      </div>
      <button className="rt-del-btn" onClick={onDelete} type="button" aria-label="Elimina">
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}

// ── Tab: Routine ───────────────────────────────────────────────────────────────

function TabRoutine() {
  const [showForm, setShowForm] = useState(false);
  const { data: routines = [],    isLoading: lr } = useRoutines();
  const { data: completions = [],              } = useTodayCompletions();
  const { mutate: toggle  } = useToggleCompletion();
  const { mutate: remove  } = useDeleteRoutine();

  const todayStr  = today();
  const todayRoutines = routines.filter(r => routineAppliesOn(r, todayStr));
  const doneIds       = new Set(completions.map(c => c.routine_id));
  const pending   = todayRoutines.filter(r => !doneIds.has(r.id));
  const completed = todayRoutines.filter(r =>  doneIds.has(r.id));

  const otherRoutines = routines.filter(r => !routineAppliesOn(r, todayStr));

  const dateLabel = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  if (lr) return <div className="rt-loading"><RefreshCw size={14} className="rt-spin" /></div>;

  return (
    <div>
      <div className="rt-date-header">
        <span className="rt-date-today">{dateLabel}</span>
        <span className="rt-date-count">
          {completed.length}/{todayRoutines.length} completate
        </span>
      </div>

      {/* Progress bar */}
      {todayRoutines.length > 0 && (
        <div className="rt-progress-track">
          <motion.div
            className="rt-progress-fill"
            animate={{ width: `${todayRoutines.length > 0 ? (completed.length / todayRoutines.length) * 100 : 0}%` }}
            transition={{ duration: 0.45, ease }}
          />
        </div>
      )}

      <AnimatePresence>
        {showForm && <RoutineForm onClose={() => setShowForm(false)} />}
      </AnimatePresence>

      {/* Pending today */}
      {pending.length > 0 && (
        <>
          <p className="rt-section-label">Da fare oggi</p>
          <AnimatePresence>
            {pending.map(r => (
              <RoutineItem
                key={r.id}
                routine={r}
                done={false}
                onToggle={() => toggle({ routineId: r.id, completed: true })}
                onDelete={() => { if (window.confirm(`Eliminare "${r.title}"?`)) remove(r.id); }}
              />
            ))}
          </AnimatePresence>
        </>
      )}

      {/* Completed today */}
      {completed.length > 0 && (
        <>
          <p className="rt-section-label" style={{ marginTop: '0.75rem' }}>Completate oggi</p>
          <AnimatePresence>
            {completed.map(r => (
              <RoutineItem
                key={r.id}
                routine={r}
                done={true}
                onToggle={() => toggle({ routineId: r.id, completed: false })}
                onDelete={() => { if (window.confirm(`Eliminare "${r.title}"?`)) remove(r.id); }}
              />
            ))}
          </AnimatePresence>
        </>
      )}

      {/* Not scheduled today */}
      {otherRoutines.length > 0 && (
        <>
          <p className="rt-section-label" style={{ marginTop: '0.75rem', opacity: 0.45 }}>Non previste oggi</p>
          <AnimatePresence>
            {otherRoutines.map(r => (
              <RoutineItem
                key={r.id}
                routine={r}
                done={false}
                onToggle={() => {}}
                onDelete={() => { if (window.confirm(`Eliminare "${r.title}"?`)) remove(r.id); }}
              />
            ))}
          </AnimatePresence>
        </>
      )}

      {todayRoutines.length === 0 && !showForm && (
        <p className="rt-empty">Nessuna routine per oggi. Aggiungine una!</p>
      )}

      {!showForm && (
        <button className="rt-add-btn" onClick={() => setShowForm(true)} type="button">
          <Plus size={12} /> Nuova routine
        </button>
      )}
    </div>
  );
}

// ── Tab: Appuntamenti ─────────────────────────────────────────────────────────

function TabAppointments() {
  const [showForm, setShowForm] = useState(false);
  const { data: appts = [], isLoading } = useAppointments();
  const { mutate: toggleDone } = useToggleAppointmentDone();
  const { mutate: remove     } = useDeleteAppointment();

  const upcoming = appts.filter(a => !isPast(a.appointment_date) || isToday(a.appointment_date));
  const past     = appts.filter(a =>  isPast(a.appointment_date) && !isToday(a.appointment_date));
  const [showPast, setShowPast] = useState(false);

  if (isLoading) return <div className="rt-loading"><RefreshCw size={14} className="rt-spin" /></div>;

  return (
    <div>
      <AnimatePresence>
        {showForm && <AppointmentForm onClose={() => setShowForm(false)} />}
      </AnimatePresence>

      {upcoming.length === 0 && !showForm && (
        <p className="rt-empty">Nessun appuntamento in programma.</p>
      )}

      <AnimatePresence>
        {upcoming.map(a => (
          <AppointmentItem
            key={a.id}
            appt={a}
            onToggle={() => toggleDone({ id: a.id, is_done: !a.is_done })}
            onDelete={() => { if (window.confirm(`Eliminare "${a.title}"?`)) remove(a.id); }}
          />
        ))}
      </AnimatePresence>

      {past.length > 0 && (
        <>
          <button
            className="rt-section-label rt-section-label--btn"
            onClick={() => setShowPast(v => !v)}
            style={{ marginTop: '0.75rem', cursor: 'pointer' }}
          >
            {showPast ? '▾' : '▸'} Passati ({past.length})
          </button>
          <AnimatePresence>
            {showPast && past.map(a => (
              <AppointmentItem
                key={a.id}
                appt={a}
                onToggle={() => toggleDone({ id: a.id, is_done: !a.is_done })}
                onDelete={() => { if (window.confirm(`Eliminare "${a.title}"?`)) remove(a.id); }}
              />
            ))}
          </AnimatePresence>
        </>
      )}

      {!showForm && (
        <button className="rt-add-btn" onClick={() => setShowForm(true)} type="button">
          <Plus size={12} /> Nuovo appuntamento
        </button>
      )}
    </div>
  );
}

// ── Root fragment ─────────────────────────────────────────────────────────────

export function RoutineFragment({ params }: { params: Record<string, unknown> }) {
  const defaultTab = (params.tab as string) === 'appointments' ? 1 : 0;
  const [tab, setTab] = useState(defaultTab);

  return (
    <NebulaCard icon={<Calendar size={15} />} title="Routine & Agenda" variant="default" closable>
      <div className="rt-tabs">
        <button
          className={['rt-tab-btn', tab === 0 ? 'rt-tab-btn--active' : ''].filter(Boolean).join(' ')}
          onClick={() => setTab(0)}
        >
          <Repeat size={11} /> Routine
        </button>
        <button
          className={['rt-tab-btn', tab === 1 ? 'rt-tab-btn--active' : ''].filter(Boolean).join(' ')}
          onClick={() => setTab(1)}
        >
          <Calendar size={11} /> Appuntamenti
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 0 ? <TabRoutine /> : <TabAppointments />}
        </motion.div>
      </AnimatePresence>
    </NebulaCard>
  );
}
