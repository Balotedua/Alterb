import { getByCategory } from '../vault/vaultService';
import type { VaultEntry, ProactiveInsight } from '../types';

// ─── Math primitives ─────────────────────────────────────────

export function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const sumY2 = ys.reduce((a, y) => a + y * y, 0);
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  return den === 0 ? 0 : num / den;
}

export function linearTrend(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 3) return { slope: 0, intercept: 0, r2: 0 };
  const indices = values.map((_, i) => i);
  const sumI = indices.reduce((a, b) => a + b, 0);
  const sumV = values.reduce((a, b) => a + b, 0);
  const sumIV = indices.reduce((a, i) => a + i * values[i], 0);
  const sumI2 = indices.reduce((a, i) => a + i * i, 0);
  const slope = (n * sumIV - sumI * sumV) / (n * sumI2 - sumI ** 2);
  const intercept = (sumV - slope * sumI) / n;
  const mean = sumV / n;
  const ssTot = values.reduce((a, v) => a + (v - mean) ** 2, 0);
  const ssRes = values.reduce((a, v, i) => a + (v - (intercept + slope * i)) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

// ─── Day bucketing (same pattern as NebulaChatInput nexus) ───

function valueKey(cat: string): string {
  if (cat === 'finance') return 'amount';
  if (cat === 'psychology') return 'score';
  return 'value';
}

function dayBucket(entries: VaultEntry[], key: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    const day = e.created_at.slice(0, 10);
    const val = (e.data[key] as number) ?? 0;
    m.set(day, (m.get(day) ?? 0) + val);
  }
  return m;
}

// ─── Correlation pair ─────────────────────────────────────────

export interface CorrelationPair {
  catA: string;
  catB: string;
  r: number;
  n: number;
  direction: 'positive' | 'negative' | 'none';
  strength: 'strong' | 'moderate' | 'weak';
  labelA: string;
  labelB: string;
  iconA: string;
  iconB: string;
}

const PREDEFINED_PAIRS: Array<[string, string]> = [
  ['health', 'finance'],
  ['psychology', 'health'],
  ['psychology', 'finance'],
  ['finance', 'psychology'],
  ['health', 'routine'],
];

const CAT_LABELS: Record<string, { label: string; icon: string }> = {
  health:     { label: 'Salute',     icon: '🏃' },
  finance:    { label: 'Finanza',    icon: '💰' },
  psychology: { label: 'Umore',      icon: '🧠' },
  routine:    { label: 'Routine',    icon: '🔁' },
};

export async function computePredefinedPairs(userId: string): Promise<CorrelationPair[]> {
  const results: CorrelationPair[] = [];

  // Fetch all needed categories once
  const cats = [...new Set(PREDEFINED_PAIRS.flat())];
  const entriesMap = new Map<string, VaultEntry[]>();
  await Promise.all(cats.map(async (cat) => {
    const entries = await getByCategory(userId, cat, 90);
    entriesMap.set(cat, entries);
  }));

  for (const [a, b] of PREDEFINED_PAIRS) {
    const entriesA = entriesMap.get(a) ?? [];
    const entriesB = entriesMap.get(b) ?? [];
    if (entriesA.length < 5 || entriesB.length < 5) continue;

    const mapA = dayBucket(entriesA, valueKey(a));
    const mapB = dayBucket(entriesB, valueKey(b));
    const days = [...mapA.keys()].filter(d => mapB.has(d)).sort();
    if (days.length < 7) continue;

    const xs = days.map(d => mapA.get(d)!);
    const ys = days.map(d => mapB.get(d)!);
    const r = pearsonR(xs, ys);

    const metaA = CAT_LABELS[a] ?? { label: a, icon: '⭐' };
    const metaB = CAT_LABELS[b] ?? { label: b, icon: '⭐' };

    results.push({
      catA: a, catB: b, r, n: days.length,
      direction: r > 0.1 ? 'positive' : r < -0.1 ? 'negative' : 'none',
      strength: Math.abs(r) >= 0.5 ? 'strong' : Math.abs(r) >= 0.25 ? 'moderate' : 'weak',
      labelA: metaA.label, labelB: metaB.label,
      iconA: metaA.icon, iconB: metaB.icon,
    });
  }

  return results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

// ─── Insight text (template, no AI) ──────────────────────────

export function generateInsightText(pair: CorrelationPair): string {
  const rAbs = Math.abs(pair.r).toFixed(2);
  const nStr = `${pair.n} giorni`;
  if (pair.r > 0.5) {
    return `Quando ${pair.labelA} è alto, anche ${pair.labelB} tende ad aumentare (r=${rAbs}, ${nStr}).`;
  }
  if (pair.r < -0.5) {
    return `Quando ${pair.labelA} scende, ${pair.labelB} tende a salire — correlazione inversa (${rAbs}, ${nStr}).`;
  }
  if (pair.r > 0.25) {
    return `${pair.labelA} e ${pair.labelB} mostrano una debole tendenza comune (r=${rAbs}, ${nStr}).`;
  }
  if (pair.r < -0.25) {
    return `${pair.labelA} e ${pair.labelB} si muovono in direzioni opposte (r=${rAbs}, ${nStr}).`;
  }
  return `Nessuna correlazione significativa tra ${pair.labelA} e ${pair.labelB} (${nStr}).`;
}

// ─── Projection insight ───────────────────────────────────────

export function buildProjectionInsight(
  category: string,
  entries: VaultEntry[],
  daysAhead = 14
): string | null {
  if (entries.length < 7) return null;
  const key = valueKey(category);
  const values = entries
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(e => (e.data[key] as number) ?? 0)
    .filter(v => v > 0);
  if (values.length < 7) return null;

  const { slope, intercept, r2 } = linearTrend(values);
  if (r2 < 0.50) return null;

  const projected = intercept + slope * (values.length + daysAhead);
  const current = values[values.length - 1];
  const diff = projected - current;
  if (Math.abs(diff) < 1) return null;

  const catLabel = CAT_LABELS[category]?.label ?? category;
  if (diff > 0) {
    return `Al ritmo attuale, tra ${daysAhead} giorni il tuo ${catLabel} sarà +${diff.toFixed(0)} rispetto a oggi.`;
  } else {
    return `Al ritmo attuale, tra ${daysAhead} giorni il tuo ${catLabel} sarà ${diff.toFixed(0)} rispetto a oggi.`;
  }
}

// ─── Proactive insights entry point ──────────────────────────

const INSIGHT_SCAN_KEY = 'alter_last_insight_scan';
const INSIGHT_SCAN_COOLDOWN = 6 * 60 * 60 * 1000; // 6h

export async function computeProactiveInsights(userId: string): Promise<ProactiveInsight[]> {
  const last = localStorage.getItem(INSIGHT_SCAN_KEY);
  if (last && Date.now() - parseInt(last, 10) < INSIGHT_SCAN_COOLDOWN) return [];

  const insights: ProactiveInsight[] = [];

  try {
    const pairs = await computePredefinedPairs(userId);
    for (const pair of pairs.slice(0, 3)) {
      if (Math.abs(pair.r) < 0.25) continue;
      insights.push({
        type: 'correlation',
        catA: pair.catA, catB: pair.catB,
        r: pair.r, n: pair.n,
        text: generateInsightText(pair),
        renderData: { iconA: pair.iconA, iconB: pair.iconB, labelA: pair.labelA, labelB: pair.labelB },
      });
    }

    // Projection for finance if available
    const { getByCategory: fetchCat } = await import('../vault/vaultService');
    const financeEntries = await fetchCat(userId, 'finance', 30);
    const proj = buildProjectionInsight('finance', financeEntries);
    if (proj) {
      insights.push({ type: 'projection', catA: 'finance', text: proj });
    }

    localStorage.setItem(INSIGHT_SCAN_KEY, Date.now().toString());
  } catch (e) {
    console.error('[correlationEngine]', e);
  }

  return insights.slice(0, 4);
}
