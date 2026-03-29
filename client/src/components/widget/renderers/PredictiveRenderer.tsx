import type { VaultEntry, ProactiveInsight } from '../../../types';

interface Props {
  entries: VaultEntry[];
  color: string;
}

export default function PredictiveRenderer({ entries, color }: Props) {
  const data = entries[0]?.data as { insights?: ProactiveInsight[]; generatedAt?: string } | undefined;
  const insights: ProactiveInsight[] = data?.insights ?? [];

  if (insights.length === 0) {
    return (
      <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 12, textAlign: 'center', padding: '24px 0', letterSpacing: '0.05em' }}>
        Non abbastanza dati per correlazioni.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data?.generatedAt && (
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
          Scansione: {new Date(data.generatedAt).toLocaleDateString('it-IT')}
        </span>
      )}
      {insights.map((ins, i) => (
        <InsightCard key={i} insight={ins} color={color} />
      ))}
    </div>
  );
}

function InsightCard({ insight, color }: { insight: ProactiveInsight; color: string }) {
  const isProjection = insight.type === 'projection';
  const borderColor = isProjection ? 'rgba(240,192,64,0.5)' : color + '80';
  const rAbs = insight.r != null ? Math.abs(insight.r) : null;

  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 10,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderLeft: `2px solid ${borderColor}`,
    }}>
      {/* Type tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: isProjection ? 'rgba(240,192,64,0.7)' : 'rgba(255,255,255,0.35)',
        }}>
          {isProjection ? '↗ Proiezione' : '≈ Correlazione'}
        </span>
        {!isProjection && insight.catA && insight.catB && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
            {(insight.renderData as { iconA?: string; iconB?: string } | undefined)?.iconA} {insight.catA} ↔ {(insight.renderData as { iconA?: string; iconB?: string } | undefined)?.iconB} {insight.catB}
          </span>
        )}
        {insight.n && (
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.18)', fontFamily: "'Space Mono', monospace" }}>
            n={insight.n}d
          </span>
        )}
      </div>

      {/* Insight text */}
      <p style={{ fontSize: 12, color: 'rgba(240,238,248,0.75)', lineHeight: 1.5, margin: 0 }}>
        {insight.text}
      </p>

      {/* Correlation bar */}
      {rAbs != null && rAbs > 0 && (
        <div style={{ marginTop: 8, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            width: `${(rAbs * 100).toFixed(0)}%`,
            height: '100%', borderRadius: 2,
            background: rAbs >= 0.5
              ? `linear-gradient(90deg, ${color}, ${color}88)`
              : 'rgba(255,255,255,0.2)',
            transition: 'width 0.6s ease',
          }} />
        </div>
      )}
    </div>
  );
}
