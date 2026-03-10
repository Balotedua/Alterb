import { useId } from 'react';

interface NebulaGraphProps {
  data: number[];
  color?: string;
  height?: number;
  label?: string;
  showDots?: boolean;
  showGrid?: boolean;
  animated?: boolean;
  xLabels?: string[];
}

/** Smooth cubic bezier through a sequence of [x,y] points */
function smoothBezier(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  const d: string[] = [`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`];
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const cpX = ((px + cx) / 2).toFixed(1);
    d.push(`C ${cpX} ${py.toFixed(1)}, ${cpX} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`);
  }
  return d.join(' ');
}

export function NebulaGraph({
  data,
  color = '#8b5cf6',
  height = 64,
  label,
  showDots = true,
  showGrid = true,
  animated = true,
  xLabels,
}: NebulaGraphProps) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, 'x');

  if (!data.length) return null;

  const W = 240;
  const H = height;
  const PAD_T = 10;
  const PAD_B = xLabels ? 20 : 8;
  const chartH = H - PAD_T - PAD_B;
  const max = Math.max(...data, 1);
  const step = data.length > 1 ? W / (data.length - 1) : W;

  const pts: [number, number][] = data.map((v, i) => [
    i * step,
    PAD_T + chartH - (v / max) * chartH,
  ]);

  const linePath = smoothBezier(pts);
  const firstPt = pts[0];
  const lastPt = pts[pts.length - 1];
  const areaPath = `${linePath} L ${lastPt[0]} ${H - PAD_B} L ${firstPt[0]} ${H - PAD_B} Z`;

  const maxIdx = data.indexOf(Math.max(...data));
  const peakPt = pts[maxIdx];

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
          <linearGradient id={`ng-area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`ng-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {animated && (
            <clipPath id={`ng-clip-${uid}`}>
              <rect x="0" y="0" width="0" height={H + 4}>
                <animate
                  attributeName="width"
                  from="0"
                  to={W}
                  dur="0.8s"
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1"
                  fill="freeze"
                />
              </rect>
            </clipPath>
          )}
        </defs>

        {/* Grid */}
        {showGrid &&
          [0.25, 0.5, 0.75].map((f, i) => (
            <line
              key={i}
              x1="0"
              y1={PAD_T + chartH * (1 - f)}
              x2={W}
              y2={PAD_T + chartH * (1 - f)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
          ))}

        {/* Animated area + line */}
        <g clipPath={animated ? `url(#ng-clip-${uid})` : undefined}>
          <path d={areaPath} fill={`url(#ng-area-${uid})`} />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter={`url(#ng-glow-${uid})`}
          />
        </g>

        {/* X-axis labels (sparse) */}
        {xLabels &&
          xLabels.map((lbl, i) => {
            // Show label only every Nth to avoid overlap
            const step2 = Math.ceil(xLabels.length / 5);
            if (i % step2 !== 0 && i !== xLabels.length - 1) return null;
            return (
              <text
                key={i}
                x={pts[i]?.[0] ?? 0}
                y={H - 3}
                textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
                fontSize="7"
                fill="rgba(255,255,255,0.3)"
              >
                {lbl}
              </text>
            );
          })}

        {/* Peak dot */}
        {showDots && (
          <circle
            cx={peakPt[0]}
            cy={peakPt[1]}
            r="3.5"
            fill={color}
            filter={`url(#ng-glow-${uid})`}
          >
            {animated && (
              <animate
                attributeName="opacity"
                from="0"
                to="1"
                begin="0.75s"
                dur="0.25s"
                fill="freeze"
              />
            )}
          </circle>
        )}

        {/* Last dot (if different from peak) */}
        {showDots && maxIdx !== data.length - 1 && (
          <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill={color} opacity="0.5">
            {animated && (
              <animate
                attributeName="opacity"
                from="0"
                to="0.5"
                begin="0.75s"
                dur="0.25s"
                fill="freeze"
              />
            )}
          </circle>
        )}
      </svg>
    </div>
  );
}
