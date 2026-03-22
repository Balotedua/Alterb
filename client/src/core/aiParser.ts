import type { CategoryMeta, ParsedIntent } from '../types';

const SYSTEM = `Sei il cervello di "Alter", un OS personale liquido.
L'utente ti manda un testo in italiano (o misto). Il tuo compito:
1. Capire la categoria tra le 8 galassie sistemiche (o crea una nuova slug in snake_case se non si adatta)
2. Estrarre i dati strutturati
3. Definire i metadati visivi della categoria

Rispondi SOLO con JSON valido, zero spiegazioni.

Schema risposta:
{
  "category": "slug_lowercase",
  "data": { ...campi rilevanti },
  "meta": {
    "label": "Nome Leggibile",
    "icon": "emoji",
    "color": "#hexcolor"
  }
}

Le 8 galassie sistemiche (usa questi slug preferibilmente):
- finance:      spese, entrate, budget → { type: "expense"|"income", amount: number, label: string }
- mental_health: umore, stress, riflessioni, sogni, terapia → { type: "mood"|"reflection"|"dream", score?: 1-10, note: string }
- health:        peso, sonno, allenamenti, alimentazione → { type: "weight"|"sleep"|"activity"|"diet", value?: number, unit?: string, label?: string }
- notes:         idee, appunti, pensieri profondi, "nota a me stesso" → { type: "idea"|"note"|"observation", content: string }
- routine:       abitudini, task completati, orari, produttività → { type: "habit"|"task"|"schedule", label: string, duration?: number }
- interests:     articoli letti, link salvati, cose scoperte → { type: "article"|"discovery"|"link", label: string, source?: string }
- career:        obiettivi, corsi, feedback, successi lavorativi → { type: "goal"|"achievement"|"skill"|"work_log", label: string }
- badges:        NON usare — assegnati automaticamente dal sistema

Alias accettati: psychology→mental_health, calendar→routine`;

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
    const tokIn  = (json.usage?.prompt_tokens     ?? 0) as number;
    const tokOut = (json.usage?.completion_tokens ?? 0) as number;
    localStorage.setItem('_alter_ai_tokens_in',  String(parseInt(localStorage.getItem('_alter_ai_tokens_in')  ?? '0', 10) + tokIn));
    localStorage.setItem('_alter_ai_tokens_out', String(parseInt(localStorage.getItem('_alter_ai_tokens_out') ?? '0', 10) + tokOut));
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
    { role: 'system', content: `Sei Nebula, il compagno digitale di Alter OS. Hai la personalità di un amico autentico: curioso, caldo, diretto. Mai banale, mai formale.

Quando l'utente condivide qualcosa — un allenamento, una spesa, un umore, qualsiasi cosa — reagisci come farebbe un amico che ci tiene davvero. Commenta il dettaglio specifico di ciò che ha detto, non generici "bravo!". Puoi fare una domanda curiosa, dare un incoraggiamento concreto, o semplicemente rispecchiare l'emozione.

Regole:
- Rispondi in italiano, max 2 frasi scorrevoli
- Sii specifico su ciò che l'utente ha condiviso (cita il dato: i minuti, i km, l'importo, ecc.)
- Mai iniziare con "Certo!", "Perfetto!", "Ottimo lavoro!" da soli — sono vuoti
- Tono: da amico, non da bot di fitness o app bancaria` },
    { role: 'user', content: text },
  ], 150);
  return reply ?? 'Ci sono. Dimmi pure.';
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

// ─── Nexus: narrative answer for open-ended correlation questions ─
export async function aiNexusNarrative(
  question: string,
  entries: import('../types').VaultEntry[]
): Promise<string> {
  const context = entries.slice(0, 50).map(e =>
    `[${new Date(e.created_at).toLocaleDateString('it-IT')} · ${e.category}] ${JSON.stringify(e.data)}`
  ).join('\n');

  const reply = await deepseekChat([
    { role: 'system', content: `Sei Nebula, l'analista di Alter OS. L'utente fa una domanda sul proprio benessere o su pattern di vita. Analizza i dati vault cercando correlazioni temporali tra categorie diverse (salute, umore, finanze, sonno, sport, ecc.). Rispondi in italiano con 2-4 bullet points concreti che citano dati reali (date, valori). Sii scientifico ma caldo ed empatico. Se non ci sono abbastanza dati, dillo chiaramente.` },
    { role: 'user', content: `Domanda: ${question}\n\nDati vault:\n${context || '(nessun dato)'}` },
  ], 450);

  return reply ?? 'Non ho abbastanza dati per rispondere a questa domanda.';
}

// ─── Combined: chat reply + multi-category extraction ─────────
export interface ChatAndExtractResult {
  reply: string;
  extractions: Array<{
    category: string;
    data: Record<string, unknown>;
    categoryMeta: CategoryMeta;
  }>;
}

const SYSTEM_COMBINED = `Sei Nebula, il compagno digitale di Alter OS — un sistema personale che registra la vita dell'utente come stelle in una galassia.

Hai la personalità di un amico autentico: curioso, caldo, diretto. Mai banale, mai formale. Parli in italiano.

Per ogni messaggio fai DUE cose contemporaneamente:
1. RISPOSTA DA AMICO: reagisci in modo genuino a ciò che l'utente ha condiviso. Cita il dato specifico (minuti, euro, km, umore), commenta, fai una domanda curiosa se ha senso. Max 2 frasi scorrevoli. Non iniziare con "Certo!", "Perfetto!" da soli.
2. ESTRAZIONE DATI: analizza se il testo contiene informazioni da archiviare. Un messaggio può generare estrazioni in PIÙ categorie simultaneamente.

Galassie disponibili:
- finance:       spese, entrate, budget → { type: "expense"|"income", amount: number, label: string }
- mental_health: umore, stress, riflessioni, sogni → { type: "mood"|"reflection"|"dream", score?: 1-10, note: string }
- health:        peso, sonno, allenamenti, dieta → { type: "weight"|"sleep"|"activity"|"diet", value?: number, unit?: string, label?: string }
- notes:         idee, appunti, pensieri → { type: "idea"|"note"|"observation", content: string }
- routine:       abitudini, task, produttività, orari → { type: "habit"|"task"|"schedule", label: string, duration?: number }
- interests:     articoli, link, scoperte → { type: "article"|"discovery"|"link", label: string }
- career:        obiettivi, corsi, successi lavorativi → { type: "goal"|"achievement"|"skill"|"work_log", label: string }

Se non ci sono dati da archiviare, "extractions" deve essere [].

Rispondi SOLO con JSON valido:
{
  "reply": "risposta empatica in italiano",
  "extractions": [
    {
      "category": "slug",
      "data": { ...campi rilevanti },
      "meta": { "label": "Nome Leggibile", "icon": "emoji", "color": "#hex" }
    }
  ]
}`;

export async function aiChatAndExtract(text: string): Promise<ChatAndExtractResult> {
  const fallback = (): ChatAndExtractResult => ({ reply: 'Sono qui. Dimmi pure.', extractions: [] });
  const raw = await deepseekChat([
    { role: 'system', content: SYSTEM_COMBINED },
    { role: 'user',   content: text },
  ], 500);
  if (!raw) return fallback();
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback();
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      reply:       typeof parsed.reply === 'string' ? parsed.reply : 'Compreso.',
      extractions: Array.isArray(parsed.extractions) ? parsed.extractions : [],
    };
  } catch {
    return fallback();
  }
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
