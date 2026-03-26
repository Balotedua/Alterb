# Alter OS — Claude Instructions

## Stack
React 18 + Vite + TS · Supabase · Zustand · Framer Motion · Recharts
`cd client && npm run dev`
Env: `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `VITE_GEMINI_API_KEY`

---

## 3 Pilastri INVALICABILI

| Pilastro | Regola |
|---|---|
| **DATA VAULT** | Una sola tabella `vault(id, user_id, category, data JSONB)`. Mai creare tabelle specifiche. |
| **ORCHESTRATOR** | L1 `localParser.ts` (regex, zero costo) → L2 `aiParser.ts` (DeepSeek, solo analisi/nuove categorie) |
| **POLYMORPHIC UI** | No pagine fisse. Ogni visualizzazione = nuovo `RenderType` + file in `renderers/`. `PolymorphicWidget.tsx` è solo lo switch. |

---

## File Chiave

```
src/
├── types/index.ts                          # VaultEntry, Star, WidgetData, ParsedIntent
├── config/supabase.ts
├── core/
│   ├── localParser.ts                      # L1 — regex italiani, zero API
│   ├── aiParser.ts                         # L2 — DeepSeek
│   ├── orchestrator.ts                     # router L1→L2, help/delete/analyse
│   ├── insightEngine.ts                    # analisi dati vault
│   └── dataAnalyser.ts
├── vault/vaultService.ts                   # CRUD Supabase
├── store/alterStore.ts                     # Zustand global state
├── import/                                 # bankCsvImport, documentOcr, healthImport
├── social/nexusService.ts
└── components/
    ├── starfield/StarfieldView.tsx         # Canvas 2D · stelle per categoria · supernova
    ├── nebula/NebulaChatInput.tsx          # ghost input · placeholder rotanti · voice
    ├── widget/PolymorphicWidget.tsx        # smistatore centrale (119 righe) — NON aggiungere logica qui
    │   └── renderers/                      # sub-renderer per RenderType
    │       ├── shared.tsx                  # PIE_PALETTE, Stat, EntryRow, TabBar, SurgicalInsight
    │       ├── FinanceRenderer.tsx         # dashboard finance (6 tab: transazioni, cashflow, budget…)
    │       ├── WorkoutRenderer.tsx         # silhouette corpo, PR, calendario allenamenti
    │       ├── HealthRenderer.tsx          # HealthChart, NumericChart
    │       ├── MoodRenderer.tsx            # MoodChart, DiaryList
    │       ├── TimelineRenderer.tsx        # agenda / eventi calendario
    │       ├── InsightRenderer.tsx         # NebulaInsight, NexusView (correlazioni)
    │       └── DocRenderer.tsx             # DocDownloadList, GenericList, PieRenderer
    ├── chat/ChatView.tsx
    ├── dashboard/DashboardView.tsx
    ├── social/NexusView.tsx
    └── layout/TabBar.tsx
```

---

## Regole di Sviluppo

1. **Diffs only** — mai riscrivere file interi, usa `// ... existing code`
2. **L1 prima di L2** — nuovi pattern → `localParser.ts` prima di toccare AI
3. **No hardcoded hex** — usa variabili da `styles/themes.ts`
4. **Briefing max 3 frasi** — no intro, no apologie, no "here is the code"
5. **Fragment focus** — modifica solo il frammento richiesto
6. **Renderer separation** — nuova UI specifica → nuovo file in `renderers/`, mai inline in `PolymorphicWidget.tsx`. Il parser (L1/L2) scrive `renderType` nel JSONB, il widget lo legge senza inferire.

---

## UI/UX — Premium Minimal Futuristic

**Principi visivi:**
- Dark background · Glassmorphism con `border-opacity: 0.05–0.1`
- Spazio bianco abbondante · Gerarchia tipografica netta
- Transizioni `0.2s ease` · Hover `scale(1.02)` · No animazioni gratuite

**UX flow:**
- Input → stelle nascono automaticamente nel canvas
- `?` → focus mode (labels su tutte le stelle)
- Stelle grigie = feature dormiente · Stelle luminose = categoria attiva
- Feedback visivo immediato su ogni azione (supernova, pulse, glow)
- Errori silenziosi: mai modal bloccanti, preferire toast/inline

**Accessibilità minima:**
- Contrasto testo ≥ 4.5:1
- Touch target ≥ 44px
- Keyboard navigabile per input principali
