import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AnimatePresence } from 'framer-motion';
import { supabase } from './config/supabase';
import { getCategorySummaries, getUpcomingEvents } from './vault/vaultService';
import { buildStar } from './components/starfield/StarfieldView';
import { runInsightEngine } from './core/insightEngine';
import { useAlterStore } from './store/alterStore';
import LoginScreen    from './components/auth/LoginScreen';
import StarfieldView  from './components/starfield/StarfieldView';
import NebulaChatInput from './components/nebula/NebulaChatInput';
import PolymorphicWidget from './components/widget/PolymorphicWidget';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [authError, setAuthError] = useState<string | null>(null);
  const { setUser, setStars, upsertStar, removeStar, addKnownCategory, setAlertEvent, activeWidget } = useAlterStore();

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
        const star = buildStar(category, count, lastEntry);
        upsertStar({ ...star, isInsight: category === 'insight' });
        if (category !== 'insight') addKnownCategory(category);
      });

      // Run insight engine (max once/24h, silently in background)
      runInsightEngine(authUser.id).then((entry) => {
        if (!entry) return;
        const insightStar = buildStar('insight', 1, entry.created_at);
        upsertStar({ ...insightStar, isInsight: true });
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
      <div style={{ position: 'fixed', inset: 0, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f0c040', boxShadow: '0 0 20px #f0c040, 0 0 50px #f0c04060' }} />
      </div>
    );
  }

  if (!authUser) return <LoginScreen initialError={authError} />;

  return (
    <>
      <StarfieldView />
      <AnimatePresence>
        {!activeWidget && <NebulaChatInput key="nebula-core" />}
      </AnimatePresence>
      <PolymorphicWidget />
    </>
  );
}
