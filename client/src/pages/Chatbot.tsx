import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

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

const REPLIES: [RegExp, string][] = [
  [/ciao|salve|hey/i, 'Ciao! Sono Alter, il tuo assistente personale. Come posso aiutarti oggi?'],
  [/finanz|soldi|spese|budget/i, 'Vai nella sezione Finanze per tracciare entrate e uscite. Ti aiuto ad analizzare i pattern di spesa nel tempo.'],
  [/umore|mood|sento|sto/i, 'Registra il tuo umore ogni giorno nella sezione Psicologia. Con il tempo emergeranno pattern interessanti.'],
  [/sonno|dorm|riposo/i, 'Il sonno è fondamentale. Vai in Salute per loggare le ore di sonno e migliorare le tue abitudini.'],
  [/routine|abitudin|giornata/i, 'La sezione Routine ti aiuta a strutturare la giornata. Piccoli passi quotidiani fanno la differenza.'],
  [/carrie|lavoro|obiettivo|professionale/i, 'Vai nella sezione Carriera per tracciare obiettivi professionali e mappare le tue competenze.'],
  [/news|notizie|interesse/i, 'Configura i tuoi interessi nella sezione News per ricevere contenuti su misura per te.'],
  [/badge|livello|xp|punti/i, 'I badge si sbloccano usando le varie sezioni di Alter. Vai in Badge per vedere i tuoi progressi!'],
  [/consiglio|produttiv|miglior/i, 'Il mio consiglio: traccia una cosa alla volta. Inizia con il modulo che ti preme di più e costruisci l\'abitudine.'],
  [/appunt|nota|coscienza/i, 'Vai in Coscienza & Appunti per journaling, riflessioni e note personali.'],
];

function getBotReply(text: string): string {
  for (const [pattern, reply] of REPLIES) {
    if (pattern.test(text)) return reply;
  }
  return 'Sono qui per aiutarti a tracciare e migliorare la tua vita. Prova a chiedermi di finanze, umore, salute, routine o carriera.';
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function Chatbot() {
  const { user } = useAuth();
  const firstName = user?.email?.split('@')[0] ?? 'utente';

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = { id: Date.now(), from: 'user', text: trimmed, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const reply = getBotReply(trimmed);
      setTyping(false);
      setMessages((prev) => [...prev, { id: Date.now() + 1, from: 'bot', text: reply, ts: new Date() }]);
    }, 900 + Math.random() * 700);
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
