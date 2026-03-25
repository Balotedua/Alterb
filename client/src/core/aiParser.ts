import type { CategoryMeta, ParsedIntent, VaultEntry } from '../types';
import { supabase } from '../config/supabase';

// ─── Global rate limiter (Supabase-backed) ────────────────────
const GEMINI_RPM_LIMIT = 14; // margine di sicurezza sotto 15

async function canUseGemini(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ai_rate_limit')
      .select('count, window_start')
      .eq('id', 1)
      .single();
    if (error || !data) return false;

    const windowStart = new Date(data.window_start as string).getTime();
    const now = Date.now();

    if (now - windowStart > 60_000) {
      // Finestra scaduta — reset
      await supabase
        .from('ai_rate_limit')
        .update({ count: 1, window_start: new Date().toISOString() })
        .eq('id', 1);
      return true;
    }

    if ((data.count as number) < GEMINI_RPM_LIMIT) {
      await supabase
        .from('ai_rate_limit')
        .update({ count: (data.count as number) + 1 })
        .eq('id', 1);
      return true;
    }

    return false; // rate limit raggiunto → usa DeepSeek
  } catch {
    return false;
  }
}

// ─── Gemini Flash ─────────────────────────────────────────────
async function geminiChat(messages: { role: string; content: string }[], maxTokens = 256): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    // Converti formato OpenAI → Google (system va nel primo user turn)
    const system = messages.find(m => m.role === 'system')?.content ?? '';
    const turns = messages.filter(m => m.role !== 'system');
    const contents = turns.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    if (system && contents.length > 0) {
      contents[0].parts[0].text = `${system}\n\n${contents[0].parts[0].text}`;
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 } }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const json = await res.json();
    return (json.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? null;
  } catch (e) {
    console.error('[geminiChat]', e);
    return null;
  }
}

// ─── Gemini SSE streaming ──────────────────────────────────────
async function geminiChatStream(
  messages: { role: string; content: string }[],
  onChunk: (accumulated: string) => void,
  maxTokens = 700
): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;
  try {
    const system = messages.find(m => m.role === 'system')?.content ?? '';
    const turns = messages.filter(m => m.role !== 'system');
    const contents = turns.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    if (system && contents.length > 0) {
      contents[0].parts[0].text = `${system}\n\n${contents[0].parts[0].text}`;
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 } }),
      }
    );
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const raw = decoder.decode(value, { stream: true });
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        try {
          const delta = (JSON.parse(data).candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string;
          if (delta) { full += delta; onChunk(full); }
        } catch { /* malformed chunk — skip */ }
      }
    }
    return full || null;
  } catch (e) {
    console.error('[geminiChatStream]', e);
    return null;
  }
}

// ─── Router: Gemini se sotto rate limit, DeepSeek come fallback ─
async function aiChat_router(messages: { role: string; content: string }[], maxTokens = 256): Promise<string | null> {
  const useGemini = await canUseGemini();
  if (useGemini) {
    const result = await geminiChat(messages, maxTokens);
    if (result !== null) return result;
  }
  return deepseekChat(messages, maxTokens);
}

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

// ─── DeepSeek SSE streaming ────────────────────────────────────
async function deepseekChatStream(
  messages: { role: string; content: string }[],
  onChunk: (accumulated: string) => void,
  maxTokens = 700
): Promise<string | null> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.4, max_tokens: maxTokens, stream: true }),
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const raw = decoder.decode(value, { stream: true });
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const delta = (JSON.parse(data).choices?.[0]?.delta?.content ?? '') as string;
          if (delta) { full += delta; onChunk(full); }
        } catch { /* malformed chunk — skip */ }
      }
    }
    return full || null;
  } catch (e) {
    console.error('[deepseekChatStream]', e);
    return null;
  }
}

// Extract the "reply" field value from a partially-streamed JSON string
function extractReplyFromPartialJson(json: string): string {
  const complete = json.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (complete) return complete[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const partial = json.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (partial) return partial[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return '';
}

// ─── Streaming aiChat ─────────────────────────────────────────
export async function aiChatStream(
  text: string,
  onChunk: (text: string) => void,
  history: ChatHistoryEntry[] = [],
  vaultContext?: string,
  webContext?: string
): Promise<string> {
  const systemBase = `Sei Nebula, il compagno digitale di Alter OS. Hai la personalità di un amico autentico: curioso, caldo, diretto. Mai banale, mai formale.

Quando l'utente condivide qualcosa o fa una domanda, rispondi come farebbe un amico che ci tiene davvero — non come un assistente virtuale. Sii spontaneo, reattivo, presente.

Regole:
- Rispondi in italiano, tono da amico — non da chatbot
- Mai iniziare con "Certo!", "Perfetto!", "Ottimo!" da soli — sono vuoti
- 2-4 frasi: sii presente senza essere prolisso
- MAI fare domande casuali o disconnesse dalla vita dell'utente (es. "quale superpotere sceglieresti?"). Se devi fare una domanda, che sia concreta e legata ai suoi dati o alla conversazione corrente
- Se l'utente dice "dimmi qualcosa / chiedimi qualcosa / fai qualcosa" e hai il contesto vault, usa le sue categorie reali per proporre qualcosa di pertinente (es. "Ho visto che hai X voci in finanza — vuoi un'analisi delle spese?"). Se non hai il contesto, chiedi cosa vuole tracciare o cosa sta pensando — mai domande filosofiche a caso
- Se l'utente fa una domanda su sé stesso e hai il contesto vault — usalo subito, cita dati reali (conteggi, categorie, date), non restare vago`;

  let systemContent = vaultContext
    ? `${systemBase}\n\nIMPORTANTE: Sei un amico di lunga data, non al primo incontro. Mai frasi come "benvenuto", "sono Nebula". Conosci già questa persona.\n\nSe ti chiede qualcosa su di sé in modo generico, DEVI usare il contesto sotto per rispondere in modo personale e specifico — cita categorie reali, date, conteggi. Non essere vago quando hai informazioni.\n\n⛔ ANTI-ALLUCINAZIONE (ASSOLUTA): Il contesto mostra SOLO categorie, conteggi e date — NON il contenuto delle singole voci. VIETATO inventare o elencare importi specifici, nomi di negozi/persone, date di transazioni, note o qualsiasi dato dettagliato. Se l'utente vuole i dettagli, di' SOLO: 'Digita "mostrami [categoria]" per vedere i dati reali.' Non fare esempi, non simulare, non usare cifre inventate.\n\n📊 Galassia personale (solo conteggi e date):\n${vaultContext}`
    : systemBase;

  if (webContext) {
    const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    systemContent += `\n\n🌐 DATI WEB AGGIORNATI (${today}):\n${webContext}\n\nUsa questi dati per rispondere. Se disponibili, cita la fonte. Non affermare limiti di conoscenza — hai i dati qui sopra.`;
  }

  const msgs = [{ role: 'system', content: systemContent }, ...buildHistory(history), { role: 'user', content: text }];

  const useGemini = await canUseGemini();
  if (useGemini) {
    let finalGemini = '';
    const result = await geminiChatStream(msgs, (acc) => { finalGemini = acc; onChunk(acc); }, 700);
    if (result !== null) return result ?? finalGemini;
  }

  // DeepSeek SSE fallback
  let finalText = '';
  const result = await deepseekChatStream(msgs, (acc) => { finalText = acc; onChunk(acc); }, 700);
  return result ?? finalText ?? 'Ci sono. Dimmi pure.';
}

// ─── Streaming aiChatAndExtract ───────────────────────────────
export async function aiChatAndExtractStream(
  text: string,
  onReplyChunk: (replyText: string) => void,
  history: ChatHistoryEntry[] = [],
  vaultContext?: string
): Promise<ChatAndExtractResult> {
  const fallback = (): ChatAndExtractResult => ({ reply: 'Sono qui. Dimmi pure.', extractions: [] });
  const systemContent = vaultContext
    ? `${SYSTEM_COMBINED}\n\n⛔ ANTI-ALLUCINAZIONE (ASSOLUTA): Hai SOLO conteggi e date per categoria — NON il contenuto delle singole voci. VIETATO inventare note, importi, nomi, idee specifiche. Se l'utente chiede il contenuto dettagliato, rispondi SOLO: 'Digita "mostrami [categoria]" per vedere i dati reali.'\n\n📊 Galassia personale (solo conteggi e date):\n${vaultContext}`
    : SYSTEM_COMBINED;
  const msgs = [{ role: 'system', content: systemContent }, ...buildHistory(history), { role: 'user', content: text }];

  // Try Gemini first with streaming
  const useGemini = await canUseGemini();
  if (useGemini) {
    let rawGemini = '';
    const result = await geminiChatStream(
      msgs,
      (acc) => {
        rawGemini = acc;
        const replyText = extractReplyFromPartialJson(acc);
        if (replyText) onReplyChunk(replyText);
      },
      900
    );
    if (result !== null) {
      const full = result ?? rawGemini;
      try {
        const jsonMatch = full.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return fallback();
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          reply: typeof parsed.reply === 'string' ? parsed.reply : 'Compreso.',
          extractions: Array.isArray(parsed.extractions) ? parsed.extractions : [],
        };
      } catch { return fallback(); }
    }
  }

  // DeepSeek SSE: stream reply field progressively
  let rawFull = '';
  await deepseekChatStream(
    msgs,
    (acc) => {
      rawFull = acc;
      const replyText = extractReplyFromPartialJson(acc);
      if (replyText) onReplyChunk(replyText);
    },
    900
  );

  if (!rawFull) return fallback();
  try {
    const jsonMatch = rawFull.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback();
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      reply: typeof parsed.reply === 'string' ? parsed.reply : 'Compreso.',
      extractions: Array.isArray(parsed.extractions) ? parsed.extractions : [],
    };
  } catch { return fallback(); }
}

// ─── Universal document classifier ───────────────────────────
export interface DocumentClassification {
  docType: string;        // payslip | utility_bill | invoice | bank_statement | medical_report | contract | receipt | identity | tax | fine | insurance | generic
  docTypeLabel: string;   // human-readable Italian label
  main_subject: string | null;   // issuer / company / hospital / etc.
  doc_date: string | null;       // ISO YYYY-MM-DD
  expiry_date: string | null;    // ISO YYYY-MM-DD — data di scadenza (CI, patente, polizza, garanzia, contratto…)
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
    // Regex expiry date fallback: "scade il DD/MM/YYYY", "valida fino al", "data scadenza", "scadenza: DD/MM/YYYY"
    let expiry_date: string | null = null;
    const expM = text.match(/(?:scade?\s+(?:il|al|il\s+giorno)?|valida?\s+fino\s+al|scadenza[:\s]+|valid\s+until[:\s]+)\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/i);
    if (expM) {
      const [, dd, mm, yy] = expM;
      const yyyy = yy.length === 2 ? `20${yy}` : yy;
      expiry_date = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return { docType, docTypeLabel, main_subject: issuerMatch?.[1] ?? null, doc_date: null, expiry_date, value, summary: docTypeLabel, tags: [docType] };
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
  "expiry_date": data di SCADENZA ISO YYYY-MM-DD (o null) — cerca "scade il", "valida fino al", "data scadenza", "scadenza polizza", "valid until", garanzie con durata. Per CI/passaporto/patente estrai la data di scadenza esplicita. Per polizze assicurative la data fine copertura. Per contratti la data fine. Per garanzie prodotto la data fine garanzia. Se non c'è una scadenza esplicita → null.
  "value": importo numerico principale in euro (o null),
  "summary": riassunto in 1 frase in italiano (includi la scadenza se trovata),
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
      expiry_date:  parsed.expiry_date  ?? null,
      value:        typeof parsed.value === 'number' ? parsed.value : null,
      summary:      parsed.summary      ?? '',
      tags:         Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return fallback();
  }
}

type ChatHistoryEntry = { role: 'user' | 'nebula'; text: string };

function buildHistory(history: ChatHistoryEntry[], maxTurns = 4): { role: string; content: string }[] {
  return history.slice(-maxTurns).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));
}

// ─── Capability: spiega cosa sa fare Alter in modo caldo ──────
export async function aiCapability(text: string, history: ChatHistoryEntry[] = []): Promise<string> {
  const reply = await aiChat_router([
    { role: 'system', content: `Sei Alter, un OS personale liquido. L'utente sta chiedendo come funzioni o cosa puoi fare. Rispondi come un amico che spiega le sue capacità — caldo, diretto, senza elenchi robotici.

Quello che sai fare:
- Salvare qualsiasi cosa in linguaggio naturale: spese, salute (peso, sonno, sport), umore, appuntamenti, note, abitudini, letture
- Importare estratti conto (CSV/XLSX) e analizzarli automaticamente
- Archiviare documenti PDF via OCR: buste paga, bollette, fatture, referti medici, contratti
- Rispondere a domande sui dati: "quanto ho speso questo mese?", "com'era il mio sonno la scorsa settimana?"
- Trovare correlazioni tra categorie con il Nexus (es. umore e spese, sonno e produttività)
- Analisi periodiche automatiche, insight cross-categoria
- Promemoria e countdown live per eventi imminenti

Adatta la risposta a quello che l'utente ha chiesto nello specifico. Rispondi in italiano. Se ha chiesto "cosa sai fare" in modo vago, dagli un assaggio concreto e coinvolgente — puoi usare 3-5 frasi e citare esempi reali.` },
    ...buildHistory(history),
    { role: 'user', content: text },
  ], 700);
  return reply ?? 'Dimmi pure cosa vuoi fare, ci penso io.';
}

// ─── Chat: conversational reply (no data saved) ───────────────
export async function aiChat(text: string, history: ChatHistoryEntry[] = [], vaultContext?: string): Promise<string> {
  const systemBase = `Sei Nebula, il compagno digitale di Alter OS. Hai la personalità di un amico autentico: curioso, caldo, diretto. Mai banale, mai formale.

Quando l'utente condivide qualcosa o fa una domanda, rispondi come farebbe un amico che ci tiene davvero — non come un assistente virtuale. Sii spontaneo, reattivo, presente.

Regole:
- Rispondi in italiano, tono da amico — non da chatbot
- Mai iniziare con "Certo!", "Perfetto!", "Ottimo!" da soli — sono vuoti
- 2-4 frasi: sii presente senza essere prolisso
- MAI fare domande casuali o disconnesse dalla vita dell'utente (es. "quale superpotere sceglieresti?"). Se devi fare una domanda, che sia concreta e legata ai suoi dati o alla conversazione
- Se l'utente dice "dimmi qualcosa / chiedimi qualcosa / fai qualcosa" e hai il contesto vault, usa le sue categorie reali per proporre qualcosa di pertinente. Se non hai il contesto, chiedi cosa vuole tracciare — mai domande filosofiche a caso
- Se l'utente fa una domanda su sé stesso e hai il contesto vault — usalo subito, cita dati reali, non restare vago`;

  const systemContent = vaultContext
    ? `${systemBase}\n\nIMPORTANTE: Sei un amico di lunga data, non al primo incontro. Mai frasi come "benvenuto", "sono Nebula". Conosci già questa persona.\n\nSe ti chiede qualcosa su di sé in modo generico, DEVI usare il contesto sotto per rispondere in modo personale e specifico — cita categorie reali, date, conteggi. Non essere vago quando hai informazioni.\n\n⛔ ANTI-ALLUCINAZIONE (ASSOLUTA): Il contesto mostra SOLO categorie, conteggi e date — NON il contenuto delle singole voci. VIETATO inventare o elencare importi specifici, nomi di negozi/persone, date di transazioni, note o qualsiasi dato dettagliato. Se l'utente vuole i dettagli, di' SOLO: 'Digita "mostrami [categoria]" per vedere i dati reali.' Non fare esempi, non simulare, non usare cifre inventate.\n\n📊 Galassia personale (solo conteggi e date):\n${vaultContext}`
    : systemBase;

  const reply = await aiChat_router([
    { role: 'system', content: systemContent },
    ...buildHistory(history),
    { role: 'user', content: text },
  ], 700);
  return reply ?? 'Ci sono. Dimmi pure.';
}

// ─── Query: answer a question using vault entries as context ──
export async function aiQuery(question: string, entries: import('../types').VaultEntry[]): Promise<string> {
  const context = entries.slice(0, 30).map(e =>
    `[${new Date(e.created_at).toLocaleDateString('it-IT')} · ${e.category}] ${JSON.stringify(e.data)}`
  ).join('\n');

  const reply = await aiChat_router([
    { role: 'system', content: `Sei Nebula, il compagno digitale di Alter OS. L'utente ti fa una domanda sui suoi dati. Rispondi come un amico diretto e attento — non come un database.

Regole:
- Prima dai la risposta principale in modo diretto e conversazionale (es. "Hai speso 35€ ieri, per la pizza"), poi aggiungi dettagli utili se ce ne sono
- Non fare liste numerate per risposte semplici — usa prosa naturale
- Se hai 3+ voci, puoi usare un elenco informale con "·" ma tieni il tono caldo
- Cita cifre e date in modo naturale, non da tabella
- Se i dati sono scarsi o mancanti, dillo in modo umano e suggerisci cosa potrebbe fare
- Rispondi in italiano, mai formale` },
    { role: 'user', content: `Dati disponibili:\n${context || '(nessun dato)'}\n\nDomanda: ${question}` },
  ], 800);

  return reply ?? 'Non ho trovato dati su questo. Prova a registrare qualcosa prima!';
}

// ─── Analyse: cross-category insight ──────────────────────────
export async function analyzeGalaxy(entries: import('../types').VaultEntry[]): Promise<string> {
  const context = entries.map(e =>
    `[${new Date(e.created_at).toLocaleDateString('it-IT')} · ${e.category}] ${JSON.stringify(e.data)}`
  ).join('\n');

  const reply = await aiChat_router([
    { role: 'system', content: `Sei Nebula, il compagno digitale di Alter OS. L'utente vuole capire qualcosa di sé attraverso i propri dati. Rispondi come un amico attento che ha osservato la sua vita negli ultimi giorni — non come un analista che genera un report.

Stile:
- Inizia con l'osservazione più interessante o sorprendente, espressa in modo diretto
- Usa un tono narrativo e caldo — racconta una storia, non un elenco di fatti
- Cita dati reali (cifre, date) in modo naturale nel testo, non come lista
- Se trovi una correlazione tra categorie, descrivila come se avessi appena notato qualcosa di curioso
- Se i dati sono pochi, dì cosa vedi e cosa manca per capire di più
- Rispondi in italiano, max 150 parole, tono da amico curioso` },
    { role: 'user', content: `Ultimi dati:\n${context || '(nessun dato)'}` },
  ], 1200);

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
    const snippet  = summary || ((d.extractedText as string) ?? '').slice(0, 800);
    const meta = [subject, docDate, value, tags].filter(Boolean).join(' · ');
    return `[${date} · ${label}${name ? ' · ' + name : ''}${meta ? ' | ' + meta : ''}]\n${snippet}`;
  }).join('\n\n---\n\n');

  const reply = await aiChat_router([
    { role: 'system', content: `Sei Nebula, l'assistente di Alter OS. Rispondi in italiano basandoti SOLO sui documenti forniti. Cita importi, date e nomi rilevanti. Se la domanda richiede una risposta strutturata, usala. Non inventare nulla che non sia nei documenti.` },
    { role: 'user',   content: `Documenti:\n${context}\n\nDomanda: ${question}` },
  ], 900);

  return reply ?? 'Non riesco a rispondere con i documenti disponibili.';
}

// ─── Nexus: narrative answer for open-ended correlation questions ─
export async function aiNexusNarrative(
  question: string,
  entries: import('../types').VaultEntry[]
): Promise<string> {
  const context = entries.slice(0, 60).map(e =>
    `[${new Date(e.created_at).toLocaleDateString('it-IT')} · ${e.category}] ${JSON.stringify(e.data)}`
  ).join('\n');

  const reply = await aiChat_router([
    { role: 'system', content: `Sei Nebula, il compagno digitale di Alter OS. L'utente ti fa una domanda su sé stesso — vuole capire qualcosa dei propri pattern. Rispondi come un amico attento che ha osservato la sua vita dall'esterno.

Stile:
- Inizia con l'osservazione più concreta che hai, in modo diretto
- Usa prosa narrativa, non liste — racconta quello che vedi
- Cita dati reali (date, valori) in modo naturale, non da tabella
- Se trovi una connessione tra categorie, descrivila come una scoperta curiosa
- Rispondi in italiano, 2-4 frasi, tono caldo e diretto` },
    { role: 'user', content: `Domanda: ${question}\n\nDati vault:\n${context || '(nessun dato)'}` },
  ], 1200);

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

Capacità di Alter OS (usale se l'utente fa domande sul funzionamento):
- Traccia vita in linguaggio naturale: finanze, salute, psiche, calendario, note, routine, interessi, carriera
- Carica documenti PDF: buste paga, bollette, estratti conto, fatture, referti medici, contratti, polizze, multe, F24, 730 — vengono letti e salvati nel vault
- Importa CSV/XLSX di estratti conto bancari con parsing automatico dei movimenti
- Risponde a domande sui dati salvati e sui documenti caricati
- Analisi cross-categoria e correlazioni tra salute, finanze, umore
- Input vocale disponibile (microfono)
- Comandi: "mostrami documenti", "analizza", "correlazione tra X e Y", "cancella X"

Per ogni messaggio fai DUE cose contemporaneamente:
1. RISPOSTA DA AMICO: reagisci in modo genuino a ciò che l'utente ha condiviso. Se parla di vita sua (spese, sport, umore), cita il dato specifico. Se parla di argomenti esterni (notizie, politica, opinioni, cultura), rispondi da amico curioso e coinvolgente — NON tirare in ballo i suoi dati personali quando non c'entrano nulla. Puoi usare 2-4 frasi. Non iniziare con "Certo!", "Perfetto!" da soli. MAI fare domande casuali non correlate alla vita dell'utente (es. "quale superpotere?") — se devi stimolare, chiedi qualcosa di concreto legato alla conversazione.
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

REGOLA CRITICA — ESTRAZIONE: estrai dati SOLO dal messaggio CORRENTE dell'utente. NON ri-estrarre informazioni già menzionate nei messaggi precedenti della conversazione. Se l'utente sta solo rispondendo a una domanda o continuando una conversazione senza aggiungere nuovi dati, "extractions" deve essere [].

⛔ REGOLA ASSOLUTA — ANTI-ALLUCINAZIONE: Non hai accesso al contenuto reale del vault dell'utente (transazioni, importi, nomi, note). NON inventare MAI dati specifici: niente liste di spese, niente importi, niente nomi di negozi, niente date di movimenti. Se l'utente chiede di vedere le sue spese/transazioni/dati recenti, rispondi SOLO con: 'Digita "mostrami finanze" (o la categoria) per vedere i tuoi dati reali — non ho i dettagli qui.' Non simulare, non esemplificare, non dire "per esempio".

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

export async function aiChatAndExtract(text: string, history: ChatHistoryEntry[] = []): Promise<ChatAndExtractResult> {
  const fallback = (): ChatAndExtractResult => ({ reply: 'Sono qui. Dimmi pure.', extractions: [] });
  const raw = await aiChat_router([
    { role: 'system', content: SYSTEM_COMBINED },
    ...buildHistory(history),
    { role: 'user',   content: text },
  ], 900);
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
    const json = await res.json();
    localStorage.setItem('_alter_ai_calls', String(parseInt(localStorage.getItem('_alter_ai_calls') ?? '0', 10) + 1));
    const tokIn  = (json.usage?.prompt_tokens     ?? 0) as number;
    const tokOut = (json.usage?.completion_tokens ?? 0) as number;
    localStorage.setItem('_alter_ai_tokens_in',  String(parseInt(localStorage.getItem('_alter_ai_tokens_in')  ?? '0', 10) + tokIn));
    localStorage.setItem('_alter_ai_tokens_out', String(parseInt(localStorage.getItem('_alter_ai_tokens_out') ?? '0', 10) + tokOut));
    const parsed: AiResult = JSON.parse(json.choices[0].message.content);
    return { category: parsed.category, data: parsed.data, categoryMeta: parsed.meta };
  } catch (e) {
    console.error('[aiParser]', e);
    return null;
  }
}

// ─── Chronicle generator — Codex Galattico ────────────────────
export async function generateChronicle(
  recentEntries: VaultEntry[],
  chapterNumber: number,
  username: string,
  previousChaptersText: string,
  generateIdentitySnapshot: boolean,
  chapterDate?: string
): Promise<{
  text: string;
  page1?: { title: string; text: string };
  page2?: { title: string; text: string };
  shadow_insight?: { finding: string; categories: string[]; advice: string } | null;
  chapter_type?: 'daily' | 'weekly' | 'monthly';
  insights: string[];
  energy: 'low' | 'mid' | 'high';
  stats: Record<string, unknown>;
  identity_snapshot?: Record<string, unknown>;
}> {
  const fallback = () => ({
    text: 'Stiamo raccogliendo dati sufficienti per scrivere questo capitolo. Continua a registrare la tua vita.',
    insights: [],
    energy: 'mid' as const,
    stats: {},
  });

  // Detect chapter type from date
  const date = chapterDate ? new Date(chapterDate) : new Date();
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const isMonthly = date.getDate() === lastDayOfMonth;
  const isWeekly  = !isMonthly && date.getDay() === 0; // Sunday
  const chapterType: 'daily' | 'weekly' | 'monthly' = isMonthly ? 'monthly' : isWeekly ? 'weekly' : 'daily';

  const typeLabel = chapterType === 'monthly' ? 'RIEPILOGO MENSILE'
    : chapterType === 'weekly' ? 'RIEPILOGO SETTIMANALE'
    : 'LOG GIORNALIERO';

  const p1Label = chapterType === 'monthly' ? 'Il Mese Analizzato'
    : chapterType === 'weekly' ? 'Fotografia della Settimana'
    : 'Log di Bordo';

  const p2Label = chapterType === 'monthly' ? 'Chi Stai Diventando'
    : chapterType === 'weekly' ? 'Pattern & Trend'
    : 'Analisi di Rotta';

  const scopeLabel = chapterType === 'monthly' ? 'ultimi 30 giorni'
    : chapterType === 'weekly' ? 'ultimi 7 giorni'
    : 'ultime 24-48 ore';

  // Raggruppa per categoria
  const groups: Record<string, unknown[]> = {};
  for (const e of recentEntries) {
    if (!groups[e.category]) groups[e.category] = [];
    groups[e.category].push(e.data);
  }
  const dataContext = Object.entries(groups)
    .map(([cat, items]) => `[${cat}] ${items.length} voci: ${JSON.stringify(items.slice(0, chapterType === 'daily' ? 3 : 6))}`)
    .join('\n');

  const identityBlock = generateIdentitySnapshot
    ? `\nATTENZIONE: Questo è il TRENTESIMO capitolo. Aggiungi "identity_snapshot" con:\n- "profile": 3-4 frasi su chi è ${username} basate su 30 capitoli\n- "vices": lista 2-3 debolezze/vizi emersi\n- "passions": lista 2-3 passioni/punti di forza\n- "psychological_note": 1 frase di osservazione psicologica`
    : '';

  const prevBlock = previousChaptersText
    ? `\nUltimi capitoli scritti:\n${previousChaptersText}`
    : '';

  const system = `Sei Alter, il sistema di intelligenza del Codex Galattico di ${username}. Stai scrivendo il Capitolo ${chapterNumber} — ${typeLabel}.
Lingua: italiano. Scope temporale: ${scopeLabel}.

STILE: Diario di bordo scientifico. Prima persona plurale ("abbiamo rilevato", "la rotta mostra", "i dati confermano"). Analitico e preciso sui numeri reali. Empatico senza essere sentimentale. Diretto senza essere freddo. MAI drammatizzare o usare metafore spaziali gratuite.

PAGINA I — "${p1Label}": Log fattuale. Cosa è successo. Dati reali con numeri specifici (importi, ore, ripetizioni, valori). 3-4 frasi. Tono: preciso, osservativo.

PAGINA II — "${p2Label}": Analisi. Pattern trasversali tra domini diversi. ${chapterType === 'monthly' ? 'Riflessione su tendenze del mese e su chi sta diventando questa persona.' : 'Cerca connessioni non ovvie tra categorie diverse.'} 2-3 frasi. Tono: analitico ma comprensivo.

SHADOW INSIGHT: Cerca UNA correlazione cross-dominio concreta basata sui dati reali (esempi: spesa elevata → qualità sonno peggiore → più fast food; bollette → stress → umore basso; allenamento regolare → produttività → umore migliore). Deve citare numeri o date reali dall'archivio. Se non ci sono pattern sufficienti, metti null.

Rispondi SOLO con JSON valido (no markdown):
{
  "chapter_type": "${chapterType}",
  "page1": { "title": "${p1Label}", "text": "..." },
  "page2": { "title": "${p2Label}", "text": "..." },
  "shadow_insight": { "finding": "...", "categories": ["cat1","cat2"], "advice": "..." } | null,
  "insights": ["nota breve 1", "nota breve 2"],
  "energy": "high|mid|low",
  "stats": { "categories_active": <N>, "total_entries_analyzed": <N> }${generateIdentitySnapshot ? ',\n  "identity_snapshot": { "profile": "...", "vices": [...], "passions": [...], "psychological_note": "..." }' : ''}
}${identityBlock}`;

  const raw = await aiChat_router([
    { role: 'system', content: system },
    { role: 'user', content: `Dati vault (${scopeLabel}):\n${dataContext}${prevBlock}` },
  ], 1100);

  if (!raw) return fallback();
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback();
    const parsed = JSON.parse(jsonMatch[0]);

    const page1 = parsed.page1 && typeof parsed.page1.text === 'string' ? parsed.page1 as { title: string; text: string } : undefined;
    const page2 = parsed.page2 && typeof parsed.page2.text === 'string' ? parsed.page2 as { title: string; text: string } : undefined;
    const fallbackText = page1?.text ?? (typeof parsed.text === 'string' ? parsed.text : fallback().text);

    return {
      text:             fallbackText,
      page1,
      page2,
      shadow_insight:   parsed.shadow_insight ?? null,
      chapter_type:     (['daily','weekly','monthly'] as const).includes(parsed.chapter_type) ? parsed.chapter_type : chapterType,
      insights:         Array.isArray(parsed.insights) ? parsed.insights : [],
      energy:           (['high','mid','low'] as const).includes(parsed.energy) ? parsed.energy : 'mid',
      stats:            typeof parsed.stats === 'object' && parsed.stats ? parsed.stats : {},
      identity_snapshot: parsed.identity_snapshot ?? undefined,
    };
  } catch {
    return fallback();
  }
}
