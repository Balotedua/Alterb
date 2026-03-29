import { supabase } from '../config/supabase';
import { saveEntry, updateEntryData } from '../vault/vaultService';

export const QUIZ_MAX_TOKENS = 10;

/** Per-week usage map: testId → attempts this week */
export interface QuizTokenState {
  usage: Record<string, number>; // e.g. { rt: 3, wm: 10, pr: 1 }
  entryId: string | null;
  weekStart: string;
  resetAt: string;
}

/** Monday at 04:00 local time of the current week. */
function getCurrentWeekStart(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(4, 0, 0, 0);
  // before Monday 04:00 → still last week
  if (now < monday) monday.setDate(monday.getDate() - 7);
  return monday;
}

export function getNextResetDate(): Date {
  const ws = getCurrentWeekStart();
  ws.setDate(ws.getDate() + 7);
  return ws;
}

/** How many times the user has started `testId` this week. */
export function getTestUsed(state: QuizTokenState, testId: string): number {
  return state.usage[testId] ?? 0;
}

/** Whether a specific test is locked for this week. */
export function isTestLocked(state: QuizTokenState | null, testId: string): boolean {
  if (!state) return false;
  return getTestUsed(state, testId) >= QUIZ_MAX_TOKENS;
}

export async function loadTokenState(userId: string): Promise<QuizTokenState> {
  const weekStart = getCurrentWeekStart().toISOString();
  const resetAt   = getNextResetDate().toISOString();

  const { data, error } = await supabase
    .from('vault')
    .select('id, data')
    .eq('user_id', userId)
    .eq('category', 'quiz_tokens')
    .eq('data->>week_start', weekStart)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { usage: {}, entryId: null, weekStart, resetAt };
  const d = data.data as Record<string, unknown>;
  const usage = (d.usage && typeof d.usage === 'object' && !Array.isArray(d.usage))
    ? (d.usage as Record<string, number>)
    : {};
  return { usage, entryId: data.id as string, weekStart, resetAt };
}

/** Increment the attempt counter for `testId` and persist. */
export async function consumeToken(
  userId: string,
  state: QuizTokenState,
  testId: string,
): Promise<QuizTokenState> {
  const newUsage = { ...state.usage, [testId]: (state.usage[testId] ?? 0) + 1 };
  const payload  = { week_start: state.weekStart, usage: newUsage, type: 'weekly_tokens' };

  if (state.entryId) {
    await updateEntryData(state.entryId, payload);
    return { ...state, usage: newUsage };
  }
  const entry = await saveEntry(userId, 'quiz_tokens', payload);
  return { ...state, usage: newUsage, entryId: entry?.id ?? null };
}
