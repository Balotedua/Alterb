// ─── Semantic Vector Engine ───────────────────────────────────
// 32-dim vector: dims 0-3 finance | 4-7 health | 8-11 mental
//                12-15 time/events | 16-19 food | 20-23 social
//                24-31 category hash fingerprint

const SEMANTIC: Array<[number, string[]]> = [
  [0,  ['finanz', 'soldi', 'euro', 'spesa', 'entrat', 'stipend', 'costo',
         'prezi', 'budget', 'afford', 'finance', 'money', 'expense', 'income',
         'salary', 'cost', 'price', 'invest', 'risparm']],
  [4,  ['salut', 'peso', 'kg', 'bmi', 'sonno', 'acqua', 'palest', 'corsa',
         'sport', 'fitness', 'calori', 'dieta', 'health', 'weight', 'sleep',
         'water', 'gym', 'run', 'workout', 'train', 'step', 'attivit']],
  [8,  ['psich', 'umore', 'emozion', 'stress', 'ansia', 'sogno', 'medit',
         'mental', 'mood', 'emotion', 'anxiety', 'dream', 'feel', 'benessere',
         'terapi', 'umore', 'sentin', 'psicolog', 'pensier']],
  [12, ['calendar', 'evento', 'appuntament', 'orari', 'remind', 'meeting',
         'schedule', 'date', 'time', 'event', 'scadenz', 'promed', 'riunion']],
  [16, ['cibo', 'mangi', 'pasto', 'pizza', 'colazi', 'pranzo', 'cena',
         'nutriz', 'ricetta', 'food', 'eat', 'meal', 'nutrition', 'recipe',
         'breakfast', 'lunch', 'dinner', 'calorie', 'dieta', 'cuci']],
  [20, ['social', 'amici', 'famil', 'person', 'relaz', 'lavoro', 'uffici',
         'colleg', 'friend', 'work', 'team', 'people', 'relation', 'office',
         'partner', 'fidanz', 'genit']],
];

export function generateVec(category: string, data: Record<string, unknown>): number[] {
  const text = (category + ' ' + JSON.stringify(data)).toLowerCase();
  const vec = new Array(32).fill(0) as number[];

  for (const [base, keywords] of SEMANTIC) {
    let score = 0;
    for (const kw of keywords) if (text.includes(kw)) score += 1;
    if (score > 0) {
      const s = Math.min(score, 4) / 4;
      vec[base]     += s;
      vec[base + 1] += s * 0.65;
      vec[base + 2] += s * 0.35;
      vec[base + 3] += s * 0.15;
    }
  }

  // Category-specific hash fingerprint (dims 24-31)
  let h = 5381;
  for (const c of category) h = ((h << 5) + h) ^ c.charCodeAt(0);
  for (let i = 0; i < 8; i++) vec[24 + i] = ((h >> (i * 3)) & 0x7) / 7 * 0.35;

  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na * nb) || 1);
}
