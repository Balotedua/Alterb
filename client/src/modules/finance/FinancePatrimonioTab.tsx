import { useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Pencil, Check, X } from 'lucide-react';
import {
  usePatrimonioAssets,
  useAddPatrimonioAsset,
  useUpdatePatrimonioAsset,
  useDeletePatrimonioAsset,
  useMonthlyStats,
  usePrestiti,
  useVisibleTransactions,
} from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';
import type { PatrimonioAsset, PatrimonioAssetInput, PatrimonioAssetType, Transaction } from '@/types';

// ── Asset type config ─────────────────────────────────────────────────────────

interface AssetConfig { label: string; icon: string; color: string }

const ASSET_TYPES: Record<PatrimonioAssetType, AssetConfig> = {
  checking:    { label: 'Conto Corrente', icon: '💳', color: '#60a5fa' },
  savings:     { label: 'Risparmi',       icon: '🏦', color: '#34d399' },
  investments: { label: 'Investimenti',   icon: '📈', color: '#a78bfa' },
  crypto:      { label: 'Crypto',         icon: '₿',  color: '#fbbf24' },
  cash:        { label: 'Contanti',       icon: '💵', color: '#f472b6' },
  real_estate: { label: 'Immobili',       icon: '🏠', color: '#fb923c' },
  other:       { label: 'Altro',          icon: '📦', color: '#9ca3af' },
};

const LIQUID_TYPES: PatrimonioAssetType[] = ['checking', 'savings', 'cash'];

// ── Extra virtual wealth entries (prestiti, saldo storico, saldo mensile) ─────

interface WealthExtra {
  id:     string;
  label:  string;
  icon:   string;
  color:  string;
  amount: number; // can be negative
}

// ── Wealth visual (hero + segmented bar + breakdown) ─────────────────────────

function WealthVisual({
  assets,
  extras = [],
  netTotal,
}: {
  assets:   PatrimonioAsset[];
  extras?:  WealthExtra[];
  netTotal: number;
}) {
  // group real assets by type
  const grouped = new Map<PatrimonioAssetType, number>();
  for (const a of assets) {
    grouped.set(a.asset_type, (grouped.get(a.asset_type) ?? 0) + a.amount);
  }
  const assetEntries = [...grouped.entries()].sort(([, a], [, b]) => b - a);

  // all bar entries = asset types + extras (bar only shows positives)
  const barEntries: { key: string; label: string; icon: string; color: string; amount: number }[] = [
    ...assetEntries.map(([type, amount]) => ({
      key: type, label: ASSET_TYPES[type].label, icon: ASSET_TYPES[type].icon,
      color: ASSET_TYPES[type].color, amount,
    })),
    ...extras.map(e => ({ key: e.id, label: e.label, icon: e.icon, color: e.color, amount: e.amount })),
  ].filter(e => e.amount > 0);

  const barTotal = barEntries.reduce((s, e) => s + e.amount, 0);

  // breakdown = all entries including negatives
  const allEntries = [
    ...assetEntries.map(([type, amount]) => ({
      key: type, label: ASSET_TYPES[type].label, icon: ASSET_TYPES[type].icon,
      color: ASSET_TYPES[type].color, amount,
    })),
    ...extras.map(e => ({ key: e.id, label: e.label, icon: e.icon, color: e.color, amount: e.amount })),
  ].sort((a, b) => b.amount - a.amount);

  if (assets.length === 0 && extras.filter(e => e.amount !== 0).length === 0) return null;

  return (
    <div className="fpa-wealth-wrap">
      {/* Hero number */}
      <div className="fpa-wealth-hero">
        <span className="fpa-wealth-hero-label">Patrimonio netto</span>
        <span className="fpa-wealth-hero-value" style={{ color: netTotal < 0 ? '#f87171' : undefined }}>
          {formatCurrency(netTotal)}
        </span>
      </div>

      {/* Segmented proportional bar */}
      {barTotal > 0 && (
        <div className="fpa-wealth-bar">
          {barEntries.map((e, i) => {
            const pct = (e.amount / barTotal) * 100;
            return (
              <motion.div
                key={e.key}
                className="fpa-wealth-seg"
                style={{ background: e.color, boxShadow: `0 0 10px ${e.color}55` }}
                initial={{ flex: 0 }}
                animate={{ flex: pct }}
                transition={{ duration: 0.75, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                title={`${e.label}: ${formatCurrency(e.amount)}`}
              />
            );
          })}
        </div>
      )}

      {/* Breakdown rows */}
      <div className="fpa-wealth-cats">
        {allEntries.map((e, i) => {
          const pct = barTotal > 0 && e.amount > 0 ? (e.amount / barTotal) * 100 : 0;
          const dotColor = e.amount < 0 ? '#f87171' : e.color;
          return (
            <div key={e.key} className="fpa-wealth-cat-row">
              <div className="fpa-wealth-cat-dot" style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}88` }} />
              <span className="fpa-wealth-cat-icon">{e.icon}</span>
              <span className="fpa-wealth-cat-label">{e.label}</span>
              <div className="fpa-wealth-cat-track">
                <motion.div
                  className="fpa-wealth-cat-fill"
                  style={{ background: dotColor }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.max(pct, e.amount < 0 ? 100 : 0)}%` }}
                  transition={{ duration: 0.65, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                />
              </div>
              <span className="fpa-wealth-cat-amt" style={{ color: e.amount < 0 ? '#f87171' : undefined }}>
                {e.amount < 0 ? '−' : ''}{formatCurrency(Math.abs(e.amount))}
              </span>
              {pct > 0 && <span className="fpa-wealth-cat-pct">{pct.toFixed(0)}%</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Insight ───────────────────────────────────────────────────────────────────

function PatrimonioInsight({ assets, total }: { assets: PatrimonioAsset[]; total: number; }) {
  const { expenses } = useMonthlyStats();
  if (total === 0) return null;

  const liquid    = assets.filter(a => LIQUID_TYPES.includes(a.asset_type)).reduce((s, a) => s + a.amount, 0);
  const invested  = assets.filter(a => a.asset_type === 'investments' || a.asset_type === 'crypto').reduce((s, a) => s + a.amount, 0);
  const coverMths = expenses > 0 ? liquid / expenses : null;

  let icon = '💡';
  let text = '';

  if (coverMths !== null) {
    if (coverMths < 1) {
      icon = '⚠️';
      text = `La tua liquidità copre meno di 1 mese di spese. Costruire un fondo di emergenza è la priorità.`;
    } else if (coverMths < 3) {
      icon = '📊';
      text = `Il tuo fondo di emergenza copre ${coverMths.toFixed(1)} mesi di spese. L'obiettivo ideale è 3–6 mesi.`;
    } else if (coverMths < 6) {
      icon = '✅';
      text = `Il tuo fondo di emergenza copre ora ${coverMths.toFixed(1)} mesi di spese vive. Sei in una zona di sicurezza!`;
    } else {
      icon = '🚀';
      text = `Fondo di emergenza solido (${coverMths.toFixed(1)} mesi). Con ${formatCurrency(invested)} investiti stai costruendo ricchezza a lungo termine.`;
    }
  } else if (total > 0) {
    const invPct = total > 0 ? Math.round((invested / total) * 100) : 0;
    icon = '📈';
    text = `Patrimonio totale ${formatCurrency(total)}.${invPct > 0 ? ` Il ${invPct}% è investito.` : ' Considera di diversificare in investimenti.'}`;
  }

  if (!text) return null;

  return (
    <div className="fpa-insight">
      <span className="fpa-insight-icon">{icon}</span>
      <p className="fpa-insight-text">{text}</p>
    </div>
  );
}

// ── Asset row ─────────────────────────────────────────────────────────────────

function AssetRow({ asset, total }: { asset: PatrimonioAsset; total: number }) {
  const { mutate: update, isPending: updating } = useUpdatePatrimonioAsset();
  const { mutate: remove, isPending: removing } = useDeletePatrimonioAsset();

  const [editing,   setEditing  ] = useState(false);
  const [editLabel, setEditLabel] = useState(asset.label);
  const [editAmt,   setEditAmt  ] = useState(String(asset.amount));

  const cfg = ASSET_TYPES[asset.asset_type];
  const pct = total > 0 ? (asset.amount / total) * 100 : 0;

  const save = () => {
    const amt = parseFloat(editAmt);
    if (isNaN(amt) || amt < 0) return;
    update(
      { id: asset.id, label: editLabel.trim() || cfg.label, amount: amt },
      { onSuccess: () => setEditing(false) },
    );
  };

  const cancel = () => {
    setEditLabel(asset.label);
    setEditAmt(String(asset.amount));
    setEditing(false);
  };

  return (
    <div className="fpa-asset-row">
      <div className="fpa-asset-dot" style={{ background: cfg.color }} />

      <div className="fpa-asset-info">
        <div className="fpa-asset-top">
          <span className="fpa-asset-icon">{cfg.icon}</span>
          {editing ? (
            <input
              className="fpa-input fpa-input--inline"
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              autoFocus
            />
          ) : (
            <span className="fpa-asset-label">{asset.label}</span>
          )}
          <span className="fpa-asset-type">{cfg.label}</span>
        </div>
        <div className="fpa-asset-bar-track">
          <motion.div
            className="fpa-asset-bar-fill"
            style={{ background: cfg.color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          />
        </div>
      </div>

      {editing ? (
        <>
          <input
            className="fpa-input fpa-input--amt-edit"
            type="number"
            min="0"
            step="0.01"
            value={editAmt}
            onChange={e => setEditAmt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
          <button className="fpa-icon-btn fpa-icon-btn--ok" onClick={save} disabled={updating}>
            <Check size={13} />
          </button>
          <button className="fpa-icon-btn fpa-icon-btn--cancel" onClick={cancel}>
            <X size={13} />
          </button>
        </>
      ) : (
        <>
          <span className="fpa-asset-amount">{formatCurrency(asset.amount)}</span>
          <button className="fpa-icon-btn" onClick={() => setEditing(true)}>
            <Pencil size={12} />
          </button>
          <button className="fpa-icon-btn fpa-icon-btn--del" onClick={() => remove(asset.id)} disabled={removing}>
            <Trash2 size={12} />
          </button>
        </>
      )}
    </div>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddAssetForm({ onDone }: { onDone: () => void }) {
  const { mutate: add, isPending } = useAddPatrimonioAsset();
  const [type,   setType  ] = useState<PatrimonioAssetType>('checking');
  const [label,  setLabel ] = useState('');
  const [amount, setAmount] = useState('');
  const [err,    setErr   ] = useState('');

  const cfg = ASSET_TYPES[type];

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setErr('Inserisci un importo valido'); return; }
    setErr('');
    const input: PatrimonioAssetInput = {
      label:      label.trim() || cfg.label,
      asset_type: type,
      amount:     amt,
      icon:       cfg.icon,
      color:      cfg.color,
    };
    add(input, {
      onSuccess: () => { onDone(); setLabel(''); setAmount(''); },
      onError:   (e) => setErr(e.message?.includes('relation') ? 'Tabella non trovata — esegui sql/patrimonio_schema.sql su Supabase.' : 'Errore salvataggio. Riprova.'),
    });
  };

  return (
    <div className="fpa-add-form">
      <div className="fpa-add-row">
        <select
          className="fpa-select"
          value={type}
          onChange={e => setType(e.target.value as PatrimonioAssetType)}
        >
          {(Object.entries(ASSET_TYPES) as [PatrimonioAssetType, AssetConfig][]).map(([id, c]) => (
            <option key={id} value={id}>{c.icon} {c.label}</option>
          ))}
        </select>
        <input
          className="fpa-input"
          placeholder="Nome (opzionale)"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
      </div>
      <div className="fpa-add-row">
        <input
          className="fpa-input fpa-input--amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="€ importo"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          className="fpa-btn fpa-btn--primary"
          onClick={handleSubmit}
          disabled={isPending || !amount}
        >
          {isPending ? '…' : '＋ Aggiungi'}
        </button>
        <button className="fpa-btn fpa-btn--ghost" onClick={onDone}>
          Annulla
        </button>
      </div>
      {err && <p className="fpa-form-err">{err}</p>}
    </div>
  );
}

// ── Patrimonio trend chart ────────────────────────────────────────────────────

type PeriodId = '3M' | '6M' | '12M' | '3A' | '5A';

const PERIODS: { id: PeriodId; label: string; months: number; weekly: boolean }[] = [
  { id: '3M',  label: '3M',  months: 3,  weekly: true  },
  { id: '6M',  label: '6M',  months: 6,  weekly: true  },
  { id: '12M', label: '1A',  months: 12, weekly: false },
  { id: '3A',  label: '3A',  months: 36, weekly: false },
  { id: '5A',  label: '5A',  months: 60, weekly: false },
];

function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function subMonths(d: Date, n: number): Date { const r = new Date(d); r.setMonth(r.getMonth() - n); return r; }
function toISO(d: Date): string { return d.toISOString().split('T')[0]; }

interface ChartPoint { date: string; value: number }

function computeChartData(txns: Transaction[], months: number, weekly: boolean): ChartPoint[] {
  const now      = new Date();
  const start    = subMonths(now, months);
  const nowISO   = toISO(now);
  const sorted   = [...txns].sort((a, b) => a.date.localeCompare(b.date));

  // generate interval dates
  const dates: string[] = [];
  if (weekly) {
    let d = new Date(start);
    while (toISO(d) <= nowISO) { dates.push(toISO(d)); d = addDays(d, 7); }
  } else {
    let d = new Date(start); d.setDate(1);
    while (toISO(d) <= nowISO) { dates.push(toISO(d)); d = subMonths(d, -1); }
  }
  if (!dates.length || dates[dates.length - 1] !== nowISO) dates.push(nowISO);

  // running cumulative sum using two-pointer
  let runSum = 0;
  let ti = 0;
  return dates.map(iso => {
    while (ti < sorted.length && sorted[ti].date <= iso) {
      const t = sorted[ti++];
      runSum += t.type === 'income' ? t.amount : -t.amount;
    }
    return { date: iso, value: runSum };
  });
}

function fmtChartDate(iso: string, months: number): string {
  const d = new Date(iso);
  if (months <= 6) return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
}

function PatrimonioTrendChart({ txns }: { txns: Transaction[] }) {
  const [period, setPeriod]   = useState<PeriodId>('12M');
  const [hoverIdx, setHover]  = useState<number | null>(null);
  const svgRef                = useRef<SVGSVGElement>(null);

  const cfg  = PERIODS.find(p => p.id === period)!;
  const data = useMemo(() => computeChartData(txns, cfg.months, cfg.weekly), [txns, cfg]);

  const W = 560, H = 150, PB = 20;
  const chartH = H - PB;

  const vals = data.map(d => d.value);
  const minV = Math.min(...vals, 0);
  const maxV = Math.max(...vals, 0);
  const range = maxV - minV || 1;

  const xS = (i: number) => (i / Math.max(data.length - 1, 1)) * W;
  const yS = (v: number) => chartH - ((v - minV) / range) * (chartH - 8);

  const pathD = data.length < 2 ? '' : data.map((d, i) => {
    const x = xS(i), y = yS(d.value);
    if (i === 0) return `M${x},${y}`;
    const px = xS(i - 1), py = yS(data[i - 1].value);
    const cx = (px + x) / 2;
    return `C${cx},${py} ${cx},${y} ${x},${y}`;
  }).join(' ');

  const areaD = pathD
    ? `${pathD} L${xS(data.length - 1)},${chartH} L${xS(0)},${chartH} Z`
    : '';

  const last  = data[data.length - 1]?.value ?? 0;
  const first = data[0]?.value ?? 0;
  const up    = last >= first;
  const color = up ? '#34d399' : '#f87171';

  // x-axis tick labels (5 evenly spaced)
  const tickCount = 5;
  const tickIdxs  = data.length < 2 ? [] : Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / (tickCount - 1)) * (data.length - 1))
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || data.length < 2) return;
    const x    = e.clientX - rect.left;
    const pct  = x / rect.width;
    const idx  = Math.round(pct * (data.length - 1));
    setHover(Math.max(0, Math.min(idx, data.length - 1)));
  }, [data.length]);

  if (!txns.length) return null;

  const hPt = hoverIdx !== null ? data[hoverIdx] : null;
  const hX  = hoverIdx !== null ? xS(hoverIdx) : 0;
  const hY  = hPt ? yS(hPt.value) : 0;

  return (
    <div className="fpa-chart-wrap">
      {/* Header */}
      <div className="fpa-chart-header">
        <span className="fpa-chart-title">Andamento saldo</span>
        <div className="fpa-chart-periods">
          {PERIODS.map(p => (
            <button
              key={p.id}
              className={`fpa-chart-period-btn${period === p.id ? ' fpa-chart-period-btn--active' : ''}`}
              onClick={() => { setPeriod(p.id); setHover(null); }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tooltip value */}
      <div className="fpa-chart-val" style={{ color }}>
        {hPt
          ? <>{formatCurrency(hPt.value)} <span className="fpa-chart-val-date">{fmtChartDate(hPt.date, cfg.months)}</span></>
          : <>{formatCurrency(last)} <span className="fpa-chart-val-sub">{up ? '↑' : '↓'} rispetto all'inizio</span></>
        }
      </div>

      {/* SVG */}
      <div className="fpa-chart-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="fpa-chart-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="fpa-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Zero baseline */}
          {minV < 0 && maxV > 0 && (
            <line
              x1={0} y1={yS(0)} x2={W} y2={yS(0)}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4,4"
            />
          )}

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#fpa-grad)" />}

          {/* Line */}
          {pathD && (
            <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Hover crosshair */}
          {hoverIdx !== null && (
            <>
              <line x1={hX} y1={0} x2={hX} y2={chartH} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx={hX} cy={hY} r="4.5" fill={color} stroke="rgba(10,10,20,0.8)" strokeWidth="2" />
            </>
          )}

          {/* Invisible hover rect */}
          <rect x={0} y={0} width={W} height={H} fill="transparent" />
        </svg>

        {/* X-axis labels */}
        <div className="fpa-chart-x-axis">
          {tickIdxs.map((idx, i) => (
            <span
              key={i}
              className="fpa-chart-x-label"
              style={{ left: `${(idx / (data.length - 1)) * 100}%` }}
            >
              {fmtChartDate(data[idx].date, cfg.months)}
            </span>
          ))}
        </div>
      </div>

      {/* Min / max */}
      <div className="fpa-chart-bounds">
        <span style={{ color: minV < 0 ? '#f87171' : 'var(--text-muted)' }}>{formatCurrency(minV)}</span>
        <span style={{ color: maxV > 0 ? '#34d399' : 'var(--text-muted)' }}>{formatCurrency(maxV)}</span>
      </div>
    </div>
  );
}

// ── Inner content (embeddable without outer wrapper) ──────────────────────────

export function FinancePatrimonioContent() {
  const { data: assets = [], isLoading, isError } = usePatrimonioAssets();
  const { data: prestiti = [] }                   = usePrestiti();
  const allTx = useVisibleTransactions();
  const { income: mIncome, expenses: mExpenses }  = useMonthlyStats();
  const [showAdd, setShowAdd] = useState(false);

  const assetsTotal = assets.reduce((s, a) => s + a.amount, 0);
  const liquid      = assets.filter(a => LIQUID_TYPES.includes(a.asset_type)).reduce((s, a) => s + a.amount, 0);
  const invested    = assets
    .filter(a => a.asset_type === 'investments' || a.asset_type === 'crypto')
    .reduce((s, a) => s + a.amount, 0);

  // Virtual wealth entries
  const extras = useMemo((): WealthExtra[] => {
    // Saldo prestiti: 'dato' = credito (+), 'ricevuto' = debito (−), esclusi saldati
    const activePrestiti = prestiti.filter(p => !p.saldato);
    const crediti  = activePrestiti.filter(p => p.tipo === 'dato').reduce((s, p) => s + p.importo, 0);
    const debiti   = activePrestiti.filter(p => p.tipo === 'ricevuto').reduce((s, p) => s + p.importo, 0);
    const prestitiNet = crediti - debiti;

    // Saldo storico: somma entrate - uscite di tutte le transazioni
    const saldoStorico = allTx.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0);

    // Saldo mensile corrente
    const saldoMensile = mIncome - mExpenses;

    return [
      {
        id:     'prestiti_net',
        label:  prestitiNet >= 0 ? 'Crediti netti' : 'Debiti netti',
        icon:   prestitiNet >= 0 ? '🤝' : '⚠️',
        color:  prestitiNet >= 0 ? '#34d399' : '#f87171',
        amount: prestitiNet,
      },
      {
        id:     'saldo_storico',
        label:  'Saldo storico conto',
        icon:   '🏛',
        color:  '#60a5fa',
        amount: saldoStorico,
      },
      {
        id:     'saldo_mensile',
        label:  'Saldo mese corrente',
        icon:   '📅',
        color:  saldoMensile >= 0 ? '#a78bfa' : '#fb923c',
        amount: saldoMensile,
      },
    ].filter(e => e.amount !== 0);
  }, [prestiti, allTx, mIncome, mExpenses]);

  const netTotal = assetsTotal + extras.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="fpa-wrap">
      {/* Wealth visual */}
      {(assets.length > 0 || extras.length > 0) && (
        <WealthVisual assets={assets} extras={extras} netTotal={netTotal} />
      )}

      {/* KPI strip */}
      <div className="fp-kpi-row">
        <div className="fp-kpi-chip">
          <span className="fp-kpi-label">Liquidità</span>
          <span className="fp-kpi-value">{isLoading ? '…' : formatCurrency(liquid)}</span>
        </div>
        <div className="fp-kpi-chip fp-kpi-chip--purple">
          <span className="fp-kpi-label">Investito</span>
          <span className="fp-kpi-value">{isLoading ? '…' : formatCurrency(invested)}</span>
        </div>
      </div>

      {/* Insight */}
      {!isLoading && <PatrimonioInsight assets={assets} total={netTotal} />}

      {/* Asset list */}
      <div className="fpa-list">
        {isError && (
          <p className="fpa-setup-hint">
            ⚠ Tabella non trovata. Esegui <code>sql/patrimonio_schema.sql</code> su Supabase per attivare il patrimonio.
          </p>
        )}
        {!isLoading && !isError && assets.length === 0 && !showAdd && (
          <p className="fragment-empty">Nessun asset ancora. Aggiungi il tuo primo conto o investimento.</p>
        )}
        {assets.map(a => (
          <AssetRow key={a.id} asset={a} total={assetsTotal} />
        ))}
      </div>

      {showAdd ? (
        <AddAssetForm onDone={() => setShowAdd(false)} />
      ) : (
        <button className="fpa-btn fpa-btn--add" onClick={() => setShowAdd(true)}>
          + Aggiungi asset
        </button>
      )}

      {/* Trend chart */}
      {allTx.length > 0 && <PatrimonioTrendChart txns={allTx} />}
    </div>
  );
}

// ── Legacy wrapper (kept for import compat) ───────────────────────────────────
export function FinancePatrimonioTab() {
  return <div className="fp-section"><FinancePatrimonioContent /></div>;
}
