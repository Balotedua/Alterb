import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useNebulaStore } from '@/store/nebulaStore';

// ── Sections data ──────────────────────────────────────────────────────────────

type Macro = 'tutti' | 'log' | 'massimali' | 'progressi';

const MANUAL_SECTIONS = [
  {
    id: 'vessel',
    icon: '🫀',
    title: 'Vessel — Log Corpo',
    macro: 'log' as Macro,
    tags: ['Sessione', 'Muscoli', 'Esercizi', 'RPE'],
    body: 'Tab per registrare ogni sessione di allenamento. Seleziona i gruppi muscolari coinvolti tra i 7 disponibili (Testa, Petto, Spalle, Braccia, Core, Gambe, Dorso). Per ogni gruppo scegli uno degli esercizi preset o un esercizio personalizzato, poi inserisci il valore (ripetizioni, secondi o kg). Puoi aggiungere RPE (1–10) e durata in minuti alla sessione. Le sessioni passate sono visualizzate in lista con data, muscoli e note.',
  },
  {
    id: 'muscle-groups',
    icon: '💪',
    title: 'Gruppi Muscolari',
    macro: 'log' as Macro,
    tags: ['7 gruppi', 'Preset', 'Custom', 'Selezione'],
    body: 'Il sistema organizza il corpo in 7 gruppi muscolari: Testa (collo, trapezio), Petto (pettorali, flessioni), Spalle (deltoidi, alzate), Braccia (bicipiti, tricipiti), Core (addominali, plank), Gambe (quadricipiti, femorali, polpacci) e Dorso (dorsali, rematori). Ogni gruppo ha esercizi preset. Puoi aggiungere esercizi personalizzati tramite il pulsante "+" nella sezione esercizi custom; i tuoi esercizi vengono salvati e riappaiono nelle sessioni successive.',
  },
  {
    id: 'forge',
    icon: '🔥',
    title: 'Forge — Massimali',
    macro: 'massimali' as Macro,
    tags: ['1RM', 'PR', 'Big Three', 'Standard'],
    body: 'Tab per tracciare i tuoi massimali su singola ripetizione (1RM). I "Big Three" (Squat, Panca, Stacco) hanno una scheda dedicata con il tuo record attuale, il trend rispetto alla sessione precedente (↑/↓) e il confronto con gli standard di forza relativi al tuo peso corporeo. Puoi aggiungere un nuovo massimo in qualsiasi momento: il sistema aggiorna automaticamente il record se superi il precedente.',
  },
  {
    id: 'strength-standards',
    icon: '📊',
    title: 'Standard di Forza',
    macro: 'massimali' as Macro,
    tags: ['Tier', 'Principiante', 'Intermedio', 'Avanzato'],
    body: 'Ogni esercizio ha tre livelli di riferimento calcolati sul peso corporeo: Principiante (0.5×), Intermedio (0.9×) e Avanzato (1.2×). La barra di progresso mostra dove ti trovi rispetto agli standard. Il tier corrente viene evidenziato in base al tuo massimale attuale. Questi valori sono indicativi e aiutano a contestualizzare i progressi senza confrontarti con altri, solo con degli obiettivi oggettivi.',
  },
  {
    id: 'custom-exercises',
    icon: '⚙️',
    title: 'Esercizi Personalizzati',
    macro: 'progressi' as Macro,
    tags: ['Custom', 'Gestione', 'Unità', 'Persistenza'],
    body: 'Puoi creare esercizi personalizzati per qualsiasi gruppo muscolare. Specifica il nome dell\'esercizio, l\'unità di misura (reps, secondi o kg) e il gruppo muscolare di appartenenza. Gli esercizi custom vengono salvati nel tuo profilo e compaiono accanto ai preset ogni volta che selezioni quel gruppo muscolare. Puoi eliminare un esercizio custom dalla lista di gestione; i log passati rimangono intatti.',
  },
  {
    id: 'milestones',
    icon: '🏅',
    title: 'Milestone e Badge',
    macro: 'progressi' as Macro,
    tags: ['Badge', 'Obiettivi', 'Celebrazione', 'Kg'],
    body: 'Quando raggiungi un massimale tondo (50 kg, 60 kg, 70 kg ecc.) il sistema mostra automaticamente una notifica celebrativa. Questi traguardi sono collegati al sistema badge di Alter: completarli sblocca badge nella sezione Badges. Tieni d\'occhio i tuoi miglioramenti nel tab Forge: il trend mostrato a ogni aggiornamento ti dice in tempo reale se stai migliorando rispetto alla sessione precedente.',
  },
];

const MACROS: { id: Macro; label: string; icon: string }[] = [
  { id: 'tutti',     label: 'Tutti',     icon: '✦' },
  { id: 'log',       label: 'Log',       icon: '🫀' },
  { id: 'massimali', label: 'Massimali', icon: '🔥' },
  { id: 'progressi', label: 'Progressi', icon: '📈' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function WorkoutManualFragment(_: { params?: Record<string, unknown> }) {
  const { openFromReturn } = useNebulaStore();
  const [search, setSearch] = useState('');
  const [activeMacro, setActiveMacro] = useState<Macro>('tutti');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MANUAL_SECTIONS.filter((s) => {
      const matchesMacro = activeMacro === 'tutti' || s.macro === activeMacro;
      if (!matchesMacro) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [search, activeMacro]);

  return (
    <NebulaCard title="Guida · Workout" variant="default" closable>
      <button
        className="fm-cta-panel"
        onClick={() => openFromReturn('HealthWorkout', {}, 'WorkoutManual')}
      >
        <span className="fm-cta-icon">⊞</span>
        <span className="fm-cta-text">Apri Workout</span>
        <span className="fm-cta-go">→</span>
      </button>

      <div className="fm-search-wrap">
        <span className="fm-search-icon">⌕</span>
        <input
          className="fm-search"
          type="text"
          placeholder="Cerca nella guida…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="fm-search-clear" onClick={() => setSearch('')}>×</button>
        )}
      </div>

      <div className="fm-macros">
        {MACROS.map((m) => (
          <button
            key={m.id}
            className={['fm-macro-btn', activeMacro === m.id ? 'fm-macro-btn--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setActiveMacro(m.id)}
          >
            <span className="fm-macro-icon">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="fm-sections">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.p
              key="empty"
              className="fm-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Nessuna sezione trovata.
            </motion.p>
          ) : (
            filtered.map((s, i) => (
              <motion.div
                key={s.id}
                className="fm-section"
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              >
                <div className="fm-section-header">
                  <span className="fm-section-icon">{s.icon}</span>
                  <span className="fm-section-title">{s.title}</span>
                  <div className="fm-section-tags">
                    {s.tags.map((t) => (
                      <span key={t} className="fm-tag">{t}</span>
                    ))}
                  </div>
                </div>
                <p className="fm-section-body">{s.body}</p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </NebulaCard>
  );
}
