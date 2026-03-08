import { useState } from 'react';

interface Topic {
  id: string;
  label: string;
  icon: string;
}

interface NewsItem {
  id: number;
  title: string;
  source: string;
  topic: string;
  url: string;
  saved: boolean;
}

const TOPICS: Topic[] = [
  { id: 'tech', label: 'Tecnologia', icon: '💻' },
  { id: 'science', label: 'Scienza', icon: '🔬' },
  { id: 'finance', label: 'Finanza', icon: '📈' },
  { id: 'health', label: 'Salute', icon: '🏥' },
  { id: 'psychology', label: 'Psicologia', icon: '🧠' },
  { id: 'productivity', label: 'Produttività', icon: '⚡' },
  { id: 'design', label: 'Design', icon: '🎨' },
  { id: 'ai', label: 'AI & ML', icon: '🤖' },
];

const SAMPLE_NEWS: NewsItem[] = [
  { id: 1, title: 'Come la meditazione cambia la struttura del cervello', source: 'Nature', topic: 'psychology', url: '#', saved: false },
  { id: 2, title: 'Le 5 abitudini dei professionisti ad alta performance', source: 'Harvard Review', topic: 'productivity', url: '#', saved: false },
  { id: 3, title: 'Intelligenza artificiale e futuro del lavoro', source: 'MIT Tech', topic: 'ai', url: '#', saved: false },
  { id: 4, title: 'Gestione del portafoglio in periodi di volatilità', source: 'Bloomberg', topic: 'finance', url: '#', saved: false },
  { id: 5, title: 'Nuovi studi sul sonno e la memoria', source: 'Science Daily', topic: 'health', url: '#', saved: false },
  { id: 6, title: 'Design thinking applicato alla vita quotidiana', source: 'IDEO', topic: 'design', url: '#', saved: false },
];

export default function News() {
  const [interests, setInterests] = useState<string[]>(['tech', 'productivity', 'ai']);
  const [items, setItems] = useState<NewsItem[]>(SAMPLE_NEWS);
  const [filter, setFilter] = useState<'all' | 'saved'>('all');

  const toggleInterest = (id: string) =>
    setInterests((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleSave = (id: number) =>
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, saved: !n.saved } : n));

  const visible = items.filter((n) => {
    if (filter === 'saved') return n.saved;
    return interests.includes(n.topic) || interests.length === 0;
  });

  return (
    <div className="page page--news">
      <h1>News & Interessi</h1>

      <section className="news-interests">
        <h2 className="news-interests__title">I tuoi interessi</h2>
        <div className="news-interests__grid">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              className={`news-tag ${interests.includes(t.id) ? 'news-tag--active' : ''}`}
              onClick={() => toggleInterest(t.id)}
              type="button"
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </section>

      <div className="news-filters">
        <button
          className={`news-filter ${filter === 'all' ? 'news-filter--active' : ''}`}
          onClick={() => setFilter('all')}
          type="button"
        >
          Per te
        </button>
        <button
          className={`news-filter ${filter === 'saved' ? 'news-filter--active' : ''}`}
          onClick={() => setFilter('saved')}
          type="button"
        >
          Salvati
        </button>
      </div>

      <div className="news-list">
        {visible.length === 0 ? (
          <p className="news-empty">
            {filter === 'saved' ? 'Nessun articolo salvato.' : 'Seleziona almeno un interesse.'}
          </p>
        ) : (
          visible.map((n) => (
            <article key={n.id} className="news-card">
              <div className="news-card__body">
                <span className="news-card__source">{n.source}</span>
                <h3 className="news-card__title">{n.title}</h3>
                <span className="news-card__topic">
                  {TOPICS.find((t) => t.id === n.topic)?.icon}{' '}
                  {TOPICS.find((t) => t.id === n.topic)?.label}
                </span>
              </div>
              <button
                className={`news-card__save ${n.saved ? 'news-card__save--active' : ''}`}
                onClick={() => toggleSave(n.id)}
                type="button"
                aria-label={n.saved ? 'Rimuovi dai salvati' : 'Salva'}
              >
                {n.saved ? '★' : '☆'}
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
