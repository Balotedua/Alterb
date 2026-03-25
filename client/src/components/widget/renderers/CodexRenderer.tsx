import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VaultEntry } from '../../../types';
import { useAlterStore } from '../../../store/alterStore';
import { getRecentAll, saveEntry } from '../../../vault/vaultService';
import { generateChronicle } from '../../../core/aiParser';

interface Props {
  entries: VaultEntry[];
  color: string;
}

const ENERGY: Record<string, { label: string; color: string }> = {
  high: { label: '⬆ Energia Alta',  color: '#34d399' },
  mid:  { label: '→ Stabile',        color: '#f5c842' },
  low:  { label: '⬇ Bassa Energia',  color: '#f87171' },
};

export default function CodexRenderer({ entries: initialEntries, color }: Props) {
  const { user, username } = useAlterStore();
  const [extra,        setExtra]        = useState<VaultEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dir,          setDir]          = useState(1);
  const [innerPage,    setInnerPage]    = useState(0);

  const allChapters = [...initialEntries, ...extra]
    .sort((a, b) => ((a.data.chapter as number) ?? 0) - ((b.data.chapter as number) ?? 0));

  const [idx, setIdx] = useState(() => Math.max(0, allChapters.length - 1));

  const chapter = allChapters[idx];
  const total   = allChapters.length;
  const today   = new Date().toISOString().slice(0, 10);
  const hasToday = allChapters.some(e => (e.data.date as string)?.slice(0, 10) === today);

  useEffect(() => { setInnerPage(0); }, [idx]);

  const goTo = (next: number) => {
    setDir(next > idx ? 1 : -1);
    setIdx(next);
  };

  const generate = async () => {
    if (!user || isGenerating) return;
    setIsGenerating(true);
    try {
      const recentAll   = await getRecentAll(user.id, 60);
      const num         = total + 1;
      const prevTexts   = allChapters.slice(-3).map(e => e.data.text as string).filter(Boolean).join('\n---\n');
      const result      = await generateChronicle(recentAll, num, username || 'Capitano', prevTexts, total >= 29, today);

      const data: Record<string, unknown> = {
        chapter:        num,
        date:           today,
        text:           result.text,
        page1:          result.page1,
        page2:          result.page2,
        shadow_insight: result.shadow_insight ?? null,
        chapter_type:   result.chapter_type ?? 'daily',
        insights:       result.insights,
        energy:         result.energy,
        stats:          result.stats,
        renderType:     'codex',
      };
      if (result.identity_snapshot) data.identity_snapshot = result.identity_snapshot;

      const saved = await saveEntry(user.id, 'chronicle', data);
      if (saved) {
        setExtra(e => [...e, saved]);
        setDir(1);
        setIdx(total);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Empty state ──────────────────────────────────────────────
  if (total === 0) {
    return (
      <div style={{ padding: '12px 0 8px' }}>
        <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>📖</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: 500 }}>
            Il tuo Codex Galattico è vuoto.
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 28, lineHeight: 1.7 }}>
            Alter analizzerà la tua galassia e scriverà la tua storia.<br />
            Un capitolo al giorno, per sempre.
          </div>
          <GenerateBtn color={color} loading={isGenerating} label="✦ Genera Capitolo I" onClick={generate} disabled={!user} />
        </div>
      </div>
    );
  }

  const energyCfg   = chapter ? (ENERGY[(chapter.data.energy as string) ?? 'mid'] ?? ENERGY.mid) : ENERGY.mid;
  const insights    = chapter ? ((chapter.data.insights as string[]) ?? []) : [];
  const dateStr     = chapter?.data?.date as string | undefined;
  const dateLabel   = dateStr
    ? new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const chapterNum  = chapter?.data?.chapter as number | undefined;
  const identSnap   = chapter?.data?.identity_snapshot as Record<string, unknown> | null | undefined;
  const chapterType = chapter?.data?.chapter_type as 'daily' | 'weekly' | 'monthly' | undefined;
  const page1       = chapter?.data?.page1 as { title: string; text: string } | undefined;
  const page2       = chapter?.data?.page2 as { title: string; text: string } | undefined;
  const hasPages    = !!(page1 && page2);
  const shadowInsight = chapter?.data?.shadow_insight as { finding: string; categories: string[]; advice: string } | null | undefined;
  const activePage  = hasPages ? (innerPage === 0 ? page1 : page2) : null;
  const activeText  = activePage?.text ?? (chapter?.data?.text as string);

  return (
    <div style={{ padding: '4px 0 8px' }}>
      {/* ── Chapter header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.15em', color, fontWeight: 700, textTransform: 'uppercase' }}>
            Cap. {chapterNum}
          </span>
          {chapterType === 'weekly' && (
            <span style={{ fontSize: 7, letterSpacing: '0.1em', color: '#f5c842', fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', border: '1px solid rgba(245,200,66,0.25)', borderRadius: 4 }}>
              Settimanale
            </span>
          )}
          {chapterType === 'monthly' && (
            <span style={{ fontSize: 7, letterSpacing: '0.1em', color: '#e879f9', fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', border: '1px solid rgba(232,121,249,0.25)', borderRadius: 4 }}>
              Mensile
            </span>
          )}
          <span style={{ fontSize: 9, color: energyCfg.color, letterSpacing: '0.08em' }}>
            {energyCfg.label}
          </span>
        </div>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.05em' }}>
          {dateLabel}
        </span>
      </div>

      {/* ── Inner page tabs (only for chapters with page1/page2) ── */}
      {hasPages && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {[0, 1].map(p => (
            <button
              key={p}
              onClick={() => setInnerPage(p)}
              style={{
                background:  'none',
                border:      `1px solid ${innerPage === p ? color + '70' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 6,
                color:       innerPage === p ? color : 'rgba(255,255,255,0.22)',
                fontSize:    9,
                letterSpacing: '0.09em',
                padding:     '3px 10px',
                cursor:      'pointer',
                transition:  'all 0.2s',
                textTransform: 'uppercase',
              }}
            >
              {p === 0 ? (page1?.title ?? 'Log') : (page2?.title ?? 'Analisi')}
            </button>
          ))}
        </div>
      )}

      {/* ── Animated content ── */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={`${idx}-${innerPage}`}
          custom={dir}
          initial={{ x: dir * 28, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -dir * 28, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Identity snapshot (easter egg — chapter 30) */}
          {identSnap && (
            <div style={{
              marginBottom: 16,
              padding: '12px 14px',
              background: 'linear-gradient(135deg, rgba(232,121,249,0.08), rgba(167,139,250,0.05))',
              border: '1px solid rgba(232,121,249,0.22)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 9, color: '#e879f9', letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                ✦ Identikit dell'Io · Capitolo 30
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.75, marginBottom: 8 }}>
                {identSnap.profile as string}
              </div>
              {Array.isArray(identSnap.vices) && (identSnap.vices as string[]).length > 0 && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  <span style={{ color: '#f87171' }}>▸ Debolezze:</span> {(identSnap.vices as string[]).join(' · ')}
                </div>
              )}
              {Array.isArray(identSnap.passions) && (identSnap.passions as string[]).length > 0 && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  <span style={{ color: '#34d399' }}>▸ Forze:</span> {(identSnap.passions as string[]).join(' · ')}
                </div>
              )}
              {typeof identSnap.psychological_note === 'string' && (
                <div style={{ fontSize: 10, color: 'rgba(232,121,249,0.6)', marginTop: 6, fontStyle: 'italic' }}>
                  {identSnap.psychological_note}
                </div>
              )}
            </div>
          )}

          {/* Narrative text */}
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.82)',
            lineHeight: 1.85,
            letterSpacing: '0.02em',
            marginBottom: 12,
            whiteSpace: 'pre-wrap',
          }}>
            {activeText}
          </div>

          {/* Shadow Insight — visible on page 2 (or always if no pages) */}
          {shadowInsight && (!hasPages || innerPage === 1) && (
            <div style={{
              marginBottom: 14,
              padding: '10px 12px',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.07), rgba(59,130,246,0.04))',
              border: '1px solid rgba(167,139,250,0.16)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 8, color: '#a78bfa', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                ◈ Shadow Insight
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', lineHeight: 1.65, marginBottom: shadowInsight.advice ? 7 : 0 }}>
                {shadowInsight.finding}
              </div>
              {shadowInsight.advice && (
                <div style={{ fontSize: 10, color: 'rgba(167,139,250,0.55)', fontStyle: 'italic' }}>
                  → {shadowInsight.advice}
                </div>
              )}
              {Array.isArray(shadowInsight.categories) && shadowInsight.categories.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {(shadowInsight.categories as string[]).map((cat, i) => (
                    <span key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)', padding: '1px 6px', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 }}>
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Insights — visible on page 1 or legacy chapters */}
          {insights.length > 0 && (!hasPages || innerPage === 0) && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginBottom: 8 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <span style={{ color, fontSize: 7, marginTop: 5, flexShrink: 0 }}>◆</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 1.65, letterSpacing: '0.02em' }}>
                    {ins}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <NavBtn onClick={() => goTo(idx - 1)} disabled={idx === 0}>‹</NavBtn>
        <ChapterDots total={total} current={idx} color={color} onSelect={goTo} />
        <NavBtn onClick={() => goTo(idx + 1)} disabled={idx === total - 1}>›</NavBtn>
      </div>

      {/* ── Generate today's chapter ── */}
      {!hasToday && (
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <GenerateBtn
            color={color}
            loading={isGenerating}
            label={`✦ Capitolo ${total + 1}`}
            onClick={generate}
            disabled={!user}
          />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function NavBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.35)',
        fontSize: 20, padding: '2px 10px',
        transition: 'color 0.2s',
        lineHeight: 1,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}
    >
      {children}
    </button>
  );
}

function ChapterDots({ total, current, color, onSelect }: { total: number; current: number; color: string; onSelect: (i: number) => void }) {
  const MAX_DOTS = 9;
  const half  = Math.floor(MAX_DOTS / 2);
  const start = Math.max(0, Math.min(current - half, total - MAX_DOTS));
  const end   = Math.min(total, start + MAX_DOTS);
  const visible = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {visible.map(i => (
        <div
          key={i}
          onClick={() => onSelect(i)}
          style={{
            width: i === current ? 18 : 4,
            height: 4,
            borderRadius: 2,
            background: i === current ? color : 'rgba(255,255,255,0.12)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function GenerateBtn({ color, loading, label, onClick, disabled }: { color: string; loading: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  const off = disabled || loading;
  return (
    <button
      onClick={onClick}
      disabled={off}
      style={{
        background: 'none',
        border: `1px solid ${off ? 'rgba(255,255,255,0.08)' : color + '50'}`,
        borderRadius: 8,
        color: off ? 'rgba(255,255,255,0.2)' : color,
        fontSize: 11,
        letterSpacing: '0.1em',
        padding: '8px 22px',
        cursor: off ? 'default' : 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { if (!off) (e.currentTarget as HTMLElement).style.borderColor = color; }}
      onMouseLeave={e => { if (!off) (e.currentTarget as HTMLElement).style.borderColor = color + '50'; }}
    >
      {loading ? '✦ Elaborazione...' : label}
    </button>
  );
}
