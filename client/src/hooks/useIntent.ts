import { useCallback } from 'react';
import { useNebulaStore, type NebulaResponseType } from '@/store/nebulaStore';
import { chatWithSystemPrompt } from '@/services/deepseek';
import { NEBULA_SYSTEM_PROMPT } from '@/prompts/nebula';
import { parseLocalIntent } from '@/utils/localIntentParser';
import { haptics } from '@/utils/haptics';
import { env } from '@/config/env';

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

function parseDeepSeekRaw(raw: string): DeepSeekResponse {
  const jsonStr = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(jsonStr) as DeepSeekResponse;
}

function applyResult(
  result: DeepSeekResponse | ReturnType<typeof parseLocalIntent>,
  setIntent: ReturnType<typeof useNebulaStore>['setIntent'],
  setFragment: ReturnType<typeof useNebulaStore>['setFragment'],
  addMessage: ReturnType<typeof useNebulaStore>['addMessage'],
) {
  const type      = result.type      ?? 'TALK';
  const intensity = Math.max(0, Math.min(1, result.intensity ?? 0.5));
  const message   = result.message   ?? '';
  const fragment  = result.fragment  ?? '';
  const params    = result.params    ?? {};

  const moduleKey = (result as DeepSeekResponse).module ?? (result as ReturnType<typeof parseLocalIntent>).module;
  const intent    = MODULE_TO_INTENT[moduleKey] ?? 'IDLE';

  setIntent(intent, intensity, message);

  // ACTION, VISUAL e HYBRID aprono tutti il fragment
  const showFragment = (type === 'ACTION' || type === 'VISUAL' || type === 'HYBRID') && fragment !== '';
  setFragment(showFragment ? fragment : null, params, type);

  if (showFragment) haptics.fragment();

  addMessage('assistant', message);
  haptics.response();
  useNebulaStore.getState().triggerResponseBurst();
}

export function useIntent() {
  const { setIntent, setFragment, setThinking, addMessage, chatHistory } = useNebulaStore();

  const processInput = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      addMessage('user', trimmed);
      setThinking(true);

      try {
        // 1. Parser locale prima — veloce e affidabile per tutti gli intent di azione
        const localResult = parseLocalIntent(trimmed);
        const localHasAction = localResult.type !== 'TALK' || localResult.module !== 'NONE';

        if (localHasAction) {
          // Il parser locale ha riconosciuto un intent concreto → usalo direttamente
          applyResult(localResult, setIntent, setFragment, addMessage);
          return;
        }

        // 2. Input generico/conversazionale → usa DeepSeek se disponibile
        const hasKey = !!env.VITE_DEEPSEEK_API_KEY;

        if (hasKey) {
          try {
            const history = chatHistory.slice(-8).map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));
            history.push({ role: 'user', content: trimmed });

            const raw = await chatWithSystemPrompt(NEBULA_SYSTEM_PROMPT, history);
            const aiResult = parseDeepSeekRaw(raw);
            applyResult(aiResult, setIntent, setFragment, addMessage);
          } catch (aiErr) {
            console.warn('[Nebula] DeepSeek fallback →', aiErr);
            applyResult(localResult, setIntent, setFragment, addMessage);
          }
        } else {
          applyResult(localResult, setIntent, setFragment, addMessage);
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
    [chatHistory],
  );

  return { processInput };
}
