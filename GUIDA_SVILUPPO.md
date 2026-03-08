# Guida sviluppo — Alter

## File modificati per sessione (riferimento rapido)

| Cosa vuoi fare | File da toccare |
|---|---|
| Nuova pagina | `pages/NomePagina.tsx` + `pages/NomePagina.css` + `App.tsx` + `Sidebar.tsx` + `MobileTopbar.tsx` |
| Stili globali / layout | `styles/global.css` |
| Tema (colori) | `styles/themes.ts` |
| Auth (login/register/logout) | `context/AuthContext.tsx` |
| Dati da Supabase | `hooks/useQualcosa.ts` |
| Componente riusabile | `components/ui/` o `components/NomeSezione/` |
| Variabili d'ambiente | `.env` |

---

## 1. Aggiungere una nuova sezione/pagina

### Step 1 — Crea i file
```
client/src/pages/MiaPagina.tsx
client/src/pages/MiaPagina.css
```

### Step 2 — Registra la route in `App.tsx`
```tsx
const MiaPagina = lazy(() => import('@/pages/MiaPagina'));

// dentro <Routes>, sotto gli altri <Route>:
<Route path="/mia-pagina" element={<MiaPagina />} />
```

### Step 3 — Aggiungi il link nella sidebar (`components/layout/Sidebar.tsx`)
```tsx
const NAV_ITEMS = [
  ...
  { to: '/mia-pagina', label: 'Mia Pagina', icon: '🔥' },
];
```
Fai lo stesso in `MobileTopbar.tsx` (stesso array NAV_ITEMS).

### Step 4 — Struttura minima della pagina
```tsx
import './MiaPagina.css';

export default function MiaPagina() {
  return (
    <div className="mia-pagina">
      <header className="mia-pagina__header">
        <h1>Titolo</h1>
      </header>
      {/* contenuto */}
    </div>
  );
}
```

---

## 2. Aggiungere un bottone / componente UI

Usa il componente `Button` già esistente:
```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" onClick={handleClick}>
  Testo
</Button>

// varianti: primary | secondary | ghost | danger
// size:     sm | md | lg
// prop:     loading={true}  →  mostra spinner
```

Usa `Input` per i campi:
```tsx
import { Input } from '@/components/ui';

<Input
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error="Campo obbligatorio"   // opzionale
  hint="Suggerimento"          // opzionale
/>
```

Se hai bisogno di un componente custom, crealo in:
```
components/ui/MioComponente.tsx
```
ed esportalo da `components/ui/index.ts`.

---

## 3. Leggere / scrivere dati su Supabase

### Struttura hook (pattern da seguire sempre)

Crea `hooks/useMieiDati.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

// chiave cache — deve essere unica per ogni entità
const KEY = ['miei-dati'];

// LEGGI
export function useMieiDati() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nome_tabella')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// SCRIVI
export function useAggiungiDato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { campo: string }) => {
      const { error } = await supabase.from('nome_tabella').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }), // aggiorna cache
  });
}

// ELIMINA
export function useEliminaDato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('nome_tabella').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

### Usa l'hook nella pagina
```tsx
import { useMieiDati, useAggiungiDato } from '@/hooks/useMieiDati';

export default function MiaPagina() {
  const { data, isPending, isError } = useMieiDati();
  const { mutate: aggiungi, isPending: saving } = useAggiungiDato();

  if (isPending) return <div>Caricamento...</div>;
  if (isError)   return <div>Errore nel caricamento</div>;

  return (
    <>
      {data?.map(item => <div key={item.id}>{item.campo}</div>)}
      <Button loading={saving} onClick={() => aggiungi({ campo: 'valore' })}>
        Aggiungi
      </Button>
    </>
  );
}
```

### Filtrare per utente loggato
```ts
const { data: { user } } = await supabase.auth.getUser();

const { data } = await supabase
  .from('nome_tabella')
  .select('*')
  .eq('user_id', user?.id);  // filtra per utente
```

---

## 4. Aggiungere funzionalità auth

Tutto l'auth passa da `context/AuthContext.tsx`.

Aggiungi il metodo al context:
```ts
// in AuthContext.tsx — dentro AuthProvider:
const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};

// aggiungi all'interfaccia AuthContextValue:
resetPassword: (email: string) => Promise<void>;

// aggiungi al Provider value:
<AuthContext.Provider value={{ user, loading, login, register, logout, resetPassword }}>
```

Poi usalo ovunque con:
```ts
const { resetPassword } = useAuth();
```

---

## 5. Aggiungere / modificare un tema

In `styles/themes.ts`, aggiungi una nuova entry all'oggetto `THEMES`:
```ts
export const THEMES: ThemeMap = {
  ...
  mytema: {
    '--bg': '#1a1a2e',
    '--bg-surface': '#16213e',
    '--text': '#eaeaea',
    '--text-muted': '#888888',
    '--accent': '#e94560',
    '--accent-soft': '#e9456022',
    '--border': '#2a2a4a',
    '--radius': '8px',
  },
};
```

Il tema appare automaticamente in Settings → selettore tema.
Aggiorna anche il tipo `ThemeName` in `types/index.ts` se è un union type.

---

## 6. CSS — regole da seguire

### Variabili disponibili (funzionano con tutti i temi)
```css
var(--bg)           /* sfondo principale */
var(--bg-surface)   /* sfondo card / pannelli */
var(--text)         /* testo principale */
var(--text-muted)   /* testo secondario */
var(--accent)       /* colore accent principale */
var(--accent-soft)  /* accent con opacità (per sfondi, glow) */
var(--border)       /* bordi */
var(--radius)       /* border-radius standard */
```

### Convenzione nomi classi
Usa il prefisso della pagina/componente per evitare conflitti:
```css
/* pagina Finance → prefisso "fin-" */
.fin-root { }
.fin-header { }
.fin-card { }

/* pagina Psychology → prefisso "psy-" */
.psy-root { }
```

### Dove mettere i CSS
| Tipo | File |
|---|---|
| Stili di una pagina specifica | `pages/NomePagina.css` |
| Stili layout (sidebar, shell) | `styles/global.css` |
| Stili componente riusabile | dentro il file `.tsx` del componente (inline) o un CSS separato |
| **Mai** | `index.css` (solo reset), `themes.ts` (solo valori colori) |

---

## 7. Aggiungere un tipo TypeScript

Tutti i tipi stanno in `types/index.ts`:
```ts
export interface MiaNuovaEntita {
  id: string;
  user_id: string;
  campo: string;
  created_at: string;
}
```

---

## 8. Variabili d'ambiente

Nel file `.env` nella root del progetto `client/`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=/api
```

Accesso nel codice:
```ts
import { env } from '@/config/env'; // già validato con Zod
```

**Non usare mai** `import.meta.env.VITE_...` direttamente — passa sempre da `@/config/env`.

---

## 9. File da NON toccare (mai)

| File | Perché |
|---|---|
| `index.css` | Solo reset CSS base |
| `providers/QueryProvider.tsx` | Configurazione TanStack Query |
| `services/supabase.ts` | Client Supabase già configurato |
| `config/env.ts` | Validazione env con Zod |
| `hooks/useAuth.ts` | Solo wrapper del context |
| `hooks/useTheme.ts` | Solo wrapper del context |

---

## 10. Checklist per ogni nuova feature

- [ ] Tipo aggiunto in `types/index.ts`
- [ ] Hook creato in `hooks/useQualcosa.ts`
- [ ] Pagina in `pages/` con CSS dedicato
- [ ] Route aggiunta in `App.tsx`
- [ ] Link aggiunto in `Sidebar.tsx` e `MobileTopbar.tsx`
- [ ] Tabella creata in Supabase con RLS abilitato per `user_id`
