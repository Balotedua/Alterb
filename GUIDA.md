# Alter — Guida allo Sviluppo

> Come funziona il progetto, come si scala e come aggiungere nuovi componenti.

---

## Indice

1. [Architettura a strati](#architettura-a-strati)
2. [Flusso dei dati](#flusso-dei-dati)
3. [Aggiungere una nuova pagina / sezione](#aggiungere-una-nuova-pagina--sezione)
4. [Aggiungere una card a una sezione esistente](#aggiungere-una-card-a-una-sezione-esistente)
5. [Aggiungere un Fragment Nebula (AI overlay)](#aggiungere-un-fragment-nebula-ai-overlay)
6. [Aggiungere un hook dati (Supabase)](#aggiungere-un-hook-dati-supabase)
7. [Temi e stili](#temi-e-stili)
8. [Variabili d'ambiente](#variabili-dambiente)
9. [Mappa file rapida](#mappa-file-rapida)

---

## Architettura a strati

```
┌──────────────────────────────────────────────────┐
│  PAGES  (client/src/pages/)                      │
│  Orchestrano la pagina, compongono componenti    │
├──────────────────────────────────────────────────┤
│  COMPONENTS  (client/src/components/)            │
│  Blocchi UI riutilizzabili (card, form, grafici) │
├──────────────────────────────────────────────────┤
│  HOOKS  (client/src/hooks/)                      │
│  Tutto il fetch/mutate dati via TanStack Query   │
├──────────────────────────────────────────────────┤
│  SERVICES  (client/src/services/)                │
│  Supabase client + DeepSeek API + apiGet/Post    │
├──────────────────────────────────────────────────┤
│  TYPES / UTILS  (src/types/, src/utils/)         │
│  Interfacce TS, costanti, formatter, badge utils │
└──────────────────────────────────────────────────┘
```

**Regola fondamentale:** ogni livello parla solo con quello immediatamente sotto.
Le pagine NON chiamano Supabase direttamente — usano sempre un hook.

---

## Flusso dei dati

```
Utente interagisce con un componente
  → il componente chiama un hook (useFinance, useHealth, …)
  → l'hook usa TanStack Query (useQuery / useMutation)
  → TanStack chiama Supabase (o apiGet/apiPost per REST custom)
  → Supabase risponde → cache aggiornata → componente re-renderizzato

Dopo una mutation (add / delete):
  → queryClient.invalidateQueries([chiave]) → refetch automatico
```

**Cache:** staleTime 2 min, retry 1. Se un dato non cambia spesso aumenta staleTime.

---

## Aggiungere una nuova pagina / sezione

Esempio: aggiungere la sezione **Mindfulness**.

### 1. Crea il file pagina

```tsx
// client/src/pages/Mindfulness.tsx
export default function Mindfulness() {
  return (
    <div className="page-container">
      <h1>Mindfulness</h1>
      {/* Qui vanno i componenti */}
    </div>
  );
}
```

### 2. Registra la route in App.tsx

```tsx
// client/src/App.tsx
const Mindfulness = React.lazy(() => import('@/pages/Mindfulness'));

// dentro il JSX, nella sezione rotte protette:
<Route path="/mindfulness" element={<Mindfulness />} />
```

### 3. Aggiungi la voce nella sidebar

```tsx
// client/src/components/layout/Sidebar.tsx
// Trova l'array NAV_ITEMS e aggiungi:
{ path: '/mindfulness', label: 'Mindfulness', icon: <Leaf size={18} /> },
```

Importa l'icona da `lucide-react`.

### 4. (Opzionale) CSS dedicato

```css
/* client/src/pages/Mindfulness.css */
/* Importalo dentro Mindfulness.tsx: */
/* import './Mindfulness.css'; */
```

---

## Aggiungere una card a una sezione esistente

Le "card" sono componenti in `client/src/components/<sezione>/`.

### Struttura tipo di un componente card

```tsx
// client/src/components/mindfulness/MeditationLog.tsx
import { Card, CardHeader } from '@/components/ui/Card';
import { useMeditations } from '@/hooks/useMindfulness';  // hook da creare

export function MeditationLog() {
  const { data, isLoading } = useMeditations();

  if (isLoading) return <Card><p>Caricamento…</p></Card>;

  return (
    <Card>
      <CardHeader title="Log Meditazioni" />
      <ul>
        {data?.map((entry) => (
          <li key={entry.id}>{entry.duration_min} min — {entry.date}</li>
        ))}
      </ul>
    </Card>
  );
}
```

### Usarlo nella pagina

```tsx
// client/src/pages/Mindfulness.tsx
import { MeditationLog } from '@/components/mindfulness/MeditationLog';

export default function Mindfulness() {
  return (
    <div className="page-container">
      <MeditationLog />
    </div>
  );
}
```

### Componenti UI atomici disponibili

| Componente | Import | Uso |
|---|---|---|
| `Card` + `CardHeader` | `@/components/ui/Card` | Container generico |
| `Button` | `@/components/ui/Button` | Pulsante stilizzato |
| `Input` | `@/components/ui/Input` | Campo testo |
| `Modal` | `@/components/ui/Modal` | Dialog overlay |

---

## Aggiungere un Fragment Nebula (AI overlay)

I **Fragment** sono card glassmorphic che Nebula mostra sopra la sfera quando l'utente chiede dati.

### Come funziona il sistema

```
Utente scrive nella chat Nebula
  → useIntent() invia a DeepSeek con NEBULA_SYSTEM_PROMPT
  → DeepSeek risponde JSON: { fragment: "MindfulnessOverview", params: {} }
  → nebulaStore aggiorna activeFragment
  → FRAGMENT_REGISTRY[fragment] renderizza il componente
```

### 1. Crea il modulo fragment

```tsx
// client/src/modules/mindfulness/MindfulnessOverviewFragment.tsx
import { NebulaCard, NebulaStat } from '@/components/ui/nebula';

interface Props {
  params: Record<string, unknown>;
}

export function MindfulnessOverviewFragment({ params: _ }: Props) {
  // usa hook normali per i dati
  return (
    <NebulaCard icon="🧘" title="Mindfulness · oggi">
      <div className="fragment-kpis">
        <NebulaStat label="Sessioni" value="3"  color="purple" />
        <NebulaStat label="Minuti"   value="45" color="blue"   />
      </div>
    </NebulaCard>
  );
}
```

```ts
// client/src/modules/mindfulness/index.ts
export { MindfulnessOverviewFragment } from './MindfulnessOverviewFragment';
```

### 2. Registra nel registry

```tsx
// client/src/modules/fragmentRegistry.tsx
import { MindfulnessOverviewFragment } from './mindfulness';

export const FRAGMENT_REGISTRY = {
  // ...frammenti esistenti...
  MindfulnessOverview: MindfulnessOverviewFragment,
};
```

### 3. Aggiorna il system prompt di Nebula

```ts
// client/src/prompts/nebula.ts
// Aggiungi alla sezione FRAGMENT:
// Per MINDFULNESS:
//   - "MindfulnessOverview" → sessioni + minuti oggi (default)
```

Da questo momento Nebula saprà usare il fragment quando l'utente chiede di meditazione.

### Componenti Nebula UI disponibili

| Componente | Props chiave | Uso |
|---|---|---|
| `NebulaCard` | `icon`, `title`, `className` | Container card glassmorphic |
| `NebulaStat` | `label`, `value`, `color`, `sub` | KPI singola (verde/rosso/blu/viola/neutro) |
| `NebulaGraph` | `data`, `color` | Sparkline minimale |

**CSS classi helper nei fragment:**

```css
.fragment-kpis    /* griglia KPI orizzontale */
.fragment-list    /* lista righe */
.fragment-list-row /* singola riga desc + valore */
.fragment-empty   /* messaggio stato vuoto */
.fkv--green / .fkv--red / .fkv--blue / .fkv--purple  /* colori valore */
```

---

## Aggiungere un hook dati (Supabase)

### Schema minimo

```ts
// client/src/hooks/useMindfulness.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

const QUERY_KEY = 'meditations';

export function useMeditations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meditations')
        .select('*')
        .eq('user_id', user!.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAddMeditation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { duration_min: number; date: string }) => {
      const { error } = await supabase
        .from('meditations')
        .insert({ ...payload, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
```

**Pattern invariante:** ogni mutation chiama `invalidateQueries` sulla chiave della lista → refetch automatico.

---

## Temi e stili

4 temi disponibili: `minimal` | `neon` | `carbon` | `aurora`

Ogni tema espone variabili CSS globali:

```css
var(--bg)        /* sfondo principale */
var(--surface)   /* sfondo card */
var(--accent)    /* colore primario */
var(--text)      /* testo principale */
var(--muted)     /* testo secondario */
var(--border)    /* colore bordi */
var(--radius)    /* border-radius base */
```

Usa sempre queste variabili nei CSS dei nuovi componenti, mai colori hardcoded.

Per cambiare tema: `useTheme().setTheme('neon')` — persiste in localStorage.

---

## Variabili d'ambiente

File `.env` nella cartella `client/`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_DEEPSEEK_API_KEY=...
VITE_API_BASE_URL=/api          # opzionale
```

Validate a runtime da `client/src/config/env.ts` (Zod) — il build fallisce se mancano le obbligatorie.

---

## Mappa file rapida

| Devo… | File da modificare |
|---|---|
| Aggiungere una pagina | `pages/NuovaPagina.tsx` + `App.tsx` + `Sidebar.tsx` |
| Aggiungere una card in Finance | `components/finance/NuovaCard.tsx` + `pages/Finance.tsx` |
| Aggiungere dati da Supabase | `hooks/useNuovoHook.ts` |
| Aggiungere fragment Nebula AI | `modules/nuova/` + `fragmentRegistry.tsx` + `prompts/nebula.ts` |
| Cambiare i temi | `styles/themes.ts` |
| Aggiungere un tipo TS | `types/index.ts` |
| Aggiungere una costante globale | `utils/constants.ts` |
| Aggiungere un badge di gamification | SQL schema `sql/gamification_schema.sql` + `useGamification` |
