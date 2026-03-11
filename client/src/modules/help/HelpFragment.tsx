import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useNebulaStore } from '@/store/nebulaStore';

// ── Types ──────────────────────────────────────────────────────────────────────

type CmdAction = 'show' | 'add' | 'delete' | 'import';

interface Cmd {
  cmd: string;
  desc: string;
  action: CmdAction;
  fragment?: string;
  fragmentParams?: Record<string, unknown>;
  prefill?: string;
}

interface Section {
  id: string;
  label: string;
  icon: string;
  glow: string;
  available: boolean;
  commands: Cmd[];
}

// ── Action colours (dot indicator) ────────────────────────────────────────────

const ACTION_COLOR: Record<CmdAction, string> = {
  show:   '#818cf8',
  add:    '#34d399',
  delete: '#f87171',
  import: '#60a5fa',
};

// ── Data ───────────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'finance',
    label: 'Finanze',
    icon: '💰',
    glow: '#f59e0b',
    available: true,
    commands: [
      { cmd: 'mostrami le spese',          desc: 'Lista ultime uscite',             action: 'show',   fragment: 'FinanceList',     fragmentParams: { limit: 8, type: 'expense' } },
      { cmd: 'riepilogo finanze',           desc: 'KPI del mese corrente',           action: 'show',   fragment: 'FinanceOverview', fragmentParams: {} },
      { cmd: 'grafico spese 14 giorni',     desc: 'Sparkline entrate/uscite',        action: 'show',   fragment: 'FinanceChart',    fragmentParams: { days: 14, metric: 'expenses' } },
      { cmd: 'analisi finanziaria',         desc: 'Grafici e trend avanzati',        action: 'show',   fragment: 'FinanceAnalytics',fragmentParams: {} },
      { cmd: 'spese per categoria',         desc: 'Raggruppa le transazioni',        action: 'show',   fragment: 'FinanceCategory', fragmentParams: {} },
      { cmd: 'aggiungi spesa 30€ superm.',  desc: 'Registra una nuova spesa',        action: 'add',    prefill: 'aggiungi spesa 30€ supermercato' },
      { cmd: 'ho guadagnato 1200€',         desc: 'Registra una nuova entrata',      action: 'add',    prefill: 'ho guadagnato 1200€' },
      { cmd: 'elimina ultime 10 transaz.',  desc: 'Elimina le N più recenti',        action: 'delete', fragment: 'FinanceDelete',   fragmentParams: { limit: 10 } },
      { cmd: 'elimina transazioni marzo',   desc: 'Elimina per mese/anno',           action: 'delete', prefill: 'elimina transazioni di marzo' },
      { cmd: 'elimina tutte le spese',      desc: 'Elimina tutto (con conferma)',    action: 'delete', prefill: 'elimina tutte le spese' },
      { cmd: 'importa CSV',                 desc: 'Carica transazioni da file',      action: 'import', fragment: 'FinanceCsv',      fragmentParams: {} },
      { cmd: 'spese per categoria',         desc: 'Raggruppa e ricategorizza',       action: 'show',   fragment: 'FinanceCategory', fragmentParams: {} },
    ],
  },
  {
    id: 'health',
    label: 'Salute',
    icon: '🏃',
    glow: '#10b981',
    available: true,
    commands: [
      { cmd: 'riepilogo salute',            desc: 'Panoramica salute',               action: 'show', fragment: 'HealthOverview', fragmentParams: {} },
      { cmd: 'com\'è il mio sonno?',        desc: 'Storico sonno con grafico',       action: 'show', fragment: 'HealthSleep',    fragmentParams: { limit: 7 } },
      { cmd: 'quanta acqua ho bevuto?',     desc: 'Progress idratazione oggi',       action: 'show', fragment: 'HealthWater',    fragmentParams: {} },
      { cmd: 'recap di oggi',               desc: 'Metriche vs obiettivi',           action: 'show', fragment: 'HealthDaily',    fragmentParams: {} },
      { cmd: 'obiettivi salute',            desc: 'Visualizza e modifica target',    action: 'show', fragment: 'HealthGoals',    fragmentParams: {} },
      { cmd: 'ho fatto 8000 passi',         desc: 'Log passi del giorno',            action: 'add',  prefill: 'ho fatto 8000 passi' },
      { cmd: 'configura profilo salute',    desc: 'Anagrafica e obiettivi iniziali', action: 'add',  fragment: 'HealthSetup',    fragmentParams: {} },
    ],
  },
  {
    id: 'psych',
    label: 'Mente',
    icon: '🧠',
    glow: '#8b5cf6',
    available: true,
    commands: [
      { cmd: 'come sto?',                   desc: 'Umore attuale + media recente',   action: 'show', fragment: 'PsychOverview', fragmentParams: {} },
      { cmd: 'storico umore 7 giorni',      desc: 'Grafico andamento umore',         action: 'show', fragment: 'MoodHistory',   fragmentParams: { days: 7 } },
      { cmd: 'sono stressato',              desc: 'Vista empatica + storico',        action: 'add',  prefill: 'sono stressato' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙️',
    glow: '#94a3b8',
    available: true,
    commands: [
      { cmd: 'apri impostazioni',           desc: 'Profilo, tema, sicurezza',        action: 'show', fragment: 'Settings', fragmentParams: {} },
      { cmd: 'logout',                      desc: 'Disconnetti l\'account',          action: 'add',  prefill: 'logout' },
    ],
  },
  {
    id: 'consciousness',
    label: 'Appunti',
    icon: '📓',
    glow: '#06b6d4',
    available: false,
    commands: [
      { cmd: 'apri appunti',                desc: 'Archivio note e riflessioni',     action: 'show', prefill: 'apri appunti' },
      { cmd: 'nuova nota',                  desc: 'Scrivi un\'idea o pensiero',      action: 'add',  prefill: 'nuova nota' },
      { cmd: 'cerca nei miei appunti',      desc: 'Ricerca full-text nelle note',    action: 'show', prefill: 'cerca nei miei appunti' },
    ],
  },
  {
    id: 'routine',
    label: 'Routine',
    icon: '📅',
    glow: '#f97316',
    available: false,
    commands: [
      { cmd: 'routine di oggi',             desc: 'Task e tracker del giorno',       action: 'show', prefill: 'routine di oggi' },
      { cmd: 'aggiungi abitudine',          desc: 'Crea un nuovo habit tracker',     action: 'add',  prefill: 'aggiungi abitudine' },
      { cmd: 'streak questa settimana',     desc: 'Visualizza le serie attive',      action: 'show', prefill: 'streak questa settimana' },
    ],
  },
  {
    id: 'news',
    label: 'News',
    icon: '📰',
    glow: '#3b82f6',
    available: false,
    commands: [
      { cmd: 'mostrami le news',            desc: 'Feed personalizzato',             action: 'show', prefill: 'mostrami le news' },
      { cmd: 'notizie tech',                desc: 'News filtrate per argomento',     action: 'show', prefill: 'notizie tech' },
      { cmd: 'salva articolo',              desc: 'Archivia un link',                action: 'add',  prefill: 'salva articolo' },
    ],
  },
  {
    id: 'career',
    label: 'Carriera',
    icon: '💼',
    glow: '#f43f5e',
    available: false,
    commands: [
      { cmd: 'apri carriera',               desc: 'Obiettivi professionali',         action: 'show', prefill: 'apri carriera' },
      { cmd: 'aggiungi obiettivo',          desc: 'Nuovo traguardo lavorativo',      action: 'add',  prefill: 'aggiungi obiettivo' },
      { cmd: 'skills acquisite',            desc: 'Mappa delle competenze',          action: 'show', prefill: 'skills acquisite' },
    ],
  },
  {
    id: 'badges',
    label: 'Badge',
    icon: '🏆',
    glow: '#eab308',
    available: false,
    commands: [
      { cmd: 'i miei badge',                desc: 'Collezione badge e XP',           action: 'show', prefill: 'i miei badge' },
      { cmd: 'quanto XP ho?',               desc: 'Livello e punti esperienza',      action: 'show', prefill: 'quanto XP ho' },
    ],
  },
  {
    id: 'bug',
    label: 'Segnala',
    icon: '🐛',
    glow: '#f87171',
    available: true,
    commands: [
      { cmd: 'segnala un bug',              desc: 'Apri il form di segnalazione',    action: 'add',    fragment: 'BugReport',       fragmentParams: {} },
      { cmd: 'proponi miglioria',           desc: 'Suggerisci un miglioramento',     action: 'add',    fragment: 'BugReport',       fragmentParams: { tab: 'improvement' } },
    ],
  },
  {
    id: 'admin',
    label: 'Sviluppatore',
    icon: '🔐',
    glow: '#c4b5fd',
    available: true,
    commands: [
      { cmd: 'accedi alla sezione admin',   desc: 'Pannello ticket (password)',      action: 'show',   fragment: 'Admin',           fragmentParams: {} },
    ],
  },
  {
    id: 'chatbot',
    label: 'Chatbot',
    icon: '🤖',
    glow: '#a855f7',
    available: false,
    commands: [
      { cmd: 'analizza la mia settimana',   desc: 'Riepilogo AI dei tuoi dati',      action: 'show', prefill: 'analizza la mia settimana' },
      { cmd: 'consigliami',                 desc: 'Suggerimenti personalizzati',     action: 'show', prefill: 'consigliami' },
    ],
  },
];

// ── Filter defs ────────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'all',    label: 'Tutti' },
  { id: 'show',   label: '▶ Grafici' },
  { id: 'add',    label: '＋ Aggiungi' },
  { id: 'delete', label: '✕ Elimina' },
  { id: 'import', label: '↑ Importa' },
] as const;

type FilterId = typeof FILTERS[number]['id'];

// ── Component ──────────────────────────────────────────────────────────────────

export function HelpFragment(_: { params?: Record<string, unknown> }) {
  const [filter, setFilter]           = useState<FilterId>('all');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const { openFromReturn, clearFragment, setPrefillInput } = useNebulaStore();

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCmd(cmd: Cmd, section: Section) {
    // Coming-soon: always prefill (no fragment exists yet)
    if (!section.available) {
      clearFragment();
      setPrefillInput(cmd.prefill ?? cmd.cmd);
      return;
    }
    if (cmd.fragment) {
      // Open target fragment — X will bring back to Help
      openFromReturn(cmd.fragment, cmd.fragmentParams ?? {}, 'Help');
    } else if (cmd.prefill) {
      // Close Help, prefill the chat bar — user reviews and sends
      clearFragment();
      setPrefillInput(cmd.prefill);
    }
  }

  const filteredSections = SECTIONS
    .map((s) => ({
      ...s,
      commands: filter === 'all' ? s.commands : s.commands.filter((c) => c.action === filter),
    }))
    .filter((s) => s.commands.length > 0);

  return (
    <NebulaCard title="Cosa sa fare Nebula" variant="default" closable>
      {/* Filter chips */}
      <div className="help-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={['help-filter', filter === f.id ? 'help-filter--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tap hint */}
      <div className="help-tap-hint">
        <span className="help-tap-icon">👆</span>
        <span>Tocca un comando per aprirlo</span>
      </div>

      {/* Accordion sections */}
      <div className="help-sections">
        {filteredSections.length === 0 ? (
          <p className="help-empty">Nessun comando per questa categoria.</p>
        ) : (
          filteredSections.map((section) => {
            const isOpen = openSections.has(section.id);
            return (
              <div key={section.id} className="help-section">
                {/* Toggle header */}
                <button
                  className={['help-section-toggle', isOpen ? 'help-section-toggle--open' : ''].filter(Boolean).join(' ')}
                  style={{ '--s-glow': section.glow } as React.CSSProperties}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className="help-section-icon">{section.icon}</span>
                  <span className="help-section-name">{section.label}</span>
                  {!section.available && <span className="help-section-soon">presto</span>}
                  <span className="help-section-count">{section.commands.length}</span>
                  <span className={['help-section-arrow', isOpen ? 'help-section-arrow--open' : ''].filter(Boolean).join(' ')}>›</span>
                </button>

                {/* Commands list (animated height) */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="cmds"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <ul className="help-cmd-list">
                        {section.commands.map((c) => (
                          <li
                            key={c.cmd}
                            className={['help-cmd-item', !section.available ? 'help-cmd-item--soon' : ''].filter(Boolean).join(' ')}
                            onClick={() => handleCmd(c, section)}
                          >
                            <span
                              className="help-cmd-dot"
                              style={{ background: ACTION_COLOR[c.action] }}
                            />
                            <span className="help-cmd-body">
                              <span className="help-cmd-text">"{c.cmd}"</span>
                              <span className="help-cmd-desc">{c.desc}</span>
                            </span>
                            <span className="help-cmd-go">→</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      <p className="help-footer">
        <span style={{ color: ACTION_COLOR.show }}>●</span> grafico &nbsp;
        <span style={{ color: ACTION_COLOR.add }}>●</span> aggiungi &nbsp;
        <span style={{ color: ACTION_COLOR.delete }}>●</span> elimina &nbsp;
        <span style={{ color: ACTION_COLOR.import }}>●</span> importa
      </p>
    </NebulaCard>
  );
}
