import { saveEntry } from '../vault/vaultService';

// ─── Apple Health XML ─────────────────────────────────────────

const HK_TYPE_MAP: Record<string, { type: string; unit: string }> = {
  HKQuantityTypeIdentifierBodyMass:               { type: 'weight',     unit: 'kg' },
  HKQuantityTypeIdentifierStepCount:              { type: 'steps',      unit: 'steps' },
  HKQuantityTypeIdentifierHeartRate:              { type: 'heart_rate', unit: 'bpm' },
  HKQuantityTypeIdentifierActiveEnergyBurned:     { type: 'calories',   unit: 'kcal' },
  HKQuantityTypeIdentifierDistanceWalkingRunning: { type: 'distance',   unit: 'km' },
  HKQuantityTypeIdentifierFlightsClimbed:         { type: 'floors',     unit: 'floors' },
  HKQuantityTypeIdentifierDietaryWater:           { type: 'water',      unit: 'ml' },
  HKCategoryTypeIdentifierSleepAnalysis:          { type: 'sleep',      unit: 'h' },
  HKQuantityTypeIdentifierRestingHeartRate:       { type: 'heart_rate', unit: 'bpm' },
  HKQuantityTypeIdentifierVO2Max:                 { type: 'vo2max',     unit: 'ml/kg/min' },
};

export async function importAppleHealthXml(xmlText: string, userId: string): Promise<number> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const records = Array.from(doc.querySelectorAll('Record'));

  let count = 0;
  for (const record of records) {
    const hkType = record.getAttribute('type') ?? '';
    const mapped = HK_TYPE_MAP[hkType];
    if (!mapped) continue;

    const valueStr = record.getAttribute('value') ?? '';
    let value = parseFloat(valueStr);
    if (isNaN(value)) continue;

    // Apple Health exports weight in kg but sometimes lb — check unit attr
    const unit = record.getAttribute('unit') ?? '';
    if (mapped.type === 'weight' && unit.toLowerCase() === 'lb') value *= 0.453592;
    if (mapped.type === 'distance' && unit.toLowerCase() === 'm') value /= 1000;

    const date = record.getAttribute('startDate') ?? new Date().toISOString();

    const saved = await saveEntry(userId, 'health', {
      type: mapped.type,
      value,
      unit: mapped.unit,
      date,
      source: 'apple_health',
    });
    if (saved) count++;
  }
  return count;
}

// ─── Health Connect JSON ──────────────────────────────────────

interface HCRecord {
  type?: string;
  startTime?: string;
  time?: string;
  samples?: Array<{ beatsPerMinute?: number; time?: string }>;
  steps?: number;
  energy?: { inKilocalories?: number };
  weight?: { inKilograms?: number };
  distance?: { inMeters?: number };
  floors?: { floorsClimbed?: number };
}

export async function importHealthConnectJson(jsonText: string, userId: string): Promise<number> {
  let records: HCRecord[];
  try {
    const parsed = JSON.parse(jsonText);
    records = Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.records ?? parsed.Records ?? []);
  } catch {
    return 0;
  }

  let count = 0;
  for (const rec of records) {
    const type = rec.type ?? '';
    const date = rec.startTime ?? rec.time ?? new Date().toISOString();
    let data: Record<string, unknown> | null = null;

    if (type.includes('Steps') && rec.steps != null) {
      data = { type: 'steps', value: rec.steps, unit: 'steps', date, source: 'health_connect' };
    } else if (type.includes('Weight') && rec.weight?.inKilograms != null) {
      data = { type: 'weight', value: rec.weight.inKilograms, unit: 'kg', date, source: 'health_connect' };
    } else if (type.includes('HeartRate') && rec.samples?.length) {
      const avg = rec.samples.reduce((s, r) => s + (r.beatsPerMinute ?? 0), 0) / rec.samples.length;
      data = { type: 'heart_rate', value: Math.round(avg), unit: 'bpm', date, source: 'health_connect' };
    } else if ((type.includes('Calorie') || type.includes('Energy')) && rec.energy?.inKilocalories != null) {
      data = { type: 'calories', value: rec.energy.inKilocalories, unit: 'kcal', date, source: 'health_connect' };
    } else if (type.includes('Distance') && rec.distance?.inMeters != null) {
      data = { type: 'distance', value: +(rec.distance.inMeters / 1000).toFixed(3), unit: 'km', date, source: 'health_connect' };
    } else if (type.includes('Floors') && rec.floors?.floorsClimbed != null) {
      data = { type: 'floors', value: rec.floors.floorsClimbed, unit: 'floors', date, source: 'health_connect' };
    }

    if (data) {
      const saved = await saveEntry(userId, 'health', data);
      if (saved) count++;
    }
  }
  return count;
}
