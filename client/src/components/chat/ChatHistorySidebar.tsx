import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, MessageSquare, Settings, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { useAlterStore } from '../../store/alterStore';
import { getChatSessions, deleteEntry, updateChatSession } from '../../vault/vaultService';
import type { VaultEntry, ChatMessage } from '../../types';

interface Group { label: string; items: VaultEntry[] }

function groupByDate(sessions: VaultEntry[]): Group[] {
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo   = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Group[] = [
    { label: 'Oggi',            items: [] },
    { label: 'Ieri',            items: [] },
    { label: 'Questa settimana', items: [] },
    { label: 'Precedenti',      items: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.created_at); d.setHours(0, 0, 0, 0);
    if      (d >= today)     groups[0].items.push(s);
    else if (d >= yesterday) groups[1].items.push(s);
    else if (d >= weekAgo)   groups[2].items.push(s);
    else                     groups[3].items.push(s);
  }

  return groups.filter(g => g.items.length > 0);
}

export default function ChatHistorySidebar() {
  const {
    user, showChatSidebar, setShowChatSidebar,
    currentSessionId, setCurrentSessionId,
    setMessages, setShowSettings,
  } = useAlterStore();

  const [sessions,    setSessions]   = useState<VaultEntry[]>([]);
  const [loading,     setLoading]    = useState(false);
  const [deletingId,  setDeletingId] = useState<string | null>(null);
  const [menuOpenId,  setMenuOpenId] = useState<string | null>(null);
  const [renamingId,  setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showChatSidebar || !user) return;
    setLoading(true);
    getChatSessions(user.id).then(data => {
      setSessions(data);
      setLoading(false);
    });
  }, [showChatSidebar, user]);

  const loadSession = useCallback((session: VaultEntry) => {
    const msgs = (session.data.messages as ChatMessage[]) ?? [];
    setMessages(msgs);
    setCurrentSessionId(session.id);
    setShowChatSidebar(false);
  }, [setMessages, setCurrentSessionId, setShowChatSidebar]);

  const deleteSession = useCallback(async (id: string) => {
    setMenuOpenId(null);
    setDeletingId(id);
    const ok = await deleteEntry(id);
    if (ok) {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (id === currentSessionId) {
        setMessages([]);
        setCurrentSessionId(null);
      }
    }
    setDeletingId(null);
  }, [currentSessionId, setMessages, setCurrentSessionId]);

  const startRename = useCallback((s: VaultEntry) => {
    setMenuOpenId(null);
    setRenamingId(s.id);
    setRenameValue((s.data.title as string) ?? 'Chat');
    setTimeout(() => renameInputRef.current?.select(), 50);
  }, []);

  const commitRename = useCallback(async (s: VaultEntry) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== s.data.title) {
      const msgs = (s.data.messages as { role: string; text: string; ts: number }[]) ?? [];
      await updateChatSession(s.id, trimmed, msgs);
      setSessions(prev => prev.map(x => x.id === s.id
        ? { ...x, data: { ...x.data, title: trimmed } }
        : x
      ));
    }
    setRenamingId(null);
  }, [renameValue]);

  const newChat = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowChatSidebar(false);
  }, [setMessages, setCurrentSessionId, setShowChatSidebar]);

  const groups = groupByDate(sessions);

  return (
    <AnimatePresence>
      {showChatSidebar && (
        <>
          {/* Overlay */}
          <motion.div
            key="chat-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowChatSidebar(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 510,
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
          />

          {/* Sidebar */}
          <motion.div
            key="chat-sidebar"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed', left: 0, top: 0, bottom: 0,
              width: 272, zIndex: 511,
              background: 'rgba(6,6,14,0.98)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRight: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 16px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 500,
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                Cronologia
              </span>
              <button
                onClick={() => setShowChatSidebar(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.35)', padding: 4,
                  display: 'flex', alignItems: 'center',
                  borderRadius: 6, transition: 'color 0.2s',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* New chat button */}
            <div style={{ padding: '12px 12px 8px' }}>
              <button
                onClick={newChat}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '9px 13px',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: 13, fontFamily: 'inherit', fontWeight: 300,
                  letterSpacing: '0.01em',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              >
                <Plus size={13} />
                Nuova chat
              </button>
            </div>

            {/* Sessions list */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '4px 8px 24px',
            }}>
              {loading ? (
                <div style={{
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.2)',
                  fontSize: 12, padding: '24px 0',
                }}>
                  Caricamento…
                </div>
              ) : sessions.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.2)',
                  fontSize: 12, padding: '24px 0', lineHeight: 1.7,
                }}>
                  Nessuna chat salvata
                </div>
              ) : (
                groups.map(group => (
                  <div key={group.label}>
                    <div style={{
                      fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.25)',
                      padding: '12px 8px 4px',
                    }}>
                      {group.label}
                    </div>
                    {group.items.map(s => {
                      const isActive   = s.id === currentSessionId;
                      const isDeleting = s.id === deletingId;
                      const menuOpen   = s.id === menuOpenId;
                      const isRenaming = s.id === renamingId;

                      return (
                        <div key={s.id} style={{ position: 'relative', marginBottom: 1 }}>
                          {/* Row */}
                          <button
                            onClick={() => !isRenaming && loadSession(s)}
                            style={{
                              width: '100%', textAlign: 'left',
                              display: 'flex', alignItems: 'center', gap: 9,
                              background: isActive ? 'rgba(255,255,255,0.08)' : 'none',
                              border: isActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                              borderRadius: 8, padding: '8px 30px 8px 9px',
                              cursor: isRenaming ? 'default' : 'pointer',
                              color: isActive ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.55)',
                              fontSize: 13, fontFamily: 'inherit', fontWeight: 300,
                              transition: 'all 0.15s', overflow: 'hidden',
                            }}
                            onMouseEnter={e => { if (!isActive && !isRenaming) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.08)' : 'none'; }}
                          >
                            <MessageSquare size={11} style={{ flexShrink: 0, opacity: 0.45 }} />
                            {isRenaming ? (
                              <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={() => commitRename(s)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitRename(s); }
                                  if (e.key === 'Escape') setRenamingId(null);
                                }}
                                onClick={e => e.stopPropagation()}
                                style={{
                                  flex: 1, background: 'none',
                                  border: 'none', borderBottom: '1px solid rgba(255,255,255,0.25)',
                                  color: 'rgba(255,255,255,0.85)', fontSize: 13,
                                  fontFamily: 'inherit', fontWeight: 300, outline: 'none', padding: 0,
                                }}
                              />
                            ) : (
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(s.data.title as string) ?? 'Chat'}
                              </span>
                            )}
                          </button>

                          {/* 3-dots trigger */}
                          {!isRenaming && (
                            <button
                              onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpen ? null : s.id); }}
                              disabled={isDeleting}
                              style={{
                                position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                                background: menuOpen ? 'rgba(255,255,255,0.1)' : 'none',
                                border: 'none', cursor: 'pointer',
                                color: 'rgba(255,255,255,0.4)', padding: '3px 4px',
                                display: 'flex', alignItems: 'center', borderRadius: 5,
                                transition: 'opacity 0.15s, background 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = menuOpen ? 'rgba(255,255,255,0.1)' : 'none'; }}
                            >
                              {isDeleting
                                ? <span style={{ fontSize: 9 }}>…</span>
                                : <MoreHorizontal size={13} />
                              }
                            </button>
                          )}

                          {/* Dropdown menu */}
                          <AnimatePresence>
                            {menuOpen && (
                              <>
                                {/* click-away */}
                                <div
                                  style={{ position: 'fixed', inset: 0, zIndex: 500 }}
                                  onClick={() => setMenuOpenId(null)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                                  transition={{ duration: 0.12 }}
                                  style={{
                                    position: 'absolute', right: 0, top: '100%',
                                    zIndex: 501, marginTop: 2,
                                    background: 'rgba(18,18,28,0.97)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 9, overflow: 'hidden',
                                    minWidth: 140,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                  }}
                                >
                                  <button
                                    onClick={e => { e.stopPropagation(); startRename(s); }}
                                    style={{
                                      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: 'rgba(255,255,255,0.7)', fontSize: 13,
                                      fontFamily: 'inherit', fontWeight: 300,
                                      padding: '10px 14px', transition: 'background 0.12s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                  >
                                    <Pencil size={12} style={{ opacity: 0.6 }} />
                                    Rinomina
                                  </button>
                                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                  <button
                                    onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                                    style={{
                                      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: 'rgba(255,90,90,0.85)', fontSize: 13,
                                      fontFamily: 'inherit', fontWeight: 300,
                                      padding: '10px 14px', transition: 'background 0.12s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,60,60,0.1)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                  >
                                    <Trash2 size={12} style={{ opacity: 0.7 }} />
                                    Elimina
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            {/* Settings link */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.05)',
              padding: '10px 12px',
            }}>
              <button
                onClick={() => { setShowChatSidebar(false); setShowSettings(true); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none',
                  border: '1px solid transparent',
                  borderRadius: 10, padding: '9px 13px',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 13, fontFamily: 'inherit', fontWeight: 300,
                  letterSpacing: '0.01em',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
              >
                <Settings size={13} />
                Impostazioni
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
