import { chatWithSystemPrompt } from '@/services/deepseek';
import type { Entry } from '@/types/index';

// ─── Tagging ──────────────────────────────────────────────────────────────────

const TAGGING_PROMPT = `Sei un classificatore semantico. Ricevi una nota libera e la lista dei tag esistenti dell'utente.
Applica DEDUPLICAZIONE SEMANTICA: preferisci sempre tag esistenti se equivalenti (es. "finanza" copre "soldi", "budget", "spese").
Crea nuovi tag SOLO se c'è una differenza concettuale netta.

REGOLE TAG:
- Minuscolo, senza spazi (usa trattino: "vita-sociale"), max 20 caratteri
- Max 3 tag per nota
- clean_text: testo originale ripulito (grammatica, punteggiatura), in italiano

RISPOSTA: JSON puro, zero testo aggiuntivo.
{"tags":["tag1","tag2"],"clean_text":"testo pulito"}`;

export interface TagResult {
  tags: string[];
  clean_text: string;
}

export async function tagEntry(rawText: string, existingTags: string[]): Promise<TagResult> {
  const userMsg = `TAG ESISTENTI: ${existingTags.length > 0 ? existingTags.join(', ') : '(nessuno)'}\n\nNOTA:\n"${rawText}"`;

  const result = await chatWithSystemPrompt(TAGGING_PROMPT, [{ role: 'user', content: userMsg }]);

  try {
    const json = JSON.parse(result.content.replace(/```json\n?|\n?```/g, '').trim());
    return {
      tags: Array.isArray(json.tags)
        ? json.tags.map((t: string) => t.toLowerCase().replace(/\s+/g, '-').slice(0, 20))
        : [],
      clean_text: typeof json.clean_text === 'string' ? json.clean_text : rawText,
    };
  } catch {
    return { tags: [], clean_text: rawText };
  }
}

// ─── Weekly Report ────────────────────────────────────────────────────────────

const REPORT_PROMPT = `Sei un analista della coscienza personale. Ricevi pensieri liberi dell'utente raccolti nell'ultima settimana.
Produci un report settimanale in Markdown con queste sezioni OBBLIGATORIE:

## 🌡️ Mood della Settimana
Analizza il tono emotivo prevalente. Cita frasi specifiche come prova.

## 🔄 Task & Impegni Ricorrenti
Lista puntata degli impegni menzionati. Segna ✅ se conclusi, ⏳ se aperti.

## 💡 Idee Geniali
Le 2-3 idee più interessanti. Per ognuna un breve commento sul potenziale.

## 🔗 Connessioni Inaspettate
1-2 connessioni non ovvie tra idee diverse. Formato: "Idea X del [giorno] + pensiero Y del [giorno] = progetto Z".

## 📅 Action Items per la Prossima Settimana
Lista concreta di 3-5 azioni prioritarie. Formato: - [ ] Azione

## 📊 Cluster di Pensiero
"Il X% dei tuoi pensieri questa settimana era su [tema]. [Osservazione critica o incoraggiamento]."

Scrivi in italiano, tono analitico ma empatico. Max 600 parole totali.`;

export async function generateWeeklyReport(entries: Entry[]): Promise<string> {
  const entriesText = entries
    .map((e, i) => {
      const date = new Date(e.created_at).toLocaleDateString('it-IT', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      const tagStr = e.tags?.map((t) => `#${(t as { tag_name: string }).tag_name}`).join(' ') ?? '';
      return `[${i + 1}] ${date} ${tagStr}\n"${e.clean_text || e.raw_text}"`;
    })
    .join('\n\n');

  const userMsg = `PENSIERI DELLA SETTIMANA (${entries.length} note):\n\n${entriesText}`;

  const result = await chatWithSystemPrompt(
    REPORT_PROMPT,
    [{ role: 'user', content: userMsg }],
    1200,
  );

  return result.content;
}
