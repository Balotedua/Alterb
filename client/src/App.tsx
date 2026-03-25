import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from './config/supabase';
import { getCategorySummaries, getUpcomingEvents, purgeExpiredDeleted } from './vault/vaultService';
import { buildStar, getCategoryMeta, starPosition } from './components/starfield/StarfieldView';
import { generateDailyGreeting } from './core/insightEngine';
import { handleGoogleFitCallback, syncGoogleFit } from './core/wearableSync';
import { useAlterStore } from './store/alterStore';
import LoginScreen from './components/auth/LoginScreen';
import StarfieldView from './components/starfield/StarfieldView';
import NebulaChatInput from './components/nebula/NebulaChatInput';
import PolymorphicWidget from './components/widget/PolymorphicWidget';
import TabBar from './components/layout/TabBar';
import ChatView from './components/chat/ChatView';
import ChatHistorySidebar from './components/chat/ChatHistorySidebar';
import DashboardView from './components/dashboard/DashboardView';
import NexusView from './components/social/NexusView';
import DataAnalyticsView from './components/dashboard/DataAnalyticsView';
import SettingsPanel from './components/settings/SettingsPanel';
import BugReportPanel from './components/panels/BugReportPanel';
import DynamicIslandTimer from './components/timer/DynamicIslandTimer';
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const { setUser, setStars, upsertStar, removeStar, addKnownCategory, setAlertEvent, alertEvent, activeWidget, viewMode, theme, activeDataCategory, setShowBugReport, setShowChatSidebar, setPendingGreeting } = useAlterStore();

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Google Fit OAuth callback ─────────────────────────────
  useEffect(() => {
    handleGoogleFitCallback(); // captures token from URL hash if present
  }, []);

  // ── Auth listener ────────────────────────────────────────
  useEffect(() => {
    // Detect Supabase error in URL hash (e.g. expired OTP link)
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.slice(1));
      const desc = params.get('error_description');
      setAuthError(desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'Link non valido o scaduto.');
      window.history.replaceState(null, '', window.location.pathname);
      setAuthUser(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      setAuthUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Sync user + load stars ────────────────────────────────
  useEffect(() => {
    if (!authUser) {
      setUser(null);
      setStars([]);
      return;
    }

    setUser({ id: authUser.id, email: authUser.email ?? '' });

    // Track last app access in user metadata (updates on every app open, not just login)
    supabase.auth.updateUser({ data: { last_app_access: new Date().toISOString() } });

    // Purge entries soft-deleted more than 7 days ago (fire-and-forget)
    purgeExpiredDeleted(authUser.id);

    // Load existing category stars
    getCategorySummaries(authUser.id).then((summaries) => {
      const now = Date.now();
      const currentStars = useAlterStore.getState().stars;

      // Cleanup: remove ephemeral stars not accessed in 15 days
      currentStars.forEach((s) => {
        if (s.ephemeral && s.lastAccessedAt) {
          const age = (now - new Date(s.lastAccessedAt).getTime()) / 86400000;
          if (age > 15) removeStar(s.id);
        }
      });

      summaries.forEach(({ category, count, lastEntry }) => {
        if (category === 'chat') return; // skip chat sessions — not a star
        const star = buildStar(category, count, lastEntry);
        upsertStar(star);
        addKnownCategory(category);
      });

      // Auto-inject chronicle (Chi Sono) as dormant planet alongside first planet
      const hasAnyData = summaries.some(s => s.category !== 'chat');
      const hasChronicle = summaries.some(s => s.category === 'chronicle');
      if (hasAnyData && !hasChronicle) {
        const pos  = starPosition('chronicle');
        const meta = getCategoryMeta('chronicle');
        upsertStar({ id: 'chronicle', label: meta.label, color: meta.color, icon: meta.icon, x: pos.x, y: pos.y, intensity: 0.15, entryCount: 0, lastEntry: null, witherFactor: 0.5 });
      }

      // Daily greeting — held silently, prepended to first nebula reply
      generateDailyGreeting(authUser.id).then((greeting) => {
        if (greeting) setPendingGreeting(greeting);
      });

      // Google Fit sync — merged into pending greeting, not a separate message
      syncGoogleFit(authUser.id).then((saved) => {
        if (saved > 0) {
          const fitNote = `Ho sincronizzato ${saved} dato${saved > 1 ? 'i' : 'o'} da Google Fit.`;
          const current = useAlterStore.getState().pendingGreeting;
          setPendingGreeting(current ? `${current} ${fitNote}` : fitNote);
        }
      });
    });
  }, [authUser, setUser, setStars, upsertStar, removeStar, addKnownCategory]);

  // ── Sentinel: scan upcoming events every 60s ─────────────
  useEffect(() => {
    if (!authUser) return;

    const scan = async () => {
      const events = await getUpcomingEvents(authUser.id);
      if (events.length > 0) {
        const e = events[0];
        setAlertEvent({
          title: (e.data.title as string) ?? (e.data.raw as string) ?? 'Evento',
          scheduledAt: (e.data.scheduled_at as string) ?? e.created_at,
        });
        // Auto-dismiss after 15s
        setTimeout(() => setAlertEvent(null), 15000);
      }
    };

    scan();
    const interval = setInterval(scan, 60000);
    return () => clearInterval(interval);
  }, [authUser, setAlertEvent]);

  // ── Realtime: update stars on new vault entries ───────────
  useEffect(() => {
    if (!authUser) return;

    const channel = supabase
      .channel('vault-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'vault',
        filter: `user_id=eq.${authUser.id}`,
      }, (payload) => {
        const { category, created_at } = payload.new as { category: string; created_at: string };
        if (category === 'chat') return; // skip chat sessions — not a star
        const existing = useAlterStore.getState().stars.find(s => s.id === category);
        const star = buildStar(category, (existing?.entryCount ?? 0) + 1, created_at);
        upsertStar({ ...star, isNew: !existing });
        addKnownCategory(category);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authUser, upsertStar, addKnownCategory]);

  // ── Loading ───────────────────────────────────────────────
  if (authUser === undefined) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#05070D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(200,168,75,0.7)', boxShadow: '0 0 12px rgba(200,168,75,0.4)' }} />
      </div>
    );
  }

  if (!authUser || isPasswordRecovery) return (
    <LoginScreen
      initialError={authError}
      initialMode={isPasswordRecovery ? 'reset' : 'login'}
      onPasswordReset={() => setIsPasswordRecovery(false)}
    />
  );

  return (
    <>
      {/* ── Chat view (default) ── */}
      <AnimatePresence>
        {viewMode === 'chat' && <ChatView />}
      </AnimatePresence>

      {/* ── Galaxy view ── */}
      <AnimatePresence>
        {viewMode === 'galaxy' && (
          <motion.div key="galaxy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <StarfieldView />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dashboard view ── */}
      <AnimatePresence>
        {viewMode === 'dashboard' && <DashboardView />}
      </AnimatePresence>

      {/* ── Nexus (social) view ── */}
      <AnimatePresence>
        {viewMode === 'nexus' && <NexusView />}
      </AnimatePresence>

      {/* ── Data Analytics overlay ── */}
      <AnimatePresence>
        {activeDataCategory && <DataAnalyticsView key="data-analytics" />}
      </AnimatePresence>

      {/* ── Input (chat only, hidden in galaxy/dashboard) ── */}
      <AnimatePresence>
        {!activeWidget && !activeDataCategory && viewMode === 'chat' && <NebulaChatInput key="nebula-core" />}
      </AnimatePresence>

      <PolymorphicWidget />
      <DynamicIslandTimer />
      <SettingsPanel />
      <ChatHistorySidebar />
      <TabBar />
      <BugReportPanel />
      <PWAInstallPrompt />

      {/* ── Ghost Action: Reminder Alert (chat + dashboard only; galaxy has its own) ── */}
      <AnimatePresence>
        {alertEvent && viewMode !== 'galaxy' && (
          <motion.div
            key="reminder-alert"
            initial={{ opacity: 0, y: -60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)',
              zIndex: 900,
              background: 'rgba(5,7,18,0.94)',
              border: '1px solid rgba(155,127,212,0.35)',
              borderRadius: 18,
              padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 0 28px rgba(155,127,212,0.18), 0 8px 32px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
              maxWidth: 360,
              cursor: 'pointer',
            }}
            onClick={() => setAlertEvent(null)}
          >
            <span style={{ fontSize: 22 }}>🔔</span>
            <div>
              <div style={{ color: '#9B7FD4', fontSize: 10, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 2 }}>Promemoria</div>
              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 500 }}>{alertEvent.title}</div>
            </div>
            <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>tocca per chiudere</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hamburger button — top-left (chat only) */}
      {viewMode === 'chat' && <button
        onClick={() => setShowChatSidebar(true)}
        title="Chat e impostazioni"
        style={{
          position: 'fixed', top: 14, left: 14,
          zIndex: 500,
          background: 'rgba(5,7,18,0.72)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'rgba(255,255,255,0.28)',
          backdropFilter: 'blur(12px)',
          transition: 'color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.18)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.28)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)';
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>}

      {/* Bug report button — top-right */}
      <button
        onClick={() => setShowBugReport(true)}
        title="Segnala bug o miglioria"
        style={{
          position: 'fixed', top: 14, right: 14,
          zIndex: 500,
          background: 'rgba(5,7,18,0.72)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'rgba(255,255,255,0.28)',
          backdropFilter: 'blur(12px)',
          transition: 'color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.color = '#C8A84B';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,168,75,0.28)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.28)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)';
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </button>
    </>
  );
}
