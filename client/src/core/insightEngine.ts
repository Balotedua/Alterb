import { getRecentAll } from '../vault/vaultService';
import type { Star } from '../types';
import { supabase } from '../config/supabase';

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`;

async function getFreshToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt - Math.floor(Date.now() / 1000) < 60) {
    const { data: { session: fresh }, error } = await supabase.auth.refreshSession();
    if (error || !fresh) return null;
    return fresh.access_token;
  }
  return session.access_token;
}

// ── Daily greeting (spontaneous reflection) ──────────────────
const GREETING_KEY = 'alter_last_greeting';
const GREETING_COOLDOWN = 4 * 60 * 60 * 1000; // 4h

export async function generateDailyGreeting(userId: string): Promise<string | null> {
  const last = localStorage.getItem(GREETING_KEY);
  if (last && Date.now() - parseInt(last, 10) < GREETING_COOLDOWN) return null;

  const token = await getFreshToken();
  if (!token) return null;

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
    const systemPrompt = `Sei Nebula, il compagno digitale di Alter OS. L'utente ha appena riaperto l'app di ${momento}. Genera UN messaggio di benvenuto personalizzato (max 2 frasi) che:
- Cita qualcosa di specifico dai suoi ultimi dati (un numero, un'attività, uno stato d'animo, una data)
- Offre un piccolo insight o una domanda curiosa basata su pattern nei dati
- È caldo e autentico, non generico né da bot
Rispondi SOLO con il testo del messaggio, senza formattazioni.`;
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nDati recenti:\n${context}` }] }],
        generationConfig: { maxOutputTokens: 120, temperature: 0.72 },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!text?.trim()) return null;
    localStorage.setItem(GREETING_KEY, Date.now().toString());
    return text.trim();
  } catch (e) {
    console.error('[generateDailyGreeting]', e);
    return null;
  }
}

// ── Coherence Audit ───────────────────────────────────────────

export interface CoherenceFinding {
  title: string;
  contradiction: string;
  dataPoints: string[];
  advice: string;
  severity: 'high' | 'medium' | 'low';
  categories: string[];
}

export interface CoherenceReport {
  score: number;
  summary: string;
  findings: CoherenceFinding[];
}

export async function generateCoherenceAudit(userId: string): Promise<CoherenceReport | null> {
  const token = await getFreshToken();
  if (!token) return null;

  const entries = (await getRecentAll(userId, 90)).filter(
    e => e.category !== 'chat' && e.category !== 'insight'
  );
  if (entries.length < 5) return null;

  const byCategory: Record<string, typeof entries> = {};
  for (const e of entries) {
    if (!byCategory[e.category]) byCategory[e.category] = [];
    byCategory[e.category].push(e);
  }

  const context = Object.entries(byCategory)
    .map(([cat, rows]) => {
      const sample = rows.slice(0, 8).map(r =>
        `  [${new Date(r.created_at).toLocaleDateString('it-IT')}] ${JSON.stringify(r.data)}`
      ).join('\n');
      return `=== ${cat.toUpperCase()} (${rows.length} voci) ===\n${sample}`;
    })
    .join('\n\n');

  const systemPrompt = `Sei Nebula, il compagno digitale di Alter OS — un amico sincero e premuroso che conosce profondamente l'utente attraverso i suoi dati. Il tuo compito è generare un "Report di Coerenza": confronta ciò che l'utente dichiara di volere (obiettivi nei documenti, note, carriera) con come si comporta realmente (spese, salute, umore, routine).

Tono: diretto e onesto come un amico che ti vuole bene, mai giudicante né freddo. Parla in seconda persona all'utente ("hai", "stai", "noto che"). Usa i dati reali (numeri, date, importi) per rendere l'analisi specifica e non generica.

Rispondi SOLO con JSON valido (nessun markdown, nessuna spiegazione), con questo schema esatto:
{
  "score": <numero 0-100 che indica la coerenza complessiva>,
  "summary": "<1-2 frasi: la fotografia onesta di chi sta diventando l'utente, con calore e verità>",
  "findings": [
    {
      "title": "<nome breve della contraddizione>",
      "contradiction": "<la contraddizione in 1-2 frasi, con dati specifici citati>",
      "dataPoints": ["<dato specifico 1 es. '€312 spesi in abbigliamento a marzo'>", "<dato specifico 2>"],
      "advice": "<un consiglio concreto, fattibile, non generico>",
      "severity": "<high|medium|low>",
      "categories": ["<categoria1>", "<categoria2>"]
    }
  ]
}

Se non ci sono contraddizioni significative, score sarà alto (>75) e findings avrà 1-2 osservazioni positive. Massimo 4 findings.`;

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nDati vault degli ultimi 90 giorni:\n\n${context}` }] }],
        generationConfig: { maxOutputTokens: 900, temperature: 0.6 },
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!raw?.trim()) return null;

    const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(clean) as CoherenceReport;
    return parsed;
  } catch (e) {
    console.error('[generateCoherenceAudit]', e);
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

  const candidates = stars.filter(s => s.id !== newCat && !s.ephemeral);
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

