import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import './LoginScreen.css';

type Tab = 'login' | 'register' | 'forgot' | 'reset';

export default function LoginScreen({
  initialError,
  initialMode = 'login',
  onPasswordReset,
}: {
  initialError?: string | null;
  initialMode?: Tab;
  onPasswordReset?: () => void;
}) {
  const { login, register, sendPasswordReset, updatePassword } = useAuth();
  const [tab, setTab] = useState<Tab>(initialMode);
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

    if (tab === 'reset' && password !== confirm) {
      setError('Le password non coincidono');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else if (tab === 'register') {
        await register(email, password, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          avatar_url: null,
        });
        setSuccess('Controlla la tua email per confermare la registrazione.');
      } else if (tab === 'forgot') {
        await sendPasswordReset(email);
        setSuccess('Link inviato. Controlla la tua email.');
      } else if (tab === 'reset') {
        await updatePassword(password);
        onPasswordReset?.();
      }
    } catch {
      if (tab === 'login') setError('Email o password errati');
      else if (tab === 'register') setError('Registrazione fallita. Riprova.');
      else if (tab === 'forgot') setError('Email non trovata o errore. Riprova.');
      else if (tab === 'reset') setError('Errore nel salvataggio. Riprova.');
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

        {/* tabs — solo in login/register */}
        {(tab === 'login' || tab === 'register') && (
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
        )}

        {/* header */}
        <div className="lp-form-header">
          <h2 className="lp-form-title">
            {tab === 'login' && 'Bentornato'}
            {tab === 'register' && 'Crea account'}
            {tab === 'forgot' && 'Password dimenticata'}
            {tab === 'reset' && 'Nuova password'}
          </h2>
          <p className="lp-form-sub">
            {tab === 'login' && 'Inserisci le tue credenziali per accedere'}
            {tab === 'register' && 'Inizia il tuo percorso con Alter'}
            {tab === 'forgot' && 'Ti inviamo un link per reimpostare la password'}
            {tab === 'reset' && 'Scegli una nuova password per il tuo account'}
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

          {(tab === 'login' || tab === 'register' || tab === 'forgot') && (
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
          )}

          {(tab === 'login' || tab === 'register' || tab === 'reset') && (
            <div className="lp-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="lp-label" htmlFor="lp-password">
                  {tab === 'reset' ? 'Nuova password' : 'Password'}
                </label>
                {tab === 'login' && (
                  <button
                    type="button"
                    className="lp-switch__link"
                    style={{ fontSize: '9px', letterSpacing: '0.05em' }}
                    onClick={() => switchTab('forgot')}
                  >
                    Dimenticata?
                  </button>
                )}
              </div>
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
          )}

          {(tab === 'register' || tab === 'reset') && (
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

          {!success && (
            <button type="submit" className="lp-btn" disabled={loading}>
              {loading ? <span className="lp-btn__spinner" /> : (
                <>
                  {tab === 'login' && 'Accedi'}
                  {tab === 'register' && 'Crea account'}
                  {tab === 'forgot' && 'Invia link'}
                  {tab === 'reset' && 'Salva password'}
                </>
              )}
            </button>
          )}

        </form>

        <p className="lp-switch">
          {(tab === 'login' || tab === 'forgot') && (
            <>
              {tab === 'login' ? 'Non hai un account?' : 'Ricordi la password?'}
              {' '}
              <button
                type="button"
                className="lp-switch__link"
                onClick={() => switchTab('login')}
              >
                {tab === 'login' ? 'Registrati' : 'Accedi'}
              </button>
            </>
          )}
          {tab === 'register' && (
            <>
              Hai già un account?{' '}
              <button type="button" className="lp-switch__link" onClick={() => switchTab('login')}>
                Accedi
              </button>
            </>
          )}
        </p>

      </div>
    </div>
  );
}
