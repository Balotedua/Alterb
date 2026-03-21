// Backfill embeddings per righe con embedding NULL
// Uso: node scripts/backfill-embeddings.mjs
// Richiede: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nel file client/.env

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Legge .env dal client
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '../client/.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes('placeholder')) {
  console.error('❌  Variabili Supabase non trovate in client/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── generateVec (replica di semanticVec.ts) ─────────────────
const SEMANTIC = [
  [0,  ['finanz','soldi','euro','spesa','entrat','stipend','costo','prezi','budget','afford','finance','money','expense','income','salary','cost','price','invest','risparm']],
  [4,  ['salut','peso','kg','bmi','sonno','acqua','palest','corsa','sport','fitness','calori','dieta','health','weight','sleep','water','gym','run','workout','train','step','attivit']],
  [8,  ['psich','umore','emozion','stress','ansia','sogno','medit','mental','mood','emotion','anxiety','dream','feel','benessere','terapi','sentin','psicolog','pensier']],
  [12, ['calendar','evento','appuntament','orari','remind','meeting','schedule','date','time','event','scadenz','promed','riunion']],
  [16, ['cibo','mangi','pasto','pizza','colazi','pranzo','cena','nutriz','ricetta','food','eat','meal','nutrition','recipe','breakfast','lunch','dinner','calorie','dieta','cuci']],
  [20, ['social','amici','famil','person','relaz','lavoro','uffici','colleg','friend','work','team','people','relation','office','partner','fidanz','genit']],
];

function generateVec(category, data) {
  const text = (category + ' ' + JSON.stringify(data)).toLowerCase();
  const vec = new Array(32).fill(0);

  for (const [base, keywords] of SEMANTIC) {
    let score = 0;
    for (const kw of keywords) if (text.includes(kw)) score++;
    if (score > 0) {
      const s = Math.min(score, 4) / 4;
      vec[base]     += s;
      vec[base + 1] += s * 0.65;
      vec[base + 2] += s * 0.35;
      vec[base + 3] += s * 0.15;
    }
  }

  // Category hash fingerprint (dims 24-31)
  let h = 5381;
  for (const c of category) h = ((h << 5) + h) ^ c.charCodeAt(0);
  for (let i = 0; i < 8; i++) vec[24 + i] = ((h >> (i * 3)) & 0x7) / 7 * 0.35;

  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

// ─── Main ─────────────────────────────────────────────────────
const BATCH = 100;
let offset = 0;
let total = 0;

console.log('🔍  Cerco righe con embedding NULL...');

while (true) {
  const { data: rows, error } = await supabase
    .from('vault')
    .select('id, category, data')
    .is('embedding', null)
    .range(offset, offset + BATCH - 1);

  if (error) { console.error('❌  Read error:', error.message); break; }
  if (!rows || rows.length === 0) break;

  for (const row of rows) {
    const vec = generateVec(row.category, row.data ?? {});
    const embedding = `[${vec.join(',')}]`;

    const { error: upErr } = await supabase
      .from('vault')
      .update({ embedding })
      .eq('id', row.id);

    if (upErr) {
      console.error(`❌  Update ${row.id}:`, upErr.message);
    } else {
      total++;
      process.stdout.write(`\r✅  Aggiornate: ${total}`);
    }
  }

  if (rows.length < BATCH) break;
  offset += BATCH;
}

console.log(`\n🎉  Backfill completato. Righe aggiornate: ${total}`);
