# Alter OS — Stato Attuale (v1.4)

## Cosa fa l'app

Un sistema personale di gestione dati dove ogni informazione diventa una **stella** in un campo visivo interattivo. L'utente scrive (o parla) in italiano, il sistema capisce, salva, e visualizza.

---

## Flusso principale

```
Input testuale/vocale
  ↓
Orchestrator (orchestrator.ts)
  ├── comando "help"     → mostra suggerimenti
  ├── comando "analizza" → insight dell'intera galassia (DeepSeek)
  ├── comando "nexus"    → correlazione tra due categorie
  ├── domanda/query      → risposta AI + widget dati
  ├── cancella [cat]     → elimina categoria
  └── salvataggio:
       ├── L1: localParser.ts  (regex, gratis, ~80% dei casi)
       └── L2: aiParser.ts     (DeepSeek, solo se L1 fallisce)
            ↓
         vault (Supabase) → aggiorna stelle → widget
```

---

## Parser L1 — cosa riconosce (regex, zero costo API)

| Categoria | Esempi input |
|-----------|-------------|
| **finance** (entrate/uscite) | `"15 pizza"`, `"guadagnato 1000"`, `"pagato 50 affitto"` |
| **health/weight** | `"peso 85kg"`, `"85 chili"` |
| **health/sleep** | `"dormito 7 ore"`, `"6 ore di sonno"` |
| **health/water** | `"bevuto 1.5 litri"`, `"2 bicchieri acqua"` |
| **health/sport** | `"corso 5km"`, `"palestra"`, `"10000 passi"` |
| **mood** | `"umore 8"`, `"mi sento felice"`, `"stressato oggi"` |
| **calendar** | `"riunione lunedì ore 15"`, `"appuntamento domani alle 9"` |
| **custom** | categorie già apprese dall'utente |

Se L1 non riconosce → passa a DeepSeek (L2) per estrarre categoria e dati.

---

## Architettura dati

**Una sola tabella Supabase:**
```
vault (id, user_id, category, data JSONB, created_at, updated_at)
```

Nessuna tabella separata per finance, health, ecc. Tutto nel JSONB.
Il vettore semantico (32 dimensioni) è salvato nel campo `data._embedding`.

---

## UI — 3 componenti principali

### 1. StarfieldView (canvas 2D)
- Sfondo `#050508` con 3 layer di particelle parallax
- Ogni **categoria** = una stella colorata (colore deterministico)
- Intensità stella = recency (60%) + count (40%)
- **Supernova**: flash animato su nuova aggiunta
- **Costellazioni**: linee tra stelle vicine quando sei idle
- **Beam semantici**: connessioni tra categorie correlate (cosine similarity > 0.55)
- **Nexus beam**: animazione durante analisi correlazione
- Camera: pan (drag), zoom (scroll), inerzia, touch

### 2. NebulaChatInput (orb centrale)
- Orb animato al centro: idle → processing → risposta
- Click o tasto → espande input
- **Voce** via Web Speech API (lingua: it-IT)
- Placeholder rotanti ogni 3.2s
- Dopo 10s idle con ≥2 stelle → suggerisce analisi nexus

### 3. PolymorphicWidget (pannello floating)
Aperto cliccando una stella. Adatta la visualizzazione al tipo di dato:

| Tipo render | Dati | Visualizzazione |
|-------------|------|-----------------|
| `stats` | finance | Area chart + min/max/net + proiezione mese |
| `chart` | health | Line chart peso/sonno/acqua + media 3 voci |
| `mood` | mood | Bar chart 0-10 + lista voci recenti |
| `diary` | testi | Lista cronologica testo |
| `timeline` | calendar | Lista eventi passati/futuri |
| `insight` | discoveries | Pattern autonomi trovati dall'AI |
| `nexus` | correlazione | Dual-axis chart + forza correlazione |
| `list` | fallback | Righe chiave-valore |

Ogni riga ha pulsante di eliminazione. Widget è scrollabile.

---

## Insight Engine (automatico)

- Si attiva ogni 24h (in background) se: ≥20 voci totali, ≥2 categorie con ≥5 voci
- Usa DeepSeek per trovare pattern (es. "la spesa sale quando dormi poco")
- I risultati appaiono come stella speciale "insights" con anello dorato pulsante
- `quickConnect`: dopo ogni salvataggio, cerca in 2s la categoria correlata e disegna un beam

---

## Funzionalità di query

L'utente può fare domande:
- `"quanto ho speso questa settimana"` → risposta AI + widget finance filtrato
- `"come va il sonno"` → analisi health/sleep
- L'orchestrator riconosce query dalla presenza di parole interrogative

---

## Limitazioni attuali

- **Parser date** solo in italiano (nomi giorni hardcoded)
- **Nessun rilevamento duplicati** (stessa spesa → salvata due volte)
- **Nessun export dati**
- **No offline** — se Supabase non risponde, l'input fallisce
- **Sentiment inference assente** — "mi sento bene" non genera score numerico automatico, bisogna specificarlo
- **Correlazione Nexus** su dati sparsi può dare risultati non affidabili
- Vettori semantici keyword-based (non neural), clustering approssimativo

---

## Stack tecnico

| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Animazioni | Framer Motion + Canvas 2D nativo |
| State | Zustand |
| Charts | Recharts |
| Backend/DB | Supabase (auth + postgres + realtime) |
| AI L2 | DeepSeek API |
| Auth | Supabase Auth (email/password) |

---

## File chiave

```
src/
├── types/index.ts              # tipi: VaultEntry, Star, ParsedIntent...
├── core/
│   ├── localParser.ts          # L1 regex parser
│   ├── aiParser.ts             # L2 DeepSeek + chat/query/analyse
│   ├── orchestrator.ts         # router principale
│   ├── insightEngine.ts        # discovery automatica + quickConnect
│   └── semanticVec.ts          # vettori 32-dim + cosine similarity
├── vault/vaultService.ts       # CRUD Supabase
├── store/alterStore.ts         # stato globale Zustand
└── components/
    ├── auth/LoginScreen.tsx
    ├── starfield/StarfieldView.tsx
    ├── nebula/NebulaChatInput.tsx
    └── widget/PolymorphicWidget.tsx
```
