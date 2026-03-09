import { useCallback } from 'react';
import { useNebulaStore, type NebulaIntent, type NebulaResponseType } from '@/store/nebulaStore';
import { chatWithSystemPrompt } from '@/services/deepseek';
import { NEBULA_SYSTEM_PROMPT } from '@/prompts/nebula';

interface NebulaResponse {
  type: NebulaResponseType;
  module: 'FINANCE' | 'HEALTH' | 'PSYCH' | 'NONE';
  fragment: string;
  params: Record<string, unknown>;
  intensity: number;
  message: string;
}

/** Maps module name to the legacy NebulaIntent (used for blob color animations) */
const MODULE_TO_INTENT: Record<string, NebulaIntent> = {
  FINANCE: 'FINANCE',
  HEALTH:  'HEALTH',
  PSYCH:   'PSYCHOLOGY',
  NONE:    'IDLE',
};

export function useIntent() {
  const { setIntent, setFragment, setThinking, addMessage, chatHistory } = useNebulaStore();

  const processInput = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      addMessage('user', trimmed);
      setThinking(true);

      try {
        const history = chatHistory.slice(-8).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        history.push({ role: 'user', content: trimmed });

        const raw = await chatWithSystemPrompt(NEBULA_SYSTEM_PROMPT, history);

        // Strip possible markdown code fences
        const jsonStr = raw
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();

        const parsed: NebulaResponse = JSON.parse(jsonStr);

        const type      = parsed.type      ?? 'TALK';
        const intensity = Math.max(0, Math.min(1, parsed.intensity ?? 0.5));
        const message   = parsed.message   ?? '';
        const fragment  = parsed.fragment  ?? '';
        const params    = parsed.params    ?? {};
        const intent    = MODULE_TO_INTENT[parsed.module] ?? 'IDLE';

        // Update blob animation intent
        setIntent(intent, intensity, message);

        // Update fragment state
        const showFragment = (type === 'VISUAL' || type === 'HYBRID') && fragment !== '';
        setFragment(showFragment ? fragment : null, params, type);

        addMessage('assistant', message);
        useNebulaStore.getState().triggerResponseBurst();
      } catch {
        const fallback = 'Non ho capito bene. Puoi riformulare?';
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
