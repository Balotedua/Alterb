import { useCallback } from 'react';
import { useNebulaStore, type NebulaIntent } from '@/store/nebulaStore';
import { chatWithSystemPrompt } from '@/services/deepseek';
import { NEBULA_SYSTEM_PROMPT } from '@/prompts/nebula';

interface NebulaResponse {
  intent: NebulaIntent;
  intensity: number;
  message: string;
  data?: Record<string, unknown>;
}

export function useIntent() {
  const { setIntent, setThinking, addMessage, chatHistory } = useNebulaStore();

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

        setIntent(
          parsed.intent ?? 'IDLE',
          Math.max(0, Math.min(1, parsed.intensity ?? 0.5)),
          parsed.message ?? '',
          parsed.data ?? {},
        );
        addMessage('assistant', parsed.message ?? '');
        // Response burst — entity explodes when the answer arrives
        useNebulaStore.getState().triggerResponseBurst();
      } catch {
        setIntent('IDLE', 0.3, 'Non ho capito bene. Puoi riformulare?', {});
        addMessage('assistant', 'Non ho capito bene. Puoi riformulare?');
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
