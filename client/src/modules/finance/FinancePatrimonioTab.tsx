import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Pencil, Check, X } from 'lucide-react';
import {
  usePatrimonioAssets,
  useAddPatrimonioAsset,
  useUpdatePatrimonioAsset,
  useDeletePatrimonioAsset,
  useMonthlyStats,
} from '@/hooks/useFinance';
import { formatCurrency } from '@/utils/formatters';
import type { PatrimonioAsset, PatrimonioAssetInput, PatrimonioAssetType } from '@/types';

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

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ assets, total }: { assets: PatrimonioAsset[]; total: number }) {
  const r  = 52;
  const sz = 144;
  const cx = sz / 2;
  const cy = sz / 2;
  const C  = 2 * Math.PI * r;
  const GAP = 3;

  if (total === 0 || assets.length === 0) {
    return (
      <svg viewBox={`0 0 ${sz} ${sz}`} className="fpa-donut-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={18} />
      </svg>
    );
  }

  // Group by asset_type for the chart segments (merge same types)
  const grouped = new Map<PatrimonioAssetType, number>();
  for (const a of assets) {
    grouped.set(a.asset_type, (grouped.get(a.asset_type) ?? 0) + a.amount);
  }

  let cumulative = 0;
  return (
    <svg viewBox={`0 0 ${sz} ${sz}`} className="fpa-donut-svg">
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {[...grouped.entries()].map(([type, amount]) => {
          const cfg     = ASSET_TYPES[type];
          const portion = (amount / total) * C;
          const dash    = `${Math.max(portion - GAP, 0)} ${C}`;
          const offset  = -cumulative;
          cumulative   += portion;
          return (
            <circle
              key={type}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={cfg.color}
              strokeWidth={18}
              strokeDasharray={dash}
              strokeDashoffset={offset}
            />
          );
        })}
      </g>
    </svg>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function DonutLegend({ assets, total }: { assets: PatrimonioAsset[]; total: number }) {
  const grouped = new Map<PatrimonioAssetType, number>();
  for (const a of assets) {
    grouped.set(a.asset_type, (grouped.get(a.asset_type) ?? 0) + a.amount);
  }

  return (
    <div className="fpa-legend">
      {[...grouped.entries()].map(([type, amount]) => {
        const cfg = ASSET_TYPES[type];
        const pct = total > 0 ? (amount / total) * 100 : 0;
        return (
          <div key={type} className="fpa-legend-item">
            <div className="fpa-legend-dot" style={{ background: cfg.color }} />
            <span className="fpa-legend-label">{cfg.icon} {cfg.label}</span>
            <span className="fpa-legend-pct">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Insight ───────────────────────────────────────────────────────────────────

function PatrimonioInsight({ assets, total }: { assets: PatrimonioAsset[]; total: number }) {
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

// ── Main tab ──────────────────────────────────────────────────────────────────

export function FinancePatrimonioTab() {
  const { data: assets = [], isLoading, isError } = usePatrimonioAssets();
  const [showAdd, setShowAdd] = useState(false);

  const total    = assets.reduce((s, a) => s + a.amount, 0);
  const liquid   = assets.filter(a => LIQUID_TYPES.includes(a.asset_type)).reduce((s, a) => s + a.amount, 0);
  const invested = assets
    .filter(a => a.asset_type === 'investments' || a.asset_type === 'crypto')
    .reduce((s, a) => s + a.amount, 0);

  return (
    <div className="fp-section fpa-wrap">
      {/* KPI strip */}
      <div className="fp-kpi-row">
        <div className="fp-kpi-chip">
          <span className="fp-kpi-label">Patrimonio</span>
          <span className="fp-kpi-value">{isLoading ? '…' : formatCurrency(total)}</span>
        </div>
        <div className="fp-kpi-chip fp-kpi-chip--green">
          <span className="fp-kpi-label">Liquidità</span>
          <span className="fp-kpi-value">{isLoading ? '…' : formatCurrency(liquid)}</span>
        </div>
        <div className="fp-kpi-chip fp-kpi-chip--purple">
          <span className="fp-kpi-label">Investito</span>
          <span className="fp-kpi-value">{isLoading ? '…' : formatCurrency(invested)}</span>
        </div>
      </div>

      {/* Donut chart + legend */}
      {assets.length > 0 && (
        <div className="fpa-chart-row">
          <div className="fpa-donut-wrap">
            <DonutChart assets={assets} total={total} />
            <div className="fpa-donut-center">
              <span className="fpa-donut-center-label">Totale</span>
              <span className="fpa-donut-center-value">{formatCurrency(total)}</span>
            </div>
          </div>
          <DonutLegend assets={assets} total={total} />
        </div>
      )}

      {/* Insight Nebula */}
      {!isLoading && <PatrimonioInsight assets={assets} total={total} />}

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
          <AssetRow key={a.id} asset={a} total={total} />
        ))}
      </div>

      {/* Add form / button — always visible, no loading gate */}
      {showAdd ? (
        <AddAssetForm onDone={() => setShowAdd(false)} />
      ) : (
        <button className="fpa-btn fpa-btn--add" onClick={() => setShowAdd(true)}>
          + Aggiungi asset
        </button>
      )}
    </div>
  );
}
