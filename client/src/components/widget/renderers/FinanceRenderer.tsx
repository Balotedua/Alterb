import { useState, useRef, useCallback } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Trash2, X, CreditCard, TrendingUp, Target, ArrowLeftRight, Landmark, BarChart2 } from 'lucide-react';
import { useAlterStore } from '../../../store/alterStore';
import { saveEntry, updateEntryData, deleteEntry } from '../../../vault/vaultService';
import { importBankCsv, importBankXlsx, parseBankPdfText, importParsedTransactions } from '../../../import/bankCsvImport';
import { extractDocument } from '../../../import/documentOcr';
import { applyRule, setRule } from '../../../core/descriptionRules';
import type { VaultEntry } from '../../../types';
import { PIE_PALETTE } from './shared';

type FinanceTab = 'transazioni' | 'cashflow' | 'budget' | 'prestiti' | 'patrimonio' | 'analisi' | 'aggiungi' | 'associa';

const GOLD = '#C8A84B';
const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const DAYS_IT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const DEBT_SUBS = ['prestito','debito','loan','debt'];
const CREDIT_SUBS = ['credito','credit_given'];

// ── Obsidian Finance design tokens ────────────────────────────
const T = {
  cardBg:        'rgba(255,255,255,0.04)',
  cardBgHover:   'rgba(255,255,255,0.07)',
  border:        '1px solid rgba(255,255,255,0.10)',
  borderClr:     'rgba(255,255,255,0.10)',
  borderSubtle:  'rgba(255,255,255,0.06)',
  textPrimary:   '#f0f0f0',
  textSecondary: 'rgba(255,255,255,0.55)',
  textDim:       'rgba(255,255,255,0.35)',
  textMuted:     'rgba(255,255,255,0.20)',
  income:        '#34d399',
  expense:       '#f87171',
  warning:       '#fbbf24',
  incomeFill:    'rgba(52,211,153,0.14)',
  expenseFill:   'rgba(248,113,113,0.14)',
} as const;

const EASE = [0.4, 0, 0.2, 1] as const;

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: T.textDim,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  marginBottom: 8,
  fontWeight: 500,
};

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  boxSizing: 'border-box',
  background: T.cardBg,
  border: T.border,
  color: T.textPrimary,
  fontSize: 13,
  fontWeight: 400,
  outline: 'none',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  transition: 'border-color 0.15s, background 0.15s',
};

const numStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  letterSpacing: '-0.03em',
};

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(10,10,18,0.97)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    fontSize: 11,
    padding: '8px 12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  labelStyle: { color: 'rgba(255,255,255,0.40)', fontWeight: 500 },
};

export default function FinanceRenderer({ entries, color, initialTab }: { entries: VaultEntry[]; color: string; initialTab?: string }) {
  const singleMode = !!initialTab;
  const normalizedTab = (
    initialTab === 'grafici' ? 'cashflow' :
    initialTab === 'ricorrenti' ? 'budget' : initialTab
  ) as FinanceTab | undefined;
  const [tab, setTab] = useState<FinanceTab | null>(normalizedTab ?? null);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [search, setSearch] = useState('');
  const [budgetSubTab, setBudgetSubTab] = useState<'budget' | 'ricorrenti'>('budget');
  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('_alter_budget') ?? '{}'); } catch { return {}; }
  });
  const [editBudgetLabel, setEditBudgetLabel] = useState<string | null>(null);
  const [editBudgetVal, setEditBudgetVal] = useState('');
  const { setActiveWidget, activeWidget, user } = useAlterStore();

  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);
  const [removingTxnId, setRemovingTxnId] = useState<string | null>(null);

  const [addMode, setAddMode] = useState<'form' | 'import'>('form');
  const [addType, setAddType] = useState<'expense' | 'income'>('expense');
  const [addAmount, setAddAmount] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const addFileRef = useRef<HTMLInputElement>(null);

  const [assocInputs, setAssocInputs] = useState<Record<string, string>>({});
  const [assocSaving, setAssocSaving] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────
  const expenses = entries.filter(e => e.data.type === 'expense');
  const income   = entries.filter(e => e.data.type === 'income');
  const totalOut = expenses.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
  const totalIn  = income.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
  const balance  = totalIn - totalOut;
  const savings  = totalIn > 0 ? Math.round((balance / totalIn) * 100) : null;
  const dayOfMonth = new Date().getDate();
  const burnRate   = dayOfMonth > 0 ? (totalOut / dayOfMonth) * 30 : 0;
  const daysLeft   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - dayOfMonth;
  const projMonthEnd = dayOfMonth > 0 ? (totalOut / dayOfMonth) * (dayOfMonth + daysLeft) : 0;

  // cashflow 6 mesi
  const _now = new Date();
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(_now.getFullYear(), _now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: MESI[d.getMonth()], entrate: 0, uscite: 0, netto: 0 };
  });
  for (const e of entries) {
    const key = ((e.data.date as string | undefined) || e.created_at).slice(0, 7);
    const m = months6.find(mx => mx.key === key);
    if (!m) continue;
    if (e.data.type === 'income')  m.entrate += (e.data.amount as number) ?? 0;
    if (e.data.type === 'expense') m.uscite  += (e.data.amount as number) ?? 0;
  }
  for (const m of months6) m.netto = m.entrate - m.uscite;

  // categoria breakdown
  const labelMap = new Map<string, number>();
  for (const e of expenses) {
    const lbl = (e.data.label as string) || 'altro';
    labelMap.set(lbl, (labelMap.get(lbl) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const pieData = [...labelMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, value]) => ({ name, value }));

  // giorno della settimana
  const daySpend = Array(7).fill(0) as number[];
  for (const e of expenses) daySpend[new Date((e.data.date as string | undefined) || e.created_at).getDay()] += (e.data.amount as number) ?? 0;
  const maxDaySpend = Math.max(...daySpend);
  const topDay = daySpend.indexOf(maxDaySpend);

  // ricorrenti
  const labelMonths = new Map<string, Set<string>>();
  for (const e of expenses) {
    const lbl = (e.data.label as string) || 'altro';
    const month = ((e.data.date as string | undefined) || e.created_at).slice(0, 7);
    if (!labelMonths.has(lbl)) labelMonths.set(lbl, new Set());
    labelMonths.get(lbl)!.add(month);
  }
  const recurring = [...labelMonths.entries()]
    .filter(([, months]) => months.size >= 2)
    .sort((a, b) => b[1].size - a[1].size);

  // budget questo mese
  const bgtNow = new Date();
  const bgtMonthKey = `${bgtNow.getFullYear()}-${String(bgtNow.getMonth()+1).padStart(2,'0')}`;
  const bgtMonthLabel = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][bgtNow.getMonth()] + ' ' + bgtNow.getFullYear();
  const spentThisMonth = new Map<string, number>();
  for (const e of expenses) {
    const dk = ((e.data.date as string | undefined) || e.created_at).slice(0, 7);
    if (dk !== bgtMonthKey) continue;
    const lbl = (e.data.label as string) || 'altro';
    spentThisMonth.set(lbl, (spentThisMonth.get(lbl) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const bgtAllLabels = [...new Set([...Object.keys(budgets), ...spentThisMonth.keys()])];
  const bgtTotalTarget = bgtAllLabels.reduce((s, k) => s + (budgets[k] ?? 0), 0);
  const bgtTotalSpent  = bgtAllLabels.reduce((s, k) => s + (spentThisMonth.get(k) ?? 0), 0);
  const bgtRingPct  = bgtTotalTarget > 0 ? Math.min(100, (bgtTotalSpent / bgtTotalTarget) * 100) : 0;
  const bgtRingOver = bgtTotalTarget > 0 && bgtTotalSpent > bgtTotalTarget;
  const bgtRingWarn = !bgtRingOver && bgtRingPct >= 80;

  // prestiti — new model: subcategory = 'prestito_dato' | 'prestito_ricevuto'
  // legacy compat: DEBT_SUBS / CREDIT_SUBS still recognized
  const PRESTITO_DATO_SUBS = ['prestito_dato', ...CREDIT_SUBS];      // money I lent → I should receive
  const PRESTITO_RIC_SUBS  = ['prestito_ricevuto', ...DEBT_SUBS];    // money I borrowed → I should give back
  const prestitiDati     = entries.filter(e => PRESTITO_DATO_SUBS.includes(String(e.data.subcategory ?? '').toLowerCase()));
  const prestitiRicevuti = entries.filter(e => PRESTITO_RIC_SUBS.includes(String(e.data.subcategory ?? '').toLowerCase()));
  const allPrestiti = [...prestitiDati.map(e => ({ ...e, _tipo: 'dato' as const })), ...prestitiRicevuti.map(e => ({ ...e, _tipo: 'ricevuto' as const }))];
  // keep legacy vars for KPI card
  const debtEntries   = prestitiRicevuti;
  const creditEntries = prestitiDati;
  const totalDebt   = debtEntries.filter(e => !e.data.saldato).reduce((s, e) => s + ((e.data.importo as number) ?? (e.data.amount as number) ?? 0), 0);
  const totalCredit = creditEntries.filter(e => !e.data.saldato).reduce((s, e) => s + ((e.data.importo as number) ?? (e.data.amount as number) ?? 0), 0);

  // prestiti UI state
  const [prestFilter, setPrestFilter] = useState<'tutti' | 'dato' | 'ricevuto'>('tutti');
  const [showAddPrest, setShowAddPrest] = useState(false);
  const [prestTipo, setPrestTipo]       = useState<'dato' | 'ricevuto'>('dato');
  const [prestPersona, setPrestPersona] = useState('');
  const [prestImporto, setPrestImporto] = useState('');
  const [prestData, setPrestData]       = useState(() => new Date().toISOString().split('T')[0]);
  const [prestNote, setPrestNote]       = useState('');
  const [prestErr, setPrestErr]         = useState('');
  const [prestSubmitting, setPrestSubmitting] = useState(false);
  const [togglingId, setTogglingId]     = useState<string | null>(null);
  const [removingId, setRemovingId]     = useState<string | null>(null);

  const handleAddPrestito = useCallback(async () => {
    if (!user) return;
    const amt = parseFloat(prestImporto.replace(',', '.'));
    if (!prestPersona.trim())         { setPrestErr('Inserisci il nome'); return; }
    if (!prestImporto || isNaN(amt) || amt <= 0) { setPrestErr('Importo non valido'); return; }
    setPrestErr(''); setPrestSubmitting(true);
    const sub = prestTipo === 'dato' ? 'prestito_dato' : 'prestito_ricevuto';
    const saved = await saveEntry(user.id, 'finance', {
      subcategory: sub, persona: prestPersona.trim(), importo: amt,
      data: prestData, note: prestNote.trim() || undefined, saldato: false,
    });
    setPrestSubmitting(false);
    if (saved) {
      setShowAddPrest(false); setPrestPersona(''); setPrestImporto(''); setPrestNote('');
      if (activeWidget) setActiveWidget({ ...activeWidget, entries: [...activeWidget.entries, saved] });
    } else {
      setPrestErr('Errore salvataggio.');
    }
  }, [user, prestTipo, prestPersona, prestImporto, prestData, prestNote, activeWidget, setActiveWidget]);

  const handleToggleSaldato = useCallback(async (id: string, current: boolean) => {
    setTogglingId(id);
    const entry = allPrestiti.find(e => e.id === id);
    if (entry) {
      const newData = { ...entry.data, saldato: !current };
      await updateEntryData(id, newData);
      if (activeWidget) {
        const updated = activeWidget.entries.map(e => e.id === id ? { ...e, data: newData } : e);
        setActiveWidget({ ...activeWidget, entries: updated });
      }
    }
    setTogglingId(null);
  }, [allPrestiti, activeWidget, setActiveWidget]);

  const handleDeletePrestito = useCallback(async (id: string) => {
    setRemovingId(id);
    await deleteEntry(id);
    if (activeWidget) setActiveWidget({ ...activeWidget, entries: activeWidget.entries.filter(e => e.id !== id) });
    setRemovingId(null);
  }, [activeWidget, setActiveWidget]);

  // patrimonio running balance
  const sortedAll = [...entries]
    .filter(e => e.data.type === 'income' || e.data.type === 'expense')
    .sort((a, b) => ((a.data.date as string | undefined) || a.created_at).localeCompare((b.data.date as string | undefined) || b.created_at));
  let cumBal = 0;
  const nwRaw = sortedAll.map(e => {
    cumBal += e.data.type === 'income' ? ((e.data.amount as number) ?? 0) : -((e.data.amount as number) ?? 0);
    return { key: ((e.data.date as string | undefined) || e.created_at).slice(0, 7), value: cumBal };
  });
  const nwByMonth = Object.values(
    nwRaw.reduce((acc, d) => {
      acc[d.key] = { month: d.key.slice(5, 7) + '/' + d.key.slice(2, 4), value: d.value };
      return acc;
    }, {} as Record<string, { month: string; value: number }>)
  ).slice(-12);
  const currentNetWorth = nwByMonth.at(-1)?.value ?? balance;

  // da associare
  const unassociated = entries.filter(e => e.data.type === 'expense' && (!e.data.subcategory || e.data.subcategory === 'da_associare'));
  const assocGroups = new Map<string, VaultEntry[]>();
  for (const e of unassociated) {
    const key = ((e.data.label as string) || '').toLowerCase().trim();
    if (!assocGroups.has(key)) assocGroups.set(key, []);
    assocGroups.get(key)!.push(e);
  }
  const unassocCount = unassociated.length;

  const filtered = entries
    .filter(e => filter === 'all' || e.data.type === filter)
    .filter(e => !search || ((e.data.label as string) ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => ((b.data.date as string | undefined) || b.created_at).localeCompare((a.data.date as string | undefined) || a.created_at));

  // ── Handlers ──────────────────────────────────────────────────────
  const handleManualAdd = async () => {
    const amount = parseFloat(addAmount.replace(',', '.'));
    if (!amount || !addLabel.trim() || !user) return;
    setAddSubmitting(true);
    const subcategory = applyRule(user.id, addLabel.trim()) ?? 'da_associare';
    const saved = await saveEntry(user.id, 'finance', {
      type: addType, amount: Math.abs(amount),
      label: addLabel.trim(), date: new Date(addDate).toISOString(),
      source: 'manual', subcategory,
    });
    if (saved) {
      const { activeWidget } = useAlterStore.getState();
      if (activeWidget) setActiveWidget({ ...activeWidget, entries: [saved, ...activeWidget.entries] });
    }
    setAddAmount(''); setAddLabel('');
    setAddSubmitting(false);
    setImportStatus(`✓ ${addType === 'income' ? 'Entrata' : 'Uscita'} aggiunta`);
    setTimeout(() => setImportStatus(null), 2500);
  };

  const handleImportFile = async (file: File) => {
    if (!user) return;
    const name = file.name.toLowerCase();
    setImportStatus('Lettura file...');
    try {
      let result;
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        result = await importBankXlsx(file, user.id, (d, t) => setImportStatus(`${d}/${t} righe...`));
      } else if (name.endsWith('.csv')) {
        const text = await file.text();
        result = await importBankCsv(text, user.id, (d, t) => setImportStatus(`${d}/${t} righe...`));
      } else if (name.endsWith('.pdf')) {
        setImportStatus('Estrazione testo PDF...');
        const ocr = await extractDocument(file);
        const txs = parseBankPdfText(ocr.text);
        if (txs.length === 0) { setImportStatus('Nessuna transazione trovata.'); return; }
        result = await importParsedTransactions(txs, user.id, (d, t) => setImportStatus(`${d}/${t}...`));
      }
      if (result) {
        const { imported, duplicates } = result;
        setImportStatus(duplicates.length > 0
          ? `✓ ${imported} importate · ⚠ ${duplicates.length} doppio${duplicates.length === 1 ? '' : 'i'}`
          : `✓ ${imported} transazioni importate`
        );
      }
    } catch { setImportStatus('Errore importazione.'); }
    setTimeout(() => setImportStatus(null), 6000);
  };

  const C = color || GOLD;

  // ── HUB ───────────────────────────────────────────────────────────
  if (!singleMode && tab === null) {
    const hubCards = [
      { id: 'transazioni' as FinanceTab, Icon: CreditCard,    label: 'Transazioni', metric: String(expenses.length + income.length), sub: 'movimenti totali',            accent: '#5187c8' },
      { id: 'cashflow'    as FinanceTab, Icon: TrendingUp,    label: 'Cashflow',    metric: `${months6[5]?.netto >= 0 ? '+' : ''}€${(months6[5]?.netto ?? 0).toFixed(0)}`, sub: 'netto ' + MESI[_now.getMonth()], accent: '#2fa87a' },
      { id: 'budget'      as FinanceTab, Icon: Target,        label: 'Budget',      metric: bgtTotalTarget > 0 ? `${Math.round(bgtRingPct)}%` : String(recurring.length), sub: bgtTotalTarget > 0 ? 'budget usato' : 'spese fisse rilevate', accent: C },
      { id: 'prestiti'    as FinanceTab, Icon: ArrowLeftRight, label: 'Prestiti',   metric: `€${(totalDebt + totalCredit).toFixed(0)}`, sub: `${debtEntries.length + creditEntries.length} registrazioni`, accent: '#b89630' },
      { id: 'patrimonio'  as FinanceTab, Icon: Landmark,      label: 'Patrimonio',  metric: `${currentNetWorth >= 0 ? '+' : ''}€${Math.abs(currentNetWorth).toFixed(0)}`, sub: 'saldo accumulato', accent: '#8b72d0' },
      { id: 'analisi'     as FinanceTab, Icon: BarChart2,     label: 'Analisi',     metric: topDay >= 0 && maxDaySpend > 0 ? DAYS_IT[topDay] : '—', sub: 'giorno top spese', accent: '#c96f6f' },
    ];

    return (
      <div>
        {/* hero balance */}
        <div style={{
          padding: '24px 24px 20px', borderRadius: 20, marginBottom: 12,
          background: balance >= 0 ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.05)',
          border: `1px solid ${balance >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`,
        }}>
          <div style={labelStyle}>Saldo mensile</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 18 }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: balance >= 0 ? T.income : T.expense, letterSpacing: '-0.04em', lineHeight: 1, ...numStyle }}>
              {balance >= 0 ? '+' : '-'}€{Math.abs(balance).toFixed(0)}
            </div>
            {savings != null && (
              <div style={{ paddingBottom: 6 }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>Risparmio</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: T.warning, ...numStyle }}>{savings}%</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
            {[
              { label: 'Entrate',   value: `+€${totalIn.toFixed(0)}`,    clr: T.income },
              { label: 'Uscite',    value: `-€${totalOut.toFixed(0)}`,   clr: T.expense },
              { label: 'Burn rate', value: `€${burnRate.toFixed(0)}/m`,  clr: T.textSecondary },
            ].map((item, i) => (
              <div key={item.label} style={{ flex: 1, paddingLeft: i > 0 ? 16 : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none', marginLeft: i > 0 ? 16 : 0 }}>
                <div style={labelStyle}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: item.clr, ...numStyle }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* da associare alert */}
        {unassocCount > 0 && (
          <motion.div
            onClick={() => setTab('associa')}
            whileHover={{ backgroundColor: 'rgba(251,191,36,0.09)', borderColor: 'rgba(251,191,36,0.28)' }}
            transition={{ duration: 0.15, ease: EASE }}
            style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 10, cursor: 'pointer', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.20)', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.warning, boxShadow: `0 0 8px ${T.warning}`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 400, color: T.warning }}>{unassocCount} spese senza categoria</div>
              <div style={{ fontSize: 10, color: 'rgba(251,191,36,0.55)', marginTop: 2 }}>{assocGroups.size} gruppi · tocca per categorizzare</div>
            </div>
            <span style={{ fontSize: 16, color: 'rgba(251,191,36,0.35)' }}>›</span>
          </motion.div>
        )}

        {/* 6 card grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {hubCards.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setTab(s.id)}
              whileHover={{ backgroundColor: `${s.accent}0D`, borderColor: `${s.accent}35` }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.18, ease: EASE, delay: i * 0.04 }}
              style={{ padding: '16px 18px 14px', borderRadius: 16, cursor: 'pointer', background: T.cardBg, border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <s.Icon size={15} style={{ color: s.accent, marginBottom: 10, opacity: 0.85 }} />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 7 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: T.textPrimary, marginBottom: 4, ...numStyle }}>{s.metric}</div>
              <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: '0.01em' }}>{s.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* aggiungi FAB */}
        <motion.div
          onClick={() => setTab('aggiungi')}
          whileHover={{ backgroundColor: `${C}0A`, borderColor: `${C}30` }}
          transition={{ duration: 0.15, ease: EASE }}
          style={{ marginTop: 10, padding: '14px 18px', borderRadius: 14, cursor: 'pointer', background: T.cardBg, border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${C}15`, border: `1px solid ${C}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: C, flexShrink: 0, fontWeight: 400 }}>+</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>Aggiungi transazione</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>Manuale o importa estratto conto</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 16, color: 'rgba(255,255,255,0.30)' }}>›</span>
        </motion.div>
      </div>
    );
  }

  const currentTab = tab ?? normalizedTab ?? 'transazioni';

  const BackBtn = () => (
    <motion.button
      onClick={() => setTab(null)}
      whileHover={{ color: 'rgba(255,255,255,0.65)' }}
      transition={{ duration: 0.15 }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 22px', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}
    >
      ← {currentTab}
    </motion.button>
  );

  return (
    <div>
      {!singleMode && <BackBtn />}

      {/* ── TRANSAZIONI ── */}
      {currentTab === 'transazioni' && (
        <div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 16, alignItems: 'center' }}>
            {(['all', 'expense', 'income'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 10, border: `1px solid ${filter === f ? `${C}35` : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', background: filter === f ? `${C}22` : T.cardBg, color: filter === f ? C : T.textDim, transition: 'all 0.15s' }}>
                {f === 'all' ? 'Tutte' : f === 'expense' ? 'Uscite' : 'Entrate'}
              </button>
            ))}
            <input placeholder="Cerca..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.borderClr}`, padding: '4px 2px', fontSize: 11, color: T.textSecondary, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', padding: 32 }}>Nessuna transazione</div>}
            {filtered.map((e, idx) => {
              const isIncome = e.data.type === 'income';
              const amt = (e.data.amount as number)?.toFixed(2) ?? '?';
              const lbl = (e.data.label as string) ?? '—';
              const date = new Date((e.data.date as string | undefined) || e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
              const sub = (e.data.subcategory as string | undefined);
              const isOpen = expandedTxnId === e.id;
              const dotColor = isIncome ? T.income : T.expense;
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.5), ease: EASE }}
                  style={{ borderRadius: 10, overflow: 'hidden', background: isOpen ? `${dotColor}0A` : T.cardBg, border: isOpen ? `1px solid ${dotColor}25` : '1px solid rgba(255,255,255,0.07)', transition: 'all 0.15s' }}
                >
                  {/* Main row */}
                  <div
                    onClick={() => setExpandedTxnId(isOpen ? null : e.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 10, color: isOpen ? dotColor : T.textMuted, transition: 'color 0.15s' }}>
                      {isOpen ? '▾' : '▸'}
                    </span>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, opacity: 0.9 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.80)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lbl}</div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{date}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: dotColor, flexShrink: 0, ...numStyle }}>
                      {isIncome ? '+' : '-'}€{amt}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '2px 12px 10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, display: 'flex', gap: 12 }}>
                            {sub && sub !== 'da_associare' && (
                              <div>
                                <div style={labelStyle}>Categoria</div>
                                <div style={{ fontSize: 11, color: T.textSecondary }}>{sub}</div>
                              </div>
                            )}
                            <div>
                              <div style={labelStyle}>Data completa</div>
                              <div style={{ fontSize: 11, color: T.textSecondary }}>
                                {new Date((e.data.date as string | undefined) || e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={async (ev) => {
                              ev.stopPropagation();
                              setRemovingTxnId(e.id);
                              await deleteEntry(e.id);
                              if (activeWidget) setActiveWidget({ ...activeWidget, entries: activeWidget.entries.filter(x => x.id !== e.id) });
                              setExpandedTxnId(null);
                              setRemovingTxnId(null);
                            }}
                            disabled={removingTxnId === e.id}
                            style={{
                              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.20)',
                              borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
                              fontSize: 10, color: removingTxnId === e.id ? T.textMuted : T.expense,
                              letterSpacing: '0.06em', transition: 'all 0.15s', flexShrink: 0,
                            }}
                          >
                            {removingTxnId === e.id ? '…' : '✕ Elimina'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CASHFLOW ── */}
      {currentTab === 'cashflow' && (
        <div>
          <div style={{ display: 'flex', gap: 28, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <div style={labelStyle}>Saldo netto</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: balance >= 0 ? T.income : T.expense, letterSpacing: '-0.04em', ...numStyle }}>
                {balance >= 0 ? '+' : '-'}€{Math.abs(balance).toFixed(0)}
              </div>
            </div>
            {savings != null && (
              <div>
                <div style={labelStyle}>Risparmio</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: T.warning, ...numStyle }}>{savings}%</div>
              </div>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <div style={labelStyle}>Burn rate</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: T.textSecondary, ...numStyle }}>€{burnRate.toFixed(0)}<span style={{ fontSize: 11, opacity: 0.6 }}>/m</span></div>
            </div>
          </div>
          <div style={labelStyle}>Entrate vs Uscite · 6 mesi</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={months6} barGap={3} barCategoryGap="28%" margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} axisLine={false} tickLine={false} width={32} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [`€${v.toFixed(0)}`, n === 'entrate' ? '↑ Entrate' : '↓ Uscite']} cursor={{ fill: 'rgba(255,255,255,0.025)' }} />
              <Bar dataKey="entrate" fill={T.income} fillOpacity={0.55} radius={[3,3,0,0]} />
              <Bar dataKey="uscite"  fill={T.expense} fillOpacity={0.55} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ ...labelStyle, margin: '20px 0 8px' }}>Netto mensile</div>
          <ResponsiveContainer width="100%" height={72}>
            <AreaChart data={months6} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cfNetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={balance >= 0 ? T.income : T.expense} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={balance >= 0 ? T.income : T.expense} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`€${v.toFixed(0)}`, 'Netto']} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="netto" stroke={balance >= 0 ? T.income : T.expense} strokeWidth={2} fill="url(#cfNetGrad)" dot={{ fill: balance >= 0 ? T.income : T.expense, r: 3, strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
            {months6.map(m => {
              const c = m.netto >= 0 ? T.income : T.expense;
              return (
                <div key={m.key} style={{ flex: 1, textAlign: 'center', padding: '7px 4px', borderRadius: 8, background: `${c}0D`, border: `1px solid ${c}20` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c, ...numStyle }}>{m.netto >= 0 ? '+' : ''}{m.netto.toFixed(0)}</div>
                  <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BUDGET & RICORRENTI ── */}
      {currentTab === 'budget' && (
        <div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 20, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }}>
            {(['budget', 'ricorrenti'] as const).map(t => (
              <button key={t} onClick={() => setBudgetSubTab(t)} style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', borderRadius: 8, fontSize: 10, fontWeight: budgetSubTab === t ? 500 : 400, letterSpacing: '0.05em', transition: 'all 0.18s', background: budgetSubTab === t ? 'rgba(255,255,255,0.10)' : 'transparent', color: budgetSubTab === t ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)' }}>
                {t === 'budget' ? 'Budget' : 'Ricorrenti'}
              </button>
            ))}
          </div>

          {budgetSubTab === 'budget' && (
            <div>
              {bgtTotalTarget > 0 && (
                <div style={{ marginBottom: 20, padding: '18px', borderRadius: 14, background: T.cardBg, border: '1px solid rgba(255,255,255,0.10)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>{bgtMonthLabel}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 26, fontWeight: 700, color: bgtRingOver ? T.expense : T.textPrimary, letterSpacing: '-0.03em', ...numStyle }}>€{bgtTotalSpent.toFixed(0)}</span>
                        <span style={{ fontSize: 12, color: T.textDim }}>/ €{bgtTotalTarget.toFixed(0)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: bgtRingOver ? T.expense : bgtRingWarn ? T.warning : T.income }}>
                        {bgtRingOver ? `⚠ Superato di €${(bgtTotalSpent - bgtTotalTarget).toFixed(0)}` : `€${(bgtTotalTarget - bgtTotalSpent).toFixed(0)} rimanenti · ${(100 - bgtRingPct).toFixed(0)}%`}
                      </div>
                    </div>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <svg viewBox="0 0 36 36" style={{ width: 64, height: 64 }}>
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2.8" />
                        <circle cx="18" cy="18" r="15.9" fill="none"
                          stroke={bgtRingOver ? T.expense : bgtRingWarn ? T.warning : T.income}
                          strokeWidth="2.8" strokeLinecap="round"
                          strokeDasharray={`${bgtRingPct} ${100 - bgtRingPct}`} strokeDashoffset="25"
                          style={{ transition: 'stroke-dasharray 0.6s ease' }}
                        />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: bgtRingOver ? T.expense : bgtRingWarn ? T.warning : 'rgba(255,255,255,0.65)', ...numStyle }}>
                        {Math.round(bgtRingPct)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ ...labelStyle, marginBottom: 12 }}>Categorie · clicca per impostare</div>
              {spentThisMonth.size === 0 && Object.keys(budgets).length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: T.textMuted, fontSize: 11 }}>Nessuna spesa questo mese</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {bgtAllLabels.sort((a, b) => (spentThisMonth.get(b) ?? 0) - (spentThisMonth.get(a) ?? 0)).map((lbl, i) => {
                  const spent  = spentThisMonth.get(lbl) ?? 0;
                  const budget = budgets[lbl];
                  const has    = budget !== undefined && budget > 0;
                  const pct    = has ? Math.min(100, (spent / budget) * 100) : 0;
                  const over   = has && spent > budget;
                  const warn   = has && pct >= 80 && !over;
                  const c      = over ? T.expense : warn ? T.warning : PIE_PALETTE[i % PIE_PALETTE.length];
                  const isEdit = editBudgetLabel === lbl;
                  const saveBudget = () => {
                    const n = parseFloat(editBudgetVal);
                    if (!isNaN(n) && n > 0) {
                      const u = { ...budgets, [lbl]: n };
                      setBudgets(u); localStorage.setItem('_alter_budget', JSON.stringify(u));
                    } else {
                      const u = { ...budgets }; delete u[lbl];
                      setBudgets(u); localStorage.setItem('_alter_budget', JSON.stringify(u));
                    }
                    setEditBudgetLabel(null);
                  };
                  return (
                    <motion.div key={lbl}
                      onClick={() => { if (!isEdit) { setEditBudgetLabel(lbl); setEditBudgetVal(has ? String(budget) : ''); } }}
                      whileHover={!isEdit ? { backgroundColor: `${c}0A`, borderColor: `${c}22` } : {}}
                      transition={{ duration: 0.15, ease: EASE }}
                      style={{ padding: '12px 14px', borderRadius: 10, cursor: isEdit ? 'default' : 'pointer', background: over ? 'rgba(248,113,113,0.05)' : T.cardBg, border: `1px solid ${over ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.08)'}` }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: has && !isEdit ? 8 : 0 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0, boxShadow: `0 0 5px ${c}60` }} />
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lbl}</span>
                        {isEdit ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={ev => ev.stopPropagation()}>
                            <span style={{ fontSize: 11, color: T.textDim }}>€</span>
                            <input value={editBudgetVal} onChange={ev => setEditBudgetVal(ev.target.value)} placeholder="Budget" autoFocus type="number" min="0" onKeyDown={ev => { if (ev.key === 'Enter') saveBudget(); if (ev.key === 'Escape') setEditBudgetLabel(null); }} onBlur={saveBudget} style={{ width: 70, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#fff', outline: 'none' }} />
                            <button onClick={saveBudget} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.income, fontSize: 13 }}>✓</button>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'right' }}>
                            {has ? (
                              <>
                                <span style={{ fontSize: 13, fontWeight: 600, color: c, ...numStyle }}>€{spent.toFixed(0)}</span>
                                <span style={{ fontSize: 10, color: T.textDim }}> / €{budget}</span>
                                {over && <span style={{ marginLeft: 6, fontSize: 9, color: T.expense }}>over</span>}
                              </>
                            ) : (
                              <>
                                {spent > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, ...numStyle }}>€{spent.toFixed(0)} </span>}
                                <span style={{ fontSize: 10, color: T.textDim, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '1px 6px' }}>+ budget</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {has && !isEdit && (
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: c, transition: 'width 0.5s ease' }} />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {budgetSubTab === 'ricorrenti' && (
            <div>
              <div style={labelStyle}>Rilevate su ≥2 mesi</div>
              {recurring.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0' }}>
                  <div style={{ fontSize: 22, opacity: 0.15, marginBottom: 12 }}>🔄</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>Nessuna ricorrente rilevata</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', marginTop: 6 }}>Serve almeno 2 mesi di dati</div>
                </div>
              ) : (
                <>
                  {recurring.map(([lbl, months], i) => {
                    const total = labelMap.get(lbl) ?? 0;
                    const avg   = months.size > 0 ? total / months.size : 0;
                    return (
                      <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>{lbl}</div>
                          <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{months.size} mesi</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, ...numStyle }}>€{avg.toFixed(0)}<span style={{ fontSize: 10, opacity: 0.55 }}>/m</span></div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                    <span style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>Impegni fissi/mese</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: T.warning, ...numStyle }}>€{recurring.reduce((s, [lbl]) => s + (labelMap.get(lbl) ?? 0) / (labelMonths.get(lbl)?.size ?? 1), 0).toFixed(0)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PRESTITI ── */}
      {currentTab === 'prestiti' && (() => {
        const saldoNetto = totalCredit - totalDebt;
        const filteredPrest = allPrestiti
          .filter(p => prestFilter === 'tutti' || p._tipo === prestFilter)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        const fmtDate = (iso: string) =>
          new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
        const TIPO_CFG = {
          dato:     { color: T.income,  badge: 'Credito' },
          ricevuto: { color: T.expense, badge: 'Debito'  },
        };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Da riscuotere', value: totalCredit, color: T.income },
                { label: 'Da restituire', value: totalDebt,   color: T.expense },
                { label: 'Saldo netto',   value: saldoNetto,  color: saldoNetto >= 0 ? T.warning : T.expense },
              ].map(k => (
                <div key={k.label} style={{ padding: '14px 12px', borderRadius: 12, background: T.cardBg, border: '1px solid rgba(255,255,255,0.10)' }}>
                  <div style={labelStyle}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.03em', ...numStyle }}>
                    {k.value >= 0 ? '' : '-'}€{Math.abs(k.value).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {([['tutti', 'Tutti', allPrestiti.length], ['dato', 'Prestati', prestitiDati.length], ['ricevuto', 'Ricevuti', prestitiRicevuti.length]] as const).map(([id, lbl, cnt]) => (
                <button
                  key={id}
                  onClick={() => setPrestFilter(id)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: prestFilter === id ? 'rgba(255,255,255,0.10)' : 'transparent',
                    border: `1px solid ${prestFilter === id ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.10)'}`,
                    color: prestFilter === id ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.45)',
                    transition: 'all 0.15s',
                  }}
                >
                  {lbl} <span style={{ opacity: 0.6 }}>{cnt}</span>
                </button>
              ))}
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredPrest.length === 0 && (
                <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 11, color: T.textMuted }}>
                  {allPrestiti.length === 0 ? 'Nessun prestito. Aggiungi il primo.' : 'Nessun elemento in questa categoria.'}
                </p>
              )}
              <AnimatePresence>
                {filteredPrest.map(p => {
                  const cfg = TIPO_CFG[p._tipo];
                  const importo = (p.data.importo as number) ?? (p.data.amount as number) ?? 0;
                  const persona = (p.data.persona as string) ?? (p.data.who as string) ?? (p.data.label as string) ?? '—';
                  const note    = p.data.note as string | undefined;
                  const dateStr = fmtDate((p.data.data as string) ?? p.created_at);
                  const saldato = Boolean(p.data.saldato);
                  return (
                    <motion.div
                      key={p.id} layout
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: saldato ? 0.45 : 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: T.cardBg, border: '1px solid rgba(255,255,255,0.09)', borderLeft: `3px solid ${cfg.color}`, transition: 'background 0.15s' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.90)' }}>{persona}</span>
                          <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: cfg.color, opacity: 0.80 }}>{cfg.badge}</span>
                        </div>
                        {note && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</div>}
                        <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{dateStr}</div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.90)', flexShrink: 0, ...numStyle }}>
                        {p._tipo === 'ricevuto' ? '-' : '+'}€{importo.toFixed(0)}
                      </span>
                      <button
                        onClick={() => handleToggleSaldato(p.id, saldato)}
                        disabled={togglingId === p.id}
                        title={saldato ? 'Riapri' : 'Segna saldato'}
                        style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1px solid ${saldato ? T.income : 'rgba(255,255,255,0.14)'}`,
                          background: saldato ? 'rgba(52,211,153,0.12)' : 'transparent',
                          color: saldato ? T.income : 'rgba(255,255,255,0.30)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <Check size={11} />
                      </button>
                      <button
                        onClick={() => handleDeletePrestito(p.id)}
                        disabled={removingId === p.id}
                        style={{
                          width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.10)', background: 'transparent',
                          color: 'rgba(255,255,255,0.25)', transition: 'all 0.15s',
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Add form */}
            <AnimatePresence>
              {showAddPrest && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE }} style={{ overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px', borderRadius: 12, background: T.cardBg, border: '1px solid rgba(255,255,255,0.10)' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={prestTipo}
                        onChange={e => setPrestTipo(e.target.value as 'dato' | 'ricevuto')}
                        style={{ ...inputBase, flex: '0 0 130px' }}
                      >
                        <option value="dato">Prestato</option>
                        <option value="ricevuto">Ricevuto</option>
                      </select>
                      <input style={inputBase} placeholder="Persona" value={prestPersona} onChange={e => setPrestPersona(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input style={{ ...inputBase, flex: 1 }} type="number" min="0.01" step="0.01" placeholder="€ importo" value={prestImporto} onChange={e => setPrestImporto(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPrestito()} />
                      <input style={{ ...inputBase, flex: 1 }} type="date" value={prestData} onChange={e => setPrestData(e.target.value)} />
                    </div>
                    <input style={inputBase} placeholder="Note (opzionale)" value={prestNote} onChange={e => setPrestNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPrestito()} />
                    {prestErr && <p style={{ fontSize: 10, color: T.expense, margin: 0 }}>{prestErr}</p>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleAddPrestito} disabled={prestSubmitting || !prestPersona || !prestImporto}
                        style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.80)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                      >
                        {prestSubmitting ? '…' : '+ Aggiungi'}
                      </button>
                      <button
                        onClick={() => { setShowAddPrest(false); setPrestErr(''); }}
                        style={{ padding: '11px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: T.textDim, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <X size={12} /> Annulla
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showAddPrest && (
              <button
                onClick={() => setShowAddPrest(true)}
                style={{ padding: '12px', borderRadius: 10, background: 'transparent', border: '1px dashed rgba(255,255,255,0.18)', color: T.textDim, fontSize: 13, fontWeight: 400, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                + Aggiungi prestito
              </button>
            )}
          </div>
        );
      })()}

      {/* ── PATRIMONIO ── */}
      {currentTab === 'patrimonio' && (
        <div>
          <div style={{ padding: '22px 22px 18px', borderRadius: 18, marginBottom: 20, background: T.cardBg, border: '1px solid rgba(255,255,255,0.10)' }}>
            <div style={labelStyle}>Patrimonio netto</div>
            <div style={{ fontSize: 44, fontWeight: 700, color: currentNetWorth >= 0 ? '#8b72d0' : T.expense, letterSpacing: '-0.04em', marginBottom: 18, ...numStyle }}>
              {currentNetWorth >= 0 ? '+' : '-'}€{Math.abs(currentNetWorth).toFixed(0)}
            </div>
            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
              {[
                { label: 'Entrate totali', value: `+€${totalIn.toFixed(0)}`, clr: T.income },
                { label: 'Uscite totali',  value: `-€${totalOut.toFixed(0)}`, clr: T.expense },
              ].map((item, i) => (
                <div key={item.label} style={{ flex: 1, paddingLeft: i > 0 ? 16 : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none', marginLeft: i > 0 ? 16 : 0 }}>
                  <div style={labelStyle}>{item.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: item.clr, ...numStyle }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {nwByMonth.length >= 2 ? (
            <>
              <div style={labelStyle}>Andamento patrimonio</div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={nwByMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b72d0" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#8b72d0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`€${v.toFixed(0)}`, 'Patrimonio']} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="value" stroke="#8b72d0" strokeWidth={2} fill="url(#nwGrad)" dot={{ fill: '#8b72d0', r: 3, strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: T.textMuted, fontSize: 11 }}>
              Aggiungi più transazioni per vedere l'andamento nel tempo
            </div>
          )}
        </div>
      )}

      {/* ── ANALISI ── */}
      {currentTab === 'analisi' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {[
              { label: 'Burn Rate',     value: `€${burnRate.toFixed(0)}`,     sub: 'proiezione mensile', clr: T.expense },
              { label: 'Media/giorno',  value: `€${dayOfMonth > 0 ? (totalOut / dayOfMonth).toFixed(0) : '0'}`, sub: `ultimi ${dayOfMonth}gg`, clr: '#60a5fa' },
              { label: 'Fine mese',     value: `€${projMonthEnd.toFixed(0)}`,  sub: `${daysLeft}gg rimasti`, clr: T.income },
              { label: 'Top categoria', value: pieData[0]?.name ?? '—',        sub: `€${(pieData[0]?.value ?? 0).toFixed(0)}`, clr: T.warning },
            ].map(k => (
              <div key={k.label} style={{ padding: '16px 18px', borderRadius: 13, background: `${k.clr}0A`, border: `1px solid ${k.clr}20` }}>
                <div style={labelStyle}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: k.clr, letterSpacing: '-0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{k.value}</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={labelStyle}>Spesa per giorno della settimana</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 72, marginBottom: 20 }}>
            {DAYS_IT.map((d, i) => {
              const v    = daySpend[i];
              const pct  = maxDaySpend > 0 ? (v / maxDaySpend) * 100 : 0;
              const isTop = i === topDay && v > 0;
              const barC = isTop ? T.expense : 'rgba(255,255,255,0.10)';
              return (
                <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: 3, height: 54, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: `${Math.max(pct, v > 0 ? 4 : 0)}%`, background: barC, borderRadius: 3, transition: 'height 0.4s', boxShadow: isTop ? `0 0 8px ${barC}80` : 'none' }} />
                  </div>
                  <span style={{ fontSize: 10, color: isTop ? T.expense : T.textDim }}>{d}</span>
                </div>
              );
            })}
          </div>
          {pieData.length > 0 && (
            <>
              <div style={labelStyle}>Breakdown categorie</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pieData.map((d, i) => {
                  const pct = totalOut > 0 ? (d.value / totalOut) * 100 : 0;
                  const c   = PIE_PALETTE[i % PIE_PALETTE.length];
                  return (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: c, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 400, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                      <div style={{ width: 90, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: c, minWidth: 44, textAlign: 'right', ...numStyle }}>€{d.value.toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── AGGIUNGI ── */}
      {currentTab === 'aggiungi' && (
        <div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 20, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }}>
            {(['form', 'import'] as const).map(m => (
              <button key={m} onClick={() => setAddMode(m)} style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', borderRadius: 8, fontSize: 10, fontWeight: addMode === m ? 500 : 400, letterSpacing: '0.06em', transition: 'all 0.18s', background: addMode === m ? 'rgba(255,255,255,0.10)' : 'transparent', color: addMode === m ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)' }}>
                {m === 'form' ? 'Manuale' : 'Importa file'}
              </button>
            ))}
          </div>
          {addMode === 'form' && (
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {(['expense', 'income'] as const).map(t => (
                  <button key={t} onClick={() => setAddType(t)} style={{ flex: 1, padding: '11px 0', border: `1px solid ${addType === t ? (t === 'expense' ? T.expense : T.income) : 'rgba(255,255,255,0.10)'}`, borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: 500, transition: 'all 0.18s', background: addType === t ? (t === 'expense' ? 'rgba(248,113,113,0.10)' : 'rgba(52,211,153,0.10)') : 'transparent', color: addType === t ? (t === 'expense' ? T.expense : T.income) : T.textDim }}>
                    {t === 'expense' ? '↓ Uscita' : '↑ Entrata'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: T.textDim, pointerEvents: 'none', fontWeight: 400 }}>€</span>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={addAmount} onChange={e => setAddAmount(e.target.value)} style={{ ...inputBase, paddingLeft: 32 }} onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.25)')} onBlur={e => (e.target.style.borderColor = T.borderClr)} />
                </div>
                <input type="text" placeholder="Descrizione (es. supermercato, stipendio...)" value={addLabel} onChange={e => setAddLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleManualAdd()} style={inputBase} onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.25)')} onBlur={e => (e.target.style.borderColor = T.borderClr)} />
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} style={{ ...inputBase, colorScheme: 'dark', color: T.textSecondary }} />
              </div>
              <button
                onClick={handleManualAdd} disabled={addSubmitting || !addAmount || !addLabel}
                style={{ width: '100%', padding: '13px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', transition: 'all 0.18s', background: addSubmitting || !addAmount || !addLabel ? T.cardBg : addType === 'expense' ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)', color: addSubmitting || !addAmount || !addLabel ? T.textMuted : addType === 'expense' ? T.expense : T.income, border: `1px solid ${addSubmitting || !addAmount || !addLabel ? T.borderClr : addType === 'expense' ? 'rgba(248,113,113,0.25)' : 'rgba(52,211,153,0.25)'}` }}
              >
                {addSubmitting ? 'Salvataggio...' : `Aggiungi ${addType === 'expense' ? 'uscita' : 'entrata'}`}
              </button>
              {importStatus && <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: T.income, letterSpacing: '0.04em' }}>{importStatus}</div>}
            </div>
          )}
          {addMode === 'import' && (
            <div>
              <input ref={addFileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }} />
              <div
                onClick={() => addFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = `${C}50`; }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; const f = e.dataTransfer.files[0]; if (f) handleImportFile(f); }}
                style={{ padding: '36px 20px', borderRadius: 16, cursor: 'pointer', textAlign: 'center', background: T.cardBg, border: '1px dashed rgba(255,255,255,0.15)', transition: 'all 0.18s' }}
              >
                <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>📎</div>
                <div style={{ fontSize: 13, fontWeight: 400, color: T.textSecondary, marginBottom: 6 }}>Trascina o clicca per selezionare</div>
                <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.08em' }}>CSV · XLSX · PDF estratto conto</div>
              </div>
              {importStatus && (() => {
                const mx = importStatus.match(/(\d+)\/(\d+)/);
                const prog = mx ? { done: +mx[1], total: +mx[2], pct: Math.min(100, Math.round(+mx[1] / +mx[2] * 100)) } : null;
                const isDone = importStatus.startsWith('✓');
                const isError = importStatus.startsWith('Errore');
                const statusColor = isDone ? T.income : isError ? T.expense : T.textSecondary;
                return (
                  <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: isDone ? 'rgba(52,211,153,0.05)' : isError ? 'rgba(248,113,113,0.05)' : T.cardBg, border: `1px solid ${isDone ? 'rgba(52,211,153,0.20)' : isError ? 'rgba(248,113,113,0.20)' : T.borderClr}` }}>
                    {prog ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 10, color: T.textDim }}>
                          <span>Importazione…</span><span style={{ color: C, fontWeight: 600 }}>{prog.pct}%</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, transition: 'width 0.35s ease', width: `${prog.pct}%`, background: `linear-gradient(90deg, ${C}55, ${C})` }} />
                        </div>
                        <div style={{ marginTop: 7, fontSize: 10, color: T.textDim, textAlign: 'center' }}>{prog.done} / {prog.total} transazioni</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: statusColor, textAlign: 'center', letterSpacing: '0.04em' }}>{importStatus}</div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── DA ASSOCIARE ── */}
      {currentTab === 'associa' && (
        <div>
          {assocGroups.size === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 24, marginBottom: 12, opacity: 0.22 }}>✓</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Tutte le spese sono categorizzate</div>
            </div>
          ) : (
            <>
              <div style={{ ...labelStyle, marginBottom: 16 }}>{unassocCount} spese · {assocGroups.size} gruppi</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {[...assocGroups.entries()].sort((a, b) => b[1].length - a[1].length).map(([key, group]) => {
                  const lbl   = (group[0].data.label as string) || key;
                  const total = group.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
                  const inputVal = assocInputs[key] ?? '';
                  const isSaving = assocSaving === key;
                  const handleAssoc = async (all: boolean) => {
                    const sub = inputVal.trim();
                    if (!sub || !user) return;
                    setAssocSaving(key);
                    const targets = all ? group : [group[0]];
                    await Promise.all(targets.map(e => updateEntryData(e.id, { ...e.data, subcategory: sub })));
                    if (all) setRule(user.id, lbl, sub);
                    const { activeWidget, setActiveWidget: setAW } = useAlterStore.getState();
                    if (activeWidget) {
                      const updatedIds = new Set(targets.map(e => e.id));
                      setAW({ ...activeWidget, entries: activeWidget.entries.map(e => updatedIds.has(e.id) ? { ...e, data: { ...e.data, subcategory: sub } } : e) });
                    }
                    setAssocInputs(prev => { const n = { ...prev }; delete n[key]; return n; });
                    setAssocSaving(null);
                  };
                  return (
                    <div key={key} style={{ padding: '16px', borderRadius: 14, background: T.cardBg, border: '1px solid rgba(255,255,255,0.09)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.80)', wordBreak: 'break-word', lineHeight: 1.4 }}>{lbl}</div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: T.expense, ...numStyle }}>-€{total.toFixed(2)}</div>
                          {group.length > 1 && <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>×{group.length}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          placeholder="es. food, trasporti, bollette…"
                          value={inputVal}
                          onChange={e => setAssocInputs(prev => ({ ...prev, [key]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAssoc(true)}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 11, background: T.cardBg, border: `1px solid ${T.borderClr}`, color: 'rgba(255,255,255,0.85)', outline: 'none', transition: 'border-color 0.15s' }}
                          onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.25)')}
                          onBlur={e  => (e.target.style.borderColor = T.borderClr)}
                        />
                        {group.length > 1 && (
                          <button onClick={() => handleAssoc(false)} disabled={!inputVal.trim() || isSaving} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.10)', background: 'transparent', cursor: inputVal.trim() && !isSaving ? 'pointer' : 'default', fontSize: 10, color: T.textDim, transition: 'all 0.15s' }}>Solo 1</button>
                        )}
                        <button onClick={() => handleAssoc(true)} disabled={!inputVal.trim() || isSaving} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${inputVal.trim() ? 'rgba(251,191,36,0.30)' : T.borderClr}`, background: inputVal.trim() ? 'rgba(251,191,36,0.10)' : 'transparent', cursor: inputVal.trim() ? 'pointer' : 'default', fontSize: 10, color: inputVal.trim() ? T.warning : T.textMuted, transition: 'all 0.15s', whiteSpace: 'nowrap', fontWeight: 400 }}>
                          {isSaving ? '...' : group.length > 1 ? `Tutte (${group.length})` : 'Salva'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
