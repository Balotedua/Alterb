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

export async function aiParse(text: string): Promise<Omit<ParsedIntent, 'source' | 'rawText'> | null> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!apiKey) {
    console.warn('[aiParser] No VITE_DEEPSEEK_API_KEY set — falling back to null');
    return null;
  }

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 256,
      }),
    });

    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const json = await res.json();
    const parsed: AiResult = JSON.parse(json.choices[0].message.content);

    return {
      category: parsed.category,
      data: parsed.data,
      categoryMeta: parsed.meta,
    };
  } catch (e) {
    console.error('[aiParser]', e);
    return null;
  }
}
