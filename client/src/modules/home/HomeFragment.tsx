import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { NebulaCard } from '@/components/ui/nebula/NebulaCard';
import { useMonthlyStats, useVisibleTransactions } from '@/hooks/useFinance';
import { useSleepEntries, useWorkoutSessions, useWaterLog, WATER_GOAL } from '@/hooks/useHealth';
import { useEntries, useTags } from '@/hooks/useConsciousness';
import { useDailyReport, useSaveDailyReport } from '@/hooks/useDailyReport';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { chatWithSystemPrompt } from '@/services/deepseek';
import { formatCurrency } from '@/utils/formatters';
import type { MoodEntry } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'dashboard' | 'report';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const DAYS_IT_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
const MOOD_LABEL: Record<number, string> = { 1: 'Pessimo', 2: 'Basso', 3: 'Neutro', 4: 'Buono', 5: 'Eccellente' };

function getWeekDates(): string[] {
  const result: string[] = [];
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div style={{ height: 32 }} />;
  const W = 200, H = 32;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / (max - min)) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="hm-sparkline" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const els: React.ReactNode[] = [];
  let listBuf: string[] = [];

  const flushList = (key: string) => {
    if (!listBuf.length) return;
    els.push(
      <ul key={`ul-${key}`} className="hm-md-list">
        {listBuf.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        ))}
      </ul>,
    );
    listBuf = [];
  };

  lines.forEach((line, i) => {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      flushList(String(i));
      els.push(<h2 key={i} className="hm-md-h2">{line.replace(/^#{2,3}\s+/, '')}</h2>);
    } else if (line.startsWith('- ')) {
      listBuf.push(line.slice(2));
    } else if (line === '') {
      flushList(String(i));
      els.push(<div key={i} className="hm-md-spacer" />);
    } else {
      flushList(String(i));
      els.push(
        <p key={i} className="hm-md-p" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />,
      );
    }
  });
  flushList('end');
  return els;
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab() {
  const stats = useMonthlyStats();
  const { data: sleepEntries = [] } = useSleepEntries();
  const { data: workouts = [] } = useWorkoutSessions();
  const waterLog = useWaterLog();
  const { data: entries = [] } = useEntries();
  const { data: tags = [] } = useTags();
  const { user } = useAuth();

  const { data: moodEntries } = useQuery({
    queryKey: ['mood_entries', user?.id, 7],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_entries')
        .select('id, mood, note, date')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .limit(7);
      if (error) throw error;
      return data as MoodEntry[];
    },
    enabled: !!user,
  });

  // Finance: last 14 days expense sparkline
  const financeSparkline = useMemo(
    () => (stats.monthlyData ?? []).slice(-14).map((d) => d.expenses),
    [stats.monthlyData],
  );

  // Sleep
  const sleepLast7 = useMemo(() => sleepEntries.slice(0, 7).reverse(), [sleepEntries]);
  const sleepSparkline = sleepLast7.map((s) => +(s.duration_minutes / 60).toFixed(2));
  const lastSleep = sleepEntries[0];
  const avgSleepHours = sleepLast7.length
    ? (sleepLast7.reduce((s, e) => s + e.duration_minutes, 0) / sleepLast7.length / 60).toFixed(1)
    : null;

  // Workout week calendar
  const weekDates = useMemo(() => getWeekDates(), []);
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, typeof workouts>();
    workouts.forEach((w) => {
      const arr = map.get(w.date) ?? [];
      map.set(w.date, [...arr, w]);
    });
    return map;
  }, [workouts]);
  const workoutsThisWeek = weekDates.filter((d) => workoutsByDate.has(d)).length;

  // Consciousness: notes this week
  const weekStart = weekDates[0];
  const notesThisWeek = useMemo(
    () => entries.filter((e) => e.created_at >= weekStart).length,
    [entries, weekStart],
  );
  const topTags = useMemo(
    () => [...tags].sort((a, b) => b.entry_count - a.entry_count).slice(0, 4),
    [tags],
  );

  // Mood
  const lastMood = moodEntries?.[0];
  const avgMood = moodEntries?.length
    ? (moodEntries.reduce((s, e) => s + e.mood, 0) / moodEntries.length).toFixed(1)
    : null;

  const monthLabel = new Date().toLocaleString('it-IT', { month: 'long' });

  return (
    <div className="hm-dashboard">
      {/* ── Finance ────────────────────────────────────────────────────────── */}
      <div className="hm-card">
        <div className="hm-card-header">
          <span className="hm-card-icon">💰</span>
          <span className="hm-card-title">Finanze · {monthLabel}</span>
        </div>
        <div className="hm-stats">
          <div className="hm-stat">
            <span className="hm-stat-val hm-stat-val--green">{formatCurrency(stats.income)}</span>
            <span className="hm-stat-label">Entrate</span>
          </div>
          <div className="hm-stat">
            <span className="hm-stat-val hm-stat-val--red">{formatCurrency(stats.expenses)}</span>
            <span className="hm-stat-label">Uscite</span>
          </div>
          <div className="hm-stat">
            <span className={`hm-stat-val ${stats.balance >= 0 ? 'hm-stat-val--green' : 'hm-stat-val--red'}`}>
              {stats.balance >= 0 ? '+' : ''}{formatCurrency(stats.balance)}
            </span>
            <span className="hm-stat-label">Saldo</span>
          </div>
        </div>
        <Sparkline values={financeSparkline} color="rgb(252,165,165)" />
        {stats.savingsRate !== undefined && stats.income > 0 && (
          <div className="hm-saving-rate">
            <span className="hm-stat-label">Risparmio</span>
            <span className={`hm-stat-val hm-stat-val--sm ${Number(stats.savingsRate) >= 20 ? 'hm-stat-val--green' : Number(stats.savingsRate) < 0 ? 'hm-stat-val--red' : 'hm-stat-val--amber'}`}>
              {Number(stats.savingsRate).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* ── Health ─────────────────────────────────────────────────────────── */}
      <div className="hm-card">
        <div className="hm-card-header">
          <span className="hm-card-icon">💪</span>
          <span className="hm-card-title">Salute</span>
        </div>
        {lastSleep ? (
          <div className="hm-stats">
            <div className="hm-stat">
              <span className="hm-stat-val">{(lastSleep.duration_minutes / 60).toFixed(1)}h</span>
              <span className="hm-stat-label">Sonno</span>
            </div>
            {avgSleepHours && (
              <div className="hm-stat">
                <span className="hm-stat-val">{avgSleepHours}h</span>
                <span className="hm-stat-label">Media 7gg</span>
              </div>
            )}
            <div className="hm-stat">
              <div className="hm-quality">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={`hm-quality-dot ${i < lastSleep.quality ? 'hm-quality-dot--filled' : ''}`} />
                ))}
              </div>
              <span className="hm-stat-label">Qualità</span>
            </div>
          </div>
        ) : (
          <span className="hm-empty-hint">Nessun dato sonno</span>
        )}
        <Sparkline values={sleepSparkline} color="rgb(139,92,246)" />

        {/* Workout week dots */}
        <div className="hm-workout-week">
          {weekDates.map((d) => {
            const sessions = workoutsByDate.get(d) ?? [];
            const active = sessions.length > 0;
            const dayName = DAYS_IT_SHORT[new Date(d + 'T12:00:00').getDay()];
            return (
              <div key={d} className={`hm-workout-dot ${active ? 'hm-workout-dot--active' : ''}`} title={d}>
                <span className="hm-workout-dot-day">{dayName}</span>
                {active && <span className="hm-workout-dot-icon">⚡</span>}
              </div>
            );
          })}
          <span className="hm-stat-label" style={{ marginLeft: 4 }}>{workoutsThisWeek}/7</span>
        </div>

        {/* Water */}
        <div className="hm-water">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="hm-stat-label">💧 Acqua</span>
            <span className="hm-stat-label">{waterLog.todayGlasses}/{WATER_GOAL}</span>
          </div>
          <div className="hm-water-track">
            <div
              className="hm-water-fill"
              style={{ width: `${Math.min((waterLog.todayGlasses / WATER_GOAL) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Consciousness ──────────────────────────────────────────────────── */}
      <div className="hm-card">
        <div className="hm-card-header">
          <span className="hm-card-icon">📓</span>
          <span className="hm-card-title">Coscienza</span>
        </div>
        <div className="hm-stats">
          <div className="hm-stat">
            <span className="hm-stat-val">{notesThisWeek}</span>
            <span className="hm-stat-label">Note questa settimana</span>
          </div>
          <div className="hm-stat">
            <span className="hm-stat-val">{entries.length}</span>
            <span className="hm-stat-label">Totale pensieri</span>
          </div>
        </div>
        {topTags.length > 0 ? (
          <div className="hm-tags">
            {topTags.map((tag) => (
              <span key={tag.id} className="hm-tag">#{tag.tag_name}</span>
            ))}
          </div>
        ) : (
          <span className="hm-empty-hint">Nessuna nota ancora</span>
        )}
      </div>

      {/* ── Mood ───────────────────────────────────────────────────────────── */}
      <div className="hm-card">
        <div className="hm-card-header">
          <span className="hm-card-icon">🧠</span>
          <span className="hm-card-title">Umore</span>
        </div>
        {lastMood ? (
          <div className="hm-mood">
            <span className="hm-mood-emoji">{MOOD_EMOJI[lastMood.mood]}</span>
            <div className="hm-mood-info">
              <span className="hm-mood-label">{MOOD_LABEL[lastMood.mood]}</span>
              {avgMood && <span className="hm-stat-label">Media 7gg: {avgMood}/5</span>}
              {lastMood.note && <span className="hm-mood-note">"{lastMood.note}"</span>}
            </div>
          </div>
        ) : (
          <span className="hm-empty-hint">Nessun dato umore</span>
        )}
      </div>
    </div>
  );
}

// ─── Report Tab ───────────────────────────────────────────────────────────────

function ReportTab() {
  const { data: report, isLoading } = useDailyReport(TODAY);
  const saveReport = useSaveDailyReport();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const txs = useVisibleTransactions();
  const { data: sleepEntries = [] } = useSleepEntries();
  const { data: workouts = [] } = useWorkoutSessions();
  const { data: entries = [] } = useEntries();
  const { user } = useAuth();

  const { data: moodEntries } = useQuery({
    queryKey: ['mood_entries', user?.id, 7],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_entries')
        .select('id, mood, note, date')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .limit(7);
      if (error) throw error;
      return data as MoodEntry[];
    },
    enabled: !!user,
  });

  const alreadyGenerated = !!report;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const yesterday = getYesterday();
      const recentTxs = txs.filter((t) => t.date === yesterday || t.date === TODAY);
      const lastSleep = sleepEntries[0] ?? null;
      const recentWorkouts = workouts.filter((w) => w.date === yesterday || w.date === TODAY);
      const recentEntries = entries.filter((e) => e.created_at.slice(0, 10) >= yesterday);
      const lastMood = moodEntries?.[0] ?? null;

      const payload = {
        data_riferimento: yesterday,
        finanze: recentTxs.length > 0
          ? recentTxs.map((t) => ({ importo: t.amount, tipo: t.type, descrizione: t.description, categoria: t.category }))
          : null,
        sonno: lastSleep
          ? { ore: (lastSleep.duration_minutes / 60).toFixed(1), qualita: `${lastSleep.quality}/5` }
          : null,
        allenamenti: recentWorkouts.length > 0
          ? recentWorkouts.map((w) => ({ muscoli: w.muscles, rpe: w.rpe, durata_min: w.duration_m }))
          : null,
        note_coscienza: recentEntries.length > 0
          ? recentEntries.map((e) => ({
              testo: (e as { clean_text?: string; raw_text: string }).clean_text || (e as { raw_text: string }).raw_text,
              tag: (e.tags as { tag_name: string }[]).map((t) => t.tag_name),
            }))
          : null,
        umore: lastMood ? { voto: lastMood.mood, nota: lastMood.note } : null,
      };

      const systemPrompt = `Sei un life coach AI italiano. Analizza i dati giornalieri dell'utente e scrivi un report motivante in markdown.

Usa ESATTAMENTE queste 4 sezioni con le emoji:
## 💰 Finanze
## 💪 Salute
## 🧠 Coscienza
## ✨ Outlook

Regole:
- Ogni sezione: 2-3 frasi dirette, concrete, incisive
- Se una sezione ha dati null, scrivi una frase secca es. "Nessuna transazione registrata ieri."
- Non inventare mai dati non presenti nel JSON
- Concludi Outlook con un insight globale sulla giornata
- Max 350 parole totali, italiano, nessun testo fuori dalle 4 sezioni`;

      const result = await chatWithSystemPrompt(
        systemPrompt,
        [{ role: 'user', content: `Dati di ieri (${yesterday}):\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`` }],
        700,
      );
      await saveReport.mutateAsync({ content: result.content, reportDate: TODAY });
    } catch {
      setError('Errore nella generazione. Verifica la chiave DeepSeek e riprova.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="hm-report">
      <div className="hm-report-header">
        <div className="hm-report-info">
          <span className="hm-report-title">Report Giornaliero</span>
          {report && (
            <span className="hm-report-date">
              Generato il {new Date(report.created_at).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button className="hm-report-gen-btn" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <span className="ci-void-spinner"><span /><span /><span /></span>
          ) : alreadyGenerated ? (
            '↺ Rigenera'
          ) : (
            '✦ Genera Report'
          )}
        </button>
      </div>

      {!alreadyGenerated && !generating && (
        <span className="hm-once-hint">1 report al giorno · analizza la giornata di ieri</span>
      )}

      {error && <div className="hm-report-error">{error}</div>}

      {isLoading ? (
        <div className="ci-empty">Caricamento…</div>
      ) : report ? (
        <div className="hm-report-body">{renderMarkdown(report.content)}</div>
      ) : (
        <div className="hm-report-empty">
          <div className="hm-report-empty-icon">📋</div>
          <p>Nessun report ancora.</p>
          <p>Genera un'analisi AI della tua giornata di ieri.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Fragment ────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'report',    label: 'Report',    icon: '◎' },
];

export function HomeFragment({ params }: { params: Record<string, unknown> }) {
  const initialTab = (params.tab as TabId) ?? 'dashboard';
  const [tab, setTab] = useState<TabId>(initialTab);

  return (
    <NebulaCard title="Home · Panoramica" variant="default" closable>
      <div className="hm-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={['hm-tab', tab === t.id ? 'hm-tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setTab(t.id)}
          >
            <span className="hm-tab-icon">{t.icon}</span>
            <span className="hm-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="hm-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          >
            {tab === 'dashboard' && <DashboardTab />}
            {tab === 'report'    && <ReportTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </NebulaCard>
  );
}
