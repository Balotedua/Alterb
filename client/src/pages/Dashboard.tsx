import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTransactions } from '@/hooks/useTransactions';
import './Dashboard.css';

type Mode = 'chat' | 'dashboard';

interface Message {
  id: number;
  from: 'bot' | 'user';
  text: string;
  ts: Date;
}

const BOT_RESPONSES: Record<string, string> = {
  default: 'Sono qui per aiutarti a tracciare la tua vita. Prova a chiedermi dei tuoi progressi, finanze, o umore.',
  ciao: 'Ciao! Come stai oggi? Posso aiutarti con finanze, umore, salute o altro.',
  finanze: 'Le tue finanze sono nella sezione Finanze. Puoi tracciare entrate e uscite e vedere il tuo saldo.',
  umore: 'Tieni traccia del tuo umore ogni giorno nella sezione Psicologia. I dati nel tempo ti daranno insight preziosi.',
  salute: 'Nella sezione Salute puoi loggare ore di sonno e attività fisica.',
  badge: 'I badge si sbloccano completando obiettivi. Vai nella sezione Badge per vederli tutti!',
  aiuto: 'Posso parlarti delle sezioni di Alter: Finanze, Psicologia, Salute, Coscienza e Badge. Cosa ti interessa?',
};

function getBotReply(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(BOT_RESPONSES)) {
    if (key !== 'default' && lower.includes(key)) return val;
  }
  return BOT_RESPONSES.default;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: transactions, isPending } = useTransactions();
  const [mode, setMode] = useState<Mode>(() =>
    (localStorage.getItem('alter_home_mode') as Mode) ?? 'chat'
  );

  const firstName = user?.email?.split('@')[0] ?? 'utente';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      from: 'bot',
      text: `Ciao ${firstName}! Sono Alter, il tuo assistente personale. Come posso aiutarti oggi?`,
      ts: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    localStorage.setItem('alter_home_mode', m);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: Date.now(), from: 'user', text, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const reply = getBotReply(text);
      setTyping(false);
      setMessages((prev) => [...prev, { id: Date.now(), from: 'bot', text: reply, ts: new Date() }]);
    }, 1000 + Math.random() * 800);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // stats per dashboard mode
  const balance = transactions?.reduce((tot, t) =>
    t.type === 'income' ? tot + t.amount : tot - t.amount, 0) ?? 0;
  const income = transactions?.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0;
  const expenses = transactions?.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0;
  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : '0.0';

  return (
    <div className="db-root">

      {/* toggle in alto a destra */}
      <div className="db-toggle-wrap">
        <div className="db-toggle">
          <button
            className={`db-toggle__btn ${mode === 'chat' ? 'db-toggle__btn--active' : ''}`}
            onClick={() => switchMode('chat')}
            type="button"
          >
            <span className="db-toggle__icon">✦</span> Chat
          </button>
          <button
            className={`db-toggle__btn ${mode === 'dashboard' ? 'db-toggle__btn--active' : ''}`}
            onClick={() => switchMode('dashboard')}
            type="button"
          >
            <span className="db-toggle__icon">▦</span> Dashboard
          </button>
          <span
            className="db-toggle__slider"
            style={{ transform: `translateX(${mode === 'chat' ? '0%' : '100%'})` }}
          />
        </div>
      </div>

      {/* ── CHAT MODE ── */}
      {mode === 'chat' && (
        <div className="db-chat">

          {/* messaggi */}
          <div className="db-chat__messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`db-msg db-msg--${msg.from}`}>
                {msg.from === 'bot' && (
                  <div className="db-msg__avatar">✦</div>
                )}
                <div className="db-msg__bubble">
                  <p className="db-msg__text">{msg.text}</p>
                  <span className="db-msg__time">{formatTime(msg.ts)}</span>
                </div>
              </div>
            ))}

            {typing && (
              <div className="db-msg db-msg--bot">
                <div className="db-msg__avatar">✦</div>
                <div className="db-msg__bubble db-msg__bubble--typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div className="db-chat__input-wrap">
            <div className="db-chat__input-row">
              <input
                ref={inputRef}
                className="db-chat__input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Scrivi un messaggio..."
                autoComplete="off"
              />
              <button
                className="db-chat__send"
                onClick={sendMessage}
                disabled={!input.trim() || typing}
                type="button"
                aria-label="Invia"
              >
                ↑
              </button>
            </div>
            <p className="db-chat__hint">Premi Invio per inviare</p>
          </div>

        </div>
      )}

      {/* ── DASHBOARD MODE ── */}
      {mode === 'dashboard' && (
        <div className="db-dash">
          {isPending ? (
            <div className="db-dash__loading">
              <span className="db-dash__spinner" />
              Caricamento...
            </div>
          ) : (
            <>
              <div className="db-dash__header">
                <h1 className="db-dash__title">Panoramica</h1>
                <p className="db-dash__sub">Bentornato, {firstName}</p>
              </div>

              <div className="db-kpi-grid">
                <div className="db-kpi">
                  <span className="db-kpi__label">Saldo</span>
                  <span className="db-kpi__value">€ {balance.toFixed(2)}</span>
                  <span className="db-kpi__icon">💰</span>
                </div>
                <div className="db-kpi">
                  <span className="db-kpi__label">Entrate</span>
                  <span className="db-kpi__value db-kpi__value--pos">€ {income.toFixed(2)}</span>
                  <span className="db-kpi__icon">📈</span>
                </div>
                <div className="db-kpi">
                  <span className="db-kpi__label">Uscite</span>
                  <span className="db-kpi__value db-kpi__value--neg">€ {expenses.toFixed(2)}</span>
                  <span className="db-kpi__icon">📉</span>
                </div>
                <div className="db-kpi">
                  <span className="db-kpi__label">Risparmio</span>
                  <span className="db-kpi__value">{savingsRate}%</span>
                  <span className="db-kpi__icon">🎯</span>
                </div>
              </div>

              <div className="db-dash__sections">
                <div className="db-section">
                  <h3 className="db-section__title">Attività recente</h3>
                  {transactions && transactions.length > 0 ? (
                    <div className="db-tx-list">
                      {transactions.slice(0, 5).map((t) => (
                        <div key={t.id} className="db-tx">
                          <span className="db-tx__label">{t.description ?? t.category}</span>
                          <span className={`db-tx__amount ${t.type === 'income' ? 'db-tx__amount--pos' : 'db-tx__amount--neg'}`}>
                            {t.type === 'income' ? '+' : '-'}€ {t.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="db-empty">Nessuna transazione ancora. Vai in Finanze per iniziare.</p>
                  )}
                </div>

                <div className="db-section">
                  <h3 className="db-section__title">Badge sbloccati</h3>
                  <div className="db-badge-grid">
                    {transactions && transactions.length > 0 ? (
                      <>
                        <div className="db-badge" title="Prima transazione">💰</div>
                        <div className="db-badge" title="Esploratore">🗺️</div>
                        <div className="db-badge" title="Costanza">📊</div>
                      </>
                    ) : (
                      <p className="db-empty">Completa obiettivi per sbloccare badge.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
