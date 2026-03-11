import React, { useState, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Tag, ChevronDown, ChevronUp, Plus, ArrowRight, Pencil, Check, X } from 'lucide-react';
import {
  useTransactions,
  useFinanceCategories,
  useAddCategory,
  useUpdateCategory,
  useUpdateTransactionCategory,
  useRecategorize,
} from '@/hooks/useFinance';
import { FINANCE_DEFAULT_CATS } from '@/utils/constants';
import { NebulaCard } from '@/components/ui/nebula';
import { formatCurrency } from '@/utils/formatters';
import { toast } from 'sonner';
import type { Transaction } from '@/types';

// ── Icone predefinite ──────────────────────────────────────────────────────────

const ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: 'Cibo & Drink',   icons: ['🍽️','🍕','🍔','🌮','🍜','🍣','🥗','☕','🍺','🍷','🛒','🥐'] },
  { label: 'Trasporti',      icons: ['🚗','🚌','✈️','🚂','🚲','🛵','⛽','🚕','🚁','🛳️'] },
  { label: 'Casa & Bollette',icons: ['🏠','💡','🔌','💧','🔥','📱','💻','📺','🛋️','🧹'] },
  { label: 'Salute',         icons: ['💊','🏥','🧘','💪','🩺','🏃','🛁','💆','🦷'] },
  { label: 'Shopping',       icons: ['🛍️','👗','👟','👜','🎁','💍','🕶️','⌚','🧴'] },
  { label: 'Svago',          icons: ['🎬','🎮','🎵','📚','🎨','🏖️','⚽','🎭','🎲','🎤'] },
  { label: 'Lavoro & €',    icons: ['💼','💰','📊','🏦','📈','💳','🏷️','📝','🖥️'] },
  { label: 'Altro',          icons: ['🐾','✈️','🌍','⭐','❤️','🎯','🔧','📦','🗂️','🌱'] },
];

// ── Data ──────────────────────────────────────────────────────────────────────

// Mappa di lookup per catInfo (include anche 'other')
const DEFAULT_CATS: Record<string, { label: string; icon: string }> = {
  ...Object.fromEntries(FINANCE_DEFAULT_CATS.map(c => [c.id, { label: c.label, icon: c.icon }])),
  other: { label: 'Altro', icon: '📂' },
};

const DEFAULT_ICON = '◦';

// ── Mobile scroll guard ───────────────────────────────────────────────────────
// Prevents scroll gestures from firing as tap/click on mobile browsers.
function useTouchScroll(threshold = 6) {
  const startY = useRef(0);
  const moved  = useRef(false);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      startY.current = e.touches[0].clientY;
      moved.current  = false;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (Math.abs(e.touches[0].clientY - startY.current) > threshold)
        moved.current = true;
    },
    scrolled: () => moved.current,
  };
}

function catInfo(id: string, userCats: { id: string; label: string; icon?: string }[]) {
  const user = userCats.find(c => c.id === id);
  if (user) return { label: user.label, icon: user.icon || DEFAULT_ICON };
  return DEFAULT_CATS[id] ?? { label: id, icon: DEFAULT_ICON };
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ── Icon picker panel ─────────────────────────────────────────────────────────

function IconPicker({ selected, onSelect }: { selected: string; onSelect: (icon: string) => void }) {
  return (
    <div className="cat-icon-picker">
      {ICON_GROUPS.map(group => (
        <div key={group.label} className="cat-icon-group">
          <span className="cat-icon-group-label">{group.label}</span>
          <div className="cat-icon-grid">
            {group.icons.map(icon => (
              <button
                key={icon}
                type="button"
                className={['cat-icon-btn', selected === icon ? 'cat-icon-btn--active' : ''].filter(Boolean).join(' ')}
                onClick={() => onSelect(icon)}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Edit category panel ───────────────────────────────────────────────────────

interface EditCatPanelProps {
  catId: string;
  currentLabel: string;
  currentIcon: string;
  onDone: () => void;
}

function EditCatPanel({ catId, currentLabel, currentIcon, onDone }: EditCatPanelProps) {
  const [label, setLabel] = useState(currentLabel);
  const [icon, setIcon]   = useState(currentIcon === DEFAULT_ICON ? '' : currentIcon);
  const { mutate: update, isPending } = useUpdateCategory();

  function save() {
    const finalLabel = label.trim() || currentLabel;
    const finalIcon  = icon || DEFAULT_ICON;
    update({ id: catId, label: finalLabel, icon: finalIcon }, {
      onSuccess: () => { toast.success('Categoria aggiornata.'); onDone(); },
      onError:   () => toast.error('Errore salvataggio.'),
    });
  }

  return (
    <div className="cat-edit-panel">
      <div className="cat-edit-header">
        <Pencil size={12} className="cat-edit-header-icon" />
        <span className="cat-edit-header-title">Modifica categoria</span>
        <button className="cat-edit-close" onClick={onDone} type="button"><X size={13} /></button>
      </div>

      {/* Preview */}
      <div className="cat-edit-preview">
        <span className="cat-edit-preview-icon">{icon || DEFAULT_ICON}</span>
        <span className="cat-edit-preview-name">{label || currentLabel}</span>
      </div>

      {/* Name input */}
      <input
        className="cat-edit-input"
        placeholder="Nome categoria"
        value={label}
        onChange={e => setLabel(e.target.value)}
        maxLength={30}
      />

      {/* Icon picker */}
      <IconPicker selected={icon} onSelect={setIcon} />

      <button
        className="cat-edit-save-btn"
        onClick={save}
        disabled={isPending}
      >
        {isPending ? '…' : <><Check size={12} /> Salva</>}
      </button>
    </div>
  );
}

// ── Recategorize sheet ────────────────────────────────────────────────────────

interface RecatSheetProps {
  tx: Transaction;
  allTxsCount: number;          // how many share the same description
  userCats: { id: string; label: string; icon?: string }[];
  onDone: () => void;
}

function RecatSheet({ tx, allTxsCount, userCats, onDone }: RecatSheetProps) {
  const allCats = [
    ...Object.entries(DEFAULT_CATS).map(([id, { label, icon }]) => ({ id, label, icon })),
    ...userCats,
  ];

  const [selected, setSelected]   = useState(tx.category ?? 'other');
  const [showNew, setShowNew]      = useState(false);
  const [newLabel, setNewLabel]    = useState('');

  const { mutate: updateOne, isPending: p1 } = useUpdateTransactionCategory();
  const { mutate: updateAll, isPending: p2 } = useRecategorize();
  const { mutate: addCat,    isPending: p3 } = useAddCategory();
  const isPending = p1 || p2 || p3;

  const newSlug  = slugify(newLabel);
  const finalCat = showNew && newLabel.trim() ? newSlug : selected;

  function save(scope: 'single' | 'all') {
    const doUpdate = () => {
      if (scope === 'single') {
        updateOne({ id: tx.id, category: finalCat }, {
          onSuccess: () => { toast.success('Transazione aggiornata.'); onDone(); },
          onError:   () => toast.error('Errore aggiornamento.'),
        });
      } else {
        updateAll({ description: tx.description, category: finalCat }, {
          onSuccess: () => { toast.success(`Aggiornate tutte le "${tx.description}".`); onDone(); },
          onError:   () => toast.error('Errore aggiornamento.'),
        });
      }
    };

    if (showNew && newLabel.trim()) {
      addCat({ id: newSlug, label: newLabel.trim(), icon: '🏷️', color: '#888' }, {
        onSuccess: doUpdate,
        onError:   () => toast.error('Errore creazione categoria.'),
      });
    } else {
      doUpdate();
    }
  }

  return (
    <div className="recat-sheet">
      {/* Header */}
      <div className="recat-sheet-header">
        <Tag size={13} className="recat-sheet-icon" />
        <span className="recat-sheet-title">Ricategorizza</span>
        <button className="recat-sheet-close" onClick={onDone}>✕</button>
      </div>
      <p className="recat-sheet-tx">"{tx.description}"</p>

      {/* Category chips */}
      <div className="recat-chips">
        {allCats.map(c => (
          <button
            key={c.id}
            className={['recat-chip', !showNew && selected === c.id ? 'recat-chip--active' : ''].filter(Boolean).join(' ')}
            onClick={() => { setSelected(c.id); setShowNew(false); }}
          >
            <span className="recat-chip-icon">{c.icon}</span>
            {c.label}
          </button>
        ))}
        <button
          className={['recat-chip recat-chip--new', showNew ? 'recat-chip--active' : ''].filter(Boolean).join(' ')}
          onClick={() => { setShowNew(v => !v); }}
        >
          <Plus size={11} />
          Nuova
        </button>
      </div>

      {/* New category input */}
      <AnimatePresence initial={false}>
        {showNew && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
            style={{ overflow: 'hidden' }}
          >
            <input
              className="recat-new-input"
              placeholder="Nome categoria (es. Benzina)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              autoFocus
              maxLength={30}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="recat-actions">
        <button
          className="recat-action-btn recat-action-btn--single"
          onClick={() => save('single')}
          disabled={isPending}
        >
          <ArrowRight size={12} />
          Solo questa
        </button>
        {allTxsCount > 1 && (
          <button
            className="recat-action-btn recat-action-btn--all"
            onClick={() => save('all')}
            disabled={isPending}
          >
            <ArrowRight size={12} />
            Tutte le {allTxsCount}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({ t, onRecat }: { t: Transaction; onRecat: (t: Transaction) => void }) {
  const touch = useTouchScroll();
  return (
    <div className="cat2-tx-row">
      <div className="cat2-tx-left">
        <span className="cat2-tx-desc">{t.description}</span>
        <span className="cat2-tx-date">{t.date}</span>
      </div>
      <span className={['cat2-tx-amt', t.type === 'income' ? 'cat2-tx-amt--inc' : 'cat2-tx-amt--exp'].filter(Boolean).join(' ')}>
        {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
      </span>
      <button
        className="cat2-tx-recat"
        title="Cambia categoria"
        onTouchStart={touch.onTouchStart}
        onTouchMove={touch.onTouchMove}
        onClick={() => { if (!touch.scrolled()) onRecat(t); }}
      >
        <Tag size={11} />
      </button>
    </div>
  );
}

// ── Category row ──────────────────────────────────────────────────────────────

interface CatRowProps {
  catId: string;
  total: number;
  count: number;
  txs: Transaction[];
  pct: number;
  userCats: { id: string; label: string; icon?: string }[];
  isActive: boolean;
  onToggle: () => void;
}

function CatRow({ catId, total, count, txs, pct, userCats, isActive, onToggle }: CatRowProps) {
  const [recatTx, setRecatTx]   = useState<Transaction | null>(null);
  const [editing, setEditing]    = useState(false);
  const info      = catInfo(catId, userCats);
  const isExpense = total > 0;
  const headerTouch = useTouchScroll();
  const editTouch   = useTouchScroll();

  const sameDescCount = (tx: Transaction) =>
    txs.filter(t => t.description === tx.description).length;

  return (
    <div className={['cat2-row', isActive ? 'cat2-row--open' : ''].filter(Boolean).join(' ')}>
      {/* ── Summary bar ── */}
      <div className="cat2-header-wrap">
        <button
          className="cat2-header"
          onTouchStart={headerTouch.onTouchStart}
          onTouchMove={headerTouch.onTouchMove}
          onClick={() => { if (!headerTouch.scrolled()) onToggle(); }}
        >
          <span className="cat2-icon">{info.icon}</span>
          <span className="cat2-label">{info.label}</span>
          <span className="cat2-count">{count}</span>
          <span className={['cat2-total', isExpense ? 'cat2-total--exp' : 'cat2-total--inc'].filter(Boolean).join(' ')}>
            {isExpense ? '−' : '+'}{formatCurrency(Math.abs(total))}
          </span>
          <span className="cat2-pct">{pct}%</span>
          <span className="cat2-chevron">{isActive ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</span>
        </button>
        <button
          className="cat2-edit-btn"
          onTouchStart={editTouch.onTouchStart}
          onTouchMove={editTouch.onTouchMove}
          onClick={(e) => {
            if (editTouch.scrolled()) return;
            e.stopPropagation();
            setEditing(v => !v);
            setRecatTx(null);
          }}
          title="Modifica categoria"
          type="button"
        >
          <Pencil size={11} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="cat2-bar-track">
        <motion.div
          className={['cat2-bar-fill', isExpense ? 'cat2-bar-fill--exp' : 'cat2-bar-fill--inc'].filter(Boolean).join(' ')}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
        />
      </div>

      {/* ── Edit category panel (outside accordion, always accessible) ── */}
      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
            style={{ overflow: 'hidden' }}
          >
            <EditCatPanel
              catId={catId}
              currentLabel={info.label}
              currentIcon={info.icon}
              onDone={() => setEditing(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transaction list ── */}
      <AnimatePresence initial={false}>
        {isActive && !editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
            style={{ overflow: 'hidden' }}
          >
            {recatTx ? (
              <RecatSheet
                tx={recatTx}
                allTxsCount={sameDescCount(recatTx)}
                userCats={userCats}
                onDone={() => setRecatTx(null)}
              />
            ) : (
              <div className="cat2-txlist">
                {txs.slice(0, 30).map(t => (
                  <TxRow key={t.id} t={t} onRecat={setRecatTx} />
                ))}
                {txs.length > 30 && (
                  <p className="cat2-more">+{txs.length - 30} altre</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main fragment ──────────────────────────────────────────────────────────────

export function FinanceCategoryFragment({ params }: { params: Record<string, unknown> }) {
  const filterType = (params.type as Transaction['type']) ?? null;

  const { data: transactions = [] } = useTransactions();
  const { data: userCats = [] }     = useFinanceCategories();
  const [activeCat, setActiveCat]   = useState<string | null>(null);

  const txs = useMemo(() =>
    filterType ? transactions.filter(t => t.type === filterType) : transactions,
    [transactions, filterType]
  );

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, { total: number; count: number; txs: Transaction[] }>();
    for (const t of txs) {
      const cat = t.category || 'other';
      const ex  = map.get(cat) ?? { total: 0, count: 0, txs: [] };
      map.set(cat, {
        total: ex.total + (t.type === 'expense' ? t.amount : -t.amount),
        count: ex.count + 1,
        txs:   [...ex.txs, t],
      });
    }
    return [...map.entries()].sort(([a, va], [b, vb]) => {
      if (a === 'other') return 1;
      if (b === 'other') return -1;
      return Math.abs(vb.total) - Math.abs(va.total);
    });
  }, [txs]);

  const totalAbs = grouped.reduce((s, [, { total }]) => s + Math.abs(total), 0);

  // Summary: separate expense / income
  const totalExp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalInc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  return (
    <NebulaCard icon={<Tag size={15} />} title="Spese per categoria" variant="finance" closable>

      {/* ── Summary header ── */}
      <div className="cat2-summary">
        <div className="cat2-summary-item cat2-summary-item--exp">
          <span className="cat2-summary-label">Uscite</span>
          <span className="cat2-summary-val">−{formatCurrency(totalExp)}</span>
        </div>
        {totalInc > 0 && (
          <div className="cat2-summary-item cat2-summary-item--inc">
            <span className="cat2-summary-label">Entrate</span>
            <span className="cat2-summary-val">+{formatCurrency(totalInc)}</span>
          </div>
        )}
        <div className="cat2-summary-item">
          <span className="cat2-summary-label">Categorie</span>
          <span className="cat2-summary-val cat2-summary-val--neutral">{grouped.length}</span>
        </div>
      </div>

      {/* ── Category rows ── */}
      {grouped.length === 0 ? (
        <p className="cat2-empty">Nessuna transazione trovata.</p>
      ) : (
        <div className="cat2-list">
          {grouped.map(([catId, { total, count, txs: catTxs }]) => {
            const pct = totalAbs > 0 ? Math.round((Math.abs(total) / totalAbs) * 100) : 0;
            return (
              <CatRow
                key={catId}
                catId={catId}
                total={total}
                count={count}
                txs={catTxs}
                pct={pct}
                userCats={userCats}
                isActive={activeCat === catId}
                onToggle={() => setActiveCat(prev => prev === catId ? null : catId)}
              />
            );
          })}
        </div>
      )}
    </NebulaCard>
  );
}
