import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import { getByCategory } from '../../vault/vaultService';
import { getCategoryMeta } from '../starfield/StarfieldView';

interface GuideSection {
  id: string;
  icon: string;
  title: string;
  color: string;
  badge?: string;
  description: string;
  details: string[];
  action?: { label: string; category: string; renderType: string; widgetLabel: string };
}

const SECTIONS: GuideSection[] = [
  {
    id: 'nebula',
    icon: '✦',
    title: 'Chat Nebula',
    color: '#4BC4B8',
    description: 'Il cuore di Alter. Scrivi in linguaggio naturale per registrare qualsiasi dato della tua vita.',
    details: [
      'Scrivi frasi come "speso 45€ supermercato", "82 kg", "dormito 7h", "umore 8/10" — Alter le salva automaticamente.',
      'Il parser locale (L1) gestisce frasi comuni in italiano senza consumare API.',
      'L\'AI (L2) interviene solo per categorie nuove o frasi ambigue.',
      'Usa "?" per entrare in focus mode: le stelle mostrano le label di ogni categoria.',
      'Scrivi "mostrami le spese" o "analizza l\'umore" per visualizzare i dati esistenti.',
      'Comandi speciali: "aiuto", "cancella [categoria]", "cancella tutto".',
      'Per note personali: "penso che…", "ho capito oggi…", "#tag riflessione".',
      'Per eventi: "appuntamento domani alle 14:30 con Marco".',
      'Per ricerche web: "ultime notizie su X", "risultati partita".',
    ],
  },
  {
    id: 'starfield',
    icon: '✦',
    title: 'Starfield — La Galassia',
    color: '#C8A84B',
    description: 'Ogni categoria di dati è una stella nel canvas. La luminosità riflette la frequenza d\'uso.',
    details: [
      'Stelle luminose = categorie attive con dati recenti.',
      'Stelle grigie = categorie dormienti o mai usate.',
      'Clicca su una stella per aprire il widget dati di quella categoria.',
      'La supernova (flash) appare ogni volta che salvi un nuovo dato.',
      'Le stelle appassiscono gradualmente se non le usi per ~18 giorni.',
      'Ogni categoria ha sub-stelle visibili al zoom (es. Finance → cashflow, budget, prestiti…).',
      'Pan con drag, zoom con scroll del mouse.',
      '3 livelli di particelle di sfondo per effetto parallax.',
    ],
  },
  {
    id: 'finance',
    icon: '💳',
    title: 'Finance — Finanza Personale',
    color: '#4BC4B8',
    description: 'Dashboard finanza con 8 tab: transazioni, cashflow, budget, ricorrenti, prestiti, patrimonio, analisi, importa.',
    details: [
      'Tab Transazioni: lista cronologica con filtri (tutte/uscite/entrate), ricerca testuale, cancellazione.',
      'Tab Cashflow: grafico entrate/uscite/netto per gli ultimi 6 mesi.',
      'Tab Budget: target mensili per categoria con ring progress e alert superamento.',
      'Tab Ricorrenti: spese che compaiono ≥2 mesi consecutivi (es. abbonamenti).',
      'Tab Prestiti: traccia denaro dato e ricevuto, con stato "saldato / da saldare".',
      'Tab Patrimonio: net worth nel tempo.',
      'Tab Analisi: grafici AI (Gemini) o fallback locale — distribuzione, burn rate, top category.',
      'Tab Aggiungi: inserimento manuale + import CSV/XLSX/PDF con OCR.',
      'KPI cards: saldo netto, savings rate, burn rate €/giorno, giorno più costoso.',
      'Inserimento chat: "speso 12€ caffè", "pagato affitto 850€", "stipendio 1800€".',
    ],
    action: { label: 'Apri Finance', category: 'finance', renderType: 'finance', widgetLabel: 'Finance' },
  },
  {
    id: 'workout',
    icon: '🏋️',
    title: 'Workout — Performance',
    color: '#f59e0b',
    description: 'Log allenamenti con silhouette corpo interattiva, personal record, calendario e volume.',
    details: [
      'Silhouette SVG interattiva: 7 gruppi muscolari (petto, spalle, bicipiti, tricipiti, schiena, core, gambe).',
      'I muscoli allenati oggi si colorano in base all\'intensità.',
      'Toggle vista frontale / posteriore per gruppi muscolari del dorso.',
      'Calendario 35 giorni: evidenzia giorni di allenamento.',
      'Sezione PR: storico personal record per esercizio con milestone celebrate.',
      'Strength standards: novizio / intermedio / avanzato per ogni esercizio principale.',
      'Inserimento chat: "squat 100kg 5x5", "corsa 8km 45 minuti", "palestra 1h30".',
      'Oltre 20 esercizi mappati automaticamente al gruppo muscolare corretto.',
    ],
    action: { label: 'Apri Workout', category: 'workout', renderType: 'workout', widgetLabel: 'Workout' },
  },
  {
    id: 'health',
    icon: '❤️',
    title: 'Salute — Parametri Vitali',
    color: '#ef4444',
    description: 'Monitora peso, sonno, acqua, pressione, glicemia e ogni parametro numerico salute.',
    details: [
      'Inserimento: "peso 78kg", "dormito 7h30", "acqua 2 litri", "pressione 120/80", "glicemia 95".',
      'Grafici a linea per ogni parametro nel tempo (ultimi 20 valori).',
      'Riconosce automaticamente unità di misura: kg, mmHg, mg/dL, kcal, h, litri.',
      'Visualizzazione multi-metrica: sovrappone 2+ parametri sullo stesso grafico.',
    ],
    action: { label: 'Apri Salute', category: 'health', renderType: 'chart', widgetLabel: 'Salute' },
  },
  {
    id: 'mood',
    icon: '🌊',
    title: 'Umore — Diario Emotivo',
    color: '#8b5cf6',
    description: 'Traccia il tuo stato emotivo quotidiano con punteggio e note libere.',
    details: [
      'Inserimento: "umore 8/10", "mi sento ansioso", "giornata ottima, produttivo".',
      'Il punteggio (1–10) viene estratto automaticamente se presente, altrimenti si salva la nota.',
      'Grafico trend umore nel tempo: individua pattern settimanali e trigger emotivi.',
      'Diario: lista voci con note testuali, filtrabili per data.',
      'Il motore di correlazione collega automaticamente umore a sonno, spese, workout.',
    ],
    action: { label: 'Apri Umore', category: 'mood', renderType: 'mood', widgetLabel: 'Umore' },
  },
  {
    id: 'cognitive',
    icon: '🧠',
    title: 'Test Cognitivi',
    color: '#c084fc',
    badge: '14 test',
    description: '14 test scientifici su 6 domini: reattività, memoria, ragionamento, percezione, salute mentale e attenzione.',
    details: [
      '⚡ Reattività: Tempo di Reazione (5 trial ~1 min), Go/No-Go (inibizione impulsi ~1 min), Tapping Test (velocità psicomotoria 10 sec), Psychomotor Speed (alternanza dita 15 sec).',
      '🧠 Memoria: Working Memory (span cifre 4–8 ~2 min), Sternberg Search (STM scan 12 trial ~2 min), Corsi Block Test (memoria visuo-spaziale ~2 min), N-Back Spaziale (aggiornamento continuo ~2 min).',
      '🔢 Ragionamento: Pattern Recognition (sequenze numeriche e logica induttiva, 10 domande ~3 min).',
      '⏱ Percezione: Time Production (tieni premuto esattamente 20 secondi ~30 sec).',
      '🧘 Salute Mentale: Dot-Probe Task (bias attentivo verso stimoli emotivi, 16 trial ~2 min).',
      '🎯 Attenzione Selettiva: Test di Stroop (interferenza colore-parola, 16 trial ~2 min), Target Finder (griglia icone trova ★, 30 round ~45 sec), Attentional Blink (RSVP 2 numeri in sequenza rapida ~2 min).',
      'Ogni punteggio viene salvato nel vault e mostrato nel grafico storico.',
      'Limite giornaliero: 4 token (si rigenerano ogni 24h) per evitare sovrallenamento.',
      'Confronto anonimo con i punteggi dei tuoi contatti Nexus.',
      'Attivazione: scrivi "test cognitivo", "brain test" o "allenamento mentale".',
    ],
    action: { label: 'Apri Test Cognitivi', category: 'quiz', renderType: 'quiz', widgetLabel: 'Quiz Cognitivi' },
  },
  {
    id: 'codex',
    icon: '📚',
    title: 'Codex Galattico',
    color: '#f472b6',
    description: 'Il tuo libro personale: capitoli generati da Nebula che raccontano chi sei diventato nel tempo.',
    details: [
      'Nebula genera automaticamente capitoli giornalieri, settimanali o mensili dai tuoi dati.',
      'Ogni capitolo ha: header (tipo, livello energia), due pagine narrative, identity snapshot e shadow insight.',
      'Shadow insight: osservazione profonda di Nebula su un pattern nascosto nei tuoi dati.',
      'Livello energia per capitolo: Alto / Stabile / Basso (calcolato da workout, umore, sonno).',
      'Naviga i capitoli con le frecce o il cursore indice.',
      'Pulsante "Genera Capitolo" se oggi non ne esiste ancora uno.',
      'Attivazione: scrivi "il mio codex", "chi sono", "diario galattico".',
    ],
    action: { label: 'Apri Codex', category: 'chronicle', renderType: 'codex', widgetLabel: 'Codex Galattico' },
  },
  {
    id: 'coherence',
    icon: '🪞',
    title: 'Audit di Coerenza',
    color: '#34d399',
    description: 'Analizza 90 giorni di dati e confronta le tue dichiarazioni con i tuoi comportamenti reali.',
    details: [
      'Calcola un punteggio 0–100 basato su coerenza tra intenzioni dichiarate e dati reali.',
      '≥70 Verde "Coerente" — i tuoi dati rispecchiano i tuoi valori.',
      '45–70 Giallo "In tensione" — conflitto moderato tra dichiarazioni e azioni.',
      '<45 Rosso "Conflitto" — vivi in forte contraddizione con ciò che dici di volere.',
      'Mostra fino a 4 findings con: titolo contraddizione, dati specifici citati, severità (alta/media/bassa) e consiglio concreto.',
      'Attivazione: scrivi "chi sono diventato", "audit di coerenza", "analisi coerenza".',
    ],
    action: { label: 'Apri Coerenza', category: 'insight', renderType: 'coherence', widgetLabel: 'Audit di Coerenza' },
  },
  {
    id: 'predictive',
    icon: '📈',
    title: 'Analisi Predittiva',
    color: '#06b6d4',
    description: 'Correlazioni statistiche e proiezioni future basate sui tuoi dati storici.',
    details: [
      'Calcola la correlazione di Pearson (r) tra coppie di categorie: salute↔finanza, umore↔salute, ecc.',
      'Classifica: forte (|r|≥0.5), moderata (|r|≥0.25), debole — con direzione positiva o negativa.',
      'Richiede almeno 7 giorni di dati sovrapposti tra le due categorie.',
      'Proiezioni trend per finance: estrapola i prossimi 14 giorni se r²>0.5.',
      'I beam colorati nel canvas Starfield connettono visivamente le stelle correlate.',
      'Attivazione: scrivi "correlazioni", "analisi predittiva", "previsioni".',
    ],
    action: { label: 'Apri Predittiva', category: 'predictive', renderType: 'predictive', widgetLabel: 'Analisi Predittiva' },
  },
  {
    id: 'nexus',
    icon: '🔗',
    title: 'Nexus — Social Hub',
    color: '#f472b6',
    description: 'Connessioni con altri utenti: amicizie, messaggi, sfide e confronto punteggi cognitivi.',
    details: [
      'Cerca utenti per username e invia richieste di amicizia.',
      'Lista amici con profilo, stats pubblici comparati e avatar.',
      'Messaggi diretti: chat in tempo reale con ogni contatto.',
      'Sfide: crea obiettivi condivisi (es. "corri 5km questa settimana") con scadenza e tracking.',
      'Confronto punteggi test cognitivi: vedi i risultati anonimi dei tuoi contatti.',
      'Il profilo espone pubblicamente le categorie che scegli (finance, health, workout, ecc.).',
      'Attivazione: scrivi "nexus", "cerca amici", "sfida [nome]".',
    ],
    action: { label: 'Apri Nexus', category: 'nexus', renderType: 'nexus', widgetLabel: 'Nexus' },
  },
  {
    id: 'timeline',
    icon: '📅',
    title: 'Timeline — Calendario',
    color: '#fbbf24',
    description: 'Agenda e calendario mensile con eventi, promemoria e scadenze.',
    details: [
      'Vista Calendario: griglia mensile, naviga avanti/indietro, punto sui giorni con eventi.',
      'Seleziona un giorno per vedere la timeline verticale con orari.',
      'Vista Agenda: lista cronologica eventi futuri con filtro per mese.',
      'Cancella eventi direttamente dalla lista.',
      'Inserimento chat: "appuntamento domani alle 14:30 con Marco", "riunione venerdì ore 10", "ricordami l\'affitto ogni mese".',
      'Riconosce date relative: "tra 2 ore", "dopodomani", "prossimo lunedì".',
    ],
    action: { label: 'Apri Calendario', category: 'calendar', renderType: 'timeline', widgetLabel: 'Calendario' },
  },
  {
    id: 'documents',
    icon: '📄',
    title: 'Documenti — Archivio',
    color: '#a3e635',
    description: 'Archivia e gestisci documenti personali con OCR automatico e scadenziario.',
    details: [
      'Upload drag-and-drop: PDF, immagini — OCR automatico estrae testo e metadati.',
      'Classificazione AI in categorie: Bollette, Buste paga, Fatture, Medici, Contratti, Fiscale.',
      'Scadenziario: documenti in scadenza entro 90 giorni ordinati per urgenza.',
      'Grafici trend: buste paga ultimi 12 mesi, bollette ultimi 12 mesi.',
      'Ricerca full-text su filename, oggetto, riassunto e testo estratto.',
      'Scarica o cancella ogni documento con loading state.',
      'Attivazione chat: "mostrami documenti", "scarica busta paga 2024", "quando scade la bolletta?".',
    ],
    action: { label: 'Apri Documenti', category: 'documents', renderType: 'doc_download', widgetLabel: 'Documenti' },
  },
  {
    id: 'void',
    icon: '🌀',
    title: 'The Void — Note & Mente',
    color: '#6366f1',
    description: 'Spazio per pensieri liberi con hashtag. The Mind li visualizza come rete connessa.',
    details: [
      'Tab The Void: textarea con placeholder "Scrivi un pensiero… #tag per organizzare".',
      'Hashtag rilevati in tempo reale, preview sotto il testo prima di archiviare.',
      'Salvataggio con Cmd+Invio o pulsante "Archivia →".',
      'Tab The Mind — vista Tree: sidebar lista tag + filtro note per tag selezionato.',
      'Tab The Mind — vista Graph: rete SVG dove i nodi sono tag (size = frequenza), edge = co-occorrenza.',
      'Clicca un nodo nel grafo per filtrare le note nella vista Tree.',
      'Inserimento chat: "penso che…", "ho realizzato…", "nota a me stesso", "#tag testo".',
    ],
    action: { label: 'Apri Void', category: 'notes', renderType: 'void', widgetLabel: 'The Void' },
  },
  {
    id: 'privacy',
    icon: '🔒',
    title: 'Identità Online — Ghost Protocol',
    color: '#a78bfa',
    description: 'Analisi della tua esposizione digitale: fingerprint browser, WebRTC leak test e verifica password compromesse.',
    details: [
      'Tab Ombra: Browser Fingerprint con 12+ segnali (GPU, schermo, timezone, lingua, ecc.) con livello di rischio per ognuno.',
      'Tab Scan: WebRTC Leak Test — verifica se il tuo IP reale viene esposto ai siti web, anche con VPN attiva.',
      'Tab Scan: mostra IP pubblico, città, provider internet e se c\'è un leak rilevato.',
      'Verifica password: controlla se una password è stata trovata in violazioni di dati (HIBP k-anonymity, nessun dato inviato in chiaro).',
      'Tab Rapporto: riepilogo esposizione con stats, art. 17 GDPR e pulsante "Genera Report PDF" locale.',
      'Attivazione: scrivi "ghost protocol", "chi sono online", "privacy report", "ombra digitale".',
    ],
    action: { label: 'Apri Privacy', category: 'privacy', renderType: 'privacy', widgetLabel: 'Chi sono online' },
  },
];

const CMD_SHORTCUTS = [
  { cmd: '?', desc: 'Focus mode (labels stelle)' },
  { cmd: 'aiuto', desc: 'Lista comandi' },
  { cmd: 'mostrami [categoria]', desc: 'Apri dati' },
  { cmd: 'analizza tutto', desc: 'Insight AI' },
  { cmd: 'chi sono diventato', desc: 'Audit coerenza' },
  { cmd: 'ghost protocol', desc: 'Privacy scan' },
  { cmd: 'test cognitivo', desc: 'Apri quiz' },
  { cmd: 'il mio codex', desc: 'Libro personale' },
  { cmd: 'correlazioni', desc: 'Analisi predittiva' },
  { cmd: 'cancella [cat]', desc: 'Elimina categoria' },
];

export default function GuideModal({ onClose }: { onClose: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCmds, setShowCmds] = useState(false);
  const { setActiveWidget, setShowSettings, user } = useAlterStore();

  const navigate = async (section: GuideSection) => {
    if (!section.action) return;
    const { category, renderType, widgetLabel } = section.action;
    const meta = getCategoryMeta(category);
    const entries = user?.id ? await getByCategory(user.id, category, 50) : [];
    setActiveWidget({ category, label: widgetLabel, color: meta.color, entries, renderType: renderType as any });
    setShowSettings(false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 800,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal wrapper — centering via flexbox so Framer Motion doesn't break translate(-50%,-50%) */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: '24px 12px',
      }}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        style={{
          pointerEvents: 'auto',
          width: 'min(480px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: 'var(--glass)',
          border: '1px solid var(--border)',
          borderRadius: 22,
          padding: '24px 20px 28px',
          boxShadow: '0 32px 100px rgba(0,0,0,0.75)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text)' }}>
              GUIDA — ALTER OS
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3, letterSpacing: '0.04em' }}>
              {SECTIONS.length} funzionalità · clicca per espandere
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: 20, lineHeight: 1,
              padding: '2px 6px', borderRadius: 6, flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 18px' }} />

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {SECTIONS.map(section => {
            const isOpen = expandedId === section.id;
            return (
              <div
                key={section.id}
                style={{
                  border: `1px solid ${isOpen ? section.color + '40' : 'var(--border)'}`,
                  borderRadius: 14,
                  background: isOpen ? section.color + '08' : 'rgba(255,255,255,0.02)',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <button
                  onClick={() => setExpandedId(isOpen ? null : section.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '12px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontSize: 17,
                    width: 26,
                    textAlign: 'center',
                    flexShrink: 0,
                    filter: isOpen ? `drop-shadow(0 0 5px ${section.color})` : 'none',
                    transition: 'filter 0.2s',
                  }}>
                    {section.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isOpen ? section.color : 'var(--text)',
                        letterSpacing: '0.03em',
                        transition: 'color 0.2s',
                      }}>
                        {section.title}
                      </span>
                      {section.badge && (
                        <span style={{
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          color: section.color,
                          background: section.color + '18',
                          border: `1px solid ${section.color}35`,
                          borderRadius: 5,
                          padding: '1px 5px',
                        }}>
                          {section.badge}
                        </span>
                      )}
                    </div>
                    {!isOpen && (
                      <div style={{
                        fontSize: 10.5,
                        color: 'var(--text-dim)',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {section.description}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    flexShrink: 0,
                  }}>
                    ▾
                  </span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0 14px 14px 51px' }}>
                        <p style={{
                          fontSize: 11.5,
                          color: 'var(--text)',
                          lineHeight: 1.65,
                          marginBottom: 10,
                          opacity: 0.8,
                        }}>
                          {section.description}
                        </p>
                        <ul style={{
                          margin: 0,
                          padding: 0,
                          listStyle: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 5,
                        }}>
                          {section.details.map((detail, i) => (
                            <li key={i} style={{
                              fontSize: 10.5,
                              color: 'var(--text-dim)',
                              lineHeight: 1.6,
                              display: 'flex',
                              gap: 7,
                            }}>
                              <span style={{ color: section.color, flexShrink: 0, fontSize: 9, marginTop: 4 }}>◆</span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>

                        {section.action && (
                          <button
                            onClick={() => navigate(section)}
                            style={{
                              marginTop: 13,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 14px',
                              background: section.color + '15',
                              border: `1px solid ${section.color}40`,
                              borderRadius: 9,
                              cursor: 'pointer',
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: section.color,
                              letterSpacing: '0.04em',
                              transition: 'background 0.2s, border-color 0.2s',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = section.color + '28';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = section.color + '70';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = section.color + '15';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = section.color + '40';
                            }}
                          >
                            {section.action.label}
                            <span style={{ fontSize: 14, opacity: 0.8 }}>→</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Quick Commands footer */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowCmds(v => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: showCmds ? '12px 12px 0 0' : 12,
              cursor: 'pointer',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--text-dim)',
              transition: 'border-radius 0.2s',
            }}
          >
            <span>COMANDI RAPIDI CHAT</span>
            <span style={{
              transform: showCmds ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              fontSize: 11,
            }}>▾</span>
          </button>
          <AnimatePresence>
            {showCmds && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  background: 'rgba(255,255,255,0.01)',
                }}
              >
                <div style={{ padding: '6px 0' }}>
                  {CMD_SHORTCUTS.map((c, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 14px',
                      borderBottom: i < CMD_SHORTCUTS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                      <code style={{
                        fontSize: 10,
                        color: '#4BC4B8',
                        background: 'rgba(75,196,184,0.1)',
                        border: '1px solid rgba(75,196,184,0.2)',
                        borderRadius: 5,
                        padding: '1px 6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {c.cmd}
                      </code>
                      <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{c.desc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      </div>
    </>
  );
}
