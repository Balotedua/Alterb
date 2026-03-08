import { env } from '@/config/env';
import { buildSystemPrompt } from '@/prompts/chatbot';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = 'deepseek-chat';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class DeepSeekError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'DeepSeekError';
  }
}

/**
 * Invia la cronologia messaggi a DeepSeek e restituisce la risposta dell'AI.
 *
 * @param history   - array di messaggi {role, content} (senza system, viene aggiunto qui)
 * @param contextBlock - dati RAG/utente opzionali da iniettare nel system prompt
 */
export async function chatWithDeepSeek(
  history: ChatMessage[],
  contextBlock?: string,
): Promise<string> {
  const apiKey = env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey) throw new DeepSeekError('VITE_DEEPSEEK_API_KEY non configurata nel .env');

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(contextBlock) },
    ...history,
  ];

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: 512,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new DeepSeekError(`DeepSeek API error ${res.status}: ${body}`, res.status);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new DeepSeekError('Risposta API non valida');
  return content.trim();
}
