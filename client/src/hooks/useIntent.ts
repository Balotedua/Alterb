import { useCallback } from 'react';
import { useNebulaStore, type NebulaIntent, type NebulaResponseType } from '@/store/nebulaStore';
import { chatWithSystemPrompt } from '@/services/deepseek';
import { NEBULA_SYSTEM_PROMPT } from '@/prompts/nebula';
import { parseLocalIntent } from '@/utils/localIntentParser';
import { haptics } from '@/utils/haptics';
import { env } from '@/config/env';
import { supabase } from '@/services/supabase';
import type { NebulaConfirmation, NebulaModule } from '@/types/nebula';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeepSeekResponse {
  type: NebulaResponseType;
  module: 'FINANCE' | 'HEALTH' | 'PSYCH' | 'NONE';
  fragment: string;
  params: Record<string, unknown>;
  intensity: number;
  message: string;
}

const MODULE_TO_INTENT = {
  FINANCE: 'FINANCE',
  HEALTH:  'HEALTH',
  PSYCH:   'PSYCHOLOGY',
  NONE:    'IDLE',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDeepSeekRaw(raw: string): DeepSeekResponse {
  const jsonStr = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(jsonStr) as DeepSeekResponse;
}

/**
 * Returns true if the action requires explicit user confirmation before
 * opening the fragment (i.e. irreversible bulk deletes).
 */
function needsConfirmation(fragment: string, params: Record<string, unknown>): boolean {
  return fragment === 'FinanceDelete' && params.deleteAll === true;
}

/**
 * Builds the NebulaConfirmation payload for a destructive action.
 * Only called when needsConfirmation() is true.
 */
function buildConfirmation(
  fragment: string,
  params: Record<string, unknown>,
  type: NebulaResponseType,
  intent: NebulaIntent,
  intensity: number,
): NebulaConfirmation {
  const filterType = params.filterType as string | undefined;
  const question = filterType === 'expense'
    ? 'Sei sicuro di voler eliminare tutte le uscite? L\'azione è irreversibile.'
    : filterType === 'income'
      ? 'Sei sicuro di voler eliminare tutte le entrate? L\'azione è irreversibile.'
      : 'Sei sicuro di voler eliminare tutte le transazioni? L\'azione è irreversibile.';

  return {
    question,
    confirmLabel: 'Sì, elimina tutto',
    cancelLabel: 'Annulla',
    fragment,
    params,
    responseType: type,
    intent,
    intensity,
  };
}

// ── applyResult ───────────────────────────────────────────────────────────────

type AnyResult = DeepSeekResponse | ReturnType<typeof parseLocalIntent>;

function applyResult(
  result: AnyResult,
  store: ReturnType<typeof useNebulaStore.getState>,
) {
  const type      = result.type      ?? 'TALK';
  const intensity = Math.max(0, Math.min(1, result.intensity ?? 0.5));
  const message   = result.message   ?? '';
  const fragment  = result.fragment  ?? '';
  const params    = result.params    ?? {};

  const moduleKey = (result as DeepSeekResponse).module ??
                    (result as ReturnType<typeof parseLocalIntent>).module;
  const intent    = MODULE_TO_INTENT[moduleKey] ?? 'IDLE';

  store.setIntent(intent, intensity, message);
  store.addMessage('assistant', message);

  const showFragment = (type === 'ACTION' || type === 'VISUAL' || type === 'HYBRID') && fragment !== '';

  if (showFragment && needsConfirmation(fragment, params)) {
    // Gate destructive actions behind a confirmation step
    store.setConfirmation(buildConfirmation(fragment, params, type, intent, intensity));
    store.setFragment(null, {}, 'TALK');
  } else if (showFragment) {
    store.setFragment(fragment, params, type);
    haptics.fragment();
    // Save context snapshot for pronoun resolution in next turn
    store.setLastContext({
      intent,
      module: moduleKey as NebulaModule,
      fragment,
      params,
    });
    // Track fragment opening in interaction history
    store.addInteraction({ type: 'fragment', content: fragment, module: moduleKey });
    // Log page view for traffic analytics (fire-and-forget)
    void supabase.auth.getUser().then(({ data: authData }) => {
      void supabase.from('page_views').insert({
        user_id: authData.user?.id ?? null,
        fragment_name: fragment,
        module: moduleKey ?? null,
      });
    });
  } else {
    store.setFragment(null, {}, 'TALK');
  }

  // Track AI reply
  if (message) {
    store.addInteraction({ type: 'msg_ai', content: message });
  }

  haptics.response();
  store.triggerResponseBurst();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useIntent() {
  const { setIntent, setFragment, setThinking, addMessage, chatHistory, lastContext } = useNebulaStore();

  const processInput = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      addMessage('user', trimmed);
      useNebulaStore.getState().addInteraction({ type: 'msg_user', content: trimmed });
      setThinking(true);

      try {
        // 1. Local parser — fast, keyword-based, context-aware
        const localResult = parseLocalIntent(trimmed, lastContext);
        const localHasAction = localResult.type !== 'TALK' || localResult.module !== 'NONE';

        if (localHasAction) {
          applyResult(localResult, useNebulaStore.getState());
          return;
        }

        // 2. Generic/conversational input → try DeepSeek if available
        const hasKey = !!env.VITE_DEEPSEEK_API_KEY;

        if (hasKey) {
          try {
            const history = chatHistory.slice(-8).map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));
            history.push({ role: 'user', content: trimmed });

            const { content: raw, promptTokens, completionTokens } = await chatWithSystemPrompt(NEBULA_SYSTEM_PROMPT, history);
            // Log AI usage for cost tracking (fire-and-forget)
            void (async () => {
              const { data: { session } } = await supabase.auth.getSession();
              const { error: logErr } = await supabase.from('ai_usage_logs').insert({
                user_id: session?.user?.id ?? null,
                model: 'deepseek-chat',
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
              });
              if (logErr) console.warn('[Nebula] ai_usage_logs insert failed:', logErr.message);
            })();
            const aiResult = parseDeepSeekRaw(raw);
            applyResult(aiResult, useNebulaStore.getState());
          } catch (aiErr) {
            console.warn('[Nebula] DeepSeek fallback →', aiErr);
            applyResult(localResult, useNebulaStore.getState());
          }
        } else {
          applyResult(localResult, useNebulaStore.getState());
        }
      } catch (err) {
        const fallback = 'Qualcosa è andato storto. Riprova tra poco.';
        console.error('[Nebula] Unexpected error:', err);
        setIntent('IDLE', 0.3, fallback);
        setFragment(null, {}, 'TALK');
        addMessage('assistant', fallback);
        useNebulaStore.getState().triggerResponseBurst();
      } finally {
        setThinking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatHistory, lastContext],
  );

  return { processInput };
}
