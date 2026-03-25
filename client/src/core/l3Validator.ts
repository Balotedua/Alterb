import type { VaultEntry } from '../types';

export interface ValidationAlert {
  message: string;
  severity: 'warning' | 'info';
}

/**
 * L3 Validator — confronta il nuovo dato con lo storico del vault.
 * Ritorna null se tutto è nella norma, o un alert se trova anomalie.
 * Zero latenza extra: usa history già fetchata.
 */
export function validateEntry(
  category: string,
  data: Record<string, unknown>,
  history: VaultEntry[]
): ValidationAlert | null {
  if (category === 'finance') return validateFinance(data, history);
  if (category === 'health')  return validateHealth(data, history);
  return null;
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function validateFinance(
  data: Record<string, unknown>,
  history: VaultEntry[]
): ValidationAlert | null {
  const newAmount = data.amount as number | undefined;
  if (!newAmount || newAmount <= 0) return null;

  const type  = data.type as string | undefined;
  const label = ((data.label as string) ?? '').toLowerCase();

  const sameType = history
    .map(e => e.data as Record<string, unknown>)
    .filter(d => d.type === type);

  if (sameType.length < 3) return null;

  // Cerca prima per label simile (stesso merchant/voce)
  const labeled = label.length > 3
    ? sameType.filter(d => {
        const l = ((d.label as string) ?? '').toLowerCase();
        return l.length > 3 &&
          (l.startsWith(label.slice(0, 4)) || label.startsWith(l.slice(0, 4)));
      })
    : [];

  const sample = (labeled.length >= 3 ? labeled : sameType)
    .slice(0, 20)
    .map(d => d.amount as number)
    .filter(n => typeof n === 'number' && n > 0);

  if (sample.length < 3) return null;

  const mean  = avg(sample);
  const ratio = newAmount / mean;

  if (ratio >= 3) {
    const pct = Math.round((ratio - 1) * 100);
    const voice = type === 'income' ? 'entrata' : 'spesa';
    return {
      severity: 'warning',
      message: `⚠️ Questa ${voice} è **${pct}% più alta** della tua media storica (€${mean.toFixed(0)}). Registrata correttamente — vuoi aggiungere una nota?`,
    };
  }
  if (ratio <= 0.1 && mean > 5) {
    return {
      severity: 'info',
      message: `ℹ️ Importo insolitamente basso rispetto alla tua media (€${mean.toFixed(0)}).`,
    };
  }
  return null;
}

function validateHealth(
  data: Record<string, unknown>,
  history: VaultEntry[]
): ValidationAlert | null {
  const type = data.type as string | undefined;
  if (!type) return null;

  if (type === 'weight') {
    const newVal = data.value as number | undefined;
    if (!newVal || newVal <= 0) return null;
    const weights = history
      .map(e => e.data as Record<string, unknown>)
      .filter(d => d.type === 'weight')
      .slice(0, 10)
      .map(d => d.value as number)
      .filter(n => typeof n === 'number' && n > 0);
    if (weights.length < 3) return null;
    const mean = avg(weights);
    const diff = Math.abs(newVal - mean);
    if (diff >= 5) {
      return {
        severity: 'warning',
        message: `⚠️ Variazione peso insolita: **${newVal}kg** vs media **${mean.toFixed(1)}kg** (Δ${diff.toFixed(1)}kg). Tutto ok?`,
      };
    }
  }

  if (type === 'sleep') {
    const newHours = data.hours as number | undefined;
    if (!newHours || newHours <= 0) return null;
    const sleeps = history
      .map(e => e.data as Record<string, unknown>)
      .filter(d => d.type === 'sleep')
      .slice(0, 14)
      .map(d => d.hours as number)
      .filter(n => typeof n === 'number' && n > 0);
    if (sleeps.length < 3) return null;
    const mean = avg(sleeps);
    const diff = newHours - mean;
    if (Math.abs(diff) >= 3) {
      const dir = diff < 0 ? 'meno' : 'più';
      return {
        severity: 'info',
        message: `ℹ️ Hai dormito **${Math.abs(diff).toFixed(1)}h ${dir}** del solito (media ${mean.toFixed(1)}h).`,
      };
    }
  }

  return null;
}
