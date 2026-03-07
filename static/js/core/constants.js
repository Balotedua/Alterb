// core/constants.js — Costanti condivise tra tutti i moduli

// --- Psicologia ---
var moodConfig = {
  1: { emoji: '😔', label: 'Difficile' },
  2: { emoji: '😐', label: 'Così così' },
  3: { emoji: '🙂', label: 'Bene' },
  4: { emoji: '😊', label: 'Molto bene' },
  5: { emoji: '🌟', label: 'Eccellente' },
};

var catConfig = {
  riflessione: '💭', gratitudine: '🙏', ansia: '😰',
  obiettivi: '🎯', relazioni: '❤️', lavoro: '💼',
  sogni: '🌙', altro: '📦',
};

// --- Salute ---
var actConfig = {
  corsa: { icon: '🏃' }, palestra: { icon: '💪' }, ciclismo: { icon: '🚴' },
  yoga: { icon: '🧘' }, nuoto: { icon: '🏊' }, camminata: { icon: '🚶' },
  calcio: { icon: '⚽' }, boxe: { icon: '🥊' }, altro: { icon: '⚡' }, sonno: { icon: '😴' },
};

var qualEmoji = { 1: '😫', 2: '😔', 3: '😐', 4: '😊', 5: '🌟' };

// --- Badge / XP ---
var XP_TABLE = { common: 10, rare: 25, epic: 50, legendary: 100 };

var LEVEL_RANKS = [
  { min: 0,    label: 'Principiante',   sub: 'Inizia a guadagnare badge' },
  { min: 50,   label: 'Osservatore',    sub: 'Stai prendendo confidenza con Alter' },
  { min: 150,  label: 'Esploratore',    sub: 'Stai esplorando tutte le sezioni' },
  { min: 300,  label: 'Analista',       sub: 'Stai costruendo buone abitudini' },
  { min: 500,  label: 'Stratega',       sub: 'Approccio sistematico alla vita' },
  { min: 750,  label: 'Maestro',        sub: 'Padronanza degli strumenti' },
  { min: 1100, label: 'Alter Completo', sub: 'Hai raggiunto la padronanza totale' },
];

var CAT_LABELS = {
  generale: 'Generale', streak: 'Costanza', finanza: 'Finanza',
  salute: 'Salute', psicologia: 'Psicologia', coscienza: 'Coscienza', leggendario: 'Leggendari',
};

var CAT_ORDER = ['generale', 'streak', 'finanza', 'salute', 'psicologia', 'coscienza', 'leggendario'];

var BADGES = [
  { id: 'first_login',    cat: 'generale',   rarity: 'common',    icon: '◎', title: 'Primo Passo',      desc: 'Hai aperto Alter per la prima volta' },
  { id: 'profile_done',  cat: 'generale',   rarity: 'common',    icon: '◈', title: 'Identità',          desc: 'Nome e foto profilo impostati' },
  { id: 'theme_set',     cat: 'generale',   rarity: 'common',    icon: '◉', title: 'Stilista',          desc: 'Tema personalizzato scelto' },
  { id: 'explorer',      cat: 'generale',   rarity: 'rare',      icon: '◎', title: 'Esploratore',       desc: 'Visitate tutte le sezioni principali' },
  { id: 'early_bird',    cat: 'generale',   rarity: 'rare',      icon: '✦', title: 'Early Adopter',     desc: 'Tra i primi utenti di Alter' },
  { id: 'streak_3',      cat: 'streak',     rarity: 'common',    icon: '▲', title: '3 Giorni',          desc: '3 giorni consecutivi di utilizzo', prog: 3 },
  { id: 'streak_7',      cat: 'streak',     rarity: 'rare',      icon: '▲', title: 'Una Settimana',     desc: '7 giorni consecutivi', prog: 7 },
  { id: 'streak_14',     cat: 'streak',     rarity: 'epic',      icon: '▲', title: 'Due Settimane',     desc: '14 giorni consecutivi', prog: 14 },
  { id: 'streak_30',     cat: 'streak',     rarity: 'legendary', icon: '▲', title: 'Un Mese Pieno',     desc: '30 giorni consecutivi di accesso', prog: 30 },
  { id: 'first_tx',      cat: 'finanza',    rarity: 'common',    icon: '◇', title: 'Prima Spesa',       desc: 'Prima transazione registrata' },
  { id: 'tx_10',         cat: 'finanza',    rarity: 'common',    icon: '◇', title: 'Contabile',         desc: '10 transazioni registrate', prog: 10 },
  { id: 'tx_50',         cat: 'finanza',    rarity: 'rare',      icon: '◆', title: 'Analista',          desc: '50 transazioni registrate', prog: 50 },
  { id: 'tx_100',        cat: 'finanza',    rarity: 'epic',      icon: '◆', title: 'CFO',               desc: '100 transazioni registrate', prog: 100 },
  { id: 'budget_pos',    cat: 'finanza',    rarity: 'rare',      icon: '◈', title: 'Risparmiatore',     desc: 'Saldo mensile in positivo' },
  { id: 'investment',    cat: 'finanza',    rarity: 'epic',      icon: '◈', title: 'Investitore',       desc: 'Prima transazione di investimento' },
  { id: 'first_workout', cat: 'salute',     rarity: 'common',    icon: '◉', title: 'Prima Sfida',       desc: 'Prima attività fisica registrata' },
  { id: 'workouts_7',    cat: 'salute',     rarity: 'common',    icon: '◉', title: 'Costanza',          desc: '7 allenamenti totali', prog: 7 },
  { id: 'workouts_30',   cat: 'salute',     rarity: 'rare',      icon: '◉', title: 'Atleta',            desc: '30 allenamenti totali', prog: 30 },
  { id: 'workouts_100',  cat: 'salute',     rarity: 'epic',      icon: '◉', title: 'Campione',          desc: '100 allenamenti totali', prog: 100 },
  { id: 'sleep_7',       cat: 'salute',     rarity: 'rare',      icon: '◑', title: 'Dormitore',         desc: '7 notti di sonno tracciate', prog: 7 },
  { id: 'health_balance',cat: 'salute',     rarity: 'epic',      icon: '◈', title: 'Equilibrio',        desc: 'Sonno + attività nella stessa settimana' },
  { id: 'first_entry',   cat: 'psicologia', rarity: 'common',    icon: '◎', title: 'Prima Riflessione', desc: 'Prima voce del diario psicologico' },
  { id: 'entries_7',     cat: 'psicologia', rarity: 'common',    icon: '◎', title: 'Diario',            desc: '7 voci del diario registrate', prog: 7 },
  { id: 'entries_30',    cat: 'psicologia', rarity: 'rare',      icon: '◎', title: 'Introspezione',     desc: '30 voci del diario', prog: 30 },
  { id: 'entries_100',   cat: 'psicologia', rarity: 'epic',      icon: '◎', title: 'Psiconauta',        desc: '100 voci del diario', prog: 100 },
  { id: 'mood_5',        cat: 'psicologia', rarity: 'rare',      icon: '◐', title: 'Spettro Emotivo',   desc: "5 stati d'umore diversi registrati", prog: 5 },
  { id: 'crisis_ok',     cat: 'psicologia', rarity: 'epic',      icon: '◈', title: 'Resilienza',        desc: 'Superata una fase difficile' },
  { id: 'first_note',    cat: 'coscienza',  rarity: 'common',    icon: '✦', title: 'Primo Pensiero',    desc: 'Prima nota di coscienza salvata' },
  { id: 'notes_10',      cat: 'coscienza',  rarity: 'common',    icon: '✦', title: 'Osservatore',       desc: '10 note di coscienza salvate', prog: 10 },
  { id: 'notes_50',      cat: 'coscienza',  rarity: 'rare',      icon: '✦', title: 'Filosofo',          desc: '50 note salvate', prog: 50 },
  { id: 'notes_100',     cat: 'coscienza',  rarity: 'epic',      icon: '✦', title: 'Saggio',            desc: '100 note salvate', prog: 100 },
  { id: 'deep_thought',  cat: 'coscienza',  rarity: 'rare',      icon: '◈', title: 'Profondo',          desc: 'Nota con più di 500 caratteri scritta' },
  { id: 'all_sections',  cat: 'leggendario',rarity: 'legendary', icon: '◈', title: 'Poliedrico',        desc: 'Dati inseriti in tutte e 4 le sezioni' },
  { id: 'complete_set',  cat: 'leggendario',rarity: 'legendary', icon: '◆', title: 'Alter Completo',    desc: 'Almeno 5 badge per ogni categoria' },
  { id: 'centurion',     cat: 'leggendario',rarity: 'legendary', icon: '◎', title: 'Centurione',        desc: '100 badge totali guadagnati' },
];
