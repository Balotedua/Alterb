---
type: agent-structure
---

# Mappa File — Alter OS (`client/src/`)

## Tipi e Config
```
types/index.ts              # VaultEntry, Star, WidgetData, ParsedIntent
config/supabase.ts
styles/themes.ts            # variabili colore — NO hardcoded hex
```

## Core (logica)
```
core/
├── localParser.ts          # L1 — regex italiani, zero API
├── aiParser.ts             # L2 — DeepSeek, solo analisi/nuove categorie
├── orchestrator.ts         # router L1→L2, help/delete/analyse
├── insightEngine.ts        # analisi dati vault
├── dataAnalyser.ts
└── l3Validator.ts          # (nuovo) validazione L3
```

## Vault
```
vault/vaultService.ts       # CRUD Supabase — unica interfaccia al DB
```

## Store
```
store/alterStore.ts         # Zustand — stato globale
```

## Import / Social
```
import/                     # bankCsvImport, documentOcr, healthImport
social/nexusService.ts
```

## Componenti
```
components/
├── starfield/StarfieldView.tsx         # Canvas 2D · stelle · supernova
├── nebula/NebulaChatInput.tsx          # ghost input · placeholder rotanti · voice
├── chat/ChatView.tsx
├── panels/BugReportPanel.tsx
├── settings/SettingsPanel.tsx
├── dashboard/DashboardView.tsx
├── social/NexusView.tsx
├── layout/TabBar.tsx
└── widget/
    ├── PolymorphicWidget.tsx           # SOLO switch su renderType — non aggiungere logica
    └── renderers/
        ├── shared.tsx                  # PIE_PALETTE, Stat, EntryRow, TabBar, SurgicalInsight
        ├── FinanceRenderer.tsx         # 6 tab: transazioni, cashflow, budget…
        ├── WorkoutRenderer.tsx         # silhouette corpo, PR, calendario
        ├── HealthRenderer.tsx          # HealthChart, NumericChart
        ├── MoodRenderer.tsx            # MoodChart, DiaryList
        ├── TimelineRenderer.tsx        # agenda / eventi calendario
        ├── InsightRenderer.tsx         # NebulaInsight, NexusView
        ├── DocRenderer.tsx             # DocDownloadList, GenericList, PieRenderer
        └── CodexRenderer.tsx           # (nuovo)
```

## App Entry
```
App.tsx
```
