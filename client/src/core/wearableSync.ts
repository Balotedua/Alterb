import { saveEntry } from '../vault/vaultService';

const TOKEN_KEY       = 'alter_gfit_token';
const TOKEN_EXPIRY_KEY = 'alter_gfit_expiry';
const LAST_SYNC_KEY   = 'alter_gfit_last_sync';
const SYNC_COOLDOWN   = 6 * 60 * 60 * 1000; // 6h

// ── OAuth helpers ────────────────────────────────────────────

export function isGoogleFitConnected(): boolean {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return false;
  return Date.now() < parseInt(expiry, 10);
}

export function connectGoogleFit(): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    console.error('[wearableSync] VITE_GOOGLE_CLIENT_ID non configurato');
    return;
  }
  const redirectUri = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    client_id:              clientId,
    redirect_uri:           redirectUri,
    response_type:          'token',
    scope: [
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.sleep.read',
      'https://www.googleapis.com/auth/fitness.body.read',
    ].join(' '),
    include_granted_scopes: 'true',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function disconnectGoogleFit(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
}

/**
 * Call once on app init to capture the OAuth token from the URL hash.
 * Returns true if a new token was saved.
 */
export function handleGoogleFitCallback(): boolean {
  const hash = window.location.hash;
  if (!hash.includes('access_token')) return false;
  const params     = new URLSearchParams(hash.slice(1));
  const token      = params.get('access_token');
  const expiresIn  = params.get('expires_in');
  if (!token) return false;
  localStorage.setItem(TOKEN_KEY,        token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + parseInt(expiresIn ?? '3600', 10) * 1000));
  // Clean URL so the token doesn't linger
  window.history.replaceState(null, '', window.location.pathname);
  return true;
}

// ── Fit API ──────────────────────────────────────────────────

interface FitSnapshot {
  steps?:        number;
  sleepMinutes?: number;
  weightKg?:     number;
}

async function fetchFitSnapshot(token: string): Promise<FitSnapshot> {
  const endMs   = Date.now();
  const startMs = endMs - 24 * 60 * 60 * 1000;

  const body = {
    aggregateBy: [
      { dataTypeName: 'com.google.step_count.delta' },
      { dataTypeName: 'com.google.sleep.segment'    },
      { dataTypeName: 'com.google.weight'           },
    ],
    bucketByTime: { durationMillis: endMs - startMs },
    startTimeMillis: startMs,
    endTimeMillis:   endMs,
  };

  const res = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`Google Fit ${res.status}`);

  const json: {
    bucket: Array<{
      dataset: Array<{
        dataSourceId: string;
        point: Array<{
          startTimeNanos?: string;
          endTimeNanos?:   string;
          value?: Array<{ intVal?: number; fpVal?: number }>;
        }>;
      }>;
    }>;
  } = await res.json();

  const result: FitSnapshot = {};

  for (const bucket of json.bucket ?? []) {
    for (const dataset of bucket.dataset ?? []) {
      const id     = dataset.dataSourceId ?? '';
      const points = dataset.point ?? [];

      if (id.includes('step_count')) {
        result.steps = points.reduce((s, p) => s + (p.value?.[0]?.intVal ?? 0), 0);
      } else if (id.includes('sleep')) {
        result.sleepMinutes = points.reduce((s, p) => {
          const start = parseInt(p.startTimeNanos ?? '0', 10);
          const end   = parseInt(p.endTimeNanos   ?? '0', 10);
          return s + (end - start) / 60_000_000_000;
        }, 0);
      } else if (id.includes('weight')) {
        const last = points[points.length - 1];
        if (last) result.weightKg = last.value?.[0]?.fpVal;
      }
    }
  }
  return result;
}

// ── Main sync ────────────────────────────────────────────────

/** Returns number of entries saved (0 if skipped or failed). */
export async function syncGoogleFit(userId: string): Promise<number> {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry || Date.now() > parseInt(expiry, 10)) return 0;

  const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) ?? '0', 10);
  if (Date.now() - lastSync < SYNC_COOLDOWN) return 0;

  try {
    const snap  = await fetchFitSnapshot(token);
    const today = new Date().toISOString().split('T')[0];
    let saved   = 0;

    if ((snap.steps ?? 0) > 0) {
      await saveEntry(userId, 'health', {
        type: 'activity', source: 'google_fit', date: today,
        value: snap.steps, unit: 'steps',
        label: `${snap.steps?.toLocaleString('it-IT')} passi`,
      });
      saved++;
    }

    if ((snap.sleepMinutes ?? 0) > 0) {
      const h = Math.floor((snap.sleepMinutes ?? 0) / 60);
      const m = Math.round((snap.sleepMinutes ?? 0) % 60);
      await saveEntry(userId, 'health', {
        type: 'sleep', source: 'google_fit', date: today,
        value: Math.round(snap.sleepMinutes ?? 0), unit: 'minutes',
        label: `Sonno: ${h}h ${m}min`,
      });
      saved++;
    }

    if (snap.weightKg !== undefined) {
      await saveEntry(userId, 'health', {
        type: 'weight', source: 'google_fit', date: today,
        value: snap.weightKg, unit: 'kg',
        label: `Peso: ${snap.weightKg.toFixed(1)} kg`,
      });
      saved++;
    }

    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    return saved;
  } catch (e) {
    console.error('[syncGoogleFit]', e);
    // Token expired or revoked — force reconnect
    if (String(e).includes('401')) disconnectGoogleFit();
    return 0;
  }
}
