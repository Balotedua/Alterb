import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import { supabase } from '../../config/supabase';
import {
  getMessages, sendMessage,
  getChallenges, createChallenge, updateChallengeProgress, completeChallenge,
} from '../../social/nexusService';
import type { UserProfile, FriendMessage, Challenge } from '../../types';
import { Avatar, getCatColor } from './NexusView';

type Tab = 'chat' | 'sfide' | 'confronto';

interface Props {
  friendId: string;
  friendProfile: UserProfile;
  myProfile: UserProfile;
  onBack: () => void;
}

export default function FriendDetail({ friendId, friendProfile, myProfile, onBack }: Props) {
  const { user } = useAlterStore();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [newCh, setNewCh] = useState({ title: '', category: '', targetValue: '', unit: '', endDate: '' });
  const [loadingData, setLoadingData] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const friendName = friendProfile.display_name || friendProfile.username || 'Amico';
  const myName = myProfile.display_name || myProfile.username || 'Tu';

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user, friendId]);

  async function loadData() {
    setLoadingData(true);
    const [msgs, challs] = await Promise.all([
      getMessages(user!.id, friendId),
      getChallenges(user!.id, friendId),
    ]);
    setMessages(msgs);
    setChallenges(challs);
    setLoadingData(false);
  }

  // ── Realtime: new messages ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channelKey = `dm-${[user.id, friendId].sort().join('-')}`;
    const channel = supabase
      .channel(channelKey)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_messages' }, (payload) => {
        const msg = payload.new as FriendMessage;
        const relevant =
          (msg.sender_id === user.id && msg.recipient_id === friendId) ||
          (msg.sender_id === friendId && msg.recipient_id === user.id);
        if (relevant) setMessages(prev => [...prev, msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, friendId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = msgInput.trim();
    if (!text || !user) return;
    setMsgInput('');
    await sendMessage(user.id, friendId, text);
  }

  async function handleCreateChallenge() {
    if (!newCh.title.trim() || !user) return;
    const ch = await createChallenge(
      user.id, friendId,
      newCh.title.trim(),
      newCh.category.trim() || 'generale',
      newCh.targetValue ? parseFloat(newCh.targetValue) : null,
      newCh.unit.trim() || null,
      newCh.endDate || null,
    );
    if (ch) {
      setChallenges(prev => [ch, ...prev]);
      setNewCh({ title: '', category: '', targetValue: '', unit: '', endDate: '' });
      setShowNewChallenge(false);
    }
  }

  async function handleUpdateProgress(ch: Challenge, newVal: number) {
    if (!user || isNaN(newVal)) return;
    const isCreator = ch.creator_id === user.id;
    const ok = await updateChallengeProgress(ch.id, isCreator, newVal);
    if (ok) {
      setChallenges(prev => prev.map(c => {
        if (c.id !== ch.id) return c;
        return isCreator ? { ...c, creator_progress: newVal } : { ...c, target_progress: newVal };
      }));
    }
  }

  async function handleComplete(ch: Challenge) {
    await completeChallenge(ch.id);
    setChallenges(prev => prev.map(c => c.id === ch.id ? { ...c, status: 'completed' } : c));
  }

  // ── Confronto data ────────────────────────────────────────
  const myStats = myProfile.public_stats ?? {};
  const theirStats = friendProfile.public_stats ?? {};
  const allCats = Array.from(new Set([...Object.keys(myStats), ...Object.keys(theirStats)]));
  const compRows = allCats
    .map(cat => ({ cat, me: myStats[cat] ?? 0, them: theirStats[cat] ?? 0 }))
    .filter(r => r.me > 0 || r.them > 0)
    .sort((a, b) => (b.me + b.them) - (a.me + a.them));

  const activeCount = challenges.filter(c => c.status === 'active').length;

  return (
    <motion.div
      key="friend-detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.22 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg, #03030a)',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 60,
      }}
    >
      {/* ── Friend header ───────────────────────────────────── */}
      <div style={{
        padding: '48px 20px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', fontSize: 13,
            padding: 0, marginBottom: 14, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Indietro
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <Avatar name={friendName} size={50} />
          <div>
            <div style={{ color: 'var(--text, #fff)', fontSize: 19, fontWeight: 500 }}>{friendName}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>@{friendProfile.username ?? '—'}</div>
          </div>
        </div>

        {/* Category orbs */}
        {Object.keys(friendProfile.public_stats ?? {}).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(friendProfile.public_stats ?? {})
              .sort((a, b) => b[1] - a[1]).slice(0, 8)
              .map(([cat, count]) => (
                <div key={cat} style={{
                  padding: '3px 9px',
                  background: `${getCatColor(cat)}14`,
                  border: `1px solid ${getCatColor(cat)}35`,
                  borderRadius: 6, fontSize: 11,
                  color: getCatColor(cat), letterSpacing: '0.05em',
                }}>
                  {cat} · {count}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {(['chat', 'sfide', 'confronto'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '13px 0', position: 'relative',
              color: activeTab === tab ? 'var(--text, #fff)' : 'rgba(255,255,255,0.28)',
              fontSize: 11, letterSpacing: '0.1em', fontWeight: 500,
              fontFamily: 'inherit', textTransform: 'uppercase',
              transition: 'color 0.2s',
            }}
          >
            {tab === 'sfide' && activeCount > 0 && (
              <span style={{
                position: 'absolute', top: 9, right: '28%',
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--accent, #f0c040)',
              }} />
            )}
            {tab.toUpperCase()}
            {activeTab === tab && (
              <div style={{
                position: 'absolute', bottom: 0, left: '18%', right: '18%',
                height: 1.5, background: 'var(--accent, #f0c040)',
                borderRadius: 1,
              }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ════ CHAT tab ════ */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div
              ref={chatScrollRef}
              style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}
            >
              {loadingData ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                  Caricamento...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.8 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
                  Nessun messaggio.<br />Di' qualcosa a {friendName}!
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === user?.id;
                  const timeStr = new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={msg.id} style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 10,
                    }}>
                      <div style={{
                        maxWidth: '74%', padding: '9px 14px',
                        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isMe ? 'rgba(240,192,64,0.12)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${isMe ? 'rgba(240,192,64,0.22)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                        <div style={{ color: 'var(--text, #fff)', fontSize: 14, lineHeight: 1.5 }}>{msg.text}</div>
                        <div style={{
                          color: 'rgba(255,255,255,0.22)', fontSize: 10,
                          marginTop: 5, textAlign: isMe ? 'right' : 'left',
                        }}>{timeStr}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div style={{
              padding: '10px 14px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: 10, alignItems: 'center',
              background: 'rgba(5,5,8,0.9)', flexShrink: 0,
            }}>
              <input
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                placeholder={`Scrivi a ${friendName}...`}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 10, padding: '9px 13px',
                  color: 'var(--text, #fff)', fontSize: 14,
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!msgInput.trim()}
                style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: msgInput.trim() ? 'rgba(240,192,64,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${msgInput.trim() ? 'rgba(240,192,64,0.28)' : 'rgba(255,255,255,0.07)'}`,
                  color: msgInput.trim() ? 'var(--accent, #f0c040)' : 'rgba(255,255,255,0.18)',
                  cursor: msgInput.trim() ? 'pointer' : 'default',
                  fontSize: 17, transition: 'all 0.2s',
                }}
              >→</button>
            </div>
          </div>
        )}

        {/* ════ SFIDE tab ════ */}
        {activeTab === 'sfide' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
            {/* New challenge toggle */}
            <button
              onClick={() => setShowNewChallenge(v => !v)}
              style={{
                width: '100%', padding: '11px',
                background: showNewChallenge ? 'rgba(255,255,255,0.04)' : 'rgba(240,192,64,0.07)',
                border: `1px solid ${showNewChallenge ? 'rgba(255,255,255,0.08)' : 'rgba(240,192,64,0.2)'}`,
                borderRadius: 12, cursor: 'pointer',
                color: showNewChallenge ? 'rgba(255,255,255,0.4)' : 'var(--accent, #f0c040)',
                fontSize: 13, fontFamily: 'inherit', marginBottom: 14,
                transition: 'all 0.2s',
              }}
            >
              {showNewChallenge ? '✕ Annulla' : '⚔ Nuova sfida con ' + friendName}
            </button>

            {/* New challenge form */}
            <AnimatePresence>
              {showNewChallenge && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: 16,
                    marginBottom: 16, overflow: 'hidden',
                  }}
                >
                  <ChInput label="Titolo *" value={newCh.title} onChange={v => setNewCh(p => ({ ...p, title: v }))} placeholder="Chi fa più sessioni di workout?" />
                  <ChInput label="Categoria" value={newCh.category} onChange={v => setNewCh(p => ({ ...p, category: v }))} placeholder="workout, finance, nutrition..." />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <ChInput label="Obiettivo" value={newCh.targetValue} onChange={v => setNewCh(p => ({ ...p, targetValue: v }))} placeholder="30" type="number" />
                    <ChInput label="Unità" value={newCh.unit} onChange={v => setNewCh(p => ({ ...p, unit: v }))} placeholder="sessioni, km..." />
                  </div>
                  <ChInput label="Scadenza" value={newCh.endDate} onChange={v => setNewCh(p => ({ ...p, endDate: v }))} placeholder="" type="date" />
                  <button
                    onClick={() => void handleCreateChallenge()}
                    disabled={!newCh.title.trim()}
                    style={{
                      width: '100%', padding: '10px', marginTop: 4,
                      background: newCh.title.trim() ? 'rgba(240,192,64,0.14)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${newCh.title.trim() ? 'rgba(240,192,64,0.28)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 10,
                      color: newCh.title.trim() ? 'var(--accent, #f0c040)' : 'rgba(255,255,255,0.2)',
                      cursor: newCh.title.trim() ? 'pointer' : 'default',
                      fontSize: 13, fontFamily: 'inherit',
                    }}
                  >Lancia la sfida</button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Challenge list */}
            {challenges.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>⚔️</div>
                Nessuna sfida ancora.<br />Sfida {friendName}!
              </div>
            ) : challenges.map(ch => {
              const isCreator = ch.creator_id === user?.id;
              const myProgress = isCreator ? ch.creator_progress : ch.target_progress;
              const theirProgress = isCreator ? ch.target_progress : ch.creator_progress;
              const max = ch.target_value ?? Math.max(myProgress, theirProgress, 1);
              const isActive = ch.status === 'active';

              return (
                <div key={ch.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                  borderRadius: 14, padding: 14, marginBottom: 12,
                  opacity: isActive ? 1 : 0.55,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ color: 'var(--text, #fff)', fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{ch.title}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, letterSpacing: '0.08em', color: getCatColor(ch.category) }}>{ch.category.toUpperCase()}</span>
                        {ch.end_date && (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                            → {new Date(ch.end_date).toLocaleDateString('it-IT')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, letterSpacing: '0.08em', padding: '3px 8px',
                      borderRadius: 6,
                      background: isActive ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.06)',
                      color: isActive ? '#34d399' : 'rgba(255,255,255,0.35)',
                      border: `1px solid ${isActive ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                      {ch.status === 'active' ? 'ATTIVA' : ch.status === 'completed' ? 'CONCLUSA' : 'RIFIUTATA'}
                    </span>
                  </div>

                  <ProgBar label={myName} value={myProgress} max={max} unit={ch.unit} color="var(--accent, #f0c040)" />
                  <ProgBar label={friendName} value={theirProgress} max={max} unit={ch.unit} color="#60a5fa" />

                  {/* Update progress input */}
                  {isActive && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                      <input
                        key={ch.id}
                        type="number"
                        defaultValue={myProgress}
                        onBlur={e => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) void handleUpdateProgress(ch, val);
                        }}
                        style={{
                          width: 72, background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8, padding: '6px 10px',
                          color: 'var(--text, #fff)', fontSize: 13,
                          fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flex: 1 }}>
                        {ch.unit ?? ''} (mio progresso)
                      </span>
                      {isCreator && (
                        <button
                          onClick={() => void handleComplete(ch)}
                          style={{
                            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                            borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                            color: '#34d399', fontSize: 11, fontFamily: 'inherit',
                          }}
                        >Chiudi ✓</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ════ CONFRONTO tab ════ */}
        {activeTab === 'confronto' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
            {/* Info box */}
            <div style={{
              marginBottom: 20,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              {/* Title row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14 }}>📊</span>
                <span style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                  COME FUNZIONA IL CONFRONTO
                </span>
              </div>
              {/* Rows */}
              {[
                { icon: '🔢', text: 'Il numero mostrato per ogni categoria è il totale di entry che tu e il tuo amico avete registrato in quella categoria.' },
                { icon: '📏', text: 'La barra colorata mostra la proporzione relativa: più è lunga la tua parte (oro), più hai registrato rispetto a lui.' },
                { icon: '🔒', text: 'Il confronto è completamente anonimo — nessun dato personale, importo o nota è mai visibile. Vengono condivisi solo i conteggi aggregati per categoria.' },
                { icon: '👁', text: 'Appaiono solo le categorie che entrambi avete reso pubbliche nelle impostazioni del profilo. Categorie private restano invisibili.' },
              ].map(({ icon, text }) => (
                <div key={icon} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.65 }}>{text}</span>
                </div>
              ))}
            </div>

            {compRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>📊</div>
                {friendName} non ha ancora dati pubblici.<br />Torni quando entrambi avete usato Alter.
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div style={{ display: 'flex', padding: '0 4px', marginBottom: 14 }}>
                  <div style={{ flex: 1, fontSize: 11, letterSpacing: '0.1em', color: 'var(--accent, #f0c040)', fontWeight: 600 }}>TU</div>
                  <div style={{ width: 100, textAlign: 'center', fontSize: 11, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)' }}>CATEGORIA</div>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: 11, letterSpacing: '0.1em', color: '#60a5fa', fontWeight: 600 }}>
                    {friendName.toUpperCase().slice(0, 10)}
                  </div>
                </div>

                {compRows.map(({ cat, me, them }) => {
                  const total = me + them || 1;
                  const myPct = (me / total) * 100;
                  const iWin = me > them;
                  const tie = me === them;
                  return (
                    <div key={cat} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 5 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{
                            fontSize: 20, fontWeight: 700,
                            color: iWin ? 'var(--accent, #f0c040)' : tie ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)',
                          }}>{me}</span>
                        </div>
                        <div style={{
                          width: 100, textAlign: 'center',
                          fontSize: 11, color: getCatColor(cat),
                          letterSpacing: '0.07em',
                        }}>
                          {cat}
                          {tie && <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>—</span>}
                        </div>
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <span style={{
                            fontSize: 20, fontWeight: 700,
                            color: !iWin && !tie ? '#60a5fa' : 'rgba(255,255,255,0.25)',
                          }}>{them}</span>
                        </div>
                      </div>
                      {/* Split progress bar */}
                      <div style={{ display: 'flex', height: 4, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.07)' }}>
                        <div style={{ width: `${myPct}%`, background: 'rgba(240,192,64,0.7)', transition: 'width 0.6s ease' }} />
                        <div style={{ flex: 1, background: 'rgba(96,165,250,0.4)' }} />
                      </div>
                    </div>
                  );
                })}

                {/* Summary card */}
                <SummaryCard rows={compRows} myName={myName} friendName={friendName} />
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sub-components ───────────────────────────────────────────
function ChInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; type?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '8px 12px',
          color: 'var(--text, #fff)', fontSize: 13,
          fontFamily: 'inherit', outline: 'none',
        }}
      />
    </div>
  );
}

function ProgBar({ label, value, max, unit, color }: {
  label: string; value: number; max: number; unit: string | null; color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{value}{unit ? ` ${unit}` : ''}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function SummaryCard({ rows, myName, friendName }: {
  rows: { cat: string; me: number; them: number }[];
  myName: string;
  friendName: string;
}) {
  const myWins = rows.filter(r => r.me > r.them).length;
  const theirWins = rows.filter(r => r.them > r.me).length;
  const ties = rows.filter(r => r.me === r.them).length;
  const topMyCat = rows.filter(r => r.me > r.them).sort((a, b) => (b.me - b.them) - (a.me - a.them))[0];
  const topTheirCat = rows.filter(r => r.them > r.me).sort((a, b) => (b.them - b.me) - (a.them - a.me))[0];
  const total = myWins + theirWins + ties;

  return (
    <div style={{
      marginTop: 24, padding: '14px 16px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>RIEPILOGO</div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <Stat label="Le tue vittorie" value={myWins} color="var(--accent, #f0c040)" />
        <Stat label={`Vittorie ${friendName.slice(0, 8)}`} value={theirWins} color="#60a5fa" />
        {ties > 0 && <Stat label="Pari" value={ties} color="rgba(255,255,255,0.3)" />}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8 }}>
        {myWins > theirWins
          ? <span><span style={{ color: 'var(--accent, #f0c040)' }}>{myName}</span> vince in {myWins}/{total} categorie.</span>
          : myWins < theirWins
            ? <span><span style={{ color: '#60a5fa' }}>{friendName}</span> vince in {theirWins}/{total} categorie.</span>
            : <span>Siete perfettamente in pari! ({total} categorie)</span>
        }
        {topMyCat && <><br />La tua punta di forza: <span style={{ color: getCatColor(topMyCat.cat) }}>{topMyCat.cat}</span> ({topMyCat.me} vs {topMyCat.them}).</>}
        {topTheirCat && <><br />Quella di {friendName}: <span style={{ color: getCatColor(topTheirCat.cat) }}>{topTheirCat.cat}</span> ({topTheirCat.them} vs {topTheirCat.me}).</>}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
    </div>
  );
}
