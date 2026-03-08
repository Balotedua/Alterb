import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import './Login.css';

type Mode = 'login' | 'register';

const ORBS = [
  { id: 1, size: 520, top: -12, left: -8,  color: '124,58,237',  opacity: 0.08, blur: 110, dur: 22, delay: 0   },
  { id: 2, size: 360, top: 55,  left: 30,  color: '6,182,212',   opacity: 0.06, blur: 90,  dur: 18, delay: -8  },
  { id: 3, size: 200, top: 20,  left: 65,  color: '52,211,153',  opacity: 0.07, blur: 70,  dur: 14, delay: -5  },
];

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [registered, setRegistered] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setEmail('');
    setPassword('');
    setConfirm('');
    setError('');
    setRegistered(false);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && password !== confirm) {
      setError('Le password non coincidono.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setRegistered(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Si è verificato un errore.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">

      {/* ── SINISTRA — brand panel ── */}
      <aside className="login-brand-panel">
        {ORBS.map(o => (
          <div
            key={o.id}
            className={`login-orb login-orb--${o.id}`}
            style={{
              width:  o.size,
              height: o.size,
              top:    `${o.top}%`,
              left:   `${o.left}%`,
              background: `radial-gradient(circle at 40% 40%, rgba(${o.color},${o.opacity}) 0%, transparent 68%)`,
              filter: `blur(${o.blur}px)`,
              animationDuration: `${o.dur}s`,
              animationDelay:    `${o.delay}s`,
            }}
          />
        ))}

        <div className="login-brand-content">
          <div className="login-monogram" aria-label="Alter">
            <span className="login-monogram__a">A</span>
            <span className="login-monogram__rest">lter</span>
          </div>

          <p className="login-brand-tagline">
            La tua evoluzione personale,<br />tracciata con precisione.
          </p>

          <div className="login-brand-rule" />

          <ul className="login-pillars">
            <li>
              <span className="login-pillars__dot login-pillars__dot--violet" />
              Finanze intelligenti
            </li>
            <li>
              <span className="login-pillars__dot login-pillars__dot--cyan" />
              Salute &amp; attività
            </li>
            <li>
              <span className="login-pillars__dot login-pillars__dot--emerald" />
              Mindset &amp; crescita
            </li>
          </ul>
        </div>

        <p className="login-brand-ver">v 1.0</p>
      </aside>

      {/* ── DESTRA — form panel ── */}
      <main className="login-form-panel">
        <div className="login-card" role="region" aria-label={mode === 'login' ? 'Accedi' : 'Registrati'}>

          {/* Tab switcher */}
          <div className="login-tabs" role="tablist">
            <div className={`login-tabs__pill${mode === 'register' ? ' login-tabs__pill--right' : ''}`} />
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={`login-tab${mode === 'login' ? ' login-tab--active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Accedi
            </button>
            <button
              role="tab"
              aria-selected={mode === 'register'}
              className={`login-tab${mode === 'register' ? ' login-tab--active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Registrati
            </button>
          </div>

          {/* Successo registrazione */}
          {registered ? (
            <div className="login-success" role="status">
              <span className="login-success__icon">✓</span>
              <p className="login-success__title">Account creato!</p>
              <p className="login-success__sub">
                Controlla la tua email per confermare l&apos;account, poi accedi.
              </p>
              <button className="login-success__link" onClick={() => switchMode('login')}>
                Vai al login →
              </button>
            </div>
          ) : (
            <form
              key={mode}
              onSubmit={handleSubmit}
              noValidate
              className="login-form"
            >
              <div className="login-fields">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@esempio.it"
                  autoComplete="email"
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                {mode === 'register' && (
                  <Input
                    label="Conferma password"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                )}
              </div>

              {error && (
                <p className="login-error" role="alert">{error}</p>
              )}

              <Button
                type="submit"
                loading={loading}
                disabled={loading || !email || !password || (mode === 'register' && !confirm)}
                className="login-cta"
              >
                {loading
                  ? mode === 'login' ? 'Accesso…' : 'Creazione…'
                  : mode === 'login' ? 'Entra'    : 'Crea account'}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
