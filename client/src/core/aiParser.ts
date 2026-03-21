import type { CategoryMeta, ParsedIntent } from '../types';

const SYSTEM = `Sei il cervello di "Alter", un OS personale liquido.
L'utente ti manda un testo in italiano (o misto). Il tuo compito:
1. Capire la categoria (finance, health, psychology, o crea una nuova slug in snake_case)
2. Estrarre i dati strutturati
3. Definire i metadati visivi della categoria

Rispondi SOLO con JSON valido, zero spiegazioni.

Schema risposta:
{
  "category": "slug_lowercase",
  "data": { ...campi rilevanti },
  "meta": {
    "label": "Nome Leggibile",
    "icon": "lucide-icon-name",
    "color": "#hexcolor"
  }
}

Guida categorie:
- finance: { type: "expense"|"income", amount: number, label: string }
- health:  { type: "weight"|"sleep"|"water"|"activity", value?: number, hours?: number, unit?: string, label?: string }
- psychology: { type: "mood"|"dream"|"note", score?: number (1-10), note: string }
- Categorie custom: inventale (es. "gatto", "libri", "viaggi")

Icone suggerite per lucide-react: Wallet, Heart, Brain, Star, Cat, Book, Plane, Dumbbell, Moon, Droplets, Target, Zap`;

interface AiResult {
  category: string;
  data: Record<string, unknown>;
  meta: CategoryMeta;
}

async function deepseekChat(messages: { role: string; content: string }[], maxTokens = 256): Promise<string | null> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!apiKey) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.4, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const json = await res.json();
    localStorage.setItem('_alter_ai_calls', String(parseInt(localStorage.getItem('_alter_ai_calls') ?? '0', 10) + 1));
    return json.choices[0].message.content as string;
  } catch (e) {
    console.error('[deepseekChat]', e);
    return null;
  }
}

// ─── Chat: conversational reply (no data saved) ───────────────
export async function aiChat(text: string): Promise<string> {
  const reply = await deepseekChat([
    { role: 'system', content: `Sei Nebula, l'assistente di Alter OS — un sistema personale liquido che registra la vita dell'utente come stelle in una galassia. Rispondi in modo conciso e caldo (max 1-2 frasi). Non salvare nulla, non analizzare dati. È solo conversazione.` },
    { role: 'user', content: text },
  ], 120);
  return reply ?? 'Ciao! Dimmi qualcosa da registrare nella tua galassia.';
}

// ─── Query: answer a question using vault entries as context ──
export async function aiQuery(question: string, entries: import('../types').VaultEntry[]): Promise<string> {
  const context = entries.slice(0, 20).map(e =>
    `[${new Date(e.created_at).toLocaleDateString('it-IT')} · ${e.category}] ${JSON.stringify(e.data)}`
  ).join('\n');

  const reply = await deepseekChat([
    { role: 'system', content: `Sei Nebula, l'assistente di Alter OS. Rispondi in italiano in modo conciso (max 3 righe) usando SOLO i dati forniti. Se non ci sono dati pertinenti, dillo chiaramente. Non inventare.` },
    { role: 'user', content: `Dati disponibili:\n${context || '(nessun dato)'}\n\nDomanda: ${question}` },
  ], 200);

  return reply ?? 'Nessun dato trovato per questa query.';
}

// ─── Analyse: cross-category insight ──────────────────────────
export async function analyzeGalaxy(entries: import('../types').VaultEntry[]): Promise<string> {
  const context = entries.map(e =>
    `[${new Date(e.created_at).toLocaleDateString('it-IT')} · ${e.category}] ${JSON.stringify(e.data)}`
  ).join('\n');

  const reply = await deepseekChat([
    { role: 'system', content: `Sei Nebula, l'analista di Alter OS. Analizza i dati dell'utente e trova correlazioni tra salute, finanze e umore. Rispondi in italiano con 2-4 bullet points insights concreti. Sii diretto e utile.` },
    { role: 'user', content: `Ultimi dati:\n${context || '(nessun dato)'}` },
  ], 400);

  return reply ?? 'Dati insufficienti per un\'analisi significativa.';
}

// ─── Document query: answer questions about stored documents ──
export async function aiDocumentQuery(question: string, docs: import('../types').VaultEntry[]): Promise<string> {
  if (docs.length === 0) return 'Nessun documento trovato nel vault.';

  const context = docs.map(e => {
    const d = e.data as Record<string, unknown>;
    const date = new Date(e.created_at).toLocaleDateString('it-IT');
    const label = (d.docTypeLabel as string) ?? (d.docType as string) ?? 'documento';
    const name  = (d.filename as string) ?? '';
    const text  = ((d.extractedText as string) ?? '').slice(0, 800);
    return `[${date} · ${label}${name ? ' · ' + name : ''}]\n${text}`;
  }).join('\n\n---\n\n');

  const reply = await deepseekChat([
    { role: 'system', content: `Sei Nebula, l'assistente di Alter OS. Rispondi in italiano in modo conciso (max 4 righe) basandoti SOLO sui documenti forniti. Se trovi importi, date o nomi rilevanti, citali esplicitamente. Non inventare nulla che non sia nel testo.` },
    { role: 'user',   content: `Documenti:\n${context}\n\nDomanda: ${question}` },
  ], 300);

  return reply ?? 'Non riesco a rispondere con i documenti disponibili.';
}

export async function aiParse(text: string): Promise<Omit<ParsedIntent, 'source' | 'rawText'> | null> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!apiKey) {
    console.warn('[aiParser] No VITE_DEEPSEEK_API_KEY set — falling back to null');
    return null;
  }

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 256,
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    localStorage.setItem('_alter_ai_calls', String(parseInt(localStorage.getItem('_alter_ai_calls') ?? '0', 10) + 1));
    const json = await res.json();
    const parsed: AiResult = JSON.parse(json.choices[0].message.content);
    return { category: parsed.category, data: parsed.data, categoryMeta: parsed.meta };
  } catch (e) {
    console.error('[aiParser]', e);
    return null;
  }
}
