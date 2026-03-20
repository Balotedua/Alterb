# ⚡ Alter OS — Surgical Context

## 🛠 Quick Ops
- **Dev**: `cd client && npm install && npm run dev`
- **Build**: `cd client && npm run build`
- **Stack**: React 18 + Vite + TS | Supabase | Zustand | Framer Motion | Recharts

## 🏗 Architettura (3 pilastri INVALICABILI)

### 1. DATA VAULT
- **Una sola tabella Supabase**: `vault` con colonne `(id, user_id, category, data JSONB, timestamps)`
- **Non creare mai tabelle specifiche** per Finance, Health, ecc.
- Schema in `sql/vault_schema.sql`

### 2. NEBULA ORCHESTRATOR (`src/core/`)
- `localParser.ts` → L1: Regex, **zero API cost**, riconosce pattern `"10 pizza"`, `"peso 85kg"`, ecc.
- `aiParser.ts` → L2: DeepSeek, usato SOLO per nuove categorie o comandi complessi
- `orchestrator.ts` → router tra L1/L2, gestisce anche `help`, `delete`, `analyse`

### 3. POLYMORPHIC UI (`src/components/`)
- **No pagine fisse**. Il renderer legge il JSONB e decide: chart / list / diary / mood / stats
- `StarfieldView.tsx` → Canvas 2D, stelle colorate per categoria, supernova animation
- `NebulaChatInput.tsx` → input centralizzato, placeholder rotanti, voce (Web Speech API)
- `PolymorphicWidget.tsx` → widget floating che si adatta al tipo di dato

## 📁 Struttura src/
```
src/
├── types/index.ts          # VaultEntry, Star, WidgetData, ParsedIntent...
├── config/supabase.ts      # createClient
├── core/
│   ├── localParser.ts      # L1 regex parser
│   ├── aiParser.ts         # L2 DeepSeek
│   └── orchestrator.ts     # router
├── vault/vaultService.ts   # CRUD Supabase
├── store/alterStore.ts     # Zustand: user, stars, widget, messages
└── components/
    ├── auth/LoginScreen.tsx
    ├── starfield/StarfieldView.tsx  # Canvas + supernova + focus mode
    ├── nebula/NebulaChatInput.tsx   # ghost input + voice
    └── widget/PolymorphicWidget.tsx # polymorphic renderer
```

## 🎨 UI/UX (DNA del progetto)
- **Background**: `#050508` (spazio profondo)
- **Glass**: `rgba(10,10,18,0.9)` + `border rgba(255,255,255,0.07)`
- **Accenti**: gold `#f0c040`, teal `#40e0d0`, violet `#a78bfa`
- **Stelle**: colori deterministici per categoria, glow proporzionale all'intensità
- **Zero bottoni inutili**: tutto via input testuale/vocale

## 🔑 Env vars (.env in /client)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_DEEPSEEK_API_KEY=...   (opzionale - fallback al solo parser locale)
```

## 📏 Regole Claude
1. **Diffs only** — mai riscrivere file interi
2. **No tabelle specifiche** — tutto va nel vault JSONB
3. **No pagine fisse** — estendi PolymorphicWidget o aggiungi RenderType
4. **L1 prima di L2** — quando aggiungi pattern, aggiorna localParser.ts
5. Briefing max 3 frasi
