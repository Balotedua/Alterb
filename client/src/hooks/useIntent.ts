import { useCallback } from 'react';
import { useNebulaStore, type NebulaResponseType } from '@/store/nebulaStore';
import { chatWithSystemPrompt } from '@/services/deepseek';
import { NEBULA_SYSTEM_PROMPT } from '@/prompts/nebula';
import { parseLocalIntent } from '@/utils/localIntentParser';
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

/** Try to parse a DeepSeek raw response string into a structured result. */
function parseDeepSeekRaw(raw: string): DeepSeekResponse {
  const jsonStr = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(jsonStr) as DeepSeekResponse;
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
        let result: DeepSeekResponse | ReturnType<typeof parseLocalIntent>;

        // ── Try DeepSeek only if API key is configured ───────────────────────
        const hasKey = !!env.VITE_DEEPSEEK_API_KEY;

        if (hasKey) {
          try {
            const history = chatHistory.slice(-8).map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));
            history.push({ role: 'user', content: trimmed });

            const raw = await chatWithSystemPrompt(NEBULA_SYSTEM_PROMPT, history);
            result = parseDeepSeekRaw(raw);
          } catch (aiErr) {
            // AI failed — fall back to local parser silently
            console.warn('[Nebula] DeepSeek fallback →', aiErr);
            result = parseLocalIntent(trimmed);
          }
        } else {
          // No API key — use local parser directly
          result = parseLocalIntent(trimmed);
        }

        // ── Apply result to store ────────────────────────────────────────────
        const type      = result.type      ?? 'TALK';
        const intensity = Math.max(0, Math.min(1, result.intensity ?? 0.5));
        const message   = result.message   ?? '';
        const fragment  = result.fragment  ?? '';
        const params    = result.params    ?? {};

        const moduleKey = (result as DeepSeekResponse).module ?? (result as ReturnType<typeof parseLocalIntent>).module;
        const intent    = MODULE_TO_INTENT[moduleKey] ?? 'IDLE';

        setIntent(intent, intensity, message);

        const showFragment = (type === 'VISUAL' || type === 'HYBRID') && fragment !== '';
        setFragment(showFragment ? fragment : null, params, type);

        addMessage('assistant', message);
        useNebulaStore.getState().triggerResponseBurst();
      } catch (err) {
        // Should never reach here, but just in case
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
