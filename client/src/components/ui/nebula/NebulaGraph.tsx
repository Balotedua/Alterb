interface NebulaGraphProps {
  data: number[];
  color?: string;
  height?: number;
  label?: string;
}

export function NebulaGraph({ data, color = '#8b5cf6', height = 44, label }: NebulaGraphProps) {
  if (!data.length) return null;

  const W = 240;
  const H = height;
  const max = Math.max(...data, 1);
  const step = W / Math.max(data.length - 1, 1);

  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`)
    .join(' ');

  const areaPoints =
    `0,${H} ` +
    data.map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`).join(' ') +
    ` ${W},${H}`;

  return (
    <div className="nebula-graph-wrap">
      {label && <span className="nebula-graph-label">{label}</span>}
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="nebula-graph"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`ng-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={areaPoints}
          fill={`url(#ng-grad-${color.replace('#', '')})`}
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
