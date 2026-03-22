import { getRecentAll, saveEntry } from '../vault/vaultService';
import type { VaultEntry, Star } from '../types';

// ── Daily greeting (spontaneous reflection) ──────────────────
const GREETING_KEY = 'alter_last_greeting';
const GREETING_COOLDOWN = 4 * 60 * 60 * 1000; // 4h

export async function generateDailyGreeting(userId: string): Promise<string | null> {
  const last = localStorage.getItem(GREETING_KEY);
  if (last && Date.now() - parseInt(last, 10) < GREETING_COOLDOWN) return null;

  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!apiKey) return null;

  const entries = (await getRecentAll(userId, 30)).filter(
    e => e.category !== 'insight' && e.category !== 'chat'
  );
  if (entries.length < 3) return null;

  const context = entries.slice(0, 20).map(e =>
    `[${new Date(e.created_at).toLocaleDateString('it-IT')} · ${e.category}] ${JSON.stringify(e.data)}`
  ).join('\n');

  const hour = new Date().getHours();
  const momento = hour < 12 ? 'mattina' : hour < 18 ? 'pomeriggio' : 'sera';

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Sei Nebula, il compagno digitale di Alter OS. L'utente ha appena riaperto l'app di ${momento}. Genera UN messaggio di benvenuto personalizzato (max 2 frasi) che:
- Cita qualcosa di specifico dai suoi ultimi dati (un numero, un'attività, uno stato d'animo, una data)
- Offre un piccolo insight o una domanda curiosa basata su pattern nei dati
- È caldo e autentico, non generico né da bot
Rispondi SOLO con il testo del messaggio, senza formattazioni.`,
          },
          { role: 'user', content: `Dati recenti:\n${context}` },
        ],
        temperature: 0.72,
        max_tokens: 120,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.choices[0]?.message?.content as string | undefined;
    if (!text?.trim()) return null;
    localStorage.setItem(GREETING_KEY, Date.now().toString());
    return text.trim();
  } catch (e) {
    console.error('[generateDailyGreeting]', e);
    return null;
  }
}

// ── quickConnect: L1 semantic beam (zero API cost) ───────────

const STOPWORDS = new Set([
  'sono', 'stata', 'stato', 'avuto', 'fatto', 'oggi', 'ieri',
  'molto', 'poco', 'bene', 'male', 'come', 'dove', 'quando',
  'questo', 'questa', 'anche', 'pero', 'quindi', 'dopo', 'prima',
  'ancora', 'ogni', 'tutto', 'tutta', 'altra', 'altro',
  'della', 'delle', 'degli', 'nella', 'nelle', 'sulla', 'sulle',
  'dalla', 'dalle', 'alla', 'alle', 'perche', 'mentre', 'durante',
]);

const TOPIC_CLUSTERS: string[][] = [
  ['energia', 'domotica', 'risparmio', 'consumo', 'smart', 'automazione', 'efficienza', 'elettricita', 'solare', 'termostato'],
  ['salute', 'sport', 'palestra', 'peso', 'allenamento', 'fitness', 'calorie', 'dieta', 'alimentazione', 'corsa'],
  ['finanza', 'soldi', 'budget', 'spese', 'speso', 'guadagno', 'investimento', 'costo', 'denaro', 'pagato'],
  ['psicologia', 'psychology', 'umore', 'stress', 'ansia', 'emozioni', 'felicita', 'meditazione', 'benessere', 'motivazione'],
  ['lavoro', 'progetto', 'deadline', 'meeting', 'ufficio', 'carriera', 'produttivita', 'cliente', 'presentazione'],
  ['relazioni', 'amici', 'famiglia', 'sociale', 'persone', 'incontri', 'amore', 'partner'],
  ['studio', 'lettura', 'libro', 'corso', 'formazione', 'crescita', 'apprendimento', 'lezione', 'scuola'],
  ['viaggio', 'vacanza', 'hotel', 'aereo', 'treno', 'destinazione', 'turismo', 'spiaggia', 'montagna'],
  ['musica', 'arte', 'cinema', 'teatro', 'creativita', 'hobby', 'passione', 'svago'],
];

function extractKeywords(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-zàèéìòùüä\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
  );
}

/**
 * Finds a thematically related existing star for a just-saved entry.
 * Pure in-memory — zero API cost. Call with ~2s delay for dramatic effect.
 */
export function quickConnect(
  newCat: string,
  rawText: string,
  stars: Star[],
): { catB: string; colorB: string; correlation: number } | null {
  const newWords = extractKeywords(rawText + ' ' + newCat.replace(/_/g, ' '));
  if (newWords.size === 0) return null;

  const candidates = stars.filter(s => s.id !== newCat && s.id !== 'insight' && !s.ephemeral);
  if (candidates.length === 0) return null;

  const matches: Array<{ star: Star; count: number }> = [];

  for (const star of candidates) {
    const starWords = extractKeywords(star.id.replace(/_/g, ' ') + ' ' + star.label);
    for (const cluster of TOPIC_CLUSTERS) {
      if (cluster.some(w => newWords.has(w)) && cluster.some(w => starWords.has(w))) {
        matches.push({ star, count: star.entryCount ?? 1 });
        break;
      }
    }
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => b.count - a.count);
  const { star } = matches[0];

  return { catB: star.id, colorB: star.color, correlation: 0.72 };
}

const STORAGE_KEY   = 'alter_last_insight_run';
const COOLDOWN_MS   = 24 * 60 * 60 * 1000; // 24h
const MIN_ENTRIES   = 20;
const MIN_RICH_CATS = 2; // at least 2 categories with ≥5 entries each

export async function runInsightEngine(userId: string): Promise<VaultEntry | null> {
  // ── Cooldown check ──────────────────────────────────────────
  const lastRun = localStorage.getItem(STORAGE_KEY);
  if (lastRun && Date.now() - parseInt(lastRun, 10) < COOLDOWN_MS) return null;

  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!apiKey) return null;

  // ── Fetch & filter ──────────────────────────────────────────
  const all      = await getRecentAll(userId, 100);
  const entries  = all.filter(e => e.category !== 'insight');

  if (entries.length < MIN_ENTRIES) return null;

  // Require at least MIN_RICH_CATS categories with ≥5 entries
  const catCount = new Map<string, number>();
  for (const e of entries) catCount.set(e.category, (catCount.get(e.category) ?? 0) + 1);
  const richCats = [...catCount.entries()].filter(([, c]) => c >= 5);
  if (richCats.length < MIN_RICH_CATS) return null;

  // ── Build context ───────────────────────────────────────────
  const context = entries.slice(0, 60).map(e =>
    `[${new Date(e.created_at).toLocaleDateString('it-IT')} · ${e.category}] ${JSON.stringify(e.data)}`
  ).join('\n');

  // ── Call DeepSeek ───────────────────────────────────────────
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Sei Nebula, l'analista autonomo di Alter OS. Mentre l'utente non c'era, hai analizzato la sua galassia di dati.
Trova UNA correlazione sorprendente e concreta tra categorie diverse. Usa numeri reali dai dati.
Rispondi SOLO con JSON valido — nessuna spiegazione.
Schema: { "title": "titolo breve max 6 parole", "insight": "2-3 frasi che spiegano la correlazione con dati concreti (numeri, date)", "categories": ["slug1", "slug2"] }`,
          },
          { role: 'user', content: `Dati recenti:\n${context}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.65,
        max_tokens: 320,
      }),
    });

    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const json   = await res.json();
    const parsed = JSON.parse(json.choices[0].message.content) as {
      title?: string; insight?: string; categories?: string[];
    };

    if (!parsed.insight) return null;

    const entry = await saveEntry(userId, 'insight', {
      title:       parsed.title       ?? 'Scoperta Autonoma',
      insight:     parsed.insight,
      categories:  parsed.categories  ?? [],
      generatedAt: new Date().toISOString(),
    });

    if (entry) localStorage.setItem(STORAGE_KEY, Date.now().toString());
    return entry;

  } catch (e) {
    console.error('[insightEngine]', e);
    return null;
  }
}
