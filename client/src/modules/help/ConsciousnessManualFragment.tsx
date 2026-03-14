import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useNebulaStore } from '@/store/nebulaStore';

// ── Sections data ──────────────────────────────────────────────────────────────

type Macro = 'tutti' | 'cattura' | 'esplora' | 'analisi';

const MANUAL_SECTIONS = [
  {
    id: 'void',
    icon: '🕳️',
    title: 'The Void — Cattura Pensieri',
    macro: 'cattura' as Macro,
    tags: ['Input', 'Tag automatici', 'Archiviazione'],
    body: 'Il tab principale di acquisizione. Scrivi qualsiasi pensiero grezzo nel campo di testo e premi Cmd+Invio (o il pulsante) per archiviarlo. L\'IA analizza automaticamente il contenuto e assegna uno o più tag semantici (es. #lavoro, #idee, #emozioni). Una volta archiviato compare un feedback con le pillole dei tag assegnati. Non preoccuparti della forma: scrivi liberamente, ci pensa Nebula a classificare.',
  },
  {
    id: 'mind-tree',
    icon: '🌳',
    title: 'The Mind — Vista Albero',
    macro: 'esplora' as Macro,
    tags: ['Archivio', 'Tag', 'Filtro', 'Lista'],
    body: 'Seconda modalità del tab The Mind. La colonna sinistra mostra tutti i tag con il conteggio delle voci associate; cliccarne uno filtra la lista a destra. Ogni voce mostra il testo elaborato (o grezzo), la data e le pillole dei tag. Accanto a ogni entry c\'è un pulsante per eliminarla con richiesta di conferma. Scorri la lista per ritrovare pensieri passati filtrati per argomento.',
  },
  {
    id: 'mind-graph',
    icon: '🕸️',
    title: 'The Mind — Vista Grafo',
    macro: 'esplora' as Macro,
    tags: ['Grafo', 'SVG', 'Co-occorrenza', 'Visualizzazione'],
    body: 'Modalità grafo del tab The Mind. I nodi rappresentano i tag: la dimensione della bolla è proporzionale al numero di voci con quel tag. I collegamenti tra nodi indicano co-occorrenza (quante volte due tag compaiono nella stessa voce). Passa il cursore su un nodo per vederlo illuminarsi; cliccalo per filtrare le entry per quel tag. La vista grafo aiuta a scoprire pattern e connessioni tra i tuoi pensieri che in lista non sarebbero evidenti.',
  },
  {
    id: 'report',
    icon: '📋',
    title: 'Report Settimanale AI',
    macro: 'analisi' as Macro,
    tags: ['AI', 'Riepilogo', 'Markdown', 'Settimana'],
    body: 'Il tab Report genera un\'analisi in markdown degli ultimi 7 giorni di pensieri. Premi "Genera Report" e Nebula produrrà un documento strutturato con temi ricorrenti, pattern emotivi, idee da approfondire e possibili azioni. Puoi rigenerare il report in qualsiasi momento per aggiornarlo con i nuovi pensieri della settimana. Il report precedente viene sovrascritto. Usa "Elimina" per cancellarlo e ripartire da zero.',
  },
  {
    id: 'tag-system',
    icon: '🏷️',
    title: 'Sistema Tag',
    macro: 'analisi' as Macro,
    tags: ['Automatico', 'Semantico', 'Organizzazione'],
    body: 'I tag vengono assegnati automaticamente dall\'IA al momento dell\'archiviazione, senza che tu debba categorizzare manualmente. Il sistema costruisce nel tempo una mappa semantica dei tuoi pensieri. I tag più frequenti emergono come nodi grandi nel grafo. Non esiste un elenco fisso di tag: vengono generati dinamicamente in base al contenuto, quindi si adattano al tuo vocabolario e ai tuoi temi personali.',
  },
];

const MACROS: { id: Macro; label: string; icon: string }[] = [
  { id: 'tutti',   label: 'Tutti',   icon: '✦' },
  { id: 'cattura', label: 'Cattura', icon: '🕳️' },
  { id: 'esplora', label: 'Esplora', icon: '🌳' },
  { id: 'analisi', label: 'Analisi', icon: '📋' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function ConsciousnessManualFragment(_: { params?: Record<string, unknown> }) {
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
    <NebulaCard title="Guida · Coscienza" variant="default" closable>
      <button
        className="fm-cta-panel"
        onClick={() => openFromReturn('ConsciousnessInbox', {}, 'ConsciousnessManual')}
      >
        <span className="fm-cta-icon">⊞</span>
        <span className="fm-cta-text">Apri Coscienza</span>
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
