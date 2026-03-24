import { useState, useRef } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAlterStore } from '../../../store/alterStore';
import { saveEntry, updateEntryData } from '../../../vault/vaultService';
import { importBankCsv, importBankXlsx, parseBankPdfText, importParsedTransactions } from '../../../import/bankCsvImport';
import { extractDocument } from '../../../import/documentOcr';
import { applyRule, setRule } from '../../../core/descriptionRules';
import type { VaultEntry } from '../../../types';
import { Stat, EntryRow, TabBar, PIE_PALETTE } from './shared';

type FinanceTab = 'transazioni' | 'cashflow' | 'aggiungi' | 'budget' | 'ricorrenti' | 'analisi' | 'associa';

const FINANCE_FRAGMENTS: { id: FinanceTab; label: string; desc: string }[] = [
  { id: 'transazioni', label: 'Transazioni',  desc: 'Storico entrate e uscite' },
  { id: 'associa',     label: 'Da Associare', desc: 'Spese senza categoria' },
  { id: 'cashflow',    label: 'Cashflow',     desc: 'Trend ultimi 6 mesi' },
  { id: 'budget',      label: 'Budget',       desc: 'Obiettivi per categoria' },
  { id: 'ricorrenti',  label: 'Ricorrenti',   desc: 'Abbonamenti & fissi' },
  { id: 'analisi',     label: 'Analisi',      desc: 'Burn rate & proiezioni' },
  { id: 'aggiungi',    label: 'Aggiungi',     desc: 'Log veloce via chat' },
];

export default function FinanceRenderer({ entries, color, initialTab }: { entries: VaultEntry[]; color: string; initialTab?: string }) {
  const singleMode = !!initialTab;
  const normalizedTab = (initialTab === 'grafici' ? 'cashflow' : initialTab) as FinanceTab | undefined;
  const [tab, setTab] = useState<FinanceTab | null>(normalizedTab ?? null);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [search, setSearch] = useState('');
  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('_alter_budget') ?? '{}'); } catch { return {}; }
  });
  const [editBudgetLabel, setEditBudgetLabel] = useState<string | null>(null);
  const [editBudgetVal, setEditBudgetVal] = useState('');
  const { setActiveWidget, user } = useAlterStore();

  const [addMode,       setAddMode]       = useState<'form' | 'import'>('form');
  const [addType,       setAddType]       = useState<'expense' | 'income'>('expense');
  const [addAmount,     setAddAmount]     = useState('');
  const [addLabel,      setAddLabel]      = useState('');
  const [addDate,       setAddDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [importStatus,  setImportStatus]  = useState<string | null>(null);
  const addFileRef = useRef<HTMLInputElement>(null);

  // ── Da Associare state ─────────────────────────────────────
  const [assocInputs,  setAssocInputs]  = useState<Record<string, string>>({});
  const [assocSaving,  setAssocSaving]  = useState<string | null>(null);

  // ── Da Associare: group unassociated expenses by description ─
  const unassociated = entries.filter(e =>
    e.data.type === 'expense' &&
    (!e.data.subcategory || e.data.subcategory === 'da_associare')
  );
  const assocGroups = new Map<string, VaultEntry[]>();
  for (const e of unassociated) {
    const key = ((e.data.label as string) || '').toLowerCase().trim();
    if (!assocGroups.has(key)) assocGroups.set(key, []);
    assocGroups.get(key)!.push(e);
  }
  const unassocCount = unassociated.length;

  const expenses = entries.filter(e => e.data.type === 'expense');
  const income   = entries.filter(e => e.data.type === 'income');
  const totalOut = expenses.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
  const totalIn  = income.reduce((s, e)  => s + ((e.data.amount as number) ?? 0), 0);
  const balance  = totalIn - totalOut;
  const savings  = totalIn > 0 ? Math.round((balance / totalIn) * 100) : null;
  const dayOfMonth = new Date().getDate();
  const burnRate   = dayOfMonth > 0 ? (totalOut / dayOfMonth) * 30 : 0;
  const daysLeft   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - dayOfMonth;
  const projMonthEnd = dayOfMonth > 0 ? (totalOut / dayOfMonth) * (dayOfMonth + daysLeft) : 0;

  const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const _now = new Date();
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(_now.getFullYear(), _now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: MESI[d.getMonth()], entrate: 0, uscite: 0, netto: 0 };
  });
  for (const e of entries) {
    const key = e.created_at.slice(0, 7);
    const m = months6.find(mx => mx.key === key);
    if (!m) continue;
    if (e.data.type === 'income')  m.entrate += (e.data.amount as number) ?? 0;
    if (e.data.type === 'expense') m.uscite  += (e.data.amount as number) ?? 0;
  }
  for (const m of months6) m.netto = m.entrate - m.uscite;

  const labelMap = new Map<string, number>();
  for (const e of expenses) {
    const lbl = (e.data.label as string) || 'altro';
    labelMap.set(lbl, (labelMap.get(lbl) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const pieData = [...labelMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, value]) => ({ name, value }));

  const daySpend = Array(7).fill(0) as number[];
  for (const e of expenses) {
    const d = new Date(e.created_at).getDay();
    daySpend[d] += (e.data.amount as number) ?? 0;
  }
  const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const maxDaySpend = Math.max(...daySpend);
  const topDay = daySpend.indexOf(maxDaySpend);

  const labelMonths = new Map<string, Set<string>>();
  for (const e of expenses) {
    const lbl = (e.data.label as string) || 'altro';
    const month = e.created_at.slice(0, 7);
    if (!labelMonths.has(lbl)) labelMonths.set(lbl, new Set());
    labelMonths.get(lbl)!.add(month);
  }
  const recurring = [...labelMonths.entries()]
    .filter(([, months]) => months.size >= 2)
    .sort((a, b) => b[1].size - a[1].size);

  const filtered = entries
    .filter(e => filter === 'all' || e.data.type === filter)
    .filter(e => !search || ((e.data.label as string) ?? '').toLowerCase().includes(search.toLowerCase()));

  const kpis = [
    { label: 'Entrate',   value: `€${totalIn.toFixed(0)}`,           clr: '#4ade80', sign: '+' },
    { label: 'Uscite',    value: `€${totalOut.toFixed(0)}`,          clr: '#f87171', sign: '-' },
    { label: 'Saldo',     value: `€${Math.abs(balance).toFixed(0)}`, clr: balance >= 0 ? '#4ade80' : '#f87171', sign: balance >= 0 ? '' : '-' },
    { label: 'Risparmio', value: savings != null ? `${savings}%` : '—', clr: '#f0c040', sign: '' },
  ];

  const bgtNow      = new Date();
  const bgtMonthKey = `${bgtNow.getFullYear()}-${String(bgtNow.getMonth() + 1).padStart(2, '0')}`;
  const bgtMonthLabel = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][bgtNow.getMonth()] + ' ' + bgtNow.getFullYear();

  const spentThisMonth = new Map<string, number>();
  for (const e of expenses) {
    const dk = ((e.data.date as string | undefined) || e.created_at).slice(0, 7);
    if (dk !== bgtMonthKey) continue;
    const lbl = (e.data.label as string) || 'altro';
    spentThisMonth.set(lbl, (spentThisMonth.get(lbl) ?? 0) + ((e.data.amount as number) ?? 0));
  }
  const bgtAllLabels  = [...new Set([...Object.keys(budgets), ...spentThisMonth.keys()])];
  const bgtTotalTarget = bgtAllLabels.reduce((s, k) => s + (budgets[k] ?? 0), 0);
  const bgtTotalSpent  = bgtAllLabels.reduce((s, k) => s + (spentThisMonth.get(k) ?? 0), 0);
  const bgtRingPct     = bgtTotalTarget > 0 ? Math.min(100, (bgtTotalSpent / bgtTotalTarget) * 100) : 0;
  const bgtRingOver    = bgtTotalTarget > 0 && bgtTotalSpent > bgtTotalTarget;
  const bgtRingWarn    = !bgtRingOver && bgtRingPct >= 80;

  const handleManualAdd = async () => {
    const amount = parseFloat(addAmount.replace(',', '.'));
    if (!amount || !addLabel.trim() || !user) return;
    setAddSubmitting(true);
    const subcategory = applyRule(user.id, addLabel.trim()) ?? 'da_associare';
    const saved = await saveEntry(user.id, 'finance', {
      type: addType,
      amount: Math.abs(amount),
      label: addLabel.trim(),
      date: new Date(addDate).toISOString(),
      source: 'manual',
      subcategory,
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
        if (txs.length === 0) {
          setImportStatus('Nessuna transazione trovata. Prova a caricare in chat.');
          return;
        }
        result = await importParsedTransactions(txs, user.id, (d, t) => setImportStatus(`${d}/${t}...`));
      }
      if (result) {
        const { imported, duplicates } = result;
        if (duplicates.length > 0) {
          setImportStatus(
            `✓ ${imported} importate · ⚠ ${duplicates.length} doppion${duplicates.length === 1 ? 'o' : 'i'} saltato${duplicates.length === 1 ? '' : 'i'}`
          );
        } else {
          setImportStatus(`✓ ${imported} transazioni importate`);
        }
      }
    } catch { setImportStatus('Errore durante l\'importazione.'); }
    setTimeout(() => setImportStatus(null), 6000);
  };

  // ── Hub ──────────────────────────────────────────────────────
  if (!singleMode && tab === null) {
    return (
      <div>
        {/* Hero balance */}
        <div style={{
          padding: '18px 18px 16px', borderRadius: 16, marginBottom: 10,
          background: `linear-gradient(145deg, ${balance >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)'} 0%, rgba(0,0,0,0) 65%)`,
          border: `1px solid ${balance >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}`,
        }}>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 9 }}>Saldo mensile</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 40, fontWeight: 100, color: balance >= 0 ? '#4ade80' : '#f87171', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {balance >= 0 ? '+' : '-'}€{Math.abs(balance).toFixed(0)}
            </div>
            {savings != null && (
              <div style={{ paddingBottom: 3 }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.1em', marginBottom: 3 }}>Risparmio</div>
                <div style={{ fontSize: 20, fontWeight: 100, color: '#f0c040', letterSpacing: '-0.02em' }}>{savings}%</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
            {[
              { label: 'Entrate',   value: `+€${totalIn.toFixed(0)}`,     clr: '#4ade80' },
              { label: 'Uscite',    value: `-€${totalOut.toFixed(0)}`,    clr: '#f87171' },
              { label: 'Burn rate', value: `€${burnRate.toFixed(0)}/m`,   clr: 'rgba(255,255,255,0.28)' },
            ].map((item, i) => (
              <div key={item.label} style={{ flex: 1, paddingLeft: i > 0 ? 14 : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none', marginLeft: i > 0 ? 14 : 0 }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.1em', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 200, color: item.clr }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Da Associare alert */}
        {unassocCount > 0 && (
          <div
            onClick={() => setTab('associa')}
            style={{
              padding: '11px 14px', borderRadius: 12, marginBottom: 10, cursor: 'pointer',
              background: 'rgba(251,191,36,0.055)', border: '1px solid rgba(251,191,36,0.22)',
              display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.18s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.10)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.055)')}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 7px #fbbf24', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 300, color: '#fbbf24' }}>{unassocCount} spese senza categoria</div>
              <div style={{ fontSize: 8, color: 'rgba(251,191,36,0.4)', marginTop: 2 }}>{assocGroups.size} descrizioni · tocca per categorizzare</div>
            </div>
            <span style={{ fontSize: 12, color: 'rgba(251,191,36,0.35)', flexShrink: 0 }}>›</span>
          </div>
        )}

        {/* Section grid — excludes 'associa' (shown separately above) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {FINANCE_FRAGMENTS.filter(f => f.id !== 'associa').map(f => (
            <div key={f.id} onClick={() => setTab(f.id)}
              style={{
                padding: '15px 14px', borderRadius: 12, cursor: 'pointer',
                background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.046)',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}30`; (e.currentTarget as HTMLElement).style.background = `${color}07`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.046)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.018)'; }}
            >
              <div style={{ fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.72)', marginBottom: 5 }}>{f.label}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.03em' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentTab = tab ?? normalizedTab ?? 'transazioni';

  return (
    <div>
      {!singleMode && (
        <button onClick={() => setTab(null)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6,
          color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'color 0.15s',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)')}
        >
          ← {FINANCE_FRAGMENTS.find(f => f.id === currentTab)?.label ?? currentTab}
        </button>
      )}

      {/* ── TRANSAZIONI ── */}
      {currentTab === 'transazioni' && (
        <div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 12, alignItems: 'center' }}>
            {(['all', 'expense', 'income'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 8.5, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: filter === f ? `${color}20` : 'rgba(255,255,255,0.04)',
                color: filter === f ? color : 'rgba(255,255,255,0.25)',
              }}>
                {f === 'all' ? 'Tutte' : f === 'expense' ? 'Uscite' : 'Entrate'}
              </button>
            ))}
            <input placeholder="Cerca..." value={search} onChange={e => setSearch(e.target.value)} style={{
              flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: '3px 2px', fontSize: 9.5, color: 'rgba(255,255,255,0.5)', outline: 'none',
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ fontSize: 10, color: '#3a3f52', textAlign: 'center', padding: 20 }}>Nessuna transazione</div>}
            {filtered.map(e => {
              const isIncome = e.data.type === 'income';
              const amt = (e.data.amount as number)?.toFixed(2) ?? '?';
              const lbl = (e.data.label as string) ?? '—';
              const date = new Date(e.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: isIncome ? '#4ade80' : '#f87171', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 300, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.01em' }}>{lbl}</div>
                    <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>{date}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 300, color: isIncome ? '#4ade80' : '#f87171' }}>
                    {isIncome ? '+' : '-'}€{amt}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DA ASSOCIARE ── */}
      {currentTab === 'associa' && (
        <div>
          {assocGroups.size === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.25 }}>✓</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Tutte le spese sono categorizzate</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                {unassocCount} spese · {assocGroups.size} gruppi
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {[...assocGroups.entries()].sort((a, b) => b[1].length - a[1].length).map(([key, group]) => {
                  const label = (group[0].data.label as string) || key;
                  const total = group.reduce((s, e) => s + ((e.data.amount as number) ?? 0), 0);
                  const inputVal = assocInputs[key] ?? '';
                  const isSaving = assocSaving === key;

                  const handleAssoc = async (all: boolean) => {
                    const sub = inputVal.trim();
                    if (!sub || !user) return;
                    setAssocSaving(key);
                    const targets = all ? group : [group[0]];
                    await Promise.all(targets.map(e =>
                      updateEntryData(e.id, { ...e.data, subcategory: sub })
                    ));
                    if (all) setRule(user.id, label, sub);
                    const { activeWidget, setActiveWidget } = useAlterStore.getState();
                    if (activeWidget) {
                      const updatedIds = new Set(targets.map(e => e.id));
                      setActiveWidget({
                        ...activeWidget,
                        entries: activeWidget.entries.map(e =>
                          updatedIds.has(e.id) ? { ...e, data: { ...e.data, subcategory: sub } } : e
                        ),
                      });
                    }
                    setAssocInputs(prev => { const n = { ...prev }; delete n[key]; return n; });
                    setAssocSaving(null);
                  };

                  return (
                    <div key={key} style={{
                      padding: '14px 14px 12px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.78)', wordBreak: 'break-word', lineHeight: 1.4 }}>{label}</div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 200, color: '#f87171' }}>-€{total.toFixed(2)}</div>
                          {group.length > 1 && (
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>×{group.length} volte</div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          placeholder="es. food, trasporti, bollette…"
                          value={inputVal}
                          onChange={e => setAssocInputs(prev => ({ ...prev, [key]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAssoc(true)}
                          style={{
                            flex: 1, padding: '8px 11px', borderRadius: 8, fontSize: 11,
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                            color: 'rgba(255,255,255,0.82)', outline: 'none', transition: 'border-color 0.15s',
                          }}
                          onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.22)')}
                          onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
                        />
                        {group.length > 1 && (
                          <button
                            onClick={() => handleAssoc(false)}
                            disabled={!inputVal.trim() || isSaving}
                            title="Associa solo questa transazione"
                            style={{
                              padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)',
                              background: 'transparent',
                              cursor: inputVal.trim() && !isSaving ? 'pointer' : 'default',
                              fontSize: 9, color: 'rgba(255,255,255,0.28)', transition: 'all 0.15s', whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => inputVal.trim() && ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.58)')}
                            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)')}
                          >
                            Solo 1
                          </button>
                        )}
                        <button
                          onClick={() => handleAssoc(true)}
                          disabled={!inputVal.trim() || isSaving}
                          style={{
                            padding: '8px 14px', borderRadius: 8,
                            border: `1px solid ${inputVal.trim() ? 'rgba(251,191,36,0.28)' : 'rgba(255,255,255,0.06)'}`,
                            background: inputVal.trim() ? 'rgba(251,191,36,0.10)' : 'transparent',
                            cursor: inputVal.trim() ? 'pointer' : 'default', fontSize: 10,
                            color: inputVal.trim() ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                            transition: 'all 0.15s', whiteSpace: 'nowrap', fontWeight: 400,
                          }}
                        >
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

      {/* ── CASHFLOW ── */}
      {currentTab === 'cashflow' && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Saldo netto</div>
              <div style={{ fontSize: 28, fontWeight: 100, color: balance >= 0 ? '#4ade80' : '#f87171', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {balance >= 0 ? '+' : '-'}€{Math.abs(balance).toFixed(0)}
              </div>
            </div>
            {savings != null && (
              <div style={{ paddingBottom: 2, marginLeft: 10 }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Risparmio</div>
                <div style={{ fontSize: 20, fontWeight: 100, color: '#f0c040', letterSpacing: '-0.02em' }}>{savings}%</div>
              </div>
            )}
            <div style={{ marginLeft: 'auto', textAlign: 'right', paddingBottom: 2 }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Burn rate</div>
              <div style={{ fontSize: 20, fontWeight: 100, color: '#f87171', letterSpacing: '-0.02em' }}>
                €{burnRate.toFixed(0)}<span style={{ fontSize: 10, opacity: 0.4 }}>/m</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            Entrate vs Uscite · ultimi 6 mesi
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={months6} barGap={3} barCategoryGap="28%" margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 8.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.1)', fontSize: 8 }} axisLine={false} tickLine={false} width={32}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={{ background: 'rgba(5,5,12,0.97)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, fontSize: 9.5, padding: '8px 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                labelStyle={{ color: 'rgba(255,255,255,0.3)', marginBottom: 6, fontSize: 10, letterSpacing: '0.04em' }}
                formatter={(v: number, name: string) => [`€${v.toFixed(0)}`, name === 'entrate' ? '↑ Entrate' : '↓ Uscite']}
                cursor={{ fill: 'rgba(255,255,255,0.015)' }}
              />
              <Bar dataKey="entrate" fill="#4ade80" fillOpacity={0.5} radius={[3,3,0,0]} />
              <Bar dataKey="uscite"  fill="#f87171" fillOpacity={0.5} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '18px 0 8px' }}>
            Netto mensile
          </div>
          <ResponsiveContainer width="100%" height={72}>
            <AreaChart data={months6} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cfNetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={balance >= 0 ? '#4ade80' : '#f87171'} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={balance >= 0 ? '#4ade80' : '#f87171'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 8 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(5,5,12,0.97)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, fontSize: 9, padding: '6px 10px' }}
                formatter={(v: number) => [`€${v.toFixed(0)}`, 'Netto']}
                cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="netto"
                stroke={balance >= 0 ? '#4ade80' : '#f87171'} strokeWidth={1.5}
                fill="url(#cfNetGrad)"
                dot={{ fill: balance >= 0 ? '#4ade80' : '#f87171', r: 2.5, strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {months6.map(m => {
              const c = m.netto >= 0 ? '#4ade80' : '#f87171';
              return (
                <div key={m.key} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: `${c}08`, border: `1px solid ${c}12` }}>
                  <div style={{ fontSize: 9, fontWeight: 200, color: c }}>{m.netto >= 0 ? '+' : ''}{m.netto.toFixed(0)}</div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.15)', marginTop: 2 }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AGGIUNGI ── */}
      {currentTab === 'aggiungi' && (
        <div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 20, padding: 3, borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
            {(['form', 'import'] as const).map(m => (
              <button key={m} onClick={() => setAddMode(m)} style={{
                flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', borderRadius: 8, fontSize: 9.5,
                fontWeight: addMode === m ? 400 : 300, letterSpacing: '0.06em', transition: 'all 0.18s',
                background: addMode === m ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: addMode === m ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)',
              }}>
                {m === 'form' ? 'Manuale' : 'Importa file'}
              </button>
            ))}
          </div>
          {addMode === 'form' && (
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {(['expense', 'income'] as const).map(t => (
                  <button key={t} onClick={() => setAddType(t)} style={{
                    flex: 1, padding: '9px 0', border: `1px solid ${addType === t ? (t === 'expense' ? '#f87171' : '#4ade80') : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 300, transition: 'all 0.18s',
                    background: addType === t ? (t === 'expense' ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)') : 'transparent',
                    color: addType === t ? (t === 'expense' ? '#f87171' : '#4ade80') : 'rgba(255,255,255,0.25)',
                  }}>
                    {t === 'expense' ? '↓ Uscita' : '↑ Entrata'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', fontWeight: 200 }}>€</span>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={addAmount} onChange={e => setAddAmount(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px 10px 28px', borderRadius: 10, boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                      color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 200, outline: 'none', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                    onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.07)')}
                  />
                </div>
                <input
                  type="text" placeholder="Descrizione (es. supermercato, stipendio...)"
                  value={addLabel} onChange={e => setAddLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 200, outline: 'none', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                  onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.07)')}
                />
                <input
                  type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 200, outline: 'none', colorScheme: 'dark',
                  }}
                />
              </div>
              <button
                onClick={handleManualAdd} disabled={addSubmitting || !addAmount || !addLabel}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, cursor: 'pointer',
                  fontSize: 11, fontWeight: 300, letterSpacing: '0.06em', transition: 'all 0.18s',
                  background: addSubmitting || !addAmount || !addLabel
                    ? 'rgba(255,255,255,0.04)'
                    : addType === 'expense' ? 'rgba(248,113,113,0.14)' : 'rgba(74,222,128,0.14)',
                  color: addSubmitting || !addAmount || !addLabel
                    ? 'rgba(255,255,255,0.2)'
                    : addType === 'expense' ? '#f87171' : '#4ade80',
                  border: `1px solid ${addSubmitting || !addAmount || !addLabel ? 'rgba(255,255,255,0.05)' : addType === 'expense' ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`,
                }}
              >
                {addSubmitting ? 'Salvataggio...' : `Aggiungi ${addType === 'expense' ? 'uscita' : 'entrata'}`}
              </button>
              {importStatus && (
                <div style={{ marginTop: 10, textAlign: 'center', fontSize: 10, color: '#4ade80', letterSpacing: '0.04em' }}>{importStatus}</div>
              )}
            </div>
          )}
          {addMode === 'import' && (
            <div>
              <input
                ref={addFileRef} type="file" accept=".csv,.xlsx,.xls,.pdf"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
              />
              <div
                onClick={() => addFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = `${color}50`; (e.currentTarget as HTMLElement).style.background = `${color}06`; }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                onDrop={e => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                  const f = e.dataTransfer.files[0];
                  if (f) handleImportFile(f);
                }}
                style={{
                  padding: '32px 20px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)', transition: 'all 0.18s',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 10, opacity: 0.5 }}>📎</div>
                <div style={{ fontSize: 11, fontWeight: 300, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                  Trascina qui o clicca per selezionare
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>
                  CSV · XLSX · PDF estratto conto
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { fmt: 'CSV', desc: 'Esportazione banca · Colonne data, descrizione, importo' },
                  { fmt: 'XLSX', desc: 'Foglio Excel con intestazioni banco italiano' },
                  { fmt: 'PDF', desc: 'Estratto conto digitale con testo selezionabile' },
                ].map(h => (
                  <div key={h.fmt} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: 8.5, fontWeight: 400, color, opacity: 0.7, minWidth: 30, letterSpacing: '0.04em' }}>{h.fmt}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>{h.desc}</span>
                  </div>
                ))}
              </div>
              {importStatus && (() => {
                const m = importStatus.match(/(\d+)\/(\d+)/);
                const prog = m ? { done: +m[1], total: +m[2], pct: Math.min(100, Math.round(+m[1] / +m[2] * 100)) } : null;
                const isDone  = importStatus.startsWith('✓');
                const isError = importStatus.startsWith('Errore');
                const statusColor = isDone ? '#4ade80' : isError ? '#f87171' : 'rgba(255,255,255,0.45)';
                return (
                  <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: isDone ? 'rgba(74,222,128,0.05)' : isError ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isDone ? 'rgba(74,222,128,0.14)' : isError ? 'rgba(248,113,113,0.14)' : 'rgba(255,255,255,0.06)'}` }}>
                    {prog ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>
                          <span>Importazione in corso…</span>
                          <span style={{ color: color, fontWeight: 400 }}>{prog.pct}%</span>
                        </div>
                        <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, transition: 'width 0.35s ease', width: `${prog.pct}%`, background: `linear-gradient(90deg, ${color}55, ${color})` }} />
                        </div>
                        <div style={{ marginTop: 7, fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
                          {prog.done} / {prog.total} transazioni
                        </div>
                      </>
                    ) : (
                      <>
                        {!isDone && !isError && (
                          <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
                            <div style={{ height: '100%', width: '35%', borderRadius: 3, background: `linear-gradient(90deg, transparent, ${color}80, transparent)`, animation: 'none', transform: 'translateX(-100%)', transition: 'transform 0s' }} />
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: statusColor, textAlign: 'center', letterSpacing: '0.04em' }}>{importStatus}</div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── BUDGET ── */}
      {currentTab === 'budget' && (
        <div>
          {bgtTotalTarget > 0 && (
            <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{bgtMonthLabel}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 100, color: bgtRingOver ? '#f87171' : 'rgba(255,255,255,0.8)', letterSpacing: '-0.02em' }}>
                      €{bgtTotalSpent.toFixed(0)}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>/ €{bgtTotalTarget.toFixed(0)}</span>
                  </div>
                  <div style={{ fontSize: 9, color: bgtRingOver ? '#f87171' : bgtRingWarn ? '#f59e0b' : '#4ade80', letterSpacing: '0.02em' }}>
                    {bgtRingOver
                      ? `⚠ Superato di €${(bgtTotalSpent - bgtTotalTarget).toFixed(0)}`
                      : `Rimangono €${(bgtTotalTarget - bgtTotalSpent).toFixed(0)} · ${(100 - bgtRingPct).toFixed(0)}%`}
                  </div>
                </div>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg viewBox="0 0 36 36" style={{ width: 62, height: 62 }}>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.8" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke={bgtRingOver ? '#ef4444' : bgtRingWarn ? '#f59e0b' : '#4ade80'}
                      strokeWidth="2.8" strokeLinecap="round"
                      strokeDasharray={`${bgtRingPct} ${100 - bgtRingPct}`} strokeDashoffset="25"
                      style={{ transition: 'stroke-dasharray 0.6s ease', filter: `drop-shadow(0 0 4px ${bgtRingOver ? '#ef4444' : bgtRingWarn ? '#f59e0b' : '#4ade80'}60)` }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 300, color: bgtRingOver ? '#ef4444' : bgtRingWarn ? '#f59e0b' : 'rgba(255,255,255,0.6)' }}>
                    {Math.round(bgtRingPct)}%
                  </div>
                </div>
              </div>
            </div>
          )}
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            Budget {bgtMonthLabel} · clicca per impostare
          </div>
          {spentThisMonth.size === 0 && Object.keys(budgets).length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>
              Nessuna spesa registrata questo mese
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {bgtAllLabels.sort((a, b) => (spentThisMonth.get(b) ?? 0) - (spentThisMonth.get(a) ?? 0)).map((lbl, i) => {
              const spent  = spentThisMonth.get(lbl) ?? 0;
              const budget = budgets[lbl];
              const has    = budget !== undefined && budget > 0;
              const pct    = has ? Math.min(100, (spent / budget) * 100) : 0;
              const over   = has && spent > budget;
              const warn   = has && pct >= 80 && !over;
              const c      = over ? '#ef4444' : warn ? '#f59e0b' : PIE_PALETTE[i % PIE_PALETTE.length];
              const isEdit = editBudgetLabel === lbl;
              const saveBudget = () => {
                const n = parseFloat(editBudgetVal);
                if (!isNaN(n) && n > 0) {
                  const u = { ...budgets, [lbl]: n };
                  setBudgets(u); localStorage.setItem('_alter_budget', JSON.stringify(u));
                } else if (isNaN(n) || n <= 0) {
                  const u = { ...budgets }; delete u[lbl];
                  setBudgets(u); localStorage.setItem('_alter_budget', JSON.stringify(u));
                }
                setEditBudgetLabel(null);
              };
              return (
                <div key={lbl}
                  onClick={() => { if (!isEdit) { setEditBudgetLabel(lbl); setEditBudgetVal(has ? String(budget) : ''); } }}
                  style={{
                    padding: '10px 12px', borderRadius: 10, cursor: isEdit ? 'default' : 'pointer',
                    background: over ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${over ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)'}`, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isEdit) { (e.currentTarget as HTMLElement).style.background = `${c}06`; (e.currentTarget as HTMLElement).style.borderColor = `${c}18`; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = over ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = over ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: has && !isEdit ? 8 : 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0, boxShadow: `0 0 5px ${c}70` }} />
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 300, color: 'rgba(255,255,255,0.6)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{lbl}</span>
                    {isEdit ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>€</span>
                        <input
                          value={editBudgetVal} onChange={ev => setEditBudgetVal(ev.target.value)}
                          placeholder="Budget" autoFocus type="number" min="0"
                          onKeyDown={ev => { if (ev.key === 'Enter') saveBudget(); if (ev.key === 'Escape') setEditBudgetLabel(null); }}
                          onBlur={saveBudget}
                          style={{ width: 70, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#fff', outline: 'none' }}
                        />
                        <button onClick={saveBudget} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80', fontSize: 12 }}>✓</button>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'right' }}>
                        {has ? (
                          <>
                            <span style={{ fontSize: 12, fontWeight: 200, color: c }}>€{spent.toFixed(0)}</span>
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}> / €{budget}</span>
                            {over && <span style={{ marginLeft: 6, fontSize: 8, color: '#ef4444', letterSpacing: '0.04em' }}>over</span>}
                          </>
                        ) : (
                          <>
                            {spent > 0 && <span style={{ fontSize: 12, fontWeight: 200, color: 'rgba(255,255,255,0.4)' }}>€{spent.toFixed(0)}</span>}
                            <span style={{ marginLeft: 6, fontSize: 8.5, color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 6px' }}>+ budget</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {has && !isEdit && (
                    <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 1, background: c, boxShadow: `0 0 4px ${c}60`, transition: 'width 0.5s ease' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RICORRENTI ── */}
      {currentTab === 'ricorrenti' && (
        <div>
          <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>Spese ricorrenti · ≥2 mesi</div>
          {recurring.length === 0 ? (
            <div style={{ fontSize: 10, color: '#3a3f52', textAlign: 'center', padding: 24, lineHeight: 1.8 }}>
              Nessuna spesa ricorrente.<br /><span style={{ fontSize: 8.5 }}>Serve almeno 2 mesi di dati.</span>
            </div>
          ) : (
            <>
              {recurring.map(([lbl, months], i) => {
                const total = labelMap.get(lbl) ?? 0;
                const avg   = months.size > 0 ? total / months.size : 0;
                const c     = PIE_PALETTE[i % PIE_PALETTE.length];
                return (
                  <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ width: 3, height: 3, borderRadius: '50%', background: c, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 300, color: 'rgba(255,255,255,0.6)' }}>{lbl}</div>
                      <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{months.size} mesi rilevati</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 200, color: c }}>€{avg.toFixed(0)}<span style={{ fontSize: 8, opacity: 0.5 }}>/m</span></div>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Impegni fissi/mese</span>
                <span style={{ fontSize: 16, fontWeight: 100, color: '#f5c842' }}>€{recurring.reduce((s, [lbl]) => s + (labelMap.get(lbl) ?? 0) / (labelMonths.get(lbl)?.size ?? 1), 0).toFixed(0)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ANALISI ── */}
      {currentTab === 'analisi' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {[
              { label: 'Burn Rate',    value: `€${burnRate.toFixed(0)}`,  sub: 'proiezione mensile', clr: '#f87171' },
              { label: 'Media/giorno', value: `€${dayOfMonth > 0 ? (totalOut / dayOfMonth).toFixed(0) : '0'}`, sub: `ultimi ${dayOfMonth}gg`, clr: '#60a5fa' },
              { label: 'Fine mese',    value: `€${projMonthEnd.toFixed(0)}`, sub: `${daysLeft}gg rimasti`, clr: '#34d399' },
              { label: 'Top categoria', value: pieData[0]?.name ?? '—', sub: `€${(pieData[0]?.value ?? 0).toFixed(0)}`, clr: '#fbbf24' },
            ].map(k => (
              <div key={k.label} style={{ padding: '12px 14px', borderRadius: 11, background: `${k.clr}06`, border: `1px solid ${k.clr}10` }}>
                <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 100, color: k.clr, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.value}</div>
                <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.15)', marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Spesa per giorno</div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 56 }}>
            {DAYS_IT.map((d, i) => {
              const v   = daySpend[i];
              const pct = maxDaySpend > 0 ? (v / maxDaySpend) * 100 : 0;
              const isTop = i === topDay && v > 0;
              const barColor = isTop ? '#f87171' : 'rgba(255,255,255,0.1)';
              return (
                <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.025)', borderRadius: 2, height: 42, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: `${Math.max(pct, v > 0 ? 4 : 0)}%`, background: barColor, borderRadius: 2, transition: 'height 0.4s', boxShadow: isTop ? `0 0 6px ${barColor}80` : 'none' }} />
                  </div>
                  <span style={{ fontSize: 7.5, color: isTop ? '#f87171' : 'rgba(255,255,255,0.18)' }}>{d}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
