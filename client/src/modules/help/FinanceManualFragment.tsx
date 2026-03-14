import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useNebulaStore } from '@/store/nebulaStore';

// ── Sections data ──────────────────────────────────────────────────────────────

type Macro = 'tutti' | 'grafici' | 'aggiungi' | 'elimina' | 'gestione';

const MANUAL_SECTIONS = [
  {
    id: 'panoramica',
    icon: '📊',
    title: 'Panoramica',
    macro: 'grafici' as Macro,
    tags: ['KPI', 'Transazioni', 'Ricerca', 'Grafici'],
    body: 'Tab principale del pannello. In cima trovi 4 KPI del mese corrente: entrate totali, uscite totali, saldo netto e tasso di risparmio in percentuale. Sotto c\'è il grafico a barre degli ultimi 6 mesi (entrate in verde, uscite in rosso) con il mese corrente evidenziato. La lista transazioni è filtrabile per tipo (tutte / entrate / uscite) e supporta la ricerca testuale su descrizione, note, importo e categoria. Ogni transazione è espandibile per modificarne importo, descrizione, note, categoria e data direttamente inline. La lista è paginata a 12 elementi per pagina.',
  },
  {
    id: 'aggiungi',
    icon: '➕',
    title: 'Aggiungi Transazione',
    macro: 'aggiungi' as Macro,
    tags: ['Form', 'Spesa', 'Entrata'],
    body: 'Form per registrare una nuova spesa o entrata. Campi disponibili: data (default oggi), importo, tipo (spesa/entrata), categoria, descrizione e note opzionali. La categoria si seleziona da un menu a tendina che include sia quelle predefinite sia quelle create da te nel tab Categorie. Premi Invio per confermare rapidamente senza usare il mouse.',
  },
  {
    id: 'categorie',
    icon: '🗂️',
    title: 'Categorie',
    macro: 'gestione' as Macro,
    tags: ['Gestione', 'Personalizza', 'Ricategorizza'],
    body: 'Visualizza tutte le categorie raggruppate con il totale speso, il numero di transazioni e la percentuale sul totale. Clicca su una categoria per espandere le ultime 30 transazioni associate. Ogni categoria è modificabile: puoi cambiare nome e icona (picker con 70+ emoji divisi per gruppo). Puoi anche nascondere una categoria dai grafici con il toggle apposito. La funzione "Ricategorizza" permette di spostare tutte le transazioni con la stessa descrizione in un\'altra categoria in un colpo solo, oppure di ricategorizzare solo una singola transazione.',
  },
  {
    id: 'pianificazione',
    icon: '🎯',
    title: 'Pianificazione Budget',
    macro: 'gestione' as Macro,
    tags: ['Budget', 'Limiti', 'Avanzamento'],
    body: 'Imposta un tetto di spesa mensile per ogni categoria. La barra di avanzamento mostra visivamente quanto hai consumato rispetto al limite: diventa ambra all\'80% e rossa al superamento. In cima vedi il riepilogo globale con budget totale, speso totale, percentuale e residuo. Puoi aggiungere o rimuovere budget per singola categoria in qualsiasi momento.',
  },
  {
    id: 'analisi',
    icon: '📈',
    title: 'Analisi',
    macro: 'grafici' as Macro,
    tags: ['Insight', 'Trend', 'Giorno settimana'],
    body: 'Vista avanzata con analisi automatiche del tuo comportamento finanziario. Mostra: variazione percentuale delle uscite rispetto al mese precedente, tasso di risparmio con valutazione contestuale, top 5 categorie di spesa del mese con grafico a barre orizzontale, e spesa media per giorno della settimana (Lun–Dom) su base storica. In cima compare un insight testuale generato automaticamente che sintetizza i pattern principali.',
  },
  {
    id: 'patrimonio',
    icon: '🏦',
    title: 'Patrimonio',
    macro: 'grafici' as Macro,
    tags: ['Asset', 'Netto', 'Trend', 'Grafici'],
    body: 'Traccia il tuo patrimonio netto aggregando tutti i tuoi asset. Tipologie supportate: conto corrente, conto risparmio, investimenti, crypto, contanti, immobili, altro. Per ogni asset imposti nome e importo; il sistema calcola automaticamente il totale netto e la ripartizione percentuale in una barra segmentata colorata. Nella tabella vedi icona, tipo, importo e percentuale. Puoi modificare o eliminare ogni asset inline. In basso un grafico a linea mostra l\'andamento del saldo storico nel tempo, selezionabile per periodo (3M, 6M, 12M, 3A, 5A) con tooltip interattivo e indicatori di minimo/massimo. Il patrimonio include anche voci virtuali: saldo mensile corrente, saldo storico cumulativo e saldo netto dei prestiti.',
  },
  {
    id: 'prestiti',
    icon: '🤝',
    title: 'Prestiti',
    macro: 'gestione' as Macro,
    tags: ['Crediti', 'Debiti', 'Saldo netto'],
    body: 'Registra denaro che hai prestato ad altri (Dato) o ricevuto in prestito (Ricevuto). Per ogni prestito indichi: persona, importo, data, tipo e note. Le KPI in cima mostrano totale da riscuotere, totale da restituire e saldo netto (crediti meno debiti). Puoi filtrare la lista per "tutti / solo dati / solo ricevuti". Ogni voce ha un pulsante per segnarla come saldata e uno per eliminarla.',
  },
  {
    id: 'elimina',
    icon: '🗑️',
    title: 'Elimina Transazioni',
    macro: 'elimina' as Macro,
    tags: ['Bulk', 'Filtro', 'Sicurezza'],
    body: 'Strumento per cancellazioni in blocco con 6 modalità: per parola chiave (cerca su descrizione e note), per categoria (elimina tutte le transazioni di una categoria), per periodo (intervallo date da/a), per mese (seleziona mese e anno), per giorno (singola data), o elimina tutto (con doppia conferma). Prima di procedere viene mostrata un\'anteprima delle transazioni che verranno eliminate. L\'azione richiede sempre una conferma esplicita per prevenire cancellazioni accidentali.',
  },
  {
    id: 'importa',
    icon: '⬆️',
    title: 'Importa Estratto Conto',
    macro: 'aggiungi' as Macro,
    tags: ['CSV', 'XLSX', 'PDF', 'Auto-detect'],
    body: 'Importa transazioni in blocco dal tuo estratto conto bancario. Formati supportati: CSV, Excel (XLS/XLSX) e PDF multi-pagina. Il parser rileva automaticamente le colonne di data, importo, descrizione, tipo e categoria usando nomi di intestazione italiani e inglesi. Riconosce date in formato YYYY-MM-DD, DD/MM/YYYY e DD-MM-YYYY, e importi con segno negativo/positivo per determinare il tipo. Prima di importare viene mostrata un\'anteprima riga per riga con la possibilità di includere o escludere singole voci. Vengono segnalati eventuali duplicati già presenti nel sistema.',
  },
];

const MACROS: { id: Macro; label: string; icon: string }[] = [
  { id: 'tutti',    label: 'Tutti',    icon: '✦' },
  { id: 'grafici',  label: 'Grafici',  icon: '📈' },
  { id: 'aggiungi', label: 'Aggiungi', icon: '➕' },
  { id: 'elimina',  label: 'Elimina',  icon: '🗑️' },
  { id: 'gestione', label: 'Gestione', icon: '⚙️' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function FinanceManualFragment(_: { params?: Record<string, unknown> }) {
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
    <NebulaCard title="Guida · Finanze" variant="default" closable>
      {/* Pannello Completo — top CTA */}
      <button
        className="fm-cta-panel"
        onClick={() => openFromReturn('FinancePanorama', {}, 'FinanceManual')}
      >
        <span className="fm-cta-icon">⊞</span>
        <span className="fm-cta-text">Apri Pannello Completo</span>
        <span className="fm-cta-go">→</span>
      </button>

      {/* Search bar */}
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

      {/* Macro filters */}
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

      {/* Manual sections */}
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
