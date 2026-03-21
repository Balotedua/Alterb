import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import './LoginScreen.css';

type Tab = 'login' | 'register';

export default function LoginScreen({ initialError }: { initialError?: string | null }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setConfirm('');
    setFirstName('');
    setLastName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (tab === 'register') {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Nome e cognome sono obbligatori');
        return;
      }
      if (password !== confirm) {
        setError('Le password non coincidono');
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          avatar_url: null,
        });
        setSuccess('Controlla la tua email per confermare la registrazione.');
      }
    } catch {
      setError(tab === 'login' ? 'Email o password errati' : 'Registrazione fallita. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-root">

      {/* background animato */}
      <div className="lp-bg" />
      <div className="lp-bg-extra" />
      <div className="lp-bg-grid" />

      {/* card centrale */}
      <div className="lp-card">

        {/* brand */}
        <div className="lp-brand">
          <div className="lp-entity">
            <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* static tracks */}
              <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5"/>
              <circle cx="28" cy="28" r="15" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
              {/* animated arcs */}
              <circle cx="28" cy="28" r="24"
                stroke="url(#entityGrad)" strokeWidth="1.5"
                strokeDasharray="150.8" strokeDashoffset="37.7"
                strokeLinecap="round" className="lp-arc-outer"/>
              <circle cx="28" cy="28" r="15"
                stroke="#a78bfa" strokeWidth="1"
                strokeDasharray="94.2" strokeDashoffset="70.6"
                strokeLinecap="round" className="lp-arc-inner"/>
              {/* center pulse */}
              <circle cx="28" cy="28" r="2.5" fill="rgba(240,192,64,0.65)" className="lp-dot-pulse"/>
              <defs>
                <linearGradient id="entityGrad" x1="4" y1="4" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f0c040"/>
                  <stop offset="100%" stopColor="#40e0d0"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="lp-wordmark">Alter</span>
          <span className="lp-tagline">Il tuo universo personale</span>
        </div>

        {/* tabs */}
        <div className="lp-tabs">
          <button
            className={`lp-tab ${tab === 'login' ? 'lp-tab--active' : ''}`}
            onClick={() => switchTab('login')}
            type="button"
          >
            Accedi
          </button>
          <button
            className={`lp-tab ${tab === 'register' ? 'lp-tab--active' : ''}`}
            onClick={() => switchTab('register')}
            type="button"
          >
            Registrati
          </button>
          <span
            className="lp-tab-indicator"
            style={{ transform: `translateX(${tab === 'login' ? '0%' : '100%'})` }}
          />
        </div>

        {/* header */}
        <div className="lp-form-header">
          <h2 className="lp-form-title">
            {tab === 'login' ? 'Bentornato' : 'Crea account'}
          </h2>
          <p className="lp-form-sub">
            {tab === 'login'
              ? 'Inserisci le tue credenziali per accedere'
              : 'Inizia il tuo percorso con Alter'}
          </p>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="lp-form" key={tab}>

          {tab === 'register' && (
            <div className="lp-field-row lp-field--anim">
              <div className="lp-field">
                <label className="lp-label" htmlFor="lp-firstname">Nome</label>
                <input
                  id="lp-firstname"
                  className="lp-input"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Mario"
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="lp-field">
                <label className="lp-label" htmlFor="lp-lastname">Cognome</label>
                <input
                  id="lp-lastname"
                  className="lp-input"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Rossi"
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>
          )}

          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-email">Email</label>
            <input
              id="lp-email"
              className="lp-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="lp-field">
            <label className="lp-label" htmlFor="lp-password">Password</label>
            <input
              id="lp-password"
              className="lp-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {tab === 'register' && (
            <div className="lp-field lp-field--anim">
              <label className="lp-label" htmlFor="lp-confirm">Conferma password</label>
              <input
                id="lp-confirm"
                className="lp-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {error && <div className="lp-msg lp-msg--error">{error}</div>}
          {success && <div className="lp-msg lp-msg--success">{success}</div>}

          <button type="submit" className="lp-btn" disabled={loading}>
            {loading
              ? <span className="lp-btn__spinner" />
              : tab === 'login' ? 'Accedi' : 'Crea account'}
          </button>

        </form>

        <p className="lp-switch">
          {tab === 'login' ? 'Non hai un account?' : 'Hai già un account?'}
          {' '}
          <button
            type="button"
            className="lp-switch__link"
            onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
          >
            {tab === 'login' ? 'Registrati' : 'Accedi'}
          </button>
        </p>

      </div>
    </div>
  );
}
