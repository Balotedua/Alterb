import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';

type SaveState = 'idle' | 'loading' | 'saved' | 'error';

function getInitials(name: string | undefined, email: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function PanelProfilo() {
  const { user } = useAuth();

  const metaName = (user?.user_metadata?.['name'] as string | undefined) ?? '';
  const metaBio = (user?.user_metadata?.['bio'] as string | undefined) ?? '';
  const metaAvatarUrl = (user?.user_metadata?.['avatar_url'] as string | undefined) ?? '';

  const [name, setName] = useState<string>(metaName);
  const [bio, setBio] = useState<string>(metaBio);
  const [avatarPreview, setAvatarPreview] = useState<string>(metaAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }, []);

  const handleRemoveAvatar = useCallback(() => {
    setAvatarPreview('');
    setAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaveState('loading');
    setErrorMsg('');

    try {
      // TODO: se avatarFile è presente, caricarlo su Supabase Storage bucket 'avatars'
      // con path `${user.id}/avatar.${avatarFile?.name.split('.').pop()}`
      // e ottenere la public URL da inserire in avatar_url
      void avatarFile;

      const { error } = await supabase.auth.updateUser({
        data: { name, bio },
      });

      if (error) throw new Error(error.message);

      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setErrorMsg(message);
      setSaveState('error');
    }
  }, [user, name, bio]);

  const email = user?.email ?? '';
  const initials = getInitials(name, email);
  const hasAvatar = avatarPreview.length > 0;

  const saveLabel =
    saveState === 'loading'
      ? 'Salvataggio...'
      : saveState === 'saved'
        ? '✓ Salvato'
        : 'Salva modifiche';

  return (
    <div className="st-panel">
      {/* Avatar */}
      <div className="st-section">
        <p className="st-section__title">Avatar</p>
        <div className="st-section__body" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            className="st-avatar"
            onClick={handleAvatarClick}
            role="button"
            tabIndex={0}
            aria-label="Cambia avatar"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleAvatarClick();
            }}
          >
            {hasAvatar ? (
              <img src={avatarPreview} alt="Avatar" className="st-avatar__img" />
            ) : (
              <span className="st-avatar__initials">{initials}</span>
            )}
            <span className="st-avatar__overlay">◉ Cambia</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            tabIndex={-1}
          />

          {hasAvatar && (
            <Button variant="ghost" size="sm" onClick={handleRemoveAvatar} type="button">
              Rimuovi
            </Button>
          )}
        </div>
      </div>

      {/* Dati profilo */}
      <div className="st-section">
        <p className="st-section__title">Informazioni</p>
        <div className="st-section__body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Nome"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Il tuo nome"
          />

          {/* Bio — textarea nativa, max 160 chars */}
          <div className="input-group">
            <label className="input-label" htmlFor="bio-input">
              Bio
            </label>
            <textarea
              id="bio-input"
              value={bio}
              maxLength={160}
              rows={3}
              placeholder="Scrivi qualcosa su di te..."
              onChange={(e) => setBio(e.target.value)}
              style={{
                width: '100%',
                resize: 'vertical',
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'right',
                margin: '4px 0 0',
              }}
            >
              {bio.length}/160
            </p>
          </div>

          {/* Email read-only */}
          <div className="input-group">
            <label className="input-label">Email</label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <input
                className="input"
                type="email"
                value={email}
                readOnly
                disabled
                style={{ flex: 1 }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#22c55e',
                  background: '#22c55e18',
                  border: '1px solid #22c55e44',
                  borderRadius: 20,
                  padding: '2px 10px',
                  whiteSpace: 'nowrap',
                }}
              >
                Verificata
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Azioni */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button
          variant="primary"
          loading={saveState === 'loading'}
          onClick={handleSave}
          type="button"
        >
          {saveLabel}
        </Button>
        {saveState === 'error' && (
          <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{errorMsg}</p>
        )}
      </div>

    </div>
  );
}
