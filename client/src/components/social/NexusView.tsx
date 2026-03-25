import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlterStore } from '../../store/alterStore';
import {
  getOrCreateProfile, updatePublicStats, searchProfiles,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  getFriends, getPendingRequests,
} from '../../social/nexusService';
import type { UserProfile, FriendWithProfile } from '../../types';
import FriendDetail from './FriendDetail';

// ─── Shared helpers ───────────────────────────────────────────
function getInitials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

function getAvatarColor(name: string): string {
  const palette = ['#f0c040', '#40e0d0', '#a78bfa', '#f87171', '#34d399', '#60a5fa', '#fb923c'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

const CAT_COLORS: Record<string, string> = {
  finance: '#34d399', health: '#60a5fa', workout: '#f87171',
  nutrition: '#fb923c', psychology: '#a78bfa', calendar: '#f0c040',
  mindfulness: '#c084fc', music: '#e879f9', travel: '#38bdf8',
};
export function getCatColor(cat: string): string {
  return CAT_COLORS[cat] ?? '#a78bfa';
}

// ─── Avatar ───────────────────────────────────────────────────
export function Avatar({ name, size }: { name: string; size: number }) {
  const color = getAvatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}22`, border: `1.5px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600, color, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────
export default function NexusView() {
  const { user, username, stars } = useAlterStore();
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pending, setPending] = useState<FriendWithProfile[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [activeFriend, setActiveFriend] = useState<{ id: string; profile: UserProfile } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    void init();
  }, [user]);

  async function init() {
    setLoading(true);
    const stats = Object.fromEntries(
      stars.map(s => [s.id, s.entryCount])
    );
    const profile = await getOrCreateProfile(user!.id, user!.email, username || undefined);
    if (profile) {
      setMyProfile(profile);
      await updatePublicStats(user!.id, stats);
    }
    const [f, p] = await Promise.all([getFriends(user!.id), getPendingRequests(user!.id)]);
    setFriends(f);
    setPending(p);
    setLoading(false);
  }

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim() || !user) {
      setSearchResults([]);
      setSearching(false);
      setSearchDone(false);
      return;
    }
    setSearching(true);
    setSearchDone(false);
    searchTimer.current = setTimeout(async () => {
      const alreadyIds = new Set(friends.map(f =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      ));
      const res = await searchProfiles(search.trim(), user.id);
      setSearchResults(res.filter(p => !alreadyIds.has(p.user_id)));
      setSearching(false);
      setSearchDone(true);
    }, 380);
  }, [search, user, friends]);

  async function handleSendRequest(targetId: string) {
    const ok = await sendFriendRequest(user!.id, targetId);
    if (ok) setSentRequests(prev => new Set([...prev, targetId]));
  }

  async function handleAccept(f: FriendWithProfile) {
    await acceptFriendRequest(f.id);
    setPending(prev => prev.filter(p => p.id !== f.id));
    setFriends(prev => [...prev, { ...f, status: 'accepted' }]);
  }

  async function handleDecline(f: FriendWithProfile) {
    await declineFriendRequest(f.id);
    setPending(prev => prev.filter(p => p.id !== f.id));
  }

  function openFriend(f: FriendWithProfile) {
    const friendId = f.requester_id === user!.id ? f.addressee_id : f.requester_id;
    setActiveFriend({ id: friendId, profile: f.profile });
  }

  // ── Friend detail ─────────────────────────────────────────
  if (activeFriend && myProfile) {
    return (
      <FriendDetail
        friendId={activeFriend.id}
        friendProfile={activeFriend.profile}
        myProfile={myProfile}
        onBack={() => setActiveFriend(null)}
      />
    );
  }

  const alreadyFriendIds = new Set(
    friends.map(f => f.requester_id === user?.id ? f.addressee_id : f.requester_id)
  );

  return (
    <motion.div
      key="nexus-list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg, #03030a)',
        overflowY: 'auto',
        paddingBottom: 70,
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ padding: '52px 20px 0' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--accent, #f0c040)', fontWeight: 600, marginBottom: 4 }}>NEXUS</div>
        <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text, #fff)', marginBottom: 4 }}>La tua rete</div>
        {myProfile && (
          <div style={{ fontSize: 12, color: 'var(--text-dim, rgba(255,255,255,0.35))', marginBottom: 24 }}>
            @{myProfile.username ?? user?.email?.split('@')[0]}
          </div>
        )}
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <div style={{ padding: '0 20px', marginBottom: 10 }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '9px 14px',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per username o email..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text, #fff)', fontSize: 14, fontFamily: 'inherit',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 18, lineHeight: 1 }}
            >×</button>
          )}
        </div>
      </div>

      {/* ── Search loading ──────────────────────────────────── */}
      <AnimatePresence>
        {searching && (
          <motion.div
            key="search-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '32px 20px',
            }}
          >
            <SearchSpinner />
            <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>
              Ricerca in corso…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── No results ──────────────────────────────────────── */}
      <AnimatePresence>
        {searchDone && !searching && searchResults.length === 0 && search.trim() && (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '32px 20px', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔭</div>
            <div style={{ color: 'var(--text, #fff)', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              Nessun utente trovato
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, lineHeight: 1.6, maxWidth: 260 }}>
              Nessuno corrisponde a <span style={{ color: 'rgba(255,255,255,0.6)' }}>"{search.trim()}"</span>.<br />
              Prova con un altro username o nome.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search results ──────────────────────────────────── */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ padding: '0 20px', marginBottom: 18 }}
          >
            {searchResults.map(p => {
              const name = p.display_name || p.username || '?';
              const isSent = sentRequests.has(p.user_id);
              const isAlready = alreadyFriendIds.has(p.user_id);
              return (
                <div key={p.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, marginBottom: 6,
                }}>
                  <Avatar name={name} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text, #fff)', fontSize: 14, fontWeight: 500 }}>{name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>@{p.username}</div>
                  </div>
                  {isAlready ? (
                    <span style={{ fontSize: 11, color: '#34d399', letterSpacing: '0.08em' }}>AMICO</span>
                  ) : isSent ? (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>INVIATO</span>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(p.user_id)}
                      style={{
                        background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.25)',
                        borderRadius: 8, padding: '5px 12px',
                        color: 'var(--accent, #f0c040)', fontSize: 12,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >+ Aggiungi</button>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pending requests ────────────────────────────────── */}
      {pending.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: 22 }}>
          <SectionLabel>RICHIESTE ({pending.length})</SectionLabel>
          {pending.map(f => {
            const name = f.profile?.display_name || f.profile?.username || 'Utente';
            return (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: 'rgba(240,192,64,0.05)',
                border: '1px solid rgba(240,192,64,0.12)',
                borderRadius: 12, marginBottom: 8,
              }}>
                <Avatar name={name} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text, #fff)', fontSize: 14, fontWeight: 500 }}>{name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>vuole aggiungerti</div>
                </div>
                <button onClick={() => handleAccept(f)} style={actionBtn('#34d399')}>✓</button>
                <button onClick={() => handleDecline(f)} style={{ ...actionBtn('#f87171'), marginLeft: 4 }}>✗</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Friends list ─────────────────────────────────────── */}
      <div style={{ padding: '0 20px' }}>
        {!loading && <SectionLabel>AMICI ({friends.length})</SectionLabel>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
            Caricamento...
          </div>
        ) : friends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ fontSize: 30, marginBottom: 12 }}>🌌</div>
            Nessun amico ancora.<br />Cerca un utente sopra per iniziare.
          </div>
        ) : (
          friends.map(f => {
            const profile = f.profile;
            const name = profile?.display_name || profile?.username || 'Utente';
            const topCats = Object.entries(profile?.public_stats ?? {})
              .sort((a, b) => b[1] - a[1]).slice(0, 6);
            return (
              <motion.div
                key={f.id}
                whileHover={{ scale: 1.01, borderColor: 'rgba(255,255,255,0.12)' }}
                onClick={() => openFriend(f)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, marginBottom: 8,
                  cursor: 'pointer', transition: 'border-color 0.2s',
                }}
              >
                <Avatar name={name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text, #fff)', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{name}</div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {topCats.map(([cat]) => (
                      <div key={cat} title={cat} style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: getCatColor(cat), opacity: 0.85,
                      }} />
                    ))}
                    {topCats.length === 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>nessun dato</span>
                    )}
                  </div>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 18 }}>›</span>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ─── Micro components ─────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function SearchSpinner() {
  return (
    <div style={{ position: 'relative', width: 36, height: 36 }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.07)',
          borderTop: '2px solid var(--accent, #f0c040)',
          position: 'absolute', inset: 0,
        }}
      />
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    background: `${color}18`, border: `1px solid ${color}40`,
    borderRadius: 8, width: 32, height: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  };
}
