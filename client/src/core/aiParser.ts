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

// ─── Universal document classifier ───────────────────────────
export interface DocumentClassification {
  docType: string;        // payslip | utility_bill | invoice | bank_statement | medical_report | contract | receipt | identity | tax | fine | insurance | generic
  docTypeLabel: string;   // human-readable Italian label
  main_subject: string | null;   // issuer / company / hospital / etc.
  doc_date: string | null;       // ISO YYYY-MM-DD
  value: number | null;          // main monetary amount in €
  summary: string;               // one-sentence Italian summary
  tags: string[];                // 2–4 searchable keywords
}

export async function classifyDocument(text: string): Promise<DocumentClassification> {
  const fallback = (): DocumentClassification => {
    // Regex fallback when no API key — keeps upload working offline
    const t = (text + ' ').toLowerCase();
    let docType = 'generic', docTypeLabel = 'Documento';
    if (/busta\s*paga|cedolino|retribuzione|paga\s*base|imponibile\s*prev/.test(t))
      { docType = 'payslip';        docTypeLabel = 'Busta paga'; }
    else if (/bolletta|enel|eni\b|snam|hera|edison|luce\b|gas\b|acqua\b|tari/.test(t))
      { docType = 'utility_bill';   docTypeLabel = 'Bolletta'; }
    else if (/estratto\s*conto|saldo\s*disponibile|moviment/.test(t))
      { docType = 'bank_statement'; docTypeLabel = 'Estratto conto'; }
    else if (/fattura\s*n[°.]?\s*\d|iva\s*\d{2}%/.test(t))
      { docType = 'invoice';        docTypeLabel = 'Fattura'; }
    else if (/ricevuta|scontrino/.test(t))
      { docType = 'receipt';        docTypeLabel = 'Ricevuta'; }
    else if (/referto|diagnosi|prescrizione|medico|ospedale/.test(t))
      { docType = 'medical_report'; docTypeLabel = 'Referto medico'; }
    else if (/contratto|locazione|affitto\b/.test(t))
      { docType = 'contract';       docTypeLabel = 'Contratto'; }
    else if (/carta\s*d[i']?\s*identit|passaporto|patente|codice\s*fiscale/.test(t))
      { docType = 'identity';       docTypeLabel = 'Documento identità'; }
    else if (/multa|verbale\s*di\s*contestazione|sanzione/.test(t))
      { docType = 'fine';           docTypeLabel = 'Multa'; }
    else if (/dichiarazione\s*(dei\s*redditi|730|unico)|irpef|f24/.test(t))
      { docType = 'tax';            docTypeLabel = 'Documento fiscale'; }
    else if (/polizza|assicurazion/.test(t))
      { docType = 'insurance';      docTypeLabel = 'Polizza assicurativa'; }

    const amountMatch = text.match(/(?:totale|importo|netto|da\s+pagare|saldo)[^\d]*(\d+[,.]?\d*)\s*[€e]|(\d+[,.]?\d*)\s*€/i);
    const value = amountMatch ? parseFloat((amountMatch[1] ?? amountMatch[2]).replace(',', '.')) : null;
    const issuerMatch = text.match(/\b(Enel|Eni|Snam|Hera|Edison|A2A|Iren|Tim|Vodafone|Fastweb|Wind|Tre|Poste|UniCredit|Intesa|BNL|Fineco|INPS|Agenzia\s*Entrate)\b/i);
    return { docType, docTypeLabel, main_subject: issuerMatch?.[1] ?? null, doc_date: null, value, summary: docTypeLabel, tags: [docType] };
  };

  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!apiKey) return fallback();

  const raw = await deepseekChat([
    {
      role: 'system',
      content: `Sei un classificatore di documenti. Analizza il testo e restituisci SOLO un JSON valido (niente altro) con questi campi:
{
  "docType": uno tra "payslip"|"utility_bill"|"invoice"|"bank_statement"|"medical_report"|"contract"|"receipt"|"identity"|"tax"|"fine"|"insurance"|"generic",
  "docTypeLabel": nome in italiano (es. "Busta paga"),
  "main_subject": ente o azienda emittente (stringa o null),
  "doc_date": data documento ISO YYYY-MM-DD (o null),
  "value": importo numerico principale in euro (o null),
  "summary": riassunto in 1 frase in italiano,
  "tags": array di 2-4 parole chiave utili per ricerche future
}`,
    },
    { role: 'user', content: `Testo documento:\n${text.slice(0, 3000)}` },
  ], 350);

  if (!raw) return fallback();
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback();
    const parsed = JSON.parse(jsonMatch[0]) as Partial<DocumentClassification>;
    return {
      docType:      parsed.docType      ?? 'generic',
      docTypeLabel: parsed.docTypeLabel ?? 'Documento',
      main_subject: parsed.main_subject ?? null,
      doc_date:     parsed.doc_date     ?? null,
      value:        typeof parsed.value === 'number' ? parsed.value : null,
      summary:      parsed.summary      ?? '',
      tags:         Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return fallback();
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
    const date     = new Date(e.created_at).toLocaleDateString('it-IT');
    const label    = (d.docTypeLabel as string) ?? (d.docType as string) ?? 'documento';
    const name     = (d.filename as string) ?? '';
    const subject  = (d.main_subject as string) ?? '';
    const docDate  = (d.doc_date as string) ?? '';
    const value    = typeof d.value === 'number' ? `€${d.value}` : '';
    const summary  = (d.summary as string) ?? '';
    const tags     = Array.isArray(d.tags) ? (d.tags as string[]).join(', ') : '';
    // Use AI-generated summary when available, otherwise fall back to raw text
    const snippet  = summary || ((d.extractedText as string) ?? '').slice(0, 600);
    const meta = [subject, docDate, value, tags].filter(Boolean).join(' · ');
    return `[${date} · ${label}${name ? ' · ' + name : ''}${meta ? ' | ' + meta : ''}]\n${snippet}`;
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
