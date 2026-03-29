import type { VaultEntry } from '../types';
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

// ─── Chart spec returned by the AI ───────────────────────────
export interface ChartSpec {
  type: 'line' | 'bar' | 'pie' | 'number';
  title: string;
  data: Record<string, unknown>[];
  xKey?: string;   // for line/bar: x-axis field
  yKey?: string;   // for line/bar: y-axis field
  nameKey?: string; // for pie: name field
  valueKey?: string; // for pie: value field
  color?: string;
  unit?: string;
  insight?: string;
}

export interface AnalysisResult {
  charts: ChartSpec[];
  summary: string;
}

// ─── Format entries as compact context for Gemini ─────────────
function formatEntries(entries: VaultEntry[]): string {
  return entries
    .slice(0, 60)
    .map(e => `[${new Date(e.created_at).toLocaleDateString('it-IT')} ${e.category}] ${JSON.stringify(e.data)}`)
    .join('\n');
}

const SYSTEM_PROMPT = `Sei un analista dati per "Alter OS". Ti vengono dati dati personali dell'utente in formato JSON (vault entries).
Il tuo compito: analizzare i dati e produrre specifiche per grafici utili e informativi.

Rispondi SOLO con JSON valido, zero testo fuori dal JSON.

Schema risposta:
{
  "charts": [
    {
      "type": "line"|"bar"|"pie"|"number",
      "title": "titolo del grafico",
      "data": [...],
      "xKey": "campo per asse x (per line/bar)",
      "yKey": "campo per asse y (per line/bar)",
      "nameKey": "campo nome (solo per pie)",
      "valueKey": "campo valore (solo per pie)",
      "color": "#hexcolor opzionale",
      "unit": "unità opzionale (es. '€', 'kg', 'h')",
      "insight": "insight conciso in 1 frase"
    }
  ],
  "summary": "riassunto dell'analisi in 2-3 frasi"
}

Regole per i dati nei grafici:
- Per grafici line/bar: ogni elemento in "data" deve avere i campi xKey e yKey
- Per pie: ogni elemento deve avere nameKey e valueKey
- Per type "number": "data" = [{ "value": numero, "label": "descrizione" }]
- Usa date leggibili (es. "12 mar") per l'asse x quando appropriato
- Aggrega/somma i dati per renderli significativi (es. spese per giorno, non entry singole)

Analisi per categoria:
- finance: cashflow (entrate vs uscite), burn rate mensile, spese per categoria, giorni con più spese
- health: trend peso/sonno/acqua, distribuzione attività
- psychology: andamento umore nel tempo, distribuzione stati
- cross-category: correlazioni (es. umore vs spese, sonno vs produttività)

Genera max 3 grafici per query standard, 1-2 per query specifiche.`;

async function geminiChat(messages: { role: string; content: string }[], maxTokens = 1500): Promise<string | null> {
  const token = await getFreshToken();
  if (!token) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const system = messages.find(m => m.role === 'system')?.content ?? '';
    const turns = messages.filter(m => m.role !== 'system');
    const contents = turns.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    if (system && contents.length > 0) {
      contents[0].parts[0].text = `${system}\n\n${contents[0].parts[0].text}`;
    }
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 } }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const json = await res.json();
    return (json.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? null;
  } catch (e) {
    console.error('[dataAnalyser]', e);
    return null;
  }
}

// ─── Main analysis function ───────────────────────────────────
export async function analyseData(
  entries: VaultEntry[],
  query?: string,
  crossEntries?: VaultEntry[]  // entries from other categories for cross-analysis
): Promise<AnalysisResult | null> {
  const context = formatEntries(entries);
  const crossContext = crossEntries ? formatEntries(crossEntries) : '';

  const userMessage = query
    ? `Dati principali:\n${context || '(nessun dato)'}\n${crossContext ? `\nDati correlati:\n${crossContext}` : ''}\n\nQuery specifica: ${query}`
    : `Dati:\n${context || '(nessun dato)'}\n\nAnalizza questi dati e genera i grafici più utili e informativi.`;

  const raw = await geminiChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ]);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AnalysisResult;
    if (!parsed.charts || !Array.isArray(parsed.charts)) return null;
    return parsed;
  } catch {
    console.error('[dataAnalyser] invalid JSON', raw);
    return null;
  }
}

// ─── Fallback: local analysis without AI ─────────────────────
export function localAnalyse(entries: VaultEntry[], category: string): AnalysisResult {
  if (category === 'finance') {
    // Aggregate by day
    const byDay: Record<string, { income: number; expense: number }> = {};
    for (const e of entries) {
      const day = new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
      if (!byDay[day]) byDay[day] = { income: 0, expense: 0 };
      const d = e.data as Record<string, unknown>;
      const amt = Number(d.amount ?? 0);
      if (d.type === 'income') byDay[day].income += amt;
      else byDay[day].expense += amt;
    }
    const days = Object.entries(byDay).slice(-14).map(([date, v]) => ({
      date,
      entrate: v.income,
      uscite: v.expense,
      netto: v.income - v.expense,
    }));

    const totalIn = days.reduce((s, d) => s + d.entrate, 0);
    const totalOut = days.reduce((s, d) => s + d.uscite, 0);

    return {
      charts: [
        {
          type: 'bar',
          title: 'Cashflow per giorno',
          data: days,
          xKey: 'date',
          yKey: 'netto',
          color: '#40e0d0',
          unit: '€',
          insight: `Saldo netto: ${(totalIn - totalOut).toFixed(0)}€`,
        },
        {
          type: 'number',
          title: 'Riepilogo',
          data: [
            { value: totalIn, label: 'Entrate totali' },
            { value: totalOut, label: 'Uscite totali' },
            { value: totalIn - totalOut, label: 'Netto' },
          ],
        },
      ],
      summary: `${entries.length} transazioni. Entrate: ${totalIn.toFixed(0)}€ — Uscite: ${totalOut.toFixed(0)}€ — Netto: ${(totalIn - totalOut).toFixed(0)}€`,
    };
  }

  if (category === 'health') {
    const weightData = entries
      .filter(e => (e.data as Record<string, unknown>).type === 'weight')
      .slice(0, 20)
      .reverse()
      .map(e => ({
        date: new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
        valore: Number((e.data as Record<string, unknown>).value ?? 0),
      }));

    const sleepData = entries
      .filter(e => (e.data as Record<string, unknown>).type === 'sleep')
      .slice(0, 20)
      .reverse()
      .map(e => ({
        date: new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
        ore: Number((e.data as Record<string, unknown>).hours ?? 0),
      }));

    const charts: ChartSpec[] = [];
    if (weightData.length > 1) charts.push({ type: 'line', title: 'Peso nel tempo', data: weightData, xKey: 'date', yKey: 'valore', color: '#90d8d2', unit: 'kg' });
    if (sleepData.length > 1) charts.push({ type: 'bar', title: 'Ore di sonno', data: sleepData, xKey: 'date', yKey: 'ore', color: '#a78bfa', unit: 'h' });

    return {
      charts: charts.length > 0 ? charts : [{
        type: 'number',
        title: 'Dati salute',
        data: [{ value: entries.length, label: 'Registrazioni totali' }],
      }],
      summary: `${entries.length} entry salute registrate.`,
    };
  }

  if (category === 'psychology') {
    const moodData = entries
      .filter(e => (e.data as Record<string, unknown>).score !== undefined)
      .slice(0, 30)
      .reverse()
      .map(e => ({
        date: new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
        umore: Number((e.data as Record<string, unknown>).score ?? 5),
      }));

    return {
      charts: moodData.length > 1 ? [{
        type: 'line',
        title: 'Andamento umore',
        data: moodData,
        xKey: 'date',
        yKey: 'umore',
        color: '#c4b2f5',
        unit: '/10',
        insight: `Media: ${(moodData.reduce((s, d) => s + d.umore, 0) / moodData.length).toFixed(1)}/10`,
      }] : [{
        type: 'number',
        title: 'Umore',
        data: [{ value: entries.length, label: 'Note registrate' }],
      }],
      summary: `${entries.length} registrazioni psicologiche.`,
    };
  }

  // Generic fallback
  return {
    charts: [{
      type: 'number',
      title: category,
      data: [{ value: entries.length, label: 'Registrazioni totali' }],
    }],
    summary: `${entries.length} entry in "${category}".`,
  };
}
