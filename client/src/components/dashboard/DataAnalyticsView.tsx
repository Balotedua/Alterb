import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAlterStore } from '../../store/alterStore';
import { getByCategory } from '../../vault/vaultService';
import { getCategoryMeta } from '../starfield/StarfieldView';
import { analyseData, localAnalyse } from '../../core/dataAnalyser';
import type { ChartSpec, AnalysisResult } from '../../core/dataAnalyser';
import type { VaultEntry } from '../../types';

// ─── Number card ─────────────────────────────────────────────
function NumberCard({ spec }: { spec: ChartSpec }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {spec.data.map((item, i) => {
        const val = Number(item.value ?? 0);
        const label = String(item.label ?? '');
        const isNegative = val < 0;
        return (
          <div key={i} style={{
            flex: '1 1 100px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '14px 16px',
          }}>
            <div style={{
              fontSize: 26,
              fontWeight: 200,
              color: isNegative ? '#f08080' : 'rgba(255,255,255,0.9)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {val > 0 && !isNegative ? '' : ''}{val.toLocaleString('it-IT')}{spec.unit ?? ''}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: '0.08em' }}>
              {label.toUpperCase()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chart renderer ───────────────────────────────────────────
const PIE_COLORS = ['#40e0d0', '#f0c040', '#a78bfa', '#f08080', '#90d8d2', '#f5c898'];

function ChartCard({ spec }: { spec: ChartSpec }) {
  const color = spec.color ?? '#40e0d0';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '16px 8px 12px',
      marginBottom: 12,
    }}>
      <div style={{ paddingLeft: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em' }}>
          {spec.title.toUpperCase()}
        </div>
        {spec.insight && (
          <div style={{ fontSize: 12, color, marginTop: 4, opacity: 0.8 }}>
            {spec.insight}
          </div>
        )}
      </div>

      {spec.type === 'number' && <NumberCard spec={spec} />}

      {spec.type === 'line' && spec.data.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={spec.data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={spec.xKey} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,10,18,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
              itemStyle={{ color }}
            />
            <Line type="monotone" dataKey={spec.yKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {spec.type === 'bar' && spec.data.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={spec.data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={spec.xKey} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,10,18,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
              itemStyle={{ color }}
            />
            <Bar dataKey={spec.yKey ?? 'value'} fill={color} radius={[3, 3, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {spec.type === 'pie' && spec.data.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={spec.data}
              dataKey={spec.valueKey ?? 'value'}
              nameKey={spec.nameKey ?? 'name'}
              cx="50%" cy="50%"
              outerRadius={70}
              stroke="none"
            >
              {spec.data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'rgba(10,10,18,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
            />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Query input ─────────────────────────────────────────────
function QueryInput({ onQuery, loading }: { onQuery: (q: string) => void; loading: boolean }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const q = value.trim();
    if (!q || loading) return;
    onQuery(q);
    setValue('');
  };

  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
      background: 'rgba(3,3,10,0.95)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 20,
        padding: '8px 14px',
      }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={loading ? 'Analisi in corso…' : 'es. burn rate, cashflow, confronta umore…'}
          disabled={loading}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 13,
            caretColor: '#40e0d0',
          }}
        />
        {loading ? (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#40e0d0', opacity: 0.6, animation: 'pulse 1s infinite' }} />
        ) : (
          <button
            onClick={submit}
            style={{ background: 'none', border: 'none', color: '#40e0d0', cursor: 'pointer', fontSize: 16, opacity: value.trim() ? 1 : 0.3 }}
          >
            ↑
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function DataAnalyticsView() {
  const { user, activeDataCategory, setActiveDataCategory, stars } = useAlterStore();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);

  const category = activeDataCategory;
  const star = stars.find(s => s.id === category);
  const meta = category ? getCategoryMeta(category) : null;

  // Load entries and initial analysis
  useEffect(() => {
    if (!user || !category) return;
    setResult(null);
    setQueryHistory([]);

    getByCategory(user.id, category, 100).then(async (data) => {
      setEntries(data);
      if (data.length === 0) {
        setResult({ charts: [], summary: 'Nessun dato ancora in questa categoria.' });
        return;
      }

      // Show local analysis immediately
      setResult(localAnalyse(data, category));

      // Enhance with AI in background if key is available
      const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
      if (apiKey) {
        setLoading(true);
        const aiResult = await analyseData(data);
        setLoading(false);
        if (aiResult) setResult(aiResult);
      }
    });
  }, [user, category]);

  const handleQuery = useCallback(async (query: string) => {
    if (!user || !category || entries.length === 0) return;
    setLoading(true);
    setQueryHistory(prev => [...prev, query]);

    // Check if query implies cross-category analysis
    const crossCategories = stars
      .filter(s => s.id !== category && s.id !== 'insight' && query.toLowerCase().includes(s.label.toLowerCase()))
      .map(s => s.id);

    let crossEntries: VaultEntry[] | undefined;
    if (crossCategories.length > 0) {
      const allCross = await Promise.all(crossCategories.map(cat => getByCategory(user.id, cat, 50)));
      crossEntries = allCross.flat();
    }

    const aiResult = await analyseData(entries, query, crossEntries);
    setLoading(false);

    if (aiResult) {
      setResult(aiResult);
    }
  }, [user, category, entries, stars]);

  if (!category) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="data-analytics"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#03030a',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setActiveDataCategory(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.45)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 6px',
            }}
          >
            ←
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: meta?.color ?? '#ffffff',
              boxShadow: `0 0 8px ${meta?.color ?? '#ffffff'}`,
            }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em' }}>
              {(meta?.label ?? category).toUpperCase()}
            </span>
            {star && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 4 }}>
                {star.entryCount} entry
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>

          {/* Loading state */}
          {loading && !result && (
            <div style={{ textAlign: 'center', marginTop: '30vh', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: meta?.color ?? '#40e0d0',
                margin: '0 auto 12px',
                animation: 'pulse 1s infinite',
              }} />
              Analisi in corso…
            </div>
          )}

          {/* Summary */}
          {result && result.summary && (
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.38)',
              lineHeight: 1.6,
              marginBottom: 16,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.025)',
              borderRadius: 8,
              borderLeft: `2px solid ${meta?.color ?? '#40e0d0'}`,
            }}>
              {result.summary}
            </div>
          )}

          {/* Query history pills */}
          {queryHistory.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {queryHistory.map((q, i) => (
                <span key={i} style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 20,
                  padding: '3px 10px',
                  letterSpacing: '0.04em',
                }}>
                  {q}
                </span>
              ))}
            </div>
          )}

          {/* Charts */}
          {result && result.charts.map((chart, i) => (
            <ChartCard key={i} spec={chart} />
          ))}

          {/* Loading overlay for subsequent queries */}
          {loading && result && (
            <div style={{
              textAlign: 'center',
              padding: '16px 0',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 11,
              letterSpacing: '0.08em',
            }}>
              ANALISI IN CORSO…
            </div>
          )}

          {/* Empty state */}
          {result && result.charts.length === 0 && (
            <div style={{
              textAlign: 'center', marginTop: '20vh',
              color: 'rgba(255,255,255,0.25)', fontSize: 13, lineHeight: 1.8,
            }}>
              Nessun grafico generabile.<br />
              <span style={{ fontSize: 11 }}>Aggiungi dati in Chat.</span>
            </div>
          )}

          {/* Spacer at bottom so last chart isn't hidden by input */}
          <div style={{ height: 16 }} />
        </div>

        {/* Query input */}
        <QueryInput onQuery={handleQuery} loading={loading} />
      </motion.div>
    </AnimatePresence>
  );
}
