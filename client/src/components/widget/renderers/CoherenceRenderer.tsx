import type { VaultEntry } from '../../../types';
import type { CoherenceReport, CoherenceFinding } from '../../../core/insightEngine';

const SEV_COLOR: Record<CoherenceFinding['severity'], string> = {
  high:   '#f08080',
  medium: '#f0c040',
  low:    '#40e0d0',
};

function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? '#40e0d0' : score >= 45 ? '#f0c040' : '#f08080';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
          style={{ filter: `drop-shadow(0 0 6px ${color}60)`, transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="44" y="48" textAnchor="middle" fill={color} fontSize="20" fontWeight="600" fontFamily="'Space Mono', monospace">
          {score}
        </text>
      </svg>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {score >= 70 ? 'Coerente' : score >= 45 ? 'In tensione' : 'Conflitto'}
      </span>
    </div>
  );
}

function FindingCard({ f }: { f: CoherenceFinding }) {
  const clr = SEV_COLOR[f.severity] ?? '#a78bfa';
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.022)',
      borderLeft: `2px solid ${clr}55`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: clr, flexShrink: 0, boxShadow: `0 0 6px ${clr}80` }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(240,238,248,0.85)', flex: 1 }}>{f.title}</span>
        {f.categories.slice(0, 2).map(c => (
          <span key={c} style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            #{c}
          </span>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 12, color: 'rgba(176,188,212,0.9)', lineHeight: 1.65, fontWeight: 300 }}>
        {f.contradiction}
      </p>

      {f.dataPoints.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {f.dataPoints.map((dp, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: clr, opacity: 0.6, fontSize: 10, flexShrink: 0, marginTop: 1 }}>◆</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{dp}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 2,
        padding: '7px 10px',
        borderRadius: 8,
        background: `${clr}0d`,
        border: `1px solid ${clr}20`,
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
        lineHeight: 1.55,
      }}>
        <span style={{ color: clr, fontWeight: 600, marginRight: 4 }}>→</span>
        {f.advice}
      </div>
    </div>
  );
}

export default function CoherenceRenderer({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const report = entries[0]?.data as unknown as CoherenceReport | undefined;
  if (!report?.findings) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
        Nessun dato sufficiente per l'audit.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '4px 0 8px' }}>
        <ScoreRing score={report.score} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 9, color, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.7 }}>
            Chi sei diventato
          </span>
          <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(200,210,234,0.75)', lineHeight: 1.65, fontWeight: 300, fontStyle: 'italic' }}>
            "{report.summary}"
          </p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 -2px' }} />

      {/* Findings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {report.findings.length} osservazion{report.findings.length === 1 ? 'e' : 'i'}
        </span>
        {report.findings.map((f, i) => (
          <FindingCard key={i} f={f} />
        ))}
      </div>

      {/* Footer note */}
      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.18)', textAlign: 'center', paddingTop: 4, letterSpacing: '0.04em' }}>
        Basato sugli ultimi 90 giorni · aggiornato ora
      </div>
    </div>
  );
}
