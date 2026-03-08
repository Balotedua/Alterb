import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { chatWithDeepSeek, DeepSeekError, type ChatMessage } from '@/services/deepseek';

interface Message {
  id: number;
  from: 'bot' | 'user';
  text: string;
  ts: Date;
}

const SUGGESTIONS = [
  'Come sto andando questa settimana?',
  'Dammi un consiglio per la produttività',
  'Analizza le mie finanze',
  'Come migliorare la mia routine mattutina?',
  'Suggerisci un obiettivo di carriera',
];

function formatTime(d: Date) {
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** Converte i messaggi UI in formato API (escludendo il messaggio di benvenuto iniziale) */
function toApiHistory(messages: Message[]): ChatMessage[] {
  return messages
    .filter((m) => m.id !== 0) // skip welcome message
    .map((m) => ({
      role: m.from === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));
}

export default function Chatbot() {
  const { user } = useAuth();
  const firstName =
    (user?.user_metadata?.['name'] as string | undefined)?.trim() ||
    user?.email?.split('@')[0] ||
    'utente';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      from: 'bot',
      text: `Ciao ${firstName}! Sono Alter, il tuo assistente personale. Sono qui per aiutarti a tracciare la tua vita e raggiungere i tuoi obiettivi. Di cosa hai bisogno?`,
      ts: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    const userMsg: Message = { id: Date.now(), from: 'user', text: trimmed, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    setError(null);

    try {
      // Passa la history completa incluso il nuovo messaggio utente
      const history = toApiHistory([...messages, userMsg]);
      const reply = await chatWithDeepSeek(history);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, from: 'bot', text: reply, ts: new Date() },
      ]);
    } catch (err) {
      const msg =
        err instanceof DeepSeekError
          ? err.message
          : 'Errore di connessione. Riprova tra poco.';
      setError(msg);
      // Aggiunge un messaggio di errore inline nel chat
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          from: 'bot',
          text: `⚠️ ${msg}`,
          ts: new Date(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="chatbot-root">
      <div className="chatbot-header">
        <div className="chatbot-header__avatar">✦</div>
        <div className="chatbot-header__info">
          <span className="chatbot-header__name">Alter AI</span>
          <span className="chatbot-header__status">● Online</span>
        </div>
      </div>

      <div className="chatbot-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chatbot-msg chatbot-msg--${msg.from}`}>
            {msg.from === 'bot' && <div className="chatbot-msg__avatar">✦</div>}
            <div className="chatbot-msg__bubble">
              <p className="chatbot-msg__text">{msg.text}</p>
              <span className="chatbot-msg__time">{formatTime(msg.ts)}</span>
            </div>
          </div>
        ))}

        {typing && (
          <div className="chatbot-msg chatbot-msg--bot">
            <div className="chatbot-msg__avatar">✦</div>
            <div className="chatbot-msg__bubble chatbot-msg__bubble--typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {messages.length <= 2 && (
        <div className="chatbot-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="chatbot-suggestion"
              onClick={() => sendMessage(s)}
              type="button"
              disabled={typing}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="chatbot-error">{error}</p>}

      <div className="chatbot-input-wrap">
        <div className="chatbot-input-row">
          <input
            ref={inputRef}
            className="chatbot-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Scrivi un messaggio ad Alter..."
            autoComplete="off"
            disabled={typing}
          />
          <button
            className="chatbot-send"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || typing}
            type="button"
            aria-label="Invia"
          >
            ↑
          </button>
        </div>
        <p className="chatbot-hint">Premi Invio per inviare</p>
      </div>
    </div>
  );
}
