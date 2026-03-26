---
type: agent-context
---

# Contesto Progetto — Alter OS

## Stack
React 18 + Vite + TypeScript · Supabase (auth + DB) · Zustand · Framer Motion · Recharts
`cd client && npm run dev`

## Env vars
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DEEPSEEK_API_KEY`

## Architettura Dati
**Un'unica tabella:** `vault(id, user_id, category, data JSONB)`
Mai aggiungere tabelle specifiche per categoria. Tutto finisce nel JSONB.

## Pipeline AI
```
Input utente
  → L1 localParser.ts   (regex italiani, zero costo, zero latenza)
  → L2 aiParser.ts      (DeepSeek, solo se L1 fallisce o serve analisi)
  → orchestrator.ts     (router, gestisce help/delete/analyse)
```

## UI Pattern
- Ogni nuova visualizzazione = nuovo `RenderType` + renderer in `renderers/`
- Il parser scrive `renderType` nel JSONB → `PolymorphicWidget` lo legge e smista
- Nessuna inferenza del tipo in `PolymorphicWidget.tsx`
- Canvas 2D (`StarfieldView`) — stelle per categoria, supernova su salvataggio

## Design System
- Dark background con glassmorphism (`border-opacity: 0.05–0.1`)
