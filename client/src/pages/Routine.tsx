import { useState } from 'react';

interface Task {
  id: number;
  label: string;
  done: boolean;
  time?: string;
  category: 'mattina' | 'pomeriggio' | 'sera';
}

const INIT_TASKS: Task[] = [
  { id: 1, label: 'Meditazione 10 min', done: false, time: '07:00', category: 'mattina' },
  { id: 2, label: 'Allenamento', done: false, time: '08:00', category: 'mattina' },
  { id: 3, label: 'Pianifica la giornata', done: false, time: '09:00', category: 'mattina' },
  { id: 4, label: 'Review obiettivi', done: false, time: '13:00', category: 'pomeriggio' },
  { id: 5, label: 'Lettura 30 min', done: false, time: '21:00', category: 'sera' },
  { id: 6, label: 'Diario / riflessione', done: false, time: '22:00', category: 'sera' },
];

const CAT_ORDER: Task['category'][] = ['mattina', 'pomeriggio', 'sera'];
const CAT_LABELS: Record<Task['category'], string> = {
  mattina: '🌅 Mattina',
  pomeriggio: '☀️ Pomeriggio',
  sera: '🌙 Sera',
};

export default function Routine() {
  const [tasks, setTasks] = useState<Task[]>(INIT_TASKS);
  const [newLabel, setNewLabel] = useState('');
  const [newCat, setNewCat] = useState<Task['category']>('mattina');
  const [newTime, setNewTime] = useState('');

  const toggle = (id: number) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const remove = (id: number) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const add = () => {
    if (!newLabel.trim()) return;
    setTasks((prev) => [
      ...prev,
      { id: Date.now(), label: newLabel.trim(), done: false, time: newTime || undefined, category: newCat },
    ]);
    setNewLabel('');
    setNewTime('');
  };

  const done = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="page page--routine">
      <h1>Routine & Tempo</h1>

      <div className="routine-progress">
        <div className="routine-progress__bar">
          <div className="routine-progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="routine-progress__label">{done}/{tasks.length} completati ({pct}%)</span>
      </div>

      <div className="routine-add">
        <input
          className="routine-add__input"
          type="text"
          placeholder="Nuova routine..."
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input
          className="routine-add__time"
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
        />
        <select
          className="routine-add__cat"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value as Task['category'])}
        >
          {CAT_ORDER.map((c) => (
            <option key={c} value={c}>{CAT_LABELS[c]}</option>
          ))}
        </select>
        <button className="routine-add__btn" onClick={add} type="button">+</button>
      </div>

      {CAT_ORDER.map((cat) => {
        const items = tasks.filter((t) => t.category === cat);
        if (!items.length) return null;
        return (
          <section key={cat} className="routine-section">
            <h2 className="routine-section__title">{CAT_LABELS[cat]}</h2>
            <ul className="routine-list">
              {items.map((t) => (
                <li key={t.id} className={`routine-item ${t.done ? 'routine-item--done' : ''}`}>
                  <button
                    className="routine-item__check"
                    onClick={() => toggle(t.id)}
                    type="button"
                    aria-label={t.done ? 'Segna come non fatto' : 'Segna come fatto'}
                  >
                    {t.done ? '✓' : '○'}
                  </button>
                  {t.time && <span className="routine-item__time">{t.time}</span>}
                  <span className="routine-item__label">{t.label}</span>
                  <button
                    className="routine-item__del"
                    onClick={() => remove(t.id)}
                    type="button"
                    aria-label="Rimuovi"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
