import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import type { VaultEntry } from '../../../types';
import { saveEntry } from '../../../vault/vaultService';
import { useAlterStore } from '../../../store/alterStore';
import { buildStar } from '../../starfield/StarfieldView';
import { loadTokenState, consumeToken, isTestLocked, getTestUsed, QUIZ_MAX_TOKENS, type QuizTokenState } from '../../../core/quizTokenService';
import { mergeQuizScores, getFriends } from '../../../social/nexusService';

// ─── Quiz catalogue ───────────────────────────────────────────
interface TestDef {
  id: string;
  label: string;
  desc: string;
  duration: string;
  scoreLabel: (entry: VaultEntry) => string;
  scoreValue: (entry: VaultEntry) => number;
}

interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  tests: TestDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'reattivita',
    label: 'Reattività',
    icon: '⚡',
    tests: [
      {
        id: 'rt',
        label: 'Tempo di Reazione',
        desc: 'Velocità di risposta a stimoli visivi · 5 trial',
        duration: '~1 min',
        scoreLabel: e => `${e.data.avg_ms as number}ms`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'gng',
        label: 'Go / No-Go',
        desc: 'Inibizione degli impulsi · 20 stimoli GO/NO-GO · indice di impulsività',
        duration: '~1 min',
        scoreLabel: e => `${e.data.false_alarms as number} FA`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'tap',
        label: 'Tapping Test',
        desc: 'Velocità psicomotoria · tocca il più velocemente possibile per 10 secondi · indicatore SNC',
        duration: '~15 sec',
        scoreLabel: e => `${(e.data.taps_per_second as number).toFixed(1)} tap/s`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'dtap',
        label: 'Psychomotor Speed',
        desc: 'Alternanza Indice–Medio · 15 secondi · test clinico per fatica del sistema motorio',
        duration: '~15 sec',
        scoreLabel: e => `${(e.data.taps_per_second as number).toFixed(1)} alt/s`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'pvt',
        label: 'PVT — Vigilanza Psicomotoria',
        desc: 'Gold standard NASA per affaticamento da sonno · intervalli casuali · 12 trial · misura lapse e RT mediana',
        duration: '~3 min',
        scoreLabel: e => `${e.data.median_ms as number}ms · ${e.data.lapses as number} lapse`,
        scoreValue: e => e.data.score as number,
      },
    ],
  },
  {
    id: 'memoria',
    label: 'Memoria',
    icon: '🧠',
    tests: [
      {
        id: 'wm',
        label: 'Working Memory',
        desc: 'Span di cifre in memoria di lavoro · livelli 4–8',
        duration: '~2 min',
        scoreLabel: e => `span ${e.data.max_span as number}`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'sternberg',
        label: 'Sternberg Search',
        desc: 'Velocità di scansione della memoria a breve termine · 12 trial · set di 4 lettere',
        duration: '~2 min',
        scoreLabel: e => `${e.data.correct as number}/${e.data.total as number} · ${e.data.avg_ms as number}ms`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'corsi',
        label: 'Corsi Block Test',
        desc: 'Memoria visuo-spaziale · sequenze di posizioni su griglia · span 4–8',
        duration: '~2 min',
        scoreLabel: e => `span ${e.data.max_span as number}`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'nback',
        label: 'N-Back Spaziale',
        desc: 'Aggiorna continuamente la posizione in memoria · 2-Back · 20 trial',
        duration: '~2 min',
        scoreLabel: e => `${e.data.correct as number}/${e.data.total as number} corr.`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'corsi_bwd',
        label: 'Corsi Inverso (Backward)',
        desc: 'Variante inversa del Corsi Block · ripeti la sequenza al contrario · manipolazione mentale attiva',
        duration: '~2 min',
        scoreLabel: e => `span ${e.data.max_span as number}`,
        scoreValue: e => e.data.score as number,
      },
    ],
  },
  {
    id: 'ragionamento',
    label: 'Ragionamento',
    icon: '🔢',
    tests: [
      {
        id: 'pr',
        label: 'Pattern Recognition',
        desc: 'Sequenze numeriche e logica induttiva · 10 domande',
        duration: '~3 min',
        scoreLabel: e => `${e.data.correct as number}/${e.data.total as number}`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'beads',
        label: 'Beads Task',
        desc: 'Due urne nascoste · perline blu/rosse estratte una alla volta · misura impulsività decisionale e bias di conferma',
        duration: '~2 min',
        scoreLabel: e => `${e.data.draws as number} estr. · ${e.data.correct ? '✓' : '✗'}`,
        scoreValue: e => e.data.score as number,
      },
    ],
  },
  {
    id: 'percezione',
    label: 'Percezione',
    icon: '⏱',
    tests: [
      {
        id: 'tp',
        label: 'Time Production',
        desc: 'Tieni premuto il pulsante per esattamente 20 secondi · distorsione temporale',
        duration: '~30 sec',
        scoreLabel: e => `${((e.data.held_ms as number) / 1000).toFixed(2)}s`,
        scoreValue: e => e.data.score as number,
      },
    ],
  },
  {
    id: 'salute_mentale',
    label: 'Salute Mentale',
    icon: '🧘',
    tests: [
      {
        id: 'dp',
        label: 'Dot-Probe Task',
        desc: 'Sensore di bias attentivo · parole emotive vs neutrali · 16 trial',
        duration: '~2 min',
        scoreLabel: e => `bias ${(e.data.bias_ms as number) > 0 ? '+' : ''}${e.data.bias_ms as number}ms`,
        scoreValue: e => e.data.score as number,
      },
    ],
  },
  {
    id: 'attenzione',
    label: 'Attenzione Selettiva',
    icon: '🎯',
    tests: [
      {
        id: 'stroop',
        label: 'Test di Stroop',
        desc: 'Interferenza colore-parola · 16 trial · inibizione risposta automatica',
        duration: '~2 min',
        scoreLabel: e => `${e.data.correct as number}/${e.data.total as number} corr.`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'vigilance',
        label: 'Target Finder',
        desc: 'Griglia di icone · individua il simbolo bersaglio · 30 round',
        duration: '~45 sec',
        scoreLabel: e => `${e.data.hits as number} hit`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'ab',
        label: 'Attentional Blink',
        desc: 'Sequenza rapida RSVP · individua 2 numeri nascosti tra le lettere · finestra critica 200–400ms',
        duration: '~2 min',
        scoreLabel: e => `blink ${Math.round((e.data.ab_effect as number) * 100)}%`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'simon',
        label: 'Effetto Simon',
        desc: 'Conflitto posizione-risposta · cerchio verde = sinistra, rosso = destra indipendentemente da dove appare · 20 trial',
        duration: '~2 min',
        scoreLabel: e => `effetto ${e.data.effect_ms as number}ms`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'dsst',
        label: 'DSST — Simboli e Numeri',
        desc: 'Gold standard per velocità di elaborazione · associa 9 numeri a simboli · 90 secondi · sensibile a stress e sonno',
        duration: '~2 min',
        scoreLabel: e => `${e.data.correct as number} corr. / 90s`,
        scoreValue: e => e.data.score as number,
      },
      {
        id: 'tasksw',
        label: 'Task Switching',
        desc: 'Switch cost del multitasking · numero in alto = pari/dispari · numero in basso = colore caldo/freddo · 20 trial',
        duration: '~2 min',
        scoreLabel: e => `switch +${e.data.switch_cost_ms as number}ms`,
        scoreValue: e => e.data.score as number,
      },
    ],
  },
];

const ALL_TESTS = CATEGORIES.flatMap(c => c.tests);

// ─── Pattern bank ─────────────────────────────────────────────
const PR_BANK = [
  { seq: [2, 4, 8, 16],      answer: 32,  opts: [24, 28, 32, 36]      },
  { seq: [1, 3, 6, 10],      answer: 15,  opts: [13, 14, 15, 16]      },
  { seq: [5, 10, 20, 40],    answer: 80,  opts: [60, 70, 80, 90]      },
  { seq: [1, 4, 9, 16],      answer: 25,  opts: [20, 22, 25, 27]      },
  { seq: [3, 6, 12, 24],     answer: 48,  opts: [36, 42, 48, 54]      },
  { seq: [1, 1, 2, 3, 5],    answer: 8,   opts: [6, 7, 8, 9]          },
  { seq: [64, 32, 16, 8],    answer: 4,   opts: [2, 3, 4, 5]          },
  { seq: [2, 5, 10, 17],     answer: 26,  opts: [23, 24, 26, 28]      },
  { seq: [100, 90, 81, 73],  answer: 66,  opts: [64, 65, 66, 67]      },
  { seq: [3, 7, 13, 21],     answer: 31,  opts: [28, 29, 30, 31]      },
  { seq: [256, 128, 64, 32], answer: 16,  opts: [12, 14, 16, 18]      },
  { seq: [2, 3, 5, 7, 11],   answer: 13,  opts: [12, 13, 14, 15]      },
  { seq: [10, 9, 7, 4],      answer: 0,   opts: [-1, 0, 1, 2]         },
  { seq: [1, 2, 4, 7, 11],   answer: 16,  opts: [14, 15, 16, 17]      },
  { seq: [4, 8, 16, 32],     answer: 64,  opts: [48, 56, 64, 72]      },
  { seq: [81, 27, 9, 3],     answer: 1,   opts: [0, 1, 2, 3]          },
  { seq: [2, 6, 18, 54],     answer: 162, opts: [108, 162, 216, 270]  },
  { seq: [1, 3, 7, 15],      answer: 31,  opts: [27, 29, 31, 33]      },
  { seq: [5, 8, 13, 21],     answer: 34,  opts: [30, 32, 34, 36]      },
  { seq: [50, 45, 35, 20],   answer: 0,   opts: [-5, 0, 5, 10]        },
];

function shuffleSlice<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// ─── DP Word bank ─────────────────────────────────────────────
const DP_EMOTIONAL = ['MORTE', 'PAURA', 'ANSIA', 'DOLORE', 'FALLIRE', 'PERDITA', 'BUIO', 'RABBIA', 'INUTILE', 'COLPA'];
const DP_NEUTRAL   = ['SEDIA', 'LIBRO', 'STRADA', 'ACQUA', 'TETTO', 'PORTA', 'CAMPO', 'ALBERO', 'PIETRA', 'NUVOLA'];

// ─── Stroop / Vigilance constants ─────────────────────────────
const STROOP_COLORS = [
  { name: 'ROSSO',     hex: '#ef4444' },
  { name: 'BLU',       hex: '#3b82f6' },
  { name: 'VERDE',     hex: '#22c55e' },
  { name: 'GIALLO',    hex: '#eab308' },
  { name: 'VIOLA',     hex: '#a855f7' },
  { name: 'ARANCIONE', hex: '#f97316' },
];
const VIGILANCE_TARGET      = '★';
const VIGILANCE_DISTRACTORS = ['○', '□', '△', '◇', '+', '×', '◉', '⬡', '♦', '⊕', '≋', '⌘'];
const VIGILANCE_ROUNDS      = 30;
const VIGILANCE_INTERVAL    = 1400;

// ─── Score calculators ────────────────────────────────────────
function rtScore(avg_ms: number)                     { return Math.round(Math.max(0, Math.min(100, 100 - ((avg_ms - 150) / 3.5)))); }
function wmScore(max_span: number)                   { return Math.round((max_span / 8) * 100); }
function prScore(correct: number, total: number)     { return Math.round((correct / total) * 100); }
function tpScore(held_ms: number)                    { return Math.round(Math.max(0, Math.min(100, 100 - Math.abs(held_ms - 20000) / 200))); }
// bias_ms > 0: faster for emotional (attentional bias) → score < 50 · bias_ms < 0: avoidance → score > 50
function dpScore(bias_ms: number)                    { return Math.round(Math.max(0, Math.min(100, 50 - bias_ms / 3))); }
// false_alarms / nogo_count = commission rate (impulsivity) · 0 FA = 100
function gngScore(false_alarms: number, nogo_count: number) { return Math.round(Math.max(0, Math.min(100, 100 - (false_alarms / nogo_count) * 100))); }
// taps_per_second: 2 tps=0, 8 tps=100 · linear interpolation
function tapScore(tps: number) { return Math.round(Math.max(0, Math.min(100, (tps - 2) / 6 * 100))); }
// dtap: alternations/s · 1 alt/s=0, 6 alt/s=100 · -4 per error (motor fatigue penalty)
function dualTapScore(tps: number, errors: number) { return Math.round(Math.max(0, Math.min(100, (tps - 1) / 5 * 100 - errors * 4))); }
// accuracy 70% + speed bonus 30%; avg_ms for correct hits: fast < 400ms, slow > 1200ms
function sternbergScore(correct: number, total: number, avg_ms: number) {
  const acc   = correct / total;
  const speed = Math.max(0, Math.min(1, (1200 - avg_ms) / 800));
  return Math.round(acc * 70 + speed * 30);
}
// accuracy 85% + speed bonus 15%; avg_ms: fast < 800ms
function stroopScore(correct: number, total: number, avg_ms: number) {
  const acc = correct / total;
  const speed = Math.max(0, Math.min(1, (2500 - avg_ms) / 1700));
  return Math.round(acc * 85 + speed * 15);
}
// hitRate − FA penalty (5pts each)
function vigilanceScore(hits: number, fa: number, total_targets: number) {
  if (total_targets === 0) return 0;
  return Math.round(Math.max(0, Math.min(100, (hits / total_targets) * 100 - fa * 5)));
}
// ab: T2 accuracy in critical window (70%) + absence of AB effect vs control lag (30%)
function corsiScore(max_span: number)                        { return Math.round((max_span / 8) * 100); }
function nbackScore(correct: number, total: number)          { return total === 0 ? 0 : Math.round(Math.max(0, Math.min(100, (correct / total) * 100))); }
function abScore(t2_acc_critical: number, t2_acc_late: number) {
  const ab_effect = Math.max(0, t2_acc_late - t2_acc_critical);
  return Math.round(Math.max(0, Math.min(100, t2_acc_critical * 70 + (1 - ab_effect) * 30)));
}
// simon: effect = incongruent_ms - congruent_ms; 0ms=100, 150ms→penalty capped at 80; accuracy weighted
function simonScore(effect_ms: number, accuracy: number) {
  const effectPenalty = Math.max(0, Math.min(80, effect_ms / 1.875));
  return Math.round(Math.max(0, accuracy * 100 - effectPenalty));
}
// tasksw: switch_cost 0ms=100, 300ms→0 (70%); accuracy 30%
function taskswScore(switch_cost_ms: number, accuracy: number) {
  const costScore = Math.max(0, Math.min(100, 100 - switch_cost_ms / 3));
  return Math.round(costScore * 0.7 + accuracy * 100 * 0.3);
}
// pvt: median 200ms=100, 450ms=0; -12 per lapse
function pvtScore(median_ms: number, lapses: number) {
  const rtPart = Math.max(0, Math.min(100, 100 - (median_ms - 200) / 2.5));
  return Math.round(Math.max(0, rtPart - lapses * 12));
}
// corsi_bwd: backward span is harder; span 2→0, 7→100
function corsiBwdScore(max_span: number) { return Math.round(Math.max(0, Math.min(100, (max_span - 2) / 5 * 100))); }
// dsst: 15 correct=0, 65 correct=100
function dsstScore(correct: number) { return Math.round(Math.max(0, Math.min(100, (correct - 15) / 50 * 100))); }
// beads: optimal decision at 3-5 draws; wrong answer caps at 25
function beadsScore(draws: number, correct: boolean) {
  if (!correct) return Math.max(0, 25 - draws * 2);
  if (draws <= 1) return 30;
  if (draws <= 2) return 50;
  if (draws <= 5) return 100 - Math.abs(draws - 4) * 5;
  if (draws <= 8) return Math.max(50, 80 - (draws - 5) * 8);
  return Math.max(30, 60 - draws * 3);
}

// ─── Shared styles ────────────────────────────────────────────
function btnStyle(color: string, full?: boolean): React.CSSProperties {
  return {
    background: `${color}18`,
    border: `1px solid ${color}40`,
    borderRadius: 10,
    padding: '10px 22px',
    fontSize: 12,
    fontWeight: 600,
    color,
    cursor: 'pointer',
    letterSpacing: '0.05em',
    width: full ? '100%' : undefined,
    transition: 'background 0.15s',
  };
}

// ─── RT Test ──────────────────────────────────────────────────
type RTState = 'idle' | 'ready' | 'go' | 'early';
interface RTData { avg_ms: number; best_ms: number; trials: number }

function RTTest({ color, onDone }: { color: string; onDone: (d: RTData) => void }) {
  const [state, setRtState]   = useState<RTState>('idle');
  const [times, setTimes]     = useState<number[]>([]);
  const [trial, setTrial]     = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef(0);
  const TRIALS = 5;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const startTrial = useCallback(() => {
    setRtState('ready');
    const delay = 800 + Math.random() * 2200;
    timerRef.current = setTimeout(() => {
      setRtState('go');
      startRef.current = performance.now();
    }, delay);
  }, []);

  const handleClick = useCallback(() => {
    if (state === 'idle') {
      setTrial(1);
      startTrial();
      return;
    }
    if (state === 'ready') {
      if (timerRef.current) clearTimeout(timerRef.current);
      setRtState('early');
      setTimeout(() => startTrial(), 1200);
      return;
    }
    if (state === 'go') {
      const elapsed = Math.round(performance.now() - startRef.current);
      setTimes(prev => {
        const next = [...prev, elapsed];
        if (next.length >= TRIALS) {
          const avg  = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
          const best = Math.min(...next);
          onDone({ avg_ms: avg, best_ms: best, trials: TRIALS });
        } else {
          setTrial(next.length + 1);
          setRtState('idle');
          setTimeout(startTrial, 700);
        }
        return next;
      });
    }
  }, [state, startTrial, onDone]);

  const circleColor =
    state === 'go'    ? '#22c55e' :
    state === 'early' ? '#ef4444' :
    state === 'ready' ? '#374151' : 'rgba(255,255,255,0.06)';

  const label =
    state === 'idle'  ? (times.length === 0 ? 'Tocca per iniziare' : '…') :
    state === 'ready' ? 'Aspetta…' :
    state === 'go'    ? 'ORA!' :
    'Troppo presto!';

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Tempo di reazione · {Math.min(trial, TRIALS)}/{TRIALS}
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 22 }}>
        Clicca il cerchio appena diventa verde
      </p>
      <motion.div
        onClick={handleClick}
        animate={{ backgroundColor: circleColor, scale: state === 'go' ? 1.1 : 1 }}
        transition={{ duration: 0.12 }}
        style={{
          width: 136, height: 136, borderRadius: '50%',
          margin: '0 auto 20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${state === 'go' ? '#22c55e80' : 'rgba(255,255,255,0.1)'}`,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: state === 'go' ? 16 : 12, fontWeight: 600, color: state === 'go' ? '#fff' : 'rgba(255,255,255,0.45)' }}>
          {label}
        </span>
      </motion.div>
      {times.length > 0 && (
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
          {times.map((t, i) => (
            <span key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '2px 7px' }}>
              {t}ms
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── WM Test ──────────────────────────────────────────────────
type WMState = 'start' | 'show' | 'recall' | 'correct' | 'wrong' | 'done';
interface WMData { max_span: number; errors: number }

function WMTest({ color, onDone }: { color: string; onDone: (d: WMData) => void }) {
  const [wmState, setWmState] = useState<WMState>('start');
  const [level, setLevel]     = useState(4);
  const [seq, setSeq]         = useState<number[]>([]);
  const [input, setInput]     = useState('');
  const [maxSpan, setMaxSpan] = useState(0);
  const [errors, setErrors]   = useState(0);

  const runTrial = useCallback((lvl: number) => {
    const newSeq = Array.from({ length: lvl }, () => Math.floor(Math.random() * 9) + 1);
    setSeq(newSeq);
    setInput('');
    setWmState('show');
    const showMs = Math.max(2000, lvl * 500);
    setTimeout(() => setWmState('recall'), showMs);
  }, []);

  const checkAnswer = useCallback(() => {
    const isCorrect = seq.join('') === input.trim();
    if (isCorrect) {
      const newSpan = level;
      setMaxSpan(newSpan);
      if (level >= 8) {
        setWmState('done');
        setTimeout(() => onDone({ max_span: newSpan, errors }), 600);
        return;
      }
      setWmState('correct');
      setTimeout(() => { const next = level + 1; setLevel(next); runTrial(next); }, 700);
    } else {
      const newErrors = errors + 1;
      setErrors(newErrors);
      setWmState('wrong');
      setTimeout(() => { setWmState('done'); onDone({ max_span: maxSpan, errors: newErrors }); }, 900);
    }
  }, [seq, input, level, errors, maxSpan, onDone, runTrial]);

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Working Memory · Livello {level}
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 22 }}>
        Memorizza la sequenza di cifre, poi riscrivila
      </p>
      {wmState === 'start' && <button onClick={() => runTrial(4)} style={btnStyle(color)}>Inizia</button>}
      {wmState === 'show' && (
        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
          style={{ fontSize: 38, fontWeight: 700, letterSpacing: '0.35em', color: '#fff', fontFamily: "'Space Mono', monospace" }}>
          {seq.join(' ')}
        </motion.div>
      )}
      {wmState === 'recall' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Display */}
          <div style={{
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${color}40`,
            borderRadius: 12, padding: '12px 18px', fontSize: 26,
            fontFamily: "'Space Mono', monospace", color: input ? '#fff' : 'rgba(255,255,255,0.2)',
            letterSpacing: '0.3em', textAlign: 'center', width: 180,
            margin: '0 auto 16px', minHeight: 54, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {input || '·'.repeat(level)}
          </div>
          {/* Numeric keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: 196, margin: '0 auto 14px' }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <motion.button key={n} whileTap={{ scale: 0.93 }}
                disabled={input.length >= level}
                onClick={() => setInput(p => p.length < level ? p + n : p)}
                style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '14px 0', fontSize: 22, fontWeight: 700,
                  fontFamily: "'Space Mono', monospace", color: '#fff', cursor: 'pointer',
                  opacity: input.length >= level ? 0.35 : 1,
                }}>{n}</motion.button>
            ))}
            {/* Backspace */}
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => setInput(p => p.slice(0, -1))}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '14px 0', fontSize: 16, color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
              }}>⌫</motion.button>
            {/* 0 */}
            <motion.button whileTap={{ scale: 0.93 }}
              disabled={input.length >= level}
              onClick={() => setInput(p => p.length < level ? p + '0' : p)}
              style={{
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '14px 0', fontSize: 22, fontWeight: 700,
                fontFamily: "'Space Mono', monospace", color: '#fff', cursor: 'pointer',
                opacity: input.length >= level ? 0.35 : 1,
              }}>0</motion.button>
            {/* Confirm */}
            <motion.button whileTap={{ scale: 0.93 }}
              disabled={input.length === 0}
              onClick={checkAnswer}
              style={{
                background: input.length > 0 ? `${color}22` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${input.length > 0 ? color + '60' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 10, padding: '14px 0', fontSize: 13, fontWeight: 700,
                letterSpacing: '0.08em', color: input.length > 0 ? '#fff' : 'rgba(255,255,255,0.2)', cursor: 'pointer',
              }}>OK</motion.button>
          </div>
        </motion.div>
      )}
      {wmState === 'correct' && <p style={{ fontSize: 22, color: '#22c55e' }}>✓ Corretto!</p>}
      {wmState === 'wrong'   && <p style={{ fontSize: 16, color: '#f87171' }}>✗ Era: {seq.join(' ')}</p>}
      {wmState === 'done'    && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Span massimo: {maxSpan} cifre</p>}
    </div>
  );
}

// ─── Corsi Block Test ─────────────────────────────────────────
type CorsiState = 'start' | 'show' | 'recall' | 'correct' | 'wrong' | 'done';
interface CorsiData { max_span: number; errors: number }

function CorsiTest({ color, onDone }: { color: string; onDone: (d: CorsiData) => void }) {
  const [corsiState, setCorsiState] = useState<CorsiState>('start');
  const [level, setLevel]     = useState(4);
  const [seq, setSeq]         = useState<number[]>([]);
  const [lit, setLit]         = useState<number | null>(null);
  const [userSeq, setUserSeq] = useState<number[]>([]);
  const [maxSpan, setMaxSpan] = useState(0);
  const [errors, setErrors]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const runTrial = useCallback((lvl: number) => {
    const newSeq = Array.from({ length: lvl }, () => Math.floor(Math.random() * 9));
    setSeq(newSeq);
    setUserSeq([]);
    setLit(null);
    setCorsiState('show');
    let i = 0;
    const showNext = () => {
      setLit(newSeq[i]);
      timerRef.current = setTimeout(() => {
        setLit(null);
        i++;
        if (i < newSeq.length) {
          timerRef.current = setTimeout(showNext, 300);
        } else {
          timerRef.current = setTimeout(() => setCorsiState('recall'), 400);
        }
      }, 650);
    };
    timerRef.current = setTimeout(showNext, 500);
  }, []);

  const handleBlockClick = useCallback((idx: number) => {
    if (corsiState !== 'recall') return;
    setUserSeq(prev => {
      const newSeq2 = [...prev, idx];
      const pos = newSeq2.length - 1;
      if (newSeq2[pos] !== seq[pos]) {
        const newErrors = errors + 1;
        setErrors(newErrors);
        setCorsiState('wrong');
        timerRef.current = setTimeout(() => { setCorsiState('done'); onDone({ max_span: maxSpan, errors: newErrors }); }, 900);
      } else if (newSeq2.length === seq.length) {
        const newSpan = level;
        setMaxSpan(newSpan);
        if (level >= 8) {
          setCorsiState('done');
          timerRef.current = setTimeout(() => onDone({ max_span: newSpan, errors }), 600);
        } else {
          setCorsiState('correct');
          timerRef.current = setTimeout(() => { const next = level + 1; setLevel(next); runTrial(next); }, 700);
        }
      }
      return newSeq2;
    });
  }, [corsiState, seq, level, errors, maxSpan, onDone, runTrial]);

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Corsi Block · Livello {level}
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 22 }}>
        {corsiState === 'show' ? 'Osserva la sequenza…' : corsiState === 'recall' ? 'Tocca i blocchi nello stesso ordine' : 'Memorizza le posizioni spaziali'}
      </p>
      {corsiState === 'start' && <button onClick={() => runTrial(4)} style={btnStyle(color)}>Inizia</button>}
      {(corsiState === 'show' || corsiState === 'recall') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, maxWidth: 228, margin: '0 auto 20px' }}>
          {Array.from({ length: 9 }, (_, idx) => {
            const isLit = lit === idx;
            const pressed = userSeq.includes(idx);
            return (
              <motion.button
                key={idx}
                onClick={() => handleBlockClick(idx)}
                animate={{
                  backgroundColor: isLit ? color : pressed ? `${color}35` : 'rgba(255,255,255,0.06)',
                  scale: isLit ? 1.1 : 1,
                  boxShadow: isLit ? `0 0 18px ${color}70` : 'none',
                  borderColor: isLit ? color : pressed ? `${color}60` : 'rgba(255,255,255,0.1)',
                }}
                transition={{ duration: 0.12 }}
                style={{
                  width: 66, height: 66, borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: corsiState === 'recall' ? 'pointer' : 'default',
                  background: 'rgba(255,255,255,0.06)',
                }}
              />
            );
          })}
        </div>
      )}
      {corsiState === 'recall' && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', marginTop: -8, marginBottom: 8 }}>
          {userSeq.length}/{seq.length} blocchi
        </p>
      )}
      {corsiState === 'correct' && <p style={{ fontSize: 22, color: '#22c55e' }}>✓ Corretto!</p>}
      {corsiState === 'wrong'   && <p style={{ fontSize: 16, color: '#f87171' }}>✗ Sequenza errata</p>}
      {corsiState === 'done'    && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Span massimo: {maxSpan} blocchi</p>}
    </div>
  );
}

// ─── N-Back Spaziale (2-Back) ─────────────────────────────────
interface NBackData { correct: number; total: number; hits: number; false_alarms: number }

function NBackTest({ color, onDone }: { color: string; onDone: (d: NBackData) => void }) {
  const TRIALS   = 20;
  const N        = 2;
  const TRIAL_MS = 1400;

  const [nbPhase, setNbPhase]     = useState<'intro' | 'running' | 'done'>('intro');
  const [activeTrial, setActiveTrial] = useState(0);
  const [activeQ, setActiveQ]     = useState<number | null>(null);
  const [feedback, setFeedback]   = useState<'correct' | 'wrong' | null>(null);

  const posRef      = useRef<number[]>([]);
  const answeredRef = useRef(false);
  const statsRef    = useRef({ correct: 0, total: 0, hits: 0, false_alarms: 0 });
  const trialRef    = useRef(0);
  const timerRef2   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef   = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => () => { if (timerRef2.current) clearTimeout(timerRef2.current); }, []);

  const runTrial = useCallback((seq: number[], t: number) => {
    trialRef.current = t;
    answeredRef.current = false;
    setActiveTrial(t);
    setActiveQ(seq[t]);
    setFeedback(null);

    timerRef2.current = setTimeout(() => {
      // Non-response counts as "No"
      if (!answeredRef.current && t >= N) {
        const isMatch = seq[t] === seq[t - N];
        statsRef.current.total += 1;
        if (!isMatch) statsRef.current.correct += 1; // correct rejection
      }
      const next = t + 1;
      if (next >= TRIALS) {
        setNbPhase('done');
        setActiveQ(null);
        onDoneRef.current({ ...statsRef.current });
      } else {
        runTrial(seq, next);
      }
    }, TRIAL_MS);
  }, []);

  const start = () => {
    const seq: number[] = [];
    for (let i = 0; i < TRIALS; i++) {
      if (i >= N && Math.random() < 0.35) {
        seq.push(seq[i - N]);
      } else {
        let p;
        do { p = Math.floor(Math.random() * 4); } while (i >= N && p === seq[i - N]);
        seq.push(p);
      }
    }
    posRef.current = seq;
    statsRef.current = { correct: 0, total: 0, hits: 0, false_alarms: 0 };
    setNbPhase('running');
    runTrial(seq, 0);
  };

  const handleAnswer = (isYes: boolean) => {
    if (answeredRef.current || trialRef.current < N || nbPhase !== 'running') return;
    answeredRef.current = true;
    const seq    = posRef.current;
    const t      = trialRef.current;
    const isMatch = seq[t] === seq[t - N];
    const correct = isYes === isMatch;
    statsRef.current.total += 1;
    if (correct) statsRef.current.correct += 1;
    if (isYes && isMatch) statsRef.current.hits += 1;
    if (isYes && !isMatch) statsRef.current.false_alarms += 1;
    setFeedback(correct ? 'correct' : 'wrong');
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        N-Back Spaziale · 2-Back
      </p>

      {nbPhase === 'intro' && (
        <>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, lineHeight: 1.65 }}>
            Un'icona appare in uno dei 4 quadranti.
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 18, lineHeight: 1.65 }}>
            Premi <strong style={{ color }}>Sì</strong> se la posizione attuale è uguale a quella di{' '}
            <strong style={{ color }}>2 passi fa</strong>, altrimenti <strong style={{ color: 'rgba(255,255,255,0.5)' }}>No</strong>.
          </p>
          <button onClick={start} style={btnStyle(color)}>Inizia</button>
        </>
      )}

      {nbPhase === 'running' && (
        <>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 18 }}>
            Trial {activeTrial + 1}/{TRIALS}
            {activeTrial < N && <span style={{ color: 'rgba(255,255,255,0.25)' }}> · osserva…</span>}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 180, margin: '0 auto 24px' }}>
            {[0, 1, 2, 3].map(q => (
              <motion.div
                key={q}
                animate={{
                  backgroundColor: activeQ === q ? `${color}22` : 'rgba(255,255,255,0.04)',
                  borderColor: activeQ === q ? `${color}80` : 'rgba(255,255,255,0.08)',
                  scale: activeQ === q ? 1.05 : 1,
                }}
                transition={{ duration: 0.15 }}
                style={{
                  width: 76, height: 76, borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <AnimatePresence>
                  {activeQ === q && (
                    <motion.span
                      key={`icon-${activeTrial}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      style={{ fontSize: 22, color }}
                    >◆</motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {activeTrial >= N ? (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => handleAnswer(true)}  style={btnStyle(color)}>Sì</button>
              <button onClick={() => handleAnswer(false)} style={btnStyle('rgba(255,255,255,0.45)')}>No</button>
            </div>
          ) : (
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em' }}>
              Memorizza la posizione…
            </p>
          )}

          <AnimatePresence>
            {feedback && (
              <motion.div
                key={feedback}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ fontSize: 20, color: feedback === 'correct' ? '#22c55e' : '#ef4444', fontWeight: 700, marginTop: 12 }}
              >
                {feedback === 'correct' ? '✓' : '✗'}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {nbPhase === 'done' && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          {statsRef.current.correct}/{statsRef.current.total} corretti
        </p>
      )}
    </div>
  );
}

// ─── PR Test ──────────────────────────────────────────────────
interface PRQ { seq: number[]; answer: number; opts: number[] }
interface PRData { correct: number; total: number }

function PRTest({ color, onDone }: { color: string; onDone: (d: PRData) => void }) {
  const [questions]           = useState<PRQ[]>(() => shuffleSlice(PR_BANK, 10));
  const [idx, setIdx]         = useState(0);
  const [score, setScore]     = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const scoreRef = useRef(0);

  const handleAnswer = useCallback((opt: number) => {
    if (selected !== null) return;
    setSelected(opt);
    if (opt === questions[idx].answer) { scoreRef.current += 1; setScore(scoreRef.current); }
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        onDone({ correct: scoreRef.current, total: questions.length });
      } else {
        setIdx(i => i + 1);
        setSelected(null);
      }
    }, 800);
  }, [selected, idx, questions, onDone]);

  const q = questions[idx];
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Pattern Recognition · {idx + 1}/{questions.length}
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 18 }}>
        Qual è il prossimo numero?
      </p>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, color: '#fff', marginBottom: 24, letterSpacing: '0.12em' }}>
        {q.seq.join('  ')}  <span style={{ color }}>?</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 240, margin: '0 auto 14px' }}>
        {q.opts.map(opt => {
          const isCorrect  = opt === q.answer;
          const isSelected = opt === selected;
          let bg = 'rgba(255,255,255,0.06)', border = '1px solid rgba(255,255,255,0.1)', clr = '#fff';
          if (selected !== null) {
            if (isCorrect)       { bg = 'rgba(34,197,94,0.15)';  border = '1px solid rgba(34,197,94,0.4)';  clr = '#22c55e'; }
            else if (isSelected) { bg = 'rgba(239,68,68,0.15)';  border = '1px solid rgba(239,68,68,0.4)';  clr = '#f87171'; }
          }
          return (
            <motion.button key={opt} onClick={() => handleAnswer(opt)} whileTap={{ scale: 0.94 }}
              style={{ background: bg, border, borderRadius: 10, padding: '13px', fontSize: 16, fontFamily: "'Space Mono', monospace", color: clr, cursor: selected !== null ? 'default' : 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>
              {opt}
            </motion.button>
          );
        })}
      </div>
      {idx > 0 && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{score}/{idx} corrette</p>}
    </div>
  );
}

// ─── TP Test ──────────────────────────────────────────────────
type TPState = 'idle' | 'holding' | 'done';
interface TPData { held_ms: number }

function TPTest({ color, onDone }: { color: string; onDone: (d: TPData) => void }) {
  const [tpState, setTpState] = useState<TPState>('idle');
  const [held_ms, setHeldMs] = useState<number | null>(null);
  const pressRef = useRef<number>(0);

  const handlePressStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (tpState !== 'idle') return;
    pressRef.current = performance.now();
    setTpState('holding');
  }, [tpState]);

  const handlePressEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (tpState !== 'holding') return;
    const elapsed = Math.round(performance.now() - pressRef.current);
    setHeldMs(elapsed);
    setTpState('done');
    setTimeout(() => onDone({ held_ms: elapsed }), 600);
  }, [tpState, onDone]);

  const delta = held_ms !== null ? held_ms - 20000 : null;
  const direction = delta !== null ? (Math.abs(delta) < 150 ? 'exact' : delta > 0 ? 'tardi' : 'presto') : null;
  const dirColor = direction === 'exact' ? '#22c55e' : direction === 'tardi' ? '#f59e0b' : '#60a5fa';

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Time Production · Target: 7.00s
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 28, lineHeight: 1.6 }}>
        Tieni premuto il pulsante per quello che<br />ritieni siano esattamente <span style={{ color, fontWeight: 600 }}>7 secondi</span>
      </p>

      <motion.div
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={tpState === 'holding' ? handlePressEnd : undefined}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        animate={{
          backgroundColor: tpState === 'holding' ? `${color}30` : tpState === 'done' ? `${dirColor}25` : 'rgba(255,255,255,0.05)',
          scale: tpState === 'holding' ? 1.08 : 1,
          boxShadow: tpState === 'holding' ? `0 0 32px ${color}50` : 'none',
        }}
        transition={{ duration: 0.12 }}
        style={{
          width: 140, height: 140, borderRadius: '50%',
          margin: '0 auto 24px', cursor: tpState === 'done' ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${tpState === 'holding' ? color : tpState === 'done' ? dirColor : 'rgba(255,255,255,0.12)'}`,
          userSelect: 'none', touchAction: 'none',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: tpState === 'holding' ? color : 'rgba(255,255,255,0.45)', pointerEvents: 'none' }}>
          {tpState === 'idle' ? 'Tieni premuto' : tpState === 'holding' ? '…' : '✓'}
        </span>
      </motion.div>

      {tpState === 'done' && held_ms !== null && delta !== null && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: dirColor, fontFamily: "'Space Mono', monospace", marginBottom: 4 }}>
            {(held_ms / 1000).toFixed(2)}s
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            {direction === 'exact' ? 'Quasi perfetto!' : `${Math.abs(delta)}ms ${direction === 'tardi' ? 'in ritardo' : 'in anticipo'}`}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── DP Test ──────────────────────────────────────────────────
type DPTrialState = 'start' | 'fixation' | 'words' | 'blank' | 'probe' | 'iti' | 'done';
interface DPTrialResult { rt: number; congruent: boolean }
interface DPData { bias_ms: number; trials: number; avg_rt: number }

interface DPTrial {
  emotional: string;
  neutral: string;
  emotionalSide: 'left' | 'right';
  probeSide: 'left' | 'right';
}

function DPTest({ color, onDone }: { color: string; onDone: (d: DPData) => void }) {
  const TOTAL = 16;

  const [dpTrials] = useState<DPTrial[]>(() =>
    Array.from({ length: TOTAL }, (_, i) => ({
      emotional: DP_EMOTIONAL[i % DP_EMOTIONAL.length],
      neutral:   DP_NEUTRAL[i % DP_NEUTRAL.length],
      emotionalSide: (Math.random() < 0.5 ? 'left' : 'right') as 'left' | 'right',
      probeSide:     (Math.random() < 0.5 ? 'left' : 'right') as 'left' | 'right',
    })).sort(() => Math.random() - 0.5)
  );

  const [idx, setIdx]             = useState(0);
  const [dpState, setDpState]     = useState<DPTrialState>('start');
  const [results, setResults]     = useState<DPTrialResult[]>([]);
  const probeStartRef             = useRef(0);
  const timerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const runTrial = useCallback((i: number) => {
    setIdx(i);
    setDpState('fixation');
    timerRef.current = setTimeout(() => {
      setDpState('words');
      timerRef.current = setTimeout(() => {
        setDpState('blank');
        timerRef.current = setTimeout(() => {
          probeStartRef.current = performance.now();
          setDpState('probe');
        }, 50);
      }, 500);
    }, 400);
  }, []);

  const handleProbe = useCallback(() => {
    if (dpState !== 'probe') return;
    const rt = Math.round(performance.now() - probeStartRef.current);
    const trial = dpTrials[idx];
    const congruent = trial.probeSide === trial.emotionalSide;
    setDpState('iti');
    setResults(prev => {
      const next = [...prev, { rt, congruent }];
      if (next.length >= TOTAL) {
        const cRTs = next.filter(r => r.congruent).map(r => r.rt);
        const iRTs = next.filter(r => !r.congruent).map(r => r.rt);
        const avgC = cRTs.length > 0 ? cRTs.reduce((a, b) => a + b, 0) / cRTs.length : 0;
        const avgI = iRTs.length > 0 ? iRTs.reduce((a, b) => a + b, 0) / iRTs.length : 0;
        // positive bias_ms = faster for congruent (dot at emotional word) = attentional capture
        const bias_ms = Math.round(avgI - avgC);
        const avg_rt  = Math.round(next.map(r => r.rt).reduce((a, b) => a + b, 0) / next.length);
        timerRef.current = setTimeout(() => {
          setDpState('done');
          onDone({ bias_ms, trials: TOTAL, avg_rt });
        }, 300);
      } else {
        timerRef.current = setTimeout(() => runTrial(idx + 1), 400);
      }
      return next;
    });
  }, [dpState, dpTrials, idx, onDone, runTrial]);

  const trial = idx < TOTAL ? dpTrials[idx] : null;

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Dot-Probe · {results.length}/{TOTAL}
      </p>

      {dpState === 'start' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, lineHeight: 1.65 }}>
            Due parole appariranno per un istante.<br />
            Tocca subito il punto <span style={{ color, fontWeight: 600 }}>●</span> quando compare.
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginBottom: 22, lineHeight: 1.5 }}>
            Il test misura dove si orienta la tua attenzione — nessuna risposta giusta o sbagliata.
          </p>
          <button onClick={() => runTrial(0)} style={btnStyle(color)}>Inizia</button>
        </motion.div>
      )}

      {dpState === 'fixation' && (
        <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.35)', userSelect: 'none' }}>+</span>
        </div>
      )}

      {dpState === 'words' && trial && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.06 }}
          style={{ display: 'flex', height: 110, alignItems: 'center' }}
        >
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '0.12em', textAlign: 'center', userSelect: 'none' }}>
            {trial.emotionalSide === 'left' ? trial.emotional : trial.neutral}
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '0.12em', textAlign: 'center', userSelect: 'none' }}>
            {trial.emotionalSide === 'right' ? trial.emotional : trial.neutral}
          </span>
        </motion.div>
      )}

      {(dpState === 'blank' || dpState === 'iti') && (
        <div style={{ height: 110 }} />
      )}

      {dpState === 'probe' && trial && (
        <motion.div
          onClick={handleProbe}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.04 }}
          style={{ display: 'flex', height: 110, alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            {trial.probeSide === 'left' && <span style={{ fontSize: 34, color }}>●</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            {trial.probeSide === 'right' && <span style={{ fontSize: 34, color }}>●</span>}
          </div>
        </motion.div>
      )}

      {dpState === 'done' && (
        <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Elaborazione…</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: i < results.length ? `${color}cc` : 'rgba(255,255,255,0.1)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── GNG Test ──────────────────────────────────────────────────
type GNGTrialState = 'idle' | 'fixation' | 'stimulus' | 'iti' | 'done';
interface GNGTrialResult { isGo: boolean; responded: boolean; rt: number }
interface GNGData { false_alarms: number; misses: number; hits: number; avg_rt: number; nogo_count: number; go_count: number }

function GNGTest({ color, onDone }: { color: string; onDone: (d: GNGData) => void }) {
  const TOTAL = 20;
  const NOGO  = 5;
  const GO    = TOTAL - NOGO;

  const [seq] = useState<boolean[]>(() =>
    [...Array(GO).fill(true), ...Array(NOGO).fill(false)].sort(() => Math.random() - 0.5)
  );

  const [gngState, setGngState]     = useState<GNGTrialState>('idle');
  const [trialIdx, setTrialIdx]     = useState(0);
  const [trialResults, setTrialResults] = useState<GNGTrialResult[]>([]);
  const [tapped, setTapped]         = useState(false);

  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stimRef      = useRef(0);
  const respondedRef = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const finishGame = useCallback((all: GNGTrialResult[]) => {
    const fa     = all.filter(r => !r.isGo && r.responded).length;
    const mis    = all.filter(r =>  r.isGo && !r.responded).length;
    const hit    = all.filter(r =>  r.isGo && r.responded).length;
    const goRts  = all.filter(r =>  r.isGo && r.responded).map(r => r.rt);
    const avg_rt = goRts.length > 0 ? Math.round(goRts.reduce((a, b) => a + b, 0) / goRts.length) : 0;
    onDone({ false_alarms: fa, misses: mis, hits: hit, avg_rt, nogo_count: NOGO, go_count: GO });
  }, [onDone]);

  const runTrial = useCallback((idx: number, prev: GNGTrialResult[]) => {
    respondedRef.current = false;
    setTapped(false);
    setTrialIdx(idx);
    setGngState('fixation');
    timerRef.current = setTimeout(() => {
      stimRef.current = performance.now();
      setGngState('stimulus');
      timerRef.current = setTimeout(() => {
        const rt = respondedRef.current ? Math.round(performance.now() - stimRef.current) : 0;
        const r: GNGTrialResult = { isGo: seq[idx], responded: respondedRef.current, rt };
        const all = [...prev, r];
        setTrialResults(all);
        setGngState('iti');
        timerRef.current = setTimeout(() => {
          if (idx + 1 >= TOTAL) {
            setGngState('done');
            finishGame(all);
          } else {
            runTrial(idx + 1, all);
          }
        }, 400);
      }, 900);
    }, 500);
  }, [seq, finishGame]);

  const handleTap = useCallback(() => {
    if (gngState === 'idle') { runTrial(0, []); return; }
    if (gngState !== 'stimulus' || respondedRef.current) return;
    respondedRef.current = true;
    setTapped(true);
  }, [gngState, runTrial]);

  const isGoStim   = gngState === 'stimulus' && seq[trialIdx];
  const isNoGoStim = gngState === 'stimulus' && !seq[trialIdx];
  const stimColor  = isGoStim ? '#22c55e' : isNoGoStim ? '#ef4444' : 'transparent';

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Go / No-Go · {Math.min(trialResults.length + (gngState !== 'idle' ? 1 : 0), TOTAL)}/{TOTAL}
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 22 }}>
        {gngState === 'idle' ? 'Tocca per iniziare' : '● tappa subito  ·  ■ resta fermo'}
      </p>

      <div
        onClick={handleTap}
        style={{
          width: 150, height: 150, margin: '0 auto 20px',
          cursor: gngState === 'idle' || gngState === 'stimulus' ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        {gngState === 'idle' && (
          <div style={{ width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Inizia</span>
          </div>
        )}
        {gngState === 'fixation' && (
          <span style={{ fontSize: 36, color: 'rgba(255,255,255,0.45)', fontWeight: 200, lineHeight: 1 }}>+</span>
        )}
        {gngState === 'stimulus' && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: tapped ? 0.88 : 1, opacity: 1 }}
            transition={{ duration: 0.07 }}
            style={{
              width: 140, height: 140,
              borderRadius: seq[trialIdx] ? '50%' : 18,
              background: stimColor,
              boxShadow: `0 0 40px ${stimColor}50`,
            }}
          />
        )}
        {(gngState === 'iti' || gngState === 'done') && <div style={{ height: 140 }} />}
      </div>

      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', minHeight: 14 }}>
        {trialResults.map((r, i) => {
          const error = (!r.isGo && r.responded) || (r.isGo && !r.responded);
          return (
            <div key={i} style={{
              width: 7, height: 7,
              borderRadius: r.isGo ? '50%' : 2,
              background: error ? '#ef4444cc' : r.isGo ? '#22c55e60' : 'rgba(255,255,255,0.12)',
            }} />
          );
        })}
      </div>
      {gngState === 'done' && (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>Elaborazione…</p>
      )}
    </div>
  );
}

// ─── TestDetailView ───────────────────────────────────────────
function TestDetailView({
  test, entries, color, onStart, onBack, tokenState,
}: {
  test: TestDef;
  entries: VaultEntry[];
  color: string;
  onStart: () => void;
  onBack: () => void;
  tokenState: QuizTokenState | null;
}) {
  const runs = entries.filter(e => e.data.test_id === test.id).reverse();
  const best = runs.length > 0 ? Math.max(...runs.map(e => test.scoreValue(e))) : null;
  const last3 = runs.slice(0, 3);
  const locked = isTestLocked(tokenState, test.id);

  return (
    <motion.div initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }}>
      {/* Back */}
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '0 0 18px', letterSpacing: '0.06em' }}>
        <ChevronLeft size={13} /> Tutti i test
      </button>

      <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{test.label}</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 22, lineHeight: 1.5 }}>{test.desc}</p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Best score</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: best !== null ? color : 'rgba(255,255,255,0.2)', fontFamily: "'Space Mono', monospace" }}>
            {best !== null ? best : '—'}
          </div>
          {best !== null && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>/ 100</div>}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Ultimi 3</div>
          {last3.length === 0 ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>nessuno</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {last3.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: "'Space Mono', monospace" }}>
                    {new Date(e.created_at).toLocaleDateString('it', { day: '2-digit', month: 'short' })}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: "'Space Mono', monospace" }}>
                    {test.scoreValue(e)}
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 4 }}>
                      {test.scoreLabel(e)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', textAlign: 'center', marginBottom: 14, letterSpacing: '0.04em' }}>
        {runs.length} {runs.length === 1 ? 'sessione' : 'sessioni'} completate · {test.duration}
      </div>

      {locked ? (
        <>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 12,
          }}>
            Hai messo sotto torchio i tuoi riflessi per 10 volte questa settimana. La tua neuro-plasticità ha bisogno di riposo per consolidare i dati. Torna a testarti lunedì.
          </div>
          <button disabled style={{ ...btnStyle(color, true), opacity: 0.3, cursor: 'not-allowed' }}>
            🔒 Bloccato fino a lunedì
          </button>
        </>
      ) : (
        <button onClick={onStart} style={btnStyle(color, true)}>
          {runs.length === 0 ? 'Inizia test' : 'Esegui di nuovo'}
        </button>
      )}
    </motion.div>
  );
}

// ─── Result view ──────────────────────────────────────────────
function ResultView({
  test, result, color, onSave, onBack, saved, saving,
}: {
  test: TestDef;
  result: VaultEntry;
  color: string;
  onSave: () => void;
  onBack: () => void;
  saved: boolean;
  saving: boolean;
}) {
  const score = test.scoreValue(result);
  const label = test.scoreLabel(result);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20, textAlign: 'center' }}>
        {test.label} · Risultato
      </p>

      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 16 }}
          style={{ fontSize: 64, fontWeight: 700, color, lineHeight: 1, fontFamily: "'Space Mono', monospace" }}
        >
          {score}
        </motion.div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginTop: 4 }}>
          PUNTEGGIO / 100
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>{label}</div>
      </div>

      {test.id === 'tp' && (() => {
        const delta = result.data.delta_ms as number;
        const abs   = Math.abs(delta);
        const early = delta < -150;
        const late  = delta > 150;
        const insight = early
          ? { icon: '⚡', title: 'Tendenza ansiosa', body: 'Hai rilasciato in anticipo: il tuo cervello percepisce il tempo come più lungo del reale. È un segnale tipico di stati di allerta, ansia o tensione — il sistema nervoso accelera il senso del tempo.', accent: '#60a5fa' }
          : late
          ? { icon: '🌫', title: 'Tendenza a sottostimare', body: 'Hai rilasciato in ritardo: il tuo cervello percepisce il tempo come più breve del reale. È associato a stanchezza, stati depressivi o rallentamento cognitivo — il senso del tempo si dilata.', accent: '#f59e0b' }
          : { icon: '✦', title: 'Percezione calibrata', body: `${abs}ms di scarto. Il tuo senso del tempo è ben allineato con la realtà — indice di stato mentale equilibrato e buona regolazione emotiva.`, accent: '#22c55e' };
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            style={{
              background: `${insight.accent}0d`,
              border: `1px solid ${insight.accent}30`,
              borderRadius: 14, padding: '14px 16px', marginBottom: 14, textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{insight.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: insight.accent, letterSpacing: '0.05em' }}>{insight.title}</span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{insight.body}</p>
          </motion.div>
        );
      })()}

      {test.id === 'dtap' && (() => {
        const tps    = result.data.taps_per_second as number;
        const errs   = result.data.errors as number;
        const s      = result.data.score as number;
        const tired  = tps < 3 || errs > 4;
        const good   = s >= 70;
        const insight = tired
          ? { icon: '🔋', title: 'Fatica motoria rilevata', body: `${tps.toFixed(1)} alt/s con ${errs} errori di coordinazione. Il calo di sincronia tra le dita è un indicatore clinico affidabile di esaurimento del sistema motorio — il SNC fatica a mantenere il pattern di alternanza richiesto.`, accent: '#f59e0b' }
          : good
          ? { icon: '⚡', title: 'Sistema motorio reattivo', body: `${tps.toFixed(1)} alt/s${errs === 0 ? ' senza errori' : ` con ${errs} errori`}. La coordinazione bimanuale è solida: il circuito cerebellare–corticale funziona in modo efficiente. Nessun segnale di fatica psicomotoria.`, accent: '#22c55e' }
          : { icon: '↔', title: 'Prestazione nella norma', body: `${tps.toFixed(1)} alt/s${errs > 0 ? ` · ${errs} errori` : ''}. La velocità psicomotoria è nella media. Per distinguere fatica da baseline personale, confronta con sessioni successive.`, accent: '#60a5fa' };
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            style={{ background: `${insight.accent}0d`, border: `1px solid ${insight.accent}30`, borderRadius: 14, padding: '14px 16px', marginBottom: 14, textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{insight.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: insight.accent, letterSpacing: '0.05em' }}>{insight.title}</span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{insight.body}</p>
          </motion.div>
        );
      })()}

      {test.id === 'dp' && (() => {
        const bias_ms  = result.data.bias_ms as number;
        const avg_rt   = result.data.avg_rt as number;
        const abs      = Math.abs(bias_ms);
        const hasBias  = bias_ms > 40;
        const hasAvoid = bias_ms < -40;

        const insight = hasBias
          ? { icon: '⚠', title: 'Bias attentivo rilevato', body: `La tua attenzione raggiunge i contenuti emotivi ${abs}ms prima di quelli neutri. Il tuo sistema di allerta è in modalità ipervigile: le parole negative vengono elaborate prioritariamente, segnale tipico di ansia o stress cronico.`, accent: '#f59e0b' }
          : hasAvoid
          ? { icon: '🛡', title: 'Bias di evitamento', body: `Il tuo sistema allontana attivamente lo sguardo dai contenuti emotivi di ${abs}ms. È un meccanismo difensivo — utile nel breve periodo, ma se cronico può indicare soppressione emotiva o difficoltà a processare il disagio.`, accent: '#60a5fa' }
          : { icon: '✦', title: 'Attenzione equilibrata', body: `Nessun bias attentivo significativo (${abs}ms di scarto). Il tuo sistema di allerta non è polarizzato verso contenuti negativi — indicatore di buona regolazione emotiva nel momento del test.`, accent: '#22c55e' };

        // Bias meter: maps bias_ms [-200, +200] to [0%, 100%], center = 50%
        const RANGE = 200;
        const clampedBias = Math.max(-RANGE, Math.min(RANGE, bias_ms));
        const markerPct   = ((clampedBias + RANGE) / (RANGE * 2)) * 100;
        const meterColor  = hasBias ? '#f59e0b' : hasAvoid ? '#60a5fa' : '#22c55e';

        return (
          <>
            {/* Main insight */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.25 }}
              style={{ background: `${insight.accent}0d`, border: `1px solid ${insight.accent}30`, borderRadius: 14, padding: '14px 16px', marginBottom: 12, textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{insight.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: insight.accent, letterSpacing: '0.05em' }}>{insight.title}</span>
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{insight.body}</p>
            </motion.div>

            {/* Bias meter */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.25 }}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Indice di bias attentivo</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: meterColor, fontFamily: "'Space Mono', monospace" }}>
                  {bias_ms > 0 ? '+' : ''}{bias_ms}ms
                </span>
              </div>

              {/* Track */}
              <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', marginBottom: 6 }}>
                {/* Center marker */}
                <div style={{ position: 'absolute', left: '50%', top: -2, width: 1, height: 10, background: 'rgba(255,255,255,0.2)', transform: 'translateX(-50%)' }} />
                {/* Fill from center */}
                <div style={{
                  position: 'absolute',
                  top: 0, height: '100%',
                  borderRadius: 3,
                  background: meterColor,
                  opacity: 0.6,
                  left: bias_ms >= 0 ? '50%' : `${markerPct}%`,
                  width: `${Math.abs(clampedBias) / (RANGE * 2) * 100}%`,
                }} />
                {/* Dot */}
                <motion.div
                  initial={{ left: '50%' }}
                  animate={{ left: `${markerPct}%` }}
                  transition={{ delay: 0.35, type: 'spring', stiffness: 120, damping: 18 }}
                  style={{ position: 'absolute', top: '50%', width: 10, height: 10, borderRadius: '50%', background: meterColor, transform: 'translate(-50%, -50%)', boxShadow: `0 0 8px ${meterColor}80` }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 8, color: '#60a5fa80', letterSpacing: '0.06em' }}>← EVITAMENTO</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>NEUTRO</span>
                <span style={{ fontSize: 8, color: '#f59e0b80', letterSpacing: '0.06em' }}>BIAS →</span>
              </div>
            </motion.div>

            {/* Come funziona */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.25 }}
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}
            >
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Come funziona</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, margin: '0 0 6px' }}>
                Il test misura se la tua attenzione viene "catturata" da parole emotive rispetto a parole neutre. Ogni trial mostra due parole in simultanea, poi un punto appare da un lato: se sei più veloce quando il punto è dov'era la parola negativa, la tua attenzione era già lì.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', marginBottom: 3 }}>RT MEDIO</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: "'Space Mono', monospace" }}>{avg_rt}ms</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', marginBottom: 3 }}>THRESHOLD</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: "'Space Mono', monospace" }}>±40ms</div>
                </div>
              </div>
            </motion.div>
          </>
        );
      })()}

      {test.id === 'gng' && (() => {
        const fa       = result.data.false_alarms as number;
        const avg_rt   = result.data.avg_rt as number;
        const nogo     = result.data.nogo_count as number;
        const hits     = result.data.hits as number;
        const go       = result.data.go_count as number;
        const insight  =
          fa === 0
            ? { icon: '🛑', title: 'Controllo inibitorio perfetto', body: 'Zero falsi allarmi: il tuo sistema di frenata è preciso ed efficiente. Nessun impulso è sfuggito al controllo — indicatore di eccellente regolazione esecutiva.', accent: '#22c55e' }
            : fa <= 1
            ? { icon: '✦', title: 'Buon controllo inibitorio', body: `${fa} falso allarme su ${nogo} trial NO-GO. Il sistema di inibizione funziona bene — qualche impulso minore ha superato la soglia, ma il controllo esecutivo è solido.`, accent: '#a3e635' }
            : fa <= 3
            ? { icon: '⚠', title: 'Tendenza impulsiva moderata', body: `${fa} falsi allarmi su ${nogo}: il tuo sistema di frenata è sotto sforzo. Reagisci prima di elaborare pienamente lo stimolo — tipico di stati di affaticamento mentale, ansia o carico cognitivo elevato.`, accent: '#f59e0b' }
            : { icon: '🔴', title: 'Sistema di frenata offline', body: `${fa} falsi allarmi su ${nogo}: impulsività elevata rilevata. Il circuito prefrontale di inibizione non sta dominando la risposta automatica — può indicare stanchezza acuta, stress estremo o stato iperstimolato.`, accent: '#ef4444' };
        return (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.25 }}
              style={{ background: `${insight.accent}0d`, border: `1px solid ${insight.accent}30`, borderRadius: 14, padding: '14px 16px', marginBottom: 10, textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{insight.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: insight.accent, letterSpacing: '0.05em' }}>{insight.title}</span>
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{insight.body}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.22 }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}
            >
              {[
                { label: 'FALSI ALLARMI', val: `${fa}/${nogo}` },
                { label: 'HIT GO',        val: `${hits}/${go}` },
                { label: 'RT MEDIO',      val: avg_rt > 0 ? `${avg_rt}ms` : '—' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.65)', fontFamily: "'Space Mono', monospace" }}>{s.val}</div>
                </div>
              ))}
            </motion.div>
          </>
        );
      })()}

      {test.id === 'stroop' && (() => {
        const correct = result.data.correct as number;
        const total   = result.data.total as number;
        const avg_ms  = result.data.avg_ms as number;
        const acc     = correct / total;
        const insight = acc >= 0.9
          ? { icon: '✦', title: 'Controllo cognitivo eccellente', body: `${correct}/${total} risposte corrette in ${avg_ms}ms medi. Riesci a inibire efficacemente la risposta automatica alla lettura — il tuo controllo esecutivo è solido.`, accent: '#22c55e' }
          : acc >= 0.69
          ? { icon: '⚡', title: 'Buona inibizione', body: `${correct}/${total} corrette in ${avg_ms}ms. Mostri una capacità discreta di resistere all'interferenza colore-parola, con margine di miglioramento.`, accent: color }
          : { icon: '⚠', title: 'Interferenza elevata', body: `${correct}/${total} corrette. Il cervello fatica a ignorare il significato automatico della parola scritta. Indicatore di alta dipendenza dal "pilota automatico" cognitivo.`, accent: '#f59e0b' };
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            style={{ background: `${insight.accent}0d`, border: `1px solid ${insight.accent}30`, borderRadius: 14, padding: '14px 16px', marginBottom: 12, textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{insight.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: insight.accent, letterSpacing: '0.05em' }}>{insight.title}</span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{insight.body}</p>
          </motion.div>
        );
      })()}

      {test.id === 'vigilance' && (() => {
        const hits   = result.data.hits as number;
        const fa     = result.data.false_alarms as number;
        const misses = result.data.misses as number;
        const total  = result.data.total_targets as number;
        const hitPct = total > 0 ? Math.round((hits / total) * 100) : 0;
        const insight = hitPct >= 85 && fa <= 2
          ? { icon: '✦', title: 'Vigilanza sostenuta', body: `${hits}/${total} target rilevati con solo ${fa} falsi allarmi. La tua attenzione selettiva è eccellente — filtri i distrattori mantenendo alta la sensibilità al segnale.`, accent: '#22c55e' }
          : fa > 5
          ? { icon: '⚡', title: 'Alta impulsività attentiva', body: `${fa} falsi allarmi registrati. Il sistema attentivo tende a rispondere anche a stimoli simili al target — l'inibizione del click automatico è parziale.`, accent: '#f59e0b' }
          : { icon: '🎯', title: 'Vigilanza nella norma', body: `${hits}/${total} hit, ${misses} mancati, ${fa} falsi allarmi. Attenzione funzionale con qualche difficoltà nel mantenere la prontezza costante nel tempo.`, accent: color };
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            style={{ background: `${insight.accent}0d`, border: `1px solid ${insight.accent}30`, borderRadius: 14, padding: '14px 16px', marginBottom: 12, textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{insight.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: insight.accent, letterSpacing: '0.05em' }}>{insight.title}</span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{insight.body}</p>
          </motion.div>
        );
      })()}

      {test.id === 'ab' && (() => {
        const effect   = result.data.ab_effect as number;
        const critPct  = result.data.t2_acc_critical as number;
        const latePct  = result.data.t2_acc_late as number;
        const effectPct = Math.round(effect * 100);
        const insight =
          effect < 0.15
            ? { icon: '✦', title: 'Recupero neurale rapido', body: `Nessun attentional blink significativo (effetto ${effectPct}%). Il tuo cervello resetta la finestra attentiva in meno di 200ms — indicatore di sistema nervoso riposato e ad alta efficienza.`, accent: '#22c55e' }
            : effect < 0.4
            ? { icon: '〰', title: 'Blink nella norma', body: `Effetto blink del ${effectPct}% (${critPct}% accuracy critica vs ${latePct}% controllo). Il "battito di ciglia" mentale è nella norma — il cervello impiega 200–400ms a liberarsi dal primo stimolo prima di elaborarne un secondo.`, accent: color }
            : { icon: '⚠', title: 'Recupero rallentato', body: `Effetto blink del ${effectPct}% (${critPct}% critica vs ${latePct}% controllo). La finestra di cecità attentiva è ampia — segnale tipico di stress cronico, privazione del sonno o carico cognitivo elevato che rallenta il reset neurale.`, accent: '#f59e0b' };

        const barWidth = Math.min(100, effectPct);
        const barColor = effect < 0.15 ? '#22c55e' : effect < 0.4 ? color : '#f59e0b';
        return (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.25 }}
              style={{ background: `${insight.accent}0d`, border: `1px solid ${insight.accent}30`, borderRadius: 14, padding: '14px 16px', marginBottom: 10, textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{insight.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: insight.accent, letterSpacing: '0.05em' }}>{insight.title}</span>
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{insight.body}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.22 }}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AB Effect</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: barColor, fontFamily: "'Space Mono', monospace" }}>{effectPct}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ height: '100%', width: `${barWidth}%`, borderRadius: 3, background: barColor, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                {[{ label: 'CRITICA (≤400ms)', val: `${critPct}%` }, { label: 'CONTROLLO (800ms)', val: `${latePct}%` }].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, padding: '7px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.07em', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.65)', fontFamily: "'Space Mono', monospace" }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        );
      })()}

      {test.id === 'corsi' && (() => {
        const span  = result.data.max_span as number;
        const errs  = result.data.errors as number;
        const insight =
          span >= 7
            ? { icon: '🗺', title: 'Memoria spaziale superiore', body: `Span di ${span} blocchi — eccellente. La tua loopvisuo-spaziale mantiene sequenze complesse con precisione. Rientri nel range dei top-10% della popolazione adulta.`, accent: '#22c55e' }
            : span >= 5
            ? { icon: '✦', title: 'Memoria spaziale nella norma', body: `Span di ${span} blocchi. La tua capacità di mantenere e ripetere sequenze visuo-spaziali è nella media — il loop visuo-spaziale funziona correttamente.`, accent: color }
            : { icon: '⚠', title: 'Span spaziale ridotto', body: `Span di ${span} blocchi${errs > 0 ? ` con ${errs} errore` : ''}. Può indicare carico cognitivo elevato, stanchezza, o semplicemente una baseline bassa per la memoria spaziale. Il Corsi misura qualcosa di diverso dalla WM verbale.`, accent: '#f59e0b' };
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            style={{ background: `${insight.accent}0d`, border: `1px solid ${insight.accent}30`, borderRadius: 14, padding: '14px 16px', marginBottom: 12, textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{insight.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: insight.accent, letterSpacing: '0.05em' }}>{insight.title}</span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{insight.body}</p>
          </motion.div>
        );
      })()}

      {test.id === 'nback' && (() => {
        const correct = result.data.correct as number;
        const total   = result.data.total as number;
        const hits    = result.data.hits as number;
        const fa      = result.data.false_alarms as number;
        const acc     = total > 0 ? correct / total : 0;
        const insight =
          acc >= 0.8
            ? { icon: '🔁', title: 'Aggiornamento esecutivo eccellente', body: `${correct}/${total} corretti · ${hits} match rilevati · ${fa} falsi allarmi. Riesci a tenere traccia delle posizioni passate e aggiornare la memoria di lavoro in tempo reale — capacità core del controllo esecutivo.`, accent: '#22c55e' }
            : acc >= 0.6
            ? { icon: '✦', title: 'Aggiornamento nella norma', body: `${correct}/${total} corretti · ${fa} falsi allarmi. Il 2-Back è cognitivamente impegnativo — la tua performance è solida. Migliorare la baseline richiede pratica costante.`, accent: color }
            : { icon: '⚠', title: 'Carico cognitivo elevato', body: `${correct}/${total} corretti · ${fa} falsi allarmi. Il 2-Back mette sotto stress il sistema di aggiornamento della memoria di lavoro. Può indicare fatica mentale, mancanza di sonno, o semplicemente scarsa familiarità con il compito.`, accent: '#f59e0b' };
        return (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.25 }}
              style={{ background: `${insight.accent}0d`, border: `1px solid ${insight.accent}30`, borderRadius: 14, padding: '14px 16px', marginBottom: 10, textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{insight.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: insight.accent, letterSpacing: '0.05em' }}>{insight.title}</span>
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{insight.body}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.22 }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}
            >
              {[
                { label: 'CORRETTI',      val: `${correct}/${total}` },
                { label: 'MATCH HIT',     val: String(hits)          },
                { label: 'FALSI ALARM',   val: String(fa)            },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.65)', fontFamily: "'Space Mono', monospace" }}>{s.val}</div>
                </div>
              ))}
            </motion.div>
          </>
        );
      })()}

      <button onClick={onSave} disabled={saving || saved} style={{ ...btnStyle(color, true), opacity: saved ? 0.55 : 1, marginBottom: 8 }}>
        {saved ? '✓ Salvato nel vault' : saving ? 'Salvataggio…' : 'Salva risultato'}
      </button>
      {saved && (
        <button onClick={onBack} style={{ ...btnStyle(color, true), opacity: 0.6 }}>
          Torna ai test
        </button>
      )}
    </motion.div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────
function DashboardView({ entries, color, onBack }: { entries: VaultEntry[]; color: string; onBack: () => void }) {
  // Per-category best score average
  const catScores = CATEGORIES.map(cat => {
    const testBests = cat.tests.map(t => {
      const runs = entries.filter(e => e.data.test_id === t.id);
      return runs.length > 0 ? Math.max(...runs.map(e => t.scoreValue(e))) : null;
    }).filter((s): s is number => s !== null);
    const score = testBests.length > 0 ? Math.round(testBests.reduce((a, b) => a + b, 0) / testBests.length) : null;
    const count = cat.tests.reduce((acc, t) => acc + entries.filter(e => e.data.test_id === t.id).length, 0);
    return { ...cat, score, count };
  });

  const validScores = catScores.filter(c => c.score !== null).map(c => c.score as number);
  const overallScore = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;

  const recent = [...entries]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  // Profile tags
  const tags: { label: string; color: string }[] = [];
  catScores.forEach(c => {
    if (c.score === null) return;
    if (c.score >= 80) tags.push({ label: `Alta ${c.label}`, color: color });
    else if (c.score < 50) tags.push({ label: `${c.label} da allenare`, color: 'rgba(239,68,68,0.7)' });
  });
  if (entries.length >= 10) tags.push({ label: `${entries.length} sessioni`, color: 'rgba(255,255,255,0.2)' });

  // SVG Radar
  const N = catScores.length;
  const cx = 110, cy = 115, r = 78;
  const angles = catScores.map((_, i) => (Math.PI * 2 * i) / N - Math.PI / 2);
  const toPoint = (angle: number, value: number) => {
    const d = (value / 100) * r;
    return [cx + d * Math.cos(angle), cy + d * Math.sin(angle)] as [number, number];
  };
  const labelPad = 22;
  const gridLevels = [33, 66, 100];

  const scoreColor = (s: number | null) => {
    if (s === null) return 'rgba(255,255,255,0.15)';
    if (s >= 75) return color;
    if (s >= 50) return 'rgba(255,255,255,0.55)';
    return '#ef4444';
  };

  const testForEntry = (e: VaultEntry) => ALL_TESTS.find(t => t.id === e.data.test_id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <motion.button
          onClick={onBack}
          whileHover={{ opacity: 0.8 }}
          whileTap={{ scale: 0.95 }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontSize: 11 }}
        >
          <ChevronLeft size={13} /> Batteria
        </motion.button>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em', textTransform: 'uppercase', marginLeft: 'auto' }}>
          Profilo Cognitivo
        </span>
      </div>

      {/* Overall score */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
            Score Globale
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: overallScore !== null ? color : 'rgba(255,255,255,0.15)', fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>
            {overallScore !== null ? overallScore : '—'}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', marginTop: 4 }}>
            su {validScores.length}/{N} aree · {entries.length} sessioni
          </div>
        </div>
        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginLeft: 'auto', justifyContent: 'flex-end', maxWidth: 200 }}>
          {tags.map((t, i) => (
            <span key={i} style={{
              fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
              color: t.color, border: `1px solid ${t.color}`,
              borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap',
            }}>{t.label}</span>
          ))}
        </div>
      </div>

      {/* Radar chart */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <svg width={220} height={230} style={{ overflow: 'visible' }}>
          {/* Grid polygons */}
          {gridLevels.map(level => (
            <polygon
              key={level}
              points={catScores.map((_, i) => toPoint(angles[i], level).join(',')).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}
          {/* Axis lines */}
          {catScores.map((cat, i) => {
            const [x, y] = toPoint(angles[i], 100);
            return <line key={cat.id} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />;
          })}
          {/* Data polygon */}
          {validScores.length >= 2 && (
            <polygon
              points={catScores.map((c, i) => toPoint(angles[i], c.score ?? 0).join(',')).join(' ')}
              fill={`${color}22`}
              stroke={color}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}
          {/* Data points */}
          {catScores.map((c, i) => {
            const [x, y] = toPoint(angles[i], c.score ?? 0);
            return c.score !== null ? (
              <circle key={c.id} cx={x} cy={y} r={3.5} fill={color} opacity={0.9} />
            ) : null;
          })}
          {/* Labels */}
          {catScores.map((c, i) => {
            const [lx, ly] = toPoint(angles[i], 100 + labelPad);
            const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';
            return (
              <text key={c.id} x={lx} y={ly + 4} textAnchor={anchor}
                style={{ fontSize: 9, fill: c.score !== null ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)', fontFamily: 'inherit' }}>
                {c.icon} {c.label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Category breakdown bars */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
          Aree Cognitive
        </div>
        {catScores.map(c => (
          <div key={c.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{c.icon} {c.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor(c.score), fontFamily: "'Space Mono', monospace" }}>
                {c.score !== null ? c.score : '—'}
              </span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${c.score ?? 0}%` }}
                transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 2, background: scoreColor(c.score) }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Sessioni Recenti
          </div>
          {recent.map(e => {
            const td = testForEntry(e);
            const s = e.data.score as number;
            const date = new Date(e.created_at);
            const dateStr = date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
            return (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: "'Space Mono', monospace", minWidth: 40 }}>{dateStr}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{td?.label ?? e.data.test_id as string}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(s), fontFamily: "'Space Mono', monospace" }}>{s}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Hub (categories + tests) ─────────────────────────────────
function HubView({
  entries, color, onSelectTest, tokenState, onOpenDashboard,
}: {
  entries: VaultEntry[];
  color: string;
  onSelectTest: (test: TestDef) => void;
  tokenState: QuizTokenState | null;
  onOpenDashboard: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
          Cognitive Battery
        </p>
        {entries.length > 0 && (
          <motion.button
            onClick={onOpenDashboard}
            whileHover={{ scale: 1.03, color: color }}
            whileTap={{ scale: 0.96 }}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
              fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'color 0.15s',
            }}
          >
            Profilo →
          </motion.button>
        )}
      </div>

      {CATEGORIES.map((cat, ci) => (
        <div key={cat.id} style={{ marginBottom: ci < CATEGORIES.length - 1 ? 20 : 0 }}>
          {/* Category header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>{cat.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {cat.label}
            </span>
          </div>

          {/* Tests in this category */}
          {cat.tests.map(test => {
            const runs      = entries.filter(e => e.data.test_id === test.id);
            const best      = runs.length > 0 ? Math.max(...runs.map(e => test.scoreValue(e))) : null;
            const testUsed  = getTestUsed(tokenState ?? { usage: {}, entryId: null, weekStart: '', resetAt: '' }, test.id);
            const testLocked = isTestLocked(tokenState, test.id);
            return (
              <motion.button
                key={test.id}
                onClick={() => onSelectTest(test)}
                whileHover={{ scale: testLocked ? 1 : 1.015 }}
                whileTap={{ scale: testLocked ? 1 : 0.98 }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: testLocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer', marginBottom: 6,
                  transition: 'background 0.15s', opacity: testLocked ? 0.5 : 1,
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: testLocked ? 'rgba(255,255,255,0.35)' : '#fff', marginBottom: 2 }}>
                    {testLocked ? '🔒 ' : ''}{test.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)' }}>{test.duration}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  {tokenState && (
                    <div style={{
                      fontSize: 9, fontWeight: 600,
                      color: testLocked ? '#ef4444' : testUsed > 0 ? color : 'rgba(255,255,255,0.2)',
                      fontFamily: "'Space Mono', monospace", marginBottom: 3,
                    }}>
                      {testUsed}/{QUIZ_MAX_TOKENS}
                    </div>
                  )}
                  {best !== null ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 700, color: testLocked ? 'rgba(255,255,255,0.25)' : color, fontFamily: "'Space Mono', monospace" }}>{best}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>best · {runs.length} run</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em' }}>mai fatto</div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      ))}
    </motion.div>
  );
}

// ─── Tapping Test ─────────────────────────────────────────────
interface TapData { total_taps: number; taps_per_second: number }

function TapTest({ color, onDone }: { color: string; onDone: (d: TapData) => void }) {
  const [tapPhase, setTapPhase] = useState<'idle' | 'counting' | 'done'>('idle');
  const [taps, setTaps]         = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapsRef   = useRef(0);
  const doneRef   = useRef(false);
  const DURATION  = 10;

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const start = () => {
    tapsRef.current = 0;
    doneRef.current = false;
    setTaps(0);
    setTimeLeft(DURATION);
    setTapPhase('counting');
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTapPhase('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePointer = (e: React.PointerEvent) => {
    e.preventDefault();
    if (tapPhase === 'idle') { start(); return; }
    if (tapPhase !== 'counting') return;
    tapsRef.current++;
    setTaps(tapsRef.current);
  };

  useEffect(() => {
    if (tapPhase === 'done' && !doneRef.current) {
      doneRef.current = true;
      const total = tapsRef.current;
      const tps   = parseFloat((total / DURATION).toFixed(1));
      setTimeout(() => onDone({ total_taps: total, taps_per_second: tps }), 500);
    }
  }, [tapPhase, onDone]);

  const progress = ((DURATION - timeLeft) / DURATION) * 100;

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Tapping Test · velocità psicomotoria
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 22 }}>
        {tapPhase === 'idle' ? 'Tocca il pulsante per iniziare, poi tappa più veloce che puoi' :
         tapPhase === 'counting' ? 'TAPPA!' : 'Calcolo…'}
      </p>

      {tapPhase === 'counting' && (
        <div style={{ width: 200, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, margin: '0 auto 16px', overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', background: color, borderRadius: 2, transformOrigin: 'left' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.9, ease: 'linear' }}
          />
        </div>
      )}

      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 18, minHeight: 38 }}>
        {tapPhase === 'counting' && <span>{timeLeft}s</span>}
        {tapPhase === 'counting' && <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.5)', marginLeft: 10 }}>{taps} tap</span>}
      </div>

      <motion.button
        onPointerDown={handlePointer}
        disabled={tapPhase === 'done'}
        whileTap={{ scale: tapPhase === 'counting' ? 0.92 : 1 }}
        style={{
          width: 160, height: 160, borderRadius: '50%',
          background: tapPhase === 'counting' ? `${color}22` : 'rgba(255,255,255,0.04)',
          border: `2px solid ${tapPhase === 'counting' ? color : 'rgba(255,255,255,0.12)'}`,
          cursor: tapPhase === 'done' ? 'default' : 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto', userSelect: 'none', touchAction: 'none',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        <span style={{ fontSize: tapPhase === 'counting' ? 42 : 22, fontWeight: 700, color: tapPhase === 'counting' ? color : 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
          {tapPhase === 'idle' ? '▶' : tapPhase === 'counting' ? taps : '…'}
        </span>
        {tapPhase === 'idle' && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Inizia</span>}
      </motion.button>
    </div>
  );
}

// ─── Dual Tapping Test ────────────────────────────────────────
interface DualTapData { total_alternations: number; taps_per_second: number; errors: number }

function DualTapTest({ color, onDone }: { color: string; onDone: (d: DualTapData) => void }) {
  const [dtPhase, setDtPhase]   = useState<'idle' | 'counting' | 'done'>('idle');
  const [active, setActive]     = useState<0 | 1>(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [taps, setTaps]         = useState(0);
  const [errors, setErrors]     = useState(0);
  const [errorCircle, setErrorCircle] = useState<0 | 1 | null>(null);
  const activeRef  = useRef<0 | 1>(0);
  const tapsRef    = useRef(0);
  const errorsRef  = useRef(0);
  const doneRef    = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION   = 15;

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const start = () => {
    tapsRef.current = 0; errorsRef.current = 0; doneRef.current = false;
    activeRef.current = 0;
    setActive(0); setTaps(0); setErrors(0); setTimeLeft(DURATION); setDtPhase('counting');
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setDtPhase('done'); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTap = (idx: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (dtPhase === 'idle') { start(); return; }
    if (dtPhase !== 'counting') return;
    if (idx === activeRef.current) {
      tapsRef.current++;
      const next = (1 - activeRef.current) as 0 | 1;
      activeRef.current = next;
      setActive(next);
      setTaps(tapsRef.current);
    } else {
      errorsRef.current++;
      setErrors(errorsRef.current);
      setErrorCircle(idx);
      setTimeout(() => setErrorCircle(null), 150);
    }
  };

  useEffect(() => {
    if (dtPhase === 'done' && !doneRef.current) {
      doneRef.current = true;
      const total = tapsRef.current;
      const tps   = parseFloat((total / DURATION).toFixed(2));
      setTimeout(() => onDone({ total_alternations: total, taps_per_second: tps, errors: errorsRef.current }), 500);
    }
  }, [dtPhase, onDone]);

  const progress = ((DURATION - timeLeft) / DURATION) * 100;
  const LABELS   = ['☝ Indice', '✌ Medio'];

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        Psychomotor Speed · alternanza dita
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
        {dtPhase === 'idle' ? 'Tocca un cerchio per iniziare · alterna Indice ↔ Medio più veloce che puoi' :
         dtPhase === 'counting' ? 'ALTERNA le dita!' : 'Calcolo…'}
      </p>

      {dtPhase === 'counting' && (
        <div style={{ width: 200, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, margin: '0 auto 12px', overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', background: color, borderRadius: 2, transformOrigin: 'left' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.9, ease: 'linear' }}
          />
        </div>
      )}

      <div style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 20, minHeight: 30 }}>
        {dtPhase === 'counting' && (
          <>
            <span>{timeLeft}s</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.5)', marginLeft: 10 }}>{taps} alt.</span>
            {errors > 0 && <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 8 }}>{errors} err</span>}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', alignItems: 'center' }}>
        {([0, 1] as const).map(idx => {
          const isActive = active === idx && dtPhase === 'counting';
          const isErr    = errorCircle === idx;
          return (
            <motion.button
              key={idx}
              onPointerDown={handleTap(idx)}
              disabled={dtPhase === 'done'}
              animate={{ scale: isActive ? 1.08 : 1 }}
              transition={{ duration: 0.1 }}
              style={{
                width: 120, height: 120, borderRadius: '50%',
                background: isErr ? 'rgba(239,68,68,0.12)' : isActive ? `${color}20` : 'rgba(255,255,255,0.03)',
                border: `2px solid ${isErr ? '#ef4444' : isActive ? color : 'rgba(255,255,255,0.1)'}`,
                cursor: dtPhase === 'done' ? 'default' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                userSelect: 'none', touchAction: 'none',
                transition: 'border-color 0.12s, background 0.12s',
                boxShadow: isActive && !isErr ? `0 0 20px ${color}30` : 'none',
              }}
            >
              <span style={{ fontSize: 20, marginBottom: 4 }}>
                {dtPhase === 'idle' ? '▶' : (idx === 0 ? '☝' : '✌')}
              </span>
              <span style={{ fontSize: 10, color: isErr ? '#ef4444' : isActive ? color : 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.06em' }}>
                {LABELS[idx]}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stroop Test ──────────────────────────────────────────────
interface StroopData { correct: number; total: number; avg_ms: number }

function StroopTest({ color, onDone }: { color: string; onDone: (d: StroopData) => void }) {
  const TRIALS = 16;
  const [phase, setPhase]     = useState<'idle' | 'testing' | 'feedback'>('idle');
  const [trialNum, setTrialNum] = useState(0);
  const [wordIdx, setWordIdx]  = useState(0);
  const [inkIdx, setInkIdx]    = useState(1);
  const [options, setOptions]  = useState<typeof STROOP_COLORS>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const correctRef = useRef(0);
  const rtsRef     = useRef<number[]>([]);
  const startRef   = useRef(0);
  const lockRef    = useRef(false);

  const nextTrial = useCallback((n: number) => {
    lockRef.current = false;
    const wIdx = Math.floor(Math.random() * STROOP_COLORS.length);
    let iIdx: number;
    do { iIdx = Math.floor(Math.random() * STROOP_COLORS.length); } while (iIdx === wIdx);
    const others  = STROOP_COLORS.filter((_, i) => i !== iIdx);
    const opts    = [...others.sort(() => Math.random() - 0.5).slice(0, 3), STROOP_COLORS[iIdx]]
      .sort(() => Math.random() - 0.5);
    setWordIdx(wIdx);
    setInkIdx(iIdx);
    setOptions(opts);
    setFeedback(null);
    setTrialNum(n);
    setPhase('testing');
    startRef.current = performance.now();
  }, []);

  const handleAnswer = useCallback((optHex: string) => {
    if (lockRef.current || phase !== 'testing') return;
    lockRef.current = true;
    const rt = Math.round(performance.now() - startRef.current);
    const isRight = optHex === STROOP_COLORS[inkIdx].hex;
    rtsRef.current.push(rt);
    if (isRight) correctRef.current++;
    setFeedback(isRight ? 'correct' : 'wrong');
    setPhase('feedback');
    const nextN = trialNum + 1;
    if (nextN > TRIALS) {
      const avg = Math.round(rtsRef.current.reduce((a, b) => a + b, 0) / rtsRef.current.length);
      setTimeout(() => onDone({ correct: correctRef.current, total: TRIALS, avg_ms: avg }), 650);
    } else {
      setTimeout(() => nextTrial(nextN), 650);
    }
  }, [phase, inkIdx, trialNum, nextTrial, onDone]);

  if (phase === 'idle') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          Test di Stroop · {TRIALS} trial
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10, lineHeight: 1.6 }}>
          Vedrai una parola colorata.<br />
          Indica il <strong style={{ color }}>colore dell'inchiostro</strong>, ignora ciò che è scritto.
        </p>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px', marginBottom: 18 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6', letterSpacing: '0.08em' }}>ROSSO</span>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', margin: '6px 0 0', letterSpacing: '0.08em' }}>risposta corretta: BLU</p>
        </div>
        <button onClick={() => nextTrial(1)} style={btnStyle(color, true)}>Inizia test</button>
      </div>
    );
  }

  const inkColor = STROOP_COLORS[inkIdx]?.hex ?? '#fff';
  const wordName = STROOP_COLORS[wordIdx]?.name ?? '';

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
        Trial {trialNum}/{TRIALS}
      </p>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginBottom: 22, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((trialNum - 1) / TRIALS) * 100}%`, background: color, borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>

      {/* The stimulus word */}
      <motion.div
        key={`word-${trialNum}`}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        style={{ fontSize: 44, fontWeight: 900, color: inkColor, letterSpacing: '0.06em', marginBottom: 8, lineHeight: 1 }}
      >
        {wordName}
      </motion.div>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 20, letterSpacing: '0.06em' }}>
        DI CHE COLORE È L'INCHIOSTRO?
      </p>

      {/* 4 color option buttons in 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {options.map(opt => (
          <motion.button
            key={opt.hex}
            onClick={() => handleAnswer(opt.hex)}
            disabled={phase === 'feedback'}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            style={{
              background: `${opt.hex}18`,
              border: `1.5px solid ${opt.hex}55`,
              borderRadius: 10, padding: '12px 8px',
              cursor: phase === 'feedback' ? 'default' : 'pointer',
              transition: 'background 0.12s',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: opt.hex, letterSpacing: '0.05em' }}>{opt.name}</span>
          </motion.button>
        ))}
      </div>

      {/* Feedback flash */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ fontSize: 18, color: feedback === 'correct' ? '#22c55e' : '#ef4444', fontWeight: 700 }}
          >
            {feedback === 'correct' ? '✓' : '✗'}
          </motion.div>
        )}
      </AnimatePresence>

      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 10, letterSpacing: '0.05em' }}>
        {correctRef.current} corrette
      </p>
    </div>
  );
}

// ─── Vigilance (Target Finder) Test ───────────────────────────
interface VigilanceData { hits: number; false_alarms: number; misses: number; total_targets: number }

function VigilanceTest({ color, onDone }: { color: string; onDone: (d: VigilanceData) => void }) {
  const [phase, setPhase]     = useState<'idle' | 'running' | 'done'>('idle');
  const [grid, setGrid]       = useState<string[]>([]);
  const [roundDisp, setRoundDisp] = useState(0);
  const [flash, setFlash]     = useState<'hit' | 'fa' | null>(null);
  const [responded, setResponded] = useState(false);

  const hitsRef       = useRef(0);
  const faRef         = useRef(0);
  const missesRef     = useRef(0);
  const targetsRef    = useRef(0);
  const respondedRef  = useRef(false);
  const hasTargetRef  = useRef(false);
  const roundRef      = useRef(0);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef       = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const buildGrid = useCallback((): { cells: string[]; hasTarget: boolean } => {
    const showTarget = Math.random() < 0.4;
    const cells = Array.from({ length: 16 }, () =>
      VIGILANCE_DISTRACTORS[Math.floor(Math.random() * VIGILANCE_DISTRACTORS.length)]
    );
    if (showTarget) cells[Math.floor(Math.random() * 16)] = VIGILANCE_TARGET;
    return { cells, hasTarget: showTarget };
  }, []);

  const start = useCallback(() => {
    hitsRef.current = 0; faRef.current = 0; missesRef.current = 0;
    targetsRef.current = 0; respondedRef.current = false;
    hasTargetRef.current = false; roundRef.current = 0; doneRef.current = false;

    const tick = () => {
      if (doneRef.current) return;
      // score previous round
      if (roundRef.current >= 1 && hasTargetRef.current && !respondedRef.current) {
        missesRef.current++;
      }
      roundRef.current++;
      if (roundRef.current > VIGILANCE_ROUNDS) {
        doneRef.current = true;
        clearInterval(timerRef.current!);
        setPhase('done');
        setTimeout(() => onDone({
          hits: hitsRef.current, false_alarms: faRef.current,
          misses: missesRef.current, total_targets: targetsRef.current,
        }), 400);
        return;
      }
      respondedRef.current = false;
      const { cells, hasTarget } = buildGrid();
      hasTargetRef.current = hasTarget;
      if (hasTarget) targetsRef.current++;
      setGrid(cells);
      setResponded(false);
      setFlash(null);
      setRoundDisp(roundRef.current);
    };

    tick(); // first round immediately
    timerRef.current = setInterval(tick, VIGILANCE_INTERVAL);
    setPhase('running');
  }, [buildGrid, onDone]);

  const handleDetect = () => {
    if (phase !== 'running' || respondedRef.current) return;
    respondedRef.current = true;
    setResponded(true);
    if (hasTargetRef.current) {
      hitsRef.current++;
      setFlash('hit');
    } else {
      faRef.current++;
      setFlash('fa');
    }
  };

  if (phase === 'idle') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          Target Finder · {VIGILANCE_ROUNDS} round
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 14, lineHeight: 1.6 }}>
          Cerca il simbolo bersaglio nella griglia.<br />
          Premi <strong style={{ color }}>RILEVATO!</strong> solo quando appare.
        </p>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px', marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', marginBottom: 6 }}>SIMBOLO BERSAGLIO</div>
          <span style={{ fontSize: 40, color }}>{VIGILANCE_TARGET}</span>
        </div>
        <button onClick={start} style={btnStyle(color, true)}>Inizia test</button>
      </div>
    );
  }

  const progress = (roundDisp / VIGILANCE_ROUNDS) * 100;
  const flashColor = flash === 'hit' ? '#22c55e' : flash === 'fa' ? '#ef4444' : 'transparent';

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Target reminder */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>CERCA</span>
          <span style={{ fontSize: 18, color }}>{VIGILANCE_TARGET}</span>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'Space Mono', monospace" }}>
          {roundDisp}/{VIGILANCE_ROUNDS}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: color, borderRadius: 2 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>

      {/* 4×4 grid */}
      <motion.div
        key={roundDisp}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.1 }}
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5,
          background: `${flashColor}10`, border: `1px solid ${flashColor}30`,
          borderRadius: 14, padding: 10, marginBottom: 14,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {grid.map((sym, i) => (
          <div key={i} style={{
            height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: sym === VIGILANCE_TARGET ? 20 : 16,
            color: sym === VIGILANCE_TARGET ? color : 'rgba(255,255,255,0.35)',
            fontWeight: sym === VIGILANCE_TARGET ? 700 : 400,
            background: 'rgba(255,255,255,0.03)', borderRadius: 8,
          }}>
            {sym}
          </div>
        ))}
      </motion.div>

      {/* Detect button */}
      <motion.button
        onClick={handleDetect}
        disabled={responded}
        whileTap={{ scale: 0.94 }}
        style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: responded ? 'rgba(255,255,255,0.03)' : `${color}20`,
          border: `1.5px solid ${responded ? 'rgba(255,255,255,0.08)' : color + '60'}`,
          color: responded ? 'rgba(255,255,255,0.25)' : color,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
          cursor: responded ? 'default' : 'pointer',
          transition: 'all 0.12s',
        }}
      >
        {responded
          ? (flash === 'hit' ? '✓ Corretto' : '✗ Falso allarme')
          : 'RILEVATO!'}
      </motion.button>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 10 }}>
        {[
          { label: 'HIT', val: hitsRef.current, c: '#22c55e' },
          { label: 'FA',  val: faRef.current,   c: '#ef4444' },
        ].map(s => (
          <span key={s.label} style={{ fontSize: 10, color: s.c, opacity: 0.7 }}>
            {s.label} <strong style={{ fontFamily: "'Space Mono', monospace" }}>{s.val}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Sternberg Search Task ────────────────────────────────────
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const STERNBERG_SET_SIZE  = 4;
const STERNBERG_TRIALS    = 12; // 6 target-present, 6 target-absent

interface SternbergData { correct: number; total: number; avg_ms: number }

function SternbergTest({ color, onDone }: { color: string; onDone: (d: SternbergData) => void }) {
  type SPhase = 'idle' | 'show' | 'probe' | 'feedback';
  const [sPhase, setSPhase]     = useState<SPhase>('idle');
  const [letterSet, setLetterSet] = useState<string[]>([]);
  const [probe, setProbe]       = useState('');
  const [isTarget, setIsTarget] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [trial, setTrial]       = useState(0);
  const correctRef              = useRef(0);
  const rtTimes                 = useRef<number[]>([]);
  const startRef                = useRef(0);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const runTrial = useCallback((trialIndex: number) => {
    const shuffled = [...ALPHABET].sort(() => Math.random() - 0.5);
    const set = shuffled.slice(0, STERNBERG_SET_SIZE);
    const targetPresent = trialIndex % 2 === 0; // alternating ensures balance
    const p = targetPresent
      ? set[Math.floor(Math.random() * STERNBERG_SET_SIZE)]
      : shuffled.slice(STERNBERG_SET_SIZE).find(l => !set.includes(l)) ?? shuffled[STERNBERG_SET_SIZE];
    setLetterSet(set);
    setProbe(p);
    setIsTarget(targetPresent);
    setFeedback(null);
    setSPhase('show');
    timerRef.current = setTimeout(() => {
      setSPhase('probe');
      startRef.current = performance.now();
    }, 2000);
  }, []);

  const handleAnswer = useCallback((answer: boolean) => {
    if (sPhase !== 'probe') return;
    const rt = Math.round(performance.now() - startRef.current);
    const correct = answer === isTarget;
    if (correct) {
      correctRef.current += 1;
      rtTimes.current.push(rt);
    }
    setFeedback(correct ? 'correct' : 'wrong');
    setSPhase('feedback');
    const nextTrial = trial + 1;
    timerRef.current = setTimeout(() => {
      if (nextTrial >= STERNBERG_TRIALS) {
        const avg = rtTimes.current.length > 0
          ? Math.round(rtTimes.current.reduce((a, b) => a + b, 0) / rtTimes.current.length)
          : 999;
        onDone({ correct: correctRef.current, total: STERNBERG_TRIALS, avg_ms: avg });
      } else {
        setTrial(nextTrial);
        runTrial(nextTrial);
      }
    }, 700);
  }, [sPhase, isTarget, trial, runTrial, onDone]);

  if (sPhase === 'idle') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          Sternberg Search · memoria a breve termine
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.7 }}>
          Vedrai 4 lettere per 2 secondi.<br />
          Poi una lettera sola: era nel set?
        </p>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => { setTrial(0); runTrial(0); }}
          style={btnStyle(color, true)}
        >
          INIZIA
        </motion.button>
      </div>
    );
  }

  if (sPhase === 'show') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 22 }}>
          Memorizza · {trial + 1}/{STERNBERG_TRIALS}
        </p>
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 24 }}>
          {letterSet.map((l, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              style={{
                fontSize: 40, fontWeight: 700, color,
                fontFamily: "'Space Mono', monospace",
                background: `${color}12`, borderRadius: 10,
                padding: '10px 16px',
                border: `1px solid ${color}30`,
              }}
            >
              {l}
            </motion.span>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Ricordali…</p>
      </div>
    );
  }

  if (sPhase === 'probe' || sPhase === 'feedback') {
    const fb = feedback;
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 22 }}>
          Era nel set? · {trial + 1}/{STERNBERG_TRIALS}
        </p>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            fontSize: 64, fontWeight: 700,
            color: fb === 'correct' ? '#22c55e' : fb === 'wrong' ? '#ef4444' : color,
            fontFamily: "'Space Mono', monospace",
            margin: '0 auto 28px',
            background: `${color}10`, borderRadius: 16,
            width: 100, height: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${color}25`,
          }}
        >
          {probe}
        </motion.div>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => handleAnswer(true)}
            disabled={sPhase === 'feedback'}
            style={{
              ...btnStyle('#22c55e'),
              fontSize: 14, padding: '12px 28px', fontWeight: 700,
              opacity: sPhase === 'feedback' ? 0.4 : 1,
            }}
          >
            SÌ
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => handleAnswer(false)}
            disabled={sPhase === 'feedback'}
            style={{
              ...btnStyle('#ef4444'),
              fontSize: 14, padding: '12px 28px', fontWeight: 700,
              opacity: sPhase === 'feedback' ? 0.4 : 1,
            }}
          >
            NO
          </motion.button>
        </div>
        {fb && (
          <p style={{ marginTop: 16, fontSize: 12, color: fb === 'correct' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
            {fb === 'correct' ? '✓ Corretto' : '✗ Sbagliato'}
            {fb === 'correct' && ` · ${Math.round(performance.now() - startRef.current - (performance.now() - startRef.current))}ms`}
          </p>
        )}
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            Corretti: {correctRef.current}/{trial + (fb ? 1 : 0)}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Attentional Blink Test ───────────────────────────────────
const AB_DIGITS = [2, 3, 4, 5, 6, 7, 8, 9];
const AB_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const AB_T1_POS = 7;
const AB_STREAM_LEN = 20;
const AB_ITEM_MS = 100;
const AB_PLAN = [2, 3, 4, 8, 2, 3, 4, 8]; // lags for 8 trials

interface ABTrial { lag: number; t1_digit: number; t2_digit: number; t1_answer: number | null; t2_answer: number | null }
interface ABData { trials: ABTrial[]; t1_accuracy: number; t2_acc_critical: number; t2_acc_late: number; ab_effect: number }

function abStream(t1: number, t2: number, lag: number): string[] {
  const items: string[] = [];
  for (let i = 0; i < AB_STREAM_LEN; i++) {
    if (i === AB_T1_POS) items.push(String(t1));
    else if (i === AB_T1_POS + lag) items.push(String(t2));
    else items.push(AB_LETTERS[Math.floor(Math.random() * AB_LETTERS.length)]);
  }
  return items;
}
function abChoices(target: number): number[] {
  const pool = AB_DIGITS.filter(d => d !== target).sort(() => Math.random() - 0.5).slice(0, 3);
  return [...pool, target].sort(() => Math.random() - 0.5);
}
function abCompute(trials: ABTrial[]): ABData {
  const valid = trials.filter(t => t.t1_answer === t.t1_digit);
  const critical = valid.filter(t => t.lag <= 4);
  const late = valid.filter(t => t.lag === 8);
  const t1_accuracy = trials.length > 0 ? valid.length / trials.length : 0;
  const t2_acc_critical = critical.length > 0 ? critical.filter(t => t.t2_answer === t.t2_digit).length / critical.length : 0;
  const t2_acc_late = late.length > 0 ? late.filter(t => t.t2_answer === t.t2_digit).length / late.length : 0;
  const ab_effect = Math.max(0, t2_acc_late - t2_acc_critical);
  return { trials, t1_accuracy, t2_acc_critical, t2_acc_late, ab_effect };
}

type ABPhase = 'instructions' | 'rsvp' | 'answer_t1' | 'answer_t2' | 'iti';

function ABTest({ color, onDone }: { color: string; onDone: (d: ABData) => void }) {
  const [abPhase, setAbPhase] = useState<ABPhase>('instructions');
  const [trialIdx, setTrialIdx]     = useState(0);
  const [streamItems, setStreamItems] = useState<string[]>([]);
  const [streamIdx, setStreamIdx]   = useState(0);
  const [choices1, setChoices1]     = useState<number[]>([]);
  const [choices2, setChoices2]     = useState<number[]>([]);
  const [results, setResults]       = useState<ABTrial[]>([]);

  const planRef     = useRef<number[]>([]);
  const trialRef    = useRef<Partial<ABTrial>>({});
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TOTAL       = AB_PLAN.length;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const runTrial = useCallback((idx: number, plan: number[]) => {
    const lag = plan[idx];
    const digits = [...AB_DIGITS].sort(() => Math.random() - 0.5);
    const t1 = digits[0], t2 = digits[1];
    trialRef.current = { lag, t1_digit: t1, t2_digit: t2 };
    const stream = abStream(t1, t2, lag);
    setStreamItems(stream);
    setStreamIdx(0);
    setAbPhase('rsvp');

    let i = 0;
    const tick = () => {
      setStreamIdx(i);
      i++;
      if (i < stream.length) {
        timerRef.current = setTimeout(tick, AB_ITEM_MS);
      } else {
        timerRef.current = setTimeout(() => {
          setChoices1(abChoices(t1));
          setChoices2(abChoices(t2));
          setAbPhase('answer_t1');
        }, 300);
      }
    };
    timerRef.current = setTimeout(tick, AB_ITEM_MS);
  }, []);

  const start = useCallback(() => {
    const plan = [...AB_PLAN].sort(() => Math.random() - 0.5);
    planRef.current = plan;
    setTrialIdx(0);
    setResults([]);
    runTrial(0, plan);
  }, [runTrial]);

  const submitT1 = (val: number) => {
    trialRef.current.t1_answer = val;
    setAbPhase('answer_t2');
  };

  const submitT2 = (val: number) => {
    const trial: ABTrial = {
      lag: trialRef.current.lag!,
      t1_digit: trialRef.current.t1_digit!,
      t2_digit: trialRef.current.t2_digit!,
      t1_answer: trialRef.current.t1_answer ?? null,
      t2_answer: val,
    };
    const next = [...results, trial];
    setResults(next);
    const nextIdx = trialIdx + 1;
    setTrialIdx(nextIdx);
    if (nextIdx >= planRef.current.length) {
      onDone(abCompute(next));
    } else {
      setAbPhase('iti');
      timerRef.current = setTimeout(() => runTrial(nextIdx, planRef.current), 500);
    }
  };

  if (abPhase === 'instructions') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Attentional Blink</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10, lineHeight: 1.65 }}>
          Una sequenza di lettere lampeggerà rapidissima al centro.<br/>
          <strong style={{ color: '#fff' }}>Individua i due numeri</strong> nascosti nella sequenza.
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 8, lineHeight: 1.6 }}>
          Dopo ogni sequenza seleziona quale numero hai visto <em>prima</em> e quale <em>dopo</em>.
        </p>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 24 }}>8 sequenze · ~2 min</p>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={start} style={btnStyle(color, true)}>
          INIZIA
        </motion.button>
      </div>
    );
  }

  if (abPhase === 'rsvp' || abPhase === 'iti') {
    const item   = streamItems[streamIdx] ?? '';
    const isNum  = /\d/.test(item);
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          Sequenza {trialIdx + 1} / {TOTAL}
        </p>
        <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {abPhase === 'rsvp' ? (
            <AnimatePresence mode="wait">
              <motion.span
                key={streamIdx}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.03 }}
                style={{ fontSize: 80, fontWeight: 700, color: isNum ? color : 'rgba(255,255,255,0.88)', fontFamily: "'Space Mono', monospace", userSelect: 'none' }}
              >
                {item}
              </motion.span>
            </AnimatePresence>
          ) : (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>…</span>
          )}
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 6 }}>individua i due numeri</p>
      </div>
    );
  }

  const isT1Phase = abPhase === 'answer_t1';
  const choices   = isT1Phase ? choices1 : choices2;
  const submitFn  = isT1Phase ? submitT1 : submitT2;
  const label     = isT1Phase ? 'primo' : 'secondo';

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18 }}>
        Sequenza {trialIdx + 1} / {TOTAL} · {isT1Phase ? '1/2' : '2/2'}
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 22, lineHeight: 1.5 }}>
        Qual era il <strong style={{ color: '#fff' }}>{label} numero</strong>?
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {choices.map(v => (
          <motion.button
            key={v}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => submitFn(v)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, padding: '18px 0', fontSize: 28, fontWeight: 700,
              color: '#fff', fontFamily: "'Space Mono', monospace", cursor: 'pointer',
            }}
          >
            {v}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Simon Effect Test ────────────────────────────────────────
interface SimonData { effect_ms: number; congruent_ms: number; incongruent_ms: number; trials: number; accuracy: number }

function SimonTest({ color, onDone }: { color: string; onDone: (d: SimonData) => void }) {
  type SimonPhase = 'idle' | 'isi' | 'show' | 'feedback';
  const [sPhase, setSPhase] = useState<SimonPhase>('idle');
  const [trialNum, setTrialNum] = useState(0);
  const [stimulus, setStimulus] = useState<{ color: 'green' | 'red'; side: 'left' | 'right'; congruent: boolean } | null>(null);
  const [fb, setFb] = useState<'correct' | 'wrong' | null>(null);
  const TRIALS = 20;
  const rtRef = useRef(0);
  const congruentRTs = useRef<number[]>([]);
  const incongruentRTs = useRef<number[]>([]);
  const errorsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const nextTrial = useCallback((n: number) => {
    if (n > TRIALS) {
      const cMean = congruentRTs.current.length > 0 ? Math.round(congruentRTs.current.reduce((a, b) => a + b, 0) / congruentRTs.current.length) : 0;
      const icMean = incongruentRTs.current.length > 0 ? Math.round(incongruentRTs.current.reduce((a, b) => a + b, 0) / incongruentRTs.current.length) : 0;
      const totalAns = congruentRTs.current.length + incongruentRTs.current.length;
      const accuracy = totalAns > 0 ? (totalAns) / (totalAns + errorsRef.current) : 1;
      onDone({ effect_ms: Math.max(0, icMean - cMean), congruent_ms: cMean, incongruent_ms: icMean, trials: TRIALS, accuracy });
      return;
    }
    setTrialNum(n); setFb(null); setStimulus(null); setSPhase('isi');
    timerRef.current = setTimeout(() => {
      const stimColor = Math.random() < 0.5 ? 'green' as const : 'red' as const;
      const stimSide = Math.random() < 0.5 ? 'left' as const : 'right' as const;
      const congruent = (stimColor === 'green' && stimSide === 'left') || (stimColor === 'red' && stimSide === 'right');
      setStimulus({ color: stimColor, side: stimSide, congruent });
      rtRef.current = performance.now();
      setSPhase('show');
    }, 500 + Math.random() * 800);
  }, [onDone]);

  const respond = (side: 'left' | 'right') => {
    if (sPhase !== 'show' || !stimulus) return;
    const rt = Math.round(performance.now() - rtRef.current);
    const correct = (side === 'left' && stimulus.color === 'green') || (side === 'right' && stimulus.color === 'red');
    if (correct) {
      if (stimulus.congruent) congruentRTs.current.push(rt);
      else incongruentRTs.current.push(rt);
    } else {
      errorsRef.current++;
    }
    setFb(correct ? 'correct' : 'wrong');
    setSPhase('feedback');
    timerRef.current = setTimeout(() => nextTrial(trialNum + 1), 600);
  };

  if (sPhase === 'idle') return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Effetto Simon · {TRIALS} trial</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 18, lineHeight: 1.75 }}>
        Premi <strong style={{ color: '#22c55e' }}>VERDE ←</strong> per il cerchio verde<br />
        Premi <strong style={{ color: '#ef4444' }}>→ ROSSO</strong> per il cerchio rosso<br />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>indipendentemente da dove appare</span>
      </p>
      <button onClick={() => nextTrial(1)} style={btnStyle(color, true)}>Inizia</button>
    </div>
  );

  const circleHex = stimulus?.color === 'green' ? '#22c55e' : '#ef4444';

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
        Trial {trialNum}/{TRIALS}
      </p>
      <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginBottom: 22, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((trialNum - 1) / TRIALS) * 100}%`, background: color, borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ height: 120, display: 'flex', alignItems: 'center', position: 'relative', marginBottom: 16 }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 20, color: 'rgba(255,255,255,0.15)' }}>+</div>
        <AnimatePresence>
          {(sPhase === 'show' || sPhase === 'feedback') && stimulus && (
            <motion.div
              key={`stim-${trialNum}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.08 }}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: circleHex + '28', border: `3px solid ${circleHex}`,
                position: 'absolute',
                left: stimulus.side === 'left' ? '8%' : undefined,
                right: stimulus.side === 'right' ? '8%' : undefined,
                top: '50%', transform: 'translateY(-50%)',
              }}
            />
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {fb && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ fontSize: 22, fontWeight: 700, color: fb === 'correct' ? '#22c55e' : '#ef4444', marginBottom: 10 }}>
            {fb === 'correct' ? '✓' : '✗'}
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => respond('left')}
          disabled={sPhase !== 'show'}
          style={{ ...btnStyle('#22c55e'), opacity: sPhase !== 'show' ? 0.35 : 1, padding: '16px 0', fontSize: 11, width: '100%' }}>
          ← VERDE
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => respond('right')}
          disabled={sPhase !== 'show'}
          style={{ ...btnStyle('#ef4444'), opacity: sPhase !== 'show' ? 0.35 : 1, padding: '16px 0', fontSize: 11, width: '100%' }}>
          ROSSO →
        </motion.button>
      </div>
      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', marginTop: 10 }}>sinistra = verde · rosso = destra</p>
    </div>
  );
}

// ─── Task Switching Test ───────────────────────────────────────
interface TaskSwData { switch_cost_ms: number; repeat_ms: number; switch_ms: number; trials: number; accuracy: number }

const TASKSW_WARM = ['#ef4444', '#f97316', '#eab308'];
const TASKSW_COLD = ['#3b82f6', '#06b6d4', '#8b5cf6'];
const TASKSW_ALL_COLORS = [...TASKSW_WARM.map(h => ({ hex: h, warm: true })), ...TASKSW_COLD.map(h => ({ hex: h, warm: false }))];

function TaskSwTest({ color, onDone }: { color: string; onDone: (d: TaskSwData) => void }) {
  type TSPhase = 'idle' | 'isi' | 'show' | 'feedback';
  const [tsPhase, setTsPhase] = useState<TSPhase>('idle');
  const [trialNum, setTrialNum] = useState(0);
  const [stimulus, setStimulus] = useState<{ number: number; colorHex: string; isWarm: boolean; position: 'top' | 'bottom'; task: 'parity' | 'temperature' } | null>(null);
  const [fb, setFb] = useState<'correct' | 'wrong' | null>(null);
  const TRIALS = 20;
  const rtRef = useRef(0);
  const prevTaskRef = useRef<'parity' | 'temperature' | null>(null);
  const repeatRTs = useRef<number[]>([]);
  const switchRTs = useRef<number[]>([]);
  const errorsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const nextTrial = useCallback((n: number) => {
    if (n > TRIALS) {
      const repMean = repeatRTs.current.length > 0 ? Math.round(repeatRTs.current.reduce((a, b) => a + b, 0) / repeatRTs.current.length) : 0;
      const swMean = switchRTs.current.length > 0 ? Math.round(switchRTs.current.reduce((a, b) => a + b, 0) / switchRTs.current.length) : 0;
      const totalAns = repeatRTs.current.length + switchRTs.current.length;
      const accuracy = totalAns > 0 ? totalAns / (totalAns + errorsRef.current) : 1;
      onDone({ switch_cost_ms: Math.max(0, swMean - repMean), repeat_ms: repMean, switch_ms: swMean, trials: TRIALS, accuracy });
      return;
    }
    setTrialNum(n); setFb(null); setStimulus(null); setTsPhase('isi');
    timerRef.current = setTimeout(() => {
      const position = Math.random() < 0.5 ? 'top' as const : 'bottom' as const;
      const task = position === 'top' ? 'parity' as const : 'temperature' as const;
      const nums = [1, 2, 3, 4, 6, 7, 8, 9];
      const num = nums[Math.floor(Math.random() * nums.length)];
      const colorObj = TASKSW_ALL_COLORS[Math.floor(Math.random() * TASKSW_ALL_COLORS.length)];
      setStimulus({ number: num, colorHex: colorObj.hex, isWarm: colorObj.warm, position, task });
      rtRef.current = performance.now();
      setTsPhase('show');
    }, 400 + Math.random() * 600);
  }, [onDone]);

  const respond = (answer: string) => {
    if (tsPhase !== 'show' || !stimulus) return;
    const rt = Math.round(performance.now() - rtRef.current);
    let correct = false;
    if (stimulus.task === 'parity') {
      correct = (stimulus.number % 2 === 0 && answer === 'PARI') || (stimulus.number % 2 !== 0 && answer === 'DISPARI');
    } else {
      correct = (stimulus.isWarm && answer === 'CALDO') || (!stimulus.isWarm && answer === 'FREDDO');
    }
    if (correct) {
      if (prevTaskRef.current === stimulus.task) repeatRTs.current.push(rt);
      else if (prevTaskRef.current !== null) switchRTs.current.push(rt);
    } else {
      errorsRef.current++;
    }
    prevTaskRef.current = stimulus.task;
    setFb(correct ? 'correct' : 'wrong');
    setTsPhase('feedback');
    timerRef.current = setTimeout(() => nextTrial(trialNum + 1), 600);
  };

  if (tsPhase === 'idle') return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Task Switching · {TRIALS} trial</p>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 18, lineHeight: 1.8, textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
        <div>▲ <strong style={{ color: '#fff' }}>In alto:</strong> il numero è <strong style={{ color: color }}>Pari</strong> o <strong style={{ color: color }}>Dispari</strong>?</div>
        <div>▼ <strong style={{ color: '#fff' }}>In basso:</strong> il colore è <strong style={{ color: '#ef4444' }}>Caldo</strong> o <strong style={{ color: '#3b82f6' }}>Freddo</strong>?</div>
      </div>
      <button onClick={() => nextTrial(1)} style={btnStyle(color, true)}>Inizia</button>
    </div>
  );

  const isTop = stimulus?.position === 'top';
  const buttons = stimulus?.task === 'parity'
    ? [{ label: 'PARI', val: 'PARI' }, { label: 'DISPARI', val: 'DISPARI' }]
    : [{ label: '🔴 CALDO', val: 'CALDO' }, { label: '🔵 FREDDO', val: 'FREDDO' }];

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
        Trial {trialNum}/{TRIALS}
      </p>
      <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((trialNum - 1) / TRIALS) * 100}%`, background: color, borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ fontSize: 9, color: isTop ? color : 'rgba(255,255,255,0.15)', marginBottom: 2, letterSpacing: '0.1em', transition: 'color 0.15s' }}>▲ PARI / DISPARI</div>
      <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {tsPhase === 'isi' && (
            <motion.div key="fix" initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} exit={{ opacity: 0 }}
              style={{ fontSize: 24, color: '#fff' }}>+</motion.div>
          )}
          {(tsPhase === 'show' || tsPhase === 'feedback') && stimulus && (
            <motion.div key={`s-${trialNum}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.1 }}>
              <span style={{ fontSize: 72, fontWeight: 800, color: stimulus.colorHex, fontFamily: "'Space Mono', monospace" }}>
                {stimulus.number}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div style={{ fontSize: 9, color: !isTop ? color : 'rgba(255,255,255,0.15)', marginBottom: 14, letterSpacing: '0.1em', transition: 'color 0.15s' }}>▼ CALDO / FREDDO</div>
      <AnimatePresence>
        {fb && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ fontSize: 20, fontWeight: 700, color: fb === 'correct' ? '#22c55e' : '#ef4444', marginBottom: 10 }}>
            {fb === 'correct' ? '✓' : '✗'}
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {buttons.map(b => (
          <motion.button key={b.val} whileTap={{ scale: 0.95 }} onClick={() => respond(b.val)}
            disabled={tsPhase !== 'show'}
            style={{ ...btnStyle(color), opacity: tsPhase !== 'show' ? 0.35 : 1, padding: '16px 0', fontSize: 11, width: '100%' }}>
            {b.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── PVT Test ─────────────────────────────────────────────────
interface PVTData { median_ms: number; avg_ms: number; lapses: number; trials: number }

function PVTTest({ color, onDone }: { color: string; onDone: (d: PVTData) => void }) {
  type PVTPhase = 'idle' | 'wait' | 'counting' | 'registered';
  const [pvtPhase, setPvtPhase] = useState<PVTPhase>('idle');
  const [counter, setCounter] = useState(0);
  const [trialNum, setTrialNum] = useState(0);
  const [lastRT, setLastRT] = useState<number | null>(null);
  const TRIALS = 12;
  const LAPSE = 500;
  const rts = useRef<number[]>([]);
  const lapsesRef = useRef(0);
  const startRef = useRef(0);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  useEffect(() => () => {
    if (waitTimer.current) clearTimeout(waitTimer.current);
    if (countTimer.current) clearInterval(countTimer.current);
  }, []);

  const startTrial = useCallback((n: number) => {
    if (n > TRIALS) {
      doneRef.current = true;
      const sorted = [...rts.current].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length === 0 ? 300 : sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
      const avg = sorted.length === 0 ? 300 : Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
      onDone({ median_ms: median, avg_ms: avg, lapses: lapsesRef.current, trials: TRIALS });
      return;
    }
    setTrialNum(n); setLastRT(null); setCounter(0); setPvtPhase('wait');
    const delay = 2000 + Math.random() * 8000;
    waitTimer.current = setTimeout(() => {
      if (doneRef.current) return;
      startRef.current = performance.now();
      setPvtPhase('counting');
      countTimer.current = setInterval(() => setCounter(Math.round(performance.now() - startRef.current)), 16);
    }, delay);
  }, [onDone]);

  const handleTap = useCallback(() => {
    if (pvtPhase === 'idle') return;
    if (pvtPhase === 'wait') {
      if (waitTimer.current) clearTimeout(waitTimer.current);
      setPvtPhase('idle');
      setTimeout(() => startTrial(trialNum), 800);
      return;
    }
    if (pvtPhase !== 'counting') return;
    clearInterval(countTimer.current!);
    const rt = Math.round(performance.now() - startRef.current);
    rts.current.push(rt);
    if (rt >= LAPSE) lapsesRef.current++;
    setLastRT(rt); setPvtPhase('registered');
    setTimeout(() => startTrial(trialNum + 1), 1200);
  }, [pvtPhase, trialNum, startTrial]);

  if (pvtPhase === 'idle' && trialNum === 0) return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>PVT · {TRIALS} trial</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 18, lineHeight: 1.65 }}>
        Schermo vuoto. Appena il contatore parte,<br />
        toccalo il più velocemente possibile.<br />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>L'intervallo è casuale — non puoi anticipare.</span>
      </p>
      <button onClick={() => startTrial(1)} style={btnStyle(color, true)}>Inizia</button>
    </div>
  );

  const isLapse = lastRT !== null && lastRT >= LAPSE;

  return (
    <motion.div onClick={handleTap} style={{ textAlign: 'center', minHeight: 220, cursor: 'pointer', userSelect: 'none' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>
        Trial {Math.min(trialNum, TRIALS)}/{TRIALS} · {lapsesRef.current} lapse
      </p>
      <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {pvtPhase === 'wait' && (
            <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: 13, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.15em' }}>aspetta…</motion.div>
          )}
          {pvtPhase === 'counting' && (
            <motion.div key="count" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.05 }}
              style={{ fontSize: 72, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: counter > 350 ? '#ef4444' : '#fff' }}>
              {counter}
            </motion.div>
          )}
          {pvtPhase === 'registered' && lastRT !== null && (
            <motion.div key="reg" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div style={{ fontSize: 52, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: isLapse ? '#ef4444' : color }}>{lastRT}ms</div>
              {isLapse && <div style={{ fontSize: 10, color: '#ef4444', letterSpacing: '0.12em', marginTop: 4 }}>LAPSE</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {rts.current.length > 0 && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          {rts.current.slice(-10).map((t, i) => (
            <span key={i} style={{ fontSize: 9, borderRadius: 4, padding: '2px 6px', background: t >= LAPSE ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: t >= LAPSE ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>{t}</span>
          ))}
        </div>
      )}
      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)', marginTop: 14 }}>tocca ovunque</p>
    </motion.div>
  );
}

// ─── Corsi Backward Test ──────────────────────────────────────
interface CorsiBwdData { max_span: number; errors: number }

const CORSI_BWD_GRID: [number, number][] = [
  [0.15, 0.1], [0.5, 0.05], [0.85, 0.15],
  [0.1, 0.45], [0.45, 0.4], [0.8, 0.5],
  [0.2, 0.75], [0.55, 0.8], [0.88, 0.78],
];

function CorsiBwdTest({ color, onDone }: { color: string; onDone: (d: CorsiBwdData) => void }) {
  type CBState = 'start' | 'show' | 'recall' | 'correct' | 'wrong' | 'done';
  const [cbState, setCbState] = useState<CBState>('start');
  const [level, setLevel] = useState(3);
  const [seq, setSeq] = useState<number[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const [maxSpan, setMaxSpan] = useState(0);
  const [errors, setErrors] = useState(0);

  const runTrial = useCallback((lvl: number) => {
    const newSeq: number[] = [];
    for (let i = 0; i < lvl; i++) {
      let b: number;
      do { b = Math.floor(Math.random() * 9); } while (newSeq.length > 0 && b === newSeq[newSeq.length - 1]);
      newSeq.push(b);
    }
    setSeq(newSeq); setTapped([]); setHighlight(null); setCbState('show');
    let i = 0;
    const showNext = () => {
      if (i >= lvl) { setTimeout(() => { setHighlight(null); setCbState('recall'); }, 400); return; }
      setHighlight(newSeq[i]); i++;
      setTimeout(showNext, 750);
    };
    setTimeout(showNext, 500);
  }, []);

  const handleTap = (idx: number) => {
    if (cbState !== 'recall') return;
    const newTapped = [...tapped, idx];
    setTapped(newTapped);
    if (newTapped.length === seq.length) {
      const expected = [...seq].reverse();
      const correct = newTapped.every((v, i) => v === expected[i]);
      if (correct) {
        const newSpan = level; setMaxSpan(newSpan);
        if (level >= 7) { setCbState('done'); setTimeout(() => onDone({ max_span: newSpan, errors }), 600); return; }
        setCbState('correct');
        setTimeout(() => { const next = level + 1; setLevel(next); runTrial(next); }, 700);
      } else {
        const newErrors = errors + 1; setErrors(newErrors); setCbState('wrong');
        setTimeout(() => { setCbState('done'); onDone({ max_span: maxSpan, errors: newErrors }); }, 900);
      }
    }
  };

  const BOX = 272;
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Corsi Inverso · Livello {level}</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
        Memorizza la sequenza, poi toccala <strong style={{ color }}>al contrario</strong>
      </p>
      {cbState === 'start' && <button onClick={() => runTrial(3)} style={btnStyle(color)}>Inizia</button>}
      {cbState !== 'start' && (
        <div style={{ position: 'relative', width: BOX, height: BOX, margin: '0 auto 12px' }}>
          {CORSI_BWD_GRID.map((pos, idx) => {
            const isLit = highlight === idx;
            const tapIdx = tapped.indexOf(idx);
            return (
              <motion.div key={idx} onClick={() => handleTap(idx)}
                animate={{ background: isLit ? color + 'cc' : tapIdx >= 0 ? color + '44' : 'rgba(255,255,255,0.07)', scale: isLit ? 1.15 : 1 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', left: pos[0] * BOX - 22, top: pos[1] * BOX - 22,
                  width: 44, height: 44, borderRadius: 8,
                  border: `1.5px solid ${tapIdx >= 0 ? color + '60' : 'rgba(255,255,255,0.1)'}`,
                  cursor: cbState === 'recall' ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {tapIdx >= 0 && <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'Space Mono', monospace" }}>{tapIdx + 1}</span>}
              </motion.div>
            );
          })}
        </div>
      )}
      {(cbState === 'correct' || cbState === 'wrong') && (
        <div style={{ fontSize: 22, fontWeight: 700, color: cbState === 'correct' ? '#22c55e' : '#ef4444' }}>
          {cbState === 'correct' ? '✓' : '✗'}
        </div>
      )}
      {cbState === 'recall' && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>Tocca in ordine inverso · {tapped.length}/{seq.length}</p>
      )}
    </div>
  );
}

// ─── DSST Test ────────────────────────────────────────────────
interface DSSTData { correct: number; total: number; duration_s: number }

const DSST_LEGEND: Record<number, string> = { 1: '⊥', 2: '≈', 3: '△', 4: '∪', 5: '⊂', 6: '∩', 7: '⊃', 8: '⊕', 9: '⊗' };
const DSST_DURATION = 90;

function DSSTTest({ color, onDone }: { color: string; onDone: (d: DSSTData) => void }) {
  type DSSTPh = 'idle' | 'running' | 'done';
  const [dsstPhase, setDsstPhase] = useState<DSSTPh>('idle');
  const [timeLeft, setTimeLeft] = useState(DSST_DURATION);
  const [currentNum, setCurrentNum] = useState(0);
  const [options, setOptions] = useState<number[]>([]);
  const [fb, setFb] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const correctRef = useRef(0);
  const totalRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (fbTimer.current) clearTimeout(fbTimer.current);
  }, []);

  const newStimulus = useCallback(() => {
    const num = Math.floor(Math.random() * 9) + 1;
    const wrongs = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(k => k !== num).sort(() => Math.random() - 0.5).slice(0, 2);
    setCurrentNum(num); setOptions([num, ...wrongs].sort(() => Math.random() - 0.5)); setFb(null);
  }, []);

  const start = () => {
    correctRef.current = 0; totalRef.current = 0; doneRef.current = false;
    setScore(0); setTimeLeft(DSST_DURATION); setDsstPhase('running'); newStimulus();
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!doneRef.current) {
            doneRef.current = true; setDsstPhase('done');
            setTimeout(() => onDone({ correct: correctRef.current, total: totalRef.current, duration_s: DSST_DURATION }), 400);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAnswer = (num: number) => {
    if (dsstPhase !== 'running' || fb !== null) return;
    totalRef.current++;
    const correct = num === currentNum;
    if (correct) { correctRef.current++; setScore(correctRef.current); }
    setFb(correct ? 'correct' : 'wrong');
    fbTimer.current = setTimeout(() => { if (!doneRef.current) newStimulus(); }, 280);
  };

  if (dsstPhase === 'idle') return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>DSST · 90 secondi</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12, lineHeight: 1.65 }}>
        Memorizza la legenda, poi associa il numero al simbolo giusto.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 10px' }}>
        {Object.entries(DSST_LEGEND).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "'Space Mono', monospace" }}>{k}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>→</span>
            <span style={{ fontSize: 20 }}>{v}</span>
          </div>
        ))}
      </div>
      <button onClick={start} style={btnStyle(color, true)}>Inizia · 90 sec</button>
    </div>
  );

  if (dsstPhase === 'done') return (
    <div style={{ textAlign: 'center', paddingTop: 20 }}>
      <div style={{ fontSize: 52, fontWeight: 700, color, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>{score}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>simboli corretti in 90s</div>
    </div>
  );

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>DSST</span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: timeLeft < 15 ? '#ef4444' : 'rgba(255,255,255,0.6)' }}>{timeLeft}s</span>
        <span style={{ fontSize: 10, color, fontFamily: "'Space Mono', monospace" }}>{score} ✓</span>
      </div>
      <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginBottom: 12 }}>
        <div style={{ height: '100%', width: `${((DSST_DURATION - timeLeft) / DSST_DURATION) * 100}%`, background: timeLeft < 15 ? '#ef4444' : color, borderRadius: 2, transition: 'width 1s linear' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 2, marginBottom: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '5px 3px' }}>
        {Object.entries(DSST_LEGEND).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.45)', fontFamily: "'Space Mono', monospace" }}>{k}</span>
            <span style={{ fontSize: 13 }}>{v}</span>
          </div>
        ))}
      </div>
      <motion.div key={`n-${totalRef.current}`} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.08 }}
        style={{ fontSize: 72, fontWeight: 900, color: fb === 'correct' ? '#22c55e' : fb === 'wrong' ? '#ef4444' : '#fff', fontFamily: "'Space Mono', monospace", lineHeight: 1, marginBottom: 14 }}>
        {currentNum}
      </motion.div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {options.map(opt => (
          <motion.button key={opt} whileTap={{ scale: 0.93 }} onClick={() => handleAnswer(opt)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '16px 0', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 22 }}>{DSST_LEGEND[opt]}</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: "'Space Mono', monospace" }}>{opt}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Beads Task ───────────────────────────────────────────────
interface BeadsData { draws: number; answer: 'A' | 'B'; correct: boolean; sequence: string }

function BeadsTest({ color, onDone }: { color: string; onDone: (d: BeadsData) => void }) {
  type BPhase = 'idle' | 'drawing' | 'done';
  const [bPhase, setBPhase] = useState<BPhase>('idle');
  const [beads, setBeads] = useState<('blue' | 'red')[]>([]);
  const urnRef = useRef<'A' | 'B'>('A');
  const MAX_DRAWS = 10;

  const start = () => {
    urnRef.current = Math.random() < 0.5 ? 'A' : 'B';
    setBeads([]); setBPhase('drawing');
  };

  const drawBead = () => {
    if (beads.length >= MAX_DRAWS) return;
    const isBlue = urnRef.current === 'A' ? Math.random() < 0.8 : Math.random() < 0.2;
    setBeads(prev => [...prev, isBlue ? 'blue' : 'red']);
  };

  const decide = (answer: 'A' | 'B') => {
    const correct = answer === urnRef.current;
    const seq = beads.map(b => b === 'blue' ? 'B' : 'R').join('');
    onDone({ draws: beads.length, answer, correct, sequence: seq });
    setBPhase('done');
  };

  if (bPhase === 'idle') return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Beads Task</p>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 18, lineHeight: 1.85, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px', textAlign: 'left' }}>
        <div>Due urne nascoste:</div>
        <div style={{ marginTop: 6 }}><strong style={{ color: '#3b82f6' }}>Urna A</strong> → 80% 🔵 blu · 20% 🔴 rosse</div>
        <div><strong style={{ color: '#ef4444' }}>Urna B</strong> → 80% 🔴 rosse · 20% 🔵 blu</div>
        <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Puoi vedere fino a {MAX_DRAWS} perline prima di decidere.</div>
      </div>
      <button onClick={start} style={btnStyle(color, true)}>Inizia</button>
    </div>
  );

  const blueCount = beads.filter(b => b === 'blue').length;
  const redCount = beads.length - blueCount;

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
        Beads Task · {beads.length}/{MAX_DRAWS} estratte
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16, minHeight: 40 }}>
        {beads.map((b, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            style={{ width: 28, height: 28, borderRadius: '50%', background: b === 'blue' ? '#3b82f6cc' : '#ef4444cc', border: `2px solid ${b === 'blue' ? '#3b82f6' : '#ef4444'}` }} />
        ))}
        {beads.length === 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>nessuna perlina estratta</span>}
      </div>
      {beads.length > 0 && (
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: '#3b82f6', fontFamily: "'Space Mono', monospace" }}>🔵 {blueCount}</span>
          <span style={{ fontSize: 12, color: '#ef4444', fontFamily: "'Space Mono', monospace" }}>🔴 {redCount}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => decide('A')}
          style={{ ...btnStyle('#3b82f6'), padding: '14px 0', fontSize: 11, width: '100%', lineHeight: 1.6 }}>
          Urna A<br /><span style={{ fontSize: 9, opacity: 0.7 }}>80% blu</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => decide('B')}
          style={{ ...btnStyle('#ef4444'), padding: '14px 0', fontSize: 11, width: '100%', lineHeight: 1.6 }}>
          Urna B<br /><span style={{ fontSize: 9, opacity: 0.7 }}>80% rosse</span>
        </motion.button>
      </div>
      {beads.length < MAX_DRAWS ? (
        <motion.button whileTap={{ scale: 0.95 }} onClick={drawBead} style={btnStyle(color, true)}>
          Vedi un'altra perlina
        </motion.button>
      ) : (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Limite raggiunto — scegli un'urna</p>
      )}
    </div>
  );
}

// ─── Friend Leaderboard ───────────────────────────────────────
function FriendLeaderboard({
  testLabel, myScore, friends, color,
}: {
  testLabel: string;
  myScore: number;
  friends: { name: string; score: number }[];
  color: string;
}) {
  const rows = [{ name: 'Tu', score: myScore, isMe: true }, ...friends.map(f => ({ ...f, isMe: false }))]
    .sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...rows.map(r => r.score), 1);

  if (friends.length === 0) return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      style={{
        margin: '12px 0 4px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '12px 16px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>CLASSIFICA AMICI</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', lineHeight: 1.7 }}>
        Nessun amico ha ancora fatto questo test.<br />
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>Condividi Alter per confrontarti!</span>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      style={{
        margin: '12px 0 4px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
        CLASSIFICA · {testLabel.toUpperCase()}
      </div>
      {rows.map((r, i) => {
        const pct = Math.round((r.score / maxScore) * 100);
        const rankColor = i === 0 ? '#f0c040' : i === 1 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.28)';
        return (
          <div key={r.name + i} style={{ marginBottom: i < rows.length - 1 ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: rankColor, width: 16, flexShrink: 0 }}>
                {i + 1}
              </span>
              <span style={{
                fontSize: 12, fontWeight: r.isMe ? 600 : 400,
                color: r.isMe ? color : 'rgba(255,255,255,0.55)',
                flex: 1,
              }}>
                {r.name}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: r.isMe ? color : 'rgba(255,255,255,0.45)' }}>
                {r.score}
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginLeft: 24 }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: r.isMe ? color : 'rgba(255,255,255,0.2)',
                width: `${pct}%`, transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

// ─── Main Renderer ────────────────────────────────────────────
type Phase = 'hub' | 'dashboard' | 'detail' | 'rt' | 'wm' | 'pr' | 'tp' | 'dp' | 'gng' | 'tap' | 'dtap' | 'stroop' | 'vigilance' | 'sternberg' | 'ab' | 'corsi' | 'nback' | 'simon' | 'tasksw' | 'pvt' | 'corsi_bwd' | 'dsst' | 'beads' | 'result';

export default function CognitiveRenderer({ entries, color }: { entries: VaultEntry[]; color: string }) {
  const { user, upsertStar, triggerGlitch } = useAlterStore();
  const [phase, setPhase]           = useState<Phase>('hub');
  const [activeTest, setActiveTest] = useState<TestDef | null>(null);
  const [pendingResult, setPendingResult] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [tokenState, setTokenState] = useState<QuizTokenState | null>(null);
  const [friendScores, setFriendScores] = useState<{ name: string; score: number }[] | null>(null);

  // Local entries state so we can append after save without refetch
  const [localEntries, setLocalEntries] = useState<VaultEntry[]>(entries);
  useEffect(() => { setLocalEntries(entries); }, [entries]);

  // Load weekly token state on mount
  useEffect(() => {
    if (!user) return;
    loadTokenState(user.id).then(setTokenState);
  }, [user]);

  const goToTest = (test: TestDef) => {
    setActiveTest(test);
    setSaved(false);
    setPendingResult(null);
    setPhase('detail');
  };

  const startTest = async () => {
    if (!activeTest || !user) return;
    if (isTestLocked(tokenState, activeTest.id)) return;
    // Consume 1 token for this specific test when it starts
    if (tokenState) {
      const next = await consumeToken(user.id, tokenState, activeTest.id);
      setTokenState(next);
    }
    setPhase(activeTest.id as Phase);
  };

  const handleRTDone = (d: { avg_ms: number; best_ms: number; trials: number }) => {
    const s = rtScore(d.avg_ms);
    setPendingResult({ test_id: 'rt', score: s, avg_ms: d.avg_ms, best_ms: d.best_ms, trials: d.trials, renderType: 'quiz' });
    setPhase('result');
  };

  const handleWMDone = (d: { max_span: number; errors: number }) => {
    const s = wmScore(d.max_span);
    setPendingResult({ test_id: 'wm', score: s, max_span: d.max_span, errors: d.errors, renderType: 'quiz' });
    setPhase('result');
  };

  const handlePRDone = (d: { correct: number; total: number }) => {
    const s = prScore(d.correct, d.total);
    setPendingResult({ test_id: 'pr', score: s, correct: d.correct, total: d.total, renderType: 'quiz' });
    setPhase('result');
  };

  const handleTPDone = (d: { held_ms: number }) => {
    const s = tpScore(d.held_ms);
    setPendingResult({ test_id: 'tp', score: s, held_ms: d.held_ms, delta_ms: d.held_ms - 20000, renderType: 'quiz' });
    setPhase('result');
  };

  const handleDPDone = (d: DPData) => {
    const s = dpScore(d.bias_ms);
    setPendingResult({ test_id: 'dp', score: s, bias_ms: d.bias_ms, avg_rt: d.avg_rt, trials: d.trials, renderType: 'quiz' });
    setPhase('result');
  };

  const handleGNGDone = (d: GNGData) => {
    const s = gngScore(d.false_alarms, d.nogo_count);
    setPendingResult({ test_id: 'gng', score: s, false_alarms: d.false_alarms, misses: d.misses, hits: d.hits, avg_rt: d.avg_rt, nogo_count: d.nogo_count, go_count: d.go_count, renderType: 'quiz' });
    setPhase('result');
  };

  const handleTapDone = (d: TapData) => {
    const s = tapScore(d.taps_per_second);
    setPendingResult({ test_id: 'tap', score: s, total_taps: d.total_taps, taps_per_second: d.taps_per_second, renderType: 'quiz' });
    setPhase('result');
  };

  const handleDualTapDone = (d: DualTapData) => {
    const s = dualTapScore(d.taps_per_second, d.errors);
    setPendingResult({ test_id: 'dtap', score: s, total_alternations: d.total_alternations, taps_per_second: d.taps_per_second, errors: d.errors, renderType: 'quiz' });
    setPhase('result');
  };

  const handleStroopDone = (d: StroopData) => {
    const s = stroopScore(d.correct, d.total, d.avg_ms);
    setPendingResult({ test_id: 'stroop', score: s, correct: d.correct, total: d.total, avg_ms: d.avg_ms, renderType: 'quiz' });
    setPhase('result');
  };

  const handleVigilanceDone = (d: VigilanceData) => {
    const s = vigilanceScore(d.hits, d.false_alarms, d.total_targets);
    setPendingResult({ test_id: 'vigilance', score: s, hits: d.hits, false_alarms: d.false_alarms, misses: d.misses, total_targets: d.total_targets, renderType: 'quiz' });
    setPhase('result');
  };

  const handleSternbergDone = (d: SternbergData) => {
    const s = sternbergScore(d.correct, d.total, d.avg_ms);
    setPendingResult({ test_id: 'sternberg', score: s, correct: d.correct, total: d.total, avg_ms: d.avg_ms, renderType: 'quiz' });
    setPhase('result');
  };

  const handleCorsiDone = (d: CorsiData) => {
    const s = corsiScore(d.max_span);
    setPendingResult({ test_id: 'corsi', score: s, max_span: d.max_span, errors: d.errors, renderType: 'quiz' });
    setPhase('result');
  };

  const handleNBackDone = (d: NBackData) => {
    const s = nbackScore(d.correct, d.total);
    setPendingResult({ test_id: 'nback', score: s, correct: d.correct, total: d.total, hits: d.hits, false_alarms: d.false_alarms, renderType: 'quiz' });
    setPhase('result');
  };

  const handleABDone = (d: ABData) => {
    const s = abScore(d.t2_acc_critical, d.t2_acc_late);
    setPendingResult({
      test_id: 'ab', score: s,
      t1_accuracy: Math.round(d.t1_accuracy * 100),
      t2_acc_critical: Math.round(d.t2_acc_critical * 100),
      t2_acc_late: Math.round(d.t2_acc_late * 100),
      ab_effect: parseFloat(d.ab_effect.toFixed(2)),
      renderType: 'quiz',
    });
    setPhase('result');
  };

  const handleSimonDone = (d: SimonData) => {
    const s = simonScore(d.effect_ms, d.accuracy);
    setPendingResult({ test_id: 'simon', score: s, effect_ms: d.effect_ms, congruent_ms: d.congruent_ms, incongruent_ms: d.incongruent_ms, trials: d.trials, accuracy: parseFloat(d.accuracy.toFixed(2)), renderType: 'quiz' });
    setPhase('result');
  };

  const handleTaskSwDone = (d: TaskSwData) => {
    const s = taskswScore(d.switch_cost_ms, d.accuracy);
    setPendingResult({ test_id: 'tasksw', score: s, switch_cost_ms: d.switch_cost_ms, repeat_ms: d.repeat_ms, switch_ms: d.switch_ms, trials: d.trials, accuracy: parseFloat(d.accuracy.toFixed(2)), renderType: 'quiz' });
    setPhase('result');
  };

  const handlePVTDone = (d: PVTData) => {
    const s = pvtScore(d.median_ms, d.lapses);
    setPendingResult({ test_id: 'pvt', score: s, median_ms: d.median_ms, avg_ms: d.avg_ms, lapses: d.lapses, trials: d.trials, renderType: 'quiz' });
    setPhase('result');
  };

  const handleCorsiBwdDone = (d: CorsiBwdData) => {
    const s = corsiBwdScore(d.max_span);
    setPendingResult({ test_id: 'corsi_bwd', score: s, max_span: d.max_span, errors: d.errors, renderType: 'quiz' });
    setPhase('result');
  };

  const handleDSSTDone = (d: DSSTData) => {
    const s = dsstScore(d.correct);
    setPendingResult({ test_id: 'dsst', score: s, correct: d.correct, total: d.total, duration_s: d.duration_s, renderType: 'quiz' });
    setPhase('result');
  };

  const handleBeadsDone = (d: BeadsData) => {
    const s = beadsScore(d.draws, d.correct);
    setPendingResult({ test_id: 'beads', score: s, draws: d.draws, answer: d.answer, correct: d.correct, sequence: d.sequence, renderType: 'quiz' });
    setPhase('result');
  };

  const handleSave = async () => {
    if (!pendingResult || !user || !activeTest) return;
    setSaving(true);
    try {
      const saved_entry = await saveEntry(user.id, 'quiz', pendingResult);
      if (saved_entry) {
        setLocalEntries(prev => [...prev, saved_entry as VaultEntry]);
      }
      const existing = useAlterStore.getState().stars.find(s => s.id === 'quiz');
      const count    = (existing?.entryCount ?? 0) + 1;
      upsertStar({ ...buildStar('quiz', count, new Date().toISOString()), isNew: !existing });
      const score = pendingResult.score as number;
      setSaved(true);
      if (score < 50) triggerGlitch();
      // Publish best score to public profile + load friend leaderboard
      void mergeQuizScores(user.id, activeTest.id, score);
      getFriends(user.id).then(friends => {
        const key = `quiz_${activeTest.id}`;
        const rows = friends
          .map(f => ({
            name: f.profile?.display_name || f.profile?.username || 'Amico',
            score: (f.profile?.public_stats?.[key] as number | undefined) ?? -1,
          }))
          .filter(r => r.score >= 0);
        setFriendScores(rows);
      });
    } finally {
      setSaving(false);
    }
  };

  // Build a fake VaultEntry for ResultView display
  const resultEntry: VaultEntry | null = pendingResult ? ({
    id: '__pending__',
    user_id: user?.id ?? '',
    category: 'quiz',
    data: pendingResult,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }) : null;

  // ── Phase renders ────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      {phase === 'hub' && (
        <motion.div key="hub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <HubView entries={localEntries} color={color} onSelectTest={goToTest} tokenState={tokenState} onOpenDashboard={() => setPhase('dashboard')} />
        </motion.div>
      )}

      {phase === 'dashboard' && (
        <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DashboardView entries={localEntries} color={color} onBack={() => setPhase('hub')} />
        </motion.div>
      )}

      {phase === 'detail' && activeTest && (
        <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <TestDetailView
            test={activeTest}
            entries={localEntries}
            color={color}
            onStart={startTest}
            onBack={() => setPhase('hub')}
            tokenState={tokenState}
          />
        </motion.div>
      )}

      {phase === 'rt' && (
        <motion.div key="rt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <RTTest color={color} onDone={handleRTDone} />
        </motion.div>
      )}

      {phase === 'wm' && (
        <motion.div key="wm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <WMTest key="wm-fresh" color={color} onDone={handleWMDone} />
        </motion.div>
      )}

      {phase === 'pr' && (
        <motion.div key="pr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <PRTest key="pr-fresh" color={color} onDone={handlePRDone} />
        </motion.div>
      )}

      {phase === 'tp' && (
        <motion.div key="tp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <TPTest key="tp-fresh" color={color} onDone={handleTPDone} />
        </motion.div>
      )}

      {phase === 'gng' && (
        <motion.div key="gng" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <GNGTest key="gng-fresh" color={color} onDone={handleGNGDone} />
        </motion.div>
      )}

      {phase === 'dp' && (
        <motion.div key="dp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DPTest key="dp-fresh" color={color} onDone={handleDPDone} />
        </motion.div>
      )}

      {phase === 'tap' && (
        <motion.div key="tap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <TapTest key="tap-fresh" color={color} onDone={handleTapDone} />
        </motion.div>
      )}

      {phase === 'dtap' && (
        <motion.div key="dtap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DualTapTest key="dtap-fresh" color={color} onDone={handleDualTapDone} />
        </motion.div>
      )}

      {phase === 'stroop' && (
        <motion.div key="stroop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <StroopTest key="stroop-fresh" color={color} onDone={handleStroopDone} />
        </motion.div>
      )}

      {phase === 'vigilance' && (
        <motion.div key="vigilance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <VigilanceTest key="vigilance-fresh" color={color} onDone={handleVigilanceDone} />
        </motion.div>
      )}

      {phase === 'sternberg' && (
        <motion.div key="sternberg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <SternbergTest key="sternberg-fresh" color={color} onDone={handleSternbergDone} />
        </motion.div>
      )}

      {phase === 'ab' && (
        <motion.div key="ab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ABTest key="ab-fresh" color={color} onDone={handleABDone} />
        </motion.div>
      )}

      {phase === 'corsi' && (
        <motion.div key="corsi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <CorsiTest key="corsi-fresh" color={color} onDone={handleCorsiDone} />
        </motion.div>
      )}

      {phase === 'nback' && (
        <motion.div key="nback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <NBackTest key="nback-fresh" color={color} onDone={handleNBackDone} />
        </motion.div>
      )}

      {phase === 'simon' && (
        <motion.div key="simon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <SimonTest key="simon-fresh" color={color} onDone={handleSimonDone} />
        </motion.div>
      )}

      {phase === 'tasksw' && (
        <motion.div key="tasksw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <TaskSwTest key="tasksw-fresh" color={color} onDone={handleTaskSwDone} />
        </motion.div>
      )}

      {phase === 'pvt' && (
        <motion.div key="pvt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <PVTTest key="pvt-fresh" color={color} onDone={handlePVTDone} />
        </motion.div>
      )}

      {phase === 'corsi_bwd' && (
        <motion.div key="corsi_bwd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <CorsiBwdTest key="corsi-bwd-fresh" color={color} onDone={handleCorsiBwdDone} />
        </motion.div>
      )}

      {phase === 'dsst' && (
        <motion.div key="dsst" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DSSTTest key="dsst-fresh" color={color} onDone={handleDSSTDone} />
        </motion.div>
      )}

      {phase === 'beads' && (
        <motion.div key="beads" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <BeadsTest key="beads-fresh" color={color} onDone={handleBeadsDone} />
        </motion.div>
      )}

      {phase === 'result' && activeTest && resultEntry && (
        <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ResultView
            test={activeTest}
            result={resultEntry}
            color={color}
            onSave={handleSave}
            onBack={() => { setPhase('detail'); setSaved(false); setFriendScores(null); }}
            saved={saved}
            saving={saving}
          />
          {saved && friendScores !== null && (
            <FriendLeaderboard
              testLabel={activeTest.label}
              myScore={pendingResult!.score as number}
              friends={friendScores}
              color={color}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
